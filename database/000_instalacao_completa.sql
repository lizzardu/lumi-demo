-- ============================================================================
-- LUMI — INSTALAÇÃO COMPLETA, DE UMA SÓ VEZ
-- Unidade de Queimados Pediátricos
-- ============================================================================
--
-- PARA QUE SERVE
-- Correr isto UMA VEZ, num projeto Supabase NOVO E VAZIO, deixa a base de
-- dados pronta. Substitui correr à mão o schema.sql e as dezasseis migrações
-- que vêm a seguir — que é o que está descrito no GUIA-BACKEND.md e continua
-- a ser o caminho para quem já tenha uma base de dados a meio.
--
-- COMO SE CORRE
--   1. Supabase → o seu projeto → SQL Editor → New query
--   2. Colar este ficheiro INTEIRO
--   3. Run
--   4. Deve terminar com uma tabela de verificação. Se aparecer um erro a
--      meio, NÃO volte a correr tudo: diga qual foi, porque a partir daí
--      metade ficou criada e a outra metade não.
--
-- O QUE ISTO NÃO FAZ
--   · Não cria as contas de acesso. Essas criam-se no painel (Authentication
--     → Users) e ligam-se à tabela "perfis" — ver o passo 3 das instruções
--     que acompanham este ficheiro.
--   · Não configura o envio de email. É opcional, precisa dos endereços das
--     Edge Functions deste projeto, e está no fim do ficheiro, comentado.
--
-- ORDEM
-- Os blocos estão pela ordem em que foram escritos, e essa ordem importa: a
-- 012 corrige a 011, a 009 depende da 008, e a 021 acrescenta colunas a
-- tabelas criadas lá atrás. Não os reordene.
-- ============================================================================


-- ============================================================================
-- PASSO 0 — ARMAZENAMENTO DAS FOTOS DAS METAS
-- ----------------------------------------------------------------------------
-- O bucket costuma criar-se no painel (Storage → New bucket). Cria-se aqui
-- por SQL para não haver um passo manual no meio da instalação.
--
-- Se esta linha falhar por falta de permissões — acontece nalguns projetos —
-- crie o bucket "fotos-metas" no painel, marque-o como público, e volte a
-- correr só a partir daqui.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('fotos-metas', 'fotos-metas', true)
on conflict (id) do update set public = true;



-- ============================================================================
-- schema.sql
-- Tabelas base, funções auxiliares e regras de acesso (RLS)
-- ============================================================================

