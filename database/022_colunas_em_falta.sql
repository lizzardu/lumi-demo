-- ============================================================================
-- LUMI — Três colunas que o site usa e que nenhuma migração criava
-- Migração 022 · executar no SQL Editor do Supabase, depois da 021
--
-- O QUE ISTO CORRIGE
-- O Formulário de Alta escreve três campos na tabela "doentes" — o email de
-- contacto, o género e o gestor de caso — e a ficha da criança e a área da
-- família leem o gestor de caso. Nenhum dos três estava em migração nenhuma.
--
-- Na base de dados da plataforma de adultos as colunas existem: foram
-- acrescentadas à mão, no painel, e ninguém as escreveu num ficheiro. O
-- resultado é que tudo funcionava lá e partiria à primeira instalação num
-- projeto novo — e de uma forma particularmente desagradável, porque a
-- avaliação de alta inteira seria preenchida e só rebentaria ao gravar, com
-- um erro do PostgREST a dizer que a coluna não existe.
--
-- Esta migração fecha esse buraco. Correr isto numa base de dados que já
-- tenha as colunas não faz nada (o "if not exists" trata disso).
-- ============================================================================

alter table doentes
  add column if not exists email           text,
  add column if not exists genero          text,
  add column if not exists gestor_caso_id  uuid references perfis(id);

comment on column doentes.email is
  'Email de contacto de quem cuida da criança, recolhido no Formulário de Alta.';
comment on column doentes.genero is
  'Texto livre com o que foi escolhido no formulário (Feminino, Masculino, Outro).';
comment on column doentes.gestor_caso_id is
  'O profissional que fica responsável por esta criança. Aponta para perfis(id), e é esse nome que a família vê em primeiro lugar, marcado com estrela, na lista da sua equipa.';

create index if not exists doentes_gestor_caso_idx on doentes (gestor_caso_id);


-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'doentes'
   and column_name in ('email','genero','gestor_caso_id')
 order by column_name;
