// Quals for x-ray highlighting in the markdown pane: every non-ascii
// character gets a subtle tint, and trailing whitespace gets its own
// color. The 🥽 toggle in the header turns the tints on and off (on by
// default, persisted). The pane is a textarea, which can't style
// character ranges, so a backdrop div behind it mirrors the pane's exact
// text (shared metrics in style.css) with <mark> elements around each
// highlighted run; the textarea's transparent background lets the tint
// show through. See paintBackdrop in script.js.

import { test, expect } from '@playwright/test';
import { quillEval } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.ql-editor');
});

// Replicata: markdown containing accented letters, an em-dash, and an
// emoji among plain ascii.
// Expectata: the backdrop marks exactly the non-ascii runs, nothing else.
test('non-ascii characters in the markdown pane are highlighted', async ({ page }) => {
  await page.fill('#markdown', 'café — sí ☕ ok');
  await expect(page.locator('.markdown-backdrop mark'))
    .toHaveText(['é', '—', 'í', '☕']);
});

// Replicata: markdown that is pure ascii.
// Expectata: no highlights.
test('pure ascii markdown gets no highlights', async ({ page }) => {
  await page.fill('#markdown', 'plain text, nothing fancy: <b> & "quotes"');
  await expect(page.locator('.markdown-backdrop mark')).toHaveCount(0);
});

// Replicata: markdown containing HTML-special characters and newlines.
// Expectata: the backdrop's text mirrors the pane's value exactly --
// character-for-character parity is what keeps the highlights aligned
// under the textarea's glyphs.
test('backdrop text mirrors the pane value exactly', async ({ page }) => {
  const tricky = 'a <b>&amp;</b>\n\nx é y\n';
  await page.fill('#markdown', tricky);
  await expect.poll(() => page.evaluate(() => ({
    pane: document.getElementById('markdown').value,
    mirror: document.querySelector('.markdown-backdrop').textContent,
  }))).toEqual({ pane: tricky, mirror: tricky });
});

// Replicata: type non-ascii text on the richtext side (the programmatic
// write path into the pane, via reconcile).
// Expectata: the backdrop updates to highlight it.
test('richtext edits repaint the backdrop', async ({ page }) => {
  await page.evaluate(quillEval((q) => q.insertText(0, 'naïve ☕', 'user')));
  await expect(page.locator('#markdown')).toHaveValue('naïve ☕');
  await expect(page.locator('.markdown-backdrop mark'))
    .toHaveText(['ï', '☕']);
});

// Replicata: an invisible non-ascii character (U+FEFF, zero width
// no-break space) in the markdown pane. It survives asciiSpaces (Cf, not
// Zs), so highlighting is the only thing that surfaces it.
// Expectata: it gets a mark, and the mark carries a box-shadow ring so a
// zero-width character still produces a visible sliver.
test('invisible characters get a visibly marked highlight', async ({ page }) => {
  await page.fill('#markdown', 'x﻿y');
  const mark = page.locator('.markdown-backdrop mark');
  await expect(mark).toHaveText(['﻿']);
  const shadow = await mark.evaluate((el) =>
    getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe('none');
});

// Replicata: lines ending in spaces and a tab (in strict mode a trailing
// double-space is a hard break -- exactly the kind of invisible-but-
// meaningful whitespace worth seeing).
// Expectata: the trailing runs get their own marks, distinct in kind
// from non-ascii ones.
test('trailing whitespace is highlighted as its own kind', async ({ page }) => {
  await page.fill('#markdown', 'aé  \nb\t\nc');
  await expect.poll(() => page.$$eval('.markdown-backdrop mark.trailing',
    (els) => els.map((e) => e.textContent))).toEqual(['  ', '\t']);
  await expect.poll(() => page.$$eval('.markdown-backdrop mark.nonascii',
    (els) => els.map((e) => e.textContent))).toEqual(['é']);
});

// Replicata: one non-ascii character and one trailing space, goggles on.
// Expectata: both kinds are tinted, in different colors.
test('the two highlight kinds get two different colors', async ({ page }) => {
  await page.fill('#markdown', 'é \nx');
  const bg = (sel) => page.$eval(sel, (el) =>
    getComputedStyle(el).backgroundColor);
  const nonascii = await bg('.markdown-backdrop mark.nonascii');
  const trailing = await bg('.markdown-backdrop mark.trailing');
  expect(nonascii).not.toBe('rgba(0, 0, 0, 0)');
  expect(trailing).not.toBe('rgba(0, 0, 0, 0)');
  expect(nonascii).not.toBe(trailing);
});

// Replicata: click the 🥽 toggle off.
// Expectata: the tints go transparent; the pane's text is untouched.
test('the goggles toggle turns highlighting off', async ({ page }) => {
  await page.fill('#markdown', 'é \nx');
  await page.click('.xray-toggle');
  await expect(page.locator('#xrayToggle')).not.toBeChecked();
  await expect.poll(() => page.$$eval('.markdown-backdrop mark',
    (els) => els.map((e) => getComputedStyle(e).backgroundColor)))
    .toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
  await expect(page.locator('#markdown')).toHaveValue('é \nx');
});

// Replicata: toggle the goggles off, reload.
// Expectata: still off (persisted, like the newline mode); on is the
// default for a fresh visitor.
test('goggles state persists across reloads', async ({ page }) => {
  await expect(page.locator('#xrayToggle')).toBeChecked();
  await page.click('.xray-toggle');
  await page.reload();
  await page.waitForSelector('.ql-editor');
  await expect(page.locator('#xrayToggle')).not.toBeChecked();
});

// Replicata: look at the toggle.
// Expectata: it's the goggles icon alone, no text label.
test('the goggles toggle is an icon, not text', async ({ page }) => {
  await expect(page.locator('.xray-toggle')).toHaveText('🥽');
});

// Replicata: enough lines to overflow the pane, then scroll it.
// Expectata: the backdrop scrolls in lockstep (and can -- its content is
// at least as tall as the textarea's).
test('backdrop scrolls in lockstep with the pane', async ({ page }) => {
  await page.fill('#markdown', 'x é\n'.repeat(300));
  await page.evaluate(() => {
    document.getElementById('markdown').scrollTop = 400;
  });
  await expect.poll(() => page.evaluate(() => {
    const t = document.getElementById('markdown');
    const b = document.querySelector('.markdown-backdrop');
    return { top: t.scrollTop, mirror: b.scrollTop === t.scrollTop };
  })).toEqual({ top: 400, mirror: true });
});