-- ============================================================================
-- LUMI — Esquema da base de dados (Supabase / PostgreSQL)
-- Unidade de Queimados Pediátricos, ULS São José
--
-- Como usar: Supabase → o seu projeto → SQL Editor → colar este ficheiro
-- inteiro → Run. Cria todas as tabelas, ligações e regras de acesso (RLS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensões necessárias (geração de identificadores únicos)
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. DOENTES — dados de identificação e contexto clínico base
-- ---------------------------------------------------------------------------
create table doentes (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  processo          text not null unique,
  data_nascimento   date,
  data_alta         date,
  tbsa              numeric,               -- % superfície corporal queimada
  profundidade      text,
  zona_anatomica    text,
  equipa            text[] default '{}',   -- ex.: {"Cirurgia Plástica","Enfermagem"}
  criado_em         timestamptz default now()
);

comment on table doentes is 'Registo base de cada doente em seguimento pós-alta.';

-- ---------------------------------------------------------------------------
-- 2. PERFIS — liga cada conta de login (auth.users) a um papel
--    (doente ou profissional). É esta tabela que decide o que cada
--    utilizador pode ver, através das políticas RLS mais abaixo.
-- ---------------------------------------------------------------------------
create table perfis (
  id              uuid primary key references auth.users(id) on delete cascade,
  papel           text not null check (papel in ('doente','profissional')),
  nome            text not null,
  doente_id       uuid references doentes(id),   -- preenchido só quando papel = 'doente'
  especialidade   text,                           -- preenchido só quando papel = 'profissional'
  criado_em       timestamptz default now()
);

comment on table perfis is 'Um registo por conta de login: define se é doente/familiar ou profissional, e a que doente fica associado.';

-- ---------------------------------------------------------------------------
-- 3. CONTAS_ACESSO — pedidos de ativação de conta (código de uso único),
--    geridos pela equipa clínica na página "Novo Doente".
-- ---------------------------------------------------------------------------
create table contas_acesso (
  id                  uuid primary key default gen_random_uuid(),
  doente_id           uuid references doentes(id) on delete cascade,
  titular_tipo        text check (titular_tipo in ('proprio','familiar')),
  nome_familiar       text,
  telemovel           text,
  email               text,
  canal_ativacao      text check (canal_ativacao in ('sms','email','ambos')),
  codigo_ativacao     text,              -- em produção: gerar e enviar via Edge Function, nunca expor ao profissional
  codigo_expira_em    timestamptz,
  ativada             boolean default false,
  user_id             uuid references auth.users(id),
  criado_em           timestamptz default now()
);

comment on table contas_acesso is 'Convites de ativação criados pela equipa. O código nunca deve ser lido pelo browser do profissional em produção — ver nota no guia.';

-- ---------------------------------------------------------------------------
-- 4. FORMULARIOS_ALTA — avaliação clínica pré-alta (as 9 secções ficam
--    guardadas em JSON, por serem muito variáveis e específicas)
-- ---------------------------------------------------------------------------
create table formularios_alta (
  id            uuid primary key default gen_random_uuid(),
  doente_id     uuid references doentes(id) on delete cascade,
  data_alta     date,
  contacto_tipo text,
  dados         jsonb not null,   -- { queimadura:{...}, cicatriz:{...}, dor:{...}, ... }
  criado_por    uuid references auth.users(id),
  criado_em     timestamptz default now()
);

comment on table formularios_alta is 'Uma linha por preenchimento do Formulário de Alta. "dados" guarda as 9 secções em JSON.';

-- ---------------------------------------------------------------------------
-- 5. PROMS_RESPOSTAS — respostas do doente aos questionários (BSHS-B,
--    POSAS, NRS dor, 5-D Itch, PHQ-9, etc.)
-- ---------------------------------------------------------------------------
create table proms_respostas (
  id              uuid primary key default gen_random_uuid(),
  doente_id       uuid references doentes(id) on delete cascade,
  instrumento     text not null,          -- 'BSHS-B' | 'POSAS' | 'NRS-dor' | '5D-itch' | 'PHQ-9' | ...
  data_resposta   date not null default current_date,
  respostas       jsonb not null,         -- respostas item a item
  scores          jsonb,                  -- scores calculados (total, por domínio)
  criado_em       timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 6. METAS — jornada de recuperação (definidas pela equipa e/ou doente)
-- ---------------------------------------------------------------------------
create table metas (
  id              uuid primary key default gen_random_uuid(),
  doente_id       uuid references doentes(id) on delete cascade,
  label           text not null,
  tipo            text,
  categoria       text,      -- usado para atribuir o badge: marco-clinico | cicatrizacao | funcional | psicossocial | prom | pessoal
  origem          text check (origem in ('clinica','doente')) default 'clinica',
  importante      boolean default false,
  estado          text check (estado in ('pending','active','done')) default 'pending',
  data_alvo       text,
  foto_url        text,      -- referência ao ficheiro no Supabase Storage
  criado_em       timestamptz default now(),
  atualizado_em   timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 7. PLANO_EXERCICIOS — prescrições de Enfermagem / Fisioterapia /
--    Terapia Ocupacional
-- ---------------------------------------------------------------------------
create table plano_exercicios (
  id            uuid primary key default gen_random_uuid(),
  doente_id     uuid references doentes(id) on delete cascade,
  nome          text not null,
  categoria     text check (categoria in ('Cirurgia Plástica','Enfermagem','Fisioterapia','Terapia Ocupacional','Psicologia','Nutrição')),
  descricao     text,
  prescricao    text,       -- ex.: "3 séries de 10 repetições · 2x por dia"
  criado_em     timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 8. PLANO_REGISTOS — cada vez que o doente regista ter feito o exercício
--    (doente_id repetido aqui de propósito, para simplificar as regras
--    de acesso abaixo sem precisar de "joins")
-- ---------------------------------------------------------------------------
create table plano_registos (
  id            uuid primary key default gen_random_uuid(),
  exercicio_id  uuid references plano_exercicios(id) on delete cascade,
  doente_id     uuid references doentes(id) on delete cascade,
  data          date not null default current_date,
  esforco       int check (esforco between 0 and 10),
  nota          text,
  criado_em     timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 10. DUVIDAS — perguntas do doente à equipa e respetivas respostas
-- ---------------------------------------------------------------------------
create table duvidas (
  id                uuid primary key default gen_random_uuid(),
  doente_id         uuid references doentes(id) on delete cascade,
  categoria         text,
  pergunta          text not null,
  data              date not null default current_date,
  estado            text check (estado in ('pendente','respondida')) default 'pendente',
  resposta          text,
  respondido_por    text,
  data_resposta     date,
  criado_em         timestamptz default now()
);

-- ============================================================================
-- FUNÇÕES AUXILIARES — usadas pelas regras de acesso (RLS) abaixo
-- ============================================================================
create or replace function is_profissional() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfis where id = auth.uid() and papel = 'profissional'
  );
$$;

create or replace function meu_doente_id() returns uuid
language sql stable security definer set search_path = public as $$
  select doente_id from perfis where id = auth.uid() and papel = 'doente';
$$;

-- ============================================================================
-- ROW LEVEL SECURITY — cada doente só vê os seus dados; profissionais
-- veem tudo. Sem isto, qualquer conta autenticada veria os dados de
-- todos os doentes através da API automática do Supabase.
-- ============================================================================

alter table doentes            enable row level security;
alter table perfis             enable row level security;
alter table contas_acesso      enable row level security;
alter table formularios_alta   enable row level security;
alter table proms_respostas    enable row level security;
alter table metas              enable row level security;
alter table plano_exercicios   enable row level security;
alter table plano_registos     enable row level security;
alter table duvidas            enable row level security;

-- ---------- doentes ----------
create policy "profissionais veem todos os doentes" on doentes
  for select using (is_profissional());
create policy "doente ve o seu proprio registo" on doentes
  for select using (id = meu_doente_id());
create policy "profissionais criam doentes" on doentes
  for insert with check (is_profissional());
create policy "profissionais atualizam doentes" on doentes
  for update using (is_profissional());

-- ---------- perfis ----------
create policy "cada um ve o seu proprio perfil" on perfis
  for select using (id = auth.uid());
create policy "profissionais veem todos os perfis" on perfis
  for select using (is_profissional());

-- ---------- contas_acesso (só a equipa gere convites/códigos) ----------
create policy "profissionais gerem contas de acesso" on contas_acesso
  for all using (is_profissional()) with check (is_profissional());

-- ---------- formularios_alta ----------
create policy "profissionais gerem formularios de alta" on formularios_alta
  for all using (is_profissional()) with check (is_profissional());
create policy "doente ve o seu formulario de alta" on formularios_alta
  for select using (doente_id = meu_doente_id());

-- ---------- proms_respostas ----------
create policy "profissionais veem todas as respostas PROM" on proms_respostas
  for select using (is_profissional());
create policy "doente ve as suas respostas PROM" on proms_respostas
  for select using (doente_id = meu_doente_id());
create policy "doente responde aos seus PROMs" on proms_respostas
  for insert with check (doente_id = meu_doente_id());

-- ---------- metas (editável por ambos, como definido no site) ----------
create policy "acesso de leitura a metas" on metas
  for select using (is_profissional() or doente_id = meu_doente_id());
create policy "criacao de metas por ambos" on metas
  for insert with check (is_profissional() or doente_id = meu_doente_id());
create policy "edicao de metas por ambos" on metas
  for update using (is_profissional() or doente_id = meu_doente_id());
create policy "remocao de metas por ambos" on metas
  for delete using (is_profissional() or doente_id = meu_doente_id());

-- ---------- plano_exercicios (só a equipa prescreve) ----------
create policy "profissionais gerem exercicios" on plano_exercicios
  for all using (is_profissional()) with check (is_profissional());
create policy "doente ve os seus exercicios prescritos" on plano_exercicios
  for select using (doente_id = meu_doente_id());

-- ---------- plano_registos (o doente regista, a equipa consulta adesão) ----------
create policy "doente regista execucao" on plano_registos
  for insert with check (doente_id = meu_doente_id());
create policy "doente ve os seus registos" on plano_registos
  for select using (doente_id = meu_doente_id());
create policy "profissionais veem todos os registos" on plano_registos
  for select using (is_profissional());

-- ---------- duvidas ----------
create policy "doente cria as suas duvidas" on duvidas
  for insert with check (doente_id = meu_doente_id());
create policy "doente ve as suas duvidas" on duvidas
  for select using (doente_id = meu_doente_id());
create policy "profissionais veem todas as duvidas" on duvidas
  for select using (is_profissional());
create policy "profissionais respondem a duvidas" on duvidas
  for update using (is_profissional());

-- ============================================================================
-- ARMAZENAMENTO (Storage) — bucket para as fotos submetidas nas metas
-- Nota: crie também o bucket "fotos-metas" na secção Storage do painel
-- Supabase (não é possível criar buckets só por SQL). Ver guia.
-- ============================================================================

-- Depois de criar o bucket "fotos-metas" no painel (Storage → New bucket),
-- corra também isto — sem isto, o envio de fotos falha com
-- "new row violates row-level security policy":

update storage.buckets set public = true where id = 'fotos-metas';

create policy "utilizadores autenticados podem enviar fotos de metas"
on storage.objects for insert
with check (bucket_id = 'fotos-metas' and auth.role() = 'authenticated');

create policy "utilizadores autenticados podem ver fotos de metas"
on storage.objects for select
using (bucket_id = 'fotos-metas' and auth.role() = 'authenticated');


-- ============================================================================
-- 005_tabelas_em_falta.sql
-- As tabelas das migrações 001-005, que nunca foram commitadas
-- ============================================================================

-- ============================================================================
-- Migração 005 — as tabelas que existiam na base de dados e em ficheiro nenhum
-- Executar no SQL Editor do Supabase
-- ============================================================================
--
-- O QUE ACONTECEU
--
-- As migrações deste repositório começam no 006. As de 001 a 005 existiram —
-- o próprio código lhes chama pelo nome: assets/js/supabase-client.js cita
-- "004_contador_acessos.sql", e a migração 009 cita "005_checkins_humor.sql" —
-- mas nunca foram commitadas.
--
-- O resultado é que quatro tabelas, uma função e duas colunas vivem na base de
-- dados de produção sem estarem descritas em lado nenhum:
--
--     agendamentos            consultas e exames marcados
--     historico_clinico       episódios anteriores (urgências, internamentos)
--     checkins_humor          a resposta rápida das caras
--     avaliacoes_recursos     o "foi útil?" dos vídeos e folhetos
--     registar_acesso_doente()        incrementa o contador de entradas
--     doentes.contagem_acessos        onde esse contador vive
--     duvidas.contacto_telefonico     o pedido de ser contactado por telefone
--
-- Esta migração reconstrói-as. NÃO foram copiadas da base de dados: foram
-- deduzidas do que o site escreve e lê, ficheiro a ficheiro. Por isso é toda
-- ela defensiva — "if not exists" em tudo, e as políticas só se criam se ainda
-- não existirem.
--
-- É SEGURO CORRER ONDE AS TABELAS JÁ EXISTEM?
--
-- Sim, e é esse o ponto. Numa base de dados que já as tenha, isto não cria
-- nada, não altera tipos e não toca em dados — serve só para o ficheiro passar
-- a existir. Numa base de dados nova, cria o que falta.
--
-- Se quiser confirmar que o que está aqui corresponde ao que está em produção,
-- corra o database/extrair_tabelas_em_falta.sql, que só lê, e compare.
--
-- ORDEM: antes da 006. A 008 e a 009 alteram checkins_humor, a 018 altera
-- agendamentos — todas elas partem do princípio de que estas tabelas existem.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. HISTÓRICO CLÍNICO — episódios anteriores, registados pelo próprio
--
--    Três tipos de evento, e as datas que cada um usa são diferentes: uma
--    urgência ou uma consulta têm uma data só; um internamento tem início e
--    fim. Daí as três colunas de data, todas opcionais — é o tipo que decide
--    quais fazem sentido, e essa validação fica no formulário e não aqui, para
--    um registo antigo e incompleto não deixar de poder ser guardado.
-- ---------------------------------------------------------------------------
create table if not exists historico_clinico (
  id             uuid primary key default gen_random_uuid(),
  doente_id      uuid not null references doentes(id) on delete cascade,
  tipo_evento    text not null check (tipo_evento in ('urgencia','consulta','internamento')),
  especialidade  text,
  data_evento    date,
  data_inicio    date,
  data_fim       date,
  notas          text,
  criado_em      timestamptz default now()
);

comment on table historico_clinico is
  'Episódios de saúde anteriores ou paralelos ao seguimento, registados pelo próprio ou por quem cuida dele. Não é o processo clínico: é o que o doente acha relevante a equipa saber.';

create index if not exists historico_clinico_doente_idx
  on historico_clinico (doente_id, criado_em desc);


-- ---------------------------------------------------------------------------
-- 2. AGENDAMENTOS — consultas e exames futuros
--
--    "estado" existe por causa do cancelar: cancelarAgendamento() não apaga a
--    linha, põe-lhe estado 'cancelado'. Uma consulta que foi marcada e depois
--    desmarcada é informação clínica — apagá-la fazia desaparecer o facto de
--    ter havido uma tentativa.
-- ---------------------------------------------------------------------------
create table if not exists agendamentos (
  id             uuid primary key default gen_random_uuid(),
  doente_id      uuid not null references doentes(id) on delete cascade,
  data_hora      timestamptz not null,
  especialidade  text,
  local          text,
  notas          text,
  estado         text not null default 'agendado'
                 check (estado in ('agendado','realizado','cancelado','faltou')),
  criado_em      timestamptz default now()
);

comment on column agendamentos.estado is
  'agendado | realizado | cancelado | faltou. Cancelar não apaga a linha: uma consulta desmarcada é informação.';

create index if not exists agendamentos_doente_idx
  on agendamentos (doente_id, data_hora);


-- ---------------------------------------------------------------------------
-- 3. CHECK-IN DE HUMOR — a resposta das caras, depois de cada avaliação
--
--    SEM restrição CHECK na coluna "valor", de propósito: é a migração 008 que
--    a põe, depois de converter os três valores antigos nos seis novos. Pôr
--    aqui uma restrição com os valores novos faria a 008 falhar a conversão.
-- ---------------------------------------------------------------------------
create table if not exists checkins_humor (
  id         uuid primary key default gen_random_uuid(),
  doente_id  uuid not null references doentes(id) on delete cascade,
  valor      text not null,
  criado_em  timestamptz default now()
);

comment on table checkins_humor is
  'Resposta rápida de três segundos, dada depois de cada avaliação. Não é um instrumento clínico: serve para ver a tendência e para disparar alerta nas duas respostas mais baixas.';


-- ---------------------------------------------------------------------------
-- 4. AVALIAÇÕES DOS RECURSOS — o "foi útil?" dos vídeos e folhetos
--
--    A chave única (doente_id, recurso_id) não é um detalhe: o site grava isto
--    com upsert e "onConflict: doente_id,recurso_id". Sem a restrição única, o
--    upsert falha — e a mesma pessoa poderia votar no mesmo vídeo sem limite.
-- ---------------------------------------------------------------------------
create table if not exists avaliacoes_recursos (
  id             uuid primary key default gen_random_uuid(),
  doente_id      uuid not null references doentes(id) on delete cascade,
  recurso_id     text not null,
  recurso_tipo   text,
  util           boolean not null,
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now(),
  constraint avaliacoes_recursos_unica unique (doente_id, recurso_id)
);

-- se a tabela já existia sem a restrição única, acrescenta-se agora
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.avaliacoes_recursos'::regclass
       and contype  = 'u'
  ) then
    alter table avaliacoes_recursos
      add constraint avaliacoes_recursos_unica unique (doente_id, recurso_id);
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 5. CONTADOR DE ACESSOS (o que era a 004)
--
--    A coluna vive em "doentes" porque é da pessoa, não da conta: se a conta
--    for recriada, o histórico de utilização não devia voltar a zero.
--
--    A função é security definer porque o doente não tem — nem deve ter —
--    permissão para escrever na sua própria linha de "doentes". Chama-se a
--    seguir ao login e nunca o pode impedir: o cliente embrulha-a em try/catch.
-- ---------------------------------------------------------------------------
alter table doentes
  add column if not exists contagem_acessos  int default 0,
  add column if not exists ultimo_acesso_em  timestamptz;

comment on column doentes.contagem_acessos is
  'Quantas vezes a conta do doente ou do familiar entrou. Mostrado na lista de doentes com uma chave (🔑): serve para a equipa ver quem nunca chegou a entrar.';

create or replace function registar_acesso_doente()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
begin
  -- meu_doente_id() devolve null para contas profissionais, e nesse caso isto
  -- não faz rigorosamente nada — que é o comportamento esperado
  select meu_doente_id() into alvo;
  if alvo is null then
    return;
  end if;

  update doentes
     set contagem_acessos = coalesce(contagem_acessos, 0) + 1,
         ultimo_acesso_em = now()
   where id = alvo;
end $$;

comment on function registar_acesso_doente() is
  'Incrementa o contador de entradas do doente autenticado. Não faz nada para contas profissionais. Chamada a seguir ao login, e nunca o pode impedir.';


-- ---------------------------------------------------------------------------
-- 6. A COLUNA EM FALTA EM "duvidas"
--
--    Quando o doente escreve uma dúvida, pode pedir para ser contactado por
--    telefone em vez de por escrito. É uma caixa no formulário, e é o que
--    distingue "respondam-me quando puderem" de "preciso de falar com alguém".
-- ---------------------------------------------------------------------------
alter table duvidas
  add column if not exists contacto_telefonico boolean default false;

comment on column duvidas.contacto_telefonico is
  'O doente pediu para ser contactado por telefone em vez de por escrito.';


-- ============================================================================
-- 7. REGRAS DE ACESSO (RLS)
--
--    O mesmo princípio do resto do esquema: cada doente só vê o que é seu, os
--    profissionais veem tudo. As políticas são criadas uma a uma, e só se
--    ainda não existirem — correr isto numa base de dados que já as tenha não
--    dá erro nem as duplica.
-- ============================================================================
alter table historico_clinico   enable row level security;
alter table agendamentos        enable row level security;
alter table checkins_humor      enable row level security;
alter table avaliacoes_recursos enable row level security;

do $$
declare
  p record;
begin
  for p in
    select * from (values
      -- tabela,              nome da política,                          operação, condição
      ('historico_clinico',   'doente ve o seu historico',               'select', 'doente_id = meu_doente_id()'),
      ('historico_clinico',   'doente regista o seu historico',          'insert', 'doente_id = meu_doente_id()'),
      ('historico_clinico',   'doente remove o seu historico',           'delete', 'doente_id = meu_doente_id()'),
      -- os profissionais leem o historico mas nao escrevem nele: e o doente
      -- que o preenche, e e essa a razao de existir desta tabela
      ('historico_clinico',   'profissionais veem todo o historico',     'select', 'is_profissional()'),

      ('agendamentos',        'doente ve os seus agendamentos',          'select', 'doente_id = meu_doente_id()'),
      ('agendamentos',        'doente marca os seus agendamentos',       'insert', 'doente_id = meu_doente_id()'),
      ('agendamentos',        'doente altera os seus agendamentos',      'update', 'doente_id = meu_doente_id()'),
      ('agendamentos',        'profissionais veem todos os agendamentos','select', 'is_profissional()'),
      ('agendamentos',        'profissionais marcam agendamentos',       'insert', 'is_profissional()'),
      ('agendamentos',        'profissionais alteram agendamentos',      'update', 'is_profissional()'),

      ('checkins_humor',      'doente regista o seu check-in',           'insert', 'doente_id = meu_doente_id()'),
      ('checkins_humor',      'doente ve os seus check-ins',             'select', 'doente_id = meu_doente_id()'),

      ('avaliacoes_recursos', 'doente avalia recursos',                  'insert', 'doente_id = meu_doente_id()'),
      ('avaliacoes_recursos', 'doente altera a sua avaliacao',           'update', 'doente_id = meu_doente_id()'),
      ('avaliacoes_recursos', 'doente apaga a sua avaliacao',            'delete', 'doente_id = meu_doente_id()'),
      ('avaliacoes_recursos', 'doente ve as suas avaliacoes',            'select', 'doente_id = meu_doente_id()'),
      ('avaliacoes_recursos', 'profissionais veem as avaliacoes',        'select', 'is_profissional()')
    ) as t(tabela, politica, operacao, condicao)
  loop
    if not exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = p.tabela and policyname = p.politica
    ) then
      if p.operacao in ('insert') then
        execute format('create policy %I on %I for %s with check (%s)',
                       p.politica, p.tabela, p.operacao, p.condicao);
      elsif p.operacao in ('update') then
        execute format('create policy %I on %I for %s using (%s) with check (%s)',
                       p.politica, p.tabela, p.operacao, p.condicao, p.condicao);
      else
        execute format('create policy %I on %I for %s using (%s)',
                       p.politica, p.tabela, p.operacao, p.condicao);
      end if;
    end if;
  end loop;
end $$;

-- A política que deixa os profissionais lerem os check-ins de humor é criada
-- pela migração 009, que já trata de verificar se existe. Não se repete aqui.


-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================
select 'tabelas' as o_que,
       case when count(*) = 4 then 'ok' else 'FALTA (' || count(*) || ' de 4)' end as estado
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('historico_clinico','agendamentos','checkins_humor','avaliacoes_recursos')
union all
select 'função registar_acesso_doente',
       case when count(*) = 1 then 'ok' else 'FALTA' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'registar_acesso_doente'
union all
select 'colunas acrescentadas',
       case when count(*) = 3 then 'ok' else 'FALTA (' || count(*) || ' de 3)' end
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'doentes' and column_name in ('contagem_acessos','ultimo_acesso_em'))
     or (table_name = 'duvidas' and column_name = 'contacto_telefonico'))
