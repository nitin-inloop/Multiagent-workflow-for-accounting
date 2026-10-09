// Throwaway screenshot driver: launches the real app in Chromium and captures
// the inbox and one review page so the design can be looked at.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '.dev/shots';
mkdirSync(OUT, { recursive: true });

const api = 'http://localhost:8080';
const web = 'http://localhost:3000';

const list = await fetch(`${api}/api/documents`).then((r) => r.json());
const needsReview = list.documents.find((d) => d.status === 'NEEDS_REVIEW');
const mismatch =
  list.documents.find((d) => d.exceptions.some((e) => e.code === 'TOTAL_MISMATCH')) ?? needsReview;

const browser = await chromium.launch();

for (const [name, width, height] of [
  ['desktop', 1440, 900],
  ['mobile', 420, 900],
]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });

  await page.goto(web, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/inbox-${name}.png`, fullPage: true });

  if (mismatch) {
    await page.goto(`${web}/documents/${mismatch.documentId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/review-${name}.png`, fullPage: true });
    // Viewport-only, so sticky elements are captured where a user sees them.
    await page.screenshot({ path: `${OUT}/review-${name}-viewport.png` });
    await page.evaluate(() => window.scrollBy(0, 700));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/review-${name}-scrolled.png` });
  }

  await page.close();
}

await browser.close();
console.log(`captured; featured review doc = ${mismatch?.documentId ?? 'none'}`);
