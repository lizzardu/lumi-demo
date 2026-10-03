/* ============================================================================
   LUMI - Suspender um cuidado ou exercicio sem o apagar
   Migracao 016 - executar no SQL Editor do Supabase

   No contacto das 72 horas a equipa pode concluir que um exercicio deve
   parar: dor, ferida a agravar, material em falta. Apagar a prescricao
   resolveria a vista do doente, mas levaria com ela os registos de execucao
   e a memoria de que aquilo chegou a ser prescrito.

   Fica antes um estado. O exercicio suspenso deixa de aparecer ao doente,
   mas continua na ficha, com o historico intacto, e pode ser reativado.
   ============================================================================ */

alter table plano_exercicios
  add column if not exists estado text
  check (estado in ('ativo','suspenso')) default 'ativo';

update plano_exercicios set estado = 'ativo' where estado is null;

comment on column plano_exercicios.estado is
  'ativo: visivel ao doente. suspenso: parado pela equipa, mantido na ficha com o historico.';