union all
select 'políticas de acesso nas quatro tabelas',
       case when count(*) >= 17 then 'ok' else 'só ' || count(*) || ' (esperadas 17 ou mais)' end
  from pg_policies
 where schemaname = 'public'
   and tablename in ('historico_clinico','agendamentos','checkins_humor','avaliacoes_recursos');


-- ============================================================================
-- 006_comunicacao_equipa.sql
-- Mural interno da equipa, por criança
-- ============================================================================

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


-- ============================================================================
-- 007_atualizacoes_metas.sql
-- O fio onde a família escreve como está a correr cada meta
-- ============================================================================

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


-- ============================================================================
-- 008_checkins_humor_escala.sql
-- Check-in de humor: de 3 para 6 opções
-- ============================================================================

-- ============================================================================
-- LUMI — Check-in de humor: passa de 3 para 6 opções
-- Migração 008 · executar no SQL Editor do Supabase
--
-- O pop-up "Como se sente hoje?", mostrado ao doente depois de submeter uma
-- avaliação, passou de três caras (triste / ok / alegre) para uma escala de
-- seis níveis, no formato dos check-ins de saúde mental da OMS.
--
-- A coluna "valor" tem uma restrição CHECK com os três valores antigos. Sem
-- esta migração, qualquer resposta nova é recusada pela base de dados com
-- "violates check constraint".
--
-- A ORDEM DOS PASSOS IMPORTA: a restrição antiga tem de ser removida antes
-- de os registos serem convertidos, porque enquanto estiver ativa recusa os
-- valores novos; e a restrição nova só pode ser criada depois da conversão,
-- porque é validada contra as linhas que já existem.
--
-- Pode ser corrida mais do que uma vez sem problema.
-- ============================================================================

