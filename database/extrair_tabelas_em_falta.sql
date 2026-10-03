-- ============================================================================
-- FÉNIX — Extrair a definição das tabelas que faltam em ficheiro
--
-- NÃO ALTERA NADA. Só lê e imprime.
--
-- PARA QUE SERVE
-- As migrações do repositório começam no 006. As de 001 a 005 existiram — o
-- próprio código lhes chama pelo nome (ver assets/js/supabase-client.js, que
-- cita "004_contador_acessos.sql") — mas nunca foram commitadas. O resultado
-- é que quatro tabelas, uma função e uma coluna existem na base de dados de
-- produção e em ficheiro nenhum:
--
--     agendamentos          historico_clinico
--     checkins_humor        avaliacoes_recursos
--     registar_acesso_doente()      duvidas.contacto_telefonico
--
-- Em vez de as adivinhar a partir do código do site, tira-se aqui a definição
-- real da base de dados que está a funcionar. Corra isto no SQL Editor do
-- projeto do FÉNIX e guarde o resultado: é com ele que se escrevem as
-- migrações em falta, exatamente como estão, sem inventar nada.
--
-- São cinco consultas. No Supabase o editor mostra o resultado da última, por
-- isso corra-as UMA DE CADA VEZ (selecione o bloco e carregue em Run) e
-- guarde cada resultado.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. COLUNAS das quatro tabelas, e a coluna em falta em "duvidas"
-- ---------------------------------------------------------------------------
select table_name                                   as tabela,
       ordinal_position                             as pos,
       column_name                                  as coluna,
       data_type                                    as tipo,
       coalesce(character_maximum_length::text, '') as tamanho,
       is_nullable                                  as admite_nulo,
       coalesce(column_default, '')                 as valor_por_omissao
  from information_schema.columns
 where table_schema = 'public'
   and (table_name in ('agendamentos','checkins_humor','historico_clinico','avaliacoes_recursos')
        or (table_name = 'duvidas' and column_name = 'contacto_telefonico'))
 order by table_name, ordinal_position;


-- ---------------------------------------------------------------------------
-- 2. RESTRIÇÕES — chaves primárias, estrangeiras, únicas e check
-- ---------------------------------------------------------------------------
select rel.relname                        as tabela,
       con.conname                        as restricao,
       case con.contype when 'p' then 'primary key'
                        when 'f' then 'foreign key'
                        when 'u' then 'unique'
                        when 'c' then 'check'
                        else con.contype::text end as tipo,
       pg_get_constraintdef(con.oid)      as definicao
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
 where ns.nspname = 'public'
   and rel.relname in ('agendamentos','checkins_humor','historico_clinico','avaliacoes_recursos')
 order by rel.relname, con.contype;


-- ---------------------------------------------------------------------------
-- 3. ÍNDICES
-- ---------------------------------------------------------------------------
select tablename as tabela, indexname as indice, indexdef as definicao
  from pg_indexes
 where schemaname = 'public'
   and tablename in ('agendamentos','checkins_humor','historico_clinico','avaliacoes_recursos')
 order by tablename, indexname;


-- ---------------------------------------------------------------------------
-- 4. REGRAS DE ACESSO (RLS) — é a parte que não se pode adivinhar
-- ---------------------------------------------------------------------------
select tablename   as tabela,
       policyname  as politica,
       cmd         as operacao,
       roles::text as papeis,
       coalesce(qual, '')       as condicao_leitura,
       coalesce(with_check, '') as condicao_escrita
  from pg_policies
 where schemaname = 'public'
   and tablename in ('agendamentos','checkins_humor','historico_clinico','avaliacoes_recursos')
 order by tablename, policyname;

-- e confirmar que a RLS está mesmo ligada nas quatro
select tablename as tabela, rowsecurity as rls_ligada
  from pg_tables
 where schemaname = 'public'
   and tablename in ('agendamentos','checkins_humor','historico_clinico','avaliacoes_recursos')
 order by tablename;


-- ---------------------------------------------------------------------------
-- 5. A FUNÇÃO registar_acesso_doente(), e as colunas que ela usa
-- ---------------------------------------------------------------------------
select pg_get_functiondef(p.oid) as definicao_completa
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'registar_acesso_doente';

-- a função incrementa um contador que deve viver em "doentes" ou em "perfis";
-- isto mostra onde
select table_name as tabela, column_name as coluna, data_type as tipo
  from information_schema.columns
 where table_schema = 'public'
   and (column_name like '%acesso%' or column_name like '%contador%')
 order by table_name, column_name;
