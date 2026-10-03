-- ============================================================================
-- LUMI — Adaptação pediátrica
-- Migração 021 · executar no SQL Editor do Supabase, depois das anteriores
--
-- O QUE ESTA MIGRAÇÃO FAZ, E PORQUÊ
--
-- O esquema da plataforma de adultos serve quase todo: uma criança queimada
-- tem igualmente um registo, um formulário de alta, metas, exercícios,
-- consultas e dúvidas. O que muda é quem responde, com que instrumento, e
-- em que momento — e é só isso que esta migração acrescenta.
--
-- Tudo aqui é aditivo. Nenhuma coluna existente é alterada ou removida,
-- para que a mesma base de dados possa servir as duas plataformas durante o
-- piloto. Em produção, a Unidade de Queimados Pediátricos deve ter o seu
-- próprio projeto Supabase — ver a secção "Base de dados própria" do
-- GUIA-BACKEND.md.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. QUEM RESPONDE, QUANDO, E COM QUE BATERIA
--
--    Na versão de adultos bastava saber o instrumento: respondia sempre o
--    próprio. Aqui a mesma pergunta pode ser respondida pela criança ou por
--    quem cuida, e a resposta não quer dizer o mesmo nos dois casos. Uma
--    pontuação de dor dada pela mãe de um bebé é uma observação; a mesma
--    pontuação dada por um adolescente é um autorrelato. Guardar isto é a
--    diferença entre poder e não poder interpretar a série ao longo do
--    tempo — sobretudo porque a criança muda de faixa durante o seguimento.
-- ---------------------------------------------------------------------------
alter table proms_respostas
  add column if not exists respondente   text check (respondente in ('crianca','cuidador')),
  add column if not exists faixa_etaria  text,
  add column if not exists momento       text,
  add column if not exists idade_anos    int;

comment on column proms_respostas.respondente is
  'Quem preencheu: a própria criança ou quem cuida dela. A mesma pontuação não significa o mesmo nos dois casos.';
comment on column proms_respostas.faixa_etaria is
  'Faixa da bateria aplicada: 0-4, 5-10 ou 11-17. Ver assets/js/proms-pediatricos.js.';
comment on column proms_respostas.momento is
  'Momento do núcleo de valor: alta, 2s, 3m, 12m ou anual. Ancorados na ALTA, não na data da queimadura.';
comment on column proms_respostas.idade_anos is
  'Idade em anos completos à data da resposta. Guardada porque a idade de hoje não serve para ler uma resposta de há três anos.';

create index if not exists proms_momento_idx on proms_respostas (doente_id, momento);

-- ---------------------------------------------------------------------------
-- 2. REVISÃO DE SISTEMAS PEDIÁTRICA
--
--    Substitui o BURN-OP, que é um instrumento de adultos (pergunta por
--    varizes, álcool e gravidez — ver a nota em assets/js/main.js). As
--    colunas burnop_* da migração 013 ficam onde estão, sem uso nesta
--    plataforma.
--
--    Não há coluna de pontuação porque não há limiar publicado para esta
--    lista. Guarda-se quantos sinais ficaram positivos e QUAIS: numa
--    criança, três sinais de sono não querem dizer o mesmo que três sinais
--    de retração cicatricial.
-- ---------------------------------------------------------------------------
alter table formularios_alta
  add column if not exists revisao_ped_sinais      int,
  add column if not exists revisao_ped_respondidas int,
  add column if not exists revisao_ped_positivos   jsonb;

comment on column formularios_alta.revisao_ped_positivos is
  'Os sinais positivos da revisão de sistemas pediátrica, com o grupo a que pertencem. Sem pontuação: a lista não tem limiar validado.';

-- ---------------------------------------------------------------------------
-- 3. CONTEXTO DA CRIANÇA
--
--    A escola fica no registo da criança e não no formulário de alta porque
--    muda com o ano letivo e o formulário é um retrato de um dia. O regresso
--    à escola é um dos resultados do núcleo de valor em queimados — o
--    equivalente ao "regresso ao trabalho" dos adultos.
-- ---------------------------------------------------------------------------
alter table doentes
  add column if not exists escola              text,
  add column if not exists ano_escolaridade    text,
  add column if not exists cuidador_principal  text,
  add column if not exists cuidador_parentesco text,
  add column if not exists cuidador_contacto   text;

comment on column doentes.cuidador_principal is
  'Quem assegura os cuidados em casa. É esta pessoa que recebe os avisos e que preenche os questionários nas idades mais baixas.';
comment on column doentes.escola is
  'Escola, creche ou ama. Serve o regresso à escola, que é o resultado pediátrico equivalente ao regresso ao trabalho nos adultos.';

-- ---------------------------------------------------------------------------
-- 4. A CONTA DE ACESSO É, POR OMISSÃO, DE QUEM CUIDA
--
--    Em adultos a conta é do próprio e a do familiar é a exceção. Aqui é ao
--    contrário: uma criança de três anos não tem conta. A coluna já existe
--    (contas_acesso.titular_tipo) — o que muda é a omissão.
-- ---------------------------------------------------------------------------
alter table contas_acesso
  alter column titular_tipo set default 'familiar';

-- ---------------------------------------------------------------------------
-- 5. VERIFICAÇÃO
--    Correr isto depois: devolve uma linha por coluna acrescentada.
-- ---------------------------------------------------------------------------
-- select table_name, column_name
--   from information_schema.columns
--  where (table_name = 'proms_respostas'  and column_name in ('respondente','faixa_etaria','momento','idade_anos'))
--     or (table_name = 'formularios_alta' and column_name like 'revisao_ped_%')
--     or (table_name = 'doentes'          and column_name in ('escola','ano_escolaridade','cuidador_principal','cuidador_parentesco','cuidador_contacto'))
--  order by table_name, column_name;