-- 1. Remover a restrição antiga. O nome foi atribuído automaticamente quando a
--    tabela foi criada e varia conforme o projeto, por isso é procurado em vez
--    de escrito à mão. Só são removidas restrições CHECK que mencionem a
--    coluna "valor" — as outras, se existirem, ficam intactas.
do $$
declare r record;
begin
  for r in
    select conname
      from pg_constraint
     where conrelid = 'public.checkins_humor'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%valor%'
  loop
    execute format('alter table checkins_humor drop constraint %I', r.conname);
  end loop;
end $$;

-- 2. Converter os registos existentes para a escala nova. Já sem restrição
--    a impedir a escrita.
update checkins_humor set valor = 'muito-em-baixo' where valor = 'triste';
update checkins_humor set valor = 'razoavel'       where valor = 'ok';
update checkins_humor set valor = 'muito-bem'      where valor = 'feliz';

-- 3. Criar a restrição nova, agora com nome fixo para futuras migrações não
--    terem de o procurar. A ordem é do melhor para o pior estado.
alter table checkins_humor
  add constraint checkins_humor_valor_check
  check (valor in (
    'muito-bem',
    'bem',
    'razoavel',
    'podia-estar-melhor',
    'muito-em-baixo',
    'preciso-de-ajuda'
  ));

comment on column checkins_humor.valor is
  'Escala de 6 níveis do check-in rápido de humor, do melhor para o pior: muito-bem, bem, razoavel, podia-estar-melhor, muito-em-baixo, preciso-de-ajuda.';


-- ============================================================================
-- 009_alertas_humor.sql
-- Check-in de humor visível à equipa
-- ============================================================================

-- ============================================================================
-- LUMI — Check-in de humor visível à equipa, para gerar alertas
-- Migração 009 · executar no SQL Editor do Supabase depois da 008
--
-- As respostas "Muito em baixo" e "Preciso de ajuda" passam a aparecer na
-- página de Alertas e a contar para o número junto a "🔔 Alertas" no menu.
-- Para isso, os profissionais têm de conseguir ler a tabela checkins_humor.
--
-- Esta migração é segura de correr mais do que uma vez: a política só é
-- criada se ainda não existir. Se já tinha sido definida em
-- 005_checkins_humor.sql, nada acontece.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename  = 'checkins_humor'
       and policyname = 'profissionais veem os checkins de humor'
  ) then
    execute 'create policy "profissionais veem os checkins de humor"
               on checkins_humor for select using (is_profissional())';
  end if;
end $$;

-- Índice para ir buscar depressa o último check-in de cada doente, que é o
-- único que conta para o alerta.
create index if not exists checkins_humor_doente_idx
  on checkins_humor (doente_id, criado_em desc);


-- ============================================================================
-- 010_alertas_tratados.sql
-- Registo dos alertas dados como tratados
-- ============================================================================

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


-- ============================================================================
-- 011_notificacoes_email.sql
-- Aviso por email à equipa (opcional — ver passo 4)
-- ============================================================================

-- ============================================================================
-- LUMI — Aviso por email à equipa
-- Migração 011 · executar no SQL Editor do Supabase depois da 010
--
-- Sempre que um doente cria uma dúvida ou submete uma resposta a um
-- questionário, a base de dados chama a Edge Function "notificar-equipa",
-- que envia o email (ver supabase/functions/notificar-equipa/index.ts).
--
-- O gatilho está na base de dados, e não no browser do doente, de propósito:
-- assim o aviso sai mesmo que o doente feche a página logo a seguir a
-- submeter, e não é possível forjá-lo a partir do browser.
--
-- ANTES DE CORRER, leia a secção "Avisos por email" no GUIA-BACKEND.md:
-- é preciso publicar a Edge Function e preencher a tabela
-- integracoes_config com o endereço e o segredo. Enquanto isso não estiver
-- feito, os gatilhos não fazem nada e a plataforma funciona na mesma.
-- ============================================================================

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- 1. Quem recebe os avisos
--    Normalmente uma caixa de correio partilhada da Unidade, e não os emails
--    pessoais — assim quem entra e sai da equipa não obriga a mexer nisto.
-- ---------------------------------------------------------------------------
create table if not exists notificacoes_destinatarios (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  nome       text,
  ativo      boolean not null default true,
  criado_em  timestamptz default now()
);

comment on table notificacoes_destinatarios is
  'Endereços que recebem os avisos de nova dúvida e nova resposta a questionário.';

-- ---------------------------------------------------------------------------
-- 2. Que avisos estão ligados (linha única, id = 1)
-- ---------------------------------------------------------------------------
create table if not exists notificacoes_config (
  id               int primary key default 1 check (id = 1),
  avisar_duvidas   boolean not null default true,
  avisar_proms     boolean not null default true,
  atualizado_em    timestamptz default now()
);

insert into notificacoes_config (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Endereço e segredo da Edge Function
--    Fica numa tabela, e não escrito neste ficheiro, porque o repositório é
--    público. Preencher pelo painel do Supabase — ver o guia.
--    Sem políticas de leitura: nem o doente nem o profissional lhe acedem
--    pela API. Só o gatilho, que corre com privilégios do dono da função.
-- ---------------------------------------------------------------------------
create table if not exists integracoes_config (
  chave  text primary key,
  valor  text not null
);

comment on table integracoes_config is
  'Configuração de integrações externas. Contém segredos: nenhuma política RLS dá acesso a esta tabela pela API.';

alter table integracoes_config enable row level security;
-- (sem políticas de propósito: fica inacessível pela API pública)

-- ---------------------------------------------------------------------------
-- 4. Regras de acesso das duas primeiras tabelas — só profissionais
-- ---------------------------------------------------------------------------
alter table notificacoes_destinatarios enable row level security;
alter table notificacoes_config        enable row level security;

drop policy if exists "profissionais gerem destinatarios" on notificacoes_destinatarios;
create policy "profissionais gerem destinatarios" on notificacoes_destinatarios
  for all using (is_profissional()) with check (is_profissional());

drop policy if exists "profissionais veem a config de avisos" on notificacoes_config;
create policy "profissionais veem a config de avisos" on notificacoes_config
  for select using (is_profissional());

drop policy if exists "profissionais alteram a config de avisos" on notificacoes_config;
create policy "profissionais alteram a config de avisos" on notificacoes_config
  for update using (is_profissional()) with check (is_profissional());

-- ---------------------------------------------------------------------------
-- 5. O gatilho
--    security definer para conseguir ler integracoes_config, que está fechada
--    à API. A chamada é assíncrona (pg_net): se o envio do email falhar ou
--    demorar, a dúvida do doente fica na mesma gravada. Nunca é aceitável
--    perder o registo por causa de um aviso.
-- ---------------------------------------------------------------------------
create or replace function avisar_equipa_por_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  endereco text;
  segredo  text;
begin
  select valor into endereco from integracoes_config where chave = 'url_notificar_equipa';
  select valor into segredo  from integracoes_config where chave = 'segredo_webhook';

  -- ainda não configurado: não fazer nada, sem estorvar a gravação
  if endereco is null or segredo is null then
    return new;
  end if;

  perform net.http_post(
    url     := endereco,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-lumi-segredo', segredo
               ),
    body    := jsonb_build_object(
                 'type',  'INSERT',
                 'table', tg_table_name
               )
  );
  return new;
