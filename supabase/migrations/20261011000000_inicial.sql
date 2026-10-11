-- =====================================================================
-- Zure Barbearia · esquema inicial
-- Tudo protegido por RLS. Escritas sensíveis (lançamentos, ponto, caixa,
-- estoque) só por funções que validam o usuário no servidor.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Perfis e convites
-- ---------------------------------------------------------------------
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'barbeiro')),
  ativo boolean not null default true,
  extra jsonb not null default '{}'::jsonb, -- entrada, precos, metas, plano, foto
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Só e-mails convidados pelo dono conseguem criar conta.
create table public.convites (
  email text primary key check (email = lower(email)),
  nome text not null,
  role text not null default 'barbeiro' check (role in ('admin', 'barbeiro')),
  extra jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  usado_em timestamptz
);

create or replace function public.eh_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo)
$$;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo and role = 'admin')
$$;

create or replace function public.hoje_sp() returns date
language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

create or replace function public.ao_criar_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c convites%rowtype;
begin
  select * into c from convites where email = lower(new.email) and usado_em is null;
  if not found then
    raise exception 'CADASTRO_NAO_AUTORIZADO';
  end if;
  insert into perfis (id, nome, email, role, extra)
  values (new.id, c.nome, lower(new.email), c.role, c.extra);
  update convites set usado_em = now() where email = c.email;
  return new;
end $$;

create trigger ao_criar_usuario
after insert on auth.users
for each row execute function public.ao_criar_usuario();

-- ---------------------------------------------------------------------
-- Configuração (pública = todos leem; privada = só o dono)
-- ---------------------------------------------------------------------
create table public.config (
  id int primary key default 1 check (id = 1),
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);
create table public.config_privada (
  id int primary key default 1 check (id = 1),
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);
insert into public.config (id) values (1);
insert into public.config_privada (id) values (1);

create table public.produtos (
  id text primary key,
  nome text not null,
  custo numeric(10, 2) not null default 0 check (custo >= 0),
  preco numeric(10, 2) not null default 0 check (preco >= 0),
  estoque int not null default 0 check (estoque >= 0),
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
insert into public.produtos (id, nome, custo, preco, estoque, ordem) values
  ('pomada', 'POMADA', 25, 60, 10, 1),
  ('shampoo', 'SHAMPOO', 30, 70, 8, 2),
  ('oleo', 'ÓLEO', 20, 55, 8, 3),
  ('cerveja', 'CERVEJA', 2.5, 6, 24, 4),
  ('agua', 'ÁGUA', 1, 3, 24, 5);

-- ---------------------------------------------------------------------
-- Operação
-- ---------------------------------------------------------------------
create table public.clientes (
  id text primary key,
  nome text not null check (length(trim(nome)) > 0),
  telefone text not null default '',
  foto_antes text,
  foto_depois text,
  criado_em timestamptz not null default now(),
  criado_por uuid references public.perfis (id)
);

create table public.lancamentos (
  id text primary key,
  ts timestamptz not null default now(),
  barbeiro_id uuid not null references public.perfis (id),
  barbeiro_nome text not null,
  lancado_por uuid not null references public.perfis (id),
  lancado_por_nome text not null,
  cliente_id text references public.clientes (id),
  cliente_nome text not null,
  itens jsonb not null,
  subtotal numeric(10, 2) not null,
  gorjeta numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  pagamentos jsonb not null,
  fiado boolean not null default false,
  pago boolean not null default true,
  pago_em timestamptz,
  comprovante text,
  editado_em timestamptz,
  editado_por uuid references public.perfis (id),
  excluido_em timestamptz,
  excluido_por uuid references public.perfis (id),
  motivo_exclusao text
);
create index lancamentos_barbeiro_ts on public.lancamentos (barbeiro_id, ts desc);
create index lancamentos_lancado_por on public.lancamentos (lancado_por);
create index lancamentos_ts on public.lancamentos (ts desc);

create table public.saques (
  id text primary key,
  barbeiro_id uuid not null references public.perfis (id),
  nome text not null,
  valor numeric(10, 2) not null check (valor > 0),
  ts timestamptz not null default now(),
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'recusado')),
  periodos jsonb not null default '[]'::jsonb, -- [{semana, rotulo, valor}]
  resolvido_em timestamptz,
  resolvido_por uuid references public.perfis (id)
);

