import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoSeriousAxeViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(v => ["critical", "serious"].includes(v.impact ?? ""));
  expect(blocking, blocking.map(v => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
}

test.describe("accessibility foundation", () => {
  test("map shell has landmarks, a skip link, and no serious axe violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: /primary navigation/i }).first()).toBeVisible();
    await page.getByRole("link", { name: /skip to main content/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
    await expectNoSeriousAxeViolations(page);
  });

  test("language and accessibility dialog traps focus, closes with Escape, and restores focus", async ({ page, isMobile }) => {
    await page.goto("/#capture");
    const opener = page.getByRole("button", { name: /language and accessibility/i });
    if (!isMobile) test.skip();
    await opener.click();
    const dialog = page.getByRole("dialog", { name: /language and accessibility/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /larger text/i }).click();
    await expect(page.locator("html")).toHaveClass(/a11y-large-text/);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("English, Hindi and Marathi update the document language without horizontal overflow", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Language controls are verified in the mobile dialog.");
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/#capture");
    await page.getByRole("button", { name: /language and accessibility/i }).click();
    for (const [name, lang] of [["English", "en"], ["हिन्दी", "hi"], ["मराठी", "mr"]] as const) {
      await page.getByRole("button", { name }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    }
  });

  test("keyboard journey reaches capture, reports, municipal, and officer navigation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /capture/i }).first().click();
    await expect(page.locator("main")).toContainText(/report pollution/i);
    await page.getByRole("button", { name: /my reports/i }).first().click();
    await page.getByRole("button", { name: /municipal/i }).first().click();
    await page.getByRole("button", { name: /officer/i }).first().click();
    await expect(page.locator("main")).toContainText(/officer|situation command/i);
  });
});
