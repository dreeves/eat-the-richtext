// Quals for the resizable two-pane layout: side-by-side on wide screens,
// stacked on narrow (phone-sized) screens. The breakpoint lives in both
// style.css and script.js (stackedLayout) and must stay in sync.

import { test, expect } from '@playwright/test';

const paneBoxes = async (page) => ({
  rich: await page.locator('.richtext-container').boundingBox(),
  md: await page.locator('.markdown-container').boundingBox(),
});

test.describe('wide screens', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ql-editor');
  });

  // Replicata: panes side by side; drag the divider 200px to the left.
  // Expectata: the richtext pane gets correspondingly narrower.
  test('divider drags horizontally', async ({ page }) => {
    const before = await paneBoxes(page);
    const divider = await page.locator('.divider').boundingBox();
    const x = divider.x + divider.width / 2;
    const y = divider.y + 300;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 200, y);
    await page.mouse.up();
    const after = await paneBoxes(page);
    expect(after.rich.width).toBeLessThan(before.rich.width - 100);
  });
});

test.describe('phone-sized screens', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ql-editor');
  });

  // Replicata: load the app at phone width.
  // Expectata: panes are stacked (richtext above markdown), each full
  // width, with no horizontal page overflow.
  test('panes stack vertically', async ({ page }) => {
    const { rich, md } = await paneBoxes(page);
    expect(rich.y + rich.height).toBeLessThanOrEqual(md.y + 1);
    expect(rich.width).toBeGreaterThan(380);
    expect(md.width).toBeGreaterThan(380);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });

  // Replicata: panes stacked; drag the divider 150px upward.
  // Expectata: the richtext pane gets correspondingly shorter.
  test('divider drags vertically', async ({ page }) => {
    const before = await paneBoxes(page);
    const divider = await page.locator('.divider').boundingBox();
    const x = divider.x + 100;
    const y = divider.y + divider.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 150);
    await page.mouse.up();
    const after = await paneBoxes(page);
    expect(after.rich.height).toBeLessThan(before.rich.height - 100);
  });

  // Replicata: type markdown at phone size.
  // Expectata: the conversion machinery is unaffected by the layout.
  test('conversion works at phone size', async ({ page }) => {
    await page.fill('#markdown', '*sly*');
    await expect(page.locator('.ql-editor em')).toHaveText('sly');
  });
});
