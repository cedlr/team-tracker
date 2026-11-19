import { expect, test, type Page } from "@playwright/test";

const admin = { email: "admin@teamtracker.dev", password: "TeamTracker!2026" };

function ignore(text: string) {
  return /favicon|Download the React DevTools|Failed to load resource/.test(text);
}

const teamButton = (page: Page, name: string | RegExp) => page.getByRole("complementary").getByRole("button", { name });

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Forgot password?" })).toHaveCount(0);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(url => !url.pathname.startsWith("/login"));
}

test("team tracker round-trips on the local store", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && !ignore(message.text())) errors.push(message.text()); });

  await signIn(page, admin.email, admin.password);
  await teamButton(page, "Mobile apps").click();
  await page.getByRole("menuitemradio", { name: /Web platform/ }).click();
  await expect(teamButton(page, "Web platform")).toBeVisible();

  for (const route of ["/", "/tasks", "/projects", "/timeline", "/calendar", "/people", "/leave", "/utilization", "/settings"]) {
    await page.goto(route);
    await expect(page.locator("body")).toBeVisible();
    await expect(teamButton(page, "Web platform")).toBeVisible();
  }
  await page.goto("/projects/portal");
  await expect(page.getByText("Customer portal").first()).toBeVisible();

  await test.step("timeline and directory use real people", async () => {
    await page.goto("/timeline");
    await expect(page.getByText("Cedrick De Lara").first()).toBeVisible();
    await expect(page.getByText("Nathan Cole")).toHaveCount(0);
    await page.goto("/people");
    await expect(page.getByRole("button", { name: /Kuala Lumpur/ }).first()).toBeVisible();
    await expect(page.getByText("Zürich")).toHaveCount(0);
    await page.goto("/leave");
    await expect(page.getByText("Nov 16").first()).toBeVisible();
  });

  await test.step("create, edit and move a task", async () => {
    await page.goto("/tasks");
    await page.getByRole("banner").getByRole("button", { name: "New issue" }).click();
    await page.getByRole("textbox", { name: "New issue in Todo" }).fill("E2E smoke task");
    await page.getByRole("button", { name: "Create" }).click();
    const card = page.getByRole("button", { name: /E2E smoke task/ });
    await expect(card).toBeVisible();
    await page.waitForTimeout(1200);
    await page.reload();
    await expect(page.getByRole("button", { name: /E2E smoke task/ })).toBeVisible();

    await page.getByRole("button", { name: /E2E smoke task/ }).click();
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("E2E smoke task edited");
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(page.getByRole("button", { name: /E2E smoke task edited/ })).toBeVisible();

    const edited = page.getByRole("button", { name: /E2E smoke task edited/ });
    await edited.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(page.locator('[data-cell="progress"]').getByRole("button", { name: /E2E smoke task edited/ })).toBeVisible();
  });

  await test.step("log hours and check in and out", async () => {
    await page.goto("/utilization");
    const cedrickLogged = page.getByRole("table", { name: "Utilization in Web platform" }).getByRole("row", { name: /Cedrick De Lara/ }).locator("[data-label='Logged (h)']");
    const before = Number(await cedrickLogged.innerText());
    await page.getByRole("spinbutton", { name: "Hours" }).fill("2");
    await page.getByRole("button", { name: "Log hours" }).click();
    await expect(page.getByText(/Logged .*h on/)).toBeVisible();
    await page.reload();
    const after = Number(await page.getByRole("table", { name: "Utilization in Web platform" }).getByRole("row", { name: /Cedrick De Lara/ }).locator("[data-label='Logged (h)']").innerText());
    expect(after).toBeGreaterThan(before);

    await page.getByRole("button", { name: "Check in for today" }).click();
    await expect(page.getByRole("button", { name: /Check out/ })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: /Check out/ }).click();
    await expect(page.getByRole("button", { name: /Checked out/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /Checked out/ })).toBeVisible();
  });

  await test.step("add an email-approved leave record", async () => {
    await page.goto("/leave");
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await page.getByRole("button", { name: "Add leave" }).click();
    await page.getByRole("button", { name: /^Dates/ }).click();
    await page.getByRole("button", { name: /November 23, 2026/ }).click();
    await page.getByRole("button", { name: /November 24, 2026/ }).click();
    await page.getByRole("button", { name: "Apply" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Add leave" }).click();
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByText("Upcoming leave")).toBeVisible();
  });

  await test.step("calendar holiday and deadline persist", async () => {
    await page.goto("/calendar");
    await page.getByRole("button", { name: "New event", exact: true }).click();
    await page.getByLabel("Title").fill("E2E holiday");
    await page.getByRole("combobox", { name: "Calendar" }).click();
    await page.getByRole("option", { name: "Holidays" }).click();
    await page.getByRole("button", { name: "Save event" }).click();
    await page.waitForTimeout(800);
    await page.reload();
    await page.getByRole("button", { name: /E2E holiday/ }).first().click();
    await expect(page.getByRole("button", { name: "Delete E2E holiday" })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: /E2E holiday/ }).first().click();
    await page.getByRole("button", { name: "Delete E2E holiday" }).click();
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByText("E2E holiday")).toHaveCount(0);

    await page.getByRole("button", { name: "New event", exact: true }).click();
    await page.getByLabel("Title").fill("E2E deadline");
    await page.getByRole("combobox", { name: "Calendar" }).click();
    await page.getByRole("option", { name: "Task deadlines" }).click();
    await page.getByRole("button", { name: "Save event" }).click();
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByText("E2E deadline").first()).toBeVisible();
    await page.getByRole("button", { name: /E2E deadline/ }).first().click();
    await page.getByRole("button", { name: "Delete E2E deadline" }).click();
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByText("E2E deadline")).toHaveCount(0);
  });

  await test.step("invite a member, change their role, switch team", async () => {
    await page.goto("/settings");
    const email = `ada.e2e@teamtracker.dev`;
    await page.getByLabel("Emails or names").fill(email);
    await page.getByLabel("Emails or names").press("Enter");
    await page.getByRole("button", { name: "Send 1 invite" }).click();
    await expect(page.getByText(/Temporary password:/).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText(email).first()).toBeVisible();
    await page.getByLabel("Role for Ada E2e").click();
    await page.getByRole("option", { name: "Lead" }).click();
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByLabel("Role for Ada E2e")).toContainText("Lead");

    await page.getByLabel("New team").fill("Field notes");
    await page.getByRole("button", { name: "Add team" }).click();
    await expect(teamButton(page, "Field notes")).toBeVisible();
    await teamButton(page, "Field notes").click();
    await page.getByRole("menuitemradio", { name: /Web platform/ }).click();
    await expect(teamButton(page, "Web platform")).toBeVisible();
    await teamButton(page, "Web platform").click();
    await page.getByRole("menuitemradio", { name: /Mobile apps/ }).click();
    await page.goto("/projects");
    await expect(page.getByRole("link", { name: "iOS app 2.0" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Customer portal" })).toHaveCount(0);
  });

  await test.step("profile and password", async () => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Edit profile" }).click();
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Cedrick De Lara E2E");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Cedrick De Lara E2E").first()).toBeVisible();
    await page.reload();
    await expect(page.getByText("Cedrick De Lara E2E").first()).toBeVisible();

    const next = "TeamTracker!changed";
    await page.getByLabel("Current password").fill(admin.password);
    await page.getByLabel("New password").fill(next);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
    await page.getByRole("complementary").getByRole("button", { name: /Cedrick/ }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);
    await signIn(page, admin.email, next);
    await expect(page.getByRole("button", { name: /Cedrick/ })).toBeVisible();
  });

  expect(errors, errors.join("\n")).toEqual([]);
});
