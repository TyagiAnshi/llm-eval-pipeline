import fs from 'fs';
import PDFDocument from 'pdfkit';

// Create a new PDF document with standard margins
const doc = new PDFDocument({
  margin: 50,
  size: 'A4',
  bufferPages: true // Enables page numbering calculations at the end
});

// Stream the PDF to a file
const stream = fs.createWriteStream('PROJECT_EXPLANATION.pdf');
doc.pipe(stream);

// Styling constants
const titleFont = 'Helvetica-Bold';
const headingFont = 'Helvetica-Bold';
const bodyFont = 'Helvetica';
const monoFont = 'Courier';

// Helper: Draw Flowchart Box
function drawBox(doc, x, y, width, height, text, strokeColor, fillColor, textColor = '#1E293B') {
  doc.roundedRect(x, y, width, height, 6)
     .fillAndStroke(fillColor, strokeColor);
  doc.fillColor(textColor)
     .font('Helvetica-Bold')
     .fontSize(8.5)
     .text(text, x, y + (height / 2) - 5, { width: width, align: 'center' });
}

// Helper: Draw Diamond Decision
function drawDiamond(doc, x, y, size, text, strokeColor, fillColor) {
  doc.moveTo(x, y + size/2)
     .lineTo(x + size/2, y)
     .lineTo(x + size, y + size/2)
     .lineTo(x + size/2, y + size)
     .closePath()
     .fillAndStroke(fillColor, strokeColor);

  doc.fillColor('#1E293B')
     .font('Helvetica-Bold')
     .fontSize(8)
     .text(text, x + 5, y + size/2 - 10, { width: size - 10, align: 'center' });
}

// Helper: Draw Arrow
function drawArrow(doc, x1, y1, x2, y2, text = '') {
  doc.strokeColor('#94A3B8')
     .lineWidth(1.2)
     .moveTo(x1, y1)
     .lineTo(x2, y2)
     .stroke();

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = 5;
  doc.moveTo(x2, y2)
     .lineTo(x2 - headLength * Math.cos(angle - Math.PI/6), y2 - headLength * Math.sin(angle - Math.PI/6))
     .lineTo(x2 - headLength * Math.cos(angle + Math.PI/6), y2 - headLength * Math.sin(angle + Math.PI/6))
     .closePath()
     .fill('#94A3B8');

  if (text) {
    doc.fillColor('#64748B')
       .font('Helvetica')
       .fontSize(8)
       .text(text, (x1 + x2)/2 - 30, (y1 + y2)/2 - 10, { width: 60, align: 'center' });
  }
}

// ==========================================
// PAGE 1: TITLE & EXECUTIVE SUMMARY
// ==========================================
doc.fillColor('#6366F1')
   .font(titleFont)
   .fontSize(24)
   .text('LLM Eval CI/CD Workstation', { align: 'center' })
   .moveDown(0.2);

doc.fillColor('#94A3B8')
   .font(headingFont)
   .fontSize(11)
   .text('THE COMPREHENSIVE LLMOPS QUALITY GATEWAY DESIGN SPECIFICATION', { align: 'center' })
   .moveDown(1.5);

doc.strokeColor('#E2E8F0')
   .lineWidth(1)
   .moveTo(50, doc.y)
   .lineTo(545, doc.y)
   .stroke()
   .moveDown(1.5);

doc.fillColor('#1E293B')
   .font(headingFont)
   .fontSize(14)
   .text('1. Project Importance & Executive Summary')
   .moveDown(0.8);

doc.fillColor('#334155')
   .font(bodyFont)
   .fontSize(10)
   .text('In software engineering, reliability is maintained via automated unit tests (e.g. Jest, PyTest) that verify if code changes break existing functionality. In artificial intelligence and LLM application development, this safety net has historically been missing. Large Language Models are non-deterministic: modifying a prompt template, upgrading a base model, or altering chunking variables in a RAG database can introduce unexpected bugs, incorrect assumptions, or hallucinations. This is a massive blocker for enterprise production adoption.', { align: 'justify', lineGap: 3.5 })
   .moveDown(0.8)
   .text('This project solves the LLM reliability crisis by introducing an automated LLMOps Evaluation CI/CD Pipeline. It serves as an automated gatekeeper. When developers modify prompts or swap engines (such as using Google Gemini 1.5 Flash), the system automatically compiles and tests their configuration against a benchmark golden dataset of 100+ items. It measures faithfulness, hallucination rates, cost, and latency, blocking merges immediately if any Quality Gate SLA is breached.', { align: 'justify', lineGap: 3.5 })
   .moveDown(0.8)
   .text('By combining backend command-line gatekeepers with a premium interactive workstation dashboard, this system provides developers with real-time insight into prompt performance trends, visual regression comparators, and node-level details inspectors.', { align: 'justify', lineGap: 3.5 });


