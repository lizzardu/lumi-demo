/* ============================================================================
   LUMI - Consultas de seguimento: agendamento e registo clinico
   Migracao 018 - executar no SQL Editor do Supabase

   Tres coisas nesta migracao:

   1. A tabela "agendamentos" ja existia, mas so sabia dizer quando e onde.
      Passa a saber tambem o que e (presencial ou teleconsulta), quem atende e
      o que o doente precisa de preparar - que e o que falta para a marcacao
      ser util do lado dele.

   2. A tabela "consultas" guarda o registo clinico de cada consulta. Fica em
      rascunho enquanto o profissional escreve, e so passa a visivel para o
      doente quando for dada por concluida. Uma nota clinica a meio nao e
      informacao: e trabalho em curso.

   3. A tabela "consultas_auditoria" regista quem alterou um valor que tinha
      vindo de um questionario respondido pelo doente. Sobrescrever o que o
      doente reportou pode ser clinicamente correto - o doente pode ter-se
      enganado na escala - mas nao pode ser silencioso.
   ============================================================================ */

/* ---------------------------------------------------------------------------
   1. AGENDAMENTOS - colunas novas
   Todas com valor por omissao ou nulas, para as marcacoes que ja existem
   continuarem validas.
   --------------------------------------------------------------------------- */
alter table agendamentos
  add column if not exists tipo text check (tipo in ('presencial','teleconsulta')) default 'presencial',
  add column if not exists profissional_id uuid references auth.users(id),
  add column if not exists profissional_nome text,
  add column if not exists instrucoes text,
  add column if not exists ligacao text;

comment on column agendamentos.instrucoes is
  'O que o doente precisa de saber ou preparar: jejum, trazer pensos, exames a fazer antes.';
comment on column agendamentos.ligacao is
  'Endereco da teleconsulta. Visivel ao doente na sua area.';

/* ---------------------------------------------------------------------------
   2. CONSULTAS - o registo clinico
   As respostas ficam em "dados" (jsonb), pelo mesmo motivo dos formularios de
   alta: os campos vao mudar com a pratica e nao vale a pena uma coluna por
   pergunta. Em coluna propria fica o que e preciso procurar e contar.
   --------------------------------------------------------------------------- */
create table if not exists consultas (
  id                 uuid primary key default gen_random_uuid(),
  doente_id          uuid not null references doentes(id) on delete cascade,
  agendamento_id     uuid references agendamentos(id),

  data_consulta      timestamptz not null default now(),
  tipo               text check (tipo in ('presencial','teleconsulta')),
  profissional_id    uuid references auth.users(id),
  profissional_nome  text not null,
  especialidade      text,

  dados              jsonb not null default '{}'::jsonb,

  /* Fotografia dos PROMs que serviram de base a esta consulta: instrumento,
     valor, data. Guardada aqui de proposito - se o doente responder outra vez
     amanha, o registo continua a mostrar o que o profissional tinha a frente
     no dia, que e o que explica as decisoes tomadas. */
  proms_base         jsonb,

  estado             text not null default 'rascunho'
                     check (estado in ('rascunho','concluida')),
  concluida_em       timestamptz,

  criado_em          timestamptz default now(),
  atualizado_em      timestamptz default now()
);

comment on table consultas is
  'Um registo por consulta realizada. Em rascunho e so da equipa; concluida, fica visivel ao doente.';
comment on column consultas.proms_base is
  'Os PROMs tal como estavam no dia da consulta. Nao se atualiza com respostas posteriores.';

create index if not exists consultas_doente_idx
  on consultas (doente_id, data_consulta desc);
create index if not exists consultas_rascunho_idx
  on consultas (profissional_id) where estado = 'rascunho';

/* ---------------------------------------------------------------------------
   3. AUDITORIA das alteracoes a valores reportados pelo doente
   --------------------------------------------------------------------------- */
create table if not exists consultas_auditoria (
  id              uuid primary key default gen_random_uuid(),
  consulta_id     uuid not null references consultas(id) on delete cascade,
  doente_id       uuid not null references doentes(id) on delete cascade,

  campo           text not null,
  instrumento     text,
  valor_doente    text,
  valor_novo      text,
  motivo          text,

  autor_id        uuid references auth.users(id),
  autor_nome      text not null,
  criado_em       timestamptz default now()
);

comment on table consultas_auditoria is
  'Quem alterou um valor que o doente tinha reportado, o que la estava, e porque. Nao se apaga nem se corrige.';

create index if not exists consultas_auditoria_consulta_idx
  on consultas_auditoria (consulta_id, criado_em);

/* ---------------------------------------------------------------------------
   REGRAS DE ACESSO

   O doente le as suas consultas, mas so as concluidas: a condicao esta na
   propria politica, e nao no codigo da pagina, porque uma politica nao se
   esquece. Nao escreve - o registo clinico e da equipa.

   A auditoria e interna. O doente ve o valor final na sua consulta; nao
   precisa de ver a discussao interna sobre ele, e a equipa precisa de poder
   escrever ali com franqueza.
   --------------------------------------------------------------------------- */
alter table consultas enable row level security;

drop policy if exists "profissionais registam consultas" on consultas;
create policy "profissionais registam consultas" on consultas
  for insert with check (is_profissional() and profissional_id = auth.uid());

drop policy if exists "profissionais veem consultas" on consultas;
create policy "profissionais veem consultas" on consultas
  for select using (is_profissional());

drop policy if exists "profissionais editam consultas" on consultas;
create policy "profissionais editam consultas" on consultas
  for update using (is_profissional()) with check (is_profissional());

drop policy if exists "doente ve as suas consultas concluidas" on consultas;
create policy "doente ve as suas consultas concluidas" on consultas
  for select using (doente_id = meu_doente_id() and estado = 'concluida');

alter table consultas_auditoria enable row level security;

drop policy if exists "profissionais registam auditoria" on consultas_auditoria;
create policy "profissionais registam auditoria" on consultas_auditoria
  for insert with check (is_profissional() and autor_id = auth.uid());

drop policy if exists "profissionais veem auditoria" on consultas_auditoria;
create policy "profissionais veem auditoria" on consultas_auditoria
  for select using (is_profissional());
