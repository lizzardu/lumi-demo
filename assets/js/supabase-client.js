/* ============================================================================
   LUMI — módulo de ligação real à base de dados (Supabase)
   ============================================================================
   Este ficheiro é o "próximo passo" a seguir ao protótipo em main.js (que
   usa dados fictícios em memória). Substitui, função a função, as chamadas
   simuladas por chamadas reais à base de dados.

   Requisitos para este ficheiro funcionar:
   1. Incluir na página, ANTES deste ficheiro:
        <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
        <script src="../assets/js/supabase-config.js"></script>
        <script src="../assets/js/supabase-client.js"></script>
   2. Ter criado supabase-config.js a partir do exemplo (ver esse ficheiro).
   3. Ter corrido as migrações em database/, por ordem numérica. As tabelas
      usadas mais abaixo nas secções HISTÓRICO CLÍNICO, AGENDAMENTOS e
      AVALIAÇÃO DE RECURSOS vinham das migrações 002 e 003, que nunca foram
      commitadas — estão reconstruídas em 005_tabelas_em_falta.sql.

   Todas as funções devolvem Promises (usar com "await" dentro de uma
   função "async", tal como nos exemplos no fundo deste ficheiro).
   ========================================================================= */

/* ----------------------------------------------------------------------------
   SEM CONFIGURAÇÃO, FALHAR DE FORMA LEGÍVEL

   Antes, este ficheiro começava por ler window.LUMI_CONFIG.SUPABASE_URL
   diretamente. Quando o ficheiro de configuração não está presente — o que
   acontece sempre que o site é publicado sem ele, por estar no .gitignore —
   essa linha lança um TypeError, o script aborta aqui, e "const lumiApi"
   nunca chega a ser inicializado.

   O que o utilizador via, ao tentar entrar, era:

       can't access lexical declaration 'lumiApi' before initialization

   que é verdade e não serve de nada: fala do sintoma três camadas acima da
   causa, e não diz a ninguém que falta um ficheiro.

   Agora o módulo carrega sempre. Se a configuração faltar, "sb" passa a ser
   um objeto que lança uma mensagem clara à primeira utilização — e como
   todas as chamadas passam por ele, qualquer página mostra o motivo real no
   sítio onde já mostra os outros erros.
   -------------------------------------------------------------------------- */
const LUMI_PROBLEMA_CONFIG = (function () {
  const c = window.LUMI_CONFIG;
  if (!c || !c.SUPABASE_URL || !c.SUPABASE_ANON_KEY) {
    return "Falta o ficheiro assets/js/supabase-config.js, ou está incompleto. "
         + "Se isto é o site publicado, o ficheiro está no .gitignore e não foi enviado: "
         + "ver a secção B5 do GUIA-BACKEND.md.";
  }
  if (/SEU-PROJETO|cole-aqui/.test(String(c.SUPABASE_URL) + String(c.SUPABASE_ANON_KEY))) {
    return "O ficheiro assets/js/supabase-config.js ainda tem os valores de exemplo. "
         + "Substitua-os pelo endereço e pela chave publicável do seu projeto Supabase.";
  }
  return null;
})();

const sb = LUMI_PROBLEMA_CONFIG
  ? new Proxy({}, {
      get: function () {
        throw new Error("Lumi: não foi possível ligar à base de dados. " + LUMI_PROBLEMA_CONFIG);
      }
    })
  : window.supabase.createClient(
      window.LUMI_CONFIG.SUPABASE_URL,
      window.LUMI_CONFIG.SUPABASE_ANON_KEY
    );

/* E um aviso visível, para quem abre a página e não a consola. */
if (LUMI_PROBLEMA_CONFIG) {
  console.error("Lumi:", LUMI_PROBLEMA_CONFIG);
  window.addEventListener("DOMContentLoaded", function () {
    const aviso = document.createElement("div");
    aviso.setAttribute("role", "alert");
    aviso.style.cssText = "position:fixed; left:0; right:0; bottom:0; z-index:9999;"
      + "background:#C6402E; color:#fff; padding:14px 18px; font:500 .88rem/1.5 system-ui,sans-serif;";
    aviso.textContent = "⚠️ Lumi: não foi possível ligar à base de dados. " + LUMI_PROBLEMA_CONFIG;
    document.body.appendChild(aviso);
  });
}

