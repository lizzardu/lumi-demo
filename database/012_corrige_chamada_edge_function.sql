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
