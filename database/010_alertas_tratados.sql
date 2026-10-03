-- ============================================================================
-- LUMI — Registo dos alertas dados como tratados
-- Migração 010 · executar no SQL Editor do Supabase depois da 009
--
-- Até aqui, um alerta de humor ficava visível até o doente responder outro
-- check-in. Não havia forma de a equipa assinalar que já tinha agido, nem
-- registo de quem agiu e quando.
--
-- Esta tabela guarda esse registo. É também o que torna mensurável o tempo
-- entre a deteção e a intervenção — um dos indicadores de processo do
-- projeto.
--
-- O alerta é identificado pelo registo que lhe deu origem ("referencia"),
-- e não pelo doente: assim que o doente faz um novo check-in, há um novo
-- registo e portanto um novo alerta, que volta a aparecer por tratar. Um
-- alerta tratado nunca "desmarca" os seguintes.
-- ============================================================================

create table alertas_tratados (
  id                uuid primary key default gen_random_uuid(),
  doente_id         uuid not null references doentes(id) on delete cascade,
  tipo              text not null check (tipo in ('humor')),
  referencia        uuid not null,   -- id da linha que originou o alerta
  tratado_por_id    uuid references auth.users(id),
  tratado_por_nome  text not null,   -- gravado no momento, para o histórico
  nota              text,            -- o que foi feito (opcional)
  criado_em         timestamptz default now()
);

comment on table alertas_tratados is
  'Um registo por alerta dado como tratado pela equipa. "referencia" é o id do registo que originou o alerta (ex.: o check-in de humor). Histórico imutável.';

-- Um alerta só pode ser marcado uma vez. Sem isto, dois profissionais a
-- carregar no botão ao mesmo tempo criavam dois registos e o tempo até à
-- intervenção deixava de ser fiável.
create unique index alertas_tratados_unico
  on alertas_tratados (tipo, referencia);

create index alertas_tratados_doente_idx
  on alertas_tratados (doente_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- REGRAS DE ACESSO — só profissionais. Sem políticas de UPDATE nem DELETE,
-- de propósito: o registo de quem tratou o quê, e quando, é imutável.
-- ---------------------------------------------------------------------------
alter table alertas_tratados enable row level security;

create policy "profissionais veem os alertas tratados" on alertas_tratados
  for select using (is_profissional());

create policy "profissionais marcam alertas como tratados" on alertas_tratados
  for insert with check (is_profissional() and tratado_por_id = auth.uid());
