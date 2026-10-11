/* Exporta o mês em Excel. Carregado só quando o dono clica (a biblioteca é pesada). */
import { dreMes, dt } from "../../domain/calculos.ts";
import { dataBR, hora, mesLabel, rangeMes } from "../../domain/datas.ts";

export async function exportarExcel({ users, todas, config, clientes, mk }) {
  const XLSX = await import("xlsx");
  const d = dreMes(users, todas, config, mk);
  const [ini, fim] = rangeMes(mk);
  const wb = XLSX.utils.book_new();
  const add = (nome, sheet) => XLSX.utils.book_append_sheet(wb, sheet, nome);
  const r2 = (v) => +Number(v || 0).toFixed(2);
  add(
    "DRE",
    XLSX.utils.aoa_to_sheet([
      ["DRE", mesLabel(mk)],
      ["Faturamento", r2(d.fat)],
      ["Comissões e bônus", -r2(d.comissoes)],
      ["Custo de produtos", -r2(d.custoProd)],
      [`Imposto (${config.imposto}%)`, -r2(d.imposto)],
      [`Maquininha (${config.maquininha}% no cartão)`, -r2(d.maq)],
      ["Custo fixo", -r2(d.fixo)],
      ["Lucro", r2(d.lucro)],
      ["Margem %", r2(d.margem)],
      ["Gorjetas (fora do DRE)", r2(d.gorjetas)],
      ["Atendimentos", d.atend],
      ["Cortes", d.cortes],
      ["Ticket médio", r2(d.ticket)],
    ]),
  );
  add(
    "Equipe",
    XLSX.utils.json_to_sheet(
      d.porUser.map(({ u, c }) => ({
        Nome: u.nome,
        Cortes: c.cortes,
        Atendimentos: c.atend,
        Faturamento: r2(c.fat),
        "Ticket médio": r2(c.ticket),
        "Comissão serviços": r2(c.comServ),
        "Comissão produtos": r2(c.comProd),
        "Bônus bebida": r2(c.bonusBebida),
        "Bônus missões": r2(c.bonusMissoes),
        "Bônus plano": r2(c.bonusTier),
        "Comissão total": r2(c.comissao),
        Gorjetas: r2(c.gorjeta),
        "Lucro deixado pra casa": r2(c.casa),
      })),
    ),
  );
  const doMes = todas
    .filter((l) => dt(l) >= ini && dt(l) < fim)
    .sort((a, b) => a.ts - b.ts)
    .map((l) => ({
      Data: dataBR(l.ts),
      Hora: hora(l.ts),
      Barbeiro: l.barbeiroNome,
      "Lançado por": l.lancadoPorNome || l.barbeiroNome,
      Cliente: l.clienteNome,
      Itens: l.itens.map((i) => `${i.qtd}x ${i.nome}`).join(" + "),
      Subtotal: r2(l.subtotal),
      Gorjeta: r2(l.gorjeta),
      Total: r2(l.total),
      Pagamento: l.pagamentos.map((p) => `${p.forma} ${p.valor.toFixed(2)}`).join(" + "),
      Situação: l.fiado ? (l.pago ? "Fiado pago" : "Fiado em aberto") : "Pago",
      Corrigido: l.editadoEm ? "sim" : "",
    }));
  add("Lançamentos", XLSX.utils.json_to_sheet(doMes.length ? doMes : [{ Aviso: "Sem lançamentos no mês" }]));
  const fiados = todas
    .filter((l) => l.fiado && !l.pago)
    .map((l) => ({ Cliente: l.clienteNome, Barbeiro: l.barbeiroNome, Data: dataBR(l.ts), Valor: r2(l.total) }));
  add("Fiados em aberto", XLSX.utils.json_to_sheet(fiados.length ? fiados : [{ Aviso: "Nenhum fiado em aberto" }]));
  add(
    "Estoque",
    XLSX.utils.json_to_sheet(
      config.produtos.map((p) => ({ Produto: p.nome, Estoque: p.estoque, Custo: p.custo, Venda: p.preco, "Lucro unit.": r2(p.preco - p.custo) })),
    ),
  );
  add(
    "Clientes",
    XLSX.utils.json_to_sheet(
      clientes.length
        ? clientes.map((c) => {
            const v = todas.filter((l) => l.clienteId === c.id && l.pago);
            return {
              Nome: c.nome,
              WhatsApp: c.telefone || "",
              Visitas: v.length,
              "Total gasto": r2(v.reduce((a, l) => a + l.total, 0)),
              "Última visita": v.length ? dataBR(Math.max(...v.map((l) => l.ts))) : "",
            };
          })
        : [{ Aviso: "Sem clientes" }],
    ),
  );
  XLSX.writeFile(wb, `Zure_${mk}.xlsx`);
}
