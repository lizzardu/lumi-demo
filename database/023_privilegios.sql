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
