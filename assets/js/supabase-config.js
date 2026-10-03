/* ============================================================================
   Lumi — ligação ao Supabase
   ============================================================================
   Os dois valores que o site precisa para falar com a base de dados.

   A CHAVE QUE AQUI ESTÁ É PÚBLICA, E É SUPOSTO SÊ-LO

   É a chave publicável (sb_publishable_...), que a Supabase descreve assim:
   "anyone can read it, so it only reaches what Row Level Security allows".
   Vai no código de todas as páginas, chega ao browser de quem abre o site, e
   está publicada no repositório. Nada disso é um descuido.

   Quem protege os dados é a Row Level Security, definida em database/, não
   esta chave. Sem sessão iniciada, um pedido com ela recebe
   "42501 permission denied" em todas as tabelas — está verificado.

   O QUE NUNCA PODE VIR PARA AQUI

   A chave secreta (sb_secret_...) e a service_role. Essas ignoram a Row Level
   Security por completo: quem as tivesse lia os dados de todos os doentes
   sem precisar de conta nenhuma.

   ONDE SE ENCONTRAM OS VALORES CERTOS

   No painel do projeto, botão Connect, no topo. Ou pela engrenagem das
   definições, em API Keys. O endereço é o Project URL.

   PARA UM PILOTO CLÍNICO

   Este ficheiro aponta para o projeto de demonstração. Uma utilização com
   doentes reais deve ter o seu próprio projeto Supabase, e portanto os seus
   próprios valores aqui — ver a primeira secção do GUIA-BACKEND.md.
   ========================================================================= */

window.LUMI_CONFIG = {
  SUPABASE_URL: "https://hgtueqpgqxfxthvqspge.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_3MXCTV-neEZh3U9RaOO8Yw_-D-HSs0W"
};


