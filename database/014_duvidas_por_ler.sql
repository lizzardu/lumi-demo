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