// ==========================================
// PAGE 2: HIGH-LEVEL ARCHITECTURE FLOWCHART
// ==========================================
doc.addPage();

doc.fillColor('#1E293B')
   .font(headingFont)
   .fontSize(14)
   .text('2. System Connection & Architecture Map')
   .moveDown(1.2);

const diagramY = 120;

// Draw flow nodes
drawBox(doc, 220, diagramY, 150, 30, '1. Git Commit / Prompt Edit', '#6366F1', '#EEF2F6');
drawArrow(doc, 295, diagramY + 30, 295, diagramY + 70);

drawBox(doc, 210, diagramY + 70, 170, 35, '2. CLI Runner (eval-runner.js)', '#3B82F6', '#EFF6FF');
drawArrow(doc, 380, diagramY + 87, 420, diagramY + 87);
drawBox(doc, 420, diagramY + 72, 110, 30, 'golden_dataset.json', '#06B6D4', '#ECFEFF');

drawArrow(doc, 295, diagramY + 105, 295, diagramY + 145);
drawBox(doc, 210, diagramY + 145, 170, 35, '3. Model Engine (Gemini API)', '#10B981', '#ECFDF5');

drawArrow(doc, 295, diagramY + 180, 295, diagramY + 220);
drawDiamond(doc, 245, diagramY + 220, 100, 'All SLAs\nPassed?', '#F59E0B', '#FEF3C7');

drawArrow(doc, 245, diagramY + 270, 140, diagramY + 270, 'No');
drawBox(doc, 30, diagramY + 252, 110, 35, 'Block Merge (Exit 1)', '#EF4444', '#FEF2F2', '#EF4444');

drawArrow(doc, 345, diagramY + 270, 450, diagramY + 270, 'Yes');
drawBox(doc, 450, diagramY + 252, 110, 35, 'Allow Merge (Exit 0)', '#10B981', '#F0FDF4', '#10B981');

drawArrow(doc, 295, diagramY + 320, 295, diagramY + 360);
drawBox(doc, 200, diagramY + 360, 190, 30, '4. Runs Database (runs_history.json)', '#6366F1', '#F5F3FF');

drawArrow(doc, 295, diagramY + 390, 295, diagramY + 430);
drawBox(doc, 210, diagramY + 430, 170, 35, '5. Frontend Workstation Dashboard', '#6366F1', '#EEF2F6');


// ==========================================
// PAGE 3: FOLDER MAP & COMPONENT DESCRIPTIONS
// ==========================================
doc.addPage();

doc.fillColor('#1E293B')
   .font(headingFont)
   .fontSize(14)
   .text('3. Detailed Component & Tool Breakdown')
   .moveDown(0.8);

const components = [
  {
    path: 'scripts/eval-runner.js (Automated Gatekeeper)',
    desc: 'A Node.js CLI script designed to run inside automated environments (such as Git Hooks or GitHub Actions). It parses command-line flags, pulls prompt templates, retrieves benchmark context chunks, triggers LLM evaluation queries, evaluates faithfulness metrics, appends results to the history database, and exits with non-zero error codes on quality gate failures.'
  },
  {
    path: 'src/data/golden_dataset.json (Golden Benchmark)',
    desc: 'A dataset of 100+ standard question-answer pairs spanning four core categories: Customer Support, Technical Coding, Financial Extraction, and Legal Compliance. Each case contains expectations and context bounds to test prompt limits.'
  },
  {
    path: 'src/data/runs_history.json (Run Log Database)',
    desc: 'Acts as the history ledger. It stores logs of every commit, including the author, prompt template, chunk setup, overall metrics, and a case-by-case evaluation audit trail. This serves as the data layer for the frontend dashboard.'
  },
  {
    path: 'src/App.jsx & index.css (Cockpit Frontend)',
    desc: 'A premium, high-fidelity developer cockpit built using Vite, React, Recharts, and custom CSS variables. It replaces standard text headers with radial progress meters, slide-out node inspector drawers, a commit diff comparator, and a real-time console terminal to test prompt updates with live Gemini API calls.'
  }
];

