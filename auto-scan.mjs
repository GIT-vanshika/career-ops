#!/usr/bin/env node

import { chromium } from 'playwright';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, join, sep } from 'node:path';

const root = process.cwd();
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const maxOutputs = Number(process.argv.find((arg) => arg.startsWith('--max='))?.split('=')[1] || 6);

const paths = {
  cv: join(root, 'cv.md'),
  digest: join(root, 'article-digest.md'),
  profile: join(root, 'config', 'profile.yml'),
  portals: join(root, 'portals.yml'),
  pipeline: join(root, 'data', 'pipeline.md'),
  history: join(root, 'data', 'scan-history.tsv'),
  output: join(root, 'output'),
  tailored: join(root, 'output', 'tailored'),
};

const candidate = {
  name: 'Vanshika Reja',
  phone: '+91-9336548005',
  email: 'vanshikareja@gmail.com',
  location: 'Muradnagar, Ghaziabad, Uttar Pradesh, India',
  linkedin: 'linkedin.com/in/vanshika-reja',
  github: 'github.com/GIT-vanshika',
  leetcode: 'leetcode.com/Vanshikavidhi',
  education: 'B.Tech Electronics and Communication Engineering, Dr. A.P.J. Abdul Kalam Technical University, Sep 2023 - Jul 2027, SGPA: 7.7',
};

const skillKeywords = [
  'python', 'sql', 'pandas', 'numpy', 'matplotlib', 'seaborn', 'scikit-learn',
  'tensorflow', 'pytorch', 'keras', 'opencv', 'yolo', 'machine learning',
  'deep learning', 'computer vision', 'nlp', 'llm', 'rag', 'time series',
  'anomaly detection', 'feature engineering', 'eda', 'dashboard', 'flask',
  'docker', 'aws', 'linux', 'raspberry pi', 'data analysis', 'data visualization',
];

const proofPoints = [
  {
    id: 'analytics',
    match: ['data', 'analyst', 'analytics', 'dashboard', 'sql', 'pandas', 'visualization', 'bi'],
    title: 'AICTE Data Analyst Internship',
    bullets: [
      'Analyzed shopping trends data with Python, pandas, NumPy, and Matplotlib to identify consumer behavior patterns.',
      'Built automated data pipelines and interactive dashboards, reducing analysis time by 35%.',
    ],
  },
  {
    id: 'evaluation',
    match: ['evaluate', 'evaluation', 'benchmark', 'quality', 'architecture', 'feedback', 'llm', 'agent'],
    title: 'ML Project Evaluator, Girls Leading Tech Community',
    bullets: [
      'Evaluated 30+ AI/ML projects for a 1000+ member Amazon ML cohort across innovation, code quality, architecture, and scalability.',
      'Developed an evaluation framework that improved participant outcomes by 40% through detailed technical feedback.',
    ],
  },
  {
    id: 'edge-cv',
    match: ['computer vision', 'opencv', 'yolo', 'edge', 'tflite', 'tensorflow lite', 'raspberry', 'embedded', 'real-time'],
    title: 'Edge-Based Pothole Detection System',
    bullets: [
      'Built a real-time computer vision system using custom-trained YOLO optimized with INT8 quantization for TensorFlow Lite on Raspberry Pi.',
      'Implemented confidence thresholding, buffer flushing, and logging cooldowns for autonomous edge operation.',
    ],
  },
  {
    id: 'anomaly',
    match: ['anomaly', 'time series', 'unsupervised', 'autoencoder', 'telemetry', 'forecast', 'isolation forest'],
    title: 'Satellite Anomaly Detection',
    bullets: [
      'Developed anomaly detection for multivariate satellite telemetry using Isolation Forest and autoencoder neural networks.',
      'Reduced false positive rate to 8% through hyperparameter optimization and feature engineering with PCA and t-SNE.',
    ],
  },
  {
    id: 'hsi',
    match: ['research', 'remote sensing', 'geospatial', 'satellite', 'hyperspectral', 'environmental', 'signal'],
    title: 'Research Assistant, Space Lab',
    bullets: [
      'Conducting research on water contamination detection using Hyperspectral Imaging satellite techniques and spectral analysis.',
      'Authored a review paper on HSI methodologies for environmental monitoring and ML-based water quality assessment.',
    ],
  },
  {
    id: 'security',
    match: ['security', 'cyber', 'intrusion', 'network', 'classification', 'ensemble'],
    title: 'Network Intrusion Detection System',
    bullets: [
      'Building an ML classification pipeline using ensemble methods for network traffic classification and intrusion detection.',
      'Implementing feature extraction from network packet data for security threat identification.',
    ],
  },
];

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function clearOutputDirectory() {
  const normalizedOutput = paths.output.replace(/[/\\]+$/, '');
  if (!normalizedOutput.endsWith(sep + 'output')) {
    throw new Error(`Refusing to clear unexpected output path: ${paths.output}`);
  }

  if (existsSync(paths.output)) {
    for (const entry of readdirSync(paths.output)) {
      rmSync(join(paths.output, entry), { recursive: true, force: true });
    }
  }

  mkdirSync(paths.output, { recursive: true });
  writeFileSync(join(paths.output, '.gitkeep'), '');
}

