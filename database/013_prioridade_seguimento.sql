-- ============================================================================
-- LUMI — Prioridade de seguimento gravada
-- Migração 013 · executar no SQL Editor do Supabase
--
-- A prioridade é calculada a partir do Formulário de Alta e passa a ser
-- gravada no momento em que o formulário é guardado.
--
-- PORQUE FICA NOS DOIS SÍTIOS
-- Em formularios_alta, porque a prioridade pertence àquela versão do
-- formulário: se amanhã os pesos forem recalibrados, o que ficou registado
-- continua a explicar a decisão que a equipa tomou na altura. É o registo
-- clínico do que se sabia no momento.
-- Em doentes, porque a lista de doentes precisa de ordenar e filtrar por
-- prioridade sem ir ler o formulário de cada um.
--
-- A coluna em doentes é sempre reescrita a partir do último formulário
-- gravado, pelo que não pode divergir dele.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. A prioridade daquele formulário, com os fatores que a produziram.
--    Guardar os fatores é o que torna a decisão auditável um ano depois: sem
--    eles ficaria um rótulo sem explicação.
-- ---------------------------------------------------------------------------
alter table formularios_alta
  add column if not exists prioridade              text,
  add column if not exists prioridade_clinico      int,
  add column if not exists prioridade_psicossocial int,
  add column if not exists prioridade_fatores      jsonb;

comment on column formularios_alta.prioridade is
  'Prioridade de seguimento calculada a partir deste formulário: alta, intermedia ou baixa.';
comment on column formularios_alta.prioridade_fatores is
  'Os fatores que contribuíram para a classificação, com o peso de cada um, tal como no momento em que foi calculada.';

-- ---------------------------------------------------------------------------
-- 2. A prioridade atual do doente, para a lista de doentes
-- ---------------------------------------------------------------------------
alter table doentes
  add column if not exists prioridade_seguimento  text,
  add column if not exists prioridade_atualizada_em timestamptz;

comment on column doentes.prioridade_seguimento is
  'Cópia da prioridade do último Formulário de Alta gravado, para a lista de doentes não ter de a recalcular.';

create index if not exists doentes_prioridade_idx on doentes (prioridade_seguimento);

-- ---------------------------------------------------------------------------
-- 3. BURN-OP — instrumento validado (Burns 2024), 23 perguntas ponderadas.
--    Guardado à parte da matriz local porque são coisas diferentes: o
--    BURN-OP é validado e muito específico, a matriz é uma proposta local e
--    mais sensível. Guardar os dois permite compará-los ao longo do piloto,
--    que é exatamente o que valida — ou desmente — a matriz.
-- ---------------------------------------------------------------------------
alter table formularios_alta
  add column if not exists burnop_pontos     int,
  add column if not exists burnop_cluster3   boolean,
  add column if not exists burnop_respondidas int;

comment on column formularios_alta.burnop_pontos is
  'Pontuação BURN-OP (0-77). O limiar publicado para o grupo de maior necessidade é 46.';
comment on column formularios_alta.burnop_respondidas is
  'Quantas das 23 perguntas foram respondidas. Uma pontuação baixa com perguntas em branco não é um resultado negativo.';
