/* ============================================================================
   LUMI - Registo do contacto as 72 horas apos a alta
   Migracao 015 - executar no SQL Editor do Supabase

   O primeiro contacto ate 72 horas e o momento em que se confirma se a alta
   correu bem na pratica: se o doente tem medicacao e material em casa, se
   percebeu o plano, e como esta a evoluir. E tambem onde a periodicidade dos
   contactos seguintes e confirmada ou alterada.

   As respostas ficam em "dados" (jsonb), pelo mesmo motivo dos formularios de
   alta: os campos vao mudar com a pratica clinica e nao vale a pena uma coluna
   por pergunta. O que fica em colunas proprias e aquilo sobre que e preciso
   pesquisar e contar: os sinais de alarme e a decisao de prioridade.

   Nota: os comentarios deste ficheiro estao em blocos, e nao em linhas com
   dois travessoes, para que uma quebra de linha acidental durante a copia nao
   transforme metade de uma frase em SQL.
   ============================================================================ */

create table if not exists consultas_72h (
  id                  uuid primary key default gen_random_uuid(),
  doente_id           uuid not null references doentes(id) on delete cascade,
  data_contacto       timestamptz not null default now(),
  realizado_por_id    uuid references auth.users(id),
  realizado_por_nome  text not null,

  dados               jsonb not null default '{}'::jsonb,

  /* Extraidos para coluna porque sao o que se procura depois: quantos
     contactos detetaram sinais de alarme, e quantos mudaram a prioridade. */
  red_flags           boolean not null default false,
  red_flags_lista     text[] default '{}',
  decisao_prioridade  text check (decisao_prioridade in ('manter','aumentar','baixar')),
  prioridade_final    text check (prioridade_final in ('alta','intermedia','baixa')),

  agendamento_id      uuid references agendamentos(id),

  criado_em           timestamptz default now()
);

comment on table consultas_72h is
  'Um registo por contacto realizado ate 72h apos a alta. A coluna dados guarda as respostas; as colunas proprias guardam o que e preciso pesquisar.';
comment on column consultas_72h.red_flags is
  'Verdadeiro se o contacto detetou febre, agravamento local, abertura da ferida ou hemorragia.';
comment on column consultas_72h.agendamento_id is
  'Marcacao criada a partir deste contacto, para aparecer no perfil do doente.';

create index if not exists consultas_72h_doente_idx
  on consultas_72h (doente_id, data_contacto desc);
create index if not exists consultas_72h_red_flags_idx
  on consultas_72h (red_flags) where red_flags;

/* ---------------------------------------------------------------------------
   REGRAS DE ACESSO
   Os profissionais registam e consultam. O doente le o seu proprio registo: e
   a consulta dele, e o que la esta foi respondido por ele. Nao escreve.
   Sem politica de DELETE: um contacto clinico registado nao se apaga.
   --------------------------------------------------------------------------- */
alter table consultas_72h enable row level security;

drop policy if exists "profissionais registam consultas 72h" on consultas_72h;
create policy "profissionais registam consultas 72h" on consultas_72h
  for insert with check (is_profissional() and realizado_por_id = auth.uid());

drop policy if exists "profissionais veem as consultas 72h" on consultas_72h;
create policy "profissionais veem as consultas 72h" on consultas_72h
  for select using (is_profissional());

drop policy if exists "profissionais corrigem consultas 72h" on consultas_72h;
create policy "profissionais corrigem consultas 72h" on consultas_72h
  for update using (is_profissional()) with check (is_profissional());

drop policy if exists "doente ve o seu contacto de 72h" on consultas_72h;
create policy "doente ve o seu contacto de 72h" on consultas_72h
  for select using (doente_id = meu_doente_id());
