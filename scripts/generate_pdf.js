/**
 * Lina Manufacturing · Central Stock Count System V5.0
 * Automated Enterprise PDF Generator for SDP & System Analysis Report
 * 
 * Converts docs/LINA_STOCK_COUNT_SYSTEM_SDP_REPORT.md into a high-fidelity,
 * publication-grade enterprise PDF document with rendered Mermaid diagrams,
 * professional typography, headers, footers, and page numbering.
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  console.log('--- Generating Lina Manufacturing Enterprise SDP PDF ---');

  const mdPath = path.join(__dirname, '..', 'docs', 'LINA_STOCK_COUNT_SYSTEM_SDP_REPORT.md');
  const pdfPath = path.join(__dirname, '..', 'docs', 'LINA_STOCK_COUNT_SYSTEM_SDP_REPORT.pdf');

  if (!fs.existsSync(mdPath)) {
    console.error('Markdown file not found:', mdPath);
    process.exit(1);
  }

  const mdContent = fs.readFileSync(mdPath, 'utf8');

  // Configure marked renderer
  const renderer = new marked.Renderer();

  // Convert mermaid code blocks into <div class="mermaid">
  const originalCodeRenderer = renderer.code.bind(renderer);
  renderer.code = function (token) {
    const code = typeof token === 'object' ? token.text : arguments[0];
    const lang = typeof token === 'object' ? token.lang : arguments[1];

    if (lang === 'mermaid') {
      return `<div class="mermaid">${code}</div>`;
    }
    return originalCodeRenderer(token);
  };

  marked.setOptions({
    renderer: renderer,
    gfm: true,
    breaks: false
  });

  console.log('Parsing markdown content...');
  const htmlBody = marked.parse(mdContent);

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lina Manufacturing · Central Stock Count Platform V5.0 · SDP Report</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    @page {
      size: A4;
      margin: 18mm 15mm 18mm 15mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* Headings */
    h1 {
      font-size: 18pt;
      font-weight: 700;
      color: #0369a1; /* Enterprise Healthcare Blue */
      border-bottom: 2px solid #0284c7;
      padding-bottom: 6px;
      margin-top: 24pt;
      margin-bottom: 12pt;
      page-break-before: always;
    }

    /* Do not page-break before the first h1 */
    h1:first-of-type {
      page-break-before: avoid !important;
      margin-top: 0 !important;
    }

    h2 {
      font-size: 13.5pt;
      font-weight: 600;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 18pt;
      margin-bottom: 8pt;
      page-break-after: avoid;
    }

    h3 {
      font-size: 11.5pt;
      font-weight: 600;
      color: #334155;
      margin-top: 14pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
    }

    h4 {
      font-size: 10.5pt;
      font-weight: 600;
      color: #475569;
      margin-top: 10pt;
      margin-bottom: 4pt;
      page-break-after: avoid;
    }

    p {
      margin: 0 0 8pt 0;
      text-align: justify;
    }

    /* Lists */
    ul, ol {
      margin: 0 0 10pt 0;
      padding-left: 20pt;
    }

    li {
      margin-bottom: 3pt;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10pt 0 14pt 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }

    th {
      background-color: #0f172a !important;
      color: #ffffff !important;
      font-weight: 600;
      text-align: left;
      padding: 6pt 8pt;
      border: 1px solid #334155;
    }

    td {
      padding: 5pt 7pt;
      border: 1px solid #cbd5e1;
      vertical-align: top;
    }

    tr:nth-child(even) {
      background-color: #f8fafc !important;
    }

    /* Code Blocks & Pre */
    pre {
      background-color: #f8fafc !important;
      border: 1px solid #cbd5e1;
      border-left: 3px solid #0284c7;
      border-radius: 4px;
      padding: 8pt 10pt;
      font-family: 'Cascadia Code', 'Consolas', 'Courier New', monospace;
      font-size: 8pt;
      line-height: 1.4;
      color: #0f172a;
      overflow-x: auto;
      margin: 8pt 0 12pt 0;
      page-break-inside: avoid;
      white-space: pre-wrap;
      word-break: break-all;
    }

    code {
      font-family: 'Cascadia Code', 'Consolas', monospace;
      font-size: 8.5pt;
      background-color: #f1f5f9;
      color: #0369a1;
      padding: 1pt 3pt;
      border-radius: 3px;
    }

    pre code {
      background-color: transparent !important;
      color: inherit;
      padding: 0;
      font-size: 8pt;
    }

    /* Blockquotes */
    blockquote {
      margin: 8pt 0 12pt 0;
      padding: 6pt 12pt;
      border-left: 4px solid #0284c7;
      background-color: #f0f9ff !important;
      color: #0369a1;
      font-style: italic;
      page-break-inside: avoid;
    }

    /* Mermaid Diagrams */
    .mermaid {
      margin: 12pt 0 16pt 0;
      text-align: center;
      page-break-inside: avoid;
      background-color: #ffffff;
      padding: 8pt;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }

    .mermaid svg {
      max-width: 100% !important;
      height: auto !important;
    }

    /* Horizontal Rules */
    hr {
      border: 0;
      height: 1px;
      background: #cbd5e1;
      margin: 16pt 0;
    }

    /* Cover / Header Box */
    .cover-box {
      border: 2px solid #0284c7;
      background-color: #f8fafc;
      padding: 16pt;
      border-radius: 6px;
      margin-bottom: 20pt;
    }
  </style>
