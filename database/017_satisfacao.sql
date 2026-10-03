/* ============================================================================
   LUMI - Avaliacao da satisfacao do doente (PREM)
   Migracao 017 - executar no SQL Editor do Supabase

   Dois questionarios, do documento da equipa:
     breve - depois de cada teleconsulta, cerca de 1 minuto
     final - na alta do seguimento em telessaude, cerca de 3 minutos

   O questionario nao aparece sozinho: e a equipa que o pede, no fim da
   consulta. Cada pedido e uma linha desta tabela, e cada linha tem tres
   desfechos possiveis - respondida, recusada, ou por responder. Guardar a
   recusa e tao importante como guardar a resposta: sem isso nao se distingue
   quem nao quis responder de quem nunca chegou a ver o pedido, e a taxa de
   resposta deixa de querer dizer alguma coisa.

   Quem responde e sempre o doente. A equipa cria o pedido e le o resultado.
   ============================================================================ */

create table if not exists satisfacao_pedidos (
  id                 uuid primary key default gen_random_uuid(),
  doente_id          uuid not null references doentes(id) on delete cascade,
  tipo               text not null check (tipo in ('breve','final')),

  pedido_por_id      uuid references auth.users(id),
  pedido_por_nome    text not null,
  criado_em          timestamptz not null default now(),

  estado             text not null default 'pendente'
                     check (estado in ('pendente','respondida','recusada')),

  respostas          jsonb,
  satisfacao_global  smallint check (satisfacao_global between 0 and 10),
  respondido_em      timestamptz,
  recusado_em        timestamptz,

  /* consulta a que este pedido diz respeito, quando houver marcacao */
  agendamento_id     uuid references agendamentos(id)
);

comment on table satisfacao_pedidos is
  'Um pedido de avaliacao da satisfacao por consulta. A equipa cria; o doente responde ou recusa.';
comment on column satisfacao_pedidos.satisfacao_global is
  'Copia da pergunta 0-10, em coluna propria por ser a metrica que se acompanha ao longo do tempo.';

create index if not exists satisfacao_doente_idx
  on satisfacao_pedidos (doente_id, criado_em desc);
create index if not exists satisfacao_pendentes_idx
  on satisfacao_pedidos (doente_id) where estado = 'pendente';

/* ---------------------------------------------------------------------------
   REGRAS DE ACESSO

   O doente le os seus pedidos, mas nao escreve nesta tabela. Responder e
   recusar passam pelas duas funcoes abaixo, que correm com privilegios do
   dono: as politicas do Postgres sao por linha e nao por coluna, e uma
   politica de UPDATE deixaria o doente reescrever tambem quem pediu, quando,
   e de que tipo era o questionario.
   --------------------------------------------------------------------------- */
alter table satisfacao_pedidos enable row level security;

drop policy if exists "profissionais pedem avaliacao" on satisfacao_pedidos;
create policy "profissionais pedem avaliacao" on satisfacao_pedidos
  for insert with check (is_profissional() and pedido_por_id = auth.uid());

drop policy if exists "profissionais veem avaliacoes" on satisfacao_pedidos;
create policy "profissionais veem avaliacoes" on satisfacao_pedidos
  for select using (is_profissional());

drop policy if exists "doente ve os seus pedidos" on satisfacao_pedidos;
create policy "doente ve os seus pedidos" on satisfacao_pedidos
  for select using (doente_id = meu_doente_id());

/* ---------------------------------------------------------------------------
   RESPONDER E RECUSAR
   Ambas so mexem em pedidos do proprio doente e ainda pendentes: um
   questionario respondido nao se reescreve depois.
   --------------------------------------------------------------------------- */
create or replace function responder_satisfacao(
  p_pedido uuid,
  p_respostas jsonb,
  p_global smallint default null
) returns satisfacao_pedidos
language plpgsql
security definer
set search_path = public
as $$
declare
  linha satisfacao_pedidos;
begin
  update satisfacao_pedidos
     set respostas = p_respostas,
         satisfacao_global = p_global,
         estado = 'respondida',
         respondido_em = now()
   where id = p_pedido
     and doente_id = meu_doente_id()
     and estado = 'pendente'
  returning * into linha;

  if linha.id is null then
    raise exception 'Pedido inexistente, ja respondido ou de outro doente.';
  end if;
  return linha;
end $$;

create or replace function recusar_satisfacao(p_pedido uuid)
returns satisfacao_pedidos
language plpgsql
security definer
set search_path = public
as $$
declare
  linha satisfacao_pedidos;
begin
  update satisfacao_pedidos
     set estado = 'recusada',
         recusado_em = now()
   where id = p_pedido
     and doente_id = meu_doente_id()
     and estado = 'pendente'
  returning * into linha;

  if linha.id is null then
    raise exception 'Pedido inexistente, ja fechado ou de outro doente.';
  end if;
  return linha;
end $$;

revoke all on function responder_satisfacao(uuid, jsonb, smallint) from public;
revoke all on function recusar_satisfacao(uuid) from public;
grant execute on function responder_satisfacao(uuid, jsonb, smallint) to authenticated;
grant execute on function recusar_satisfacao(uuid) to authenticated;

/* ---------------------------------------------------------------------------
   CONVITE POR EMAIL
   O mesmo mecanismo dos avisos a equipa (ver 011 e 012): a base de dados
   chama uma Edge Function, que e quem tem a chave do fornecedor de email.
   O endereco do doente nunca passa pelo browser de ninguem.

   Enquanto a funcao nao estiver publicada e configurada, o gatilho nao faz
   nada: o pedido continua a ser criado e o pop-up continua a aparecer ao
   doente. O email e um reforco, nao o unico caminho.
   --------------------------------------------------------------------------- */
create or replace function convidar_para_satisfacao()
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
  select valor into endereco from integracoes_config where chave = 'url_convidar_satisfacao';
  select valor into segredo  from integracoes_config where chave = 'segredo_webhook';
  select valor into anon     from integracoes_config where chave = 'chave_anon';

  if endereco is null or segredo is null or anon is null then
    return new;
  end if;

  perform net.http_post(
    url     := endereco,
    headers := jsonb_build_object(
                 'Content-Type',    'application/json',
                 'Authorization',   'Bearer ' || anon,
                 'x-lumi-segredo', segredo
               ),
    body    := jsonb_build_object('pedido_id', new.id)
  );
  return new;
exception when others then
  raise warning 'Falhou o convite de satisfacao por email: %', sqlerrm;
  return new;
end $$;

drop trigger if exists trg_convidar_satisfacao on satisfacao_pedidos;
create trigger trg_convidar_satisfacao
  after insert on satisfacao_pedidos
  for each row execute function convidar_para_satisfacao();
