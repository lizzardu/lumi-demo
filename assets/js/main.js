/* ========================================================================
   LUMI — lógica partilhada (dados de demonstração, sem backend real)
   ======================================================================== */

/* ---------- dados de demonstração de um doente ---------- */
const BADGES = {
  "marco-clinico":  { nome: "Estrela de Coragem",   icon: "⭐", desc: "Por passar um momento difícil do tratamento." },
  "cicatrizacao":   { nome: "Pele Nova",            icon: "🩹", desc: "Por a pele estar a ficar melhor." },
  "funcional":      { nome: "Super Movimento",      icon: "💪", desc: "Por voltar a mexer-te como gostas." },
  "psicossocial":   { nome: "Passo em Frente",      icon: "🤝", desc: "Por voltar à escola, aos amigos e às rotinas." },
  "prom":           { nome: "Voz Ouvida",           icon: "📣", desc: "Por responder a uma avaliação e contar como estás." },
  // 🔥 de propósito fora daqui: são doentes queimados, e o fogo não é um
  // símbolo de conquista para este público — é o que lhes causou a lesão.
  "pessoal":        { nome: "A Minha Meta",         icon: "🏆", desc: "Por conseguires uma coisa que escolheste para ti." }
};

/* ========================================================================
   A MASCOTE LUMI
   ------------------------------------------------------------------------
   O Lumi aparece sempre que o ecrã fala com a criança — e nunca nos ecrãs da
   equipa clínica, onde seria ruído.

   SÃO SEIS FIGURAS, NÃO DUAS

   O Lumi cresce com quem o vê. Um menino de catorze anos que abre a aplicação
   e encontra um bebé de fralda percebe, de imediato, que aquilo não é para
   ele — e deixa de ler o resto. A figura é o primeiro sinal de a quem o ecrã
   está a falar, e tem de acertar.

   Os cortes acompanham o que muda na vida da criança, e não o que muda nos
   instrumentos: a chucha sai antes dos 3, a escola entra aos 6, o telemóvel e
   a autonomia entram na pré-adolescência. São deliberadamente diferentes dos
   cortes das baterias de PROMs (ver proms-pediatricos.js, que muda aos 5, aos
   8 e aos 11 anos, onde a validação dos instrumentos muda).

   Nos limites a faixa de baixo fecha e a de cima abre: uma criança que faz 6
   anos passa nesse dia da figura do infantário para a da escola.

   Sem data de nascimento não se adivinha. Fica a figura dos 8-10, que é a do
   meio da idade pediátrica — a que menos erra, seja a criança mais nova ou
   mais velha do que isso.
   ======================================================================== */
const FIGURAS_LUMI = [
  { ate: 3,    id: "ate-3",  rotulo: "Até aos 3",  alt: "O Lumi em bebé, com a sua mantinha-cão" },
  { ate: 6,    id: "3-6",    rotulo: "3 aos 6",    alt: "O Lumi em pequeno, com um cubo de brincar" },
  { ate: 8,    id: "6-8",    rotulo: "6 aos 8",    alt: "O Lumi com mochila e um foguetão" },
  { ate: 10,   id: "8-10",   rotulo: "8 aos 10",   alt: "O Lumi com uma maqueta do sistema solar" },
  { ate: 15,   id: "10-15",  rotulo: "10 aos 15",  alt: "O Lumi mais crescido, com um drone" },
  { ate: 999,  id: "15-18",  rotulo: "15 aos 18",  alt: "O Lumi adolescente, de camisola com capuz" }
];

const FIGURA_LUMI_OMISSAO = "8-10";

function figuraLumi(idade) {
  if (idade == null || isNaN(idade)) {
    return FIGURAS_LUMI.filter(function (f) { return f.id === FIGURA_LUMI_OMISSAO; })[0];
  }
  for (var i = 0; i < FIGURAS_LUMI.length; i++) {
    if (idade < FIGURAS_LUMI[i].ate) return FIGURAS_LUMI[i];
  }
  return FIGURAS_LUMI[FIGURAS_LUMI.length - 1];
}

/** O retrato a usar para esta idade. "pequeno" é a mesma figura numa versão
 *  mais leve, para quando aparecem várias na mesma página. */
function mascoteLumi(idade, prefixo) {
  const base = (prefixo || "") + "assets/img/lumi-";
  const f = figuraLumi(idade);
  return {
    ficheiro: base + f.id + ".png",
    pequeno:  base + f.id + "-peq.png",
    alt:      f.alt,
    faixa:    f.id,
    rotulo:   f.rotulo
  };
}

/** Desenha o painel da mascote: retrato + balão de fala.
 *  mensagem aceita HTML simples (<strong>), porque quase sempre leva o nome
 *  da criança a negrito. */
function renderMascote(containerId, idade, mensagem, opts) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const o = opts || {};
  const m = mascoteLumi(idade, o.prefixo);
  el.className = "lumi-painel";
  el.innerHTML =
    '<div class="lumi-retrato' + (o.grande ? ' grande' : '') + '">' +
      '<img src="' + m.ficheiro + '" alt="' + m.alt + '">' +
    '</div>' +
    '<div class="lumi-fala"><div class="balao">' + mensagem + '</div></div>';
}

/** Primeiro nome, para o Lumi tratar a criança pelo nome. */
function primeiroNome(nome) {
  return (nome || "").trim().split(/\s+/)[0] || "";
}

/* ========================================================================
   AS FIGURAS DA EQUIPA
   ------------------------------------------------------------------------
   Liga o nome da especialidade, tal como fica gravado em doentes.equipa, à
   figura que a representa. A Fisioterapia e a Terapia Ocupacional partilham
   figura: andam juntas na unidade e a criança não as distingue.

   Uma especialidade sem figura não quebra nada — figuraEquipa devolve null e
   quem chama mostra o nome sozinho.
   ======================================================================== */
const FIGURAS_EQUIPA = {
  "Cirurgia Plástica": "cirurgia-plastica",
  "Enfermagem": "enfermagem",
  "Anestesiologia": "anestesiologia",
  "Pediatria": "pediatria",
  "Fisiatria": "fisiatria",
  "Medicina Física e de Reabilitação": "fisiatria",
  "Fisioterapia": "fisioterapia",
  "Terapia Ocupacional": "fisioterapia",
  "Técnica Auxiliar de Saúde": "tecnica-auxiliar",
  "Educação de Infância": "educacao",
  "Psicologia": "psicologia",
  "Pedopsiquiatria": "pedopsiquiatria",
  "Nutrição": "nutricao",
  "Serviço Social": "servico-social"
};

function figuraEquipa(especialidade, prefixo) {
  const slug = FIGURAS_EQUIPA[especialidade];
  return slug ? (prefixo || "") + "assets/img/equipa/" + slug + ".png" : null;
}

const DEMO_PATIENT = {
  nome: "Doente Demonstração",
  processo: "PROC-2026-0142",
  tbsa: 25,
  profundidade: "2º e 3º grau",
  zona: "Membro superior esquerdo, tronco anterior",
  dataAlta: "2026-07-15",
  equipa: ["Dr. Cirurgia Plástica", "Enfermagem", "Fisioterapia", "Terapia Ocupacional", "Psicologia", "Nutrição"],
  milestones: [
    { id: 1, label: "Alta hospitalar", data: "15 Jul 2026", estado: "done", tipo: "Marco clínico", categoria: "marco-clinico", origem: "clinica", importante: false, foto: null },
    { id: 2, label: "PROM — 2 semanas", data: "29 Jul 2026", estado: "done", tipo: "Checkpoint PROM", categoria: "prom", origem: "clinica", importante: false, foto: null },
    { id: 3, label: "Encerramento da ferida", data: "05 Ago 2026", estado: "done", tipo: "Cicatrização", categoria: "cicatrizacao", origem: "clinica", importante: true, foto: null },
    { id: 4, label: "PROM — 3 meses", data: "15 Out 2026", estado: "active", tipo: "Checkpoint PROM", categoria: "prom", origem: "clinica", importante: false, foto: null },
    { id: 5, label: "Amplitude de movimento total", data: "prev. Nov 2026", estado: "pending", tipo: "Funcional", categoria: "funcional", origem: "clinica", importante: true, foto: null },
    { id: 6, label: "Voltar a pentear o cabelo sozinha", data: "meta pessoal", estado: "pending", tipo: "Funcional", categoria: "funcional", origem: "doente", importante: true, foto: null },
    { id: 7, label: "Retorno ao trabalho", data: "prev. Dez 2026", estado: "pending", tipo: "Psicossocial", categoria: "psicossocial", origem: "doente", importante: true, foto: null },
    { id: 8, label: "PROM — 6 meses", data: "15 Jan 2027", estado: "pending", tipo: "Checkpoint PROM", categoria: "prom", origem: "clinica", importante: false, foto: null },
    { id: 9, label: "PROM — 12 meses", data: "15 Jul 2027", estado: "pending", tipo: "Checkpoint PROM", categoria: "prom", origem: "clinica", importante: false, foto: null }
  ],
  scores: {
    labels: ["Alta", "2 sem", "6 sem", "3 meses"],
    dor: [7, 5, 3, 2],
    prurido: [6, 6, 4, 3],
    bshsTotal: [null, 58, 68, 74],
    phq9: [null, 11, 7, 5]
  },
  plano: {
    exercicios: [
      {
        id: 0, nome: "Troca de penso e observação da ferida", categoria: "Enfermagem",
        descricao: "Trocar o penso conforme técnica ensinada, observando sinais de infeção (vermelhidão, calor, exsudado, cheiro).",
        prescricao: "1x por dia, de manhã",
        registos: [
          { data: "06 Ago 2026", esforco: 3, nota: "Sem sinais de infeção." }
        ]
      },
      {
        id: 1, nome: "Alongamento do ombro esquerdo", categoria: "Fisioterapia",
        descricao: "Elevação lenta do braço até ao limite tolerável, mantendo 15 segundos.",
        prescricao: "3 séries de 10 repetições · 2x por dia",
        registos: [
          { data: "05 Ago 2026", esforco: 6, nota: "Consegui sem dor forte." },
          { data: "07 Ago 2026", esforco: 5, nota: "" }
        ]
      },
      {
        id: 2, nome: "Exercícios de preensão da mão", categoria: "Terapia Ocupacional",
        descricao: "Apertar e largar uma bola de borracha macia, com controlo do movimento.",
        prescricao: "10 repetições · 3x por dia",
        registos: [
          { data: "06 Ago 2026", esforco: 4, nota: "" }
        ]
      },
      {
        id: 3, nome: "Marcha assistida", categoria: "Fisioterapia",
        descricao: "Caminhada em piso plano, com apoio se necessário.",
        prescricao: "15 minutos · 1x por dia",
        registos: []
      },
      {
        id: 4, nome: "Plano nutricional pós-queimadura", categoria: "Nutrição",
        descricao: "Dieta hiperproteica e hipercalórica para apoiar a cicatrização: incluir proteína em todas as refeições, reforçar vitamina C e zinco, hidratação de 1,5–2L/dia, evitar álcool e tabaco.",
        prescricao: "Diariamente",
        registos: [
          { data: "05 Ago 2026", esforco: 3, nota: "Alguma dificuldade em cumprir a ingestão proteica ao pequeno-almoço." }
        ]
      }
    ]
  }
};

/* ========================================================================
   O RIO — desenha a jornada do doente como um percurso serpenteante
   ======================================================================== */