function ensureDirs() {
  for (const dir of [paths.output, paths.tailored, join(root, 'data')]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(paths.history)) {
    writeFileSync(paths.history, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\n');
  }
  if (!existsSync(paths.pipeline)) {
    writeFileSync(paths.pipeline, '# Pipeline Inbox\n\n## Pendientes\n\n## Procesadas\n');
  }
}

function parseGreenhouseApis(portalsText) {
  const companies = [];
  const blocks = portalsText.split(/\n\s*-\s+name:\s+/).slice(1);
  for (const block of blocks) {
    const name = firstLine(block).replace(/^["']|["']$/g, '').trim();
    const api = block.match(/\n\s*api:\s*(https?:\/\/\S+)/)?.[1]?.trim();
    const enabled = !/\n\s*enabled:\s*false\b/i.test(block);
    if (name && api && enabled) companies.push({ name, api });
  }
  return companies;
}

function firstLine(text) {
  return text.split(/\r?\n/)[0] || '';
}

function parsePipelineJobs(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('- [ ]'))
    .map((line) => {
      const parts = line.replace(/^- \[ \]\s*/, '').split('|').map((part) => part.trim());
      return { url: parts[0], company: parts[1] || 'Unknown', title: parts[2] || 'Unknown Role', source: 'pipeline' };
    })
    .filter((job) => /^https?:\/\//i.test(job.url));
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'career-ops local scanner' } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'career-ops local scanner' } });
    if (!response.ok) return '';
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text') && !contentType.includes('html') && !contentType.includes('json')) return '';
    const raw = await response.text();
    return stripHtml(raw).slice(0, 14000);
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

function stripHtml(text) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function discoverGreenhouseJobs() {
  const companies = parseGreenhouseApis(read(paths.portals));
  const jobs = [];
  const results = await Promise.all(companies.map(async (company) => {
    const data = await fetchJson(company.api);
    const rows = Array.isArray(data?.jobs) ? data.jobs : [];
    return { company, rows };
  }));

  for (const { company, rows } of results) {
    for (const row of rows) {
      jobs.push({
        title: row.title || 'Unknown Role',
        company: company.name,
        url: row.absolute_url || row.url || company.api,
        location: Array.isArray(row.location) ? '' : row.location?.name || '',
        source: 'greenhouse_api',
      });
    }
  }
  return jobs;
}

