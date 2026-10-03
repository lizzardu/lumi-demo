// ============================================================================
// LUMI — Convite para avaliar a consulta
// Supabase Edge Function · Deno
//
// Chamada pela base de dados sempre que a equipa pede uma avaliação de
// satisfação (ver o gatilho em database/017_satisfacao.sql).
//
// PORQUE CORRE NO SERVIDOR
// Duas razões. A chave do fornecedor de email não pode estar no browser, e o
// endereço do doente também não: o profissional que carrega no botão não
// chega a vê-lo, e não precisa. Aqui é lido com a chave de serviço, usado
// para enviar, e nada mais.
//
// O QUE O EMAIL LEVA
// Um convite e uma ligação. Nenhum dado clínico, nenhum número de processo,
// nem sequer o nome — o email sai do perímetro da instituição e fica numa
// caixa de correio que a ULS não controla.
//
// A ligação leva o id do pedido, mas isso não abre nada sozinho: a página
// exige sessão iniciada e a base de dados só entrega o pedido a quem for o
// próprio doente. Quem receber o email reencaminhado não vê nada.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Os segredos são partilhados por todo o projeto, e neste projeto nem todos
// têm o mesmo formato de nome: alguns levam o prefixo FENIX_, outros não.
// Em vez de exigir um nome exato — e falhar em silêncio quando não o
// encontra, que foi o que aconteceu — procura por ordem de preferência e
// diz nos registos qual usou.
function segredo(...nomes: string[]): { valor?: string; nome?: string } {
  for (const nome of nomes) {
    const valor = Deno.env.get(nome);
    if (valor) return { valor, nome };
  }
  return {};
}

const chave = segredo("RESEND_API_KEY_DOENTE", "FENIX_RESEND_API_KEY", "RESEND_API_KEY");
const remetente = segredo("EMAIL_REMETENTE_DOENTE", "FENIX_EMAIL_REMETENTE", "EMAIL_REMETENTE");
const plataforma = segredo("URL_PLATAFORMA", "FENIX_URL_PLATAFORMA");
const webhook = segredo("SEGREDO_WEBHOOK", "FENIX_SEGREDO_WEBHOOK");

const RESEND_API_KEY = chave.valor ?? "";
const REMETENTE = remetente.valor ?? "Lumi <onboarding@resend.dev>";
const URL_PLATAFORMA = plataforma.valor ?? "https://lizzardu.github.io/lumi-demo";
const SEGREDO = (webhook.valor ?? "").trim();

// Nomes, nunca valores: os registos são visíveis a quem tenha acesso ao painel.
console.log(
  "Configuração: chave=" + (chave.nome ?? "NENHUMA ENCONTRADA") +
  " remetente=" + (remetente.nome ?? "por omissão (onboarding@resend.dev)") +
  " segredo=" + (webhook.nome ?? "NENHUM ENCONTRADO"),
);

const TEXTOS = {
  breve: {
    assunto: "Lumi · como correu a sua consulta?",
    intro: "A sua equipa da Unidade de Queimados Pediátricos gostava de saber como correu a consulta de hoje.",
    duracao: "São sete perguntas e demora cerca de um minuto.",
  },
  final: {
    assunto: "Lumi · a sua opinião sobre o acompanhamento",
    intro: "Terminou o seu acompanhamento em telessaúde na Unidade de Queimados Pediátricos. "
      + "A sua opinião ajuda-nos a melhorar o acompanhamento de quem vier a seguir.",
    duracao: "Demora cerca de três minutos.",
  },
};

