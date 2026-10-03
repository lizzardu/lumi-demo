-- ============================================================================
-- LUMI — Diagnóstico dos avisos por email
-- Correr no SQL Editor do Supabase, bloco a bloco, pela ordem.
--
-- Serve para localizar onde é que a cadeia se parte:
--   doente grava dúvida → gatilho → Edge Function → Resend → caixa de correio
--
-- Não altera nada, exceto o bloco 5, que envia um aviso de teste a sério.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- BLOCO 1 — A configuração está lá?
-- Devem aparecer TRÊS linhas: url_notificar_equipa, segredo_webhook e
-- chave_anon. Se faltar a chave_anon, é essa a causa (ver migração 012).
-- ----------------------------------------------------------------------------
select chave,
       case when chave = 'segredo_webhook'
            then '(definido, ' || length(valor) || ' caracteres)'
            else valor end as valor
  from integracoes_config
 order by chave;


-- ----------------------------------------------------------------------------
-- BLOCO 2 — Os gatilhos existem e estão ativos?
-- tgenabled = 'O' significa ativo. Devem aparecer duas linhas.
-- ----------------------------------------------------------------------------
select tgname                as gatilho,
       tgrelid::regclass     as tabela,
       tgenabled             as estado
  from pg_trigger
 where tgname in ('trg_avisar_duvida', 'trg_avisar_prom');


-- ----------------------------------------------------------------------------
-- BLOCO 3 — O gatilho já é a versão corrigida?
-- Tem de dizer "true". Se disser "false", falta correr a migração 012 —
-- é a versão antiga, que não envia o cabeçalho Authorization.
-- ----------------------------------------------------------------------------
select position('Authorization' in prosrc) > 0 as envia_authorization
  from pg_proc
 where proname = 'avisar_equipa_por_email';


-- ----------------------------------------------------------------------------
-- BLOCO 4 — Há destinatários e os avisos estão ligados?
-- Sem destinatários ativos, a função responde "sem destinatários" e não envia.
-- ----------------------------------------------------------------------------
select email, ativo from notificacoes_destinatarios order by criado_em;
select * from notificacoes_config;


-- ----------------------------------------------------------------------------
-- BLOCO 5 — Disparar um aviso de teste e guardar o número do pedido.
-- Isto envia um email a sério, se tudo estiver bem.
-- Anote o "request_id" que aparecer.
-- ----------------------------------------------------------------------------
select net.http_post(
         url     := (select valor from integracoes_config where chave = 'url_notificar_equipa'),
         headers := jsonb_build_object(
                      'Content-Type',    'application/json',
                      'Authorization',   'Bearer ' || (select valor from integracoes_config where chave = 'chave_anon'),
                      'x-lumi-segredo', (select valor from integracoes_config where chave = 'segredo_webhook')
                    ),
         body    := jsonb_build_object('type', 'INSERT', 'table', 'duvidas')
       ) as request_id;


-- ----------------------------------------------------------------------------
-- BLOCO 6 — A RESPOSTA REAL. Corra este bloco uns segundos depois do 5.
-- É aqui que se vê o que aconteceu de facto:
--
--   200 + {"enviado":true}          → correu tudo; o email saiu
--   200 + "sem destinatários"       → falta acrescentar o email nas Definições
--   200 + "aviso desligado"         → o interruptor está desligado
--   401 + UNAUTHORIZED_NO_AUTH...   → falta a chave_anon (migração 012)
--   401 + "Não autorizado"          → o SEGREDO_WEBHOOK não coincide com o
--                                     que está em integracoes_config
--   502                             → o Resend recusou; ver os Logs da função
--   404                             → a função não está publicada com este nome
-- ----------------------------------------------------------------------------
select id,
       status_code,
       content,
       error_msg,
       created
  from net._http_response
 order by id desc
 limit 5;