create table public.pontos (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.perfis (id),
  dia date not null,
  ts timestamptz not null default now(),
  unique (user_id, dia)
);

create table public.fechamentos (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.perfis (id),
  nome text not null,
  dia date not null,
  ts timestamptz not null default now(),
  informado jsonb not null,
  esperado jsonb not null,
  unique (user_id, dia)
);

create table public.avaliacoes (
  id text primary key,
  cliente_id text not null references public.clientes (id),
  nota int not null check (nota between 1 and 5),
  ts timestamptz not null default now()
);

create table public.ferias (
  id text primary key,
  user_id uuid not null references public.perfis (id),
  ini date not null,
  fim date not null check (fim >= ini),
  criado_em timestamptz not null default now()
);

create table public.meses_fechados (
  mk text primary key,
  ts timestamptz not null default now(),
  fat numeric(12, 2) not null,
  lucro numeric(12, 2) not null,
  atend int not null
);

-- ---------------------------------------------------------------------
-- Auditoria (quem fez o quê). Só o dono lê; ninguém escreve direto.
-- ---------------------------------------------------------------------
create table public.auditoria (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  usuario_id uuid,
  usuario_nome text,
  tabela text not null,
  registro_id text,
  acao text not null,
  antes jsonb,
  depois jsonb
);
create index auditoria_ts on public.auditoria (ts desc);

create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  v_acao text := lower(tg_op);
  v_novo jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_velho jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
begin
  select nome into v_nome from perfis where id = auth.uid();
  if tg_table_name = 'lancamentos' then
    if tg_op = 'INSERT' then
      v_acao := case when new.lancado_por <> new.barbeiro_id then 'lancamento_por_outro' else 'lancamento' end;
    elsif old.excluido_em is null and new.excluido_em is not null then v_acao := 'exclusao';
    elsif old.excluido_em is not null and new.excluido_em is null then v_acao := 'restauracao';
    elsif not old.pago and new.pago then v_acao := 'pagamento_fiado';
    else v_acao := 'edicao';
    end if;
  end if;
  insert into auditoria (usuario_id, usuario_nome, tabela, registro_id, acao, antes, depois)
  values (auth.uid(), v_nome, tg_table_name, coalesce(v_novo ->> 'id', v_velho ->> 'id', v_novo ->> 'mk', v_novo ->> 'email', v_velho ->> 'email'), v_acao, v_velho, v_novo);
  return coalesce(new, old);
end $$;

create trigger auditar after insert or update on public.lancamentos for each row execute function public.auditar();
create trigger auditar after insert or update on public.saques for each row execute function public.auditar();
create trigger auditar after update on public.perfis for each row execute function public.auditar();
create trigger auditar after insert or update or delete on public.convites for each row execute function public.auditar();
create trigger auditar after update on public.config for each row execute function public.auditar();
create trigger auditar after update on public.config_privada for each row execute function public.auditar();
create trigger auditar after insert or update on public.clientes for each row execute function public.auditar();
create trigger auditar after insert or delete on public.ferias for each row execute function public.auditar();
create trigger auditar_insert after insert on public.produtos for each row execute function public.auditar();
-- Baixa de estoque por venda não polui o histórico; mudança de cadastro sim.
create trigger auditar_update after update on public.produtos for each row
  when (old.nome is distinct from new.nome or old.custo is distinct from new.custo
        or old.preco is distinct from new.preco or old.ativo is distinct from new.ativo)
  execute function public.auditar();

-- ---------------------------------------------------------------------
-- Funções de negócio
-- ---------------------------------------------------------------------
create or replace function public._mover_estoque(p_itens jsonb, p_sinal int) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
begin
  for v_item in select * from jsonb_array_elements(p_itens) loop
    if v_item ->> 'tipo' = 'produto' then
      update produtos
         set estoque = greatest(0, estoque + p_sinal * (v_item ->> 'qtd')::int)
       where id = v_item ->> 'id';
    end if;
  end loop;
end $$;

-- Recalcula subtotal/total no servidor e valida itens e pagamentos.
create or replace function public._normalizar_lancamento(p jsonb, p_pendente boolean)
returns table (itens jsonb, subtotal numeric, gorjeta numeric, total numeric, pagamentos jsonb)
language plpgsql immutable as $$
declare
  v_item jsonb;
  v_pg jsonb;
  v_sub numeric := 0;
  v_pag numeric := 0;