function html(intro: string, duracao: string, ligacao: string) {
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;color:#10233B;line-height:1.6">
  <p style="margin:0 0 14px">${intro}</p>
  <p style="margin:0 0 22px;color:#4E6379">${duracao} Responder é voluntário — pode recusar, e isso não afeta em nada o seu acompanhamento.</p>
  <p style="margin:0 0 24px">
    <a href="${ligacao}" style="background:#0056A4;color:#fff;text-decoration:none;padding:11px 20px;border-radius:4px;display:inline-block">Responder ao questionário</a>
  </p>
  <p style="margin:0;color:#4E6379;font-size:12px;border-top:1px solid #DCE4EC;padding-top:14px">
    Precisa de iniciar sessão com os seus dados de acesso. O questionário também
    lhe aparece na plataforma, da próxima vez que lá entrar.
  </p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405 });
  }
  const recebido = (req.headers.get("x-lumi-segredo") ?? "").trim();
  if (!SEGREDO || recebido !== SEGREDO) {
    console.error(
      "Segredo recusado. Configurado em SEGREDO_WEBHOOK: " +
      (SEGREDO ? SEGREDO.length + " caracteres" : "NÃO DEFINIDO") +
      ". Recebido: " + (recebido ? recebido.length + " caracteres" : "nenhum") + ".",
    );
    return new Response("Não autorizado", { status: 401 });
  }

  let corpo: { pedido_id?: string };
  try {
    corpo = await req.json();
  } catch {
    return new Response("Corpo inválido", { status: 400 });
  }
  if (!corpo.pedido_id) {
    return new Response("Falta pedido_id", { status: 400 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: pedido, error: erroPedido } = await sb
    .from("satisfacao_pedidos").select("id, tipo, doente_id")
    .eq("id", corpo.pedido_id).maybeSingle();
  if (erroPedido || !pedido) {
    console.error("Pedido não encontrado:", corpo.pedido_id, erroPedido);
    return new Response("Pedido não encontrado", { status: 404 });
  }

  // O endereço pode estar em três sítios, e a ordem importa:
  //   1. na ficha do doente, que é onde o Formulário de Alta o grava — é o
  //      endereço que a equipa escreveu de propósito para contactar o doente;
  //   2. no convite de acesso, se a conta foi criada por aí;
  //   3. na conta de autenticação, que é só o endereço com que ele entra e
  //      pode não ser aquele por onde quer ser contactado.
  // Ir buscar o terceiro quando existe o primeiro foi o erro que aqui esteve:
  // a equipa tinha escrito um endereço no formulário e o convite seguia para
  // outro.
  let para: string | undefined;
  let origem = "";

  const { data: doente } = await sb
    .from("doentes").select("email").eq("id", pedido.doente_id).maybeSingle();
  if (doente?.email?.trim()) { para = doente.email.trim(); origem = "ficha do doente"; }

  if (!para) {
    const { data: conta } = await sb
      .from("contas_acesso").select("email, ativada")
      .eq("doente_id", pedido.doente_id)
      .order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (conta?.email?.trim()) { para = conta.email.trim(); origem = "convite de acesso"; }
  }

  if (!para) {
    const { data: perfil } = await sb
      .from("perfis").select("id")
      .eq("doente_id", pedido.doente_id).eq("papel", "doente")
      .limit(1).maybeSingle();
    if (perfil?.id) {
      const { data: utilizador } = await sb.auth.admin.getUserById(perfil.id);
      if (utilizador?.user?.email) { para = utilizador.user.email.trim(); origem = "conta de autenticação"; }
    }
  }

  if (para) console.log("Endereço obtido da " + origem + ".");

  if (!para) {
    // Não é um erro: nem todos os doentes deram email, e alguns usam só SMS.
    // O pop-up na plataforma continua a fazer o trabalho.
    console.log("Doente sem email registado; fica só o pop-up na plataforma.");
    return Response.json({ enviado: false, motivo: "doente sem email registado" });
  }

  const texto = TEXTOS[pedido.tipo as "breve" | "final"] ?? TEXTOS.breve;
  const ligacao = `${URL_PLATAFORMA}/area-doente/satisfacao.html?pedido=${pedido.id}`;

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: REMETENTE,
      to: [para],
      subject: texto.assunto,
      html: html(texto.intro, texto.duracao, ligacao),
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    console.error("O fornecedor de email recusou o envio:", resposta.status, detalhe);
    if (!RESEND_API_KEY) {
      console.error("Não foi encontrada nenhuma chave da API de email. "
        + "Procurei RESEND_API_KEY_DOENTE, FENIX_RESEND_API_KEY e RESEND_API_KEY.");
    }
    // O motivo vai no corpo da resposta para aparecer em net._http_response,
    // sem ser preciso ir aos registos de cada vez.
    // O destinatário vai mascarado: chega para perceber se foi para o
    // endereço certo, sem escrever o email de um doente numa tabela de
    // diagnóstico.
    const mascarado = para.replace(/^(.{2}).*@/, "$1***@");
    return Response.json(
      { enviado: false, estado: resposta.status, motivo: detalhe.slice(0, 300),
        remetente: REMETENTE, chave_encontrada: !!RESEND_API_KEY,
        destinatario: mascarado, origem_do_endereco: origem },
      { status: 502 },
    );
  }

  const dados = await resposta.json().catch(() => ({} as Record<string, unknown>));
  const idResend = (dados as { id?: string }).id ?? null;
  // O endereço do doente não vai para o log: é dado pessoal, e os logs das
  // Edge Functions são visíveis a quem tiver acesso ao painel do projeto.
  console.log(`Convite de satisfação aceite pelo Resend. id=${idResend} tipo=${pedido.tipo}`);

  return Response.json({ enviado: true, resend_id: idResend });
});
