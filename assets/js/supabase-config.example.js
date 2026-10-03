/* ============================================================================
   Lumi — ligação ao Supabase (MODELO)
   ============================================================================
   Este é o modelo. O ficheiro que o site lê chama-se "supabase-config.js", no
   mesmo diretório, e está no repositório com os valores do projeto de
   demonstração — não precisa de o criar para ver o site a funcionar.

   Use este modelo quando quiser apontar o site para OUTRO projeto Supabase:
   copie os dois valores do seu projeto para lá.

   1. No painel do seu projeto, botão Connect (no topo), ou engrenagem das
      definições → API Keys.
   2. Copie o Project URL e a chave PUBLICÁVEL (sb_publishable_...).
   3. NUNCA a chave secreta (sb_secret_...) nem a service_role: essas ignoram
      a Row Level Security e dariam acesso a tudo a quem as encontrasse.

   A chave publicável é segura para expor no browser e no repositório. Quem
   protege os dados é a Row Level Security definida em database/.
   ========================================================================= */

window.LUMI_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "cole-aqui-a-sua-anon-public-key"
};
