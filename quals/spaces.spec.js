// Quals for the whitespace invariant: the markdown pane must never contain
// non-ascii spaces. An intentional non-breaking space is written in the
// markdown as an explicit "&nbsp;".
//
// Background: Quill 2.0.3's getSemanticHTML() converts every ordinary space
// in a text node to "&nbsp;" (https://github.com/slab/quill/issues/4509), so
// without normalization the markdown pane fills up with U+00A0 characters
// even when perfectly normal text is typed or pasted on the richtext side.

import { test, expect } from '@playwright/test';
import { quillEval } from './helpers.js';

const NBSP = ' ';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.ql-editor');
});

// Replicata: type ordinary text with ordinary spaces on the richtext side.
// Expectata: the markdown pane contains those same ordinary spaces.
// Resultata (pre-fix): every space in the markdown pane is U+00A0.
test('typing ordinary text in richtext yields ascii spaces in markdown', async ({ page }) => {
  await page.click('.ql-editor');
  await page.keyboard.type('vanilla spaces here');
  await expect(page.locator('#markdown')).toHaveValue('vanilla spaces here');
});

// Replicata: richtext contains genuine non-breaking spaces (as when pasting
// from a site that litters its prose with them).
// Expectata: the markdown pane gets plain ascii spaces.
// Resultata (pre-fix): the U+00A0 characters leak into the markdown.
test('genuine NBSPs in richtext become ascii spaces in markdown', async ({ page }) => {
  await page.evaluate(quillEval((q) => q.insertText(0, 'foo bar', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('foo bar');
});

// Replicata: paste text containing a non-breaking space into the markdown
// pane directly.
// Expectata: it is normalized to an ascii space (this is what the old ✨
// button did on demand; now it's automatic).
// Resultata (pre-fix): the U+00A0 stays in the markdown pane.
test('NBSP entered into the markdown pane becomes an ascii space', async ({ page }) => {
  await page.fill('#markdown', `x${NBSP}y`);
  await expect(page.locator('#markdown')).toHaveValue('x y');
});

// Replicata: write an explicit "&nbsp;" entity in the markdown pane.
// Expectata: the markdown pane keeps the entity as typed (it renders as a
// real NBSP wherever the markdown is ultimately published). Note that
// Quill's own clipboard converter flattens incoming NBSPs to plain spaces
// (matchText does replaceAll("\u00a0", " ")), so the richtext preview shows
// an ordinary space; we don't fight that.
test('explicit &nbsp; in markdown survives in the markdown pane', async ({ page }) => {
  await page.fill('#markdown', 'a&nbsp;b');
  await expect.poll(() =>
    page.evaluate(quillEval((q) => q.getText()))
  ).toContain('a b');
  await expect(page.locator('#markdown')).toHaveValue('a&nbsp;b');
});

// Replicata: load the app.
// Expectata: no ✨ normalize-whitespace button; normalization is automatic.
// Resultata (pre-fix): the button is in the header.
test('the normalize-whitespace button is gone', async ({ page }) => {
  await expect(page.locator('.normalize-btn')).toHaveCount(0);
});

// Replicata: multiple consecutive spaces typed on the richtext side.
// Expectata: they collapse to a single space in the markdown, which is
// what any markdown renderer would display anyway. (Deliberate extra
// spaces are written in the markdown as explicit "&nbsp;".)
// Resultata (pre-fix): the run echoed into the markdown as multiple
// plain spaces -- markdown that renders differently than it reads.
test('multiple spaces in richtext collapse to one in markdown', async ({ page }) => {
  await page.evaluate(quillEval((q) => q.insertText(0, 'A  B   C', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('A B C');
});

// Replicata: multiple spaces inside a code block on the richtext side.
// Expectata: code is preformatted; the run survives verbatim.
test('multiple spaces in code blocks survive verbatim', async ({ page }) => {
  await page.evaluate(quillEval((q) => {
    q.insertText(0, 'a  b\n', 'user');
    q.formatLine(0, 1, { 'code-block': true });
  }));
  await expect(page.locator('#markdown')).toHaveValue('```\na  b\n```');
});

// Replicata: multiple spaces inside inline code on the richtext side.
// Expectata: the run survives verbatim inside the backticks.
test('multiple spaces in inline code survive verbatim', async ({ page }) => {
  await page.evaluate(quillEval((q) =>
    q.insertText(0, 'a  b', { code: true })));
  await expect(page.locator('#markdown')).toHaveValue('`a  b`');
});

// Replicata: multiple spaces typed on the markdown side.
// Expectata: the richtext renders them collapsed, like any markdown
// renderer; the markdown pane keeps the source as typed.
test('multiple spaces in markdown render collapsed in richtext', async ({ page }) => {
  await page.fill('#markdown', 'A  B');
  await expect.poll(() =>
    page.evaluate(quillEval((q) => q.getText()))
  ).toBe('A B\n');
  await expect(page.locator('#markdown')).toHaveValue('A  B');
});
