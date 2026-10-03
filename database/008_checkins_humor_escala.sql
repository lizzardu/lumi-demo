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