exception when others then
  -- um aviso que falha nunca pode impedir o doente de registar a dúvida
  raise warning 'Falhou o aviso por email (%): %', tg_table_name, sqlerrm;
  return new;
end $$;

drop trigger if exists trg_avisar_duvida on duvidas;
create trigger trg_avisar_duvida
  after insert on duvidas
  for each row execute function avisar_equipa_por_email();

drop trigger if exists trg_avisar_prom on proms_respostas;
create trigger trg_avisar_prom
  after insert on proms_respostas
  for each row execute function avisar_equipa_por_email();


-- ============================================================================
-- 012_corrige_chamada_edge_function.sql
-- Correção da autenticação do gatilho de email
-- ============================================================================

-- ============================================================================
-- LUMI — Correção: o gatilho não estava a autenticar-se no Supabase
-- Migração 012 · executar no SQL Editor depois da 011
--
-- O PROBLEMA
-- O gatilho criado na 011 chamava a Edge Function enviando apenas
-- Content-Type e x-lumi-segredo. Mas o Supabase exige um cabeçalho
-- Authorization em todas as chamadas a Edge Functions, e rejeita-as no
-- gateway ANTES de o código da função correr:
--
--   {"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}
--
-- Resultado: a dúvida era gravada, o gatilho disparava, a chamada era
-- recusada, e não havia email nem erro visível — o pg_net é assíncrono, por
-- isso a recusa nem chegava ao log do Postgres.
--
-- A CORREÇÃO
-- Passa a enviar também Authorization: Bearer <chave publicável>. Basta a
-- chave publicável (anon), que já está no site e portanto não é segredo: ao
-- gateway interessa apenas que seja uma chave válida do projeto. Quem
-- autoriza de facto continua a ser o x-lumi-segredo, verificado pelo nosso
-- código. Manter a verificação do gateway ligada é uma camada a mais: quem
-- não tiver sequer uma chave do projeto nem chega à função.
--
-- ANTES DE CORRER: acrescente a chave publicável à configuração.
--   insert into integracoes_config (chave, valor)
--   values ('chave_anon', '<a sua chave publicável / anon>')
--   on conflict (chave) do update set valor = excluded.valor;
-- ============================================================================

create or replace function avisar_equipa_por_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  endereco text;
  segredo  text;
  anon     text;
begin
  select valor into endereco from integracoes_config where chave = 'url_notificar_equipa';
  select valor into segredo  from integracoes_config where chave = 'segredo_webhook';
  select valor into anon     from integracoes_config where chave = 'chave_anon';

  -- ainda não configurado: não fazer nada, sem estorvar a gravação
  if endereco is null or segredo is null then
    return new;
  end if;

  -- sem a chave, a chamada seria recusada pelo gateway em silêncio; mais vale
  -- deixar dito no log porque é que não saiu nenhum aviso
  if anon is null then
    raise warning 'Aviso por email não enviado: falta a linha "chave_anon" em integracoes_config (ver 012_corrige_chamada_edge_function.sql).';
    return new;
  end if;

  perform net.http_post(
    url     := endereco,
    headers := jsonb_build_object(
                 'Content-Type',    'application/json',
                 'Authorization',   'Bearer ' || anon,
                 'x-lumi-segredo', segredo
               ),
    body    := jsonb_build_object(
                 'type',  'INSERT',
                 'table', tg_table_name
               )
  );
  return new;
exception when others then
  -- um aviso que falha nunca pode impedir o doente de registar a dúvida
  raise warning 'Falhou o aviso por email (%): %', tg_table_name, sqlerrm;
  return new;
end $$;


-- ============================================================================
-- 013_prioridade_seguimento.sql
-- Prioridade de seguimento gravada com o formulário
-- ============================================================================

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


-- ============================================================================
-- 014_duvidas_por_ler.sql
-- Contador de respostas por ler
-- ============================================================================

-- ============================================================================
-- LUMI — Contador de respostas por ler, na área do doente
-- Migração 014 · executar no SQL Editor do Supabase
--
-- Quando a equipa responde a uma dúvida, o doente recebe email. Mas se não
-- abrir o email — ou o apagar — não fica com sinal nenhum ao entrar na
-- plataforma. Passa a aparecer um contador junto a "Dúvidas", como já
-- acontece do lado profissional.
--
-- PORQUE É UMA FUNÇÃO E NÃO UMA POLÍTICA DE UPDATE
-- Marcar como lida é uma escrita na tabela duvidas. Dar ao doente uma
-- política de UPDATE sobre as suas dúvidas resolveria o problema — e
-- abriria outro: as políticas RLS são por LINHA, não por coluna, pelo que
-- o doente passaria a poder alterar também "resposta", "estado" e
-- "respondido_por". Ou seja, reescrever aquilo que a equipa lhe respondeu.
--
-- Por isso a marcação é feita por uma função security definer, que só sabe
-- fazer uma coisa: pôr a data de leitura nas dúvidas do próprio, e mais
-- nada. O doente continua sem qualquer permissão de escrita na tabela.
-- ============================================================================

alter table duvidas
  add column if not exists resposta_vista_em timestamptz;

comment on column duvidas.resposta_vista_em is
  'Quando o doente viu a resposta. Nulo enquanto não a viu — é o que alimenta o contador junto a "Dúvidas".';

-- Só interessam as respondidas e ainda não vistas; um índice parcial chega
-- e não cresce com o histórico todo.
create index if not exists duvidas_por_ler_idx
  on duvidas (doente_id)
  where estado = 'respondida' and resposta_vista_em is null;

-- ---------------------------------------------------------------------------
-- Marca como vistas as respostas do doente com sessão iniciada.
-- Não recebe parâmetros de propósito: o doente é sempre o da sessão, e assim
-- não é possível marcar as dúvidas de outra pessoa passando outro id.
-- ---------------------------------------------------------------------------
create or replace function marcar_duvidas_vistas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  meu uuid;
  marcadas integer;
begin
  meu := meu_doente_id();
  if meu is null then
    return 0;            -- não é uma conta de doente: não faz nada
  end if;

  update duvidas
     set resposta_vista_em = now()
   where doente_id = meu
     and estado = 'respondida'
     and resposta_vista_em is null;

  get diagnostics marcadas = row_count;
  return marcadas;
end $$;

revoke all on function marcar_duvidas_vistas() from public;
grant execute on function marcar_duvidas_vistas() to authenticated;


-- ============================================================================
-- 015_consulta_72h.sql
-- Contacto às 72 horas da alta
-- ============================================================================

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


-- ============================================================================
-- 016_exercicios_suspensos.sql
-- Suspender um cuidado sem o apagar
-- ============================================================================

/* ============================================================================
   LUMI - Suspender um cuidado ou exercicio sem o apagar
   Migracao 016 - executar no SQL Editor do Supabase

   No contacto das 72 horas a equipa pode concluir que um exercicio deve
   parar: dor, ferida a agravar, material em falta. Apagar a prescricao
   resolveria a vista do doente, mas levaria com ela os registos de execucao
   e a memoria de que aquilo chegou a ser prescrito.

   Fica antes um estado. O exercicio suspenso deixa de aparecer ao doente,
   mas continua na ficha, com o historico intacto, e pode ser reativado.
   ============================================================================ */

alter table plano_exercicios
  add column if not exists estado text
  check (estado in ('ativo','suspenso')) default 'ativo';

update plano_exercicios set estado = 'ativo' where estado is null;

comment on column plano_exercicios.estado is
  'ativo: visivel ao doente. suspenso: parado pela equipa, mantido na ficha com o historico.';


-- ============================================================================
-- 017_satisfacao.sql
-- Avaliação da satisfação (PREM)
-- ============================================================================

/* ============================================================================
   LUMI - Avaliacao da satisfacao do doente (PREM)
   Migracao 017 - executar no SQL Editor do Supabase

   Dois questionarios, do documento da equipa:
     breve - depois de cada teleconsulta, cerca de 1 minuto
     final - na alta do seguimento em telessaude, cerca de 3 minutos

   O questionario nao aparece sozinho: e a equipa que o pede, no fim da
   consulta. Cada pedido e uma linha desta tabela, e cada linha tem tres
   desfechos possiveis - respondida, recusada, ou por responder. Guardar a
   recusa e tao importante como guardar a resposta: sem isso nao se distingue
   quem nao quis responder de quem nunca chegou a ver o pedido, e a taxa de
   resposta deixa de querer dizer alguma coisa.

   Quem responde e sempre o doente. A equipa cria o pedido e le o resultado.
   ============================================================================ */

create table if not exists satisfacao_pedidos (
  id                 uuid primary key default gen_random_uuid(),
  doente_id          uuid not null references doentes(id) on delete cascade,
  tipo               text not null check (tipo in ('breve','final')),

  pedido_por_id      uuid references auth.users(id),
  pedido_por_nome    text not null,
  criado_em          timestamptz not null default now(),

  estado             text not null default 'pendente'
                     check (estado in ('pendente','respondida','recusada')),

  respostas          jsonb,
  satisfacao_global  smallint check (satisfacao_global between 0 and 10),
  respondido_em      timestamptz,
  recusado_em        timestamptz,

  /* consulta a que este pedido diz respeito, quando houver marcacao */
  agendamento_id     uuid references agendamentos(id)
);

comment on table satisfacao_pedidos is
  'Um pedido de avaliacao da satisfacao por consulta. A equipa cria; o doente responde ou recusa.';
comment on column satisfacao_pedidos.satisfacao_global is
  'Copia da pergunta 0-10, em coluna propria por ser a metrica que se acompanha ao longo do tempo.';

create index if not exists satisfacao_doente_idx
  on satisfacao_pedidos (doente_id, criado_em desc);
create index if not exists satisfacao_pendentes_idx
  on satisfacao_pedidos (doente_id) where estado = 'pendente';

/* ---------------------------------------------------------------------------
   REGRAS DE ACESSO

   O doente le os seus pedidos, mas nao escreve nesta tabela. Responder e
   recusar passam pelas duas funcoes abaixo, que correm com privilegios do
   dono: as politicas do Postgres sao por linha e nao por coluna, e uma
   politica de UPDATE deixaria o doente reescrever tambem quem pediu, quando,
   e de que tipo era o questionario.
   --------------------------------------------------------------------------- */
alter table satisfacao_pedidos enable row level security;

drop policy if exists "profissionais pedem avaliacao" on satisfacao_pedidos;
create policy "profissionais pedem avaliacao" on satisfacao_pedidos
  for insert with check (is_profissional() and pedido_por_id = auth.uid());

drop policy if exists "profissionais veem avaliacoes" on satisfacao_pedidos;
create policy "profissionais veem avaliacoes" on satisfacao_pedidos
  for select using (is_profissional());

drop policy if exists "doente ve os seus pedidos" on satisfacao_pedidos;
create policy "doente ve os seus pedidos" on satisfacao_pedidos
  for select using (doente_id = meu_doente_id());

/* ---------------------------------------------------------------------------
   RESPONDER E RECUSAR
   Ambas so mexem em pedidos do proprio doente e ainda pendentes: um
   questionario respondido nao se reescreve depois.
   --------------------------------------------------------------------------- */
create or replace function responder_satisfacao(
  p_pedido uuid,
  p_respostas jsonb,
  p_global smallint default null
) returns satisfacao_pedidos
language plpgsql
security definer
set search_path = public
as $$
declare
  linha satisfacao_pedidos;
begin
  update satisfacao_pedidos
     set respostas = p_respostas,
         satisfacao_global = p_global,
         estado = 'respondida',
         respondido_em = now()
   where id = p_pedido
     and doente_id = meu_doente_id()
     and estado = 'pendente'
  returning * into linha;

  if linha.id is null then
    raise exception 'Pedido inexistente, ja respondido ou de outro doente.';
  end if;
  return linha;
end $$;

create or replace function recusar_satisfacao(p_pedido uuid)
returns satisfacao_pedidos
language plpgsql
security definer
set search_path = public
as $$
declare
  linha satisfacao_pedidos;
begin
  update satisfacao_pedidos
     set estado = 'recusada',
         recusado_em = now()
   where id = p_pedido
     and doente_id = meu_doente_id()
     and estado = 'pendente'
  returning * into linha;

  if linha.id is null then
    raise exception 'Pedido inexistente, ja fechado ou de outro doente.';
  end if;
  return linha;
end $$;

revoke all on function responder_satisfacao(uuid, jsonb, smallint) from public;
revoke all on function recusar_satisfacao(uuid) from public;
grant execute on function responder_satisfacao(uuid, jsonb, smallint) to authenticated;
grant execute on function recusar_satisfacao(uuid) to authenticated;

/* ---------------------------------------------------------------------------
   CONVITE POR EMAIL
   O mesmo mecanismo dos avisos a equipa (ver 011 e 012): a base de dados
   chama uma Edge Function, que e quem tem a chave do fornecedor de email.
   O endereco do doente nunca passa pelo browser de ninguem.

   Enquanto a funcao nao estiver publicada e configurada, o gatilho nao faz
   nada: o pedido continua a ser criado e o pop-up continua a aparecer ao
   doente. O email e um reforco, nao o unico caminho.
   --------------------------------------------------------------------------- */
create or replace function convidar_para_satisfacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  endereco text;
  segredo  text;
  anon     text;
begin
  select valor into endereco from integracoes_config where chave = 'url_convidar_satisfacao';
  select valor into segredo  from integracoes_config where chave = 'segredo_webhook';
  select valor into anon     from integracoes_config where chave = 'chave_anon';

  if endereco is null or segredo is null or anon is null then
    return new;
  end if;

  perform net.http_post(
    url     := endereco,
    headers := jsonb_build_object(
                 'Content-Type',    'application/json',
                 'Authorization',   'Bearer ' || anon,
                 'x-lumi-segredo', segredo
               ),
    body    := jsonb_build_object('pedido_id', new.id)
  );
  return new;
exception when others then
  raise warning 'Falhou o convite de satisfacao por email: %', sqlerrm;
  return new;
end $$;

drop trigger if exists trg_convidar_satisfacao on satisfacao_pedidos;
create trigger trg_convidar_satisfacao
  after insert on satisfacao_pedidos
  for each row execute function convidar_para_satisfacao();


-- ============================================================================
-- 018_consultas.sql
-- Consultas de seguimento: agendamento e registo
-- ============================================================================

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


-- ============================================================================
-- 019_anexos.sql
-- Documentos associados às marcações
-- ============================================================================

/* ============================================================================
   LUMI - Documentos associados as marcacoes
   Migracao 019 - executar no SQL Editor do Supabase

   A equipa pode anexar a uma marcacao o que o doente precisa de ter: uma
   preparacao para exame, um folheto, uma credencial. Os ficheiros vao para
   o Storage do Supabase, num balde PRIVADO - ao contrario do balde das fotos
   das metas, que e publico. Aqui pode haver informacao clinica, e um
   endereco publico e um endereco que qualquer pessoa abre.

   O caminho de cada ficheiro e:
       doentes/<doente_id>/agendamentos/<agendamento_id>/<ficheiro>
   O doente_id no caminho nao e decoracao: e o que permite a regra de acesso
   abaixo saber de quem e o ficheiro sem ter de consultar outra tabela.
   ============================================================================ */

insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', false)
on conflict (id) do nothing;

/* ---------------------------------------------------------------------------
   REGRAS DE ACESSO AOS FICHEIROS
   Os profissionais gerem; o doente le apenas o que esta debaixo da sua pasta.
   Nao ha politica de escrita para o doente: os documentos sao da equipa.
   --------------------------------------------------------------------------- */
drop policy if exists "profissionais gerem anexos" on storage.objects;
create policy "profissionais gerem anexos" on storage.objects
  for all
  using (bucket_id = 'anexos' and is_profissional())
  with check (bucket_id = 'anexos' and is_profissional());

drop policy if exists "doente le os seus anexos" on storage.objects;
create policy "doente le os seus anexos" on storage.objects
  for select
  using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[2] = meu_doente_id()::text
  );

