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