function isRelevantTitle(title) {
  const t = title.toLowerCase();
  const studentFriendly = /\b(intern|internship|trainee|apprentice|fresher)\b|working student|entry[- ]level|new grad|graduate program|campus/i.test(t);
  const roleAligned = /\b(ai|ml|machine learning|data analyst|data science|analytics|computer vision|automation|python|sql)\b/i.test(t);
  const negative = /\b(senior|staff|principal|lead|head|director|manager|architect|account executive|sales|marketing|finance|legal|recruit|talent acquisition)\b|[2-9]\+ years|10\+ years/i.test(t);
  return studentFriendly && roleAligned && !negative;
}

function dedupe(jobs) {
  const seen = new Set();
  const out = [];
  for (const job of jobs) {
    const key = `${job.url || ''}`.toLowerCase() || `${job.company}|${job.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(job);
  }
  return out;
}

function scoreJob(job) {
  const haystack = `${job.title} ${job.company} ${job.location || ''} ${job.description || ''}`.toLowerCase();
  let score = 45;
  const reasons = [];

  if (/\b(intern|internship|trainee|fresher)\b|working student|entry[- ]level|new grad|graduate program|campus/.test(haystack)) {
    score += 18;
    reasons.push('student/internship level');
  }
  if (/machine learning| ml | ai |artificial intelligence|data science/.test(` ${haystack} `)) {
    score += 14;
    reasons.push('AI/ML aligned');
  }
  if (/data analyst|analytics|dashboard|sql|business intelligence|visualization/.test(haystack)) {
    score += 12;
    reasons.push('data analyst aligned');
  }
  if (/remote|india|bengaluru|bangalore|delhi|noida|gurgaon|gurugram|hyderabad|pune|mumbai|chennai/.test(haystack)) {
    score += 8;
    reasons.push('location/remote compatible');
  }
  if (/\b(senior|staff|principal|lead|head|director|manager|architect|account executive|sales|marketing|finance|legal|recruit|talent acquisition)\b|[2-9]\+ years|10\+ years/.test(haystack)) {
    score -= 35;
    reasons.push('seniority risk');
  }
  if (/unpaid/.test(haystack)) {
    score -= 8;
    reasons.push('may be unpaid');
  }

  const matchedSkills = skillKeywords.filter((skill) => haystack.includes(skill));
  score += Math.min(18, matchedSkills.length * 3);
  if (matchedSkills.length) reasons.push(`skills match: ${matchedSkills.slice(0, 6).join(', ')}`);

  const matchedProofs = selectProofs(job, 3);
  score += matchedProofs.length * 4;
  if (matchedProofs.length) reasons.push(`proof points: ${matchedProofs.map((p) => p.title).join('; ')}`);

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
    matchedSkills,
    matchedProofs,
  };
}

function selectProofs(job, count = 4) {
  const haystack = `${job.title} ${job.description || ''}`.toLowerCase();
  return proofPoints
    .map((proof) => ({
      ...proof,
      hits: proof.match.filter((word) => haystack.includes(word)).length,
    }))
    .sort((a, b) => b.hits - a.hits)
    .filter((proof) => proof.hits > 0)
    .slice(0, count);
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'role';
}

function escapeLatex(text) {
  return String(text || '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([#$%&_{}])/g, '\\$1')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}');
}

function inlineMarkdownToLatex(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    return bold ? `\\textbf{${escapeLatex(bold[1])}}` : escapeLatex(part);
  }).join('');
}

function inlineMarkdownToHtml(text) {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function parseCvSections() {
  const cvText = read(paths.cv).trim();
  if (!cvText) return [];
  const lines = cvText.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith('# ')) continue;
    const sectionMatch = line.match(/^##\s+(.+?)\s*$/);
    if (sectionMatch) {
      current = { title: sectionMatch[1], lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    current.lines.push(line);
  }

  return sections;
}

function renderLatexLines(lines) {
  const output = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      output.push('\\end{itemize}');
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      output.push('');
      continue;
    }

    const subheading = trimmed.match(/^###\s+(.+?)\s*$/);
    if (subheading) {
      closeList();
      output.push(`\\resumeSubhead{${escapeLatex(subheading[1])}}`);
      continue;
    }

    const bullet = trimmed.match(/^-\s+(.+?)\s*$/);
    if (bullet) {
      if (!inList) {
        output.push('\\begin{itemize}');
        inList = true;
      }
      output.push(`  \\item ${inlineMarkdownToLatex(bullet[1])}`);
      continue;
    }

    closeList();
    output.push(`${inlineMarkdownToLatex(trimmed)}\\\\`);
  }

  closeList();
  return output.join('\n');
}

function renderHtmlLines(lines) {
  const output = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      output.push('  </ul>');
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }

    const subheading = trimmed.match(/^###\s+(.+?)\s*$/);
    if (subheading) {
      closeList();
      output.push(`  <h3>${escapeHtml(subheading[1])}</h3>`);
      continue;
    }

    const bullet = trimmed.match(/^-\s+(.+?)\s*$/);
    if (bullet) {
      if (!inList) {
        output.push('  <ul>');
        inList = true;
      }
      output.push(`    <li>${inlineMarkdownToHtml(bullet[1])}</li>`);
      continue;
    }

    closeList();
    output.push(`  <p>${inlineMarkdownToHtml(trimmed)}</p>`);
  }

  closeList();
  return output.join('\n');
}

function makeLatex(job, analysis) {
  const sections = parseCvSections();

  return String.raw`\documentclass[10pt,a4paper]{article}
\usepackage[margin=0.42in]{geometry}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}
\usepackage{xcolor}
\usepackage{tabularx}
\usepackage{array}

\definecolor{resumeInk}{HTML}{1A1A2E}
\definecolor{resumeMuted}{HTML}{555555}
\definecolor{resumeTeal}{HTML}{157A89}
\definecolor{resumePurple}{HTML}{7A22C9}
\definecolor{resumeRule}{HTML}{E2E2E2}

\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\setlist[itemize]{leftmargin=1.15em, itemsep=2pt, topsep=3pt, parsep=0pt}
\renewcommand{\familydefault}{\sfdefault}

\newcommand{\resumeName}[1]{{\fontsize{24}{27}\selectfont\color{resumeInk}\textbf{#1}}}
\newcommand{\resumeContact}[1]{{\small\color{resumeMuted}#1}}
\newcommand{\resumeSection}[1]{\vspace{8pt}{\small\bfseries\color{resumeTeal}\MakeUppercase{#1}}\par\vspace{2pt}{\color{resumeRule}\hrule height 0.7pt}\vspace{5pt}}
\newcommand{\resumeSubhead}[1]{{\color{resumePurple}\textbf{#1}}\par\vspace{2pt}}

\begin{document}
\color{resumeInk}

\resumeName{${escapeLatex(candidate.name)}}\\[3pt]
{\color{resumeTeal}\hrule height 1.2pt}\vspace{5pt}
\resumeContact{${escapeLatex(candidate.email)} \;|\; \href{https://${escapeLatex(candidate.linkedin)}}{${escapeLatex(candidate.linkedin)}} \;|\; \href{https://${escapeLatex(candidate.github)}}{${escapeLatex(candidate.github)}} \;|\; \href{https://${escapeLatex(candidate.leetcode)}}{${escapeLatex(candidate.leetcode)}} \;|\; ${escapeLatex(candidate.location)}}

\vspace{6pt}
{\small\textbf{Target Role:} ${escapeLatex(job.title)} -- ${escapeLatex(job.company)}}

${sections.map((section) => '\\resumeSection{' + escapeLatex(section.title) + '}\n' + renderLatexLines(section.lines)).join('\n\n')}

\end{document}
`;
}

function makeHtml(job, analysis) {
  const sections = parseCvSections();

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${candidate.name} - ${job.title}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 34px; font-size: 12px; line-height: 1.35; }
    h1 { margin: 0; font-size: 24px; }
    h2 { margin: 14px 0 5px; font-size: 14px; border-bottom: 1px solid #aaa; padding-bottom: 2px; }
    p { margin: 5px 0; }
    ul { margin: 5px 0 0 18px; padding: 0; }
    li { margin: 3px 0; }
    .contact { margin-top: 3px; font-size: 11px; }
    .target { margin-top: 10px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>${candidate.name}</h1>
  <div class="contact">${candidate.location} | ${candidate.phone} | ${candidate.email}</div>
  <div class="contact">${candidate.linkedin} | ${candidate.github} | ${candidate.leetcode}</div>
  ${sections.map((section) => `<h2>${escapeHtml(section.title)}</h2>\n${renderHtmlLines(section.lines)}`).join('\n')}
</body>
</html>`;
}

function escapeHtml(text) {
  return String(text || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

function makeAnswers(job, analysis) {
  const strongest = analysis.matchedProofs[0] || proofPoints[0];
  return `# Application Answers -- ${job.company} -- ${job.title}

URL: ${job.url}
Fit score: ${analysis.score}/100

## Why are you interested in this role?

I am interested in the ${job.title} role at ${job.company} because it aligns with the kind of applied AI/ML and data work I am building toward as an ECE student: practical experimentation, clean Python implementation, model evaluation, and turning data into useful decisions. I am especially motivated by internship roles where I can learn from experienced engineers while contributing through data preparation, model testing, documentation, and small but reliable ML features.

## Why should we hire you?

You should consider me because I bring a strong learning mindset with real applied project evidence. ${strongest.bullets[0]} I have also worked with Python, pandas, NumPy, scikit-learn, TensorFlow, PyTorch, OpenCV, and data visualization tools. Alongside projects, I evaluated 30+ AI/ML projects for a 1000+ member cohort, which strengthened my ability to review model quality, communicate technical feedback, and understand what makes an ML project usable.

## Tell us about yourself.

I am Vanshika Reja, a B.Tech Electronics and Communication Engineering student at Dr. A.P.J. Abdul Kalam Technical University, graduating in 2027. I am focused on Data Analyst, ML Intern, and AI Intern roles. My experience includes hyperspectral imaging research, a Data Analyst internship using Python and dashboards, ML project evaluation, edge computer vision, satellite anomaly detection, and cybersecurity ML.

## Availability

I am available for internships depending on academic schedule and role requirements. I am open to remote, hybrid, or on-site opportunities in India and can discuss duration, hours, and joining date based on the internship structure.

## Stipend expectation

I am looking for a fair market internship stipend and am flexible based on the scope of work, mentorship, learning opportunity, and duration of the internship.
`;
}

function linkedInPeopleSearchUrl(query) {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
}

function makeOutreach(job, analysis) {
  const strongest = analysis.matchedProofs[0] || proofPoints[0];
  const roleFamily = /data/i.test(job.title)
    ? 'data analytics'
    : /machine learning|ml/i.test(job.title)
      ? 'machine learning'
      : /ai|artificial intelligence/i.test(job.title)
        ? 'AI'
        : 'internship';
  const recruiters = linkedInPeopleSearchUrl(`${job.company} recruiter talent acquisition university hiring campus recruiter`);
  const hiringManagers = linkedInPeopleSearchUrl(`${job.company} ${roleFamily} hiring manager lead manager`);
  const peers = linkedInPeopleSearchUrl(`${job.company} ${roleFamily} data analyst machine learning AI data science`);
  const shortRole = job.title.length > 46 ? `${job.title.slice(0, 43)}...` : job.title;

  return `# LinkedIn Outreach -- ${job.company} -- ${job.title}

URL: ${job.url}
Fit score: ${analysis.score}/100

## Hiring Contacts To Review

Use these searches to find real people manually. Prioritize current employees whose profile still says ${job.company}.

- Recruiters / university hiring: ${recruiters}
- Hiring manager / team lead: ${hiringManagers}
- Team peers: ${peers}

Look first for:
- Recruiter, Talent Acquisition, University Recruiter, Campus Recruiter, Early Talent
- Data/ML/AI/Analytics manager or team lead
- Data Analyst, ML Engineer, AI Engineer, or Data Scientist on the same team

## Connection Request

Hi, I applied for ${shortRole} at ${job.company}. I am an ECE student focused on Python, data, and ML, with project work in analytics and applied AI. Could I ask who is best to speak with about the role?

## Follow-Up After Accept

Thank you for connecting. I recently applied for the ${job.title} role at ${job.company}. My background is in ECE with applied data/ML work, including: ${strongest.bullets[0]} If you are not the right person, could you point me toward the recruiter or team member handling this internship?

## Post-Application Note

Hi, I wanted to share a quick note after applying for the ${job.title} role at ${job.company}. I am targeting Data Analyst, ML Intern, and AI Intern roles, and this one matched my Python/data/ML project background well. ${strongest.bullets[0]} I would appreciate any guidance on the next step or the right hiring contact.

## Safety Notes

- Do not send automatically.
- Verify the person's current company and title before messaging.
- Do not share phone number, Aadhaar, payment details, or private documents in LinkedIn messages.
- Never pay for referrals, certificates, training, or application processing.
`;
}

function makeReport(jobs) {
  return `# Career-Ops Automated Scan -- ${today}

Target: AI/ML/Data Analyst internships for Vanshika Reja

## Best Matches

${jobs.map((job, index) => `### ${index + 1}. ${job.company} -- ${job.title}

- Score: ${job.analysis.score}/100
- URL: ${job.url}
- Why: ${job.analysis.reasons.join('; ') || 'Relevant title match'}
- Tailored folder: output/tailored/${job.slug}
- Outreach pack: output/tailored/${job.slug}/outreach.md
`).join('\n')}

## Notes

- Terminal scan uses direct pipeline URLs and public Greenhouse APIs from portals.yml.
- General web search discovery still requires Codex chat or a search API.
- LinkedIn outreach packs include search links and message drafts; verify profiles manually before sending.
- Applications and messages are not submitted automatically. Review each PDF, answer draft, and outreach note before applying manually.
`;
}

async function renderPdf(htmlPath, pdfPath) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '0.35in', bottom: '0.35in', left: '0.35in', right: '0.35in' } });
  await browser.close();
}

function tryPdflatex(texPath, cwd) {
  const result = spawnSync('pdflatex', ['-interaction=nonstopmode', basename(texPath)], {
    cwd,
    stdio: 'ignore',
    shell: false,
  });
  return result.status === 0;
}

function addToPipeline(jobs) {
  const current = read(paths.pipeline);
  let updated = current;
  const additions = [];
  for (const job of jobs) {
    if (current.toLowerCase().includes(job.url.toLowerCase())) continue;
    additions.push(`- [ ] ${job.url} | ${job.company} | ${job.title}`);
  }
  if (!additions.length) return 0;
  if (updated.includes('## Pendientes')) {
    updated = updated.replace(/## Pendientes\s*/m, (match) => `${match}\n${additions.join('\n')}\n`);
  } else {
    updated += `\n## Pendientes\n\n${additions.join('\n')}\n`;
  }
  writeFileSync(paths.pipeline, updated);
  return additions.length;
}

function appendHistory(jobs) {
  const history = read(paths.history).toLowerCase();
  for (const job of jobs) {
    if (history.includes(job.url.toLowerCase())) continue;
    appendFileSync(paths.history, `${job.url}\t${today}\t${job.source}\t${job.title}\t${job.company}\tadded\n`);
  }
}

async function main() {
  clearOutputDirectory();
  ensureDirs();
  console.log('Career-Ops automated scan');
  console.log('Finding roles from saved pipeline and configured ATS APIs...\n');

  const existingJobs = parsePipelineJobs(read(paths.pipeline));
  const discovered = await discoverGreenhouseJobs();
  const relevantDiscovered = discovered.filter((job) => isRelevantTitle(job.title));
  const allJobs = dedupe([...existingJobs, ...relevantDiscovered]);

  console.log(`Pipeline roles: ${existingJobs.length}`);
  console.log(`Relevant ATS roles discovered: ${relevantDiscovered.length}`);

  const preliminary = allJobs
    .map((job) => ({ ...job, analysis: scoreJob(job) }))
    .filter((job) => {
      const text = `${job.title} ${job.location || ''}`.toLowerCase();
      const studentFriendly = /\b(intern|internship|trainee|fresher)\b|working student|entry[- ]level|new grad|graduate program|campus/.test(text);
      const blocked = /\b(senior|staff|principal|lead|head|director|manager|architect|account executive|sales|marketing|finance|legal|recruit|talent acquisition)\b/.test(text);
      return studentFriendly && !blocked;
    })
    .sort((a, b) => b.analysis.score - a.analysis.score)
    .slice(0, Math.max(maxOutputs * 3, 12));

  const enriched = [];
  for (const job of preliminary) {
    const description = await fetchText(job.url);
    const analysis = scoreJob({ ...job, description });
    enriched.push({
      ...job,
      description,
      analysis,
      slug: slugify(`${job.company}-${job.title}`),
    });
  }

  const ranked = enriched
    .filter((job) => {
      const text = `${job.title} ${job.description || ''}`.toLowerCase();
      const studentFriendly = /\b(intern|internship|trainee|fresher)\b|working student|entry[- ]level|new grad|graduate program|campus/.test(text);
      const blocked = /\b(senior|staff|principal|lead|head|director|manager|architect|account executive|sales|marketing|finance|legal|recruit|talent acquisition)\b/.test(text);
      return job.analysis.score >= 50 && studentFriendly && !blocked;
    })
    .sort((a, b) => b.analysis.score - a.analysis.score);
  const selected = ranked.slice(0, maxOutputs);

  addToPipeline(relevantDiscovered);
  appendHistory(selected);

  for (const job of selected) {
    const dir = join(paths.tailored, job.slug);
    mkdirSync(dir, { recursive: true });
    const texPath = join(dir, 'resume.tex');
    const htmlPath = join(dir, 'resume.html');
    const pdfPath = join(dir, 'resume.pdf');
    const answersPath = join(dir, 'answers.md');
    const outreachPath = join(dir, 'outreach.md');

    writeFileSync(texPath, makeLatex(job, job.analysis));
    writeFileSync(htmlPath, makeHtml(job, job.analysis));
    writeFileSync(answersPath, makeAnswers(job, job.analysis));
    writeFileSync(outreachPath, makeOutreach(job, job.analysis));

    if (!tryPdflatex(texPath, dir)) {
      await renderPdf(htmlPath, pdfPath);
    }
  }

  const reportPath = join(paths.output, `scan-results-${today}.md`);
  const draftPath = join(paths.output, `application-drafts-${today}.md`);
  const outreachPath = join(paths.output, `application-outreach-${today}.md`);
  writeFileSync(reportPath, makeReport(selected));
  writeFileSync(draftPath, selected.map((job) => makeAnswers(job, job.analysis)).join('\n\n---\n\n'));
  writeFileSync(outreachPath, selected.map((job) => makeOutreach(job, job.analysis)).join('\n\n---\n\n'));

  console.log(`\nBest matches: ${selected.length}`);
  for (const job of selected) {
    console.log(`- ${job.analysis.score}/100 ${job.company} | ${job.title}`);
    console.log(`  output/tailored/${job.slug}/resume.pdf`);
    console.log(`  output/tailored/${job.slug}/outreach.md`);
  }
  console.log(`\nReport: ${reportPath}`);
  console.log(`Draft answers: ${draftPath}`);
  console.log(`Outreach drafts: ${outreachPath}`);
  console.log('\nReview the PDFs, answers, and outreach drafts, then apply/message manually.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
