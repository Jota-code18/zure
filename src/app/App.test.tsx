import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { criarBackendMemoria } from "../data/backend-memoria.ts";
import { USUARIOS_DEMO } from "../domain/demo.ts";
import App from "./App.tsx";

const [DONO, GABRIEL, NATH] = USUARIOS_DEMO;

function montar(userId: string, dados = {}) {
  const backend = criarBackendMemoria({ usuarios: USUARIOS_DEMO, userId, dados });
  const user = userEvent.setup();
  render(<App backendInicial={backend} />);
  return { backend, user };
}

const menu = () => screen.getAllByRole("navigation", { name: "Menu" })[0];

describe("app como barbeiro", () => {
  it("não tem Gestão/Clientes/Ajustes e vê só as próprias metas", async () => {
    const { user } = montar(GABRIEL.id);
    expect(await screen.findByText(`METAS DE ${GABRIEL.nome.toUpperCase()}`)).toBeInTheDocument();
    const nav = within(menu());
    expect(nav.getByText("Meu dia")).toBeInTheDocument();
    expect(nav.queryByText("Gestão")).toBeNull();
    expect(nav.queryByText("Ajustes")).toBeNull();

    // Lançando para o colega: as metas dele somem e fica avisado que o lançamento é registrado.
    await user.click(screen.getByRole("button", { name: new RegExp(NATH.nome) }));
    expect(screen.queryByText(`METAS DE ${NATH.nome.toUpperCase()}`)).toBeNull();
    expect(screen.getByText(/Fica registrado que foi você quem lançou/)).toBeInTheDocument();
  });

  it("lança para um colega sem ver as metas nem o faturamento dele", async () => {
    const { user, backend } = montar(GABRIEL.id);
    await screen.findByText(/METAS DE GABRIEL/);
    await user.click(screen.getByRole("button", { name: new RegExp(NATH.nome) }));
    await user.click(screen.getByRole("button", { name: "Adicionar CORTE" }));
    await user.click(screen.getAllByRole("button", { name: /DAR BAIXA/ })[0]);
    const aviso = await screen.findByText(/Baixa de R\$\s?45,00 na comanda de Nathanael/);
    expect(aviso.textContent).not.toMatch(/meta/i);
    expect(await screen.findByText(/SEUS LANÇAMENTOS PARA NATHANAEL HOJE/)).toBeInTheDocument();

    const dono = criarBackendMemoria({ usuarios: USUARIOS_DEMO, userId: DONO.id, dados: {} });
    expect(dono).toBeTruthy();
    const visto = await backend.carregar();
    expect(visto.lancamentos[0]).toMatchObject({ barbeiroId: NATH.id, lancadoPorId: GABRIEL.id });
  });

  it("fiado sem cliente é bloqueado com aviso", async () => {
    const { user } = montar(GABRIEL.id);
    await screen.findByText(/METAS DE GABRIEL/);
    await user.click(screen.getByRole("button", { name: "Adicionar CORTE" }));
    await user.click(screen.getByRole("button", { name: /Fiado/ }));
    await user.click(screen.getAllByRole("button", { name: /DAR BAIXA/ })[0]);
    expect(await screen.findByText(/Fiado: escolha ou crie o cliente/)).toBeInTheDocument();
  });

  it("aba Metas: carteira por semana, sem ranking e sem lucro da casa", async () => {
    const { user } = montar(GABRIEL.id);
    await screen.findByText(/METAS DE GABRIEL/);
    await user.click(within(menu()).getByText("Metas"));
    expect(await screen.findByText("CARTEIRA", {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText(/Esta semana ·/)).toBeInTheDocument();
    expect(screen.queryByText(/Ranking/)).toBeNull();
    expect(screen.queryByText(/Lucro deixado pra casa/)).toBeNull();
  });
});

describe("app como dono", () => {
  it("vê a gestão sem o rótulo de IA e sem 'apagar tudo' nos ajustes", async () => {
    const { user } = montar(DONO.id);
    await screen.findByText(/METAS DE GUSTAVO/);
    await user.click(within(menu()).getByText("Gestão"));
    expect(await screen.findByText("Previsão do fim do mês", {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByText(/com IA/)).toBeNull();
    await user.click(within(menu()).getByText("Ajustes"));
    await user.click(await screen.findByRole("tab", { name: "Dados" }));
    expect(await screen.findByText(/Segurança dos dados/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apagar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /demonstração/i })).toBeNull();
  });

  it("corrige um lançamento e a correção aparece no histórico", async () => {
    const { user } = montar(DONO.id);
    await screen.findByText(/METAS DE GUSTAVO/);
    await user.click(screen.getByRole("button", { name: "Adicionar CORTE" }));
    await user.click(screen.getAllByRole("button", { name: /DAR BAIXA/ })[0]);
    await screen.findByText(/Baixa de R\$\s?65,00/);

    await user.click(within(menu()).getByText("Gestão"));
    await user.click((await screen.findAllByRole("button", { name: /Corrigir lançamento de/ }))[0]);
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Dinheiro" }));
    await user.click(within(dialogo).getByRole("button", { name: /Salvar correção/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(screen.getByRole("tab", { name: "Histórico" }));
    expect(await screen.findByText("Correção")).toBeInTheDocument();
    expect(screen.getByText(/mudou: forma de pagamento$/)).toBeInTheDocument();
  });

  it("às 19h mostra o resumo do dia dentro da página, sem cobrir a navegação", async () => {
    vi.setSystemTime(new Date(2026, 9, 7, 19, 30));
    try {
      montar(DONO.id);
      const resumo = await screen.findByText(/RESUMO DO DIA/);
      expect(resumo.closest("main")).not.toBeNull();
      expect(screen.getByText(/^Hoje: R\$/)).toBeInTheDocument();
    } finally {
      vi.setSystemTime(new Date(2026, 9, 7, 15, 0));
    }
  });
});
