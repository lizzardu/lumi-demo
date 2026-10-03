-- ============================================================================
-- LUMI — PRIMEIRAS CONTAS E UMA CRIANÇA DE DEMONSTRAÇÃO
-- ============================================================================
--
-- QUANDO CORRER ISTO
-- Depois do 000_instalacao_completa.sql, e depois de ter criado as duas
-- contas no painel: Authentication → Users → Add user → Create new user.
-- Marque "Auto Confirm User" nas duas, ou o login não funciona.
--
-- Por omissão usa os emails que o site já traz preenchidos nos formulários de
-- entrada. Se usar outros, mude-os nas duas linhas assinaladas em baixo.
--
-- PORQUE É QUE ISTO É PRECISO
-- O Supabase guarda as contas de login em auth.users, que é dele. Quem decide
-- o que cada conta pode ver é a tabela "perfis", que é nossa: é ela que diz
-- se a conta é de um profissional ou da família de uma criança, e qual é a
-- criança. Uma conta sem linha em "perfis" entra e não vê nada — e foi esse o
-- erro mais comum de quem instalou isto pela primeira vez.
--
-- CORRER ISTO DUAS VEZES NÃO FAZ MAL: não duplica nada.
-- ============================================================================

do $$
declare
  -- ⬇⬇⬇ OS DOIS EMAILS QUE CRIOU NO PAINEL ⬇⬇⬇
  email_profissional constant text := 'profissional@teste.pt';
  email_familia      constant text := 'doente@teste.pt';
  -- ⬆⬆⬆

  id_profissional uuid;
  id_familia      uuid;
  id_crianca      uuid;
begin
  select id into id_profissional from auth.users where email = email_profissional;
  select id into id_familia      from auth.users where email = email_familia;

  if id_profissional is null then
    raise exception 'Não existe nenhuma conta com o email %. Crie-a primeiro em Authentication → Users (e marque Auto Confirm User).', email_profissional;
  end if;
  if id_familia is null then
    raise exception 'Não existe nenhuma conta com o email %. Crie-a primeiro em Authentication → Users (e marque Auto Confirm User).', email_familia;
  end if;

  -- ----------------------------------------------------------------------
  -- A criança de demonstração.
  --
  -- A data de nascimento não é enfeite: é ela que decide a bateria de PROMs
  -- (ver assets/js/proms-pediatricos.js) e a figura da Lumi que aparece. Com
  -- 9 anos cai na bateria dos 5-10 e na figura dos 8-10 — a faixa onde já
  -- entram o PSQ e o SCQ, que é a mais interessante de demonstrar.
  --
  -- A data de alta decide o momento do seguimento. Posta a 3 meses de hoje,
  -- a avaliação que a família encontra ao entrar é a dos 3 meses.
  -- ----------------------------------------------------------------------
  insert into doentes (nome, processo, data_nascimento, data_alta, tbsa,
                       profundidade, zona_anatomica, equipa,
                       escola, ano_escolaridade,
                       cuidador_principal, cuidador_parentesco)
  values ('Criança de Demonstração', 'PED-2026-0001',
          (current_date - interval '9 years')::date,
          (current_date - interval '3 months')::date,
          12, '2.º grau profundo', 'Antebraço e mão direitos',
          array['Cirurgia Plástica','Enfermagem','Fisioterapia','Terapia Ocupacional','Psicologia'],
          'EB1 de Demonstração', '4.º ano',
          'Cuidador de Demonstração', 'mãe')
  on conflict (processo) do update set nome = excluded.nome
  returning id into id_crianca;

  if id_crianca is null then
    select id into id_crianca from doentes where processo = 'PED-2026-0001';
  end if;

  -- ----------------------------------------------------------------------
  -- Os dois perfis
  -- ----------------------------------------------------------------------
  insert into perfis (id, papel, nome, especialidade)
  values (id_profissional, 'profissional', 'Equipa de Demonstração', 'Cirurgia Plástica')
  on conflict (id) do update
    set papel = excluded.papel, nome = excluded.nome, especialidade = excluded.especialidade;

  insert into perfis (id, papel, nome, doente_id)
  values (id_familia, 'doente', 'Cuidador de Demonstração', id_crianca)
  on conflict (id) do update
    set papel = excluded.papel, nome = excluded.nome, doente_id = excluded.doente_id;

  raise notice 'Pronto. Profissional: %  ·  Família: %  ·  Criança: %',
    email_profissional, email_familia, id_crianca;
end $$;


-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================
select p.papel,
       p.nome                         as perfil,
       u.email,
       coalesce(d.nome, '—')          as crianca,
       coalesce(d.processo, '—')      as processo,
       case when d.data_nascimento is null then '—'
            else extract(year from age(d.data_nascimento))::text || ' anos' end as idade
  from perfis p
  join auth.users u on u.id = p.id
  left join doentes d on d.id = p.doente_id
 order by p.papel;
