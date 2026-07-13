import fs from 'fs';
import path from 'path';

const categories = ['Customer Support', 'Technical & Coding', 'Financial & Data Extraction', 'Legal & Document Analysis'];

const dataset = [];

// Helper to generate Q&As
// 1. Customer Support (25 cases)
for (let i = 1; i <= 25; i++) {
  dataset.push({
    id: `CS-${String(i).padStart(3, '0')}`,
    category: 'Customer Support',
    question: `How do I reset my account password for user ID ${1000 + i}?`,
    expected_answer: `To reset your password, click the "Forgot Password" link on the login page. Enter your email address or user ID ${1000 + i}. You will receive a secure password reset link via email, which is valid for 24 hours.`,
    reference_context: `Security protocol: Password reset requests can be initiated from the login page. Users must provide their registration email or user ID. A reset link is generated and sent via SMTP to the verified email. The link expires after 24 hours. Under no circumstances should support agents disclose passwords directly over chat or phone.`,
    tags: ['auth', 'account-management', 'security']
  });
}

// 2. Technical & Coding (25 cases)
const codingTopics = [
  { topic: 'REST API', q: 'How do I implement pagination in a REST API?', a: 'Implement pagination using "limit" and "offset" query parameters or cursor-based keys. Return a "next" URL or "has_more" boolean in the response metadata.', c: 'Best practices for API design recommend chunking large lists. Limit/offset pagination is simple but slow on large datasets. Cursor-based pagination uses a unique identifier to fetch the next page and scales efficiently.' },
  { topic: 'Promises', q: 'What is the difference between Promise.all and Promise.allSettled?', a: 'Promise.all rejects immediately if any promise fails. Promise.allSettled waits for all promises to resolve or reject, returning an array of objects describing each result.', c: 'JavaScript async control flow: Promise.all resolves when all promises resolve, or rejects when the first rejects. Promise.allSettled is ES2020 and always resolves with statuses: "fulfilled" or "rejected".' },
  { topic: 'Docker', q: 'How do I optimize Docker image size for node applications?', a: 'Use multi-stage builds. Copy package.json, run npm install in a build stage, copy only production dependencies and build artifacts to a minimal runner base image like alpine.', c: 'Container optimization: Multi-stage builds separate development tools from production runtimes. Use .dockerignore to exclude node_modules. Use node:alpine or distroless images for runtime.' }
];

for (let i = 1; i <= 25; i++) {
  const topicObj = codingTopics[(i - 1) % codingTopics.length];
  dataset.push({
    id: `TC-${String(i).padStart(3, '0')}`,
    category: 'Technical & Coding',
    question: `${topicObj.q} (Case variation #${i})`,
    expected_answer: topicObj.a,
    reference_context: topicObj.c,
    tags: ['coding', topicObj.topic.toLowerCase(), `variation-${i}`]
  });
}

// 3. Financial & Data Extraction (25 cases)
for (let i = 1; i <= 25; i++) {
  const revenue = 100 + i * 5;
  const growth = 5 + (i % 5);
  dataset.push({
    id: `FI-${String(i).padStart(3, '0')}`,
    category: 'Financial & Data Extraction',
    question: `What was the reported total revenue and year-over-year growth rate for Q2 FY2026 based on the financial report?`,
    expected_answer: `The reported total revenue was $${revenue} million, representing a year-over-year growth rate of ${growth}%.`,
    reference_context: `Financial Disclosure Q2 FY2026: The company recorded gross revenues of $${revenue} million for the quarter ended June 30, 2026. This represents a growth rate of ${growth}% compared to the $${(revenue / (1 + growth/100)).toFixed(1)} million revenue reported in Q2 FY2025. Operating margin stood at 18.4%.`,
    tags: ['finance', 'revenue', 'growth']
  });
}

// 4. Legal & Document Analysis (25 cases)
for (let i = 1; i <= 25; i++) {
  const days = 30 + (i % 3) * 15;
  dataset.push({
    id: `LG-${String(i).padStart(3, '0')}`,
    category: 'Legal & Document Analysis',
    question: `What is the termination notice period required by the service agreement for client reference LG-${100 + i}?`,
    expected_answer: `The termination notice period required is ${days} days written notice prior to the anniversary of the contract.`,
    reference_context: `Service Agreement Term LG-${100 + i}: Either party may terminate this Agreement without cause by providing at least ${days} days prior written notice to the other party. In the event of material breach, termination may occur immediately upon written notification of default if uncured within 10 business days.`,
    tags: ['legal', 'compliance', 'contracts']
  });
}

const dir = path.dirname('src/data/golden_dataset.json');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync('src/data/golden_dataset.json', JSON.stringify(dataset, null, 2));
console.log(`Generated golden dataset with ${dataset.length} items at src/data/golden_dataset.json`);
