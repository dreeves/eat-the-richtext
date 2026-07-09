// Smoke quals for the core richtext<->markdown conversion, so refactoring
// doesn't silently break the app's whole reason for existing.

import { test, expect } from '@playwright/test';

const quillEval = (fn) => `(${fn})(Quill.find(document.querySelector('#richtext')))`;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.ql-editor');
});

// Replicata: insert bold text on the richtext side.
// Expectata: the markdown pane shows **stars**.
test('bold richtext becomes **bold** markdown', async ({ page }) => {
  await page.evaluate(quillEval((q) => q.insertText(0, 'brave', { bold: true })));
  await expect(page.locator('#markdown')).toHaveValue('**brave**');
});

// Replicata: type *stars* on the markdown side.
// Expectata: the richtext side renders italics.
test('*italic* markdown becomes italic richtext', async ({ page }) => {
  await page.fill('#markdown', '*sly*');
  await expect(page.locator('.ql-editor em')).toHaveText('sly');
});

// Replicata: type two words in the markdown pane.
// Expectata: the header word count says "2 words".
test('word count counts words', async ({ page }) => {
  await page.fill('#markdown', 'duo verba');
  await expect(page.locator('#wordCount')).toHaveText('2 words');
});

// Replicata: type a GFM pipe table in the markdown pane.
// Expectata: the richtext side renders an actual table with the cell text.
test('GFM table markdown becomes a richtext table', async ({ page }) => {
  await page.fill('#markdown', '| Tables | Chairs |\n| --- | --- |\n| data | electric |');
  await expect(page.locator('.ql-editor table td').first()).toHaveText('Tables');
  await expect(page.locator('.ql-editor table td').nth(3)).toHaveText('electric');
});

// Replicata: type a heading and a blockquote in the markdown pane.
// Expectata: the richtext side renders <h2> and <blockquote>.
test('heading and blockquote markdown become richtext', async ({ page }) => {
  await page.fill('#markdown', '## Caput\n\n> Citatum');
  await expect(page.locator('.ql-editor h2')).toHaveText('Caput');
  await expect(page.locator('.ql-editor blockquote')).toHaveText('Citatum');
});
