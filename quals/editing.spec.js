// Quals for live editing on either pane: incremental typing, deletions,
// formatting applied mid-edit, alternating edits across panes, cursor
// preservation, escaping stability, and persistence. The conversion quals
// elsewhere mostly test one-shot rendering; these test the editing loop.

import { test, expect } from '@playwright/test';
import { quillEval } from './helpers.js';

const quillText = (page) => page.evaluate(quillEval((q) => q.getText()));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.ql-editor');
});

// --- Editing on the richtext side ---

// Replicata: type two lines into the richtext separated by Enter.
// Expectata: the markdown separates them as paragraphs (blank line).
test('Enter in richtext makes a paragraph break in markdown', async ({ page }) => {
  await page.click('.ql-editor');
  await page.keyboard.type('primus\nsecundus');
  await expect(page.locator('#markdown')).toHaveValue('primus\n\nsecundus');
});

// Replicata: click the toolbar bold button, then type.
// Expectata: the typed text lands bold in the markdown.
test('toolbar bold during typing lands as ** in markdown', async ({ page }) => {
  await page.click('.ql-editor');
  await page.click('.ql-toolbar .ql-bold');
  await page.keyboard.type('validus');
  await expect(page.locator('#markdown')).toHaveValue('**validus**');
});

// Replicata: two paragraphs; delete the boundary between them from the
// richtext side.
// Expectata: the markdown collapses to the single merged line.
test('deleting a line boundary in richtext merges lines in markdown', async ({ page }) => {
  await page.fill('#markdown', 'a\n\nb');
  await expect.poll(() => quillText(page)).toBe('a\nb\n');
  await page.evaluate(quillEval((q) => q.deleteText(1, 1, 'user')));
  await expect(page.locator('#markdown')).toHaveValue('ab');
});

// Replicata: render a heading from markdown, then append to it from the
// richtext side.
// Expectata: the markdown keeps it a single heading -- extended, not
// duplicated or demoted.
test('appending to a heading in richtext extends it in markdown', async ({ page }) => {
  await page.fill('#markdown', '# Caput');
  await expect(page.locator('.ql-editor h1')).toHaveText('Caput');
  await page.evaluate(quillEval((q) => q.insertText(5, ' magnum', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('# Caput magnum');
});

// Replicata: type text containing a literal asterisk in the richtext, then
// keep typing.
// Expectata: the markdown escapes it once and the escaping never compounds
// across successive edits (the classic bidirectional-editor failure).
test('literal asterisks escape once and stay stable across edits', async ({ page }) => {
  await page.click('.ql-editor');
  await page.keyboard.type('2 * 3');
  await expect(page.locator('#markdown')).toHaveValue('2 \\* 3');
  await page.keyboard.type(' = 6');
  await expect(page.locator('#markdown')).toHaveValue('2 \\* 3 = 6');
});

// Replicata: type three words into the richtext.
// Expectata: the word count follows richtext edits, not just markdown ones.
test('word count follows richtext edits', async ({ page }) => {
  await page.click('.ql-editor');
  await page.keyboard.type('unus duo tres');
  await expect(page.locator('#wordCount')).toHaveText('3 words');
});

// Replicata: edit a table cell from the richtext side.
// Expectata: the markdown table updates in place.
test('editing a table cell in richtext updates the markdown table', async ({ page }) => {
  await page.fill('#markdown', '| Tables | Chairs |\n| --- | --- |\n| data | electric |');
  await expect(page.locator('.ql-editor table')).toHaveCount(1);
  await page.evaluate(quillEval((q) =>
    q.insertText(q.getText().indexOf('data'), 'meta', 'user')));
  await expect(page.locator('#markdown')).toHaveValue(
    '| Tables | Chairs |\n| --- | --- |\n| metadata | electric |');
});

// --- Editing on the markdown side ---

// Replicata: type markdown into the pane keystroke by keystroke.
// Expectata: the richtext renders it after the debounce.
test('incremental markdown typing renders through the debounce', async ({ page }) => {
  await page.locator('#markdown').pressSequentially('*celer*');
  await expect(page.locator('.ql-editor em')).toHaveText('celer');
});

// Replicata: place the cursor mid-text in the markdown pane and type.
// Expectata: after the richtext sync runs, focus and cursor position are
// unchanged.
test('markdown cursor position survives the richtext sync', async ({ page }) => {
  await page.fill('#markdown', 'ab');
  await page.evaluate(() =>
    document.getElementById('markdown').setSelectionRange(1, 1));
  await page.keyboard.type('X');
  await expect.poll(() => quillText(page)).toBe('aXb\n');
  const state = await page.evaluate(() => {
    const md = document.getElementById('markdown');
    return {
      focused: document.activeElement === md,
      start: md.selectionStart,
      end: md.selectionEnd,
    };
  });
  expect(state).toEqual({ focused: true, start: 2, end: 2 });
});

// Replicata: render a heading, then replace the whole markdown with plain
// text.
// Expectata: the richtext is replaced, not appended to.
test('replacing markdown replaces richtext instead of appending', async ({ page }) => {
  await page.fill('#markdown', '# Caput');
  await expect(page.locator('.ql-editor h1')).toHaveCount(1);
  await page.fill('#markdown', 'planus');
  await expect.poll(() => quillText(page)).toBe('planus\n');
  await expect(page.locator('.ql-editor h1')).toHaveCount(0);
});

// Replicata: markdown with an explicit "<br>" blank line, then edit on the
// richtext side.
// Expectata: the explicit blank line survives regeneration.
test('explicit <br> blank lines survive richtext edits', async ({ page }) => {
  await page.fill('#markdown', 'a\n\n<br>\n\nb');
  await expect.poll(() => quillText(page)).toBe('a\n\nb\n');
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('a\n\n<br>\n\nb!');
});

// Replicata: "&nbsp;" entity in markdown, then a richtext edit. This quals
// the DOCUMENTED one-way door: Quill's clipboard flattens NBSPs to plain
// spaces on ingest, so regeneration loses the entity. If this ever starts
// failing because the entity survives, that's an upgrade -- loop in the
// human and update the qual.
// Expectata: the entity degrades to a plain space, and nothing worse.
test('&nbsp; degrades to a plain space after a richtext edit', async ({ page }) => {
  await page.fill('#markdown', 'a&nbsp;b');
  await expect.poll(() => quillText(page)).toBe('a b\n');
  await page.evaluate(quillEval((q) => q.insertText(q.getLength() - 1, '!', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('a b!');
});

// Replicata: edit the markdown, reload the page.
// Expectata: both panes come back with the edited content.
test('edits persist across a reload', async ({ page }) => {
  await page.fill('#markdown', 'memoria *tenax*');
  await expect(page.locator('.ql-editor em')).toHaveText('tenax');
  await page.reload();
  await page.waitForSelector('.ql-editor');
  await expect(page.locator('#markdown')).toHaveValue('memoria *tenax*');
  await expect(page.locator('.ql-editor em')).toHaveText('tenax');
});
