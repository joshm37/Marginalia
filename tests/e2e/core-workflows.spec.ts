import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("e2e@marginalia.test");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("E2E Researcher").first()).toBeVisible();
}

async function createProject(request: APIRequestContext, name: string) {
  const response = await request.post("/api/projects", { data: { name } });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ id: string; name: string }>;
}

test("sign-in opens the authenticated workspace", async ({ page }) => {
  await signIn(page);
  await expect(
    page.getByRole("button", { name: "Save a source" }),
  ).toBeVisible();
});

test("captures a source from an analyzed link", async ({ page, request }) => {
  const id = suffix();
  const project = await createProject(request, `Capture project ${id}`);
  await signIn(page);
  await page.route("**/api/sources/analyze", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        title: `Captured source ${id}`,
        authors: ["Grace Hopper", "Alan Turing"],
        organization: "Test Journal",
        date: "2026-01-02",
        url: `https://example.test/article/${id}`,
        type: "Article",
        description: "Metadata extracted during the browser journey.",
      }),
    });
  });
  await page.getByRole("button", { name: "Save a source" }).click();
  await page
    .locator(".source-link-modal input[type=url]")
    .fill(`https://example.test/article/${id}`);
  await page.getByRole("button", { name: "Analyze and continue" }).click();
  await expect(page.getByRole("heading", { name: "New source" })).toBeVisible();
  const projectField = page
    .locator(".modal .field")
    .filter({ hasText: "PROJECT" });
  await projectField.locator("select").selectOption(project.id);
  await page.getByRole("button", { name: "Save source" }).click();
  await expect(page.getByText(`Captured source ${id}`).first()).toBeVisible();
});

test("edits an existing excerpt", async ({ page, request }) => {
  const id = suffix();
  const project = await createProject(request, `Excerpt project ${id}`);
  const sourceResponse = await request.post("/api/sources", {
    data: {
      title: `Excerpt source ${id}`,
      url: `https://example.test/excerpt/${id}`,
      type: "Article",
      projects: [project.id],
      tags: [],
    },
  });
  expect(sourceResponse.ok()).toBeTruthy();
  const source = (await sourceResponse.json()) as { id: string };
  const excerptResponse = await request.post("/api/excerpts", {
    data: {
      sourceId: source.id,
      selectedText: `Selected evidence ${id}`,
      note: "Original note",
      pageUrl: `https://example.test/excerpt/${id}`,
      type: "Evidence",
      projects: [project.id],
      tags: ["e2e"],
    },
  });
  expect(excerptResponse.ok()).toBeTruthy();

  await signIn(page);
  await page.getByRole("button", { name: "Excerpts" }).click();
  const excerpt = page
    .locator("article")
    .filter({ hasText: `Selected evidence ${id}` });
  await excerpt.getByRole("button", { name: "Edit excerpt" }).click();
  const noteField = page.locator(".modal .field").filter({ hasText: "NOTE" });
  await noteField.locator("textarea").fill(`Updated note ${id}`);
  await page.getByRole("button", { name: "Update excerpt" }).click();
  await expect(page.getByText(`Updated note ${id}`)).toBeVisible();
});
