import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("connected research workflow, provenance, persistence, and responsive UI", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page
    .getByLabel("Email address")
    .fill(`browser-${Date.now()}@example.edu`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("a secure browser password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little clarity.", exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "../artifacts/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Guided feedback study");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page
    .getByLabel("What do you want to explore?")
    .fill(
      "Explore how guided feedback affects student programming performance.",
    );
  await page
    .getByRole("button", { name: "Check direction", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A clearer view of your idea" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm this direction", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Research direction confirmed" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Sources", exact: true }).click();
  await page.getByLabel("Upload research PDFs").setInputFiles({
    name: "feedback-study.pdf",
    mimeType: "application/pdf",
    buffer: readFileSync("../artifacts/test-source.pdf"),
  });
  await page
    .getByRole("button", { name: "Evaluate & extract", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reprocess", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Evidence matrix", exact: true })
    .click();
  await page.getByRole("button", { name: "Page 1", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Follow the evidence" }),
  ).toBeVisible();
  await expect(page.getByRole("blockquote")).toHaveText(
    "Students using guided feedback improved their programming performance in the study.",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Essay check", exact: true }).click();
  await page.getByLabel("Draft title").fill("Literature review");
  await page
    .getByLabel("Academic draft", { exact: true })
    .fill("Guided feedback improves student programming performance.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("button", { name: "Check evidence", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Guided feedback improves student programming performance.",
    }),
  ).toBeVisible();
  await page
    .getByRole("button")
    .filter({
      has: page.getByRole("heading", {
        name: "Guided feedback improves student programming performance.",
      }),
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Claim evidence review" }),
  ).toBeVisible();
  await expect(
    page.getByText("Add a citation for this finding.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../artifacts/claim-provenance.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Guided feedback improves student programming performance.",
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).not.toBeVisible();
  await page.screenshot({
    path: "../artifacts/essay-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Topic experience hub" }).click();
  await expect(
    page.getByRole("heading", { name: "Topic experience hub", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
