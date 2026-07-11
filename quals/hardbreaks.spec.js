// Quals for hard breaks inside block containers -- list items and
// blockquotes -- where a <br> must not mint a bogus new block. GitHub
// renders "1. a␠␠\nb\n4. c" as TWO list items (the lazy continuation
// joins item 1 with a hard break, and item numbering after the first
// marker is ignored), so we must too. Inside a list item the break rides
// as an inline hardbreak marker (Quill's model has no in-item line
// split); inside a blockquote it's a tight line like in paragraphs.

import { test, expect } from '@playwright/test';
import { quillEval } from './helpers.js';

const quillText = (page) => page.evaluate(quillEval((q) => q.getText()));

// The original bug report's input, verbatim.
const REPORTED = '1. Line one ending with double space  \n' +
                 'Line two with no number\n' +
                 '4. Line 3 numbered as line 4';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.ql-editor');
});

// Replicata: the reported markdown -- a list item with a trailing-double-
// space hard break, a lazy continuation line, and a misnumbered item --
// in preserve mode (the default).
// Expectata: two list items, like GitHub, with the continuation joined
// into item 1; not three items.
test('list hard break plus lazy continuation makes two items, not three', async ({ page }) => {
  await page.fill('#markdown', REPORTED);
  await expect(page.locator('.ql-editor li')).toHaveCount(2);
  await expect(page.locator('.ql-editor li').first())
    .toHaveText('Line one ending with double space Line two with no number');
  await expect(page.locator('.ql-editor li').nth(1))
    .toHaveText('Line 3 numbered as line 4');
});

// Replicata: the same input in strict mode.
// Expectata: identical structure -- the trailing double-space is a hard
// break in both dialects.
test('strict mode agrees: two items, not three', async ({ page }) => {
  await page.uncheck('#preserveNewlines');
  await page.fill('#markdown', REPORTED);
  await expect(page.locator('.ql-editor li')).toHaveCount(2);
});

// Replicata: a list item holding a hard break.
// Expectata: the two halves render on different visual lines -- the
// break must be visible, not just structural.
test('the in-item break is a visible line break', async ({ page }) => {
  await page.fill('#markdown', '1. supra  \ninfra\n2. alter');
  await expect(page.locator('.ql-editor li')).toHaveCount(2);
  const tops = await page.evaluate(() => {
    const range = document.createRange();
    const top = (text) => {
      range.selectNodeContents(text);
      return range.getBoundingClientRect().top;
    };
    const li = document.querySelector('.ql-editor li');
    return { first: top(li.firstChild), last: top(li.lastChild) };
  });
  expect(tops.last).toBeGreaterThan(tops.first + 10);
});

// Replicata: strict mode; the reported input, then a richtext edit.
// Expectata: the regenerated markdown is the canonical GitHub-equivalent
// form -- the break survives as a trailing double-space, the continuation
// is indented under its item, and the misnumbering reflows to 2.
test('strict-mode list breaks survive richtext edits canonically', async ({ page }) => {
  await page.uncheck('#preserveNewlines');
  await page.fill('#markdown', REPORTED);
  await expect(page.locator('.ql-editor li')).toHaveCount(2);
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue(
    '1. Line one ending with double space  \n' +
    '   Line two with no number\n' +
    '2. Line 3 numbered as line 4!');
});

// Replicata: preserve mode; a list item broken across two lines, then a
// richtext edit.
// Expectata: the break survives as the dialect's bare newline, indented
// under its item.
test('preserve-mode list breaks survive richtext edits canonically', async ({ page }) => {
  await page.fill('#markdown', '1. supra  \ninfra\n2. alter');
  await expect(page.locator('.ql-editor li')).toHaveCount(2);
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue(
    '1. supra\n   infra\n2. alter!');
});

// Replicata: the reported input plus a separate trailing paragraph;
// edit only the paragraph from the richtext side.
// Expectata: the list block keeps the user's exact source -- lazy
// continuation, "4." misnumbering and all (reconciliation at work).
test('untouched list blocks keep their exact source text', async ({ page }) => {
  await page.fill('#markdown', REPORTED + '\n\npostscriptum');
  await expect(page.locator('.ql-editor li')).toHaveCount(2);
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue(REPORTED + '\n\npostscriptum!');
});

