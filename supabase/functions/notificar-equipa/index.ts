// ============================================================================
// LUMI — Aviso por email à equipa
// Supabase Edge Function · Deno
//
// Chamada automaticamente pela base de dados sempre que um doente cria uma
// dúvida ou submete uma resposta a um questionário (ver os gatilhos em
// database/011_notificacoes_email.sql).
//
// PORQUE É QUE ISTO TEM DE CORRER NO SERVIDOR
// O envio de email exige uma chave secreta do fornecedor. Essa chave nunca
// pode estar no browser: qualquer pessoa que abra a plataforma conseguiria
// lê-la e enviar email em nome da Unidade. Por isso o envio vive aqui.
//
// O QUE O EMAIL NÃO LEVA
// O email não contém o nome do doente, o número de processo, o texto da
// dúvida nem qualquer resultado clínico. Diz apenas que há algo novo e
// remete para a plataforma, onde o acesso é autenticado e registado.
// Isto é deliberado: o email sai do perímetro da instituição, passa por um
// fornecedor externo e fica em caixas de correio que a ULS não controla.
// Dados de saúde não devem viajar assim.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Os segredos das Edge Functions são partilhados por TODO o projeto, não por
// função. Como já existe um RESEND_API_KEY para os emails ao doente, esta
// função procura primeiro um nome só seu e só depois cai no partilhado.
// Assim: sem fazer nada, reutiliza a chave existente; definindo
// RESEND_API_KEY_EQUIPA, passa a usar uma chave separada, que pode ser
// revogada sem afetar os emails ao doente.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY_EQUIPA")
  ?? Deno.env.get("RESEND_API_KEY")!;

// O mesmo para o remetente: o dos avisos à equipa não deve ser o mesmo que o
// doente vê, e sem um nome próprio herdaria o do outro circuito.
const REMETENTE = Deno.env.get("EMAIL_REMETENTE_EQUIPA")
  ?? Deno.env.get("EMAIL_REMETENTE")
  ?? "Lumi <onboarding@resend.dev>";
const URL_PLATAFORMA = Deno.env.get("URL_PLATAFORMA") ?? "https://lizzardu.github.io/lumi-demo";
// Segredo partilhado com o gatilho da base de dados. Impede que alguém que
// descubra o endereço desta função a use para disparar emails.
// O trim() protege do erro mais comum a configurar isto: um espaço ou uma
// quebra de linha apanhados ao copiar o valor para um dos dois lados.
const SEGREDO = (Deno.env.get("SEGREDO_WEBHOOK") ?? "").trim();

type Evento = {
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
};

const ASSUNTOS: Record<string, { assunto: string; corpo: string; destino: string }> = {
  duvidas: {
    assunto: "Lumi · nova dúvida de um doente",
    corpo: "Um doente colocou uma nova dúvida à equipa.",
    destino: "/area-profissional/alertas.html",
  },
  proms_respostas: {
    assunto: "Lumi · nova resposta a questionário",
    corpo: "Um doente submeteu uma nova resposta a um questionário de seguimento.",
    destino: "/area-profissional/dashboard.html",
  },
};

function html(corpo: string, ligacao: string, quando: string) {
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;color:#10233B;line-height:1.6">
  <p style="margin:0 0 14px">${corpo}</p>
  <p style="margin:0 0 20px;color:#4E6379;font-size:13px">${quando}</p>
  <p style="margin:0 0 24px">
    <a href="${ligacao}" style="background:#0056A4;color:#fff;text-decoration:none;padding:11px 20px;border-radius:4px;display:inline-block">Abrir a plataforma Lumi</a>
  </p>
  <p style="margin:0;color:#4E6379;font-size:12px;border-top:1px solid #DCE4EC;padding-top:14px">
    Este aviso não inclui o nome do doente nem qualquer informação clínica.
    Essa informação só está acessível na plataforma, depois de iniciar sessão.
  </p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405 });
  }
  const recebido = (req.headers.get("x-lumi-segredo") ?? "").trim();
  if (!SEGREDO || recebido !== SEGREDO) {
    // Deixa nos Logs o suficiente para perceber a causa sem revelar o segredo:
    // "não definido" e "comprimentos diferentes" pedem correções diferentes.
    console.error(
      "Segredo recusado. Configurado em SEGREDO_WEBHOOK: " +
      (SEGREDO ? SEGREDO.length + " caracteres" : "NÃO DEFINIDO") +
      ". Recebido da base de dados: " +
      (recebido ? recebido.length + " caracteres" : "nenhum") + ".",
    );
    return new Response("Não autorizado", { status: 401 });
  }

  let evento: Evento;
  try {
    evento = await req.json();
  } catch {
    return new Response("Corpo inválido", { status: 400 });
  }

  const tabela = evento.table ?? "";
  const modelo = ASSUNTOS[tabela];
  if (!modelo) {
    // tabela sem aviso associado: responder 200 para o gatilho não repetir
    return Response.json({ enviado: false, motivo: "tabela sem aviso configurado" });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // A equipa pode desligar cada tipo de aviso sem mexer nos gatilhos.
  const { data: config } = await sb
    .from("notificacoes_config").select("*").eq("id", 1).maybeSingle();

  const ligado = tabela === "duvidas"
    ? config?.avisar_duvidas !== false
    : config?.avisar_proms !== false;
  if (!ligado) {
    return Response.json({ enviado: false, motivo: "aviso desligado nas definições" });
  }

  const { data: destinatarios, error: erroDest } = await sb
    .from("notificacoes_destinatarios").select("email").eq("ativo", true);
  if (erroDest) {
    console.error("Não foi possível ler os destinatários:", erroDest);
    return new Response("Erro ao ler destinatários", { status: 500 });
  }
  const para = (destinatarios ?? []).map((d) => d.email).filter(Boolean);
  if (!para.length) {
    return Response.json({ enviado: false, motivo: "sem destinatários ativos" });
  }

  const quando = new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: REMETENTE,
      to: para,
      subject: modelo.assunto,
      html: html(modelo.corpo, URL_PLATAFORMA + modelo.destino, quando),
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    console.error("O fornecedor de email recusou o envio:", resposta.status, detalhe);
    return new Response("Falha no envio", { status: 502 });
  }

  // O Resend responder 200 significa que ACEITOU o email, não que o entregou.
  // O que acontece a seguir — entregue, devolvido, marcado como spam — só se vê
  // do lado dele. Devolver o id que ele atribui permite ir buscar essa linha
  // exata em Resend → Emails, em vez de andar às apalpadelas.
  // O remetente e os destinatários também ficam aqui: são endereços da equipa,
  // nunca dados do doente.
  const dados = await resposta.json().catch(() => ({} as Record<string, unknown>));
  const idResend = (dados as { id?: string }).id ?? null;
  console.log(
    `Email aceite pelo Resend. id=${idResend} de="${REMETENTE}" para="${para.join(", ")}"`,
  );

  return Response.json({
    enviado: true,
    destinatarios: para.length,
    resend_id: idResend,
    remetente: REMETENTE,
    para,
  });
});
