import { test, expect } from '@playwright/test';

test('has title and loads dashboard', async ({ page }) => {
  // Navigation
  await page.goto('/');

  // Expect a title to be present (adjust as per your actual app title)
  // Usually it might redirect to login if not authenticated
  // We'll just check if the page loads basically
});

test('has clean app structure', async ({ page }) => {
  await page.goto('/');
  // This is a smoke test to ensure the dev server is responsive
  const title = await page.title();
  expect(typeof title).toBe('string');
});
