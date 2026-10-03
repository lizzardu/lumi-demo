-- ============================================================================
-- LUMI — Atualizações das metas (updates do doente à sua situação)
-- Migração 007 · executar no SQL Editor do Supabase depois de schema.sql
--
-- Cada meta da jornada passa a ter um fio de atualizações. O doente escreve
-- aqui como está a correr ("já consigo vestir-me sozinha, mas ainda com
-- dificuldade no braço esquerdo") e a equipa responde no mesmo sítio.
--
-- Ao contrário da comunicação da equipa (006), este fio é PARTILHADO:
-- o doente vê tudo o que aqui é escrito. Nunca escrever aqui notas
-- internas — para isso existe a tabela comunicacoes_equipa.
-- ============================================================================

create table metas_atualizacoes (
  id            uuid primary key default gen_random_uuid(),
  meta_id       uuid not null references metas(id) on delete cascade,
  doente_id     uuid not null references doentes(id) on delete cascade,
  autor_papel   text not null check (autor_papel in ('doente','profissional')),
  autor_nome    text not null,   -- gravado no momento, para o histórico continuar legível
  texto         text not null,
  criado_em     timestamptz default now()
);

comment on table metas_atualizacoes is
  'Fio de atualizações de cada meta da jornada, escrito pelo doente e pela equipa. Visível para ambos os lados. Histórico imutável.';

-- doente_id está repetido aqui de propósito (já está em metas), para as
-- regras de acesso abaixo não precisarem de "join" — mesmo padrão de
-- plano_registos no schema.sql.
create index metas_atualizacoes_meta_idx
  on metas_atualizacoes (meta_id, criado_em);

-- ---------------------------------------------------------------------------
-- REGRAS DE ACESSO
-- Sem política de UPDATE nem de DELETE, de propósito: o histórico das
-- atualizações é imutável.
-- ---------------------------------------------------------------------------
alter table metas_atualizacoes enable row level security;

create policy "leitura das atualizacoes por ambos" on metas_atualizacoes
  for select using (is_profissional() or doente_id = meu_doente_id());

create policy "doente escreve as suas atualizacoes" on metas_atualizacoes
  for insert with check (doente_id = meu_doente_id() and autor_papel = 'doente');

create policy "profissionais respondem as atualizacoes" on metas_atualizacoes
  for insert with check (is_profissional() and autor_papel = 'profissional');
