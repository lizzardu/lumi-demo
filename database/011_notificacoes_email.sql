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