begin
  if jsonb_typeof(p -> 'itens') is distinct from 'array' or jsonb_array_length(p -> 'itens') = 0 then
    raise exception 'LANCAMENTO_SEM_ITENS';
  end if;
  for v_item in select * from jsonb_array_elements(p -> 'itens') loop
    if (v_item ->> 'tipo') not in ('servico', 'produto')
       or coalesce((v_item ->> 'qtd')::int, 0) <= 0
       or coalesce((v_item ->> 'preco')::numeric, -1) < 0 then
      raise exception 'ITEM_INVALIDO';
    end if;
    v_sub := v_sub + (v_item ->> 'preco')::numeric * (v_item ->> 'qtd')::int;
  end loop;
  itens := p -> 'itens';
  subtotal := round(v_sub, 2);
  gorjeta := round(greatest(0, coalesce((p ->> 'gorjeta')::numeric, 0)), 2);
  total := subtotal + gorjeta;
  if p_pendente then
    pagamentos := jsonb_build_array(jsonb_build_object('forma', 'FIADO', 'valor', total));
  else
    if jsonb_typeof(p -> 'pagamentos') is distinct from 'array' or jsonb_array_length(p -> 'pagamentos') = 0 then
      raise exception 'PAGAMENTO_INVALIDO';
    end if;
    for v_pg in select * from jsonb_array_elements(p -> 'pagamentos') loop
      if (v_pg ->> 'forma') not in ('PIX', 'DINHEIRO', 'CARTAO') or (v_pg ->> 'valor')::numeric < 0 then
        raise exception 'PAGAMENTO_INVALIDO';
      end if;
      v_pag := v_pag + (v_pg ->> 'valor')::numeric;
    end loop;
    if abs(v_pag - total) > 0.01 then
      raise exception 'PAGAMENTO_NAO_BATE';
    end if;
    pagamentos := p -> 'pagamentos';
  end if;
  return next;
end $$;

create or replace function public.registrar_lancamento(p jsonb) returns public.lancamentos
language plpgsql security definer set search_path = public as $$
declare
  v_user perfis%rowtype;
  v_barb perfis%rowtype;
  v_fiado boolean := coalesce((p ->> 'fiado')::boolean, false);
  n record;
  r lancamentos%rowtype;
begin
  select * into v_user from perfis where id = auth.uid() and ativo;
  if not found then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  select * into v_barb from perfis where id = (p ->> 'barbeiro_id')::uuid and ativo;
  if not found then raise exception 'BARBEIRO_INVALIDO'; end if;
  if v_fiado and nullif(p ->> 'cliente_id', '') is null then raise exception 'FIADO_SEM_CLIENTE'; end if;
  select * into n from _normalizar_lancamento(p, v_fiado);
  insert into lancamentos (id, ts, barbeiro_id, barbeiro_nome, lancado_por, lancado_por_nome, cliente_id, cliente_nome,
                           itens, subtotal, gorjeta, total, pagamentos, fiado, pago, pago_em, comprovante)
  values (coalesce(nullif(p ->> 'id', ''), gen_random_uuid()::text), now(), v_barb.id, v_barb.nome, v_user.id, v_user.nome,
          nullif(p ->> 'cliente_id', ''), coalesce(nullif(p ->> 'cliente_nome', ''), 'Cliente avulso'),
          n.itens, n.subtotal, n.gorjeta, n.total, n.pagamentos, v_fiado, not v_fiado,
          case when v_fiado then null else now() end, nullif(p ->> 'comprovante', ''))
  returning * into r;
  perform _mover_estoque(r.itens, -1);
  return r;
end $$;

-- Só o dono corrige lançamentos. Estoque é ajustado pela diferença.
create or replace function public.editar_lancamento(p_id text, p jsonb) returns public.lancamentos
language plpgsql security definer set search_path = public as $$
declare
  v_old lancamentos%rowtype;
  v_barb perfis%rowtype;
  v_fiado boolean := coalesce((p ->> 'fiado')::boolean, false);
  v_pago boolean := coalesce((p ->> 'pago')::boolean, not v_fiado);
  v_ts timestamptz;
  n record;
  r lancamentos%rowtype;
