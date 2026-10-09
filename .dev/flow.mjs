// Drives the demo path in a real browser: open the mismatch, correct the
// total, approve, download the Tally XML. Fails loudly if any step stalls.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '.dev/shots';
mkdirSync(OUT, { recursive: true });

const api = 'http://localhost:8080';
const web = 'http://localhost:3000';

const list = await fetch(`${api}/api/documents`).then((r) => r.json());
const target = list.documents.find((d) => d.exceptions.some((e) => e.code === 'TOTAL_MISMATCH'));
if (!target) throw new Error('no TOTAL_MISMATCH document to drive');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
const downloads = [];
page.on('download', (d) => downloads.push(d.suggestedFilename()));

const step = async (label, fn) => {
  await fn();
  console.log(`ok   ${label}`);
};

await step('open the review page', async () => {
  await page.goto(`${web}/documents/${target.documentId}`, { waitUntil: 'networkidle' });
  await page.getByText('Total mismatch', { exact: false }).first().waitFor({ timeout: 10000 });
});

await step('approve is blocked while the total is wrong', async () => {
  const approve = page.getByRole('button', { name: /approve the entry/i });
  if (!(await approve.isDisabled())) throw new Error('approve was enabled with a blocking exception');
});

await step('correct the invoice total to 47,200', async () => {
  const input = page.getByLabel('Invoice total', { exact: true });
  await input.click();
  await input.fill('47200');
  await input.blur();
  if ((await input.inputValue()) !== '47,200.00') {
    throw new Error(`total field did not format: ${await input.inputValue()}`);
  }
  await page.getByRole('button', { name: /save and re-check/i }).click();
  await page.getByText('Corrections saved and re-checked.').waitFor({ timeout: 10000 });
});

await step('every check now passes', async () => {
  await page.getByText('Every check passed', { exact: false }).waitFor({ timeout: 10000 });
});

await step('approve the entry', async () => {
  await page.getByRole('button', { name: /approve the entry/i }).click();
  await page.getByText('Approved. The entry is ready to export.').waitFor({ timeout: 10000 });
});

await page.screenshot({ path: `${OUT}/flow-approved.png`, fullPage: true });

await step('download the Tally XML', async () => {
  const wait = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: /download tally xml/i }).click();
  await wait;
});

await step('download the CSV', async () => {
  const wait = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: /download csv/i }).click();
  await wait;
});

await page.screenshot({ path: `${OUT}/flow-exported.png`, fullPage: true });

await step('the inbox shows it as exported', async () => {
  await page.goto(web, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /exported/i }).click();
  await page.getByText('Mandideep Polymers', { exact: false }).first().waitFor({ timeout: 10000 });
});

await page.screenshot({ path: `${OUT}/flow-inbox-exported.png`, fullPage: true });

const after = await fetch(`${api}/api/documents/${target.documentId}`).then((r) => r.json());
console.log(`\ndownloads: ${downloads.join(', ')}`);
console.log(`final status: ${after.document.status}`);
console.log(`audit actions: ${after.document.audit.map((a) => a.action).join(' -> ')}`);

await browser.close();
