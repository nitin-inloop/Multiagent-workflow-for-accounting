import type { DemoInvoice } from './demoInvoices.js';
import { formatInr } from '../utils/money.js';

/**
 * Renders a demo invoice as an SVG so the review screen has a real document to
 * show beside the extracted fields. Deliberately dependency-free: no headless
 * browser or image library is needed to produce the preview.
 */
export function renderDemoInvoiceSvg(demo: DemoInvoice): Buffer {
  const f = demo.fields;
  const faded = demo.confidence < 0.65;
  const ink = faded ? '#7b7468' : '#1c1917';
  const muted = faded ? '#a29b8f' : '#57534e';

  const rows = f.lineItems
    .map((item, index) => {
      const y = 420 + index * 34;
      return `
    <text x="60" y="${y}" class="cell">${escapeXml(truncate(item.name, 34))}</text>
    <text x="392" y="${y}" class="cell mono">${item.hsn ?? '-'}</text>
    <text x="486" y="${y}" class="cell mono right">${item.quantity ?? '-'}</text>
    <text x="586" y="${y}" class="cell mono right">${item.rate === null ? '-' : formatPlain(item.rate)}</text>
    <text x="700" y="${y}" class="cell mono right">${item.amount === null ? '-' : formatPlain(item.amount)}</text>`;
    })
    .join('');

  const totalsTop = 420 + Math.max(f.lineItems.length, 1) * 34 + 26;
  const totalLines: Array<[string, string]> = [
    ['Taxable value', f.subTotal === null ? 'not readable' : formatInr(f.subTotal)],
  ];
  if (f.tax.igst !== null) totalLines.push(['IGST 18%', formatInr(f.tax.igst)]);
  if (f.tax.cgst !== null) totalLines.push(['CGST 9%', formatInr(f.tax.cgst)]);
  if (f.tax.sgst !== null) totalLines.push(['SGST 9%', formatInr(f.tax.sgst)]);

  const totals = totalLines
    .map(([label, value], index) => {
      const y = totalsTop + index * 28;
      return `
    <text x="470" y="${y}" class="cell muted">${escapeXml(label)}</text>
    <text x="700" y="${y}" class="cell mono right">${escapeXml(value)}</text>`;
    })
    .join('');

  const grandY = totalsTop + totalLines.length * 28 + 16;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="760" height="${grandY + 150}" viewBox="0 0 760 ${grandY + 150}" role="img" aria-label="Demo invoice from ${escapeXml(f.vendorName ?? 'supplier')}">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fffdf8"/>
      <stop offset="100%" stop-color="${faded ? '#f2ede1' : '#faf7f0'}"/>
    </linearGradient>
  </defs>
  <style>
    text { font-family: "Helvetica Neue", Arial, sans-serif; fill: ${ink}; }
    .brand { font-size: 25px; font-weight: 700; letter-spacing: -0.3px; }
    .meta { font-size: 12.5px; fill: ${muted}; }
    .tag { font-size: 11px; letter-spacing: 1.6px; fill: ${muted}; }
    .head { font-size: 11px; letter-spacing: 1.2px; fill: ${muted}; }
    .cell { font-size: 13px; }
    .muted { fill: ${muted}; }
    .mono { font-family: "SFMono-Regular", Consolas, monospace; font-size: 12.5px; }
    .right { text-anchor: end; }
    .grand { font-size: 17px; font-weight: 700; }
  </style>
  <rect width="760" height="${grandY + 150}" fill="url(#paper)"/>
  <rect x="24" y="24" width="712" height="${grandY + 102}" fill="none" stroke="#e0d9c9" stroke-width="1.5"/>

  <text x="60" y="86" class="brand">${escapeXml(f.vendorName ?? 'Supplier name not printed')}</text>
  <text x="60" y="110" class="meta">${escapeXml(f.placeOfSupply ?? '')}</text>
  <text x="60" y="130" class="meta">GSTIN: ${escapeXml(f.gstin ?? '________________')}</text>
  <text x="700" y="86" class="tag right">TAX INVOICE</text>
  <text x="700" y="112" class="meta right">Invoice No: ${escapeXml(f.invoiceNumber ?? '-')}</text>
  <text x="700" y="132" class="meta right">Date: ${escapeXml(formatDate(f.invoiceDate))}</text>

  <line x1="60" y1="160" x2="700" y2="160" stroke="#e0d9c9" stroke-width="1"/>
  <text x="60" y="196" class="head">BILLED TO</text>
  <text x="60" y="220" class="cell">Nagar Enterprises</text>
  <text x="60" y="240" class="meta">MP Nagar Zone II, Bhopal, Madhya Pradesh 462011</text>
  <text x="60" y="260" class="meta">GSTIN: 23AAACN1234A1ZL</text>

  <rect x="48" y="368" width="664" height="30" fill="${faded ? '#efe8d9' : '#f4efe2'}"/>
  <text x="60" y="388" class="head">DESCRIPTION</text>
  <text x="392" y="388" class="head">HSN</text>
  <text x="486" y="388" class="head right">QTY</text>
  <text x="586" y="388" class="head right">RATE</text>
  <text x="700" y="388" class="head right">AMOUNT</text>
  ${rows}

  <line x1="470" y1="${totalsTop - 22}" x2="700" y2="${totalsTop - 22}" stroke="#e0d9c9"/>
  ${totals}
  <line x1="470" y1="${grandY - 20}" x2="700" y2="${grandY - 20}" stroke="#1c1917" stroke-width="1.2"/>
  <text x="470" y="${grandY + 4}" class="grand">Grand total</text>
  <text x="700" y="${grandY + 4}" class="grand right">${escapeXml(f.total === null ? 'not readable' : formatInr(f.total))}</text>

  ${
    f.hasSignature
      ? `<text x="60" y="${grandY + 62}" class="meta">For ${escapeXml(f.vendorName ?? 'the supplier')}</text>
  <path d="M60 ${grandY + 92} c 22 -18 34 12 54 -4 s 30 -20 52 2 s 26 -14 44 -2" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>
  <text x="60" y="${grandY + 118}" class="tag">AUTHORISED SIGNATORY</text>`
      : `<text x="60" y="${grandY + 62}" class="meta">For ${escapeXml(f.vendorName ?? 'the supplier')}</text>
  <text x="60" y="${grandY + 96}" class="tag">SIGNATURE AREA BLANK</text>`
  }
</svg>
`);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function formatPlain(value: number): string {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return 'illegible';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
