import { expect, test } from "@playwright/test";

test("loads remote dashboard and shows core controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "远程操控你的 OpenCode" })).toBeVisible();
  await expect(page.getByText("OpenCode Remote")).toBeVisible();
  await expect(page.getByRole("button", { name: "连接服务器" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "会话控制台" })).toBeVisible();
  await expect(page.getByRole("button", { name: "发送任务" })).toBeVisible();
  await expect(page.getByRole("button", { name: "刷新 Diff" })).toBeVisible();

  const serverUrl = page.getByLabel("Server URL");
  await expect(serverUrl).toHaveValue("http://127.0.0.1:4096");

  const draft = page.getByPlaceholder("比如：修复 auth middleware 的 bug，并解释修改原因。");
  await draft.fill("帮我检查当前项目结构");
  await expect(page.getByRole("button", { name: "发送任务" })).toBeEnabled();
});
