/* ============================================================================
   LUMI — configuração de ligação ao Supabase
   ============================================================================
   1. Copie este ficheiro para "supabase-config.js" (mesmo diretório).
   2. Vá ao seu projeto em https://supabase.com/dashboard → Project Settings
      → API, e copie os dois valores abaixo.
   3. NUNCA coloque aqui a "service_role key" — apenas a "anon public key".
      A anon key é segura para expor no browser; é a Row Level Security (RLS)
      definida em database/schema.sql que protege os dados, não este ficheiro.
   4. "supabase-config.js" já está listado no .gitignore deste projeto para
      não ser confundido com o exemplo — mas como a anon key é segura para
      expor publicamente, não há problema de segurança em publicá-la no
      GitHub Pages; o ficheiro só é ignorado para evitar confusão entre
      ambientes (ex.: demo vs. produção).
   ========================================================================= */

window.LUMI_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "cole-aqui-a-sua-anon-public-key"
};
