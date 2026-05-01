#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const command = process.argv[2] || 'help';
const args = process.argv.slice(3);

const paths = {
  cv: join(root, 'cv.md'),
  profile: join(root, 'config', 'profile.yml'),
  profileMode: join(root, 'modes', '_profile.md'),
  portals: join(root, 'portals.yml'),
  pipeline: join(root, 'data', 'pipeline.md'),
  applications: join(root, 'data', 'applications.md'),
  reports: join(root, 'reports'),
  output: join(root, 'output'),
  storyBank: join(root, 'interview-prep', 'story-bank.md'),
  drafts: join(root, 'output', 'application-drafts-2026-04-26.md'),
  outreach: join(root, 'output', 'application-outreach-2026-04-26.md'),
  cvTemplate: join(root, 'templates', 'cv-template.html'),
  cvPdf: join(root, 'output', 'vanshika-cv.pdf'),
};

function runNodeScript(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  process.exitCode = result.status ?? 1;
}

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function fileCount(dir, pattern = /.*/) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((name) => pattern.test(name)).length;
}

function pendingPipelineLines() {
  return read(paths.pipeline)
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('- [ ]'));
}

function trackerRows() {
  return read(paths.applications)
    .split(/\r?\n/)
    .filter((line) => /^\|\s*\d+\s*\|/.test(line));
}

function progressedTrackerRows() {
  return trackerRows().filter((line) => !/\|\s*Evaluated\s*\|/i.test(line));
}

