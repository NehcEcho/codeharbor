import { expect, test } from "@playwright/test";

test("loads remote dashboard and shows core controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "OpenCode Remote" })).toBeVisible();
  await expect(page.getByText("Connect to your local agent server to monitor and manage coding sessions.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect to Server" })).toBeVisible();
  await expect(page.getByText("Recent connections are stored locally in your browser.")).toBeVisible();

  const serverUrl = page.locator('input[placeholder="http://192.168.1.10:1656"]');
  await expect(serverUrl).toHaveValue("http://127.0.0.1:1656");
  await expect(page.locator('input[value="opencode"]')).toHaveCount(1);
  await expect(page.locator('input[autocomplete="off"]')).toHaveValue("");
});
