import { expect, test } from "@playwright/test";

const findKey = process.platform === "darwin" ? "Meta+F" : "Control+F";

test("demo-vue: search and filter/sort sidebars open", async ({ page }) => {
  await page.goto("/");

  // Search sidebar (standard dataset).
  await page.locator('input[name="data-mode"][value="standard"]').check();
  await page.locator('td[data-col-key="name"]').first().click();
  await expect(page.locator("text=mode=html")).toBeVisible();
  await page.keyboard.press(findKey);
  await expect(page.locator(".extable-search-sidebar")).toBeVisible();
  await page.locator('input[data-extable-fr="query"]').fill("User 1");
  await expect(page.locator('tbody[data-extable-fr="results-tbody"] tr').first()).toBeVisible();
  await page.locator('button[data-extable-fr="close"]').click();
  await expect(page.locator(".extable-search-sidebar")).toBeHidden();

  // Filter/Sort sidebar (filter/sort dataset).
  await page.locator('input[name="data-mode"][value="filter-sort"]').check();
  await page.locator('button[data-extable-fs-open="1"]').first().click();
  await expect(page.locator(".extable-filter-sort-sidebar")).toBeVisible();
  await page.locator('button[data-extable-fs="close"]').click();
  await expect(page.locator(".extable-filter-sort-sidebar")).toBeHidden();
});