const lumiApi = {

  /* ---------------------------------------------------------------------
     AUTENTICAÇÃO
     --------------------------------------------------------------------- */
  async login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Regista +1 acesso se for uma conta de doente/familiar (a função
    // registar_acesso_doente() não faz nada para contas profissionais —
    // ver 004_contador_acessos.sql). Nunca deve impedir o login.
    try { await sb.rpc("registar_acesso_doente"); }
    catch (e) { console.error("Não foi possível registar o acesso:", e); }
    return data;
  },

  async logout() {
    await sb.auth.signOut();
  },

  async utilizadorAtual() {
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    const { data: perfil, error } = await sb.from("perfis").select("*").eq("id", data.user.id).single();
    if (error) {
      console.error("Erro ao carregar perfil:", error.message, error);
    }
    return { user: data.user, perfil };
  },

  async alterarPassword(novaSenha) {
    const { data, error } = await sb.auth.updateUser({ password: novaSenha });
    if (error) throw error;
    return data;
  },

  async listarEquipaProfissionais() {
    const { data, error } = await sb.from("perfis").select("*").eq("papel", "profissional").order("nome");
    if (error) throw error;
    return data;
  },

  /* ---------------------------------------------------------------------
     DOENTES
     --------------------------------------------------------------------- */
  async listarDoentes() {
    const { data, error } = await sb.from("doentes").select("*").order("criado_em", { ascending: false });
    if (error) throw error;
    return data;
  },

  async obterDoente(doenteId) {
    const { data, error } = await sb.from("doentes").select("*").eq("id", doenteId).single();
    if (error) throw error;
    return data;
  },

  async obterDoentePorProcesso(processo) {
    const { data, error } = await sb.from("doentes").select("*").eq("processo", processo).single();
    if (error) throw error;
    return data;
  },

  async atualizarDoenteContexto(doenteId, campos) {
    const { data, error } = await sb.from("doentes").update(campos).eq("id", doenteId).select().single();
    if (error) throw error;
    return data;
  },

  /**
   * Cria o registo do doente e o convite de ativação de conta.
   * NOTA IMPORTANTE: esta função cria o CONVITE (linha em contas_acesso)
   * mas não envia SMS/email — isso requer uma Supabase Edge Function
   * ligada a um serviço de envio (ex. Twilio para SMS, Resend para
   * email), porque exige chaves secretas que nunca devem estar no
   * browser. Ver o guia para o desenho dessa function.
   */
  async criarDoenteEConta({ nome, processo, dataNascimento, dataAlta, equipa, titularTipo, nomeFamiliar, telemovel, email, canal,
                            escola, anoEscolaridade, cuidadorPrincipal, cuidadorParentesco, cuidadorContacto }) {
    const { data: doente, error: erroDoente } = await sb
      .from("doentes")
      .insert({
        nome, processo, data_nascimento: dataNascimento, data_alta: dataAlta, equipa,
        escola: escola || null,
        ano_escolaridade: anoEscolaridade || null,
        cuidador_principal: cuidadorPrincipal || null,
        cuidador_parentesco: cuidadorParentesco || null,
        cuidador_contacto: cuidadorContacto || null
      })
      .select()
      .single();
    if (erroDoente) throw erroDoente;

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEm = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { error: erroConta } = await sb.from("contas_acesso").insert({
      doente_id: doente.id, titular_tipo: titularTipo, nome_familiar: nomeFamiliar,
      telemovel, email, canal_ativacao: canal, codigo_ativacao: codigo, codigo_expira_em: expiraEm
    });
    if (erroConta) throw erroConta;

    return { doente, codigo }; // "codigo" só é devolvido aqui para demonstração local;
                                 // numa Edge Function real, nunca voltaria ao browser.
  },

  /* ---------------------------------------------------------------------
     FORMULÁRIO DE ALTA
     --------------------------------------------------------------------- */
  /** Grava o formulário e, com ele, a prioridade de seguimento calculada.
   *  A prioridade fica na linha do formulário — é o registo do que se sabia
   *  naquele momento — e é copiada para o doente, para a lista de doentes
   *  poder ordenar sem reler os formulários todos.
   *  Requer as colunas de 013_prioridade_seguimento.sql. */
  async guardarFormularioAlta(doenteId, dados, dataAlta, contactoTipo, prioridade) {
    const { data: userData } = await sb.auth.getUser();
    const linha = {
      doente_id: doenteId, dados, data_alta: dataAlta, contacto_tipo: contactoTipo,
      criado_por: userData.user ? userData.user.id : null
    };
    if (prioridade) {
      linha.prioridade              = prioridade.classe;
      linha.prioridade_clinico      = prioridade.clinico.pontos;
      linha.prioridade_psicossocial = prioridade.psicossocial.pontos;
      // revisão de sistemas pediátrica: guarda-se o número de sinais e
      // quais, não uma pontuação — não há limiar publicado para esta lista
      if (prioridade.revisao) {
        linha.revisao_ped_sinais      = prioridade.revisao.sinais;
        linha.revisao_ped_respondidas = prioridade.revisao.respondidas;
        linha.revisao_ped_positivos   = prioridade.revisao.positivos;
      }
      linha.prioridade_fatores      = {
        clinico: prioridade.clinico.fatores,
        psicossocial: prioridade.psicossocial.fatores,
        cadencia: prioridade.cadencia
      };
    }
    const { data, error } = await sb.from("formularios_alta").insert(linha).select().single();
    if (error) throw error;

    // a cópia no doente é conveniência para a listagem: se falhar, o
    // formulário fica na mesma gravado e a prioridade continua lá
    if (prioridade) {
      try {
        await sb.from("doentes").update({
          prioridade_seguimento: prioridade.classe,
          prioridade_atualizada_em: new Date().toISOString()
        }).eq("id", doenteId);
      } catch (e) {
        console.error("Não foi possível copiar a prioridade para o doente:", e);
      }
    }
    return data;
  },

  async obterUltimoFormularioAlta(doenteId) {
    const { data, error } = await sb
      .from("formularios_alta").select("*")
      .eq("doente_id", doenteId).order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },

  /* ---------------------------------------------------------------------
     CONTACTO ÀS 72 HORAS
     Um registo por contacto. Não se substitui nem se apaga: se for preciso
     contactar outra vez, fica outro registo, e a sequência das duas leituras
     é ela própria informação clínica.
     --------------------------------------------------------------------- */
  async registarConsulta72h(doenteId, registo) {
    const sessao = await this.utilizadorAtual();
    if (!sessao || !sessao.perfil) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.from("consultas_72h").insert({
      doente_id: doenteId,
      realizado_por_id: sessao.user.id,
      realizado_por_nome: sessao.perfil.nome,
      dados: registo.dados || {},
      red_flags: !!registo.red_flags,
      red_flags_lista: registo.red_flags_lista || [],
      decisao_prioridade: registo.decisao_prioridade || null,
      prioridade_final: registo.prioridade_final || null,
      agendamento_id: registo.agendamento_id || null
    }).select().single();
    if (error) throw error;
    return data;
  },

  async listarConsultas72h(doenteId) {
    const { data, error } = await sb.from("consultas_72h").select("*")
      .eq("doente_id", doenteId).order("data_contacto", { ascending: false });
    if (error) throw error;
    return data;
  },

  async obterUltimaConsulta72h(doenteId) {
    const { data, error } = await sb.from("consultas_72h").select("*")
      .eq("doente_id", doenteId).order("data_contacto", { ascending: false })
      .limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },

  /* ---------------------------------------------------------------------
     CONSULTAS DE SEGUIMENTO
     A consulta nasce em rascunho e só fica visível ao doente quando for
     concluída — a regra está na política da base de dados, não aqui.
     Requer 018_consultas.sql.
     --------------------------------------------------------------------- */
  async criarConsulta(doenteId, dados) {
    const sessao = await this.utilizadorAtual();
    if (!sessao || !sessao.perfil) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.from("consultas").insert({
      doente_id: doenteId,
      agendamento_id: dados.agendamento_id || null,
      data_consulta: dados.data_consulta || new Date().toISOString(),
      tipo: dados.tipo || null,
      profissional_id: sessao.user.id,
      profissional_nome: sessao.perfil.nome,
      especialidade: dados.especialidade || sessao.perfil.especialidade || null,
      dados: dados.dados || {},
      proms_base: dados.proms_base || null,
      estado: dados.estado || "rascunho",
      concluida_em: dados.estado === "concluida" ? new Date().toISOString() : null
    }).select().single();
    if (error) throw error;
    return data;
  },

  async atualizarConsulta(consultaId, campos) {
    const patch = Object.assign({ atualizado_em: new Date().toISOString() }, campos);
    if (campos.estado === "concluida" && !campos.concluida_em) {
      patch.concluida_em = new Date().toISOString();
    }
    const { data, error } = await sb.from("consultas").update(patch)
      .eq("id", consultaId).select().single();
    if (error) throw error;
    return data;
  },

  async listarConsultas(doenteId) {
    const { data, error } = await sb.from("consultas").select("*")
      .eq("doente_id", doenteId).order("data_consulta", { ascending: false });
    if (error) throw error;
    return data;
  },

  async obterConsulta(consultaId) {
    const { data, error } = await sb.from("consultas").select("*")
      .eq("id", consultaId).maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Regista uma alteração a um valor que tinha vindo do doente. Escreve-se
   *  uma linha por campo alterado; nunca se corrige nem se apaga. */
  async registarAuditoriaConsulta(consultaId, doenteId, entrada) {
    const sessao = await this.utilizadorAtual();
    if (!sessao || !sessao.perfil) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.from("consultas_auditoria").insert({
      consulta_id: consultaId,
      doente_id: doenteId,
      campo: entrada.campo,
      instrumento: entrada.instrumento || null,
      valor_doente: entrada.valor_doente == null ? null : String(entrada.valor_doente),
      valor_novo: entrada.valor_novo == null ? null : String(entrada.valor_novo),
      motivo: entrada.motivo || null,
      autor_id: sessao.user.id,
      autor_nome: sessao.perfil.nome
    }).select().single();
    if (error) throw error;
    return data;
  },

  async listarAuditoriaConsulta(consultaId) {
    const { data, error } = await sb.from("consultas_auditoria").select("*")
      .eq("consulta_id", consultaId).order("criado_em");
    if (error) throw error;
    return data;
  },

  /* ---------------------------------------------------------------------
     ALTA DO SEGUIMENTO
     O relatório final. Requer 020_alta_seguimento.sql.
     --------------------------------------------------------------------- */
  async criarAltaSeguimento(doenteId, dados) {
    const sessao = await this.utilizadorAtual();
    if (!sessao || !sessao.perfil) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.from("altas_seguimento").insert({
      doente_id: doenteId,
      data_admissao: dados.data_admissao || null,
      data_alta: dados.data_alta || null,
      profissional_id: sessao.user.id,
      profissional_nome: sessao.perfil.nome,
      dados: dados.dados || {},
      resumo: dados.resumo || null,
      estado: dados.estado || "rascunho",
      emitida_em: dados.estado === "emitida" ? new Date().toISOString() : null
    }).select().single();
    if (error) throw error;
    return data;
  },

  async atualizarAltaSeguimento(id, campos) {
    const patch = Object.assign({ atualizado_em: new Date().toISOString() }, campos);
    if (campos.estado === "emitida" && !campos.emitida_em) {
      patch.emitida_em = new Date().toISOString();
    }
    const { data, error } = await sb.from("altas_seguimento").update(patch)
      .eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async obterAltaSeguimento(doenteId) {
    const { data, error } = await sb.from("altas_seguimento").select("*")
      .eq("doente_id", doenteId).order("criado_em", { ascending: false })
      .limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },

  /* ---------------------------------------------------------------------
     ANEXOS DAS MARCAÇÕES
     Ficheiros num balde privado. O doente nunca recebe um endereço fixo:
     recebe um endereço assinado, válido por uma hora. Um endereço público
     de um documento clínico é um documento clínico publicado.
     Requer 019_anexos.sql.
     --------------------------------------------------------------------- */
  async carregarAnexo(doenteId, agendamentoId, ficheiro, descricao) {
    const sessao = await this.utilizadorAtual();
    if (!sessao || !sessao.perfil) throw new Error("Sessão não iniciada.");

    // o nome vai limpo de acentos e espaços: o Storage aceita-os, mas dão
    // problemas em endereços e em downloads no Windows
    const seguro = ficheiro.name
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._-]/g, "-");
    const caminho = "doentes/" + doenteId + "/agendamentos/" + (agendamentoId || "geral")
                  + "/" + Date.now() + "-" + seguro;

    const { error: erroUpload } = await sb.storage.from("anexos")
      .upload(caminho, ficheiro, { contentType: ficheiro.type || undefined });
    if (erroUpload) throw erroUpload;

    const { data, error } = await sb.from("anexos").insert({
      doente_id: doenteId,
      agendamento_id: agendamentoId || null,
      caminho: caminho,
      nome: ficheiro.name,
      descricao: descricao || null,
      tipo_mime: ficheiro.type || null,
      tamanho: ficheiro.size || null,
      carregado_por: sessao.user.id,
      carregado_nome: sessao.perfil.nome
    }).select().single();
    if (error) {
      // não deixar o ficheiro órfão no balde se o índice falhar
      await sb.storage.from("anexos").remove([caminho]);
      throw error;
    }
    return data;
  },

  async listarAnexos(doenteId, agendamentoId) {
    let query = sb.from("anexos").select("*").eq("doente_id", doenteId)
      .order("criado_em", { ascending: false });
    if (agendamentoId) query = query.eq("agendamento_id", agendamentoId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /** Endereço temporário para abrir o ficheiro. Uma hora chega para o ler. */
  async enderecoAnexo(caminho) {
    const { data, error } = await sb.storage.from("anexos").createSignedUrl(caminho, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  async removerAnexo(anexo) {
    const { error: erroFicheiro } = await sb.storage.from("anexos").remove([anexo.caminho]);
    if (erroFicheiro) throw erroFicheiro;
    const { error } = await sb.from("anexos").delete().eq("id", anexo.id);
    if (error) throw error;
  },

  /* ---------------------------------------------------------------------
     SATISFAÇÃO (PREM)
     A equipa pede, o doente responde ou recusa. Responder e recusar passam
     por funções da base de dados: o doente não escreve diretamente na
     tabela, senão poderia reescrever quem pediu e de que tipo era.
     Requer 017_satisfacao.sql.
     --------------------------------------------------------------------- */
  async pedirAvaliacaoSatisfacao(doenteId, tipo, agendamentoId) {
    const sessao = await this.utilizadorAtual();
    if (!sessao || !sessao.perfil) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.from("satisfacao_pedidos").insert({
      doente_id: doenteId,
      tipo: tipo,
      pedido_por_id: sessao.user.id,
      pedido_por_nome: sessao.perfil.nome,
      agendamento_id: agendamentoId || null
    }).select().single();
    if (error) throw error;
    return data;
  },

  async listarPedidosSatisfacao(doenteId) {
    const { data, error } = await sb.from("satisfacao_pedidos").select("*")
      .eq("doente_id", doenteId).order("criado_em", { ascending: false });
    if (error) throw error;
    return data;
  },

  /** O pedido por responder mais recente, ou null. É o que faz aparecer o
   *  pop-up ao doente. Devolve null em silêncio se a migração ainda não
   *  tiver corrido: o resto da plataforma não deve parar por causa disto. */
  async pedidoSatisfacaoPendente(doenteId) {
    const { data, error } = await sb.from("satisfacao_pedidos").select("*")
      .eq("doente_id", doenteId).eq("estado", "pendente")
      .order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (error) { console.warn("Satisfação indisponível:", error.message); return null; }
    return data;
  },

  async obterPedidoSatisfacao(pedidoId) {
    const { data, error } = await sb.from("satisfacao_pedidos").select("*")
      .eq("id", pedidoId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async responderSatisfacao(pedidoId, respostas, global) {
    const { data, error } = await sb.rpc("responder_satisfacao", {
      p_pedido: pedidoId,
      p_respostas: respostas,
      p_global: (global === null || global === undefined || global === "") ? null : Number(global)
    });
    if (error) throw error;
    return data;
  },

  async recusarSatisfacao(pedidoId) {
    const { data, error } = await sb.rpc("recusar_satisfacao", { p_pedido: pedidoId });
    if (error) throw error;
    return data;
  },

  /* ---------------------------------------------------------------------
     PROMs
     --------------------------------------------------------------------- */
  /* "contexto" é { respondente, faixa, momento, idade } — quem respondeu, com
     que bateria e em que momento do seguimento. Sem isto, uma série de
     pontuações de dor ao longo de três anos mistura observações do pai com
     autorrelatos da criança e deixa de poder ser lida. Ver migração 021. */
  async submeterProm(doenteId, instrumento, respostas, scores, contexto) {
    const linha = { doente_id: doenteId, instrumento, respostas, scores };
    if (contexto) {
      if (contexto.respondente) linha.respondente  = contexto.respondente;
      if (contexto.faixa)       linha.faixa_etaria = contexto.faixa;
      if (contexto.momento)     linha.momento      = contexto.momento;
      if (contexto.idade != null) linha.idade_anos = contexto.idade;
    }
    const { data, error } = await sb.from("proms_respostas").insert(linha).select().single();
    if (error) throw error;
    return data;
  },

  async listarPromsDoente(doenteId, instrumento) {
    let query = sb.from("proms_respostas").select("*").eq("doente_id", doenteId).order("data_resposta");
    if (instrumento) query = query.eq("instrumento", instrumento);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /** Respostas PROM de TODOS os doentes, numa única consulta. Usado no cálculo
   *  dos alertas: com listarPromsDoente era preciso uma consulta por doente e
   *  por instrumento, o que tornava impraticável mostrar o contador em todas
   *  as páginas. "instrumentos" é opcional e filtra a lista. */
  async listarPromsTodos(instrumentos) {
    let query = sb.from("proms_respostas")
      .select("doente_id, instrumento, data_resposta, scores")
      .order("data_resposta");
    if (instrumentos && instrumentos.length) query = query.in("instrumento", instrumentos);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /* ---------------------------------------------------------------------
     JORNADA / METAS
     --------------------------------------------------------------------- */
  async listarMetas(doenteId) {
    const { data, error } = await sb.from("metas").select("*").eq("doente_id", doenteId).order("criado_em");
    if (error) throw error;
    return data;
  },

  async adicionarMeta(doenteId, meta) {
    const { data, error } = await sb.from("metas").insert({ doente_id: doenteId, ...meta }).select().single();
    if (error) throw error;
    return data;
  },

  async atualizarMeta(metaId, campos) {
    campos.atualizado_em = new Date().toISOString();
    const { data, error } = await sb.from("metas").update(campos).eq("id", metaId).select().single();
    if (error) throw error;
    return data;
  },

  async removerMeta(metaId) {
    const { error } = await sb.from("metas").delete().eq("id", metaId);
    if (error) throw error;
  },

  /* --- Atualizações de cada meta: o fio onde o doente descreve como está
     a correr e a equipa responde. Partilhado entre os dois lados (ao
     contrário da comunicação da equipa, que é interna).
     Requer a tabela "metas_atualizacoes" — ver 007_atualizacoes_metas.sql. --- */

  /** Todas as atualizações de um doente, de uma só vez (uma consulta em vez
   *  de uma por meta). A página agrupa depois por meta_id. */
  async listarAtualizacoesMetas(doenteId) {
    const { data, error } = await sb
      .from("metas_atualizacoes").select("*")
      .eq("doente_id", doenteId)
      .order("criado_em", { ascending: true });
    if (error) throw error;
    return data;
  },

  /** O autor (doente ou profissional) vem sempre da sessão iniciada — nunca
   *  de um parâmetro — para não ser possível escrever em nome de outrem. */
  async registarAtualizacaoMeta(metaId, doenteId, texto) {
    const sessao = await this.utilizadorAtual();
    if (!sessao || !sessao.perfil) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.from("metas_atualizacoes").insert({
      meta_id: metaId,
      doente_id: doenteId,
      autor_papel: sessao.perfil.papel,
      autor_nome: sessao.perfil.nome,
      texto
    }).select().single();
    if (error) throw error;
    return data;
  },

  /** Marca a meta como concluída e, se houver foto, faz upload para o Storage. */
  async marcarMetaConquistada(metaId, ficheiroFoto) {
    let fotoUrl = null;
    if (ficheiroFoto) {
      const caminho = `${metaId}-${Date.now()}-${ficheiroFoto.name}`;
      const { error: erroUpload } = await sb.storage.from("fotos-metas").upload(caminho, ficheiroFoto);
      if (erroUpload) throw erroUpload;
      const { data: urlData } = sb.storage.from("fotos-metas").getPublicUrl(caminho);
      fotoUrl = urlData.publicUrl;
    }
    return this.atualizarMeta(metaId, { estado: "done", ...(fotoUrl ? { foto_url: fotoUrl } : {}) });
  },

  /* ---------------------------------------------------------------------
     PLANO DE TRATAMENTO — exercícios, registos e dieta
     --------------------------------------------------------------------- */
  async listarExercicios(doenteId) {
    const { data, error } = await sb.from("plano_exercicios").select("*, plano_registos(*)").eq("doente_id", doenteId);
    if (error) throw error;
    return data;
  },

  async prescreverExercicio(doenteId, exercicio) {
    const { data, error } = await sb.from("plano_exercicios").insert({ doente_id: doenteId, ...exercicio }).select().single();
    if (error) throw error;
    return data;
  },

  async atualizarExercicio(exercicioId, campos) {
    const { data, error } = await sb.from("plano_exercicios").update(campos).eq("id", exercicioId).select().single();
    if (error) throw error;
    return data;
  },

  async removerExercicio(exercicioId) {
    const { error } = await sb.from("plano_exercicios").delete().eq("id", exercicioId);
    if (error) throw error;
  },

  async registarExecucaoExercicio(exercicioId, doenteId, esforco, nota) {
    const { data, error } = await sb.from("plano_registos").insert({
      exercicio_id: exercicioId, doente_id: doenteId, esforco, nota
    }).select().single();
    if (error) throw error;
    return data;
  },

  /* ---------------------------------------------------------------------
     DÚVIDAS
     --------------------------------------------------------------------- */
  async listarDuvidas(doenteId) {
    let query = sb.from("duvidas").select("*, doentes(nome, processo)").order("criado_em", { ascending: false });
    if (doenteId) query = query.eq("doente_id", doenteId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /* --- Respostas por ler, na área do doente.
     Requer a coluna e a função de 014_duvidas_por_ler.sql. --- */

  /** Quantas respostas da equipa este doente ainda não viu. Uma contagem no
   *  servidor, sem trazer as dúvidas todas só para as contar. */
  async contarRespostasPorLer(doenteId) {
    const { count, error } = await sb
      .from("duvidas")
      .select("id", { count: "exact", head: true })
      .eq("doente_id", doenteId)
      .eq("estado", "respondida")
      .is("resposta_vista_em", null);
    if (error) throw error;
    return count || 0;
  },

  /** Marca como vistas as respostas do doente com sessão iniciada.
   *  Passa por uma função no servidor, e não por um update direto: o doente
   *  não tem — nem deve ter — permissão de escrita na tabela das dúvidas,
   *  senão poderia reescrever a resposta da equipa. Ver a migração 014. */
  async marcarRespostasVistas() {
    const { data, error } = await sb.rpc("marcar_duvidas_vistas");
    if (error) throw error;
    return data || 0;
  },

  async submeterDuvida(doenteId, categoria, pergunta, contactoTelefonico) {
    const { data, error } = await sb.from("duvidas").insert({
      doente_id: doenteId, categoria, pergunta, contacto_telefonico: !!contactoTelefonico
    }).select().single();
    if (error) throw error;
    return data;
  },

  async responderDuvida(duvidaId, resposta, respondidoPor) {
    const { data, error } = await sb.from("duvidas").update({
      estado: "respondida", resposta, respondido_por: respondidoPor, data_resposta: new Date().toISOString().slice(0, 10)
    }).eq("id", duvidaId).select().single();
    if (error) throw error;
    return data;
  },

  /* ---------------------------------------------------------------------
     HISTÓRICO CLÍNICO — episódios passados relatados pelo doente
     (urgência, consulta externa, internamento). Usado em historico.html.
     Requer a tabela "historico_clinico" — ver 002_historico_agendamentos.sql.
     --------------------------------------------------------------------- */
  async listarHistoricoClinico(doenteId) {
    let query = sb.from("historico_clinico").select("*").order("criado_em", { ascending: false });
    if (doenteId) query = query.eq("doente_id", doenteId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async adicionarHistoricoClinico(doenteId, evento) {
    const { data, error } = await sb.from("historico_clinico").insert({ doente_id: doenteId, ...evento }).select().single();
    if (error) throw error;
    return data;
  },

  async removerHistoricoClinico(eventoId) {
    const { error } = await sb.from("historico_clinico").delete().eq("id", eventoId);
    if (error) throw error;
  },

  /* ---------------------------------------------------------------------
     AGENDAMENTOS — consultas/exames futuros registados pelo doente.
     Usado em historico.html.
     Requer a tabela "agendamentos" — ver 002_historico_agendamentos.sql.
     --------------------------------------------------------------------- */
  async listarAgendamentos(doenteId) {
    let query = sb.from("agendamentos").select("*").order("data_hora", { ascending: true });
    if (doenteId) query = query.eq("doente_id", doenteId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async registarAgendamento(doenteId, agendamento) {
    const { data, error } = await sb.from("agendamentos").insert({ doente_id: doenteId, ...agendamento }).select().single();
    if (error) throw error;
    return data;
  },

  async atualizarAgendamento(agendamentoId, campos) {
    const { data, error } = await sb.from("agendamentos").update(campos).eq("id", agendamentoId).select().single();
    if (error) throw error;
    return data;
  },

  /** Atalho para marcar um agendamento como cancelado. */
  async cancelarAgendamento(agendamentoId) {
    return this.atualizarAgendamento(agendamentoId, { estado: "cancelado" });
  },

  /* ---------------------------------------------------------------------
     AVALIAÇÃO DE RECURSOS — 👍/👎 do doente em cada vídeo, folheto ou FAQ.
     Usado em recursos.html. Requer a tabela "avaliacoes_recursos" — ver
     003_avaliacoes_recursos.sql. "recursoId" é o identificador estável do
     recurso (ex.: "video-hidratar-cicatriz"), definido em data-recurso-id
     na página; "util" é true (👍) ou false (👎).
     --------------------------------------------------------------------- */
  async avaliarRecurso(doenteId, recursoId, recursoTipo, util) {
    const { data, error } = await sb.from("avaliacoes_recursos")
      .upsert(
        { doente_id: doenteId, recurso_id: recursoId, recurso_tipo: recursoTipo, util, atualizado_em: new Date().toISOString() },
        { onConflict: "doente_id,recurso_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removerAvaliacaoRecurso(doenteId, recursoId) {
    const { error } = await sb.from("avaliacoes_recursos")
      .delete()
      .eq("doente_id", doenteId)
      .eq("recurso_id", recursoId);
    if (error) throw error;
  },

  /** Avaliações de UM doente (para pré-preencher os botões 👍/👎 já escolhidos). */
  async listarAvaliacoesRecursos(doenteId) {
    const { data, error } = await sb.from("avaliacoes_recursos").select("*").eq("doente_id", doenteId);
    if (error) throw error;
    return data;
  },

  /** Resumo agregado por recurso (para a área profissional: quantos 👍/👎 cada recurso tem). */
  async listarResumoAvaliacoesRecursos() {
    const { data, error } = await sb.from("avaliacoes_recursos").select("recurso_id, recurso_tipo, util");
    if (error) throw error;
    const resumo = {};
    data.forEach(r => {
      if (!resumo[r.recurso_id]) resumo[r.recurso_id] = { recurso_id: r.recurso_id, recurso_tipo: r.recurso_tipo, gostos: 0, naoGostos: 0 };
      if (r.util) resumo[r.recurso_id].gostos++; else resumo[r.recurso_id].naoGostos++;
    });
    return Object.values(resumo);
  },

  /* ---------------------------------------------------------------------
     CHECK-IN RÁPIDO DE HUMOR — pop-up mostrado ao doente logo depois de
     submeter uma avaliação PROM. Escala de 6 níveis, do melhor para o pior:
     "muito-bem" | "bem" | "razoavel" | "podia-estar-melhor" |
     "muito-em-baixo" | "preciso-de-ajuda".
     Requer a tabela "checkins_humor" — ver 005_checkins_humor.sql — e, para
     aceitar estes 6 valores, a migração 008_checkins_humor_escala.sql.
     --------------------------------------------------------------------- */
  async registarCheckinHumor(doenteId, valor) {
    const { data, error } = await sb.from("checkins_humor").insert({ doente_id: doenteId, valor }).select().single();
    if (error) throw error;
    return data;
  },

  async listarCheckinsHumor(doenteId) {
    const { data, error } = await sb.from("checkins_humor").select("*").eq("doente_id", doenteId).order("criado_em");
    if (error) throw error;
    return data;
  },

  /** Check-ins de humor de TODOS os doentes, numa única consulta, para o
   *  cálculo dos alertas. Requer que os profissionais possam ler a tabela —
   *  ver a política em 009_alertas_humor.sql. */
  async listarCheckinsHumorTodos() {
    const { data, error } = await sb
      .from("checkins_humor").select("id, doente_id, valor, criado_em")
      .order("criado_em");
    if (error) throw error;
    return data;
  },

  /* ---------------------------------------------------------------------
     AVISOS POR EMAIL À EQUIPA — quem recebe e que avisos estão ligados.
     O envio em si é feito por uma Edge Function, chamada pela base de
     dados: a chave do fornecedor de email nunca pode estar no browser.
     Ver 011_notificacoes_email.sql e supabase/functions/notificar-equipa.
     --------------------------------------------------------------------- */
  async listarDestinatariosAviso() {
    const { data, error } = await sb
      .from("notificacoes_destinatarios").select("*").order("criado_em");
    if (error) throw error;
    return data;
  },

  async adicionarDestinatarioAviso(email, nome) {
    const { data, error } = await sb.from("notificacoes_destinatarios")
      .insert({ email: email.trim().toLowerCase(), nome: nome || null })
      .select().single();
    if (error) throw error;
    return data;
  },

  async removerDestinatarioAviso(id) {
    const { error } = await sb.from("notificacoes_destinatarios").delete().eq("id", id);
    if (error) throw error;
  },

  async obterConfigAvisos() {
    const { data, error } = await sb
      .from("notificacoes_config").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data;
  },

  async guardarConfigAvisos(campos) {
    const { data, error } = await sb.from("notificacoes_config")
      .update(Object.assign({}, campos, { atualizado_em: new Date().toISOString() }))
      .eq("id", 1).select().single();
    if (error) throw error;
    return data;
  },

  /* --- Alertas dados como tratados pela equipa.
     Requer a tabela "alertas_tratados" — ver 010_alertas_tratados.sql. --- */

  async listarAlertasTratados() {
    const { data, error } = await sb
      .from("alertas_tratados").select("*")
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return data;
  },

  /** Marca um alerta como tratado. "referencia" é o id do registo que lhe deu
   *  origem — no caso do humor, o id do check-in. Quem trata vem sempre da
   *  sessão iniciada. */
  async marcarAlertaTratado(doenteId, tipo, referencia, nota) {
    const sessao = await this.utilizadorAtual();
    if (!sessao || !sessao.perfil || sessao.perfil.papel !== "profissional") {
      throw new Error("Só profissionais com sessão iniciada podem tratar alertas.");
    }
    const { data, error } = await sb.from("alertas_tratados").insert({
      doente_id: doenteId,
      tipo,
      referencia,
      tratado_por_id: sessao.user.id,
      tratado_por_nome: sessao.perfil.nome,
      nota: nota || null
    }).select().single();
    if (error) throw error;
    return data;
  },

  /* ---------------------------------------------------------------------
     COMUNICAÇÃO DA EQUIPA — notas internas sobre um doente, trocadas entre
     profissionais. Usadas na ficha do doente (area-profissional/doente.html).
     Requer a tabela "comunicacoes_equipa" — ver 006_comunicacao_equipa.sql.

     Esta informação NÃO é visível para o doente nem para o familiar: as
     políticas RLS dessa tabela só permitem ler e escrever a contas com
     papel = 'profissional'. O histórico é imutável — não há aqui função
     para editar ou apagar, e a base de dados também não o permite.
     --------------------------------------------------------------------- */
  async listarComunicacoesEquipa(doenteId) {
    const { data, error } = await sb
      .from("comunicacoes_equipa").select("*")
      .eq("doente_id", doenteId)
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return data;
  },

  /** Regista uma nova entrada no mural da equipa. O autor é sempre o
   *  profissional com sessão iniciada; o nome e a especialidade ficam
   *  gravados na linha para o histórico continuar legível mesmo que o
   *  perfil venha a mudar. */
  async registarComunicacaoEquipa(doenteId, mensagem, categoria) {
    const sessao = await this.utilizadorAtual();
    if (!sessao || !sessao.perfil || sessao.perfil.papel !== "profissional") {
      throw new Error("Só profissionais com sessão iniciada podem registar comunicação da equipa.");
    }
    const { data, error } = await sb.from("comunicacoes_equipa").insert({
      doente_id: doenteId,
      autor_id: sessao.user.id,
      autor_nome: sessao.perfil.nome,
      autor_especialidade: sessao.perfil.especialidade,
      categoria,
      mensagem
    }).select().single();
    if (error) throw error;
    return data;
  }
};

/* ============================================================================
   EXEMPLO DE USO (dentro de uma página, depois de incluir este ficheiro):

   <script>
     async function carregar() {
       const { perfil } = await lumiApi.utilizadorAtual();
       const metas = await lumiApi.listarMetas(perfil.doente_id);
       console.log(metas);
     }
     carregar();
   </script>
   ========================================================================= */
