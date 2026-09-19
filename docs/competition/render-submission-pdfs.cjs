#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '../..');
const requireFromFrontend = createRequire(path.join(root, 'frontend/package.json'));
const { marked } = requireFromFrontend('marked');
const { chromium } = requireFromFrontend('@playwright/test');

const documents = [
  '01-software-functional-requirements-analysis.md',
  '02-software-functional-design.md',
  '03-software-product-manual.md',
  '04-software-functional-test-report.md',
  '05-software-performance-core-metrics-test-report.md',
];

const css = String.raw`
  @page { size: A4; margin: 20mm 17mm 20mm 17mm; }
  * { box-sizing: border-box; }
  html { font-size: 10.5pt; }
  body {
    margin: 0;
    color: #1f2933;
    font-family: "Songti SC", "Hiragino Sans GB", "PingFang SC", serif;
    line-height: 1.72;
    letter-spacing: 0;
  }
  .cover {
    height: 247mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    page-break-after: always;
  }
  .cover-mark {
    width: 18mm;
    height: 3mm;
    margin-bottom: 16mm;
    background: #176b87;
  }
  .cover h1 {
    margin: 0;
    color: #113946;
    font-family: "Hiragino Sans GB", "PingFang SC", sans-serif;
    font-size: 28pt;
    font-weight: 700;
    line-height: 1.32;
  }
  .cover .product {
    margin-top: 7mm;
    color: #52616b;
    font-size: 14pt;
  }
  .cover .meta {
    width: 132mm;
    margin-top: 24mm;
    padding-top: 7mm;
    border-top: 0.6pt solid #9eb7c0;
    color: #42535b;
    font-size: 10.5pt;
    line-height: 1.9;
  }
  main { width: 100%; }
  h1, h2, h3, h4 {
    color: #113946;
    font-family: "Hiragino Sans GB", "PingFang SC", sans-serif;
    page-break-after: avoid;
  }
  h1 { font-size: 21pt; margin: 0 0 8mm; }
  h2 {
    margin: 9mm 0 3mm;
    padding-bottom: 1.5mm;
    border-bottom: 0.7pt solid #9eb7c0;
    font-size: 15.5pt;
  }
  h3 { margin: 6mm 0 2mm; font-size: 12.5pt; }
  h4 { margin: 4mm 0 1.5mm; font-size: 11pt; }
  p { margin: 0 0 3.2mm; text-align: justify; }
  ul, ol { margin: 1.5mm 0 3.5mm 7mm; padding-left: 5mm; }
  li { margin: 0.8mm 0; }
  strong { color: #153d4a; }
  a { color: #176b87; text-decoration: none; word-break: break-all; }
  code {
    font-family: "SFMono-Regular", Menlo, Consolas, monospace;
    font-size: 8.6pt;
    background: #eef3f5;
    border-radius: 2px;
    padding: 0.2mm 1mm;
    overflow-wrap: anywhere;
  }
  pre {
    margin: 3mm 0 4mm;
    padding: 3.5mm;
    border-left: 2.5pt solid #176b87;
    background: #f3f7f8;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
    page-break-inside: avoid;
  }
  pre code { padding: 0; background: transparent; font-size: 8.2pt; }
  table {
    width: 100%;
    margin: 3mm 0 5mm;
    border-collapse: collapse;
    table-layout: auto;
    font-size: 8.2pt;
    line-height: 1.45;
  }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th, td {
    padding: 1.8mm 2mm;
    border: 0.55pt solid #aab8bd;
    vertical-align: top;
    overflow-wrap: anywhere;
  }
  th {
    color: #113946;
    background: #dcecef;
    font-family: "Hiragino Sans GB", "PingFang SC", sans-serif;
    font-weight: 700;
  }
  tbody tr:nth-child(even) { background: #f7f9fa; }
  blockquote {
    margin: 4mm 0;
    padding: 2mm 4mm;
    border-left: 2.5pt solid #d08c38;
    color: #4a5357;
    background: #fbf7f0;
  }
  hr { margin: 7mm 0; border: 0; border-top: 0.6pt solid #9eb7c0; }
`;

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function splitFrontMatter(markdown) {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const title = (lines.shift() || '').replace(/^#\s+/, '').trim();
  const meta = [];
  const bodyPrefix = [];
  while (lines.length && !/^##\s+/.test(lines[0])) {
    const value = lines.shift().trim().replace(/\s{2}$/, '');
    if (value.startsWith('>')) bodyPrefix.push(value);
    else if (value) meta.push(value);
  }
  return { title, meta, body: [...bodyPrefix, '', ...lines].join('\n') };
}

async function render(browser, fileName) {
  const sourcePath = path.join(__dirname, fileName);
  const markdown = await fs.readFile(sourcePath, 'utf8');
  const { title, meta, body } = splitFrontMatter(markdown);
  const bodyHtml = marked.parse(body, { gfm: true, breaks: false });
  const html = `<!doctype html>
    <html lang="zh-CN">
      <head><meta charset="utf-8"><style>${css}</style></head>
      <body>
        <section class="cover">
          <div class="cover-mark"></div>
          <h1>${escapeHtml(title)}</h1>
          <div class="product">Scry 安全智能运维平台</div>
          <div class="meta">${meta.map(escapeHtml).join('<br>')}</div>
        </section>
        <main>${bodyHtml}</main>
      </body>
    </html>`;

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);

  const baseName = fileName.replace(/\.md$/, '.pdf');
  const outputDir = path.join(root, 'output/pdf');
  const docsPdfDir = path.join(__dirname, 'pdf');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(docsPdfDir, { recursive: true });
  const outputPath = path.join(outputDir, baseName);

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    margin: { top: '20mm', right: '17mm', bottom: '20mm', left: '17mm' },
    headerTemplate: `<div style="width:100%;padding:0 17mm;color:#6b7b83;font:8px 'PingFang SC',sans-serif;text-align:right;">${escapeHtml(title)}</div>`,
    footerTemplate: '<div style="width:100%;padding:0 17mm;color:#6b7b83;font:8px sans-serif;text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  await fs.copyFile(outputPath, path.join(docsPdfDir, baseName));
  await page.close();
  return outputPath;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const fileName of documents) {
      const outputPath = await render(browser, fileName);
      process.stdout.write(`Rendered ${path.relative(root, outputPath)}\n`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