</head>
<body>
  ${htmlBody}
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: 'Segoe UI, sans-serif'
    });
  </script>
</body>
</html>`;

  // Determine browser executable
  let executablePath = '';
  if (fs.existsSync(CHROME_PATH)) {
    executablePath = CHROME_PATH;
  } else if (fs.existsSync(EDGE_PATH)) {
    executablePath = EDGE_PATH;
  } else {
    throw new Error('Neither Google Chrome nor Microsoft Edge was found on system.');
  }

  console.log(`Launching headless browser from: ${executablePath}`);
  const browser = await puppeteer.launch({
    executablePath: executablePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600 });

  console.log('Setting HTML content and rendering Mermaid SVG diagrams...');
  await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 60000 });

  // Wait an extra 2 seconds for Mermaid rendering to complete
  await new Promise(r => setTimeout(r, 2500));

  console.log('Generating A4 PDF with enterprise header & footer...');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-size: 7.5pt; font-family: Segoe UI, sans-serif; width: 100%; display: flex; justify-content: space-between; color: #64748b; padding: 0 15mm; border-bottom: 1px solid #e2e8f0; margin-bottom: 5mm;">
        <span><strong>LINA MANUFACTURING (PVT) LTD</strong> · Kadawatha Complex</span>
        <span>SUNSHINE HEALTHCARE LANKA / SUNSHINE HOLDINGS</span>
      </div>
    `,
    footerTemplate: `
      <div style="font-size: 7.5pt; font-family: Segoe UI, sans-serif; width: 100%; display: flex; justify-content: space-between; color: #64748b; padding: 0 15mm; border-top: 1px solid #e2e8f0; margin-top: 5mm;">
        <span>CONFIDENTIAL · Central Stock Count Platform V5.0 SDP Specification</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `,
    margin: {
      top: '18mm',
      bottom: '18mm',
      left: '15mm',
      right: '15mm'
    }
  });

  await browser.close();

  const stats = fs.statSync(pdfPath);
  console.log(`\n======================================================`);
  console.log(`✓ PDF GENERATION SUCCESSFUL`);
  console.log(`  Output Path: ${pdfPath}`);
  console.log(`  File Size  : ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size.toLocaleString()} bytes)`);
  console.log(`======================================================\n`);
}

main().catch(err => {
  console.error('PDF Generation Failed:', err);
  process.exit(1);
});
