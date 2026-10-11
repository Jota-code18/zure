import { expect, type Page, test } from "@playwright/test";

async function entrarDemo(page: Page, como: "dono" | "barbeiro") {
  await page.goto("/");
  await page.getByRole("button", { name: `Como ${como}` }).click();
  await expect(page.getByText("MODO DEMONSTRAÇÃO")).toBeVisible();
  await expect(page.getByText(/METAS DE/)).toBeVisible();
}

const menu = (page: Page) => page.getByRole("navigation", { name: "Menu" }).filter({ visible: true });

async function semRolagemLateral(page: Page, onde: string) {
  const { largura, janela } = await page.evaluate(() => ({ largura: document.documentElement.scrollWidth, janela: window.innerWidth }));
  expect(largura, `rolagem lateral em "${onde}"`).toBeLessThanOrEqual(janela);
}

test("tela de entrada oferece a demonstração isolada", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("GESTÃO TOTAL")).toBeVisible();
  await expect(page.getByText(/não mexe nos dados reais/)).toBeVisible();
  await semRolagemLateral(page, "entrada");
});

test("dono: lança uma comanda, desfaz e corrige pela gestão", async ({ page }) => {
  await entrarDemo(page, "dono");
  await page.getByRole("button", { name: "Adicionar CORTE" }).click();
  await page.getByRole("button", { name: "Adicionar CERVEJA" }).click();
  const baixa = page.getByRole("button", { name: /DAR BAIXA R\$\s?71,00/ }).filter({ visible: true });
  await baixa.click();
  await expect(page.getByText(/Baixa de R\$\s?71,00 na comanda de Gustavo/)).toBeVisible();
  await expect(page.getByText("23 em estoque")).toBeVisible();

  await menu(page).getByText("Gestão").click();
  await expect(page.getByText("Barbearia hoje")).toBeVisible();
  await expect(page.getByText("Previsão do fim do mês")).toBeVisible();
  await page
    .getByRole("button", { name: /Corrigir lançamento de Cliente avulso/ })
    .first()
    .click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByRole("button", { name: "Cartão" }).click();
  await dialogo.getByRole("button", { name: /Salvar correção/ }).click();
  await expect(page.getByText(/Lançamento corrigido/)).toBeVisible();
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByText(/mudou: forma de pagamento/)).toBeVisible();
});

test("barbeiro: sem gestão, sem ranking e sem lucro da casa", async ({ page }) => {
  await entrarDemo(page, "barbeiro");
  await expect(menu(page).getByText("Gestão")).toHaveCount(0);
  await menu(page).getByText("Metas").click();
  await expect(page.getByText("CARTEIRA")).toBeVisible();
  await expect(page.getByText(/inclui saldo de semanas anteriores/)).toBeVisible();
  await expect(page.getByText(/Ranking/)).toHaveCount(0);
  await expect(page.getByText(/Lucro deixado pra casa/)).toHaveCount(0);
});

test("nenhuma tela tem rolagem lateral", async ({ page }) => {
  await entrarDemo(page, "dono");
  for (const aba of ["Lançar", "Metas", "Gestão", "Clientes", "Ajustes"]) {
    await menu(page).getByText(aba, { exact: true }).click();
    await page.waitForTimeout(400);
    await semRolagemLateral(page, aba);
  }
  for (const sub of ["Lançamentos", "Histórico"]) {
    await menu(page).getByText("Gestão", { exact: true }).click();
    await page.getByRole("tab", { name: sub }).click();
    await page.waitForTimeout(400);
    await semRolagemLateral(page, `Gestão › ${sub}`);
  }
});

test("funciona com movimento reduzido (acessibilidade)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await entrarDemo(page, "barbeiro");
  await page.getByRole("button", { name: "Adicionar CORTE" }).click();
  await page
    .getByRole("button", { name: /DAR BAIXA/ })
    .filter({ visible: true })
    .click();
  await expect(page.getByText(/Baixa de R\$/)).toBeVisible();
});
