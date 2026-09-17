import { expect, test } from "@playwright/test";

test("signup requires matching passwords and sign-in does not", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Confirm password", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "New to Marginalia? Create an account" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Test Researcher");
  await page.getByLabel("Email address", { exact: true }).fill("signup@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  const confirmation = page.getByLabel("Confirm password", { exact: true });
  await expect(confirmation).toHaveAttribute("required", "");
  await confirmation.fill("different-password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Passwords don’t match");
  await expect(confirmation).toBeFocused();
  await expect(page).toHaveURL(/\/login/);
  await confirmation.fill("test-password");
  await expect(page.getByText("Passwords don’t match", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Already have an account? Sign in" }).click();
  await expect(confirmation).toHaveCount(0);
});
