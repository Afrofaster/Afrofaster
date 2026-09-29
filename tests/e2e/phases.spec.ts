import { expect, test, type Page } from "@playwright/test";

/** Phases 4–7 on top of the MVP journey (runs after mvp.spec.ts, same user). */
test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("jhony@e2e.local");
  await page.getByLabel("Contraseña").fill("clave-segura-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
}

const SCREENS = [
  "/", "/today", "/lia", "/life", "/life/career", "/more", "/goals", "/projects", "/tasks", "/inbox", "/inbox?view=ideas",
  "/waiting", "/decisions", "/people", "/metrics", "/metrics?tab=finanzas", "/reviews", "/reviews/weekly", "/reviews/monthly",
  "/brief", "/shutdown", "/search?q=olga", "/settings", "/settings/memory", "/capture", "/notifications", "/insights", "/failures",
];

test("every screen renders without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  for (const path of SCREENS) {
    await page.goto(path);
    await expect(page.getByText("No pude cargar esta vista"), path).toHaveCount(0);
    await expect(page.locator("main h1, main h2").first(), path).toBeAttached();
  }
  expect(errors).toEqual([]);
});

test("create sheets work from server-rendered pages", async ({ page }) => {
  await login(page);
  await page.goto("/waiting");
  await page.getByRole("button", { name: "Nuevo" }).click();
  await page.getByLabel("¿De quién?").fill("Diana");
  await page.getByLabel("¿Qué?").fill("los documentos firmados");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("— los documentos firmados")).toBeVisible();

  await page.goto("/people");
  await page.getByRole("button", { name: "Persona" }).click();
  await page.getByLabel("Nombre").fill("Pedro Ramírez");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("heading", { name: "Pedro Ramírez" })).toBeVisible();

  await page.goto("/decisions");
  await page.getByRole("button", { name: "Decisión" }).click();
  await page.getByLabel("¿Qué tienes que decidir?").fill("¿Contrato un asistente?");
  await page.getByRole("button", { name: "Abrir decisión" }).click();
  await expect(page.getByRole("heading", { name: "¿Contrato un asistente?" })).toBeVisible();
});

test("cron endpoint is never public", async ({ request }) => {
  expect((await request.get("/api/cron/hourly")).status()).toBe(401);
  expect((await request.get("/api/cron/hourly", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
});

test("attach a document to a project and download it", async ({ page }) => {
  await login(page);
  await page.goto("/projects");
  await page.getByText("Proyecto Carmen").first().click();
  await expect(page.getByRole("heading", { name: "Proyecto Carmen" })).toBeVisible();
  await page.getByLabel("Adjuntar archivo").setInputFiles({ name: "demanda.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") });
  await expect(page.getByRole("link", { name: "demanda.pdf" })).toBeVisible();
  const res = await page.request.get((await page.getByRole("link", { name: "demanda.pdf" }).getAttribute("href"))!);
  expect(res.ok()).toBe(true);
  expect(await res.text()).toBe("%PDF-1.4 e2e");
});

test("failure log, insights and notification center", async ({ page }) => {
  await login(page);
  await page.goto("/failures");
  await page.getByRole("button", { name: "Registrar" }).click();
  await page.getByLabel("¿Qué pasó?").fill("No preparé la audiencia con tiempo");
  await page.getByLabel("Causa raíz (el sistema, no la persona)").fill("No había bloque de preparación en el calendario");
  await page.getByRole("button", { name: "Guardar aprendizaje" }).click();
  await expect(page.getByText("No preparé la audiencia con tiempo")).toBeVisible();

  await page.goto("/insights");
  await expect(page.getByText("Aún no hay patrones confiables")).toBeVisible();

  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Notificaciones" })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText("Google Calendar")).toBeVisible();
  await expect(page.getByText(/no está configurada en el servidor/)).toBeVisible();
});
