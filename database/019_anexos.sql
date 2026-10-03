/* ============================================================================
   LUMI - Documentos associados as marcacoes
   Migracao 019 - executar no SQL Editor do Supabase

   A equipa pode anexar a uma marcacao o que o doente precisa de ter: uma
   preparacao para exame, um folheto, uma credencial. Os ficheiros vao para
   o Storage do Supabase, num balde PRIVADO - ao contrario do balde das fotos
   das metas, que e publico. Aqui pode haver informacao clinica, e um
   endereco publico e um endereco que qualquer pessoa abre.

   O caminho de cada ficheiro e:
       doentes/<doente_id>/agendamentos/<agendamento_id>/<ficheiro>
   O doente_id no caminho nao e decoracao: e o que permite a regra de acesso
   abaixo saber de quem e o ficheiro sem ter de consultar outra tabela.
   ============================================================================ */

insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', false)
on conflict (id) do nothing;

/* ---------------------------------------------------------------------------
   REGRAS DE ACESSO AOS FICHEIROS
   Os profissionais gerem; o doente le apenas o que esta debaixo da sua pasta.
   Nao ha politica de escrita para o doente: os documentos sao da equipa.
   --------------------------------------------------------------------------- */
drop policy if exists "profissionais gerem anexos" on storage.objects;
create policy "profissionais gerem anexos" on storage.objects
  for all
  using (bucket_id = 'anexos' and is_profissional())
  with check (bucket_id = 'anexos' and is_profissional());

drop policy if exists "doente le os seus anexos" on storage.objects;
create policy "doente le os seus anexos" on storage.objects
  for select
  using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[2] = meu_doente_id()::text
  );

/* ---------------------------------------------------------------------------
   INDICE DOS ANEXOS
   O Storage guarda os ficheiros; esta tabela guarda o que eles sao. Sem ela
   so havia nomes de ficheiro, e "doc1.pdf" nao diz nada a ninguem.
   --------------------------------------------------------------------------- */
create table if not exists anexos (
  id              uuid primary key default gen_random_uuid(),
  doente_id       uuid not null references doentes(id) on delete cascade,
  agendamento_id  uuid references agendamentos(id) on delete cascade,

  caminho         text not null unique,
  nome            text not null,
  descricao       text,
  tipo_mime       text,
  tamanho         bigint,

  carregado_por   uuid references auth.users(id),
  carregado_nome  text not null,
  criado_em       timestamptz default now()
);

comment on table anexos is
  'Indice dos ficheiros guardados no balde "anexos". Uma linha por ficheiro.';

create index if not exists anexos_agendamento_idx on anexos (agendamento_id);
create index if not exists anexos_doente_idx on anexos (doente_id, criado_em desc);

alter table anexos enable row level security;

drop policy if exists "profissionais gerem o indice de anexos" on anexos;
create policy "profissionais gerem o indice de anexos" on anexos
  for all using (is_profissional()) with check (is_profissional());

drop policy if exists "doente ve os seus anexos" on anexos;
create policy "doente ve os seus anexos" on anexos
  for select using (doente_id = meu_doente_id());
