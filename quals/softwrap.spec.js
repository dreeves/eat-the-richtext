// Quals for softwrap markers, the second layer of source-formatting
// preservation: soft wraps (single newlines that strict mode renders as
// spaces) ride inside the Quill document as format-marked ordinary
// spaces, so they survive edits even inside the block being edited --
// where block-level reconciliation can't help. Failure must always
// degrade toward a plain space, never corrupt text.

import { test, expect } from '@playwright/test';
import { quillEval } from './helpers.js';

const quillText = (page) => page.evaluate(quillEval((q) => q.getText()));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.ql-editor');
  await page.check('#strictNewlines');
});

// Replicata: strict mode, one soft-wrapped paragraph; append text at the
// end of it from the richtext side.
// Expectata: the soft wrap survives even though the edit is inside the
// same block.
test('soft wraps survive edits within their own block', async ({ page }) => {
  await page.fill('#markdown', 'line-one\nline-two');
  await expect.poll(() => quillText(page)).toBe('line-one line-two\n');
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('line-one\nline-two!');
});

// Replicata: a soft wrap between inline formatting, edited elsewhere in
// the block.
// Expectata: the wrap position survives, including when it sits between
// inline elements rather than between plain words. (The emphasis style
// reflows to canonical underscores -- the edit is inside this block, so
// only the wrap is preserved at sub-block granularity.)
test('soft wraps adjacent to inline formatting survive', async ({ page }) => {
  await page.fill('#markdown', 'ante *unus*\n*duo* post');
  await expect(page.locator('.ql-editor em')).toHaveCount(2);
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('ante _unus_\n_duo_ post!');
});

// Replicata: copy richtext containing a soft wrap.
// Expectata: the copied html carries a plain ordinary space at the wrap
// point -- the marker is editor-internal and must not leak.
test('copied richtext renders soft wraps as plain spaces', async ({ page }) => {
  await page.fill('#markdown', 'line-one\nline-two');
  await expect.poll(() => quillText(page)).toBe('line-one line-two\n');
  const copied = await page.evaluate(quillEval((q) =>
    q.clipboard.onCopy({ index: 0, length: q.getLength() }, false)));
  expect(copied.html).toContain('line-one line-two');
  expect(copied.html).not.toContain('softwrap');
});

// Replicata: type a character immediately after the wrap point (the start
// of "line-two") -- the spot where a formatted space could bleed its
// format into typed text.
// Expectata: no data loss and no corruption; the text lands exactly where
// typed. Whether the wrap itself survives this adjacent edit is allowed
// to go either way (degrading to a space is acceptable), so the qual pins
// the safety property: the pane matches one of the two acceptable forms.
test('typing at the wrap point never corrupts text', async ({ page }) => {
  await page.fill('#markdown', 'line-one\nline-two');
  await expect.poll(() => quillText(page)).toBe('line-one line-two\n');
  await page.click('.ql-editor');
  await page.evaluate(quillEval((q) => q.setSelection(9, 0)));
  await page.keyboard.type('X');
  await expect.poll(() => quillText(page)).toBe('line-one Xline-two\n');
  const md = await page.inputValue('#markdown');
  expect(['line-one\nXline-two', 'line-one Xline-two']).toContain(md);
});