/* ---------------------------------------------------------------------------
   INDICE DOS ANEXOS
   O Storage guarda os ficheiros; esta tabela guarda o que eles sao. Sem ela
   so havia nomes de ficheiro, e "doc1.pdf" nao diz nada a ninguem.
   --------------------------------------------------------------------------- */
create table if not exists anexos (
  id              uuid primary key default gen_random_uuid(),
  doente_id       uuid not null references doentes(id) on delete cascade,
  agendamento_id  uuid references agendamentos(id) on delete cascade,

  caminho         text not null unique,
  nome            text not null,
  descricao       text,
  tipo_mime       text,
  tamanho         bigint,

  carregado_por   uuid references auth.users(id),
  carregado_nome  text not null,
  criado_em       timestamptz default now()
);

comment on table anexos is
  'Indice dos ficheiros guardados no balde "anexos". Uma linha por ficheiro.';

create index if not exists anexos_agendamento_idx on anexos (agendamento_id);
create index if not exists anexos_doente_idx on anexos (doente_id, criado_em desc);

alter table anexos enable row level security;

drop policy if exists "profissionais gerem o indice de anexos" on anexos;
create policy "profissionais gerem o indice de anexos" on anexos
  for all using (is_profissional()) with check (is_profissional());

drop policy if exists "doente ve os seus anexos" on anexos;
create policy "doente ve os seus anexos" on anexos
  for select using (doente_id = meu_doente_id());


-- ============================================================================
-- 020_alta_seguimento.sql
-- Relatório de alta do acompanhamento
-- ============================================================================

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


-- ============================================================================
-- 021_lumi_pediatria.sql
-- ADAPTAÇÃO PEDIÁTRICA — é esta que torna a base de dados do Lumi
-- ============================================================================

