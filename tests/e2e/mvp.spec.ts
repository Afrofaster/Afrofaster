import { expect, test, type Page } from "@playwright/test";

/**
 * Spec §79 — the MVP is done only when Jhony can do all of this.
 * One continuous journey, like a real first day.
 */
test.describe.configure({ mode: "serial" });

const email = "jhony@e2e.local";
const password = "clave-segura-e2e";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
}

test("installable PWA: manifest, icons and service worker", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ short_name: "LÍA", display: "standalone" });
  expect((await request.get("/icons/icon-512.png")).ok()).toBe(true);
  expect((await request.get("/sw.js")).ok()).toBe(true);
});

test("protected routes redirect to login", async ({ page, request }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login\?next=%2Ftoday/);
  expect((await request.post("/api/capture", { data: { text: "hola" } })).status()).toBe(401);
});

test("signup + onboarding builds the first life dashboard", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("¿Cómo quieres que te llame?").fill("Jhony");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear mi espacio" }).click();
  await expect(page).toHaveURL(/onboarding/);

  await page.getByRole("button", { name: /Continuar/ }).click(); // name
  await page.getByRole("button", { name: /Continuar/ }).click(); // areas (defaults)
  await page.getByRole("button", { name: /Continuar/ }).click(); // ratings
  await page.getByLabel("Objetivo 1").fill("Terminar la maestría");
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("button", { name: /Trabajo \/ oficina/ }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByText("Esto entendí de tu vida")).toBeVisible();
  await page.getByRole("button", { name: "Construir mi tablero" }).click();

  await expect(page).toHaveURL(/welcome=1/);
  await expect(page.getByText("Tu primer tablero de vida está listo.")).toBeVisible();
  await expect(page.getByText("Life Score", { exact: true })).toBeVisible();
});

test("natural capture becomes structured, completes, and persists", async ({ page }) => {
  await login(page);
  const box = page.getByRole("textbox", { name: "Captura rápida" });
  await box.fill("hoy llamar a Olga por el contrato");
  await box.press("Enter");
  await expect(page.getByText(/Tarea creada: Llamar a Olga/)).toBeVisible();

  await box.fill("dormí 6 horas");
  await box.press("Enter");
  await expect(page.getByText(/Sueño: 6 h registrado/)).toBeVisible();

  await page.goto("/today");
  const task = page.getByRole("checkbox", { name: /Completar “Llamar a Olga por el contrato”/ }).first();
  await expect(task).toBeVisible();
  await task.click();
  await expect(page.getByText(/Hecho: Llamar a Olga/)).toBeVisible();

  // Close and reopen: nothing is lost.
  await page.reload();
  await page.goto("/tasks?view=done");
  await expect(page.getByText("Llamar a Olga por el contrato")).toBeVisible();
});

test("see projects, goals, life areas and inbox", async ({ page }) => {
  await login(page);
  await page.goto("/goals");
  await expect(page.getByText("Terminar la maestría")).toBeVisible();
  await page.goto("/projects?new=1");
  await page.getByLabel("Nombre").fill("Proyecto Carmen");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await expect(page.getByRole("heading", { name: "Proyecto Carmen" })).toBeVisible();
  await page.goto("/life");
  await expect(page.getByText("Salud física").first()).toBeVisible();
  await page.goto("/inbox?view=all");
  await expect(page.getByText("dormí 6 horas", { exact: true })).toBeVisible();
});

test("ask LÍA what to do and get a Big 3", async ({ page }) => {
  await login(page);
  const box = page.getByRole("textbox", { name: "Captura rápida" });
  for (const t of ["hoy terminar el escrito de Carmen", "hoy enviar propuesta a PACE", "hoy pagar la tarjeta"]) {
    await box.fill(t);
    await box.press("Enter");
    await expect(page.getByText(/Tarea creada/).last()).toBeVisible();
  }
  await page.goto("/lia?new=1");
  await page.getByLabel("Mensaje para LÍA").fill("organízame hoy");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Plan propuesto")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Confirmar Big 3/)).toBeVisible();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Big 3 confirmado.")).toBeVisible();

  await page.getByLabel("Mensaje para LÍA").fill("¿qué tengo pendiente?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText(/Lo más importante por hacer/)).toBeVisible({ timeout: 20_000 });

  await page.goto("/");
  await expect(page.getByText("Confirmadas por ti")).toBeVisible();
});

test("weekly review is completed and saved", async ({ page }) => {
  await login(page);
  await page.goto("/reviews/weekly");
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: /Siguiente/ }).click();
  await page.getByRole("radio", { name: "4" }).click();
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(page.getByRole("heading", { name: "CEO Meeting" })).toBeVisible();
  await expect(page.getByText(/Control percibido 4\/5/)).toBeVisible();
});
