#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, 'sample_resume.pdf');

const text = `Sample Resume (for latency smoke tests)

Anya Candidate • anya.candidate@example.com • (555) 010-1234 • Phoenix, AZ

SUMMARY
Software engineer with 3+ years of experience building web APIs, UI, and data pipelines.

EXPERIENCE
Acme Corp — Software Engineer (2022–2025)
- Built TypeScript services; improved p95 latency by 35% via caching and query tuning.
- Added CI + tests; reduced production incidents by 20%.

PROJECTS
RAG Resume Roaster
- Implemented retrieval-augmented generation; evaluated output structure and safety.

EDUCATION
B.S. Computer Science
`;

async function main() {
  await fs.mkdir(__dirname, { recursive: true });

  const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const done = new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  doc.font('Helvetica').fontSize(12).text(text);
  doc.end();

  await done;
  const pdf = Buffer.concat(chunks);
  await fs.writeFile(outPath, pdf);
  console.log(`Wrote ${outPath} (${pdf.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

