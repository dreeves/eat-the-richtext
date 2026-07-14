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
// Expectata: the strict toggle defaults to off, i.e. preserve mode, where
// a single newline is a line break.
test('preserve mode is the default and keeps single newlines', async ({ page }) => {
  await expect(page.locator('#strictNewlines')).not.toBeChecked();
  await page.fill('#markdown', 'a\nb');
  await expect.poll(() => quillText(page)).toBe('a\nb\n');
});

// Replicata: with markdown "a\nb" loaded, switch to strict mode.
// Expectata: the richtext re-renders immediately with the lines joined
// (CommonMark soft wrap), and the markdown source is left untouched.
test('strict mode joins single newlines', async ({ page }) => {
  await page.fill('#markdown', 'a\nb');
  await expect.poll(() => quillText(page)).toBe('a\nb\n');
  await page.check('#strictNewlines');
  await expect.poll(() => quillText(page)).toBe('a b\n');
  await expect(page.locator('#markdown')).toHaveValue('a\nb');
});

// Replicata: strict mode with a trailing double-space hard break and with
// a blank-line paragraph break.
// Expectata: both render as two lines in the richtext.
test('strict mode honors hard breaks and paragraph breaks', async ({ page }) => {
  await page.check('#strictNewlines');
  await page.fill('#markdown', 'a  \nb');
  await expect.poll(() => quillText(page)).toBe('a\nb\n');
  await page.fill('#markdown', 'a\n\nb');
  await expect.poll(() => quillText(page)).toBe('a\nb\n');
});

// Replicata: an empty line between two lines of text on the richtext side.
// Expectata: it survives in the markdown as an extra blank line -- each
// empty richtext line widens the gap by two newlines beyond the pair
// that separates the blocks. (This retires the old "<br>" convention;
// blank markdown lines ARE the representation now.)
test('richtext empty lines become extra blank lines in markdown', async ({ page }) => {
  await page.evaluate(quillEval((q) => q.insertText(0, 'a\n\nb\n', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('a\n\n\n\nb');
});

// Replicata: blank-line runs in the markdown pane.
// Expectata: two extra newlines render as one empty richtext line, four
// extra as two; a lone extra newline is cosmetic spacing and renders
// nothing. Same in strict mode -- a deliberate deviation from CommonMark
// (which collapses runs), because the panes must agree and an empty
// richtext line has no other pure-markdown representation.
test('blank-line runs render as empty richtext lines', async ({ page }) => {
  await page.fill('#markdown', 'a\n\n\n\nb');
  await expect.poll(() => quillText(page)).toBe('a\n\nb\n');
  await page.fill('#markdown', 'a\n\n\n\n\n\nb');
  await expect.poll(() => quillText(page)).toBe('a\n\n\nb\n');
  await page.fill('#markdown', 'a\n\n\nb');
  await expect.poll(() => quillText(page)).toBe('a\nb\n');
  await page.check('#strictNewlines');
  await page.fill('#markdown', 'a\n\n\n\nb');
  await expect.poll(() => quillText(page)).toBe('a\n\nb\n');
});

// Replicata: blank lines before the document's first block.
// Expectata: they render as leading empty lines (no block separation to
// pay for at the document edge, so two newlines each) and survive a
// richtext edit.
test('leading blank lines render and survive edits', async ({ page }) => {
  await page.fill('#markdown', '\n\na');
  await expect.poll(() => quillText(page)).toBe('\na\n');
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('\n\na!');
});

// Replicata: delete the empty line between two paragraphs on the richtext
// side.
// Expectata: its blank lines leave the markdown too -- the run must not
// resurrect from the pane's remembered spacing.
test('deleting an empty richtext line removes its blank lines', async ({ page }) => {
  await page.fill('#markdown', 'a\n\n\n\nb');
  await expect.poll(() => quillText(page)).toBe('a\n\nb\n');
  await page.evaluate(quillEval((q) => q.deleteText(2, 1, 'user')));
  await expect(page.locator('#markdown')).toHaveValue('a\n\nb');
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
  await page.check('#strictNewlines');
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

// Replicata: preserve mode (the default); a line break (single newline)
// and separately a paragraph break (blank line).
// Expectata: line-broken lines sit snug; blank-line paragraphs get
// visible vertical whitespace, just like strict mode. Regression guard
// for the "squished paragraphs" bug: paragraph spacing was once gated to
// strict mode on the theory that preserve mode would double-space
// everything, but single newlines make TIGHT lines here, so the gate
// only suppressed legitimate paragraph spacing.
test('preserve mode renders paragraph breaks with visible spacing', async ({ page }) => {
  const lineGap = () => page.evaluate(() => {
    const [p1, p2] = document.querySelectorAll('.ql-editor p');
    return p2.getBoundingClientRect().top - p1.getBoundingClientRect().bottom;
  });
  await page.fill('#markdown', 'a\nb');
  await expect(page.locator('.ql-editor p.ql-tight-true')).toHaveCount(1);
  const lineBreakGap = await lineGap();
  await page.fill('#markdown', 'a\n\nb');
  await expect(page.locator('.ql-editor p.ql-tight-true')).toHaveCount(0);
  const paragraphGap = await lineGap();
  expect(lineBreakGap).toBeLessThan(4);
  expect(paragraphGap).toBeGreaterThan(lineBreakGap + 5);
});

// Replicata: strict mode, markdown with a hard break, then type on the
// richtext side.
// Expectata: the regenerated markdown keeps the trailing-double-space hard
// break instead of degrading it to a paragraph break.
test('hard breaks survive richtext edits in strict mode', async ({ page }) => {
  await page.check('#strictNewlines');
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
  await page.check('#strictNewlines');
  await page.reload();
  await page.waitForSelector('.ql-editor');
  await expect(page.locator('#strictNewlines')).toBeChecked();
});

// Replicata: toggle between modes.
// Expectata: strict mode marks the page so the stylesheet can space true
// paragraphs; preserve mode unmarks it.
test('strict mode toggles the paragraph-spacing style hook', async ({ page }) => {
  await page.check('#strictNewlines');
  await expect(page.locator('body.strict-newlines')).toHaveCount(1);
  await page.uncheck('#strictNewlines');
  await expect(page.locator('body.strict-newlines')).toHaveCount(0);
});

// Replicata: look at the strict-markdown toggle.
// Expectata: it's the ruler icon alone, no text label.
test('the strict toggle is an icon, not text', async ({ page }) => {
  await expect(page.locator('.strict-toggle')).toHaveText('📏');
});
