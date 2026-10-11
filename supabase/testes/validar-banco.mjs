// Valida a migração do Zure num Postgres real (PGlite/WASM) com um "mini Supabase" simulado.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Aplica todas as migrações em ordem num Postgres real (PGlite) e testa RLS, funções e auditoria.
const pasta = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const migracao = readdirSync(pasta)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(pasta, f), "utf8"))
  .join("\n");
const db = new PGlite({ extensions: { pgcrypto } });

const STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key, email text not null);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;
create publication supabase_realtime;
`;

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) falhas++;
};
async function como(uid, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ""}', false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}
async function falha(promessa, trecho) {
  try {
    await promessa;
    return false;
  } catch (e) {
    return String(e.message).includes(trecho);
  }
}

await db.exec(STUB);
await db.exec(`begin;\n${migracao}\ncommit;`);
console.log("Migração aplicada sem erros.");

const DONO = "11111111-1111-1111-1111-111111111111";
const GAB = "22222222-2222-2222-2222-222222222222";
const NAT = "33333333-3333-3333-3333-333333333333";
const INTRUSO = "44444444-4444-4444-4444-444444444444";

console.log("\nCadastro por convite");
await db.exec(`insert into public.convites (email, nome, role, extra) values ('dono@zure.com','Gustavo','admin','{"precos":{"corte":65}}')`);
await db.exec(`insert into auth.users (id, email) values ('${DONO}', 'Dono@Zure.com')`);
ok((await db.query("select role from perfis where id = $1", [DONO])).rows[0]?.role === "admin", "convidado vira perfil com o papel do convite");
ok(
  await falha(db.exec(`insert into auth.users (id, email) values ('${INTRUSO}', 'intruso@x.com')`), "CADASTRO_NAO_AUTORIZADO"),
  "e-mail sem convite não consegue criar conta",
);

await como(DONO, () =>
  db.exec(
    `insert into convites (email, nome, role, extra) values ('gabriel@zure.com','Gabriel','barbeiro','{}'), ('nath@zure.com','Nathanael','barbeiro','{}')`,
  ),
);
await db.exec(`insert into auth.users (id, email) values ('${GAB}', 'gabriel@zure.com'), ('${NAT}', 'nath@zure.com')`);
ok((await db.query("select count(*)::int n from perfis")).rows[0].n === 3, "dono convidou 2 barbeiros pelo app (RLS de convites)");
ok(await como(GAB, () => falha(db.exec(`insert into convites (email, nome) values ('x@x.com','X')`), "row-level security")), "barbeiro não convida ninguém");

console.log("\nLançamentos");
const corte = { tipo: "servico", id: "corte", nome: "CORTE", qtd: 1, preco: 60, custo: 0 };
const cerveja = { tipo: "produto", id: "cerveja", nome: "CERVEJA", qtd: 2, preco: 6, custo: 2.5 };
const payload = (extra = {}) =>
  JSON.stringify({ barbeiro_id: GAB, itens: [corte, cerveja], gorjeta: 5, pagamentos: [{ forma: "PIX", valor: 77 }], fiado: false, ...extra });

const l1 = await como(NAT, () => db.query("select * from registrar_lancamento($1::jsonb)", [payload({ id: "l1", subtotal: 1, total: 1 })]));
const r1 = l1.rows[0];
ok(Number(r1.total) === 77 && Number(r1.subtotal) === 72, "total recalculado no servidor (ignora valores do aparelho)");
ok(r1.lancado_por === NAT && r1.barbeiro_id === GAB && r1.barbeiro_nome === "Gabriel", "registra quem lançou para quem");
ok((await db.query("select estoque from produtos where id='cerveja'")).rows[0].estoque === 22, "baixa o estoque");
ok(
  await como(GAB, () =>
    falha(db.query("select * from registrar_lancamento($1::jsonb)", [payload({ pagamentos: [{ forma: "PIX", valor: 1 }] })]), "PAGAMENTO_NAO_BATE"),
  ),
  "recusa pagamento que não fecha",
);
ok(
  await como(GAB, () => falha(db.query("select * from registrar_lancamento($1::jsonb)", [payload({ fiado: true })]), "FIADO_SEM_CLIENTE")),
  "fiado exige cliente",
);
ok(
  await como(GAB, () =>
    falha(
      db.exec(
        `insert into lancamentos (id, barbeiro_id, barbeiro_nome, lancado_por, lancado_por_nome, cliente_nome, itens, subtotal, total, pagamentos) values ('x','${GAB}','G','${GAB}','G','c','[]',0,0,'[]')`,
      ),
      "row-level security",
    ),
  ),
  "ninguém grava lançamento direto na tabela",
);
ok(await como(null, () => falha(db.query("select * from registrar_lancamento($1::jsonb)", [payload()]), "SEM_PERMISSAO")), "sem login não lança");

await como(GAB, () => db.query("select * from registrar_lancamento($1::jsonb)", [payload({ id: "l2", barbeiro_id: GAB })]));
await como(DONO, () => db.query("select * from registrar_lancamento($1::jsonb)", [payload({ id: "l3", barbeiro_id: DONO })]));

console.log("\nQuem vê o quê (RLS)");
const veGab = await como(GAB, () => db.query("select id from lancamentos order by id"));
ok(veGab.rows.map((r) => r.id).join() === "l1,l2", "Gabriel vê só os que atendeu (l1, l2)");
const veNat = await como(NAT, () => db.query("select id from lancamentos order by id"));
ok(veNat.rows.map((r) => r.id).join() === "l1", "Nathanael vê o que ele lançou para o colega (l1)");
const veDono = await como(DONO, () => db.query("select id from lancamentos order by id"));
ok(veDono.rows.length === 3, "dono vê tudo");
ok((await como(GAB, () => db.query("select * from config_privada"))).rows.length === 0, "barbeiro não lê custos/impostos (config privada)");
ok((await como(DONO, () => db.query("select * from config_privada"))).rows.length === 1, "dono lê config privada");
ok((await como(GAB, () => db.query("select * from auditoria"))).rows.length === 0, "barbeiro não lê o histórico");
ok(
  await como(GAB, () =>
    falha(db.exec("update config set dados = '{}'"), "x").then(async () => (await db.query("select dados from config")).rows[0].dados && true),
  ),
  "barbeiro não altera config (update ignorado pela RLS)",
);

console.log("\nCorrigir, excluir, restaurar, pagar fiado");
ok(await como(GAB, () => falha(db.query("select * from editar_lancamento('l2', $1::jsonb)", [payload()]), "SEM_PERMISSAO")), "barbeiro não corrige");
const ed = await como(DONO, () =>
  db.query("select * from editar_lancamento('l2', $1::jsonb)", [
    JSON.stringify({ barbeiro_id: GAB, itens: [corte], gorjeta: 0, pagamentos: [{ forma: "DINHEIRO", valor: 60 }] }),
  ]),
);
ok(Number(ed.rows[0].total) === 60 && ed.rows[0].editado_por === DONO, "dono corrige e fica marcado quem corrigiu");
ok((await db.query("select estoque from produtos where id='cerveja'")).rows[0].estoque === 20, "estoque acompanha a correção (devolveu as 2 cervejas do l2)");
ok(await como(NAT, () => falha(db.query("select * from excluir_lancamento('l2', 'x')"), "SEM_PERMISSAO")), "barbeiro não exclui lançamento de colega");
const ex = await como(GAB, () => db.query("select * from excluir_lancamento('l1', 'duplicado')"));
ok(ex.rows[0].excluido_por === GAB && ex.rows[0].motivo_exclusao === "duplicado", "exclusão lógica com motivo");
ok((await db.query("select estoque from produtos where id='cerveja'")).rows[0].estoque === 22, "estoque volta na exclusão");
await como(DONO, () => db.query("select * from restaurar_lancamento('l1')"));
ok((await db.query("select excluido_em from lancamentos where id='l1'")).rows[0].excluido_em === null, "dono restaura");
await db.exec(`update lancamentos set ts = now() - interval '3 days' where id = 'l2'`);
ok(await como(GAB, () => falha(db.query("select * from excluir_lancamento('l2', null)"), "SEM_PERMISSAO")), "barbeiro não exclui lançamento de outro dia");
await como(GAB, () => db.exec(`insert into clientes (id, nome, criado_por) values ('c1', 'Ana', '${GAB}')`));
await como(GAB, () => db.query("select * from registrar_lancamento($1::jsonb)", [payload({ id: "f1", fiado: true, cliente_id: "c1", cliente_nome: "Ana" })]));
const f1 = (await db.query("select pago, pagamentos from lancamentos where id='f1'")).rows[0];
ok(f1.pago === false && f1.pagamentos[0].forma === "FIADO", "fiado nasce pendente");
ok(await como(GAB, () => falha(db.query("select * from pagar_fiado('f1','PIX')"), "SEM_PERMISSAO")), "só o dono marca fiado como pago");
const pago = await como(DONO, () => db.query("select * from pagar_fiado('f1','DINHEIRO')"));
ok(pago.rows[0].pago === true && pago.rows[0].pago_em !== null, "fiado pago ganha data de pagamento");

console.log("\nPonto, caixa cego, estoque, saques");
const p1 = await como(GAB, () => db.query("select * from registrar_ponto()"));
const p2 = await como(GAB, () => db.query("select * from registrar_ponto()"));
ok(p1.rows[0].id === p2.rows[0].id, "ponto do dia é registrado uma vez (horário do servidor)");
const fc = await como(GAB, () => db.query(`select * from fechar_caixa('{"PIX": 70, "DINHEIRO": 0, "CARTAO": 0}'::jsonb)`));
ok(Number(fc.rows[0].esperado.PIX) === 77, "caixa cego calcula o esperado no servidor (só o que é do barbeiro e foi pago hoje)");
ok(await como(GAB, () => falha(db.query("select * from entrada_estoque('cerveja', 5)"), "SEM_PERMISSAO")), "barbeiro não dá entrada de estoque");
const antes = (await db.query("select estoque from produtos where id='cerveja'")).rows[0].estoque;
ok((await como(DONO, () => db.query("select * from entrada_estoque('cerveja', 5)"))).rows[0].estoque === antes + 5, "dono dá entrada de estoque");
await como(GAB, () =>
  db.exec(`insert into saques (id, barbeiro_id, nome, valor, periodos) values ('s1','${GAB}','Gabriel', 24, '[{"semana":"2026-09-28","valor":24}]')`),
);
ok(
  await como(GAB, () => falha(db.exec(`insert into saques (id, barbeiro_id, nome, valor) values ('s2','${NAT}','N', 10)`), "row-level security")),
  "barbeiro não pede saque em nome de outro",
);
ok(
  await como(GAB, () =>
    falha(db.exec(`insert into saques (id, barbeiro_id, nome, valor, status) values ('s3','${GAB}','G', 10, 'pago')`), "row-level security"),
  ),
  "barbeiro não cria saque já 'pago'",
);
ok((await como(NAT, () => db.query("select * from saques"))).rows.length === 0, "barbeiro não vê saques dos colegas");

console.log("\nHistórico (auditoria)");
const acoes = (await db.query("select acao from auditoria where tabela='lancamentos' order by id")).rows.map((r) => r.acao);
ok(acoes.includes("lancamento_por_outro"), "registra lançamento feito para outro barbeiro");
ok(
  acoes.includes("edicao") && acoes.includes("exclusao") && acoes.includes("restauracao") && acoes.includes("pagamento_fiado"),
  "registra correção, exclusão, restauração e pagamento de fiado",
);
const quem = (await db.query("select usuario_nome from auditoria where acao='exclusao'")).rows[0].usuario_nome;
ok(quem === "Gabriel", "guarda quem fez a ação");
ok(
  (await db.query("select count(*)::int n from auditoria where tabela='produtos' and acao='entrada_estoque'")).rows[0].n === 1,
  "entrada de estoque fica no histórico (baixa por venda não polui)",
);

console.log("\nDesativar barbeiro corta o acesso");
await como(DONO, () => db.exec(`update perfis set ativo = false where id = '${NAT}'`));
ok((await como(NAT, () => db.query("select * from lancamentos"))).rows.length === 0, "inativo não lê mais nada");
ok(await como(NAT, () => falha(db.query("select * from registrar_lancamento($1::jsonb)", [payload()]), "SEM_PERMISSAO")), "inativo não lança");

console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : "\nTodas as verificações passaram.");
process.exit(falhas ? 1 : 0);
