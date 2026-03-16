import { test, expect } from '@playwright/test';

// Inject CWV observers before any page JS runs
const cwvInitScript = () => {
  window.__cwv = { fcp: 0, lcp: 0, maxEventDuration: 0 };

  new PerformanceObserver((list) => {
    for (const e of list.getEntries())
      if (e.name === 'first-contentful-paint') window.__cwv.fcp = e.startTime;
  }).observe({ type: 'paint', buffered: true });

  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__cwv.lcp = e.startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  window.__cwv.maxEventDuration = 0;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries())
      if (e.interactionId && e.duration > window.__cwv.maxEventDuration)
        window.__cwv.maxEventDuration = e.duration;
  }).observe({ type: 'event', buffered: true, durationThreshold: 0 });
};

test.describe('Zoom App — Functional Checks', () => {
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
  });

  test('page loads with timer display', async ({ page }) => {
    await page.goto('/zoom/');
    await expect(page.getByText(/^\d{2}:\d{2}$/)).toBeVisible();
  });

  test('select role, start timer, verify ticking', async ({ page }) => {
    await page.goto('/zoom/');

    // Select a role
    const roleSelect = page.locator('select');
    await roleSelect.selectOption('Ice Breaker');
    await expect(roleSelect).toHaveValue('Ice Breaker');

    // Start timer
    await page.getByRole('button', { name: /START/i }).click();
    await page.waitForTimeout(1500);

    // Timer should have advanced past 00:00
    await expect(page.getByText(/^\d{2}:\d{2}$/)).not.toHaveText('00:00');
  });

  test('STOP → CONTINUE → FINISH flow', async ({ page }) => {
    await page.goto('/zoom/');

    // Type speaker name
    const nameInput = page.getByPlaceholder('Type speaker name...');
    await nameInput.fill('Zoom Speaker');

    // Start and wait
    await page.getByRole('button', { name: /START/i }).click();
    await page.waitForTimeout(1000);

    // Stop
    await page.getByRole('button', { name: /STOP/i }).click();
    await expect(page.getByRole('button', { name: /CONTINUE/i })).toBeVisible();

    // Continue
    await page.getByRole('button', { name: /CONTINUE/i }).click();
    await page.waitForTimeout(500);

    // Finish
    await page.getByRole('button', { name: /FINISH/i }).click();
    await expect(page.getByRole('button', { name: /START/i })).toBeVisible();
  });

  test('tab switching (LIVE → AGENDA → REPORT → LIVE)', async ({ page }) => {
    await page.goto('/zoom/');

    // Verify we start on LIVE
    await expect(page.getByText(/^\d{2}:\d{2}$/)).toBeVisible();

    // Switch to AGENDA
    await page.getByRole('button', { name: /AGENDA/i }).click();
    await expect(page.getByText(/No speakers in agenda/i)).toBeVisible();

    // Switch to REPORT
    await page.getByRole('button', { name: /REPORT/i }).click();
    await expect(page.getByText(/No reports yet/i)).toBeVisible();

    // Back to LIVE
    await page.getByRole('button', { name: /LIVE/i }).click();
    await expect(page.getByText(/^\d{2}:\d{2}$/)).toBeVisible();
  });

  test('report tab shows completed speech', async ({ page }) => {
    await page.goto('/zoom/');

    const nameInput = page.getByPlaceholder('Type speaker name...');
    await nameInput.fill('Report Speaker');

    await page.getByRole('button', { name: /START/i }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /FINISH/i }).click();

    await page.getByRole('button', { name: /REPORT/i }).click();
    await expect(page.getByText('Report Speaker')).toBeVisible();
  });

  test('no console errors about missing context providers', async ({ page }) => {
    await page.goto('/zoom/');
    await page.waitForTimeout(1000);

    const contextErrors = consoleErrors.filter(
      (msg) => msg.includes('Context') || msg.includes('Provider')
    );
    expect(contextErrors, `Context errors: ${contextErrors.join(', ')}`).toHaveLength(0);
  });
});

test.describe('Zoom App — Performance @performance', () => {
  test('FCP and LCP within thresholds', async ({ page }) => {
    await page.addInitScript(cwvInitScript);
    await page.goto('/zoom/');

    // Wait for LCP to settle
    await page.waitForTimeout(2000);

    const cwv = await page.evaluate(() => window.__cwv);
    console.log(`Zoom CWV — FCP: ${cwv.fcp}ms, LCP: ${cwv.lcp}ms`);

    expect(cwv.fcp, `FCP ${cwv.fcp}ms exceeded 3s`).toBeLessThan(3000);
    expect(cwv.lcp, `LCP ${cwv.lcp}ms exceeded 4s`).toBeLessThan(4000);
  });

  test('INP/TBT within threshold after interactions', async ({ page }) => {
    await page.addInitScript(cwvInitScript);
    await page.goto('/zoom/');
    await page.waitForTimeout(500);

    // Perform interactions
    await page.getByRole('button', { name: /START/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /STOP/i }).click();
    await page.getByRole('button', { name: /CONTINUE/i }).click();
    await page.getByRole('button', { name: /AGENDA/i }).click();
    await page.getByRole('button', { name: /LIVE/i }).click();

    await page.waitForTimeout(500);

    const cwv = await page.evaluate(() => window.__cwv);
    console.log(`Zoom CWV — Max Event Duration (INP proxy): ${cwv.maxEventDuration}ms`);

    // Zoom SDK init is heavier, so allow more headroom
    expect(cwv.maxEventDuration, `INP proxy ${cwv.maxEventDuration}ms exceeded 500ms`).toBeLessThan(500);
  });
});
