# LLM Eval CI/CD Workstation

An automated LLMOps continuous integration (CI) quality gate and interactive developer cockpit to benchmark, grade, and monitor LLM application performance across prompt modifications and RAG parameters.

👉 **Live Demo:** [https://solar-six-tan.vercel.app](https://solar-six-tan.vercel.app)

---

## 💡 Why This Project Matters
Unlike traditional software, LLM responses are non-deterministic. A minor tweak to a prompt template or chunk size can introduce hallucinations, increase latency, or degrade answer relevance. 

This project introduces a **production-ready CI/CD gatekeeper**. If a developer pushes a prompt update that violates quality gates—such as causing hallucinations > 5% or exceeding a 2-second latency SLA—the build fails and git blocks the merge.

---

## 🛠️ Key Features
* **Interactive CI Run Simulator:** Modify prompts, models (including live Google Gemini 1.5 Flash), chunk configurations, and run benchmarks with a real-time scrolling console.
* **Futuristic Cockpit UI:** Built using a custom dark glassmorphism layout, animated circular SVG progress gauges, and line chart trends for latency and correctness.
* **Dual-Run Comparator:** Compare two commits side-by-side to audit prompt differences and metric regressions.
* **TestCase Inspector Drawer:** Click any test case to slide open a detailed side panel showing context documents, model outputs, expected answers, and faithfulness scoring.
* **CLI Gatekeeper Script:** Headless testing runner that returns shell exit codes (`0` or `1`) for git hooks and GitHub Actions.

---

## 📂 Project Structure
* [`/scripts/eval-runner.js`](./scripts/eval-runner.js): Command Line Interface (CLI) Pipeline Runner.
* [`/src/data/golden_dataset.json`](./src/data/golden_dataset.json): Benchmark dataset containing 100+ standard question-answer pairs.
* [`/src/data/runs_history.json`](./src/data/runs_history.json): Ledger database tracking historical commit runs.
* [`/src/App.jsx`](./src/App.jsx): Front-end workstation React dashboard.
* [`/src/index.css`](./src/index.css): Styling system with custom variables.
* [`PROJECT_EXPLANATION.pdf`](./PROJECT_EXPLANATION.pdf): A 6-page vector PDF detailing the complete connection flow and metrics formulas.

---

## 🚀 Getting Started

### 1. Installation
Clone the repository, navigate to the folder, and install dependencies:
```bash
npm install
```

### 2. Run the Web Dashboard
Start the local development server:
```bash
npm run dev
```
Open **[http://localhost:5188/](http://localhost:5188/)** in your web browser.

### 3. Run the CLI Runner
To trigger the headless CI quality check locally:
```bash
npm run eval
```

*To run with live Gemini API calls:*
```bash
npm run eval -- --model=gemini-1.5-flash --subset=10 --apiKey=YOUR_AI_STUDIO_KEY
```

---

## 🔑 Running with Google Gemini API
To run real audits:
1. Go to the **CI Run Simulator** tab.
2. Select **Gemini 1.5 Flash (REAL API - Free Tier)** as the model.
3. Paste a free key from **[Google AI Studio](https://aistudio.google.com/)** (valid keys must start with `AIzaSy`).
4. Select a subset (like 5 or 10 cases) and trigger the run.
