/* ============================================================================
   LUMI - Relatorio de alta do seguimento
   Migracao 020 - executar no SQL Editor do Supabase

   Nao confundir com o Formulario de Alta, que ja existe: esse e da alta
   HOSPITALAR e e a porta de ENTRADA na plataforma. Este e a SAIDA - fecha o
   acompanhamento em telessaude e consolida o percurso todo: quantas consultas
   houve, como evoluiram os PROMs do principio ao fim, que objetivos ficaram
   cumpridos, e o que o doente deve fazer a partir daqui.

   A maior parte do conteudo nao se escreve: calcula-se do que ja esta
   gravado. O que fica em "dados" e o que so uma pessoa pode escrever - a
   leitura clinica da evolucao, e o resumo em linguagem simples para o doente.

   Em "resumo" guarda-se a fotografia dos numeros no dia da emissao. Se o
   doente responder a mais um questionario no mes seguinte, o relatorio
   continua a dizer o que dizia quando foi emitido - um documento que se
   altera sozinho depois de assinado nao e um documento.
   ============================================================================ */

create table if not exists altas_seguimento (
  id                 uuid primary key default gen_random_uuid(),
  doente_id          uuid not null references doentes(id) on delete cascade,

  data_admissao      date,
  data_alta          date,
  profissional_id    uuid references auth.users(id),
  profissional_nome  text not null,

  dados              jsonb not null default '{}'::jsonb,
  resumo             jsonb,

  estado             text not null default 'rascunho'
                     check (estado in ('rascunho','emitida')),
  emitida_em         timestamptz,

  criado_em          timestamptz default now(),
  atualizado_em      timestamptz default now()
);

comment on table altas_seguimento is
  'Relatorio final do acompanhamento em telessaude. Em rascunho e da equipa; emitido, fica visivel ao doente.';
comment on column altas_seguimento.resumo is
  'Numeros calculados no dia da emissao: consultas, PROMs inicial e final, objetivos. Nao se recalcula depois.';

create index if not exists altas_seguimento_doente_idx
  on altas_seguimento (doente_id, criado_em desc);

/* ---------------------------------------------------------------------------
   REGRAS DE ACESSO
   Como nas consultas: o doente so ve o que estiver emitido, e a condicao
   esta na politica e nao no codigo da pagina.
   --------------------------------------------------------------------------- */
alter table altas_seguimento enable row level security;

drop policy if exists "profissionais criam altas de seguimento" on altas_seguimento;
create policy "profissionais criam altas de seguimento" on altas_seguimento
  for insert with check (is_profissional() and profissional_id = auth.uid());

drop policy if exists "profissionais veem altas de seguimento" on altas_seguimento;
create policy "profissionais veem altas de seguimento" on altas_seguimento
  for select using (is_profissional());

drop policy if exists "profissionais editam altas de seguimento" on altas_seguimento;
create policy "profissionais editam altas de seguimento" on altas_seguimento
  for update using (is_profissional()) with check (is_profissional());

drop policy if exists "doente ve a sua alta emitida" on altas_seguimento;
create policy "doente ve a sua alta emitida" on altas_seguimento
  for select using (doente_id = meu_doente_id() and estado = 'emitida');
