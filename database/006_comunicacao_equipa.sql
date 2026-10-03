-- ============================================================================
-- LUMI — Comunicação da equipa (notas internas por doente)
-- Migração 006 · executar no SQL Editor do Supabase depois de schema.sql
--
-- Espaço reservado à equipa clínica na ficha do doente (doente.html da área
-- profissional). Cada profissional deixa aqui informação relevante para os
-- restantes elementos da equipa; todas as entradas ficam registadas, em
-- histórico, com autor e data/hora.
--
-- IMPORTANTE: esta informação NUNCA é visível para o doente nem para o
-- familiar. Isso não depende do que a página mostra — é garantido pelas
-- regras de acesso (RLS) no fundo deste ficheiro, que só deixam ler e
-- escrever a quem tem papel = 'profissional'.
-- ============================================================================

create table comunicacoes_equipa (
  id                   uuid primary key default gen_random_uuid(),
  doente_id            uuid not null references doentes(id) on delete cascade,
  autor_id             uuid references auth.users(id),
  autor_nome           text not null,   -- guardado no momento do registo, para o
  autor_especialidade  text,            -- histórico continuar legível no futuro
  categoria            text,            -- ex.: 'Enfermagem', 'Fisioterapia', 'Geral'
  mensagem             text not null,
  criado_em            timestamptz default now()
);

comment on table comunicacoes_equipa is
  'Notas internas trocadas entre profissionais sobre um doente. Histórico apenas de leitura/adição — não é editável nem apagável, para preservar o registo das interações. Invisível para contas de doente/familiar.';

create index comunicacoes_equipa_doente_idx
  on comunicacoes_equipa (doente_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- REGRAS DE ACESSO — só profissionais. Não há política de UPDATE nem de
-- DELETE de propósito: sem política, o Postgres recusa a operação, o que
-- torna o histórico imutável.
-- ---------------------------------------------------------------------------
alter table comunicacoes_equipa enable row level security;

create policy "profissionais veem a comunicacao da equipa" on comunicacoes_equipa
  for select using (is_profissional());

create policy "profissionais registam comunicacao da equipa" on comunicacoes_equipa
  for insert with check (is_profissional() and autor_id = auth.uid());
