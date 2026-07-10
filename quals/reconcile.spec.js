// Quals for source-formatting preservation ("reconcile"): when the
// richtext side is edited, markdown blocks whose meaning didn't change
// keep the user's exact source text -- soft wraps, emphasis-marker style,
// blank-line counts, fence style -- and only genuinely changed blocks take
// the regenerated canonical text. The markdown pane itself is the only
// state.

import { test, expect } from '@playwright/test';
import { quillEval } from './helpers.js';

const quillText = (page) => page.evaluate(quillEval((q) => q.getText()));
const pokeEnd = (page) => page.evaluate(quillEval((q) =>
  q.insertText(q.getLength() - 1, '!', 'user')));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.ql-editor');
});

// Replicata: strict mode, a soft-wrapped paragraph plus a second
// paragraph; edit the second one on the richtext side.
// Expectata: the soft wrap in the untouched paragraph survives verbatim.
test('soft wraps in untouched blocks survive richtext edits', async ({ page }) => {
  await page.uncheck('#preserveNewlines');
  await page.fill('#markdown', 'line-one\nline-two\n\nalius');
  await expect.poll(() => quillText(page)).toBe('line-one line-two\nalius\n');
  await pokeEnd(page);
  await expect(page.locator('#markdown')).toHaveValue(
    'line-one\nline-two\n\nalius!');
});

// Replicata: asterisk-style emphasis in one paragraph; edit a different
// paragraph on the richtext side.
// Expectata: the asterisks survive (canonical regeneration would rewrite
// them with turndown's default underscore delimiter).
test('emphasis-marker style in untouched blocks survives richtext edits', async ({ page }) => {
  await page.fill('#markdown', '*unus*\n\nduo');
  await expect(page.locator('.ql-editor em')).toHaveText('unus');
  await pokeEnd(page);
  await expect(page.locator('#markdown')).toHaveValue('*unus*\n\nduo!');
});

// Replicata: extra blank lines between two paragraphs; edit the second on
// the richtext side.
// Expectata: the blank-line run survives verbatim.
test('extra blank lines between blocks survive richtext edits', async ({ page }) => {
  await page.fill('#markdown', 'a\n\n\n\nb');
  await expect.poll(() => quillText(page)).toBe('a\nb\n');
  await pokeEnd(page);
  await expect(page.locator('#markdown')).toHaveValue('a\n\n\n\nb!');
});

// Replicata: a tilde-fenced code block containing a blank line, then a
// paragraph; edit the paragraph on the richtext side.
// Expectata: the fence survives verbatim, tildes, inner blank line and
// all (canonical regeneration would rewrite it with backticks, and naive
// blank-line splitting would shred it).
test('code fences survive richtext edits elsewhere', async ({ page }) => {
  await page.fill('#markdown', '~~~\ncodex\n\nplus\n~~~\n\npost');
  await expect.poll(() => quillText(page)).toContain('codex');
  await pokeEnd(page);
  await expect(page.locator('#markdown')).toHaveValue(
    '~~~\ncodex\n\nplus\n~~~\n\npost!');
});

// Replicata: strict mode, a paragraph with non-canonical emphasis AND a
// soft wrap; edit INSIDE that paragraph on the richtext side.
// Expectata: the edited block reflows to canonical text for everything
// EXCEPT soft wraps, which the softwrap-marker layer preserves at
// character granularity (see quals/softwrap.spec.js). Here the asterisk
// emphasis is rewritten to canonical underscores while the wrap survives.
test('the edited block reflows to canonical text except soft wraps', async ({ page }) => {
  await page.uncheck('#preserveNewlines');
  await page.fill('#markdown', '*primus*\nline-two');
  await expect.poll(() => quillText(page)).toBe('primus line-two\n');
  await pokeEnd(page);
  await expect(page.locator('#markdown')).toHaveValue('_primus_\nline-two!');
});