begin
  if not eh_admin() then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  select * into v_old from lancamentos where id = p_id for update;
  if not found then raise exception 'LANCAMENTO_NAO_ENCONTRADO'; end if;
  if v_old.excluido_em is not null then raise exception 'LANCAMENTO_EXCLUIDO'; end if;
  select * into v_barb from perfis where id = coalesce((p ->> 'barbeiro_id')::uuid, v_old.barbeiro_id);
  if not found then raise exception 'BARBEIRO_INVALIDO'; end if;
  if v_fiado and not v_pago and nullif(p ->> 'cliente_id', '') is null then raise exception 'FIADO_SEM_CLIENTE'; end if;
  v_ts := coalesce((p ->> 'ts')::timestamptz, v_old.ts);
  select * into n from _normalizar_lancamento(p, v_fiado and not v_pago);
  perform _mover_estoque(v_old.itens, 1);
  update lancamentos set
    ts = v_ts,
    barbeiro_id = v_barb.id,
    barbeiro_nome = v_barb.nome,
    cliente_id = nullif(p ->> 'cliente_id', ''),
    cliente_nome = coalesce(nullif(p ->> 'cliente_nome', ''), 'Cliente avulso'),
    itens = n.itens,
    subtotal = n.subtotal,
    gorjeta = n.gorjeta,
    total = n.total,
    pagamentos = n.pagamentos,
    fiado = v_fiado,
    pago = v_pago,
    pago_em = case when not v_pago then null else coalesce(v_old.pago_em, v_ts) end,
    editado_em = now(),
    editado_por = auth.uid()
  where id = p_id
  returning * into r;
  perform _mover_estoque(r.itens, -1);
  return r;
end $$;

create or replace function public._pode_excluir(r public.lancamentos) returns boolean
language sql stable security definer set search_path = public as $$
  select eh_admin()
      or (eh_ativo()
          and (r.barbeiro_id = auth.uid() or r.lancado_por = auth.uid())
          and (r.ts at time zone 'America/Sao_Paulo')::date = hoje_sp())
$$;

-- Exclusão é lógica (some das contas, mas fica no histórico e pode ser desfeita).
create or replace function public.excluir_lancamento(p_id text, p_motivo text default null) returns public.lancamentos
language plpgsql security definer set search_path = public as $$
declare
  r lancamentos%rowtype;
begin
  select * into r from lancamentos where id = p_id for update;
  if not found then raise exception 'LANCAMENTO_NAO_ENCONTRADO'; end if;
  if not _pode_excluir(r) then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  if r.excluido_em is not null then return r; end if;
  update lancamentos
     set excluido_em = now(), excluido_por = auth.uid(), motivo_exclusao = nullif(trim(p_motivo), '')
   where id = p_id
  returning * into r;
  perform _mover_estoque(r.itens, 1);
  return r;
end $$;

create or replace function public.restaurar_lancamento(p_id text) returns public.lancamentos
language plpgsql security definer set search_path = public as $$
declare
  r lancamentos%rowtype;
begin
  select * into r from lancamentos where id = p_id for update;
  if not found then raise exception 'LANCAMENTO_NAO_ENCONTRADO'; end if;
  if not _pode_excluir(r) then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  if r.excluido_em is null then return r; end if;
  update lancamentos set excluido_em = null, excluido_por = null, motivo_exclusao = null
   where id = p_id
  returning * into r;
  perform _mover_estoque(r.itens, -1);
  return r;
end $$;

create or replace function public.pagar_fiado(p_id text, p_forma text) returns public.lancamentos
language plpgsql security definer set search_path = public as $$
declare
  r lancamentos%rowtype;
begin
  if not eh_admin() then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  if p_forma not in ('PIX', 'DINHEIRO', 'CARTAO') then raise exception 'PAGAMENTO_INVALIDO'; end if;
  update lancamentos
     set pago = true, pago_em = now(),
         pagamentos = jsonb_build_array(jsonb_build_object('forma', p_forma, 'valor', total))
   where id = p_id and fiado and not pago and excluido_em is null
  returning * into r;
  if not found then raise exception 'FIADO_NAO_ENCONTRADO'; end if;
  return r;
end $$;

-- Horário do ponto vem do servidor (não dá para "adiantar" o relógio do celular).
create or replace function public.registrar_ponto() returns public.pontos
language plpgsql security definer set search_path = public as $$
declare
  r pontos%rowtype;
