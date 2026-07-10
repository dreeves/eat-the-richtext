// Quals for the newline-mode toggle. "Preserve" (the default) treats every
// newline in the markdown as a line break (the Discord / GitHub-comments
// dialect). "Strict" is CommonMark: a blank line starts a new paragraph, a
// single newline soft-wraps (joins), and a hard break requires a trailing
// double-space.

import { test, expect } from '@playwright/test';
import { quillEval } from './helpers.js';

const quillText = (page) => page.evaluate(quillEval((q) => q.getText()));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.ql-editor');
});

// Replicata: load the app fresh.
// Expectata: the toggle defaults to preserve mode, where a single newline
// is a line break.
test('preserve mode is the default and keeps single newlines', async ({ page }) => {
  await expect(page.locator('#preserveNewlines')).toBeChecked();
  await page.fill('#markdown', 'a\nb');
  await expect.poll(() => quillText(page)).toBe('a\nb\n');
});

// Replicata: with markdown "a\nb" loaded, switch to strict mode.
// Expectata: the richtext re-renders immediately with the lines joined
// (CommonMark soft wrap), and the markdown source is left untouched.
test('strict mode joins single newlines', async ({ page }) => {
  await page.fill('#markdown', 'a\nb');
  await expect.poll(() => quillText(page)).toBe('a\nb\n');
  await page.uncheck('#preserveNewlines');
  await expect.poll(() => quillText(page)).toBe('a b\n');
  await expect(page.locator('#markdown')).toHaveValue('a\nb');
});

// Replicata: strict mode with a trailing double-space hard break and with
// a blank-line paragraph break.
// Expectata: both render as two lines in the richtext.
test('strict mode honors hard breaks and paragraph breaks', async ({ page }) => {
  await page.uncheck('#preserveNewlines');
  await page.fill('#markdown', 'a  \nb');
  await expect.poll(() => quillText(page)).toBe('a\nb\n');
  await page.fill('#markdown', 'a\n\nb');
  await expect.poll(() => quillText(page)).toBe('a\nb\n');
});

// Replicata: an empty line between two lines of text on the richtext side.
// Expectata: it survives in the markdown as an explicit "<br>" line
// instead of being silently eaten (blank markdown lines are structural,
// so a literal blank can't represent it).
test('richtext empty lines become explicit <br> lines in markdown', async ({ page }) => {
  await page.evaluate(quillEval((q) => q.insertText(0, 'a\n\nb\n', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('a\n\n<br>\n\nb');
});

// Replicata: a "<br>" line in the markdown pane.
// Expectata: it renders as an empty line in the richtext, and the markdown
// source keeps the explicit tag.
test('<br> markdown lines render as empty richtext lines', async ({ page }) => {
  await page.fill('#markdown', 'a\n\n<br>\n\nb');
  await expect.poll(() => quillText(page)).toBe('a\n\nb\n');
  await expect(page.locator('#markdown')).toHaveValue('a\n\n<br>\n\nb');
});

// Replicata: strict mode; render a hard break (trailing double-space) and
// separately a paragraph break.
// Expectata: the hard-break lines sit visibly tighter together than the
// blank-line-separated paragraphs.
test('strict mode renders hard breaks tighter than paragraph breaks', async ({ page }) => {
  const lineGap = () => page.evaluate(() => {
    const [p1, p2] = document.querySelectorAll('.ql-editor p');
    return p2.getBoundingClientRect().top - p1.getBoundingClientRect().bottom;
  });
  await page.uncheck('#preserveNewlines');
  await page.fill('#markdown', 'a  \nb');
  // Waiting on the tight-marker class rather than the text: both variants
  // produce the same two-line text, so text alone can't signal re-render.
  await expect(page.locator('.ql-editor p.ql-tight-true')).toHaveCount(1);
  const hardBreakGap = await lineGap();
  await page.fill('#markdown', 'a\n\nb');
  await expect(page.locator('.ql-editor p.ql-tight-true')).toHaveCount(0);
  const paragraphGap = await lineGap();
  expect(hardBreakGap).toBeLessThan(4);
  expect(paragraphGap).toBeGreaterThan(hardBreakGap + 5);
});

// Replicata: strict mode, markdown with a hard break, then type on the
// richtext side.
// Expectata: the regenerated markdown keeps the trailing-double-space hard
// break instead of degrading it to a paragraph break.
test('hard breaks survive richtext edits in strict mode', async ({ page }) => {
  await page.uncheck('#preserveNewlines');
  await page.fill('#markdown', 'a  \nb');
  await expect(page.locator('.ql-editor p.ql-tight-true')).toHaveCount(1);
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('a  \nb!');
});

// Replicata: preserve mode, markdown "a\nb", then type on the richtext
// side.
// Expectata: the single newline stays single instead of inflating into a
// blank-line paragraph break.
test('single newlines survive richtext edits in preserve mode', async ({ page }) => {
  await page.fill('#markdown', 'a\nb');
  await expect(page.locator('.ql-editor p.ql-tight-true')).toHaveCount(1);
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('a\nb!');
});

// Replicata: preserve mode, three lines joined by single newlines (a chain
// of hard breaks), then type on the richtext side.
// Expectata: the chain survives intact -- one paragraph, two breaks.
test('chains of hard breaks survive richtext edits', async ({ page }) => {
  await page.fill('#markdown', 'a\nb\nc');
  await expect(page.locator('.ql-editor p.ql-tight-true')).toHaveCount(2);
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('a\nb\nc!');
});

// Replicata: copy richtext containing a hard break.
// Expectata: the copied html is one paragraph with a real <br> -- what the
// pane displays must be the copyable structure itself, not editor-private
// styling over a different structure.
test('copied richtext carries hard breaks as real <br>', async ({ page }) => {
  await page.fill('#markdown', 'a\nb');
  await expect(page.locator('.ql-editor p.ql-tight-true')).toHaveCount(1);
  const copied = await page.evaluate(quillEval((q) =>
    q.clipboard.onCopy({ index: 0, length: q.getLength() }, false)));
  expect(copied.html).toContain('<p>a<br>b</p>');
});

// Replicata: switch to strict mode, reload the page.
// Expectata: the choice sticks.
test('newline mode persists across reloads', async ({ page }) => {
  await page.uncheck('#preserveNewlines');
  await page.reload();
  await page.waitForSelector('.ql-editor');
  await expect(page.locator('#preserveNewlines')).not.toBeChecked();
});

// Replicata: toggle between modes.
// Expectata: strict mode marks the page so the stylesheet can space true
// paragraphs; preserve mode unmarks it.
test('strict mode toggles the paragraph-spacing style hook', async ({ page }) => {
  await page.uncheck('#preserveNewlines');
  await expect(page.locator('body.strict-newlines')).toHaveCount(1);
  await page.check('#preserveNewlines');
  await expect(page.locator('body.strict-newlines')).toHaveCount(0);
});