components.forEach(item => {
  doc.fillColor('#1E293B')
     .font(headingFont)
     .fontSize(11)
     .text(item.path)
     .fillColor('#475569')
     .font(bodyFont)
     .fontSize(9.5)
     .text(item.desc, { indent: 15, lineGap: 3 })
     .moveDown(0.8);
});


// ==========================================
// PAGE 4: DETAILED SCORING & METRICS FRAMEWORK
// ==========================================
doc.addPage();

doc.fillColor('#1E293B')
   .font(headingFont)
   .fontSize(14)
   .text('4. Quality Gates & SLA Metrics scoring')
   .moveDown(0.8);

doc.fillColor('#334155')
   .font(bodyFont)
   .fontSize(10)
   .text('To prevent bad prompts from going to production, the gatekeeper enforces three main Service Level Agreements (SLAs). If any run breaches these thresholds, the pipeline fails:', { lineGap: 3.5 })
   .moveDown(1);

const metricsList = [
  {
    name: 'Hallucination Rate (SLA: <= 5%)',
    desc: 'Calculates the proportion of assertions made by the LLM that cannot be justified by the reference context. The system scans the generated answer, extracts claims, and verifies if the key entities and facts are grounded inside the context. If the hallucination rate exceeds 5%, the build is flagged as unstable.'
  },
  {
    name: 'Faithfulness (SLA: > 90%)',
    desc: 'Grades the degree of reliance of the response on the context. If the model answers the question using external pre-trained knowledge rather than using the provided documentation, the faithfulness score drops. High-quality systems require the model to rely strictly on retrieved chunks.'
  },
  {
    name: 'p95 Response Latency (SLA: <= 2000ms)',
    desc: 'Ensures the 95th percentile response time is under 2 seconds. A prompt that is too long or retrieves too many docs (high top-K) slows down response times. Measuring p95 protects production from latency spikes.'
  },
  {
    name: 'Answer Relevancy (SLA: Informational)',
    desc: 'Analyzes keyword overlap and semantic matching between the generated answer and expected ground truth. This ensures prompt adjustments did not alter the intended answer formatting or style.'
  },
  {
    name: 'Eval Cost (SLA: Informational)',
    desc: 'Calculates the API cost based on input/output token counts and model token pricing structures, preventing sudden cost regressions.'
  }
];

metricsList.forEach(m => {
  doc.fillColor('#1E293B')
     .font(headingFont)
     .fontSize(11)
     .text(m.name)
     .fillColor('#475569')
     .font(bodyFont)
     .fontSize(9.5)
     .text(m.desc, { indent: 15, lineGap: 3 })
     .moveDown(0.8);
});


// ==========================================
// PAGE 5: DEVELOPER USER GUIDE (HOW TO USE)
// ==========================================
doc.addPage();

doc.fillColor('#1E293B')
   .font(headingFont)
   .fontSize(14)
   .text('5. User Guide: How to Use & Run')
   .moveDown(0.8);

doc.fillColor('#334155')
   .font(bodyFont)
   .fontSize(10)
   .text('This workstation is designed for both local prompt development and automated pipeline testing.', { lineGap: 3.5 })
   .moveDown(1);

const userGuideSteps = [
  {
    title: '1. Setting Up Google Gemini API Key',
    desc: 'To perform real LLM audits, navigate to the "CI Run Simulator" tab, choose the "Gemini 1.5 Flash (REAL API - Free Tier)" model, and enter your free API Key from Google AI Studio. Note that the key starts with "AIzaSy" and is stored securely only in your browser\'s local storage.'
  },
  {
    title: '2. Running Interactive Prompt Tests',
    desc: 'Under the simulator tab, you can customize prompt templates (using {{context}} and {{question}} placeholders) and RAG chunk configurations. Adjust the "Evaluation Subset" to 10 cases to prevent API rate limits, and click "Commit Change & Run Pipeline". The retro terminal console will output a live log, showing test results step-by-step.'
  },
  {
    title: '3. Auditing Regressions & Differences',
    desc: 'Navigate to the "Dual-Run Comparator" tab and select two different commits. The dashboard will display a side-by-side comparison of the prompts and config settings alongside difference metrics, showing you exactly where the system degraded.'
  }
];

