import { expect, test } from "@playwright/test";

test("demo-vue: filter/sort sidebar opens", async ({ page }) => {
  await page.goto("/");

  // Filter/Sort sidebar (filter/sort dataset).
  await page.locator('input[name="data-mode"][value="filter-sort"]').check();
  await page.locator('button[data-extable-fs-open="1"]').first().click();
  await expect(page.locator(".extable-filter-sort-sidebar")).toBeVisible();
  await page.locator('button[data-extable-fs="close"]').click();
  await expect(page.locator(".extable-filter-sort-sidebar")).toBeHidden();
});
