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
