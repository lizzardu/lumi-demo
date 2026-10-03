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