-- ============================================================================
-- LUMI — Adaptação pediátrica
-- Migração 021 · executar no SQL Editor do Supabase, depois das anteriores
--
-- O QUE ESTA MIGRAÇÃO FAZ, E PORQUÊ
--
-- O esquema da plataforma de adultos serve quase todo: uma criança queimada
-- tem igualmente um registo, um formulário de alta, metas, exercícios,
-- consultas e dúvidas. O que muda é quem responde, com que instrumento, e
-- em que momento — e é só isso que esta migração acrescenta.
--
-- Tudo aqui é aditivo. Nenhuma coluna existente é alterada ou removida,
-- para que a mesma base de dados possa servir as duas plataformas durante o
-- piloto. Em produção, a Unidade de Queimados Pediátricos deve ter o seu
-- próprio projeto Supabase — ver a secção "Base de dados própria" do
-- GUIA-BACKEND.md.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. QUEM RESPONDE, QUANDO, E COM QUE BATERIA
--
--    Na versão de adultos bastava saber o instrumento: respondia sempre o
--    próprio. Aqui a mesma pergunta pode ser respondida pela criança ou por
--    quem cuida, e a resposta não quer dizer o mesmo nos dois casos. Uma
--    pontuação de dor dada pela mãe de um bebé é uma observação; a mesma
--    pontuação dada por um adolescente é um autorrelato. Guardar isto é a
--    diferença entre poder e não poder interpretar a série ao longo do
--    tempo — sobretudo porque a criança muda de faixa durante o seguimento.
-- ---------------------------------------------------------------------------
alter table proms_respostas
  add column if not exists respondente   text check (respondente in ('crianca','cuidador')),
  add column if not exists faixa_etaria  text,
  add column if not exists momento       text,
  add column if not exists idade_anos    int;

comment on column proms_respostas.respondente is
  'Quem preencheu: a própria criança ou quem cuida dela. A mesma pontuação não significa o mesmo nos dois casos.';
comment on column proms_respostas.faixa_etaria is
  'Faixa da bateria aplicada: 0-4, 5-10 ou 11-17. Ver assets/js/proms-pediatricos.js.';
comment on column proms_respostas.momento is
  'Momento do núcleo de valor: alta, 2s, 3m, 12m ou anual. Ancorados na ALTA, não na data da queimadura.';
comment on column proms_respostas.idade_anos is
  'Idade em anos completos à data da resposta. Guardada porque a idade de hoje não serve para ler uma resposta de há três anos.';

create index if not exists proms_momento_idx on proms_respostas (doente_id, momento);

-- ---------------------------------------------------------------------------
-- 2. REVISÃO DE SISTEMAS PEDIÁTRICA
--
--    Substitui o BURN-OP, que é um instrumento de adultos (pergunta por
--    varizes, álcool e gravidez — ver a nota em assets/js/main.js). As
--    colunas burnop_* da migração 013 ficam onde estão, sem uso nesta
--    plataforma.
--
--    Não há coluna de pontuação porque não há limiar publicado para esta
--    lista. Guarda-se quantos sinais ficaram positivos e QUAIS: numa
--    criança, três sinais de sono não querem dizer o mesmo que três sinais
--    de retração cicatricial.
-- ---------------------------------------------------------------------------
alter table formularios_alta
  add column if not exists revisao_ped_sinais      int,
  add column if not exists revisao_ped_respondidas int,
  add column if not exists revisao_ped_positivos   jsonb;

comment on column formularios_alta.revisao_ped_positivos is
  'Os sinais positivos da revisão de sistemas pediátrica, com o grupo a que pertencem. Sem pontuação: a lista não tem limiar validado.';

-- ---------------------------------------------------------------------------
-- 3. CONTEXTO DA CRIANÇA
--
--    A escola fica no registo da criança e não no formulário de alta porque
--    muda com o ano letivo e o formulário é um retrato de um dia. O regresso
--    à escola é um dos resultados do núcleo de valor em queimados — o
--    equivalente ao "regresso ao trabalho" dos adultos.
-- ---------------------------------------------------------------------------
alter table doentes
  add column if not exists escola              text,
  add column if not exists ano_escolaridade    text,
  add column if not exists cuidador_principal  text,
  add column if not exists cuidador_parentesco text,
  add column if not exists cuidador_contacto   text;

comment on column doentes.cuidador_principal is
  'Quem assegura os cuidados em casa. É esta pessoa que recebe os avisos e que preenche os questionários nas idades mais baixas.';
comment on column doentes.escola is
  'Escola, creche ou ama. Serve o regresso à escola, que é o resultado pediátrico equivalente ao regresso ao trabalho nos adultos.';

-- ---------------------------------------------------------------------------
-- 4. A CONTA DE ACESSO É, POR OMISSÃO, DE QUEM CUIDA
--
--    Em adultos a conta é do próprio e a do familiar é a exceção. Aqui é ao
--    contrário: uma criança de três anos não tem conta. A coluna já existe
--    (contas_acesso.titular_tipo) — o que muda é a omissão.
-- ---------------------------------------------------------------------------
alter table contas_acesso
  alter column titular_tipo set default 'familiar';

-- ---------------------------------------------------------------------------
-- 5. VERIFICAÇÃO
--    Correr isto depois: devolve uma linha por coluna acrescentada.
-- ---------------------------------------------------------------------------
-- select table_name, column_name
--   from information_schema.columns
--  where (table_name = 'proms_respostas'  and column_name in ('respondente','faixa_etaria','momento','idade_anos'))
--     or (table_name = 'formularios_alta' and column_name like 'revisao_ped_%')
--     or (table_name = 'doentes'          and column_name in ('escola','ano_escolaridade','cuidador_principal','cuidador_parentesco','cuidador_contacto'))
--  order by table_name, column_name;


-- ============================================================================
-- 022_colunas_em_falta.sql
-- Três colunas que o site usava e que nenhuma migração criava
-- ============================================================================

-- ============================================================================
-- LUMI — Três colunas que o site usa e que nenhuma migração criava
-- Migração 022 · executar no SQL Editor do Supabase, depois da 021
--
-- O QUE ISTO CORRIGE
-- O Formulário de Alta escreve três campos na tabela "doentes" — o email de
-- contacto, o género e o gestor de caso — e a ficha da criança e a área da
-- família leem o gestor de caso. Nenhum dos três estava em migração nenhuma.
--
-- Na base de dados da plataforma de adultos as colunas existem: foram
-- acrescentadas à mão, no painel, e ninguém as escreveu num ficheiro. O
-- resultado é que tudo funcionava lá e partiria à primeira instalação num
-- projeto novo — e de uma forma particularmente desagradável, porque a
-- avaliação de alta inteira seria preenchida e só rebentaria ao gravar, com
-- um erro do PostgREST a dizer que a coluna não existe.
--
-- Esta migração fecha esse buraco. Correr isto numa base de dados que já
-- tenha as colunas não faz nada (o "if not exists" trata disso).
-- ============================================================================

alter table doentes
  add column if not exists email           text,
  add column if not exists genero          text,
  add column if not exists gestor_caso_id  uuid references perfis(id);

comment on column doentes.email is
  'Email de contacto de quem cuida da criança, recolhido no Formulário de Alta.';
comment on column doentes.genero is
  'Texto livre com o que foi escolhido no formulário (Feminino, Masculino, Outro).';
comment on column doentes.gestor_caso_id is
  'O profissional que fica responsável por esta criança. Aponta para perfis(id), e é esse nome que a família vê em primeiro lugar, marcado com estrela, na lista da sua equipa.';

create index if not exists doentes_gestor_caso_idx on doentes (gestor_caso_id);


-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'doentes'
   and column_name in ('email','genero','gestor_caso_id')
 order by column_name;


-- ============================================================================
-- 023_privilegios.sql
-- Privilégios de tabela — sem isto o login não lê o próprio perfil
-- ============================================================================