userGuideSteps.forEach(step => {
  doc.fillColor('#1E293B')
     .font(headingFont)
     .fontSize(11.5)
     .text(step.title)
     .fillColor('#475569')
     .font(bodyFont)
     .fontSize(9.5)
     .text(step.desc, { indent: 15, lineGap: 3 })
     .moveDown(0.8);
});


// ==========================================
// PAGE 6: CHRONOLOGICAL DEVELOPMENT LOG (STEPS TAKEN)
// ==========================================
doc.addPage();

doc.fillColor('#1E293B')
   .font(headingFont)
   .fontSize(14)
   .text('6. Chronological Development Log: Steps Taken')
   .moveDown(0.8);

doc.fillColor('#334155')
   .font(bodyFont)
   .fontSize(10)
   .text('This details the exact step-by-step implementation sequence followed to build this workstation from scratch:', { lineGap: 3.5 })
   .moveDown(1.2);

const developmentSteps = [
  {
    step: 'Step 1: Diagnostics & Directory Initialization',
    tool: 'Terminal, Node v26.4.0, npm v11.17.0',
    desc: 'Inspected environment permissions and package support. Initialized the Vite-React project structure in the workspace.'
  },
  {
    step: 'Step 2: Golden Dataset Generation',
    tool: 'scripts/generate-dataset.js, Node FS modules',
    desc: 'Wrote a script to programmatically compile exactly 100 benchmark Q&A pairs covering Customer Support, Technical Coding, Finance, and Legal categories with expected answers and contexts.'
  },
  {
    step: 'Step 3: Seeding Runs History Database',
    tool: 'scripts/generate-history.js',
    desc: 'Generated a JSON database with 5 baseline historical runs. Seeding random variations in latency and hallucination rates created realistic regression data for charts.'
  },
  {
    step: 'Step 4: Writing the CLI Pipeline Runner',
    tool: 'scripts/eval-runner.js, process.argv modules',
    desc: 'Programmed the pipeline executor. Implemented terminal logs, SLA validation algorithms, and process exit codes (0/1) to block merge operations.'
  },
  {
    step: 'Step 5: Styling System & Component Coding',
    tool: 'src/index.css, src/App.jsx, Recharts, Lucide React',
    desc: 'Built the premium glassmorphism dark-theme sidebar navigation. Coded circular progress rings, searchable lists, and an inspect drawer.'
  },
  {
    step: 'Step 6: Gemini API Integration & Build',
    tool: 'Vite Compiler, Google Gemini REST API Endpoint',
    desc: 'Configured App.jsx to securely capture the Gemini API key and perform live fetch requests. Run "npm run build" to check compilation.'
  },
  {
    step: 'Step 7: Cloud Deployment to Vercel',
    tool: 'npx vercel, Vercel Device Auth Flow',
    desc: 'Logged into Vercel Hobby tier using remote browser device authorization and published the workstation live to solar-six-tan.vercel.app.'
  }
];

developmentSteps.forEach(ds => {
  doc.fillColor('#1E293B')
     .font(headingFont)
     .fontSize(11)
     .text(ds.step, { continued: true })
     .fillColor('#6366F1')
     .fontSize(9)
     .text(` [Tool: ${ds.tool}]`)
     .fillColor('#475569')
     .font(bodyFont)
     .fontSize(9)
     .text(ds.desc, { indent: 15, lineGap: 2.5 })
     .moveDown(0.7);
});

// Add Page Numbers on All Pages
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(i);
  doc.fillColor('#94A3B8')
     .font(bodyFont)
     .fontSize(8.5)
     .text(`Page ${i + 1} of ${range.count}`, 50, 780, { align: 'center' });
}

// Finalize PDF file
doc.end();

stream.on('finish', () => {
  console.log('✅ Generated PROJECT_EXPLANATION.pdf successfully with 6 pages of zero-overlap layouts!');
});