function desenharRio(containerId, milestones, opts = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const w = opts.width || 1040;
  const h = opts.height || 180;
  const n = milestones.length;
  const marginX = 60;
  const usableW = w - marginX * 2;

  // pontos ao longo de uma curva suave (serpenteante)
  const pts = milestones.map((m, i) => {
    const x = marginX + (usableW * i) / (n - 1);
    const y = h / 2 + Math.sin(i * 1.15) * 34;
    return Object.assign({}, m, { x, y });
  });

  // caminho suave via curva de Catmull-Rom -> Bezier aproximada
  function pathFrom(points) {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  const lastDoneIdx = (() => {
    let idx = -1;
    milestones.forEach((m, i) => { if (m.estado === "done") idx = i; });
    // inclui o nó ativo até meio caminho para o próximo
    const activeIdx = milestones.findIndex(m => m.estado === "active");
    return { idx, activeIdx };
  })();

  const fullPath = pathFrom(pts);
  const progressPoints = pts.slice(0, Math.max(lastDoneIdx.idx + 1, 1) + (lastDoneIdx.activeIdx > -1 ? 1 : 0));
  const progressPath = pathFrom(progressPoints.length > 1 ? progressPoints : pts.slice(0, 2));

  const nodes = pts.map((p, i) => {
    const labelY = (i % 2 === 0) ? p.y - 22 : p.y + 34;
    const dateY = (i % 2 === 0) ? p.y - 9 : p.y + 47;
    const pulse = p.estado === "active"
      ? `<circle class="pulse"><animate attributeName="r" values="9;16;9" dur="2.2s" repeatCount="indefinite" /><animate attributeName="opacity" values=".5;0;.5" dur="2.2s" repeatCount="indefinite" /></circle>`
      : "";
    return `
      <g class="rio-node ${p.estado}" data-tip="${p.label} — ${p.tipo} · ${p.data}" transform="translate(${p.x},${p.y})">
        ${pulse}
        <circle r="9"></circle>
        <text class="label" text-anchor="middle" y="${labelY - p.y}">${quebraLinha(p.label)}</text>
        <text class="date mono" text-anchor="middle" y="${dateY - p.y}">${p.data}</text>
      </g>`;
  }).join("");

  el.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa da jornada de recuperação do doente">
      <path class="rio-path-bg" d="${fullPath}" />
      <path class="rio-path-fg" id="${containerId}-fg" d="${progressPath}" />
      ${nodes}
    </svg>
    <div class="rio-tip" id="${containerId}-tip"></div>
  `;

  // anima o traço de progresso
  const fg = document.getElementById(`${containerId}-fg`);
  if (fg) {
    const len = fg.getTotalLength();
    fg.style.setProperty("--dash", len);
    fg.style.setProperty("--offset", len);
    requestAnimationFrame(() => { fg.style.setProperty("--offset", 0); });
  }

  // tooltip
  const tip = document.getElementById(`${containerId}-tip`);
  el.querySelectorAll(".rio-node").forEach(node => {
    node.addEventListener("mouseenter", (e) => {
      const [label, rest] = node.dataset.tip.split(" — ");
      tip.innerHTML = `<strong>${label}</strong><span>${rest}</span>`;
      tip.style.display = "block";
    });
    node.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      tip.style.left = (e.clientX - rect.left + 14) + "px";
      tip.style.top = (e.clientY - rect.top - 10) + "px";
    });
    node.addEventListener("mouseleave", () => { tip.style.display = "none"; });
  });
}

function quebraLinha(texto) {
  // quebra rótulos longos em duas linhas de tspans
  if (texto.length <= 16) return texto;
  const palavras = texto.split(" ");
  const meio = Math.ceil(palavras.length / 2);
  const l1 = palavras.slice(0, meio).join(" ");
  const l2 = palavras.slice(meio).join(" ");
  return `<tspan x="0" dy="0">${l1}</tspan><tspan x="0" dy="11">${l2}</tspan>`;
}

/* ========================================================================
   Gráficos de evolução dos PROMs (via Chart.js)
   ======================================================================== */
/* As três cores dos gráficos. Vêm da paleta Lumi (ver :root em styles.css) e
   não das variáveis CSS porque o Chart.js precisa de valores resolvidos. */
function corTeal()  { return "#1B7FA8"; }   /* azul Lumi — cor primária dos gráficos */
function corSkin()  { return "#D98A1F"; }   /* âmbar — prurido, para se distinguir do vermelho da dor */
function corAlert() { return "#C6402E"; }

function desenharGraficoLinha(canvasId, labels, dataset, opts = {}) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === "undefined") return;
  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: opts.label || "",
        data: dataset,
        borderColor: opts.color || corTeal(),
        backgroundColor: (opts.color || corTeal()) + "22",
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: opts.color || corTeal(),
        spanGaps: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: (opts.min !== undefined ? opts.min : 0),
          max: (opts.max !== undefined ? opts.max : 10),
          grid: { color: "#E3E8E4" },
          ticks: Object.assign(
            { font: { family: "IBM Plex Mono", size: 10 } },
            // opts.rotulosY troca os números do eixo por texto (usado no
            // gráfico de humor, em que 1–6 são estados e não uma medida)
            opts.rotulosY ? { stepSize: 1, callback: v => opts.rotulosY[v] || "" } : {}
          )
        },
        x: { grid: { display: false }, ticks: { font: { family: "IBM Plex Mono", size: 10 } } }
      }
    }
  });
}

/* ========================================================================
   RESUMO DE PROGRESSO DA JORNADA — substitui o mapa "rio" quando há
   muitas metas (o rio deixa de ser legível ao crescer); usado no
   dashboard do doente e na ficha do profissional
   ======================================================================== */
function renderJornadaResumo(containerId, opts) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const linkHref = (opts && opts.linkHref) || "jornada.html";
  const ms = DEMO_PATIENT.milestones;
  const total = ms.length;
  const concluidas = ms.filter(m => m.estado === "done").length;
  const pct = total ? Math.round((concluidas / total) * 100) : 0;

  const proximas = ms.filter(m => m.estado !== "done").slice(0, 3);

  const linhasProximas = proximas.map(m => {
    const pill = m.estado === "active"
      ? `<span class="pill pill-pending">Em curso</span>`
      : `<span class="pill" style="background:var(--paper-tint); color:var(--ink-soft);">Por iniciar</span>`;
    const estrela = m.importante ? " ★" : "";
    return `
      <div class="mini-meta">
        <div>
          <strong>${m.label}${estrela}</strong>
          <span class="hint" style="display:block;">${m.tipo} · ${m.data}</span>
        </div>
        ${pill}
      </div>`;
  }).join("") || `<p class="hint" style="margin:0;">Todas as metas atuais foram concluídas.</p>`;

  el.innerHTML = `
    <div class="progress-row">
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;"></div></div>
      <span class="mono" style="font-size:.8rem; color:var(--ink-soft); white-space:nowrap;">${concluidas}/${total} metas concluídas</span>
    </div>
    <div class="proximas-metas">${linhasProximas}</div>
    <a class="btn btn-star btn-sm" href="${linkHref}" style="margin-top:14px;">🎯 Ver todas as metas e conquistas</a>
  `;
}

const DUVIDAS_DEMO = [
  {
    id: 1, doente: "Maria Santos", categoria: "Ferida",
    pergunta: "A cicatriz está mais vermelha esta semana, é normal?",
    data: "08 Ago 2026", estado: "pendente",
    resposta: null, respondidoPor: null, dataResposta: null
  },
  {
    id: 2, doente: "Maria Santos", categoria: "Medicação",
    pergunta: "Posso tomar o analgésico em jejum?",
    data: "03 Ago 2026", estado: "respondida",
    resposta: "Sim, mas se sentir desconforto gástrico pode tomá-lo com um pequeno lanche. Se a dor não melhorar, avise-nos.",
    respondidoPor: "Enfermagem", dataResposta: "04 Ago 2026"
  },
  {
    id: 3, doente: "Maria Santos", categoria: "Emocional",
    pergunta: "Tenho-me sentido em baixo por causa da cicatriz. É normal sentir-me assim?",
    data: "30 Jul 2026", estado: "respondida",
    resposta: "É uma reação muito comum e compreensível. Vamos falar sobre isso na próxima consulta de Psicologia — se precisar antes disso, pode contactar-nos.",
    respondidoPor: "Psicologia", dataResposta: "31 Jul 2026"
  },
  {
    id: 4, doente: "João Costa", categoria: "Dor",
    pergunta: "A dor aumenta muito à noite, o que posso fazer?",
    data: "09 Ago 2026", estado: "pendente",
    resposta: null, respondidoPor: null, dataResposta: null
  }
];

/* ---------- área do doente ---------- */
function duvidaCardHTML(d, mostrarDoente) {
  const estadoPill = d.estado === "respondida"
    ? `<span class="pill pill-ok">Respondida</span>`
    : `<span class="pill pill-alert">Por responder</span>`;
  const quem = mostrarDoente ? `<strong>${d.doente}</strong> · ` : "";
  const telefone = d.contactoTelefonico ? `<span class="milestone-tag origem-doente">📞 Pediu contacto telefónico</span>` : "";
  const resposta = d.estado === "respondida"
    ? `<div class="duvida-resposta">
        <p class="hint" style="margin-bottom:4px; font-weight:600; color:var(--blue-deep);">Resposta de ${d.respondidoPor} · ${d.dataResposta}</p>
        <p style="margin:0;">${d.resposta}</p>
      </div>`
    : "";
  return `
    <div class="card milestone-card" style="margin-bottom:14px;">
      <div class="milestone-head">
        <div>
          <div class="milestone-meta"><span class="milestone-tag">${d.categoria}</span>${telefone}</div>
          <p style="margin:0; color:var(--ink);">${quem}${d.pergunta}</p>
          <p class="hint" style="margin:4px 0 0;">${d.data}</p>
        </div>
        ${estadoPill}
      </div>
      ${resposta}
    </div>`;
}

function renderDuvidasDoente(containerId, nomeDoente) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const lista = DUVIDAS_DEMO.filter(d => d.doente === nomeDoente).sort((a, b) => b.id - a.id);
  el.innerHTML = lista.length
    ? lista.map(d => duvidaCardHTML(d, false)).join("")
    : `<p class="hint">Ainda não enviou nenhuma dúvida.</p>`;
}

function submeterDuvida(categoria, texto, nomeDoente) {
  if (!texto || !texto.trim()) return;
  const novoId = Math.max(0, ...DUVIDAS_DEMO.map(d => d.id)) + 1;
  const hoje = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
  DUVIDAS_DEMO.unshift({
    id: novoId, doente: nomeDoente, categoria, pergunta: texto.trim(),
    data: hoje, estado: "pendente", resposta: null, respondidoPor: null, dataResposta: null
  });
  renderDuvidasDoente("lista-duvidas", nomeDoente);
}

/* ---------- área profissional ---------- */
function duvidaEditorHTML(d) {
  const estadoPill = d.estado === "respondida"
    ? `<span class="pill pill-ok">Respondida</span>`
    : `<span class="pill pill-alert">Por responder</span>`;
  const telefone = d.contactoTelefonico ? `<span class="milestone-tag origem-doente">📞 Pediu contacto telefónico</span>` : "";

  const corpoResposta = d.estado === "respondida"
    ? `<div class="duvida-resposta">
        <p class="hint" style="margin-bottom:4px; font-weight:600; color:var(--blue-deep);">Respondido por ${d.respondidoPor} · ${d.dataResposta}</p>
        <p style="margin:0;">${d.resposta}</p>
      </div>`
    : `
      <div style="margin-top:14px;">
        <select id="resp-por-${d.id}" style="margin-bottom:10px;">
          <option value="Enfermagem">Enfermagem</option>
          <option value="Cirurgia Plástica">Cirurgia Plástica</option>
          <option value="Fisioterapia">Fisioterapia</option>
          <option value="Terapia Ocupacional">Terapia Ocupacional</option>
          <option value="Psicologia">Psicologia</option>
          <option value="Nutrição">Nutrição</option>
        </select>
        <textarea id="resp-texto-${d.id}" rows="3" placeholder="Escreva a resposta para o doente..."></textarea>
        <button type="button" class="btn btn-star btn-sm" style="margin-top:10px;" onclick="responderDuvida('${d.id}')">Enviar resposta</button>
      </div>`;

  return `
    <div class="card milestone-card ${d.estado === "pendente" ? "is-active" : ""}" style="margin-bottom:14px;" id="duvida-${d.id}">
      <div class="milestone-head">
        <div>
          <div class="milestone-meta"><span class="milestone-tag">${d.categoria}</span>${telefone}</div>
          <h3 class="milestone-title" style="font-size:1rem;">${d.doente}</h3>
          <p style="margin:2px 0 0; color:var(--ink);">${d.pergunta}</p>
          <p class="hint" style="margin:4px 0 0;">${d.data}</p>
        </div>
        ${estadoPill}
      </div>
      ${corpoResposta}
    </div>`;
}

function renderDuvidasProfissional(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const lista = [...DUVIDAS_DEMO].sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === "pendente" ? -1 : 1;
    return b.id - a.id;
  });
  el.innerHTML = lista.map(duvidaEditorHTML).join("");
}

function responderDuvida(id) {
  const d = DUVIDAS_DEMO.find(x => String(x.id) === String(id));
  if (!d) return;
  const texto = document.getElementById(`resp-texto-${id}`).value;
  if (!texto || !texto.trim()) { alert("Escreva uma resposta antes de enviar."); return; }
  const respondidoPor = document.getElementById(`resp-por-${id}`).value;
  const hoje = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
  d.estado = "respondida";
  d.resposta = texto.trim();
  d.respondidoPor = respondidoPor;
  d.dataResposta = hoje;
  renderDuvidasProfissional("lista-duvidas-prof");
}

/* ---------- navegação entre doentes (área profissional) ---------- */
function obterProcessoDaURL(padrao) {
  const params = new URLSearchParams(window.location.search);
  return params.get("processo") || padrao;
}

/** Acrescenta "?processo=..." a todos os links da sidebar marcados com
 *  data-processo-link, para manter o doente selecionado ao mudar de secção
 *  (Formulário de Alta, Plano, Jornada, Agenda de PROMs, Histórico...). */
function ligarSidebarAoProcesso(processo) {
  if (!processo) return;
  document.querySelectorAll('.sidebar a[data-processo-link]').forEach(a => {
    const base = a.getAttribute('href').split('?')[0];
    a.href = `${base}?processo=${encodeURIComponent(processo)}`;
  });
}

/* ---------- toggle simples de menu mobile / tabs, se necessário ---------- */
function ativarTabs(grupoSelector) {
  document.querySelectorAll(grupoSelector).forEach(grupo => {
    grupo.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tab]");
      if (!btn) return;
      const alvo = btn.dataset.tab;
      grupo.querySelectorAll("[data-tab]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(`[data-tab-panel]`).forEach(p => {
        p.style.display = (p.dataset.tabPanel === alvo) ? "block" : "none";
      });
    });
  });
}

/* ========================================================================
   JORNADA DE RECUPERAÇÃO — metas, badges e fotos (área do doente)
   ======================================================================== */
let fotosTemp = {};

function milestoneCardHTML(m) {
  const b = BADGES[m.categoria] || { icon: "🎯", nome: m.tipo };
  const doneClass = m.estado === "done" ? "is-done" : (m.estado === "active" ? "is-active" : "");
  const estadoPill = m.estado === "done"
    ? `<span class="pill pill-ok">Concluída</span>`
    : (m.estado === "active"
        ? `<span class="pill pill-pending">Em curso</span>`
        : `<span class="pill" style="background:var(--paper-tint); color:var(--ink-soft);">Por iniciar</span>`);
  const origemTag = m.origem === "doente"
    ? `<span class="milestone-tag origem-doente">Meta pessoal</span>`
    : `<span class="milestone-tag">Definida pela equipa</span>`;
  const importanteTag = m.importante ? `<span class="milestone-tag origem-doente">★ Importante para mim</span>` : "";

  let actionHTML;
  if (m.estado === "done") {
    actionHTML = `<div class="milestone-badge-earned"><span class="ic">${b.icon}</span> Conquistou o badge "${b.nome}"</div>`;
    if (m.foto) actionHTML += `<div class="milestone-photo"><img src="${m.foto}" alt="Foto da conquista de ${m.label}"></div>`;
  } else {
    actionHTML = `
      <label class="photo-upload" for="foto-${m.id}">
        <input type="file" accept="image/*" id="foto-${m.id}" onchange="prepararFoto('${m.id}', this)">
        <div class="lbl">📷 Adicionar uma foto (opcional)</div>
      </label>
      <div id="foto-preview-${m.id}"></div>
      <button type="button" class="btn btn-star btn-sm" style="margin-top:12px;" onclick="marcarConquistada('${m.id}')">Marcar como atingida</button>
    `;
  }

  return `
    <div class="milestone-card ${doneClass}" id="milestone-${m.id}">
      <div class="milestone-head">
        <div>
          <div class="milestone-meta">${origemTag}${importanteTag}</div>
          <h3 class="milestone-title">${m.label}</h3>
          <p class="hint" style="margin:0;">${m.tipo} · ${m.data}</p>
        </div>
        ${estadoPill}
      </div>
      ${actionHTML}
      <div class="meta-updates" id="meta-updates-${m.id}"></div>
    </div>`;
}

function renderMilestonesDoente(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = DEMO_PATIENT.milestones.map(milestoneCardHTML).join("");
}

function renderBadgeShelf(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const earned = new Set(DEMO_PATIENT.milestones.filter(m => m.estado === "done").map(m => m.categoria));
  el.innerHTML = Object.keys(BADGES).map(cat => {
    const b = BADGES[cat];
    const isEarned = earned.has(cat);
    return `
      <div class="badge-item ${isEarned ? "" : "locked"}" title="${b.desc}">
        <div class="ic">${b.icon}</div>
        <strong>${b.nome}</strong>
        <span>${isEarned ? "Conquistada" : "Por conquistar"}</span>
      </div>`;
  }).join("");
}

function prepararFoto(id, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    fotosTemp[id] = e.target.result;
    const prev = document.getElementById(`foto-preview-${id}`);
    if (prev) prev.innerHTML = `<div class="milestone-photo"><img src="${e.target.result}" alt="Pré-visualização da foto"></div>`;
  };
  reader.readAsDataURL(file);
}

function marcarConquistada(id) {
  const m = DEMO_PATIENT.milestones.find(x => x.id === id);
  if (!m) return;
  m.estado = "done";
  if (fotosTemp[id]) m.foto = fotosTemp[id];
  if (typeof onJornadaUpdate === "function") onJornadaUpdate();
}

function adicionarMetaPessoal(titulo, importante) {
  if (!titulo || !titulo.trim()) return;
  const ids = DEMO_PATIENT.milestones.map(m => m.id);
  const novoId = (ids.length ? Math.max.apply(null, ids) : 0) + 1;
  DEMO_PATIENT.milestones.push({
    id: novoId, label: titulo.trim(), data: "meta pessoal", estado: "pending",
    tipo: "Pessoal", categoria: "pessoal", origem: "doente", importante: !!importante, foto: null
  });
  if (typeof onJornadaUpdate === "function") onJornadaUpdate();
}

/* ========================================================================
   JORNADA DE RECUPERAÇÃO — editor (área profissional)
   ======================================================================== */
/** Um valor de meta pode vir vazio da base de dados (data_alvo é opcional).
 *  Sem esta guarda, um único m.data a null rebentava o editor inteiro e as
 *  metas deixavam de aparecer ao profissional. */
function textoAtributo(valor) {
  return String(valor == null ? "" : valor).replace(/"/g, "&quot;");
}

function editorRowHTML(m, idx) {
  const catOptions = Object.keys(BADGES).map(k =>
    `<option value="${k}" ${m.categoria === k ? "selected" : ""}>${BADGES[k].nome}</option>`
  ).join("");
  return `
  <div class="card" style="margin-bottom:14px;" id="editor-row-${m.id}">
    <div class="form-row">
      <div class="field" style="margin-bottom:12px;">
        <label>Título da meta</label>
        <input type="text" id="meta-label-${m.id}" value="${textoAtributo(m.label)}">
      </div>
      <div class="field" style="margin-bottom:12px;">
        <label>Data alvo</label>
        <input type="text" id="meta-data-${m.id}" value="${textoAtributo(m.data)}">
      </div>
    </div>
    <div class="form-row">
      <div class="field" style="margin-bottom:12px;">
        <label>Categoria (badge associado)</label>
        <select id="meta-categoria-${m.id}">${catOptions}</select>
      </div>
      <div class="field" style="margin-bottom:12px;">
        <label>Estado</label>
        <select id="meta-estado-${m.id}">
          <option value="pending" ${m.estado === "pending" ? "selected" : ""}>Por iniciar</option>
          <option value="active" ${m.estado === "active" ? "selected" : ""}>Em curso</option>
          <option value="done" ${m.estado === "done" ? "selected" : ""}>Concluída</option>
        </select>
      </div>
    </div>
    ${m.foto ? `
    <div style="margin-bottom:12px;">
      <p class="hint" style="margin:0 0 6px; font-weight:600; color:var(--blue-deep);">📷 Foto enviada pelo doente</p>
      <div class="milestone-photo" style="margin-top:0;"><img src="${m.foto}" alt="Foto submetida pelo doente para a meta ${textoAtributo(m.label)}"></div>
    </div>` : ""}
    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <label class="star-toggle">
          <input type="checkbox" id="meta-importante-${m.id}" ${m.importante ? "checked" : ""}>
          <span>★ Importante para o doente</span>
        </label>
        <span class="milestone-tag ${m.origem === "doente" ? "origem-doente" : ""}">${m.origem === "doente" ? "Proposta pelo doente" : "Definida pela equipa"}</span>
      </div>
      <div style="display:flex; gap:8px;">
        <button type="button" class="btn btn-primary btn-sm" id="btn-guardar-meta-${m.id}" onclick="guardarMeta('${m.id}')">Guardar alterações</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="removerMeta('${m.id}')">Remover</button>
      </div>
    </div>
    <div class="meta-updates" id="meta-updates-${m.id}"></div>
  </div>`;
}

/* versão de demonstração (sem base de dados): só atualiza o objeto local */
function guardarMeta(id) {
  const meta = DEMO_PATIENT.milestones.find(m => String(m.id) === String(id));
  if (!meta) return;
  meta.label = document.getElementById(`meta-label-${id}`).value;
  meta.data = document.getElementById(`meta-data-${id}`).value;
  meta.categoria = document.getElementById(`meta-categoria-${id}`).value;
  meta.estado = document.getElementById(`meta-estado-${id}`).value;
  meta.importante = document.getElementById(`meta-importante-${id}`).checked;
}

function renderMilestonesEditor(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const abertas = DEMO_PATIENT.milestones.filter(m => m.estado !== "done");
  const concluidas = DEMO_PATIENT.milestones.filter(m => m.estado === "done");

  el.innerHTML = `
    <div class="grid g-2" style="align-items:start; gap:24px;">
      <div>
        <p class="eyebrow" style="margin-bottom:14px;">Em aberto (${abertas.length})</p>
        ${abertas.length ? abertas.map(editorRowHTML).join("") : `<p class="hint">Sem metas em aberto de momento.</p>`}
      </div>
      <div>
        <p class="eyebrow" style="margin-bottom:14px;">Concluídas (${concluidas.length})</p>
        ${concluidas.length ? concluidas.map(editorRowHTML).join("") : `<p class="hint">Ainda sem metas concluídas.</p>`}
      </div>
    </div>`;
}

function removerMeta(id) {
  DEMO_PATIENT.milestones = DEMO_PATIENT.milestones.filter(m => String(m.id) !== String(id));
  renderMilestonesEditor("editor-metas");
}

function adicionarMetaEditor() {
  const ids = DEMO_PATIENT.milestones.map(m => m.id);
  const novoId = (ids.length ? Math.max.apply(null, ids) : 0) + 1;
  DEMO_PATIENT.milestones.push({
    id: novoId, label: "Nova meta", data: "a definir", estado: "pending",
    tipo: "Funcional", categoria: "funcional", origem: "clinica", importante: false, foto: null
  });
  renderMilestonesEditor("editor-metas");
}

/* ========================================================================
   PLANO DE TRATAMENTO — exercícios (Fisioterapia / Terapia Ocupacional)
   e dieta (Nutrição). Presente em ambas as áreas.
   ======================================================================== */

/* ---------- área do doente: registar sessão + ver histórico ---------- */
function renderPlanoDoente(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = DEMO_PATIENT.plano.exercicios.map(exercicioCardDoente).join("");
}

function exercicioCardDoente(ex) {
  const ultimos = ex.registos.slice(-3).reverse();
  const historico = ultimos.length
    ? `<div class="exercicio-historico">
        ${ultimos.map(r => `
          <div class="mini-meta">
            <div><strong>${r.data}</strong>${r.nota ? `<span class="hint" style="display:block;">${r.nota}</span>` : ""}</div>
            <span class="pill pill-star">Esforço ${r.esforco}/10</span>
          </div>`).join("")}
      </div>`
    : `<p class="hint" style="margin:10px 0 0;">Ainda sem registos de execução.</p>`;

  return `
    <div class="card milestone-card" style="margin-bottom:16px;">
      <div class="milestone-head">
        <div>
          <div class="milestone-meta"><span class="milestone-tag">${ex.categoria}</span></div>
          <h3 class="milestone-title">${ex.nome}</h3>
          <p class="hint" style="margin:0;">${ex.descricao}</p>
          <p class="hint" style="margin:4px 0 0; font-weight:600; color:var(--blue-deep);">${ex.prescricao}</p>
        </div>
      </div>

      <div class="registo-form" id="registo-form-${ex.id}">
        <p class="scale-note" style="margin-top:14px;">Quanto esforço sentiu ao realizar hoje? (0 = nenhum · 10 = esforço máximo)</p>
        <div class="scale mini-scale" id="esforco-${ex.id}">
          ${Array.from({length: 11}, (_, i) => `<label class="scale-opt"><input type="radio" name="esforco-${ex.id}" value="${i}"><span>${i}</span></label>`).join("")}
        </div>
        <input type="text" id="nota-${ex.id}" placeholder="Nota (opcional)" style="margin-top:10px;">
        <button type="button" class="btn btn-star btn-sm" style="margin-top:12px;" onclick="registarExercicio('${ex.id}')">Registar realização de hoje</button>
      </div>

      <hr class="divider" style="margin:16px 0 10px;">
      <p class="eyebrow" style="margin-bottom:6px;">Histórico recente</p>
      ${historico}
    </div>`;
}

function registarExercicio(id) {
  const ex = DEMO_PATIENT.plano.exercicios.find(e => e.id === id);
  if (!ex) return;
  const selecionado = document.querySelector(`input[name="esforco-${id}"]:checked`);
  if (!selecionado) { alert("Indique o nível de esforço antes de registar."); return; }
  const nota = document.getElementById(`nota-${id}`).value;
  const hoje = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
  ex.registos.push({ data: hoje, esforco: parseInt(selecionado.value, 10), nota });
  renderPlanoDoente("plano-exercicios");
}

/* ---------- área profissional: prescrever + ver adesão ---------- */
function renderPlanoEditor(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = DEMO_PATIENT.plano.exercicios.map(exercicioEditorHTML).join("");
}

function exercicioEditorHTML(ex) {
  const totalRegistos = ex.registos.length;
  const mediaEsforco = totalRegistos
    ? (ex.registos.reduce((s, r) => s + r.esforco, 0) / totalRegistos).toFixed(1)
    : "—";
  const suspenso = ex.estado === "suspenso";
  return `
    <div class="card" style="margin-bottom:16px;${suspenso ? " border-style:dashed; background:var(--paper-tint);" : ""}" id="plano-row-${ex.id}">
      ${suspenso ? `<p style="margin:0 0 12px;"><span class="pill pill-alert">Suspenso</span>
        <span class="hint" style="margin-left:8px;">Não aparece ao doente. O histórico fica guardado.</span></p>` : ""}
      <div class="form-row">
        <div class="field" style="margin-bottom:12px;">
          <label>Nome do exercício</label>
          <input type="text" id="ex-nome-${ex.id}" value="${ex.nome.replace(/"/g, '&quot;')}">
        </div>
        <div class="field" style="margin-bottom:12px;">
          <label>Prescrito por</label>
          <select id="ex-categoria-${ex.id}">
            <option value="Cirurgia Plástica" ${ex.categoria === "Cirurgia Plástica" ? "selected" : ""}>Cirurgia Plástica</option>
            <option value="Enfermagem" ${ex.categoria === "Enfermagem" ? "selected" : ""}>Enfermagem</option>
            <option value="Fisioterapia" ${ex.categoria === "Fisioterapia" ? "selected" : ""}>Fisioterapia</option>
            <option value="Terapia Ocupacional" ${ex.categoria === "Terapia Ocupacional" ? "selected" : ""}>Terapia Ocupacional</option>
            <option value="Psicologia" ${ex.categoria === "Psicologia" ? "selected" : ""}>Psicologia</option>
            <option value="Nutrição" ${ex.categoria === "Nutrição" ? "selected" : ""}>Nutrição</option>
          </select>
        </div>
      </div>
      <div class="field" style="margin-bottom:12px;">
        <label>Descrição</label>
        <textarea id="ex-descricao-${ex.id}" rows="2">${ex.descricao}</textarea>
      </div>
      <div class="field" style="margin-bottom:14px;">
        <label>Prescrição (séries / repetições / frequência)</label>
        <input type="text" id="ex-prescricao-${ex.id}" value="${ex.prescricao.replace(/"/g, '&quot;')}">
      </div>
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
        <span class="pill pill-star">Adesão: ${totalRegistos} registo(s) · esforço médio ${mediaEsforco}</span>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-primary btn-sm" id="btn-guardar-${ex.id}" onclick="guardarExercicio('${ex.id}')">Guardar alterações</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="alternarSuspensaoExercicio('${ex.id}', ${suspenso})">${suspenso ? "Reativar" : "Suspender"}</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="removerExercicio('${ex.id}')">Remover</button>
        </div>
      </div>
    </div>`;
}

/* versão de demonstração (sem base de dados): só atualiza o objeto local */
function alternarSuspensaoExercicio(id, suspenso) {
  const ex = DEMO_PATIENT.plano.exercicios.find(e => e.id === id);
  if (ex) ex.estado = suspenso ? "ativo" : "suspenso";
  renderPlanoEditor("plano-editor");
}

/* versão de demonstração (sem base de dados): só atualiza o objeto local */
function guardarExercicio(id) {
  const ex = DEMO_PATIENT.plano.exercicios.find(e => e.id === id);
  if (!ex) return;
  ex.nome = document.getElementById(`ex-nome-${id}`).value;
  ex.categoria = document.getElementById(`ex-categoria-${id}`).value;
  ex.descricao = document.getElementById(`ex-descricao-${id}`).value;
  ex.prescricao = document.getElementById(`ex-prescricao-${id}`).value;
}

function removerExercicio(id) {
  DEMO_PATIENT.plano.exercicios = DEMO_PATIENT.plano.exercicios.filter(e => e.id !== id);
  renderPlanoEditor("plano-editor");
}

function adicionarExercicio() {
  const ids = DEMO_PATIENT.plano.exercicios.map(e => e.id);
  const novoId = (ids.length ? Math.max.apply(null, ids) : 0) + 1;
  DEMO_PATIENT.plano.exercicios.push({
    id: novoId, nome: "Novo exercício", categoria: "Fisioterapia",
    descricao: "", prescricao: "", registos: []
  });
  renderPlanoEditor("plano-editor");
}

/* ========================================================================
   ATUALIZAÇÕES DE CADA META — o fio onde o doente descreve como está a
   correr ("já consigo vestir-me sozinha, mas ainda com dificuldade") e a
   equipa responde. Usado nos dois lados: area-doente/jornada.html e
   area-profissional/jornada.html preenchem o <div class="meta-updates">
   que os cartões de meta deixam reservado.

   Ao contrário da comunicação da equipa (ficha do doente), este fio é
   PARTILHADO — o doente lê tudo o que aqui é escrito.
   ======================================================================== */
function escaparTexto(valor) {
  return String(valor == null ? "" : valor)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatarDataHoraCurta(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })
       + " · " + d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function atualizacaoItemHTML(a) {
  const doDoente = a.autor_papel === "doente";
  return `
    <div class="update-item ${doDoente ? "do-doente" : ""}">
      <div class="avatar">${doDoente ? "🙋" : "🩺"}</div>
      <div class="corpo">
        <div class="quem">${escaparTexto(a.autor_nome)}<span class="quando">${formatarDataHoraCurta(a.criado_em)}</span></div>
        <p class="texto">${escaparTexto(a.texto).replace(/\n/g, "<br>")}</p>
      </div>
    </div>`;
}

/**
 * Desenha o fio de atualizações dentro do cartão de uma meta.
 *  metaId   — id da meta (o container é #meta-updates-<metaId>)
 *  lista    — atualizações dessa meta, da mais antiga para a mais recente
 *  opts.titulo      — cabeçalho do bloco
 *  opts.vazio       — texto a mostrar quando ainda não há nada
 *  opts.placeholder — placeholder da caixa de escrita
 *  opts.botao       — texto do botão
 *  opts.aoEnviar    — nome da função global a chamar, que recebe o metaId
 *                     (omitir para mostrar o fio só de leitura)
 */
function renderAtualizacoesMeta(metaId, lista, opts) {
  const el = document.getElementById(`meta-updates-${metaId}`);
  if (!el) return;
  const o = opts || {};
  const itens = (lista && lista.length)
    ? lista.map(atualizacaoItemHTML).join("")
    : `<p class="hint" style="margin:0 0 6px;">${escaparTexto(o.vazio || "Ainda sem atualizações.")}</p>`;

  const formulario = o.aoEnviar ? `
    <div class="update-form">
      <textarea id="update-texto-${metaId}" rows="2" placeholder="${escaparTexto(o.placeholder || "Escrever uma atualização...")}"></textarea>
      <button type="button" class="btn btn-ghost btn-sm" id="update-btn-${metaId}"
              onclick="${o.aoEnviar}('${metaId}')">${escaparTexto(o.botao || "Enviar")}</button>
    </div>
    <p class="hint" style="margin:6px 0 0;" id="update-estado-${metaId}"></p>` : "";

  el.innerHTML = `
    <p class="updates-titulo">${escaparTexto(o.titulo || "Atualizações")}</p>
    ${itens}
    ${formulario}`;
}

/** Agrupa por meta_id a lista devolvida por lumiApi.listarAtualizacoesMetas. */
function agruparAtualizacoesPorMeta(linhas) {
  const porMeta = {};
  (linhas || []).forEach(a => {
    if (!porMeta[a.meta_id]) porMeta[a.meta_id] = [];
    porMeta[a.meta_id].push(a);
  });
  return porMeta;
}

/* ========================================================================
   ALERTAS DA UNIDADE — contador mostrado junto a "🔔 Alertas" na barra
   lateral da área profissional, e base da página alertas.html.

   Conta duas coisas: dúvidas de doentes ainda por responder, e a última
   resposta PROM de cada doente que esteja fora dos limiares definidos
   pela equipa. Os limiares vivem aqui, e não em alertas.html, para a
   página e o contador nunca poderem divergir.
   ======================================================================== */
/* Os limiares pediátricos. Os instrumentos não são os da versão de adultos
   (ver assets/js/proms-pediatricos.js), e por isso os pontos de corte também
   não podem ser.

   Dois são escalas de dor com origem diferente e o mesmo intervalo: a FLACC
   é observada por quem cuida de uma criança pequena, a FPS-R e a NRS são
   autorrelatos. Partilham o limiar de 7/10 porque é o ponto a partir do qual
   a dor interfere com o sono e com o brincar, qualquer que seja a origem da
   medida — mas a diferença fica registada em proms_respostas.respondente, e
   a equipa deve lê-la: 7/10 observados num bebé não são 7/10 ditos por um
   adolescente.

   Os restantes são somas de versões reduzidas e não têm pontos de corte
   publicados. Para esses o limiar é uma FRAÇÃO do máximo do instrumento, e
   não um número absoluto — porque o máximo muda com a faixa etária. O SCQ,
   por exemplo, tem 3 itens na bateria dos 5-10 e 4 na dos 11-17: um limiar
   fixo de 10 pontos seria quase o máximo numa faixa e pouco mais de metade
   na outra, e a mesma criança passaria a disparar alertas só por ter feito
   anos. A fração é lida contra o `maximo` que ficou gravado com a resposta.

   São limiares locais e provisórios, à espera de calibração no piloto. É
   deliberado que estejam todos aqui, num sítio só, para poderem ser
   discutidos sem mexer na lógica. */
const LIMIARES_ALERTA = {
  /* escalas de intervalo fixo — limiar absoluto */
  "FLACC":        { min: 7,  texto: v => `Dor elevada observada por quem cuida (${v}/10)` },
  "FPS-R":        { min: 6,  texto: v => `Dor elevada reportada pela criança (${v}/10)` },
  "NRS-dor":      { min: 7,  texto: v => `Dor elevada reportada (${v}/10)` },
  "ItchMan":      { min: 3,  texto: v => `Prurido intenso (${v}/4 na Itch Man)` },

  /* somas de versões reduzidas — limiar proporcional ao máximo gravado */
  "CRIES-8":        { fracao: 0.50, texto: (v, m) => `Sinais de sofrimento pós-traumático (${v}/${m}) — avaliar com Psicologia` },
  "PSQ":            { fracao: 0.60, texto: (v, m) => `Estigma percebido elevado (${v}/${m})` },
  "SCQ":            { fracao: 0.60, texto: (v, m) => `Desconforto social elevado (${v}/${m})` },
  "BOQ-0-5":        { fracao: 0.55, texto: (v, m) => `Dificuldades funcionais e familiares marcadas (BOQ 0-5: ${v}/${m})` },
  "BOQ-5-18":       { fracao: 0.55, texto: (v, m) => `Dificuldades funcionais e escolares marcadas (BOQ 5-18: ${v}/${m})` },
  "BOQ-11-18":      { fracao: 0.55, texto: (v, m) => `Dificuldades funcionais marcadas (BOQ 11-18: ${v}/${m})` },
  "POSAS-doente":   { fracao: 0.70, texto: (v, m) => `Cicatriz mal avaliada pelo próprio (${v}/${m})` },
  "POSAS-cuidador": { fracao: 0.70, texto: (v, m) => `Cicatriz mal avaliada por quem cuida (${v}/${m})` },
  "Cuidador":       { fracao: 0.60, texto: (v, m) => `Impacto familiar e escolar a merecer atenção (${v}/${m})` }
};

/** O valor a partir do qual um instrumento dispara alerta, dado o máximo
 *  gravado com aquela resposta. Devolve null quando o limiar é proporcional
 *  e o máximo não ficou gravado — nesse caso não se inventa um alerta. */
function limiarDisparo(limite, maximo) {
  if (!limite) return null;
  if (limite.min != null) return limite.min;
  if (limite.fracao != null && maximo != null) return Math.ceil(limite.fracao * maximo);
  return null;
}

/* A escala completa do check-in de humor, do pior para o melhor. O número
   serve para desenhar a evolução num gráfico — os estados não são uma
   medida, mas ordenados assim a tendência lê-se de relance. */
const ESCALA_HUMOR = {
  "preciso-de-ajuda":   { n: 1, emoji: "🥲", rotulo: "Preciso de ajuda" },
  "muito-em-baixo":     { n: 2, emoji: "😔", rotulo: "Muito em baixo" },
  "podia-estar-melhor": { n: 3, emoji: "🙃", rotulo: "Podia estar melhor" },
  "razoavel":           { n: 4, emoji: "🙂", rotulo: "Razoável" },
  "bem":                { n: 5, emoji: "😉", rotulo: "Bem" },
  "muito-bem":          { n: 6, emoji: "🤩", rotulo: "Muito bem" }
};

/* Estados do check-in rápido de humor que geram alerta. A ordem importa: o
   pedido de ajuda aparece primeiro na lista, por ser o sinal mais direto. */
const HUMOR_ALERTA = {
  "preciso-de-ajuda": { urgencia: 0, rotulo: "🥲 Pediu ajuda",
                        texto: "No último check-in, respondeu “Preciso de ajuda”." },
  "muito-em-baixo":   { urgencia: 1, rotulo: "😔 Muito em baixo",
                        texto: "No último check-in, respondeu “Muito em baixo”." }
};

/** Recolhe tudo o que conta como alerta. Devolve
 *  { humor: [...], duvidas: [...], proms: [...], total: n } — as listas trazem
 *  já o que a página precisa para desenhar cada cartão. */
async function recolherAlertas() {
  // o check-in de humor e o registo de alertas tratados são opcionais: se a
  // tabela ou a política de leitura ainda não existirem, os restantes
  // alertas continuam a funcionar
  const checkinsPromise = lumiApi.listarCheckinsHumorTodos().catch(e => {
    console.error("Não foi possível ler os check-ins de humor:", e);
    return [];
  });
  const tratadosPromise = lumiApi.listarAlertasTratados().catch(e => {
    console.error("Não foi possível ler os alertas tratados:", e);
    return [];
  });

  const [duvidas, doentes, respostas, checkins, tratados] = await Promise.all([
    lumiApi.listarDuvidas(),
    lumiApi.listarDoentes(),
    lumiApi.listarPromsTodos(Object.keys(LIMIARES_ALERTA)),
    checkinsPromise,
    tratadosPromise
  ]);

  const duvidasPendentes = duvidas.filter(d => d.estado === "pendente");

  // a lista vem ordenada por data, por isso a última que se vê de cada
  // par doente+instrumento é a mais recente
  const ultimas = {};
  respostas.forEach(r => { ultimas[r.doente_id + "|" + r.instrumento] = r; });

  const porId = {};
  doentes.forEach(d => { porId[d.id] = d; });

  const promsEmAlerta = [];
  Object.keys(ultimas).forEach(chave => {
    const r = ultimas[chave];
    const doente = porId[r.doente_id];
    if (!doente) return;                       // doente removido entretanto
    const valor = (r.scores && r.scores.total != null) ? r.scores.total : null;
    if (valor == null) return;
    const limite = LIMIARES_ALERTA[r.instrumento];
    if (!limite) return;
    const maximo = (r.scores && r.scores.maximo != null) ? r.scores.maximo : null;
    const corte = limiarDisparo(limite, maximo);
    let disparou = false;
    if (corte != null) disparou = valor >= corte;
    if (limite.max != null) disparou = disparou || valor <= limite.max;
    if (disparou) promsEmAlerta.push({ doente, instrumento: r.instrumento, valor, maximo, resposta: r });
  });

  // último check-in de humor de cada doente — só o mais recente conta, tal
  // como nos PROMs, para um mau dia já ultrapassado não ficar a alertar
  const ultimoCheckin = {};
  checkins.forEach(c => { ultimoCheckin[c.doente_id] = c; });

  // alertas que a equipa já deu como tratados, pelo id do registo de origem
  const jaTratados = {};
  tratados.forEach(t => { jaTratados[t.tipo + "|" + t.referencia] = t; });

  const humorEmAlerta = [];
  Object.keys(ultimoCheckin).forEach(doenteId => {
    const c = ultimoCheckin[doenteId];
    const nivel = HUMOR_ALERTA[c.valor];
    const doente = porId[doenteId];
    if (!nivel || !doente) return;
    if (jaTratados["humor|" + c.id]) return;   // já tratado por alguém
    humorEmAlerta.push({ doente, valor: c.valor, checkin: c, ...nivel });
  });
  humorEmAlerta.sort((a, b) => a.urgencia - b.urgencia);

  return {
    humor: humorEmAlerta,
    duvidas: duvidasPendentes,
    proms: promsEmAlerta,
    total: humorEmAlerta.length + duvidasPendentes.length + promsEmAlerta.length
  };
}

/** Preenche o contador na barra lateral. Silencioso em caso de erro: um
 *  contador que não carrega nunca deve impedir a página de funcionar. */
async function atualizarBadgeAlertas() {
  const el = document.getElementById("badge-alertas");
  if (!el) return;
  try {
    const { total } = await recolherAlertas();
    el.textContent = total > 0 ? total : "";
    el.title = total === 1 ? "1 alerta por tratar"
             : total > 1   ? `${total} alertas por tratar` : "";
  } catch (e) {
    console.error("Não foi possível calcular os alertas:", e);
    el.textContent = "";
  }
}

/* ========================================================================
   PRIORIDADE DE SEGUIMENTO — matriz de risco a partir do Formulário de Alta

   O QUE ISTO É, E O QUE NÃO É
   Não é um instrumento validado. É uma proposta de estratificação, para a
   equipa calibrar. Em adultos existe um instrumento publicado para este fim
   — o BURN-OP, que estratifica necessidades de reabilitação pós-alta em três
   grupos — e nessa versão da plataforma o caminho sério é confrontar a
   matriz com ele.

   Em pediatria esse confronto não está disponível: não há instrumento
   equivalente validado em crianças (ver a nota em ITENS_REVISAO_PED, mais
   abaixo). A matriz fica, portanto, sozinha — o que a torna mais útil e mais
   provisória ao mesmo tempo. Os pesos abaixo herdam os do lado dos adultos
   onde o mecanismo é o mesmo, e divergem onde não é: a idade, o períneo, o
   cuidador e a escola.

   PORQUE SÃO DOIS EIXOS E NÃO UM SÓ
   A tentação é somar tudo numa pontuação de gravidade. A literatura não
   sustenta isso: a extensão e a profundidade predizem o resultado
   funcional, mas não predizem bem o ajustamento psicológico a um e dois
   anos — aí pesam mais o estado emocional prévio, a dor e o prurido. Um
   doente com 8% de superfície queimada nas mãos, com dor intensa e sem
   confiança para cuidar da cicatriz, precisa de mais contacto do que um com
   25% no tronco a evoluir bem. Uma pontuação única esconderia esse doente;
   dois eixos mostram-no.

   Nada é calculado e guardado: deriva-se do último formulário sempre que se
   abre a ficha. Assim, corrigir o formulário corrige a prioridade, e não há
   pontuações antigas a apodrecer na base de dados.
   ======================================================================== */

/* Pesos provisórios, à espera de calibração clínica. Estão todos aqui, num
   sítio só, para poderem ser discutidos e alterados sem mexer na lógica. */
const PESOS_PRIORIDADE = {
  scq:            [{ min: 30, pontos: 6 }, { min: 20, pontos: 4 }, { min: 10, pontos: 2 }],
  espessuraTotal: 2,
  maos:           3,   // desproporcionadas no impacto funcional face à área que ocupam
  cabecaPescoco:  2,
  amputacao:      4,
  enxertos:       1,
  escaroFascio:   1,
  amplitude:      { "1": 1, "2": 2, "3": 3 },
  psfsBaixa:      2,   // média PSFS <= 4
  sequelas:       2,
  bridas:         2,
  produtosApoio:  1,
  dorAlta:        3,   // >= 7
  dorModerada:    1,   // 4 a 6
  pruridoAlto:    2,
  sonoAfetado:    2,
  confiancaBaixa: 3,   // <= 3
  confiancaMedia: 1,   // 4 a 6
  receios:        [{ min: 4, pontos: 3 }, { min: 2, pontos: 2 }, { min: 1, pontos: 1 }],
  incomodoPsico:  1,   // por cada de: cicatriz, sono
  posasDoente:    2,   // >= 40/60

  /* Acrescentados, no lado dos adultos, depois do mapeamento contra o
     BURN-OP: são os discriminadores publicados do grupo de maior
     necessidade. Mantêm-se aqui porque o mecanismo não depende da idade. */
  inalatoria:      3,
  internamento:    [{ min: 30, pontos: 3 }, { min: 14, pontos: 2 }, { min: 7, pontos: 1 }],
  cirurgias:       [{ min: 5, pontos: 3 }, { min: 3, pontos: 2 }, { min: 1, pontos: 1 }],
  ventilacao:      [{ min: 7, pontos: 3 }, { min: 1, pontos: 2 }],
  perdaPeso:       2,   // >= 10% do peso à admissão

  /* ------------------------------------------------------------------
     PEDIATRIA — onde esta matriz deixa de ser a dos adultos
     ------------------------------------------------------------------
     A idade inverte-se. Na versão de adultos somavam-se pontos acima dos
     50 e dos 65 anos; aqui o risco está no extremo oposto. Abaixo dos dois
     anos a pele é mais fina, o mesmo líquido queima mais fundo, a criança
     não consegue descrever o que sente, e a cicatriz vai acompanhar anos de
     crescimento — uma contratura que num adulto estabiliza, numa criança de
     18 meses volta a repuxar a cada estirão.

     A adolescência entra pelo outro eixo: a partir dos 13 anos o peso não é
     biológico, é de imagem corporal e de pares. É a idade em que o PSQ e o
     SCQ — os dois instrumentos com validação pediátrica em queimados —
     mostram as pontuações mais altas de estigma percebido.
     ------------------------------------------------------------------ */
  idadeLactente:   3,   // < 2 anos
  idadePreEscolar: 2,   // 2 a 4 anos
  adolescencia:    1,   // >= 13 anos, no eixo psicossocial
  perineo:         2,   // períneo e nádegas: higiene difícil e risco de contratura

  /* Psicossociais pediátricos. Substituem "vive sozinho" e "regresso ao
     trabalho", que não querem dizer nada numa criança. */
  saudeMentalPrevia:   3, // acompanhamento prévio da criança em saúde mental ou desenvolvimento
  cuidadorAflito:      3, // sofrimento de quem cuida: preditor conhecido do ajustamento da criança
  cuidadorUnico:       2, // um só adulto responsável pelos tratamentos em casa
  semCuidador:         3, // sem cuidador capaz de assegurar os cuidados
  sinalizacaoRisco:    4, // sinalizada a comissão de proteção ou a núcleo de apoio a crianças em risco
  escolaIncerta:       1,
  escolaSemRegresso:   2
};

const LIMIARES_EIXO = { medio: 4, alto: 8 };

/* Cadências ancoradas nos cinco marcos que a plataforma já usa. A prioridade
   alta antecipa e adensa o primeiro mês, que é quando a dor, o prurido e o
   desânimo são maiores; a baixa dispensa o contacto das duas semanas.
   Nenhuma dispensa a avaliação aos 12 meses. */
const CADENCIAS_SEGUIMENTO = {
  alta: {
    rotulo: "Prioridade alta",
    cor: "alert",
    cadencia: [7, 14, 28, 42, 90, 180, 365],
    descricao: "Contactos mais precoces e mais próximos no primeiro mês."
  },
  intermedia: {
    rotulo: "Prioridade intermédia",
    cor: "star",
    cadencia: [14, 42, 90, 180, 365],
    descricao: "Calendário padrão de seguimento."
  },
  baixa: {
    rotulo: "Prioridade baixa",
    cor: "ok",
    cadencia: [42, 90, 180, 365],
    descricao: "Contactos mais espaçados, dispensando o das duas semanas."
  }
};

/* Em pediatria nenhuma destas cadências encerra o seguimento ao fim de um ano.
   Uma cicatriz que atravessa uma articulação acompanha o crescimento, e o
   momento em que volta a limitar costuma ser um estirão — não uma consulta
   marcada. Daí a revisão anual até à maturidade esquelética: é a opção por
   omissão no relatório de alta do acompanhamento, e a alta definitiva antes
   disso tem lá um campo próprio para ser justificada
   (area-profissional/alta-seguimento.html). */

/** Lê um campo do formulário, que pode estar gravado como texto, lista, ou
 *  { selecionados, outras } / { resposta, detalhe }. */
function valorFormulario(seccao, rotulo) {
  const v = seccao ? seccao[rotulo] : undefined;
  if (v == null) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === "object") {
    if (Array.isArray(v.selecionados)) return v.selecionados;
    if ("resposta" in v) return v.resposta;
    return null;
  }
  return v;
}

function primeiroNumero(valor) {
  if (valor == null) return null;
  const m = String(valor).replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function ehSim(valor) {
  return String(valor == null ? "" : valor).trim().toLowerCase() === "sim";
}

function pontosPorEscalao(valor, escaloes) {
  if (valor == null) return 0;
  for (const e of escaloes) if (valor >= e.min) return e.pontos;
  return 0;
}

/**
 * Calcula a prioridade de seguimento a partir da coluna "dados" de um
 * formulários_alta. Devolve os dois eixos, a classe, a cadência proposta e —
 * o mais importante — os fatores que contribuíram, para a equipa poder
 * discordar com conhecimento de causa em vez de aceitar um número.
 */
function calcularPrioridadeSeguimento(dados, idadeAnos) {
  if (!dados) return null;
  const q  = dados.queimadura     || {};
  const c  = dados.cicatriz       || {};
  const d  = dados.dor            || {};
  const pr = dados.prurido        || {};
  const am = dados.amplitude      || {};
  const fu = dados.funcionalidade || {};
  const mp = dados.mapa           || {};

  const clinicos = [];
  const psico = [];
  const juntar = (lista, pontos, texto) => { if (pontos > 0) lista.push({ pontos, texto }); };

  /* ---------- eixo clínico e funcional ---------- */
  const scq = primeiroNumero(valorFormulario(q, "% Superfície corporal queimada (%SCQ)"));
  juntar(clinicos, pontosPorEscalao(scq, PESOS_PRIORIDADE.scq), "Extensão de " + scq + "% da superfície corporal");

  const profundidade = String(valorFormulario(q, "Profundidade") || "");
  if (/3|total/i.test(profundidade)) juntar(clinicos, PESOS_PRIORIDADE.espessuraTotal, "Profundidade: " + profundidade);

  const temMao = [
    "Localização anatómica — Membro Superior Esquerdo",
    "Localização anatómica — Membro Superior Direito"
  ].some(g => {
    const itens = valorFormulario(q, g);
    return Array.isArray(itens) && itens.some(i => /m[ãa]o|dedo/i.test(i));
  });
  if (temMao) juntar(clinicos, PESOS_PRIORIDADE.maos, "Envolvimento das mãos");

  const cabeca = valorFormulario(q, "Localização anatómica — Cabeça e Pescoço");
  if (Array.isArray(cabeca) && cabeca.length) juntar(clinicos, PESOS_PRIORIDADE.cabecaPescoco, "Envolvimento da cabeça ou pescoço");

  if (ehSim(valorFormulario(q, "Amputação"))) juntar(clinicos, PESOS_PRIORIDADE.amputacao, "Amputação");
  if (ehSim(valorFormulario(q, "Enxertos")))  juntar(clinicos, PESOS_PRIORIDADE.enxertos, "Enxertos");
  if (ehSim(valorFormulario(q, "Necessidade de escarotomia")) || ehSim(valorFormulario(q, "Necessidade de fasciotomia")))
    juntar(clinicos, PESOS_PRIORIDADE.escaroFascio, "Escarotomia ou fasciotomia");

  const romTexto = valorFormulario(am, "Classificação global");
  const rom = String(romTexto || "").trim().charAt(0);
  if (PESOS_PRIORIDADE.amplitude[rom])
    juntar(clinicos, PESOS_PRIORIDADE.amplitude[rom], "Limitação de amplitude articular: " + romTexto);

  const psfs = primeiroNumero(valorFormulario(fu, "Média PSFS (/10)"));
  if (psfs != null && psfs <= 4) juntar(clinicos, PESOS_PRIORIDADE.psfsBaixa, "Função autorreportada baixa (PSFS " + psfs + "/10)");

  if (ehSim(valorFormulario(c, "Sequelas previsíveis"))) juntar(clinicos, PESOS_PRIORIDADE.sequelas, "Sequelas previsíveis");
  if (ehSim(valorFormulario(c, "Bridas")))               juntar(clinicos, PESOS_PRIORIDADE.bridas, "Bridas");
  if (ehSim(valorFormulario(c, "Necessidade de Produtos de Apoio")))
    juntar(clinicos, PESOS_PRIORIDADE.produtosApoio, "Necessidade de produtos de apoio");

  /* Discriminadores do grupo de maior necessidade. Vêm do mapeamento feito
     no lado dos adultos contra o BURN-OP; em pediatria não há validação que
     os confirme, mas o mecanismo — via aérea, tempo de internamento, número
     de cirurgias — não depende da idade. */
  if (ehSim(valorFormulario(q, "Lesão inalatória"))) juntar(clinicos, PESOS_PRIORIDADE.inalatoria, "Lesão inalatória");

  const dias = primeiroNumero(valorFormulario(q, "Dias de internamento"));
  juntar(clinicos, pontosPorEscalao(dias, PESOS_PRIORIDADE.internamento), "Internamento de " + dias + " dias");

  const cirurgias = primeiroNumero(valorFormulario(q, "Número de intervenções cirúrgicas"));
  juntar(clinicos, pontosPorEscalao(cirurgias, PESOS_PRIORIDADE.cirurgias), cirurgias + " intervenções cirúrgicas");

  const ventil = primeiroNumero(valorFormulario(q, "Dias de ventilação mecânica"));
  juntar(clinicos, pontosPorEscalao(ventil, PESOS_PRIORIDADE.ventilacao), ventil + " dias de ventilação mecânica");

  const perdaPeso = primeiroNumero(valorFormulario(q, "Perda de peso durante o internamento (%)"));
  if (perdaPeso != null && perdaPeso >= 10) juntar(clinicos, PESOS_PRIORIDADE.perdaPeso, "Perda de peso de " + perdaPeso + "% no internamento");

  // a idade vem do registo da criança, não do formulário
  if (idadeAnos != null && idadeAnos < 2)
    juntar(clinicos, PESOS_PRIORIDADE.idadeLactente, "Criança com menos de 2 anos à data da alta");
  else if (idadeAnos != null && idadeAnos < 5)
    juntar(clinicos, PESOS_PRIORIDADE.idadePreEscolar, "Idade pré-escolar (" + idadeAnos + " anos)");

  /* O períneo e as nádegas estão no grupo do tronco, não têm grupo próprio.
     Pesam porque numa criança com fralda a higiene da ferida é diária e
     difícil, e porque a retração nesta zona condiciona o sentar. */
  const tronco = valorFormulario(q, "Localização anatómica — Tronco");
  if (Array.isArray(tronco) && tronco.some(function (i) { return /n[áa]degas|per[íi]neo|genitais/i.test(i); }))
    juntar(clinicos, PESOS_PRIORIDADE.perineo, "Envolvimento do períneo, genitais ou nádegas");

  /* ---------- eixo sintomático e psicossocial ---------- */
  const dores = ["Dor em repouso", "Dor durante o movimento", "Dor durante a mobilização cicatricial"]
    .map(r => primeiroNumero(valorFormulario(d, r))).filter(v => v != null);
  const dorMax = dores.length ? Math.max.apply(null, dores) : null;
  if (dorMax != null && dorMax >= 7)      juntar(psico, PESOS_PRIORIDADE.dorAlta, "Dor elevada à data da alta (" + dorMax + "/10)");
  else if (dorMax != null && dorMax >= 4) juntar(psico, PESOS_PRIORIDADE.dorModerada, "Dor moderada à data da alta (" + dorMax + "/10)");

  const pruridoInt = primeiroNumero(valorFormulario(pr, "Intensidade do prurido"));
  if (pruridoInt != null && pruridoInt >= 7) juntar(psico, PESOS_PRIORIDADE.pruridoAlto, "Prurido intenso (" + pruridoInt + "/10)");
  const sono = primeiroNumero(valorFormulario(pr, "Impacto no sono"));
  if (sono != null && sono >= 7) juntar(psico, PESOS_PRIORIDADE.sonoAfetado, "Sono afetado pelo prurido (" + sono + "/10)");

  const confianca = primeiroNumero(valorFormulario(mp, "Confiança para cuidar da cicatriz"));
  if (confianca != null && confianca <= 3)      juntar(psico, PESOS_PRIORIDADE.confiancaBaixa, "Pouca confiança para cuidar da cicatriz (" + confianca + "/10)");
  else if (confianca != null && confianca <= 6) juntar(psico, PESOS_PRIORIDADE.confiancaMedia, "Confiança intermédia para cuidar da cicatriz (" + confianca + "/10)");

  const receios = valorFormulario(mp, "O que o doente mais receia não conseguir fazer sozinho");
  const nReceios = Array.isArray(receios) ? receios.length : 0;
  juntar(psico, pontosPorEscalao(nReceios, PESOS_PRIORIDADE.receios),
         "Receia não conseguir fazer sozinho: " + (Array.isArray(receios) ? receios.join(", ") : ""));

  const incomoda = valorFormulario(mp, "O que mais o incomoda");
  if (Array.isArray(incomoda)) {
    incomoda.filter(i => /cicatriz|sono/i.test(i))
      .forEach(i => juntar(psico, PESOS_PRIORIDADE.incomodoPsico, "Incomoda-o: " + i));
  }

  const posas = primeiroNumero(valorFormulario(c, "Total dos 6 itens (/60)"));
  if (posas != null && posas >= 40) juntar(psico, PESOS_PRIORIDADE.posasDoente, "Cicatriz mal avaliada pelo próprio (POSAS " + posas + "/60)");

  /* Domínios psicossociais pediátricos. É aqui que a matriz mais se afasta
     da dos adultos: não há "vive sozinho" nem "regresso ao trabalho" numa
     criança — há quem cuida dela, e a escola. */
  if (idadeAnos != null && idadeAnos >= 13)
    juntar(psico, PESOS_PRIORIDADE.adolescencia, "Adolescência (" + idadeAnos + " anos): maior exposição ao estigma percebido");

  /* O sofrimento de quem cuida não é um dado sobre o adulto — é o preditor
     mais consistente do ajustamento psicológico da criança queimada. Pergunta-
     -se aqui, no formulário de alta, porque é a última vez que a equipa tem o
     cuidador à frente antes de ele ficar sozinho em casa com os pensos. */
  const aflicao = primeiroNumero(valorFormulario(mp, "Angústia do cuidador (0-10)"));
  if (aflicao != null && aflicao >= 7)
    juntar(psico, PESOS_PRIORIDADE.cuidadorAflito, "Cuidador em sofrimento marcado (" + aflicao + "/10)");

  if (ehSim(valorFormulario(mp, "Acompanhamento prévio da criança em saúde mental ou desenvolvimento")))
    juntar(psico, PESOS_PRIORIDADE.saudeMentalPrevia, "Acompanhamento prévio em saúde mental ou desenvolvimento");

  const quemCuida = String(valorFormulario(mp, "Adultos responsáveis pelos cuidados em casa") || "").trim();
  if (/^nenhum/i.test(quemCuida))                    juntar(psico, PESOS_PRIORIDADE.semCuidador, "Sem cuidador capaz de assegurar os cuidados em casa");
  else if (/^(um|apenas um|s[oó] um)\b/i.test(quemCuida)) juntar(psico, PESOS_PRIORIDADE.cuidadorUnico, "Um só adulto responsável pelos cuidados");

  if (ehSim(valorFormulario(mp, "Sinalização a CPCJ ou a núcleo de apoio a crianças e jovens em risco")))
    juntar(psico, PESOS_PRIORIDADE.sinalizacaoRisco, "Situação sinalizada a CPCJ ou a núcleo de apoio a crianças em risco");

  const escola = String(valorFormulario(mp, "Regresso previsto à escola, creche ou ama") || "");
  if (/sem perspetiva|n[ãa]o regressa/i.test(escola)) juntar(psico, PESOS_PRIORIDADE.escolaSemRegresso, "Sem perspetiva de regresso à escola");
  else if (/incerto/i.test(escola))                   juntar(psico, PESOS_PRIORIDADE.escolaIncerta, "Regresso à escola incerto");

  /* ---------- classificação ---------- */
  const somar = lista => lista.reduce((t, f) => t + f.pontos, 0);
  const pontosClinico = somar(clinicos);
  const pontosPsico   = somar(psico);
  const nivel = p => p >= LIMIARES_EIXO.alto ? "alto" : (p >= LIMIARES_EIXO.medio ? "medio" : "baixo");
  const nc = nivel(pontosClinico), np = nivel(pontosPsico);

  // Basta um eixo alto para subir a prioridade. Dois eixos médios em
  // simultâneo também sobem: é o doente que não se destaca em nada e por isso
  // passa despercebido, mas que acumula carga dos dois lados.
  let classe;
  if (nc === "alto" || np === "alto")        classe = "alta";
  else if (nc === "medio" && np === "medio") classe = "alta";
  else if (nc === "medio" || np === "medio") classe = "intermedia";
  else                                       classe = "baixa";

  const cadencia = CADENCIAS_SEGUIMENTO[classe];
  return {
    clinico:      { pontos: pontosClinico, nivel: nc, fatores: clinicos },
    psicossocial: { pontos: pontosPsico,   nivel: np, fatores: psico },
    classe:    classe,
    rotulo:    cadencia.rotulo,
    cor:       cadencia.cor,
    cadencia:  cadencia.cadencia,
    descricao: cadencia.descricao
  };
}

/** Traduz a cadência em dias para texto legível. Abaixo dos três meses conta
 *  em semanas, que é como a equipa e o doente falam desta fase — e evita o
 *  absurdo de 30 e 42 dias aparecerem ambos como "1 mês". */
function descreverCadencia(dias) {
  return dias.map(function (d) {
    if (d < 90) return (d / 7) + " sem";
    const meses = Math.round(d / 30);
    return meses + (meses === 1 ? " mês" : " meses");
  }).join(" · ");
}

/** Idade em anos completos a partir de uma data ISO. Devolve null se não
 *  houver data — a prioridade tem de continuar a ser calculável sem ela. */
function idadeEmAnos(dataISO) {
  if (!dataISO) return null;
  const d = new Date(dataISO);
  if (isNaN(d)) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) anos--;
  return anos;
}

/* ========================================================================
   REVISÃO DE SISTEMAS À DATA DA ALTA — versão pediátrica
   ------------------------------------------------------------------------
   PORQUE É QUE O BURN-OP NÃO ESTÁ AQUI

   A plataforma de adultos usa o BURN-OP (Bhattacharya et al., Burns 2024):
   23 perguntas ponderadas, limiar de 46 pontos, derivadas da "Adult Review
   of Systems Discharge" do Burn Model System. Não foi transposto para aqui,
   e não foi por distração.

   O instrumento pergunta por varizes, cancro da pele, consumo de álcool e
   de substâncias, e se o doente "alguma vez esteve grávida ou foi pai de
   uma criança" — este último com 4 pontos, o peso máximo. Numa criança de
   seis anos as perguntas ou não se aplicam ou valem sempre zero, e um
   instrumento cujo limiar foi calibrado numa coorte de adultos deixa de ter
   limiar quando metade dos itens não pode ser positivo. Aplicá-lo na mesma
   daria um número com aparência de validade e sem nenhuma.

   O QUE ESTÁ AQUI EM VEZ DISSO

   Uma revisão de sistemas pediátrica, organizada pelas sequelas que o
   seguimento a longo prazo de uma criança queimada procura: a cicatriz que
   repuxa à medida que o osso cresce, o sono, o comportamento e a regressão
   de aquisições, e o regresso à escola.

   NÃO TEM PONTUAÇÃO, E ISSO É DE PROPÓSITO. Não há limiar publicado para
   este conjunto. O que a equipa vê é quantos sinais ficaram positivos e
   quais — que é o que de facto orienta a consulta. A estratificação de
   prioridade continua a ser feita pela matriz de dois eixos, essa sim com
   pesos explícitos e discutíveis (ver PESOS_PRIORIDADE).
   ======================================================================== */
const ITENS_REVISAO_PED = [
  /* ---- pele e cicatriz ---- */
  { id: "repuxa",      grupo: "Pele e cicatriz",        texto: "A cicatriz repuxa ou limita algum movimento?" },
  { id: "prurido-noite", grupo: "Pele e cicatriz",      texto: "A comichão acorda a criança durante a noite?" },
  { id: "reabre",      grupo: "Pele e cicatriz",        texto: "A pele volta a abrir ou faz feridas?" },
  { id: "seca",        grupo: "Pele e cicatriz",        texto: "Pele muito seca ou a descamar na zona queimada?" },
  { id: "sudacao",     grupo: "Pele e cicatriz",        texto: "Sua de forma diferente na zona queimada?" },
  { id: "temperatura", grupo: "Pele e cicatriz",        texto: "Queixa-se de calor ou de frio na zona queimada?" },

  /* ---- sensibilidade ---- */
  { id: "dormencia",   grupo: "Sensibilidade",          texto: "Dormência, formigueiro ou picadas na cicatriz?" },
  { id: "toque",       grupo: "Sensibilidade",          texto: "Dor ou desconforto quando lhe tocam na cicatriz?" },

  /* ---- crescimento e movimento ---- */
  { id: "amplitude",   grupo: "Crescimento e movimento", texto: "Perdeu amplitude de movimento desde a alta?" },
  { id: "assimetria",  grupo: "Crescimento e movimento", texto: "Diferença de tamanho ou de forma entre os dois lados?" },
  { id: "dor-articular", grupo: "Crescimento e movimento", texto: "Dor nas articulações?" },
  { id: "marcha",      grupo: "Crescimento e movimento", texto: "Mudou a forma de andar, sentar ou agarrar?" },

  /* ---- via aérea, para as lesões por inalação ou da face ---- */
  { id: "voz",         grupo: "Via aérea e face",       texto: "Alteração da voz, rouquidão ou tosse persistente?" },
  { id: "palpebras",   grupo: "Via aérea e face",       texto: "Dificuldade em fechar completamente os olhos?" },
  { id: "boca",        grupo: "Via aérea e face",       texto: "Dificuldade em abrir completamente a boca?" },

  /* ---- alimentação e crescimento ---- */
  { id: "apetite",     grupo: "Alimentação",            texto: "Perda de apetite ou de peso desde a alta?" },

  /* ---- sono, comportamento e desenvolvimento ---- */
  { id: "adormecer",   grupo: "Sono e comportamento",   texto: "Dificuldade em adormecer?" },
  { id: "pesadelos",   grupo: "Sono e comportamento",   texto: "Pesadelos ou acordar a gritar?" },
  { id: "regressao",   grupo: "Sono e comportamento",   texto: "Voltou a comportamentos que já tinha deixado (chucha, fralda, dormir com os pais)?" },
  { id: "irritavel",   grupo: "Sono e comportamento",   texto: "Anda mais irritável, agressiva ou mais calada do que antes?" },
  { id: "evita",       grupo: "Sono e comportamento",   texto: "Evita falar do que aconteceu, ou evita o sítio onde aconteceu?" },

  /* ---- escola e tratamentos ---- */
  { id: "escola",      grupo: "Escola e tratamentos",   texto: "Recusa ou resiste a voltar à escola, à creche ou à ama?" },
  { id: "malha",       grupo: "Escola e tratamentos",   texto: "Dificuldade em usar a malha de pressão o tempo prescrito?" },
  { id: "creme",       grupo: "Escola e tratamentos",   texto: "Dificuldade em fazer a massagem e o creme em casa?" }
];

/* Os grupos pela ordem em que aparecem na lista, sem repetições. */
function gruposRevisaoPed() {
  const vistos = [];
  ITENS_REVISAO_PED.forEach(function (i) {
    if (vistos.indexOf(i.grupo) === -1) vistos.push(i.grupo);
  });
  return vistos;
}

/** Conta os sinais positivos. Devolve null se a secção não foi preenchida.
 *  Repare-se no que NÃO devolve: não devolve uma classificação. Uma criança
 *  com três sinais não é "pior" do que outra com dois — depende de quais. */
function calcularRevisaoPediatrica(seccao) {
  if (!seccao) return null;
  const positivos = [];
  let respondidas = 0;

  ITENS_REVISAO_PED.forEach(function (item) {
    const v = seccao[item.texto];
    if (v == null || v === "") return;
    respondidas++;
    if (String(v).trim().toLowerCase() === "sim") {
      positivos.push({ texto: item.texto, grupo: item.grupo });
    }
  });

  return {
    sinais:      positivos.length,
    positivos:   positivos,
    respondidas: respondidas,
    total:       ITENS_REVISAO_PED.length,
    completo:    respondidas === ITENS_REVISAO_PED.length
  };
}

/* ========================================================================
   RESPOSTAS POR LER — contador junto a "Dúvidas", na área do doente.

   Quando a equipa responde, o doente recebe email. Mas se não o abrir, ou
   o apagar, entrava na plataforma sem sinal nenhum de que havia resposta.
   Agora o número aparece na navegação, como já acontecia do lado
   profissional.

   Requer 014_duvidas_por_ler.sql. Se essa migração ainda não tiver sido
   corrida, o contador simplesmente não aparece — nada rebenta.
   ======================================================================== */
async function atualizarBadgeDuvidas(doenteId) {
  const el = document.getElementById("badge-duvidas");
  if (!el || !doenteId) return;
  try {
    const n = await lumiApi.contarRespostasPorLer(doenteId);
    el.textContent = n > 0 ? n : "";
    el.title = n === 1 ? "1 resposta por ler"
             : n > 1   ? `${n} respostas por ler` : "";
  } catch (e) {
    console.error("Não foi possível contar as respostas por ler:", e);
    el.textContent = "";
  }
}

/* ========================================================================
   QUADROS RECOLHÍVEIS COM ÍNDICE DE PROGRESSO

   O mesmo comportamento do Formulário de Alta: os quadros abrem um de cada
   vez, um índice fixo mostra o estado de cada um, e cada cabeçalho traz uma
   barra com os campos respondidos.

   Nota para quem mantiver isto: o Formulário de Alta tem uma cópia própria
   desta lógica, escrita antes desta. Fazia sentido passá-lo a usar esta —
   ficaria uma implementação só — mas o formulário está congelado por pedido
   expresso, e mexer-lhe para uma arrumação interna não justificaria o risco.
   Quando houver oportunidade, é uma substituição direta.
   ======================================================================== */
const SECOES_REGISTADAS = [];

/**
 * Transforma as .form-section da página em quadros recolhíveis e preenche o
 * índice. Trabalha sobre o HTML existente: cada secção continua a ser uma
 * <section> simples, e acrescentar uma nova não exige tocar aqui.
 *   idIndice — elemento onde os botões do índice são criados
 */
function prepararQuadros(idIndice) {
  const indice = document.getElementById(idIndice);
  SECOES_REGISTADAS.length = 0;

  document.querySelectorAll(".form-section").forEach(function (sec) {
    const cabecalho = sec.querySelector(".section-head");
    if (!cabecalho) return;

    const corpo = document.createElement("div");
    corpo.className = "secao-corpo";
    corpo.id = "corpo-" + sec.id;
    let n = cabecalho.nextSibling;
    while (n) { const seg = n.nextSibling; corpo.appendChild(n); n = seg; }
    sec.appendChild(corpo);

    const num = cabecalho.querySelector(".section-num").textContent.trim();
    const titulo = cabecalho.querySelector("h2").textContent.trim();

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "secao-toggle";
    botao.setAttribute("aria-expanded", "false");
    botao.setAttribute("aria-controls", corpo.id);
    while (cabecalho.firstChild) botao.appendChild(cabecalho.firstChild);

    const progresso = document.createElement("span");
    progresso.className = "secao-progresso";
    progresso.id = "progresso-" + sec.id;
    botao.appendChild(progresso);

    const seta = document.createElement("span");
    seta.className = "seta";
    seta.textContent = "▶";
    seta.setAttribute("aria-hidden", "true");
    botao.appendChild(seta);

    cabecalho.appendChild(botao);
    corpo.hidden = true;
    botao.addEventListener("click", function () { alternarQuadro(sec.id); });

    if (indice) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "indice-item";
      item.id = "indice-" + sec.id;
      item.innerHTML = '<span class="n">' + num + '</span><span class="titulo">' + titulo + "</span>";
      item.title = num + ". " + titulo;
      item.setAttribute("aria-label", "Quadro " + num + ": " + titulo);
      item.addEventListener("click", function () { abrirQuadro(sec.id, true); });
      indice.appendChild(item);
    }

    SECOES_REGISTADAS.push({ id: sec.id, num: num, titulo: titulo });

    sec.addEventListener("change", function () { atualizarProgressoQuadro(sec.id); });
    sec.addEventListener("input",  function () { atualizarProgressoQuadro(sec.id); });
  });

  if (SECOES_REGISTADAS.length) abrirQuadro(SECOES_REGISTADAS[0].id, false);
  SECOES_REGISTADAS.forEach(function (s) { atualizarProgressoQuadro(s.id); });
}

function alternarQuadro(id) {
  const corpo = document.getElementById("corpo-" + id);
  if (corpo.hidden) abrirQuadro(id, false); else fecharQuadro(id);
}

function fecharQuadro(id) {
  document.getElementById("corpo-" + id).hidden = true;
  const t = document.querySelector("#" + id + " .secao-toggle");
  if (t) t.setAttribute("aria-expanded", "false");
  const it = document.getElementById("indice-" + id);
  if (it) it.classList.remove("aberto");
}

/** Abre um quadro e fecha os outros: com todos abertos voltava-se à página
 *  interminável que isto existe para evitar. */
function abrirQuadro(id, deslocar) {
  SECOES_REGISTADAS.forEach(function (s) { if (s.id !== id) fecharQuadro(s.id); });
  document.getElementById("corpo-" + id).hidden = false;
  const t = document.querySelector("#" + id + " .secao-toggle");
  if (t) t.setAttribute("aria-expanded", "true");
  const it = document.getElementById("indice-" + id);
  if (it) it.classList.add("aberto");
  const rotulo = document.getElementById("indice-atual");
  if (rotulo) {
    const s = SECOES_REGISTADAS.find(function (x) { return x.id === id; });
    rotulo.textContent = s ? s.num + ". " + s.titulo : "";
  }
  if (deslocar) document.getElementById(id).scrollIntoView({ behavior: "smooth", block: "start" });
}

function abrirTodosOsQuadros() {
  SECOES_REGISTADAS.forEach(function (s) {
    document.getElementById("corpo-" + s.id).hidden = false;
    const t = document.querySelector("#" + s.id + " .secao-toggle");
    if (t) t.setAttribute("aria-expanded", "true");
  });
}

function fecharTodosOsQuadros() {
  SECOES_REGISTADAS.forEach(function (s) { fecharQuadro(s.id); });
}

/** Conta campos respondidos. Indicador de progresso, não validação: nem
 *  todos os campos se aplicam a todos os doentes. */
function atualizarProgressoQuadro(id) {
  const sec = document.getElementById(id);
  const alvo = document.getElementById("progresso-" + id);
  const item = document.getElementById("indice-" + id);
  if (!sec || !alvo) return;

  let total = 0, respondidos = 0;
  sec.querySelectorAll(".subfield").forEach(function (campo) {
    if (!campo.querySelector("label")) return;
    total++;
    const v = valorDoCampoGenerico(campo);
    const tem = Array.isArray(v) ? v.length > 0
      : (v && typeof v === "object") ? !!(v.resposta || v.outras || (v.selecionados || []).length)
      : (v != null && String(v).trim() !== "");
    if (tem) respondidos++;
  });

  if (!total) { alvo.innerHTML = ""; return; }
  const pct = Math.round((respondidos / total) * 100);
  const completo = respondidos === total;
  alvo.className = "secao-progresso" + (completo ? " completo" : "");
  alvo.innerHTML = '<span class="barra"><span style="width:' + pct + '%"></span></span>'
                 + (completo ? "✓ " : "") + respondidos + "/" + total;
  if (item) {
    item.classList.toggle("completo", completo);
    item.classList.toggle("tem-respostas", !completo && respondidos > 0);
  }
}

/** Lê o valor de um .subfield: chips, escalas, texto ou o caso misto de
 *  rádio Sim/Não com campo de texto associado. */
function valorDoCampoGenerico(campo) {
  const checkboxes = campo.querySelectorAll('.chip-group input[type="checkbox"]');
  if (checkboxes.length) {
    const selecionados = Array.from(checkboxes).filter(function (c) { return c.checked; })
      .map(function (c) { return c.nextElementSibling.textContent.trim(); });
    const caixa = campo.querySelector('input[type="text"], textarea');
    const outras = caixa ? caixa.value.trim() : "";
    return outras ? { selecionados: selecionados, outras: outras } : selecionados;
  }
  const radios = campo.querySelectorAll('.chip-group input[type="radio"], .scale input[type="radio"]');
  const inputs = campo.querySelectorAll('input[type="text"], input[type="number"], input[type="date"], input[type="datetime-local"], textarea');

  if (radios.length && inputs.length) {
    const marcado = Array.from(radios).find(function (r) { return r.checked; });
    const detalhe = inputs.length === 1 ? inputs[0].value : Array.from(inputs).map(function (i) { return i.value; });
    return { resposta: marcado ? marcado.nextElementSibling.textContent.trim() : null, detalhe: detalhe };
  }
  if (radios.length) {
    const marcado = Array.from(radios).find(function (r) { return r.checked; });
    return marcado ? marcado.nextElementSibling.textContent.trim() : null;
  }
  const select = campo.querySelector("select");
  if (select) return select.value;
  if (inputs.length === 1) return inputs[0].value;
  if (inputs.length > 1) return Array.from(inputs).map(function (i) { return i.value; });
  return null;
}

/** Serializa uma secção inteira: { "texto do label": valor }. */
function serializarQuadro(sec) {
  const r = {};
  sec.querySelectorAll(".subfield").forEach(function (campo) {
    const label = campo.querySelector("label");
    if (!label) return;
    r[label.textContent.trim()] = valorDoCampoGenerico(campo);
  });
  return r;
}

/* ========================================================================
   BOTÃO DE MENU EM ECRÃS PEQUENOS

   A barra lateral é a navegação de todo o site, dos dois lados. Em ecrãs
   estreitos não cabe, e escondê-la deixava a página sem forma de sair dali.
   Este botão aparece só abaixo dos 900px (é o CSS que o mostra) e abre a
   barra por cima do conteúdo.

   Fica em main.js, e não em cada página, para não haver oito cópias do
   mesmo botão a divergir com o tempo.
   ======================================================================== */
function prepararMenuLateral() {
  const barra = document.querySelector(".sidebar");
  const nav = document.querySelector(".topbar nav");
  if (!barra || !nav || document.getElementById("btn-menu")) return;

  if (!barra.id) barra.id = "menu-lateral";

  const botao = document.createElement("button");
  botao.id = "btn-menu";
  botao.type = "button";
  botao.className = "btn btn-ghost-light btn-sm btn-menu";
  botao.setAttribute("aria-controls", barra.id);
  botao.setAttribute("aria-expanded", "false");
  botao.textContent = "☰ Menu";
  botao.addEventListener("click", function () {
    document.body.classList.contains("menu-aberto") ? fecharMenuLateral() : abrirMenuLateral();
  });
  nav.insertBefore(botao, nav.firstChild);

  // Escolher um destino fecha o menu. Sem isto, um link para a própria
  // página (ou uma âncora) deixava a barra aberta por cima do conteúdo.
  barra.addEventListener("click", function (ev) {
    if (ev.target.closest("a")) fecharMenuLateral();
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") fecharMenuLateral();
  });
}

function abrirMenuLateral() {
  document.body.classList.add("menu-aberto");

  // A barra de topo não tem sempre 78px: no telemóvel o nome e os botões
  // passam para uma segunda linha e ela cresce. Medir evita que o menu abra
  // por baixo dela, tapado.
  const topo = document.querySelector(".topbar");
  const barra = document.querySelector(".sidebar");
  if (topo && barra) {
    const altura = Math.round(topo.getBoundingClientRect().bottom);
    barra.style.top = altura + "px";
    barra.style.maxHeight = "calc(100vh - " + altura + "px)";
  }

  const b = document.getElementById("btn-menu");
  if (b) { b.setAttribute("aria-expanded", "true"); b.textContent = "✕ Fechar"; }
}

function fecharMenuLateral() {
  document.body.classList.remove("menu-aberto");
  const barra = document.querySelector(".sidebar");
  if (barra) { barra.style.top = ""; barra.style.maxHeight = ""; }
  const b = document.getElementById("btn-menu");
  if (b) { b.setAttribute("aria-expanded", "false"); b.textContent = "☰ Menu"; }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", prepararMenuLateral);
} else {
  prepararMenuLateral();
}

/* ========================================================================
   PEDIDO DE AVALIAÇÃO DA SATISFAÇÃO

   Quem pede é a equipa, no fim da consulta. Do lado do doente aparece
   aqui, no primeiro acesso a seguir ao pedido, e também num email.

   Três saídas, de propósito:
     Responder agora   — abre o questionário
     Agora não         — some nesta visita e volta na próxima
     Não quero         — fecha o pedido, e não volta a aparecer

   A terceira é a que faz isto ser um convite e não uma cobrança. Fica
   gravada como recusa: sem ela não se distinguiria quem não quis responder
   de quem nunca viu o pedido, e a taxa de resposta não diria nada.
   ======================================================================== */
const CHAVE_ADIADO = "lumi-satisfacao-adiada";

/** Diz se a ligação à base de dados já existe e tem o método pedido.
 *
 *  Cuidado com a armadilha que isto resolve: o supabase-client.js declara
 *  "const lumiApi = {...}", e uma constante de topo NÃO fica pendurada em
 *  window — vive no âmbito lexical global. Testar window.lumiApi dá sempre
 *  falso, mesmo com tudo carregado, e foi o que fez este convite nunca
 *  aparecer. Na consola parecia estar tudo bem, porque aí o nome resolve-se
 *  pelo âmbito e não pelo objeto window. */
function haApi(metodo) {
  return typeof lumiApi !== "undefined" && lumiApi && typeof lumiApi[metodo] === "function";
}

async function verificarSatisfacaoPendente(doenteId) {
  if (!doenteId || !haApi("pedidoSatisfacaoPendente")) return;
  try {
    const pedido = await lumiApi.pedidoSatisfacaoPendente(doenteId);
    if (!pedido) return;
    if (sessionStorage.getItem(CHAVE_ADIADO) === pedido.id) return;  // "agora não"
    mostrarPedidoSatisfacao(pedido);
  } catch (e) {
    // Um convite que não aparece não pode impedir o doente de usar a página.
    console.warn("Não foi possível verificar pedidos de avaliação:", e);
  }
}

function mostrarPedidoSatisfacao(pedido) {
  if (document.getElementById("modal-satisfacao")) return;

  const final = pedido.tipo === "final";
  const caixa = document.createElement("div");
  caixa.id = "modal-satisfacao";
  caixa.className = "modal-overlay";
  caixa.setAttribute("role", "dialog");
  caixa.setAttribute("aria-modal", "true");
  caixa.setAttribute("aria-labelledby", "satisfacao-titulo");
  caixa.style.display = "flex";
  caixa.innerHTML =
    '<div class="modal-box" style="text-align:left; max-width:470px;">'
  +   '<p class="eyebrow" style="margin-bottom:4px;">' + (final ? "Fim do acompanhamento" : "Depois da consulta") + "</p>"
  +   '<h3 id="satisfacao-titulo" style="margin:0 0 8px;">'
  +     (final ? "Como correu o seu acompanhamento?" : "Como correu a sua consulta?") + "</h3>"
  +   '<p class="hint" style="margin:0 0 6px;">'
  +     (final ? "Treze perguntas, cerca de três minutos." : "Sete perguntas, cerca de um minuto.")
  +     " A sua opinião ajuda a equipa a melhorar o acompanhamento.</p>"
  +   '<p class="hint" style="margin:0 0 20px;">Responder é voluntário e não afeta em nada o seu seguimento.</p>'
  +   '<div style="display:flex; flex-direction:column; gap:9px;">'
  +     '<a class="btn btn-primary btn-block" href="' + caminhoParaAreaDoente() + 'satisfacao.html?pedido=' + pedido.id + '">Responder agora</a>'
  +     '<button type="button" class="btn btn-ghost btn-block" id="satisfacao-depois">Agora não</button>'
  +     '<button type="button" class="btn btn-ghost btn-block" id="satisfacao-recusar" style="color:var(--ink-soft); border-color:transparent;">Não quero responder</button>'
  +   "</div>"
  + "</div>";
  document.body.appendChild(caixa);

  document.getElementById("satisfacao-depois").addEventListener("click", function () {
    try { sessionStorage.setItem(CHAVE_ADIADO, pedido.id); } catch (e) { /* modo privado */ }
    caixa.remove();
  });

  document.getElementById("satisfacao-recusar").addEventListener("click", async function () {
    const b = this;
    b.disabled = true; b.textContent = "A registar...";
    try {
      await lumiApi.recusarSatisfacao(pedido.id);
      caixa.remove();
    } catch (e) {
      console.error("Não foi possível registar a recusa:", e);
      b.disabled = false; b.textContent = "Não quero responder";
      alert("Não foi possível registar agora. Tente daqui a pouco.");
    }
  });
}

/** As páginas do doente estão todas em area-doente/, mas o pop-up pode ser
 *  mostrado a partir de uma delas ou da raiz. */
function caminhoParaAreaDoente() {
  return window.location.pathname.indexOf("/area-doente/") >= 0 ? "" : "area-doente/";
}

/* ------------------------------------------------------------------------
   O convite arranca sozinho, sem depender de cada página o chamar.

   As páginas HTML não levam número de versão no endereço e o GitHub Pages
   manda guardá-las durante dez minutos: uma página em cache continua a ser
   a antiga, sem a linha nova, mesmo depois de tudo publicado — foi o que
   aconteceu quando isto foi lançado. O main.js é versionado, por isso o
   que vive aqui chega sempre.

   As chamadas que ficaram nas páginas não estorvam: a segunda encontra o
   pop-up já criado e não faz nada.
   ------------------------------------------------------------------------ */
async function arrancarConviteSatisfacao() {
  const diz = function (m) { console.log("convite: " + m); };

  const caminho = window.location.pathname;
  if (caminho.indexOf("/area-doente/") < 0) { diz("fora da área do doente (" + caminho + ")"); return; }
  // a meio de um questionário, não: nem o de PROMs nem o de satisfação
  if (/prom\.html|satisfacao\.html/.test(caminho)) { diz("página de questionário, não interrompe"); return; }
  if (!haApi("utilizadorAtual")) { diz("lumiApi ainda não disponível"); return; }

  try {
    // A sessão é reposta a partir do armazenamento local e pode ainda não
    // estar pronta no primeiro instante da página. Uma segunda tentativa
    // resolve essa corrida sem obrigar o doente a recarregar.
    let sessao = await lumiApi.utilizadorAtual();
    if (!sessao || !sessao.perfil) {
      diz("sessão ainda não pronta; nova tentativa dentro de 2 segundos");
      await new Promise(function (r) { setTimeout(r, 2000); });
      sessao = await lumiApi.utilizadorAtual();
    }
    if (!sessao || !sessao.perfil) { diz("sem sessão iniciada"); return; }
    if (sessao.perfil.papel !== "doente") { diz("sessão não é de doente (" + sessao.perfil.papel + ")"); return; }
    if (!sessao.perfil.doente_id) { diz("perfil sem doente_id"); return; }

    // aproveita a sessão já carregada para a outra verificação da área do doente
    revelarAltaSeguimento(sessao.perfil.doente_id);

    const pedido = await lumiApi.pedidoSatisfacaoPendente(sessao.perfil.doente_id);
    if (!pedido) { diz("não há pedido por responder"); return; }
    if (sessionStorage.getItem(CHAVE_ADIADO) === pedido.id) { diz("adiado nesta visita"); return; }

    diz("a mostrar o pedido " + pedido.id);
    mostrarPedidoSatisfacao(pedido);
  } catch (e) {
    console.warn("convite: falhou —", e);
  }
}

/* Corre no DOMContentLoaded e, por segurança, também no load: se algum
   script da página falhar a meio, o primeiro evento pode não chegar a
   disparar o que vem a seguir. Mostrar duas vezes não é problema —
   mostrarPedidoSatisfacao ignora o segundo pedido. */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancarConviteSatisfacao);
} else {
  arrancarConviteSatisfacao();
}
window.addEventListener("load", function () {
  if (!document.getElementById("modal-satisfacao")) arrancarConviteSatisfacao();
});

/* ========================================================================
   PROMs PARA A CONSULTA

   O que o profissional precisa de ver quando abre uma consulta: o último
   valor de cada instrumento, o anterior, e para que lado está a ir.

   Aqui subir é sempre piorar — todos os instrumentos pediátricos desta
   plataforma foram orientados no mesmo sentido, de propósito, para que uma
   seta a subir nunca precise de ser interpretada duas vezes. Na versão de
   adultos não era assim: o BSHS-B subia quando o doente melhorava, e bastava
   esquecer isso uma vez para uma seta verde assinalar um agravamento.

   A coluna "quem" existe porque a mesma pontuação não quer dizer o mesmo
   consoante quem respondeu. Ver proms_respostas.respondente, migração 021.
   ======================================================================== */
const INSTRUMENTOS_PROM = {
  "FLACC":          { nome: "Dor observada (FLACC)",        maximo: 10, subir: "pior", quem: "cuidador" },
  "FPS-R":          { nome: "Dor em caras (FPS-R)",         maximo: 10, subir: "pior", quem: "criança" },
  "NRS-dor":        { nome: "Dor (NRS)",                    maximo: 10, subir: "pior", quem: "criança" },
  "ItchMan":        { nome: "Prurido (Itch Man)",           maximo: 4,  subir: "pior", quem: "ambos" },
  "BOQ-0-5":        { nome: "BOQ 0-5",                      maximo: 32, subir: "pior", quem: "cuidador" },
  "BOQ-5-18":       { nome: "BOQ 5-18",                     maximo: 32, subir: "pior", quem: "cuidador" },
  "BOQ-11-18":      { nome: "BOQ 11-18",                    maximo: 24, subir: "pior", quem: "criança" },
  "POSAS-doente":   { nome: "Cicatriz (POSAS, próprio)",    maximo: 40, subir: "pior", quem: "criança" },
  "POSAS-cuidador": { nome: "Cicatriz (POSAS, cuidador)",   maximo: 40, subir: "pior", quem: "cuidador" },
  "PSQ":            { nome: "Estigma percebido (PSQ)",      maximo: 20, subir: "pior", quem: "criança" },
  "SCQ":            { nome: "Conforto social (SCQ)",        maximo: 16, subir: "pior", quem: "criança" },
  "CRIES-8":        { nome: "Pós-trauma (CRIES-8)",         maximo: 20, subir: "pior", quem: "criança" },
  "EQ-5D-Y":        { nome: "Qualidade de vida (EQ-5D-Y)",  maximo: 10, subir: "pior", quem: "criança" },
  "Cuidador":       { nome: "Escola e família",             maximo: 16, subir: "pior", quem: "cuidador" }
};

/**
 * Últimos dois valores de cada instrumento, com a variação já interpretada.
 * Devolve [] se a tabela não responder: uma consulta tem de poder ser
 * registada mesmo que os PROMs estejam indisponíveis.
 */
async function resumoPromsParaConsulta(doenteId) {
  let respostas = [];
  try {
    respostas = await lumiApi.listarPromsDoente(doenteId);
  } catch (e) {
    console.warn("Não foi possível carregar os PROMs:", e);
    return [];
  }

  const porInstrumento = {};
  respostas.forEach(function (r) {
    if (!porInstrumento[r.instrumento]) porInstrumento[r.instrumento] = [];
    porInstrumento[r.instrumento].push(r);
  });

  return Object.keys(INSTRUMENTOS_PROM).map(function (chave) {
    const meta = INSTRUMENTOS_PROM[chave];
    const lista = (porInstrumento[chave] || [])
      .slice()
      .sort(function (a, b) { return String(a.data_resposta).localeCompare(String(b.data_resposta)); });

    const ultima = lista[lista.length - 1] || null;
    const penultima = lista[lista.length - 2] || null;
    const valor = ultima && ultima.scores ? ultima.scores.total : null;
    const anterior = penultima && penultima.scores ? penultima.scores.total : null;

    let variacao = null, sentido = null;
    if (valor != null && anterior != null) {
      variacao = valor - anterior;
      if (variacao === 0) sentido = "igual";
      else if (variacao > 0) sentido = meta.subir === "melhor" ? "melhor" : "pior";
      else sentido = meta.subir === "melhor" ? "pior" : "melhor";
    }

    return {
      instrumento: chave, nome: meta.nome, maximo: meta.maximo,
      valor: valor, data: ultima ? ultima.data_resposta : null,
      anterior: anterior, dataAnterior: penultima ? penultima.data_resposta : null,
      variacao: variacao, sentido: sentido,
      respostas: ultima ? ultima.respostas : null,
      total: lista.length
    };
  });
}

/** Data curta para as fichas: "14 set 2026". */
function dataCurta(iso) {
  if (!iso) return "—";
  const d = new Date(String(iso).length <= 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

/* ========================================================================
   GUARDAR EM PDF

   Imprimir uma página destas tem dois problemas que o CSS sozinho não
   resolve: os quadros recolhidos não têm conteúdo desenhado, e as caixas de
   texto cortam o que não cabe na altura visível — o texto está lá, mas o
   papel mostra duas linhas e esconde o resto.

   Daí este par de eventos: antes de imprimir abre tudo e faz cada caixa
   crescer até ao seu conteúdo; depois de imprimir devolve o ecrã ao que
   estava. O utilizador carrega em "Guardar em PDF" e escolhe, na janela do
   browser, imprimir ou gravar como PDF — é a mesma janela.
   ======================================================================== */
let ALTURAS_ORIGINAIS = [];

function prepararParaImprimir() {
  if (typeof SECOES_REGISTADAS !== "undefined" && SECOES_REGISTADAS.length) {
    abrirTodosOsQuadros();
  }
  ALTURAS_ORIGINAIS = [];
  document.querySelectorAll("textarea").forEach(function (t) {
    ALTURAS_ORIGINAIS.push({ el: t, altura: t.style.height, linhas: t.rows });
    t.style.height = "auto";
    t.style.height = t.scrollHeight + "px";
  });
}

function restaurarDepoisDeImprimir() {
  ALTURAS_ORIGINAIS.forEach(function (r) { r.el.style.height = r.altura; });
  ALTURAS_ORIGINAIS = [];
  if (typeof SECOES_REGISTADAS !== "undefined" && SECOES_REGISTADAS.length) {
    abrirQuadro(SECOES_REGISTADAS[0].id, false);
  }
}

window.addEventListener("beforeprint", prepararParaImprimir);
window.addEventListener("afterprint", restaurarDepoisDeImprimir);

/** Chamado pelo botão. A janela do browser oferece "Guardar como PDF". */
function guardarEmPDF() {
  prepararParaImprimir();
  window.print();
}

/**
 * Cabeçalho que só aparece no papel. Um documento clínico impresso sem
 * identificação do doente e sem data não serve para nada — e a página no
 * ecrã já mostra tudo isso noutro sítio, pelo que no ecrã este bloco
 * estorvaria.
 */
function montarCabecalhoImpressao(titulo, doente) {
  const el = document.getElementById("print-cabecalho");
  if (!el) return;
  const proc = doente && doente.processo ? " · Processo " + doente.processo : "";
  el.innerHTML =
      '<div style="font-size:9pt; letter-spacing:.06em; text-transform:uppercase;">Lumi · Unidade de Queimados Pediátricos</div>'
    + '<div style="font-size:14pt; font-weight:700; margin:4px 0 2px;">' + titulo + "</div>"
    + '<div style="font-size:10pt;">' + ((doente && doente.nome) || "") + proc
    + " — impresso em " + new Date().toLocaleString("pt-PT") + "</div>";
}

/**
 * Evolução de cada instrumento do princípio ao fim do acompanhamento.
 * Ao contrário de resumoPromsParaConsulta, que compara as duas últimas
 * respostas, aqui o que interessa é a primeira contra a última — é essa a
 * pergunta do relatório de alta: o doente saiu melhor do que entrou?
 */
async function evolucaoPromsDoAcompanhamento(doenteId) {
  let respostas = [];
  try {
    respostas = await lumiApi.listarPromsDoente(doenteId);
  } catch (e) {
    console.warn("Não foi possível carregar os PROMs:", e);
    return [];
  }

  const porInstrumento = {};
  respostas.forEach(function (r) {
    if (!porInstrumento[r.instrumento]) porInstrumento[r.instrumento] = [];
    porInstrumento[r.instrumento].push(r);
  });

  return Object.keys(INSTRUMENTOS_PROM).map(function (chave) {
    const meta = INSTRUMENTOS_PROM[chave];
    const lista = (porInstrumento[chave] || []).slice()
      .sort(function (a, b) { return String(a.data_resposta).localeCompare(String(b.data_resposta)); });

    const primeiro = lista[0] || null;
    const ultimo = lista[lista.length - 1] || null;
    const vInicial = primeiro && primeiro.scores ? primeiro.scores.total : null;
    const vFinal = ultimo && ultimo.scores ? ultimo.scores.total : null;

    let variacao = null, sentido = null;
    // com uma só resposta não há evolução nenhuma para reportar
    if (vInicial != null && vFinal != null && lista.length > 1) {
      variacao = vFinal - vInicial;
      if (variacao === 0) sentido = "igual";
      else if (variacao > 0) sentido = meta.subir === "melhor" ? "melhor" : "pior";
      else sentido = meta.subir === "melhor" ? "pior" : "melhor";
    }

    return {
      instrumento: chave, nome: meta.nome, maximo: meta.maximo,
      inicial: vInicial, dataInicial: primeiro ? primeiro.data_resposta : null,
      final: vFinal, dataFinal: ultimo ? ultimo.data_resposta : null,
      variacao: variacao, sentido: sentido, respostas: lista.length
    };
  }).filter(function (p) { return p.final != null; });
}

/* ========================================================================
   ALTA DO ACOMPANHAMENTO NO MENU DO DOENTE

   O relatório final só existe no fim. Deixar a entrada no menu durante todo
   o acompanhamento seria anunciar uma saída que ainda não há — e quem lá
   fosse encontrava uma página vazia.

   A entrada nasce escondida no HTML e só se revela quando houver relatório.
   Note-se que a pergunta "existe?" já traz a resposta certa sozinha: a base
   de dados só entrega ao doente relatórios emitidos, portanto um rascunho da
   equipa devolve nada e o menu continua escondido.
   ======================================================================== */
async function revelarAltaSeguimento(doenteId) {
  const item = document.getElementById("menu-alta-seguimento");
  if (!item || !doenteId || !haApi("obterAltaSeguimento")) return;
  try {
    const alta = await lumiApi.obterAltaSeguimento(doenteId);
    if (alta) item.hidden = false;
  } catch (e) {
    // sem relatório acessível o menu fica como está, escondido
    console.warn("Alta do acompanhamento indisponível:", e);
  }
}