// Replicata: copy richtext containing an in-item hard break.
// Expectata: the copied html carries a real <br> inside the <li>; the
// marker is editor-internal and must not leak.
test('copied richtext carries in-item breaks as real <br>', async ({ page }) => {
  await page.fill('#markdown', '1. supra  \ninfra\n2. alter');
  await expect(page.locator('.ql-editor li')).toHaveCount(2);
  const copied = await page.evaluate(quillEval((q) =>
    q.clipboard.onCopy({ index: 0, length: q.getLength() }, false)));
  expect(copied.html).toContain('<li>supra<br>infra</li>');
  expect(copied.html).not.toContain('hardbreak');
});

// Replicata: paste richtext (as other apps produce it) with a <br> inside
// a list item.
// Expectata: it ingests as one item with a break, and the markdown is the
// canonical continuation form.
test('pasted richtext <br> inside <li> stays one item', async ({ page }) => {
  await page.uncheck('#preserveNewlines');
  await page.evaluate(quillEval((q) =>
    q.clipboard.dangerouslyPasteHTML('<ol><li>supra<br>infra</li><li>alter</li></ol>')));
  await expect(page.locator('.ql-editor li')).toHaveCount(2);
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue(
    '1. supra  \n   infra\n2. alter!');
});

// Replicata: paste a list with an empty item -- whose <br> is the
// empty-line convention, not a hard break.
// Expectata: the empty item stays an empty item; no marker appears.
test('empty list items are not mistaken for hard breaks', async ({ page }) => {
  await page.evaluate(quillEval((q) =>
    q.clipboard.dangerouslyPasteHTML('<ol><li>a</li><li><br></li><li>c</li></ol>')));
  await expect(page.locator('.ql-editor li')).toHaveCount(3);
  await expect(page.locator('.ql-editor .ql-hardbreak-true')).toHaveCount(0);
});

// Replicata: a bulleted item broken across two lines, strict mode, then a
// richtext edit.
// Expectata: the continuation indents by the bullet prefix's two columns.
test('bullet-item breaks indent continuations under the bullet', async ({ page }) => {
  await page.uncheck('#preserveNewlines');
  await page.fill('#markdown', '* supra  \ninfra\n* alter');
  await expect(page.locator('.ql-editor li')).toHaveCount(2);
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue(
    '* supra  \n  infra\n* alter!');
});

// Replicata: type a character immediately after the in-item break point
// (the start of "infra") -- the spot where the marker's format could
// bleed into typed text.
// Expectata: no data loss and no corruption. The break itself may
// degrade to a plain space (the softwrap precedent), so the qual pins
// the safety property: the pane matches one of the two acceptable forms.
test('typing at the break point never corrupts text', async ({ page }) => {
  await page.uncheck('#preserveNewlines');
  await page.fill('#markdown', '1. supra  \ninfra');
  await expect.poll(() => quillText(page)).toBe('supra infra\n');
  await page.click('.ql-editor');
  await page.evaluate(quillEval((q) => q.setSelection(6, 0)));
  await page.keyboard.type('X');
  await expect.poll(() => quillText(page)).toBe('supra Xinfra\n');
  const md = await page.inputValue('#markdown');
  expect(['1. supra  \n   Xinfra', '1. supra Xinfra']).toContain(md);
});

// Replicata: strict mode; a blockquote whose two lines are joined by a
// trailing-double-space hard break, then a richtext edit.
// Expectata: it stays ONE quote with a hard break instead of splitting
// into two blank-line-separated quote paragraphs.
test('blockquote hard breaks survive richtext edits in strict mode', async ({ page }) => {
  await page.uncheck('#preserveNewlines');
  await page.fill('#markdown', '> supra  \n> infra');
  await expect(page.locator('.ql-editor blockquote.ql-tight-true')).toHaveCount(1);
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('> supra  \n> infra!');
});

// Replicata: preserve mode; a blockquote broken by a bare newline, then a
// richtext edit.
// Expectata: the single newline stays single.
test('blockquote breaks survive richtext edits in preserve mode', async ({ page }) => {
  await page.fill('#markdown', '> supra\n> infra');
  await expect(page.locator('.ql-editor blockquote.ql-tight-true')).toHaveCount(1);
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('> supra\n> infra!');
});
