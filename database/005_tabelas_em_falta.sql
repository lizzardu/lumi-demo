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
