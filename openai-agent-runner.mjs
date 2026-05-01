#!/usr/bin/env node

import { chromium } from 'playwright';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const root = process.cwd();
const command = process.argv[2] || 'help';
const args = process.argv.slice(3);
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const paths = {
  cv: join(root, 'cv.md'),
  digest: join(root, 'article-digest.md'),
  profile: join(root, 'config', 'profile.yml'),
  profileMode: join(root, 'modes', '_profile.md'),
  sharedMode: join(root, 'modes', '_shared.md'),
  autoPipelineMode: join(root, 'modes', 'auto-pipeline.md'),
  ofertaMode: join(root, 'modes', 'oferta.md'),
  contactoMode: join(root, 'modes', 'contacto.md'),
  pdfMode: join(root, 'modes', 'pdf.md'),
  pipeline: join(root, 'data', 'pipeline.md'),
  history: join(root, 'data', 'scan-history.tsv'),
  reports: join(root, 'reports'),
  output: join(root, 'output'),
  agentOutput: join(root, 'output', 'openai-agent'),
  trackerAdditions: join(root, 'batch', 'tracker-additions'),
};

loadDotEnv();

const model = process.env.OPENAI_MODEL || 'gpt-4.1';
const apiKey = process.env.OPENAI_API_KEY;
const maxJobs = Number(getArgValue('--max') || 3);
const dryRun = args.includes('--dry-run');

function usage() {
  console.log(`OpenAI Career-Ops runner

Usage:
  node openai-agent-runner.mjs status
  node openai-agent-runner.mjs pipeline --max=3
  node openai-agent-runner.mjs evaluate <job-url> [company] [role]

Environment:
  OPENAI_API_KEY   required
  OPENAI_MODEL     optional, default: gpt-4.1

Safety:
  This runner writes reports, PDFs, tracker additions, and drafts.
  It never submits applications or sends LinkedIn messages.
`);
}

function loadDotEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;

  for (const line of read(envPath).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    value = value.replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function getArgValue(name) {
  const arg = args.find((item) => item.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : '';
}

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function ensureDirs() {
  for (const dir of [paths.reports, paths.output, paths.agentOutput, paths.trackerAdditions, dirname(paths.history)]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(paths.history)) {
    writeFileSync(paths.history, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\n');
  }
}

function requireApiKey() {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Add it to your environment or a local .env file.');
  }
}

function parsePipelineJobs(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('- [ ]'))
    .map((line) => {
      const body = line.replace(/^- \[ \]\s*/, '').trim();
      const parts = body.split('|').map((part) => part.trim());
      return {
        raw: line,
        url: parts[0],
        company: parts[1] || 'Unknown',
        title: parts[2] || 'Unknown Role',
      };
    })
    .filter((job) => /^https?:\/\//i.test(job.url));
}

function nextReportNumber() {
  if (!existsSync(paths.reports)) return 1;
  const nums = readdirSync(paths.reports)
    .map((name) => name.match(/^(\d{3})-/)?.[1])
    .filter(Boolean)
    .map(Number);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function slugify(text) {
  return String(text || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

function escapeHtml(text) {
  return String(text || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function markdownToHtml(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const out = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    if (/^#\s+/.test(trimmed)) {
      closeList();
      out.push(`<h1>${escapeHtml(trimmed.replace(/^#\s+/, ''))}</h1>`);
    } else if (/^##\s+/.test(trimmed)) {
      closeList();
      out.push(`<h2>${escapeHtml(trimmed.replace(/^##\s+/, ''))}</h2>`);
    } else if (/^###\s+/.test(trimmed)) {
      closeList();
      out.push(`<h3>${escapeHtml(trimmed.replace(/^###\s+/, ''))}</h3>`);
    } else if (/^-\s+/.test(trimmed)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inlineMarkdownToHtml(trimmed.replace(/^-\s+/, ''))}</li>`);
    } else {
      closeList();
      out.push(`<p>${inlineMarkdownToHtml(trimmed)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}

function inlineMarkdownToHtml(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((https?:\/\/.+?)\)/g, '<a href="$2">$1</a>');
}

async function fetchJobText(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const finalUrl = page.url();
    const title = await page.title().catch(() => '');
    const text = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
    return { finalUrl, pageTitle: title, text: text.slice(0, 30000) };
  } finally {
    await browser.close();
  }
}

function buildPrompt(job, jd) {
  return `You are Career-Ops running fully automated mode for Vanshika Reja.

Return ONLY valid JSON matching this shape:
{
  "company": "string",
  "role": "string",
  "score": 0.0,
  "status": "Evaluated" | "SKIP",
  "recommendation": "apply" | "skip" | "hold",
  "reportMarkdown": "markdown",
  "tailoredCvMarkdown": "markdown",
  "applicationAnswersMarkdown": "markdown",
  "outreachMarkdown": "markdown",
  "notes": "one-line tracker note"
}

Rules:
- Use only facts supported by cv.md, article-digest.md, profile.yml, and the job description.
- Do not invent skills, metrics, certifications, links, job requirements, or contact names.
- Keep tailoredCvMarkdown to one page worth of content. Condense; do not add unsupported detail.
- The report must include sections A-H:
  A Role Summary, B CV Match, C Level and Strategy, D Compensation/Demand if known or "not researched in offline runner",
  E Resume Personalization, F Interview Plan, G Draft Application Answers, H LinkedIn Outreach.
- H LinkedIn Outreach must include search links and message drafts, but no invented people.
- If the role is senior-only, geo-blocked, or unrelated, set status "SKIP" and recommendation "skip".
- Tracker status must be exactly Evaluated or SKIP.
- Score is 1.0 to 5.0.

Known mode instructions:

--- modes/_shared.md ---
${read(paths.sharedMode).slice(0, 12000)}

--- modes/_profile.md ---
${read(paths.profileMode).slice(0, 12000)}

--- modes/oferta.md ---
${read(paths.ofertaMode).slice(0, 12000)}

--- modes/contacto.md ---
${read(paths.contactoMode).slice(0, 9000)}

Candidate sources:

--- config/profile.yml ---
${read(paths.profile).slice(0, 12000)}

--- cv.md ---
${read(paths.cv).slice(0, 16000)}

--- article-digest.md ---
${read(paths.digest).slice(0, 12000)}

Job input:
URL: ${job.url}
Company from pipeline: ${job.company}
Role from pipeline: ${job.title}
Final URL: ${jd.finalUrl}
Page title: ${jd.pageTitle}

Job description text:
${jd.text}`;
}

async function callOpenAI(prompt) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 12000,
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}: ${json.error?.message || JSON.stringify(json).slice(0, 500)}`);
  }

  const text = extractResponseText(json);
  return parseJsonText(text);
}

function extractResponseText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n');
}

function parseJsonText(text) {
  const clean = String(text || '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) return JSON.parse(fenced);
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(clean.slice(start, end + 1));
    }
    throw new Error(`Model did not return parseable JSON. First 500 chars: ${clean.slice(0, 500)}`);
  }
}

async function writePdf(htmlPath, pdfPath) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
    const buffer = await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0.35in', bottom: '0.35in', left: '0.38in', right: '0.38in' },
    });
    return (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  } finally {
    await browser.close();
  }
}

function makeResumeHtml(markdown, job) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vanshika Reja - ${escapeHtml(job.title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 28px; font-size: 10.5px; line-height: 1.28; }
    h1 { font-size: 23px; margin: 0 0 5px; }
    h2 { font-size: 12px; margin: 10px 0 4px; color: #166873; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; text-transform: uppercase; }
    h3 { font-size: 11px; margin: 6px 0 2px; color: #5b21b6; }
    p { margin: 3px 0; }
    ul { margin: 3px 0 0 15px; padding: 0; }
    li { margin: 2px 0; }
    a { color: #111827; text-decoration: none; }
  </style>
</head>
<body>
${markdownToHtml(markdown)}
</body>
</html>`;
}

function reportHeader(result, job, pdfRelativePath) {
  const score = normalizeScore(result.score);
  return `# Evaluation: ${result.company || job.company} - ${result.role || job.title}

**Date:** ${today}
**Archetype:** ${inferArchetype(result.role || job.title)}
**Score:** ${score}/5
**URL:** ${job.url}
**PDF:** ${pdfRelativePath || 'pending'}

---

`;
}

function normalizeScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return '0.0';
  return Math.max(0, Math.min(5, value)).toFixed(1);
}

function inferArchetype(title) {
  const text = String(title || '').toLowerCase();
  if (text.includes('data')) return 'Data Analyst Intern';
  if (text.includes('machine learning') || /\bml\b/.test(text)) return 'ML Intern';
  if (text.includes('science')) return 'Data Science Intern';
  if (text.includes('ai')) return 'AI Intern';
  return 'Intern / Entry-level';
}

async function processJob(job, reportNum = nextReportNumber()) {
  console.log(`\nProcessing #${String(reportNum).padStart(3, '0')}: ${job.company} | ${job.title}`);
  const jd = await fetchJobText(job.url);
  if (!jd.text || jd.text.length < 300) {
    throw new Error('Could not extract enough job description text.');
  }

  const result = await callOpenAI(buildPrompt(job, jd));
  const company = result.company || job.company;
  const role = result.role || job.title;
  const slug = slugify(`${company}-${role}`);
  const reportName = `${String(reportNum).padStart(3, '0')}-${slug}-${today}.md`;
  const reportPath = join(paths.reports, reportName);
  const outDir = join(paths.agentOutput, `${String(reportNum).padStart(3, '0')}-${slug}`);
  mkdirSync(outDir, { recursive: true });

  const resumeHtmlPath = join(outDir, 'resume.html');
  const resumePdfPath = join(outDir, 'resume.pdf');
  const answersPath = join(outDir, 'answers.md');
  const outreachPath = join(outDir, 'outreach.md');
  const cvMarkdownPath = join(outDir, 'tailored-cv.md');

  writeFileSync(cvMarkdownPath, result.tailoredCvMarkdown || read(paths.cv));
  writeFileSync(resumeHtmlPath, makeResumeHtml(result.tailoredCvMarkdown || read(paths.cv), { title: role }));
  const pageCount = await writePdf(resumeHtmlPath, resumePdfPath);
  writeFileSync(answersPath, result.applicationAnswersMarkdown || '');
  writeFileSync(outreachPath, result.outreachMarkdown || '');

  const pdfRelative = `output/openai-agent/${String(reportNum).padStart(3, '0')}-${slug}/resume.pdf`;
  const report = reportHeader(result, { ...job, title: role, company }, pdfRelative)
    + (result.reportMarkdown || '')
    + `\n\n---\n\n## Generated Files\n\n- Tailored CV markdown: ${cvMarkdownPath}\n- Resume PDF: ${resumePdfPath}\n- Application answers: ${answersPath}\n- LinkedIn outreach: ${outreachPath}\n- PDF pages detected: ${pageCount}\n`;

  if (!dryRun) {
    writeFileSync(reportPath, report);
    writeTrackerAddition({ reportNum, company, role, result, reportName, pdfReady: true });
    appendFileSync(paths.history, `${job.url}\t${today}\topenai-agent\t${role}\t${company}\tprocessed\n`);
  }

  return { reportPath, reportName, company, role, score: normalizeScore(result.score), pdfRelative };
}

function writeTrackerAddition({ reportNum, company, role, result, reportName, pdfReady }) {
  const status = result.status === 'SKIP' ? 'SKIP' : 'Evaluated';
  const score = `${normalizeScore(result.score)}/5`;
  const pdf = pdfReady ? 'yes' : 'no';
  const note = String(result.notes || result.recommendation || '').replace(/\r?\n/g, ' ').slice(0, 180);
  const line = [
    reportNum,
    today,
    company,
    role,
    status,
    score,
    pdf,
    `[${String(reportNum).padStart(3, '0')}](reports/${reportName})`,
    note,
  ].join('\t');
  const tsvPath = join(paths.trackerAdditions, `${String(reportNum).padStart(3, '0')}-${slugify(company)}.tsv`);
  writeFileSync(tsvPath, `${line}\n`);
}

function markProcessed(results) {
  if (!results.length || dryRun) return;
  let text = read(paths.pipeline);
  for (const result of results) {
    const pending = text
      .split(/\r?\n/)
      .find((line) => line.startsWith('- [ ]') && line.includes(result.originalUrl));
    if (!pending) continue;
    const processed = `- [x] #${String(result.reportNum).padStart(3, '0')} | ${result.originalUrl} | ${result.company} | ${result.role} | ${result.score}/5 | PDF yes`;
    text = text.replace(pending, processed);
  }
  writeFileSync(paths.pipeline, text);
}

function runMerge() {
  if (dryRun) return;
  const result = spawnSync(process.execPath, ['merge-tracker.mjs', '--verify'], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status) {
    console.warn('merge-tracker.mjs reported an issue. Check output above.');
  }
}

async function runPipeline() {
  requireApiKey();
  ensureDirs();
  const jobs = parsePipelineJobs(read(paths.pipeline)).slice(0, maxJobs);
  if (!jobs.length) {
    console.log('No pending pipeline jobs found.');
    return;
  }

  const results = [];
  let reportNum = nextReportNumber();
  for (const job of jobs) {
    try {
      const result = await processJob(job, reportNum);
      results.push({ ...result, originalUrl: job.url, reportNum });
      reportNum += 1;
    } catch (error) {
      console.error(`Failed: ${job.company} | ${job.title}`);
      console.error(error.message);
    }
  }

  markProcessed(results);
  runMerge();

  console.log('\nOpenAI automation complete.');
  for (const result of results) {
    console.log(`- #${String(result.reportNum).padStart(3, '0')} ${result.company} | ${result.role} | ${result.score}/5`);
    console.log(`  ${result.reportPath}`);
  }
}

async function runEvaluate() {
  requireApiKey();
  ensureDirs();
  const [url, company = 'Unknown', ...roleParts] = args;
  const role = roleParts.join(' ') || 'Unknown Role';
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error('Usage: node openai-agent-runner.mjs evaluate <job-url> [company] [role]');
  }
  const result = await processJob({ url, company, title: role }, nextReportNumber());
  runMerge();
  console.log(`\nReport: ${result.reportPath}`);
}

function showStatus() {
  const pending = parsePipelineJobs(read(paths.pipeline)).length;
  const reports = existsSync(paths.reports)
    ? readdirSync(paths.reports).filter((name) => /^\d{3}-.+\.md$/i.test(name)).length
    : 0;
  console.log('OpenAI automation status\n');
  console.log(`OPENAI_API_KEY: ${apiKey ? 'set' : 'missing'}`);
  console.log(`OPENAI_MODEL: ${model}`);
  console.log(`Pending pipeline jobs: ${pending}`);
  console.log(`Existing reports: ${reports}`);
  console.log(`Dry run: ${dryRun ? 'yes' : 'no'}`);
}

try {
  if (command === 'help' || command === '--help' || command === '-h') {
    usage();
  } else if (command === 'status') {
    showStatus();
  } else if (command === 'pipeline') {
    await runPipeline();
  } else if (command === 'evaluate') {
    await runEvaluate();
  } else {
    console.error(`Unknown command: ${command}`);
    usage();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
