import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../app/App.tsx";
import { criarBackendMemoria } from "../data/backend-memoria.ts";
import { USUARIOS_DEMO } from "../domain/demo.ts";

const [DONO, GABRIEL] = USUARIOS_DEMO;
const HOJE = Date.now();
const corte = { tipo: "servico", id: "corte", nome: "CORTE", qtd: 1, preco: 60, custo: 0 };

function montar(userId: string, dados = {}) {
  const backend = criarBackendMemoria({ usuarios: USUARIOS_DEMO, userId, dados });
  const user = userEvent.setup();
  render(<App backendInicial={backend} />);
  return { backend, user };
}
const menu = () => screen.getAllByRole("navigation", { name: "Menu" })[0];
afterEach(() => vi.restoreAllMocks());

describe("Ajustes (dono)", () => {
  it("convida um barbeiro novo e dá entrada no estoque", async () => {
    const { user } = montar(DONO.id);
    await screen.findByText(/METAS DE GUSTAVO/);
    await user.click(within(menu()).getByText("Ajustes"));

    // Estoque
    const entrada = await screen.findByLabelText("Entrada de CERVEJA");
    await user.type(entrada, "6");
    await user.click(screen.getByRole("button", { name: "Adicionar entrada de CERVEJA" }));
    expect(await screen.findByText(/\+6 cerveja no estoque/)).toBeInTheDocument();

    // Equipe › convite
    await user.click(screen.getByRole("tab", { name: "Equipe" }));
    await user.type(await screen.findByLabelText("Nome do convidado"), "Rafael");
    await user.type(screen.getByLabelText("E-mail do convidado"), "rafael@exemplo.com");
    await user.click(screen.getByRole("button", { name: /Convidar$/ }));
    expect(await screen.findByText(/Rafael convidado/)).toBeInTheDocument();
    expect(screen.getByText(/rafael@exemplo.com · barbeiro/)).toBeInTheDocument();
    // senha nunca aparece na tela
    expect(screen.queryByText(/Senha/)).toBeNull();
  });

  it("e-mail inválido no convite mostra erro", async () => {
    const { user } = montar(DONO.id);
    await screen.findByText(/METAS DE GUSTAVO/);
    await user.click(within(menu()).getByText("Ajustes"));
    await user.click(await screen.findByRole("tab", { name: "Equipe" }));
    await user.type(await screen.findByLabelText("Nome do convidado"), "X");
    await user.click(screen.getByRole("button", { name: /Convidar$/ }));
    expect(await screen.findByText(/e-mail válido/)).toBeInTheDocument();
  });

  it("contas e catálogo carregam e salvam", async () => {
    const { user, backend } = montar(DONO.id);
    await screen.findByText(/METAS DE GUSTAVO/);
    await user.click(within(menu()).getByText("Ajustes"));
    await user.click(await screen.findByRole("tab", { name: "Contas" }));
    await user.type(await screen.findByLabelText("Nome da nova conta"), "Seguro");
    await user.type(screen.getByLabelText("Valor da nova conta"), "80");
    await user.click(screen.getByRole("button", { name: "Adicionar conta" }));
    await waitFor(async () => expect((await backend.carregar()).configPrivada.contas.some((c) => c.nome === "Seguro")).toBe(true));
    await user.click(screen.getByRole("tab", { name: "Serviços e produtos" }));
    expect(await screen.findByText("Missões diárias")).toBeInTheDocument();
  });
});

describe("Clientes (dono)", () => {
  it("marca fiado como pago e libera a comissão", async () => {
    const dados = {
      clientes: [{ id: "c1", nome: "Ana Souza", telefone: "62999990000" }],
      lancamentos: [
        {
          id: "f1",
          ts: HOJE - 3 * 86400000,
          barbeiroId: GABRIEL.id,
          barbeiroNome: "Gabriel",
          lancadoPorId: GABRIEL.id,
          clienteId: "c1",
          clienteNome: "Ana Souza",
          itens: [corte],
          subtotal: 60,
          gorjeta: 0,
          total: 60,
          pagamentos: [{ forma: "FIADO", valor: 60 }],
          fiado: true,
          pago: false,
          pagoEm: null,
        },
      ],
    };
    const { user, backend } = montar(DONO.id, dados);
    await screen.findByText(/METAS DE GUSTAVO/);
    await user.click(within(menu()).getByText("Clientes"));
    expect(await screen.findByText("Fiados / devedores")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Marcar como pago" }));
    await user.click(await screen.findByRole("button", { name: "Dinheiro" }));
    expect(await screen.findByText(/Fiado de Ana Souza pago no Dinheiro/)).toBeInTheDocument();
    expect((await backend.carregar()).lancamentos[0]).toMatchObject({ pago: true, pagamentos: [{ forma: "DINHEIRO", valor: 60 }] });

    // ficha do cliente e avaliação
    await user.click(screen.getByRole("button", { name: /Ana Souza/ }));
    await user.click(await screen.findByRole("button", { name: "5 estrelas" }));
    expect(await screen.findByText(/Nota 5 de Ana/)).toBeInTheDocument();
  });
});

describe("Meu dia (barbeiro)", () => {
  it("registra ponto, exclui o lançamento de hoje e fecha o caixa", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const dados = {
      lancamentos: [
        {
          id: "h1",
          ts: HOJE,
          barbeiroId: GABRIEL.id,
          barbeiroNome: "Gabriel",
          lancadoPorId: GABRIEL.id,
          clienteNome: "Cliente avulso",
          itens: [corte],
          subtotal: 60,
          gorjeta: 0,
          total: 60,
          pagamentos: [{ forma: "PIX", valor: 60 }],
          fiado: false,
          pago: true,
          pagoEm: HOJE,
        },
      ],
    };
    const { user, backend } = montar(GABRIEL.id, dados);
    await screen.findByText(/METAS DE GABRIEL/);
    await user.click(within(menu()).getByText("Meu dia"));
    await user.click(await screen.findByRole("button", { name: /Cheguei/ }));
    expect(await screen.findByText("Ponto registrado!")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Excluir lançamento" }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: /Excluir lançamento/ }));
    await user.type(within(dialogo).getByPlaceholderText(/duplicidade/), "teste");
    await user.click(within(dialogo).getByRole("button", { name: /^Excluir$/ }));
    expect(await screen.findByText("Lançamento excluído.")).toBeInTheDocument();
    expect((await backend.carregar()).lancamentos[0].motivoExclusao).toBe("teste");

    await user.click(screen.getByRole("button", { name: "Fechar caixa" }));
    expect(await screen.findByText(/Caixa fechado às/)).toBeInTheDocument();
  });
});

describe("Entrada", () => {
  it("sem banco configurado oferece a demonstração isolada", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/Banco de dados não configurado/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Como barbeiro/ }));
    expect(await screen.findByText(/MODO DEMONSTRAÇÃO/, {}, { timeout: 10000 })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "sair" }));
    expect(await screen.findByRole("button", { name: /Como dono/ })).toBeInTheDocument();
  });
});