-- ============================================================================
-- Migração 023 — privilégios de tabela para as contas autenticadas
-- Executar no SQL Editor do Supabase
-- ============================================================================
--
-- O SINTOMA
--
-- Instalação nova, tudo criado, perfis ligados às contas — e o login falhava
-- com "Este login não tem um perfil associado na tabela 'perfis'". A linha
-- estava lá: via-se no SQL Editor. O site é que não a conseguia ler.
--
-- A CAUSA
--
-- O esquema nunca concedeu privilégios nas tabelas. Concede "execute" em três
-- funções (migrações 014 e 017) e mais nada. Durante anos isso não se notou,
-- porque os projetos Supabase mais antigos vinham configurados com
--
--     alter default privileges in schema public
--       grant all on tables to anon, authenticated, service_role;
--
-- e portanto tudo o que fosse criado ficava automaticamente acessível. Os
-- projetos criados agora já não trazem isso. As tabelas nascem sem
-- privilégios para ninguém, e o PostgREST responde
--
--     42501  permission denied for table perfis
--
-- GRANT E ROW LEVEL SECURITY SÃO COISAS DIFERENTES
--
-- É fácil confundi-las, e eu confundi-as ao diagnosticar isto. Um GRANT abre
-- a porta da tabela; a RLS decide quais as linhas que se veem lá dentro. Sem
-- GRANT nem se entra — e o erro é "permission denied", não uma lista vazia.
-- Foi por isso que um pedido anónimo parecia estar a ser bloqueado pela RLS
-- quando, na verdade, estava a ser bloqueado antes disso.
--
-- O QUE ESTA MIGRAÇÃO FAZ, E O QUE NÃO FAZ
--
-- Concede privilégios de tabela a "authenticated", e a mais ninguém.
--
-- Em particular NÃO concede nada a "anon". A Supabase, por omissão, concedia
-- a ambos; aqui não faz sentido nenhum. Todas as páginas desta plataforma
-- exigem sessão iniciada, e nenhuma lê dados sem login. Um visitante sem
-- conta continua a receber "permission denied" em todas as tabelas — que é
-- uma camada a mais, antes sequer de a RLS ser consultada.
--
-- Quem decide o que cada conta autenticada vê continua a ser a RLS, definida
-- no schema.sql e nas migrações. Esta migração não lhe toca.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Entrar no esquema
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

-- ---------------------------------------------------------------------------
-- 2. As tabelas, UMA A UMA
--
--    Porquê um ciclo, e não "grant ... on all tables in schema public"?
--    Porque essa forma, corrida no SQL Editor deste projeto, não teve efeito
--    nenhum: a seguir a executá-la sem erro, a tabela "perfis" continuava com
--    authenticated=Dxtm — truncar, referenciar, gatilhos — e sem um único dos
--    quatro verbos que interessam. O mesmo "grant" dirigido a uma tabela
--    concreta funcionou à primeira.
--
--    Não vale a pena depender de perceber porquê. O ciclo abaixo faz um
--    "grant" explícito por tabela, e diz no fim quantas tratou.
--
--    Os quatro verbos, porque a aplicação usa os quatro: lê, cria, corrige e
--    apaga. QUAIS as linhas em que cada conta os pode usar continua a ser
--    assunto da Row Level Security — isto só abre a porta da tabela.
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
  n int := 0;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.tablename);
    n := n + 1;
  end loop;
  raise notice 'Privilégios concedidos em % tabelas.', n;
end $$;

-- ---------------------------------------------------------------------------
-- 3. As funções
--
--    As migrações 014 e 017 já concediam execute nas suas. A do contador de
--    acessos, reconstruída na 005, não tinha ninguém a concedê-la.
-- ---------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
  loop
    execute format('grant execute on function %s to authenticated', f.assinatura);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. E para o que vier a ser criado
--
--    Sem isto, a próxima migração que acrescente uma tabela repõe o problema,
--    e o próximo a depurá-lo perde a mesma tarde que se perdeu aqui.
-- ---------------------------------------------------------------------------
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant execute on functions to authenticated;


-- ============================================================================
-- VERIFICAÇÃO
-- ----------------------------------------------------------------------------
-- Usa has_table_privilege() e não information_schema.role_table_grants: essa
-- vista só mostra privilégios de papéis ATIVOS na sessão, e a sessão do SQL
-- Editor é "postgres", que não é membro de "authenticated". A vista devolvia
-- zero mesmo com os privilégios bem concedidos — um falso alarme que custou
-- uma volta a esta instalação.
-- ============================================================================
select 'perfis legível por quem tem sessão' as verificacao,
       case when has_table_privilege('authenticated', 'public.perfis', 'select')
            then 'ok' else '### NÃO — o login não vai funcionar' end as estado
union all
select 'tabelas legíveis por quem tem sessão',
       count(*) filter (where has_table_privilege('authenticated', (schemaname||'.'||tablename)::regclass, 'select'))::text
       || ' de ' || count(*)::text
  from pg_tables where schemaname = 'public'
union all
select 'tabelas legíveis por quem NÃO tem sessão',
       case when count(*) filter (where has_table_privilege('anon', (schemaname||'.'||tablename)::regclass, 'select')) = 0
            then 'ok (nenhuma, como deve ser)'
            else '### ' || count(*) filter (where has_table_privilege('anon', (schemaname||'.'||tablename)::regclass, 'select'))::text || ' acessíveis' end
  from pg_tables where schemaname = 'public'
union all
select 'função do contador de acessos executável',
       case when has_function_privilege('authenticated', 'public.registar_acesso_doente()', 'execute')
            then 'ok' else '### não' end
union all
select 'row level security continua ligada',
       case when count(*) = 0 then 'ok' else '### desligada em ' || count(*) end
  from pg_tables where schemaname = 'public' and rowsecurity = false;


-- ============================================================================
-- VERIFICAÇÃO — o que deve ver no fim
-- ----------------------------------------------------------------------------
-- A consulta abaixo corre sozinha e devolve uma linha por coisa que tinha de
-- ficar criada, com "ok" ou "FALTA". Se alguma disser FALTA, alguma coisa
-- correu mal acima.
-- ============================================================================
select 'tabelas base'            as verificacao,
       case when count(*) = 9  then 'ok' else 'FALTA (' || count(*) || ' de 9)'  end as estado
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('doentes','perfis','contas_acesso','formularios_alta',
                      'proms_respostas','metas','plano_exercicios','plano_registos','duvidas')
union all
select 'tabelas acrescentadas pelas migrações',
       case when count(*) = 12 then 'ok' else 'FALTA (' || count(*) || ' de 12)' end
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('comunicacoes_equipa','metas_atualizacoes','alertas_tratados',
                      'integracoes_config','notificacoes_config','notificacoes_destinatarios',
                      'consultas_72h','satisfacao_pedidos','consultas','consultas_auditoria',
                      'anexos','altas_seguimento')
union all
select 'tabelas das migrações 001-005',
       case when count(*) = 4  then 'ok' else 'FALTA (' || count(*) || ' de 4)'  end
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('historico_clinico','agendamentos','checkins_humor','avaliacoes_recursos')
union all
select 'colunas pediátricas em proms_respostas (migração 021)',
       case when count(*) = 4  then 'ok' else 'FALTA (' || count(*) || ' de 4)'  end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'proms_respostas'
   and column_name in ('respondente','faixa_etaria','momento','idade_anos')
union all
select 'colunas pediátricas em doentes (migração 021)',
       case when count(*) = 5  then 'ok' else 'FALTA (' || count(*) || ' de 5)'  end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'doentes'
   and column_name in ('escola','ano_escolaridade','cuidador_principal','cuidador_parentesco','cuidador_contacto')
union all
select 'revisão de sistemas pediátrica em formularios_alta (migração 021)',
       case when count(*) = 3  then 'ok' else 'FALTA (' || count(*) || ' de 3)'  end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'formularios_alta'
   and column_name like 'revisao_ped_%'
union all
select 'colunas do gestor de caso e contacto (migração 022)',
       case when count(*) = 3  then 'ok' else 'FALTA (' || count(*) || ' de 3)'  end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'doentes'
   and column_name in ('email','genero','gestor_caso_id')
union all
select 'bucket das fotos das metas',
       case when count(*) = 1  then 'ok' else 'FALTA — criar no painel (Storage)' end
  from storage.buckets where id = 'fotos-metas'
union all
select 'row level security ligada em todas as tabelas',
       case when count(*) = 0  then 'ok' else 'FALTA em ' || count(*) || ' tabela(s)' end
  from pg_tables
 where schemaname = 'public' and rowsecurity = false;


-- ============================================================================
-- OPCIONAL — AVISOS POR EMAIL À EQUIPA
-- ----------------------------------------------------------------------------
-- Só depois de publicar as Edge Functions deste projeto. Enquanto estas três
-- linhas não existirem, a plataforma funciona na mesma: os gatilhos avisam no
-- log do Postgres e seguem em frente, sem email e sem erro para o utilizador.
--
-- Tire os comentários e substitua os valores entre < >:
--
-- insert into integracoes_config (chave, valor) values
--   ('url_notificar_equipa',      'https://<ref-do-projeto>.supabase.co/functions/v1/notificar-equipa'),
--   ('url_convidar_satisfacao',   'https://<ref-do-projeto>.supabase.co/functions/v1/convidar-satisfacao'),
--   ('segredo_webhook',           '<invente uma frase longa e use a mesma no segredo SEGREDO_WEBHOOK da função>'),
--   ('chave_anon',                '<a chave publicável / anon deste projeto>')
-- on conflict (chave) do update set valor = excluded.valor;
--
-- A chave anon pode ir para aqui sem receio: já está no site, em
-- assets/js/supabase-config.js, e é pública por desenho. Quem autoriza de
-- facto é o segredo do webhook, verificado pelo código da função.
-- ============================================================================
