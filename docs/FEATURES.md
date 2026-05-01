# Career-Ops Feature Guide

This repo has two kinds of features:

- **Local commands** run directly from the terminal.
- **Agent-assisted modes** are invoked by asking Codex/Claude to use the listed mode file.

Career-Ops never submits applications or sends LinkedIn messages automatically. It prepares, tracks, and drafts; Vanshika reviews and acts manually.

## Quick Checks

```powershell
npm run features
npm run status
npm run doctor
npm run verify
```

## Local Commands

| Feature | Command | What it does |
|---------|---------|--------------|
| Feature menu | `npm run features` | Lists every available feature and command |
| Readiness/status | `npm run status` | Shows core files, pending jobs, reports, tracker entries, drafts |
| Scan | `npm run scan` | Scans configured sources, creates tailored resumes, answers, and outreach drafts |
| Apply helper | `npm run apply` | Shows latest application answers, outreach drafts, and pending jobs |
| Tracker summary | `npm run tracker` | Shows current application tracker counts |
| Pipeline inbox | `npm run pipeline` | Shows pending job URLs waiting for processing |
| Base PDF | `npm run pdf` | Generates the base ATS PDF from `cv.md` |
| Patterns | `npm run patterns` | Runs outcome analysis after 5+ progressed tracker entries |
| Health checks | `npm run verify`, `npm run sync-check` | Checks tracker/pipeline and profile/CV consistency |
| Cleanup | `npm run normalize`, `npm run dedup`, `npm run merge` | Normalizes statuses, deduplicates, merges tracker additions |
| Liveness | `npm run liveness` | Checks whether job links are still active |

## OpenAI Fully Automated Runner

If you do not have Claude CLI, use the OpenAI runner as the headless automation layer.

Create a local `.env` file, which is ignored by git:

```powershell
Copy-Item .env.example .env
notepad .env
```

Set:

```text
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1
```

Then run:

```powershell
npm.cmd run openai:status
npm.cmd run openai:pipeline -- --max=3
```

What it automates:

- Reads pending jobs from `data/pipeline.md`
- Extracts job descriptions with Playwright
- Calls the OpenAI Responses API
- Writes A-H reports in `reports/`
- Writes tailored CV markdown, PDF, application answers, and outreach drafts in `output/openai-agent/`
- Writes tracker TSV additions
- Runs `merge-tracker.mjs --verify`
- Marks processed jobs in `data/pipeline.md`

It still does not submit applications or send LinkedIn messages. Those remain manual review steps.

## Agent-Assisted Features

Run these by asking Codex in this repo. The npm scripts print the exact mode file and example prompts.

| Feature | Command | Ask Codex |
|---------|---------|-----------|
| Full auto-pipeline | `npm run evaluate` | `Evaluate this job URL with Career-Ops and run the full pipeline: <url>` |
| A-F evaluation report | `npm run evaluate` | `Run a full A-F evaluation for this pasted JD.` |
| Pipeline processing | `npm run pipeline` + Codex prompt | `Process my pending pipeline jobs with full Career-Ops reports.` |
| LinkedIn outreach | `npm run contact` | `Find LinkedIn hiring contacts and draft outreach for <Company> <Role>.` |
| Live application help | `npm run apply` + Codex prompt | `Help me answer this application form for <Company> <Role>.` |
| Interview prep | `npm run interview-prep` | `Prepare interview intelligence for <Company> <Role>.` |
| Deep company research | `npm run deep` | `Create deep company research for <Company> <Role>.` |
| Batch processing | `npm run batch` | `Batch process the pending roles in data/pipeline.md.` |
| Course/cert review | `npm run training` | `Evaluate whether this course is worth doing: <details/link>.` |
| Portfolio project review | `npm run project` | `Evaluate this portfolio project idea: <idea>.` |
| Multi-offer comparison | `npm run compare` | `Compare these offers/opportunities: <links/details>.` |

## Unlock Requirements

| Feature | Requirement |
|---------|-------------|
| Scan | `portals.yml`, `cv.md`, `config/profile.yml` |
| Full evaluation | Job URL/JD text, `cv.md`, profile files |
| PDF generation | Node dependencies + Playwright Chromium |
| Tracker | Full evaluations or manual status updates |
| Outreach | Company + role; WebSearch helps find public LinkedIn profile results |
| Interview prep | Company + role; best with an evaluation report |
| Story bank | Builds after evaluations/interview-prep generate STAR+R stories |
| Pattern analysis | At least 5 tracker entries beyond `Evaluated` |
| Dashboard TUI | Go installed + real tracker data |
| Batch processing | Many URLs + Claude CLI worker support |

## Recommended Workflow

1. `npm run scan`
2. Review `output/scan-results-*.md`
3. Ask Codex: `Process my pending pipeline jobs with full Career-Ops reports.`
4. Review generated reports, PDFs, answer drafts, and outreach drafts.
5. Apply manually to best-fit roles.
6. Update tracker statuses.
7. Use `npm run contact` for outreach support.
8. Use `npm run interview-prep` when a company responds.
9. After 5+ outcomes, run `npm run patterns`.