begin
  if not eh_ativo() then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  insert into pontos (user_id, dia) values (auth.uid(), hoje_sp())
  on conflict (user_id, dia) do nothing;
  select * into r from pontos where user_id = auth.uid() and dia = hoje_sp();
  return r;
end $$;

-- Caixa cego: o valor esperado é calculado no servidor.
create or replace function public.fechar_caixa(p_informado jsonb) returns public.fechamentos
language plpgsql security definer set search_path = public as $$
declare
  v_user perfis%rowtype;
  v_esp jsonb;
  r fechamentos%rowtype;
begin
  select * into v_user from perfis where id = auth.uid() and ativo;
  if not found then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  select jsonb_build_object(
           'PIX', coalesce(sum((pg ->> 'valor')::numeric) filter (where pg ->> 'forma' = 'PIX'), 0),
           'DINHEIRO', coalesce(sum((pg ->> 'valor')::numeric) filter (where pg ->> 'forma' = 'DINHEIRO'), 0),
           'CARTAO', coalesce(sum((pg ->> 'valor')::numeric) filter (where pg ->> 'forma' = 'CARTAO'), 0))
    into v_esp
    from lancamentos l, jsonb_array_elements(l.pagamentos) pg
   where l.barbeiro_id = auth.uid() and l.pago and l.excluido_em is null
     and (coalesce(l.pago_em, l.ts) at time zone 'America/Sao_Paulo')::date = hoje_sp();
  insert into fechamentos (user_id, nome, dia, informado, esperado)
  values (auth.uid(), v_user.nome, hoje_sp(),
          jsonb_build_object('PIX', coalesce((p_informado ->> 'PIX')::numeric, 0),
                             'DINHEIRO', coalesce((p_informado ->> 'DINHEIRO')::numeric, 0),
                             'CARTAO', coalesce((p_informado ->> 'CARTAO')::numeric, 0)),
          coalesce(v_esp, '{"PIX":0,"DINHEIRO":0,"CARTAO":0}'::jsonb))
  returning * into r;
  return r;
end $$;

create or replace function public.entrada_estoque(p_id text, p_qtd int) returns public.produtos
language plpgsql security definer set search_path = public as $$
declare
  r produtos%rowtype;
begin
  if not eh_admin() then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  if p_qtd is null or p_qtd <= 0 then raise exception 'QUANTIDADE_INVALIDA'; end if;
  update produtos set estoque = estoque + p_qtd where id = p_id returning * into r;
  if not found then raise exception 'PRODUTO_NAO_ENCONTRADO'; end if;
  insert into auditoria (usuario_id, usuario_nome, tabela, registro_id, acao, depois)
  values (auth.uid(), (select nome from perfis where id = auth.uid()), 'produtos', p_id, 'entrada_estoque',
          jsonb_build_object('quantidade', p_qtd, 'estoque', r.estoque));
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Permissões (RLS)
-- ---------------------------------------------------------------------
alter table public.perfis enable row level security;
alter table public.convites enable row level security;
alter table public.config enable row level security;
alter table public.config_privada enable row level security;
alter table public.produtos enable row level security;
alter table public.clientes enable row level security;
alter table public.lancamentos enable row level security;
alter table public.saques enable row level security;
alter table public.pontos enable row level security;
alter table public.fechamentos enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.ferias enable row level security;
alter table public.meses_fechados enable row level security;
alter table public.auditoria enable row level security;

create policy perfis_ler on public.perfis for select to authenticated using (eh_ativo() or id = auth.uid());
create policy perfis_editar on public.perfis for update to authenticated using (eh_admin()) with check (eh_admin());

create policy convites_dono on public.convites for all to authenticated using (eh_admin()) with check (eh_admin());

create policy config_ler on public.config for select to authenticated using (eh_ativo());
create policy config_editar on public.config for update to authenticated using (eh_admin()) with check (eh_admin());
create policy config_privada_dono on public.config_privada for select to authenticated using (eh_admin());
create policy config_privada_editar on public.config_privada for update to authenticated using (eh_admin()) with check (eh_admin());

create policy produtos_ler on public.produtos for select to authenticated using (eh_ativo());
create policy produtos_criar on public.produtos for insert to authenticated with check (eh_admin());
create policy produtos_editar on public.produtos for update to authenticated using (eh_admin()) with check (eh_admin());

