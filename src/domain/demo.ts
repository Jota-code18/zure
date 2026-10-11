/* Dados fictícios para o MODO DEMONSTRAÇÃO (rodam só na memória do navegador, nunca no banco). */
import { PRODUTOS_INICIAIS, SERVICOS_INICIAIS } from "./config.ts";
import { inicioDia, somarDias } from "./datas.ts";
import { extraPadrao, precoServ } from "./usuarios.ts";

export const USUARIOS_DEMO = [
  { id: "demo-dono", nome: "Gustavo", email: "dono@demo.zure", role: "admin", ativo: true, ...extraPadrao("admin", 65) },
  { id: "demo-gabriel", nome: "Gabriel", email: "gabriel@demo.zure", role: "barbeiro", ativo: true, ...extraPadrao("barbeiro", 60) },
  { id: "demo-nathanael", nome: "Nathanael", email: "nathanael@demo.zure", role: "barbeiro", ativo: true, ...extraPadrao("barbeiro", 45) },
];

const NOMES = [
  "João Silva",
  "Pedro Alves",
  "Lucas Souza",
  "Rafael Lima",
  "Carlos Mendes",
  "Bruno Costa",
  "Felipe Rocha",
  "Marcos Dias",
  "Thiago Nunes",
  "André Pires",
  "Diego Martins",
  "Gustavo Ramos",
  "Leandro Gomes",
  "Rodrigo Teixeira",
  "Vinicius Araújo",
  "Eduardo Barros",
  "Matheus Cardoso",
  "Henrique Lopes",
];

/** Gerador pseudoaleatório determinístico (mesma semente = mesmos dados; bom para testes). */
export function aleatorio(semente = 42) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gerarDemo(users = USUARIOS_DEMO, { agora = Date.now(), dias = 60, semente = 42 } = {}) {
  const rand = aleatorio(semente);
  let seq = 0;
  const id = (p) => `${p}-${(seq++).toString(36)}`;
  const clientes = NOMES.map((n, i) => ({
    id: id("cli"),
    nome: n,
    telefone: `11900001${String(100 + i)}`,
    criadoEm: somarDias(agora, -dias),
  }));
  const rnd = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const volume = [3, 7, 5];
  const sv = (sid) => SERVICOS_INICIAIS.find((s) => s.id === sid);
  const pr = (pid) => PRODUTOS_INICIAIS.find((p) => p.id === pid);
  const lancs = [];

  for (let d = dias - 1; d >= 0; d--) {
    const base = somarDias(inicioDia(agora), -d);
    if (new Date(base).getDay() === 0) continue;
    users.forEach((u, idx) => {
      const n = (volume[idx] ?? 4) + rnd(0, 3);
      for (let k = 0; k < n; k++) {
        const ts = Math.round(base + (9 + rand() * 10) * 3600000);
        if (ts > agora) continue;
        const pool = clientes.filter((_, i) => (d < 40 ? i < 15 : true));
        const doBarbeiro = pool.filter((c) => clientes.indexOf(c) % users.length === idx);
        const cli = rand() < 0.8 && doBarbeiro.length ? pick(doBarbeiro) : pick(pool);
        const r = rand();
        const itens = [];
        const addServ = (sid) => {
          const s = sv(sid);
          itens.push({ tipo: "servico", id: sid, nome: s.nome, qtd: 1, preco: precoServ(u, s), custo: 0 });
        };
        if (r < 0.55) {
          addServ("corte");
          if (rand() < 0.15) addServ("barba");
        } else if (r < 0.75) addServ("combo");
        else if (r < 0.87) addServ("barba");
        else if (r < 0.94) addServ("sobrancelha");
        else addServ("pigmentacao");
        if (rand() < 0.2) {
          const p = pr(pick(["cerveja", "cerveja", "cerveja", "agua", "pomada", "shampoo", "oleo"]));
          itens.push({ tipo: "produto", id: p.id, nome: p.nome, qtd: p.id === "cerveja" ? rnd(1, 2) : 1, preco: p.preco, custo: p.custo });
        }
        const subtotal = itens.reduce((a, i) => a + i.preco * i.qtd, 0);
        const gorjeta = rand() < 0.2 ? pick([5, 10]) : 0;
        const total = subtotal + gorjeta;
        const rf = rand();
        let pagamentos: { forma: string; valor: number }[];
        let fiado = false;
        let pago = true;
        let pagoEm = ts;
        if (rf < 0.06) {
          fiado = true;
          if (rand() < 0.55 && somarDias(ts, 3) < agora) {
            pagoEm = Math.min(somarDias(ts, rnd(1, 10)), agora);
            pagamentos = [{ forma: "PIX", valor: total }];
          } else {
            pago = false;
            pagoEm = null;
            pagamentos = [{ forma: "FIADO", valor: total }];
          }
        } else if (rf < 0.14) {
          const metade = Math.round(total / 2);
          pagamentos = [
            { forma: "PIX", valor: metade },
            { forma: "CARTAO", valor: total - metade },
          ];
        } else {
          let forma = "DINHEIRO";
          if (rf < 0.55) forma = "PIX";
          else if (rf < 0.85) forma = "CARTAO";
          pagamentos = [{ forma, valor: total }];
        }
        lancs.push({
          id: id("l"),
          ts,
          barbeiroId: u.id,
          barbeiroNome: u.nome,
          lancadoPorId: u.id,
          lancadoPorNome: u.nome,
          clienteId: cli.id,
          clienteNome: cli.nome,
          itens,
          subtotal,
          gorjeta,
          total,
          pagamentos,
          fiado,
          pago,
          pagoEm,
          comprovante: null,
        });
      }
    });
  }
  const avaliacoes = [5, 5, 4, 5, 2, 3, 5].map((nota, i) => ({
    id: id("av"),
    clienteId: clientes[i].id,
    nota,
    ts: somarDias(agora, -i),
  }));
  return { clientes, lancamentos: lancs.sort((a, b) => b.ts - a.ts), avaliacoes };
}