function latestPath(dir, pattern) {
  if (!existsSync(dir)) return '';
  const matches = readdirSync(dir)
    .filter((name) => pattern.test(name))
    .map((name) => join(dir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return matches[0] || '';
}

function printAgentMode(name, modeFile, promptExamples = []) {
  console.log(`career-ops ${name}\n`);
  console.log(`Mode file: ${modeFile}`);
  console.log('This feature runs through Codex/Claude using the checked-in mode instructions.');
  if (promptExamples.length) {
    console.log('\nUse one of these prompts:');
    for (const prompt of promptExamples) console.log(`  - ${prompt}`);
  }
  console.log('\nSafety: review all generated text yourself. Career-ops never submits applications or sends messages for you.');
}

function showHelp() {
  console.log(`
career-ops terminal helper

Usage:
  career-ops features            Show all feature commands
  career-ops status              Show readiness and current data
  career-ops scan                Scan configured sources and generate drafts
  career-ops pipeline            Show pending jobs to process
  career-ops apply               Show application drafts, outreach drafts, and pending jobs
  career-ops tracker             Show tracker summary
  career-ops pdf                 Generate output/vanshika-cv.pdf
  career-ops patterns            Run rejection/pattern analysis when enough data exists
  career-ops doctor              Check local setup
  career-ops verify              Verify tracker/pipeline health

PowerShell alternatives from this folder:
  .\\career-ops features
  .\\career-ops status
  .\\career-ops scan
  .\\career-ops apply
  npm run features
  npm run status
  npm run career -- scan
  npm run career -- apply
`);
}

function showFeatures() {
  console.log(`Career-Ops features

Automated/local commands:
  scan            Scan configured sources, tailor resumes, draft answers/outreach
  apply           Show latest answer/outreach drafts and pending roles
  tracker         Show application tracker summary
  pipeline        Show pending job URL inbox
  pdf             Generate the base ATS PDF from cv.md
  patterns        Analyze outcomes after 5+ progressed applications
  doctor          Check setup
  verify          Check tracker/pipeline health
  normalize       Normalize tracker statuses
  dedup           Remove duplicate tracker entries
  merge           Merge batch tracker additions
  liveness        Check whether tracked job links are still live
  openai          Fully automated OpenAI API runner status

Agent-assisted modes:
  evaluate        Full A-F job evaluation report + PDF + tracker entry
  contact         LinkedIn hiring-contact search and cold message drafts
  interview-prep  Company-specific interview intelligence and story mapping
  deep            Deep company research prompt
  batch           Parallel evaluation instructions for many roles
  training        Course/certification ROI evaluation
  project         Portfolio project scoring and 2-week MVP plan
  compare         Multi-offer comparison

Examples:
  npm run scan
  npm run apply
  npm run status
  npm run career -- evaluate
  npm run career -- interview-prep
  npm.cmd run openai:pipeline -- --max=3
`);
}

function showStatus() {
  const pending = pendingPipelineLines().length;
  const rows = trackerRows();
  const progressed = progressedTrackerRows();
  const reportCount = fileCount(paths.reports, /^(?!\.gitkeep).+\.md$/i);
  const tailoredCount = existsSync(join(paths.output, 'tailored'))
    ? readdirSync(join(paths.output, 'tailored')).length
    : 0;
  const latestDraft = latestDraftPath();
  const latestOutreach = latestOutreachPath();

  console.log('Career-Ops readiness\n');
  console.log(`Core files:`);
  console.log(`  cv.md: ${existsSync(paths.cv) ? 'ready' : 'missing'}`);
  console.log(`  config/profile.yml: ${existsSync(paths.profile) ? 'ready' : 'missing'}`);
  console.log(`  modes/_profile.md: ${existsSync(paths.profileMode) ? 'ready' : 'missing'}`);
  console.log(`  portals.yml: ${existsSync(paths.portals) ? 'ready' : 'missing'}`);

  console.log('\nCurrent data:');
  console.log(`  Pending pipeline jobs: ${pending}`);
  console.log(`  Tracker entries: ${rows.length}`);
  console.log(`  Progressed tracker entries: ${progressed.length}/5 needed for pattern analysis`);
  console.log(`  Evaluation reports: ${reportCount}`);
  console.log(`  Tailored output folders: ${tailoredCount}`);
  console.log(`  Story bank: ${existsSync(paths.storyBank) ? 'ready' : 'missing'}`);
  console.log(`  Latest application drafts: ${existsSync(latestDraft) ? latestDraft : 'none'}`);
  console.log(`  Latest outreach drafts: ${existsSync(latestOutreach) ? latestOutreach : 'none'}`);

  console.log('\nRecommended next actions:');
  if (pending > 0 && reportCount === 0) {
    console.log('  1. Ask Codex: "Process my pending pipeline jobs with full Career-Ops reports."');
  }
  if (rows.length === 0) {
    console.log('  2. Start using tracker statuses after each application: Applied, Interview, Rejected, Offer, SKIP.');
  }
  if (progressed.length < 5) {
    console.log('  3. Pattern analysis unlocks after 5 progressed tracker entries.');
  }
}

function showPipeline() {
  if (!existsSync(paths.pipeline)) {
    console.log('No data/pipeline.md found yet. Ask Codex to scan portals first.');
    return;
  }

  const lines = pendingPipelineLines();

  if (!lines.length) {
    console.log('No pending jobs in data/pipeline.md.');
    return;
  }

  console.log('Pending jobs:\n');
  for (const line of lines) {
    console.log(line.replace('- [ ] ', '  - '));
  }
}

function showApply() {
  console.log('Application helper\n');

  if (existsSync(paths.drafts)) {
    console.log(`Draft answers: ${paths.drafts}\n`);
  } else {
    console.log('No application draft file found in output/. Ask Codex to prepare application drafts.\n');
  }

  showPipeline();

  console.log('\nImportant: review each application yourself and submit manually.');
}

function latestDraftPath() {
  const outputDir = join(root, 'output');
  if (!existsSync(outputDir)) return paths.drafts;

  const drafts = readdirSync(outputDir)
    .filter((name) => /^application-drafts-.*\.md$/i.test(name))
    .map((name) => join(outputDir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  return drafts[0] || paths.drafts;
}

function latestOutreachPath() {
  const outputDir = join(root, 'output');
  if (!existsSync(outputDir)) return paths.outreach;

  const outreach = readdirSync(outputDir)
    .filter((name) => /^application-outreach-.*\.md$/i.test(name))
    .map((name) => join(outputDir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  return outreach[0] || paths.outreach;
}

function showScan() {
  runNodeScript('auto-scan.mjs', args);
}

function showApplyWithLatestDraft() {
  const draft = latestDraftPath();
  const outreach = latestOutreachPath();
  console.log('Career-Ops apply\n');

  if (existsSync(draft)) {
    console.log(`Draft answers: ${draft}\n`);
  } else {
    console.log('No application draft file found in output/. Ask Codex to prepare application drafts.\n');
  }

  if (existsSync(outreach)) {
    console.log(`LinkedIn outreach drafts: ${outreach}\n`);
  } else {
    console.log('No LinkedIn outreach draft file found in output/. Ask Codex to prepare outreach drafts.\n');
  }

  showPipeline();

  console.log('\nImportant: I can prepare draft answers and outreach notes, but you must review and submit applications/messages yourself.');
}

function showTracker() {
  const rows = trackerRows();
  if (!rows.length) {
    console.log('No tracker entries yet in data/applications.md.');
    console.log('Use a full evaluation/pipeline run first, then update statuses as you apply.');
    return;
  }

  const counts = new Map();
  for (const row of rows) {
    const cols = row.split('|').map((part) => part.trim()).filter(Boolean);
    const status = cols[5] || 'Unknown';
    counts.set(status, (counts.get(status) || 0) + 1);
  }

  console.log(`Tracker entries: ${rows.length}\n`);
  for (const [status, count] of counts.entries()) {
    console.log(`  ${status}: ${count}`);
  }
}

function showPatterns() {
  const progressed = progressedTrackerRows().length;
  if (progressed < 5) {
    console.log(`Pattern analysis is not ready yet: ${progressed}/5 progressed tracker entries.`);
    console.log('Progressed means Applied, Responded, Interview, Offer, Rejected, Discarded, or SKIP.');
    return;
  }
  runNodeScript('analyze-patterns.mjs', args);
}

switch (command) {
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
  case 'features':
  case 'menu':
    showFeatures();
    break;
  case 'status':
  case 'readiness':
    showStatus();
    break;
  case 'doctor':
    runNodeScript('doctor.mjs');
    break;
  case 'verify':
    runNodeScript('verify-pipeline.mjs');
    break;
  case 'normalize':
    runNodeScript('normalize-statuses.mjs');
    break;
  case 'dedup':
    runNodeScript('dedup-tracker.mjs');
    break;
  case 'merge':
    runNodeScript('merge-tracker.mjs');
    break;
  case 'liveness':
    runNodeScript('check-liveness.mjs', args);
    break;
  case 'openai':
  case 'auto':
    runNodeScript('openai-agent-runner.mjs', args.length ? args : ['status']);
    break;
  case 'pipeline':
    showPipeline();
    break;
  case 'tracker':
    showTracker();
    break;
  case 'scan':
    showScan();
    break;
  case 'apply':
    showApplyWithLatestDraft();
    break;
  case 'patterns':
    showPatterns();
    break;
  case 'evaluate':
  case 'auto-pipeline':
    printAgentMode('evaluate', 'modes/auto-pipeline.md', [
      'Evaluate this job URL with Career-Ops and run the full pipeline: <url>',
      'Run a full A-F evaluation for this pasted JD and generate the one-page resume PDF.',
    ]);
    break;
  case 'contact':
  case 'contacto':
  case 'outreach':
    printAgentMode('contact', 'modes/contacto.md', [
      'Find LinkedIn hiring contacts and draft outreach for <Company> <Role>.',
      'Prepare outreach for the jobs I applied to today.',
    ]);
    break;
  case 'interview-prep':
  case 'interview':
    printAgentMode('interview-prep', 'modes/interview-prep.md', [
      'Prepare interview intelligence for <Company> <Role>.',
      'Use my report for <Company> and build likely questions plus STAR story mapping.',
    ]);
    break;
  case 'deep':
    printAgentMode('deep', 'modes/deep.md', [
      'Create deep company research for <Company> <Role>.',
    ]);
    break;
  case 'batch':
    printAgentMode('batch', 'modes/batch.md', [
      'Batch process the pending roles in data/pipeline.md.',
      'Prepare a batch run for these job URLs.',
    ]);
    break;
  case 'training':
    printAgentMode('training', 'modes/training.md', [
      'Evaluate whether this course/certification is worth doing: <course link/details>.',
    ]);
    break;
  case 'project':
    printAgentMode('project', 'modes/project.md', [
      'Evaluate this portfolio project idea for my Data/ML/AI internship search: <idea>.',
    ]);
    break;
  case 'compare':
  case 'ofertas':
    printAgentMode('compare', 'modes/ofertas.md', [
      'Compare these offers/opportunities and rank them: <links/details>.',
    ]);
    break;
  case 'pdf':
    runNodeScript('generate-pdf.mjs', [paths.cvTemplate, paths.cvPdf]);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exitCode = 1;
}
