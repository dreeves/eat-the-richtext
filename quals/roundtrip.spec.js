// Smoke quals for the core richtext<->markdown conversion, so refactoring
// doesn't silently break the app's whole reason for existing.

import { test, expect } from '@playwright/test';
import { quillEval } from './helpers.js';

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

// Replicata: a bulleted list on the richtext side.
// Expectata: markdown bullets are "* item" -- ONE space after the asterisk
// (turndown's default is three).
test('bullet items get one space after the asterisk', async ({ page }) => {
  await page.evaluate(quillEval((q) => {
    q.insertText(0, 'unus\nduo\n');
    q.formatLine(0, 9, { list: 'bullet' });
  }));
  await expect(page.locator('#markdown')).toHaveValue('* unus\n* duo');
});

// Replicata: a numbered list on the richtext side.
// Expectata: markdown items are "1. item" -- one space after the period.
test('numbered items get one space after the period', async ({ page }) => {
  await page.evaluate(quillEval((q) => {
    q.insertText(0, 'unus\nduo\n');
    q.formatLine(0, 9, { list: 'ordered' });
  }));
  await expect(page.locator('#markdown')).toHaveValue('1. unus\n2. duo');
});

// Replicata: type a horizontal rule (---) in the markdown pane.
// Expectata: the richtext side renders an actual <hr> line, not the
// literal text "---".
test('markdown --- becomes a real horizontal rule in richtext', async ({ page }) => {
  await page.fill('#markdown', 'ante\n\n---\n\npost');
  await expect(page.locator('.ql-editor hr')).toHaveCount(1);
});

// Replicata: a horizontal rule in the richtext editor.
// Expectata: the markdown side renders it as "---" on its own line.
test('richtext horizontal rule becomes --- in markdown', async ({ page }) => {
  await page.evaluate(quillEval((q) => {
    q.insertText(0, 'ante\n');
    q.insertEmbed(5, 'divider', true);
    q.insertText(6, 'post\n');
  }));
  await expect(page.locator('#markdown')).toHaveValue('ante\n\n---\n\npost');
});

// Replicata: a bulleted list with a nested sub-item on the richtext side.
// Expectata: the sub-item is indented to align under its parent's text
// (two spaces for a "* " parent), and the markdown round-trips back to a
// nested list in richtext.
test('nested list items stay aligned and round-trip', async ({ page }) => {
  await page.evaluate(quillEval((q) => {
    q.insertText(0, 'unus\nduo\n');
    q.formatLine(0, 9, { list: 'bullet' });
    q.formatLine(5, 1, { indent: 1 });
  }));
  await expect(page.locator('#markdown')).toHaveValue('* unus\n  * duo');
  await page.fill('#markdown', '* unus\n  * duo');
  await expect(page.locator('.ql-editor li')).toHaveCount(2);
});