create policy clientes_ler on public.clientes for select to authenticated using (eh_ativo());
create policy clientes_criar on public.clientes for insert to authenticated with check (eh_ativo() and criado_por = auth.uid());
create policy clientes_editar on public.clientes for update to authenticated using (eh_admin()) with check (eh_admin());

-- Barbeiro vê só o que atendeu ou lançou. Escrita só pelas funções acima.
create policy lancamentos_ler on public.lancamentos for select to authenticated
  using (eh_admin() or (eh_ativo() and (barbeiro_id = auth.uid() or lancado_por = auth.uid())));

create policy saques_ler on public.saques for select to authenticated using (eh_admin() or (eh_ativo() and barbeiro_id = auth.uid()));
create policy saques_pedir on public.saques for insert to authenticated
  with check (eh_ativo() and barbeiro_id = auth.uid() and status = 'pendente' and resolvido_em is null);
create policy saques_resolver on public.saques for update to authenticated using (eh_admin()) with check (eh_admin());

create policy pontos_ler on public.pontos for select to authenticated using (eh_admin() or (eh_ativo() and user_id = auth.uid()));
create policy fechamentos_ler on public.fechamentos for select to authenticated using (eh_admin() or (eh_ativo() and user_id = auth.uid()));

create policy avaliacoes_dono on public.avaliacoes for all to authenticated using (eh_admin()) with check (eh_admin());
create policy ferias_dono on public.ferias for all to authenticated using (eh_admin()) with check (eh_admin());
create policy meses_dono on public.meses_fechados for all to authenticated using (eh_admin()) with check (eh_admin());
create policy auditoria_dono on public.auditoria for select to authenticated using (eh_admin());

-- ---------------------------------------------------------------------
-- Privilégios: nada para anônimos; funções só para usuários logados.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
revoke all on function public.ao_criar_usuario() from public, anon, authenticated;
revoke all on function public.auditar() from public, anon, authenticated;
revoke all on function public._mover_estoque(jsonb, int) from public, anon, authenticated;
revoke all on function public._normalizar_lancamento(jsonb, boolean) from public, anon;
revoke all on function public._pode_excluir(public.lancamentos) from public, anon;
revoke all on function public.registrar_lancamento(jsonb) from public, anon;
revoke all on function public.editar_lancamento(text, jsonb) from public, anon;
revoke all on function public.excluir_lancamento(text, text) from public, anon;
revoke all on function public.restaurar_lancamento(text) from public, anon;
revoke all on function public.pagar_fiado(text, text) from public, anon;
revoke all on function public.registrar_ponto() from public, anon;
revoke all on function public.fechar_caixa(jsonb) from public, anon;
revoke all on function public.entrada_estoque(text, int) from public, anon;
grant execute on function public.registrar_lancamento(jsonb) to authenticated;
grant execute on function public.editar_lancamento(text, jsonb) to authenticated;
grant execute on function public.excluir_lancamento(text, text) to authenticated;
grant execute on function public.restaurar_lancamento(text) to authenticated;
grant execute on function public.pagar_fiado(text, text) to authenticated;
grant execute on function public.registrar_ponto() to authenticated;
grant execute on function public.fechar_caixa(jsonb) to authenticated;
grant execute on function public.entrada_estoque(text, int) to authenticated;

-- ---------------------------------------------------------------------
-- Fotos (comprovantes, antes/depois, avatar) em bucket privado
-- Caminhos: <uid>/... (quem enviou) · clientes/... e perfis/... (dono)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy fotos_ler on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (public.eh_admin()
         or (public.eh_ativo() and ((storage.foldername(name))[1] = auth.uid()::text or (storage.foldername(name))[1] = 'perfis'))));
create policy fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (public.eh_admin()
              or (public.eh_ativo() and (storage.foldername(name))[1] = auth.uid()::text)));
create policy fotos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.eh_admin());

-- ---------------------------------------------------------------------
-- Tempo real (o que um lança aparece para os outros na hora)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table
  public.perfis, public.convites, public.config, public.config_privada, public.produtos, public.clientes,
  public.lancamentos, public.saques, public.pontos, public.fechamentos, public.avaliacoes, public.ferias,
  public.meses_fechados;
