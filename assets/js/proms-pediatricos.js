/* ========================================================================
   LUMI — instrumentos de resultado reportados em idade pediátrica
   ------------------------------------------------------------------------
   PORQUE É QUE ISTO NÃO É A LISTA DO LADO DOS ADULTOS

   A plataforma de adultos usa BSHS-B, POSAS, 5-D Itch, EQ-5D-5L e PHQ-9.
   Nenhum destes foi validado em crianças queimadas. A revisão sistemática de
   Griffiths et al. (Burns 2015;41:212-24) percorreu 6250 artigos e encontrou
   32 instrumentos usados em investigação de queimaduras pediátricas — e,
   destes, apenas TRÊS com alguma evidência psicométrica obtida nesta
   população:

     · PSQ  — Perceived Stigmatisation Questionnaire (21 itens, 8-18 anos)
     · SCQ  — Social Comfort Questionnaire (8 itens, 8-18 anos)
     · BOQ  — Burn Outcomes Questionnaire da American Burn Association /
              Shriners Hospitals for Children (52 itens, 12 subescalas), o
              único específico de queimados, validado dos 11 aos 18 anos
              (Daltroy et al., J Burn Care Res 2000;21:29-39), com versões
              de preenchimento parental para 0-5 e 5-18 anos.

   A mesma revisão deixa três avisos que esta implementação leva a sério:
     1. instrumentos genéricos não desenhados para queimados tendem a não
        detetar mudança clínica neste grupo (falta de responsividade);
     2. nenhum dos três tem validação linguística para português europeu —
        foram desenvolvidos e validados em inglês americano;
     3. nenhum tem evidência publicada de responsividade, pelo que servem
        para descrever o estado, não para provar melhoria.

   O QUE ESTE FICHEIRO FAZ

   Mapeia os resultados do núcleo de valor em queimados (VBHC-burns core
   set, Spronk et al., Burns 2024;50:1925-34 — dor, cicatrização, atividade
   física, autocuidado, independência, regresso ao trabalho/escola,
   depressão, prurido, flexibilidade da cicatriz, qualidade de vida,
   autogestão e sintomas pós-traumáticos) sobre instrumentos com utilização
   pediátrica, repartidos por faixa etária e por momento de avaliação.

   Os momentos são os do núcleo de valor, ancorados na ALTA e não na data da
   queimadura — foi essa a correção que os autores fizeram depois de avaliar
   o conjunto em prática clínica, porque os marcos contados desde a lesão não
   coincidiam com as consultas.

   HONESTIDADE DE IMPLEMENTAÇÃO

   Vários instrumentos aqui estão em versão REDUZIDA, assinalada em cada um
   no campo "reduzido". Uma versão reduzida não é o instrumento: serve para
   acompanhar a trajetória e disparar alertas, não para publicar resultados
   nem para comparar com normas. Os itens completos devem ser pedidos aos
   detentores e traduzidos com validação linguística antes de qualquer uso
   que não seja este protótipo.
   ======================================================================== */

/* ------------------------------------------------------------------------
   MOMENTOS DE AVALIAÇÃO (VBHC-burns core set, adaptado)
   ---------------------------------------------------------------------- */
const MOMENTOS_PROM = [
  { id: "alta",  rotulo: "Na alta",            dias: 0,   nota: "Inclui perguntas retrospetivas sobre o internamento." },
  { id: "2s",    rotulo: "2 semanas da alta",  dias: 14,  nota: "Dor, prurido e sono — é quando estão no pico." },
  { id: "3m",    rotulo: "3 meses da alta",    dias: 90,  nota: "Cicatriz, função, regresso à escola." },
  { id: "12m",   rotulo: "12 meses da alta",   dias: 365, nota: "Avaliação completa, incluindo estigma e bem-estar." },
  { id: "anual", rotulo: "Anual",              dias: 730, nota: "Repete os 12 meses enquanto houver seguimento." }
];

/* ------------------------------------------------------------------------
   FAIXAS ETÁRIAS
   ------------------------------------------------------------------------
   Os cortes não são arbitrários: 5 anos é onde o BOQ muda de versão; 8 anos
   é a idade a partir da qual o PSQ e o SCQ têm validação pediátrica, e
   também aquela a partir da qual se considera que a criança consegue
   exprimir conceitos como "o que sinto sobre mim" (Bevans et al., citado na
   revisão); 11 anos é o início da versão de autopreenchimento do BOQ.

   Atenção: a faixa etária do QUESTIONÁRIO não é a mesma coisa que a faixa da
   MASCOTE (ver main.js, FIGURAS_LUMI). A mascote tem seis figuras, que mudam
   aos 3, 6, 8, 10 e 15 anos, por acompanharem o que muda na vida da criança;
   os questionários têm três baterias, que mudam aos 5, 8 e 11 anos, por
   acompanharem o que muda na validação dos instrumentos. As duas coisas são
   independentes de propósito.
   ---------------------------------------------------------------------- */
const FAIXAS_PROM = [
  {
    id: "0-4",
    rotulo: "0 aos 4 anos",
    respondente: "cuidador",
    nota: "Nesta idade responde sempre o pai, a mãe ou quem cuida. Não há autopreenchimento validado."
  },
  {
    id: "5-10",
    rotulo: "5 aos 10 anos",
    respondente: "misto",
    nota: "A criança responde às caras (dor, comichão, como se sente). O resto responde quem cuida."
  },
  {
    id: "11-17",
    rotulo: "11 aos 17 anos",
    respondente: "crianca",
    nota: "Idade da versão de autopreenchimento do BOQ. O jovem responde sozinho, com o cuidador disponível se quiser ajuda."
  }
];

function faixaPromPorIdade(idade) {
  if (idade == null || isNaN(idade)) return FAIXAS_PROM[1];   /* sem data de nascimento: a faixa do meio é a menos errada */
  if (idade < 5) return FAIXAS_PROM[0];
  if (idade < 11) return FAIXAS_PROM[1];
  return FAIXAS_PROM[2];
}

/* ------------------------------------------------------------------------
   ESCALAS REUTILIZADAS
   ---------------------------------------------------------------------- */

/* Faces Pain Scale — Revised (Hicks et al., 2001). Seis caras, pontuadas
   0-2-4-6-8-10. É a escala de autorrelato de dor recomendada a partir dos
   4-5 anos; abaixo disso usa-se a observação (FLACC). */
const CARAS_DOR = [
  { cara: "😀", valor: 0,  rotulo: "Sem dor",     tom: "bom" },
  { cara: "🙂", valor: 2,  rotulo: "Dói um bocadinho", tom: "bom" },
  { cara: "😐", valor: 4,  rotulo: "Dói um pouco mais", tom: "medio" },
  { cara: "🙁", valor: 6,  rotulo: "Dói ainda mais", tom: "medio" },
  { cara: "😣", valor: 8,  rotulo: "Dói muito",    tom: "baixo" },
  { cara: "😭", valor: 10, rotulo: "Dói imenso",   tom: "baixo" }
];

/* Itch Man Scale (Blakeney & Marvin), a escala de prurido desenhada em
   unidade de queimados pediátricos: 0 a 4, da ausência à comichão que não
   deixa estar quieto. */
const NIVEIS_PRURIDO = [
  { valor: 0, rotulo: "Nada",                               tom: "bom" },
  { valor: 1, rotulo: "Um bocadinho, passa sozinha",        tom: "bom" },
  { valor: 2, rotulo: "Apetece coçar, mas consigo parar",   tom: "medio" },
  { valor: 3, rotulo: "Coço muito e custa a parar",         tom: "medio" },
  { valor: 4, rotulo: "Não consigo estar quieto(a)",        tom: "baixo" }
];

const LIKERT_FREQUENCIA = ["Nunca", "Quase nunca", "Às vezes", "Muitas vezes", "Sempre"];
const LIKERT_DIFICULDADE = ["Nenhuma dificuldade", "Pouca", "Alguma", "Muita", "Não consegue"];
const LIKERT_INCOMODO = ["Nada", "Um pouco", "Mais ou menos", "Bastante", "Imenso"];

/* ------------------------------------------------------------------------
   AS BATERIAS
   ------------------------------------------------------------------------
   Cada instrumento declara:
     codigo      — o que fica gravado em proms_respostas.instrumento
     nome        — o que a família lê
     fonte       — a origem, para quem auditar o protótipo
     reduzido    — true quando NÃO é o instrumento completo
     respondente — 'crianca' | 'cuidador'
     resultado   — qual dos resultados do núcleo de valor é que mede
     momentos    — em que avaliações aparece
     escala      — 'caras-dor' | 'prurido' | 'likert' | 'nrs' | 'posas'
     itens       — as perguntas
     maximo      — valor máximo do score somado (para normalizar os gráficos)
     sentido     — 'alto-mau' quando pontuação alta = pior (dor, estigma);
                   'alto-bom' quando alta = melhor (função, qualidade de vida)
   ---------------------------------------------------------------------- */
const BATERIAS_PROM = {

  /* ====================== 0 AOS 4 ANOS — tudo por quem cuida ============ */
  "0-4": [
    {
      codigo: "FLACC",
      nome: "Dor observada (FLACC)",
      fonte: "Merkel et al., Pediatr Nurs 1997. Escala de observação para 2 meses a 7 anos.",
      reduzido: false,
      respondente: "cuidador",
      resultado: "Dor",
      momentos: ["alta", "2s", "3m", "12m", "anual"],
      escala: "likert",
      sentido: "alto-mau",
      maximo: 10,
      intro: "Observe a criança durante um ou dois minutos, calma, sem a estimular. Escolha o que descreve melhor cada linha.",
      itens: [
        { id: "face",          label: "Rosto",        opcoes: ["Tranquilo ou a sorrir", "Faz caretas de vez em quando, franze o sobrolho", "Queixo a tremer, maxilares cerrados, caretas constantes"] },
        { id: "pernas",        label: "Pernas",       opcoes: ["Relaxadas", "Inquietas, tensas", "A pontapear ou encolhidas"] },
        { id: "atividade",     label: "Atividade",    opcoes: ["Deitada, move-se com facilidade", "Contorce-se, não está quieta, tensa", "Arqueada, rígida ou com movimentos bruscos"] },
        { id: "choro",         label: "Choro",        opcoes: ["Não chora", "Gemidos, queixumes ocasionais", "Choro mantido, gritos, soluços"] },
        { id: "consolo",       label: "Consolo",      opcoes: ["Tranquila, não precisa", "Acalma com colo, carinho ou conversa", "Difícil de consolar"] }
      ]
    },
    {
      codigo: "ItchMan",
      nome: "Comichão (Itch Man, por observação)",
      fonte: "Blakeney & Marvin — escala desenvolvida em unidade de queimados pediátricos. Nesta idade é lida pela observação de quem cuida.",
      reduzido: false,
      respondente: "cuidador",
      resultado: "Prurido",
      momentos: ["alta", "2s", "3m", "12m", "anual"],
      escala: "prurido",
      sentido: "alto-mau",
      maximo: 4,
      itens: [
        { id: "prurido", label: "Nos últimos 7 dias, qual foi o pior momento de comichão?" },
        { id: "prurido_sono", label: "A comichão acordou a criança durante a noite?", escala: "likert", opcoes: ["Nenhuma noite", "1 a 2 noites", "3 ou mais noites"] }
      ]
    },
    {
      codigo: "BOQ-0-5",
      nome: "Burn Outcomes Questionnaire 0-5 (reduzido)",
      fonte: "American Burn Association / Shriners Hospitals for Children. Versão de preenchimento parental. Único instrumento específico de queimados com utilização pediátrica estabelecida.",
      reduzido: true,
      respondente: "cuidador",
      resultado: "Função física, autocuidado, aparência, preocupação parental e impacto na família",
      momentos: ["alta", "3m", "12m", "anual"],
      escala: "likert",
      sentido: "alto-mau",
      maximo: 32,
      intro: "Pensando nas últimas duas semanas, em comparação com o que a criança fazia antes da queimadura.",
      itens: [
        { id: "brincar",      label: "Brincar, gatinhar ou correr como antes",                 opcoes: LIKERT_DIFICULDADE },
        { id: "maos",         label: "Usar as mãos para agarrar, comer ou brincar",            opcoes: LIKERT_DIFICULDADE },
        { id: "vestir",       label: "Deixar-se vestir e lavar sem resistir ou chorar",        opcoes: LIKERT_DIFICULDADE },
        { id: "sono",         label: "Dormir uma noite seguida",                               opcoes: LIKERT_DIFICULDADE },
        { id: "aparencia",    label: "A criança parece incomodada quando lhe tocam na cicatriz ou a olham", opcoes: LIKERT_INCOMODO },
        { id: "preocupacao",  label: "Preocupação dos pais com o aspeto futuro da cicatriz",   opcoes: LIKERT_INCOMODO },
        { id: "familia",      label: "A rotina da família ficou alterada pelos tratamentos",   opcoes: LIKERT_INCOMODO },
        { id: "satisfacao",   label: "Insatisfação com o estado atual da criança",             opcoes: LIKERT_INCOMODO }
      ]
    },
    {
      codigo: "POSAS-cuidador",
      nome: "Cicatriz vista por quem cuida (POSAS 3.0, adaptado)",
      fonte: "Carrière et al., Qual Life Res 2023 — escala do doente da POSAS 3.0. Aqui respondida pelo cuidador, por a criança não ter idade para o fazer.",
      reduzido: true,
      respondente: "cuidador",
      resultado: "Flexibilidade da cicatriz",
      momentos: ["3m", "12m", "anual"],
      escala: "nrs",
      sentido: "alto-mau",
      maximo: 40,
      intro: "De 1 (como pele normal) a 10 (o pior que consegue imaginar).",
      itens: [
        { id: "cor",          label: "Cor da cicatriz, comparada com a pele à volta" },
        { id: "rigidez",      label: "Rigidez — a cicatriz está dura ou repuxa" },
        { id: "espessura",    label: "Espessura — a cicatriz está elevada" },
        { id: "irregular",    label: "Irregularidade da superfície" }
      ]
    }
  ],

  /* ====================== 5 AOS 10 ANOS — misto ======================== */
  "5-10": [
    {
      codigo: "FPS-R",
      nome: "A tua dor",
      fonte: "Faces Pain Scale – Revised (Hicks et al., Pain 2001). Autorrelato a partir dos 4-5 anos.",
      reduzido: false,
      respondente: "crianca",
      resultado: "Dor",
      momentos: ["alta", "2s", "3m", "12m", "anual"],
      escala: "caras-dor",
      sentido: "alto-mau",
      maximo: 10,
      intro: "Estas caras mostram quanta dor se pode ter. Escolhe a cara que mostra a tua dor nos últimos dias.",
      itens: [{ id: "dor", label: "Qual é a cara que mostra a tua dor?" }]
    },
    {
      codigo: "ItchMan",
      nome: "A tua comichão",
      fonte: "Itch Man Scale (Blakeney & Marvin), desenhada para crianças queimadas.",
      reduzido: false,
      respondente: "crianca",
      resultado: "Prurido",
      momentos: ["alta", "2s", "3m", "12m", "anual"],
      escala: "prurido",
      sentido: "alto-mau",
      maximo: 4,
      itens: [
        { id: "prurido", label: "Nos últimos dias, qual foi a pior comichão que tiveste?" },
        { id: "prurido_sono", label: "A comichão acordou-te a meio da noite?", escala: "likert", opcoes: ["Nenhuma noite", "1 a 2 noites", "3 ou mais noites"] }
      ]
    },
    {
      codigo: "BOQ-5-18",
      nome: "Burn Outcomes Questionnaire 5-18 (reduzido)",
      fonte: "American Burn Association / Shriners Hospitals for Children, versão de preenchimento parental dos 5 aos 18 anos.",
      reduzido: true,
      respondente: "cuidador",
      resultado: "Função física, adesão ao tratamento, saúde emocional, regresso à escola e impacto na família",
      momentos: ["alta", "3m", "12m", "anual"],
      escala: "likert",
      sentido: "alto-mau",
      maximo: 32,
      intro: "Pensando nas últimas duas semanas.",
      itens: [
        { id: "desporto",    label: "Dificuldade a correr, saltar ou fazer desporto",                   opcoes: LIKERT_DIFICULDADE },
        { id: "maos",        label: "Dificuldade a usar as mãos (escrever, abotoar, talheres)",         opcoes: LIKERT_DIFICULDADE },
        { id: "autocuidado", label: "Dificuldade a vestir-se, lavar-se ou tomar banho sozinho(a)",      opcoes: LIKERT_DIFICULDADE },
        { id: "adesao",      label: "Dificuldade em cumprir os tratamentos em casa (creme, malha, exercícios)", opcoes: LIKERT_DIFICULDADE },
        { id: "emocional",   label: "A criança anda triste, irritada ou com medos novos",               opcoes: LIKERT_FREQUENCIA },
        { id: "escola",      label: "Faltou à escola ou teve dificuldades por causa da queimadura",     opcoes: LIKERT_FREQUENCIA },
        { id: "preocupacao", label: "Preocupação dos pais com o futuro da criança",                     opcoes: LIKERT_INCOMODO },
        { id: "familia",     label: "A vida da família ficou alterada por causa dos tratamentos",       opcoes: LIKERT_INCOMODO }
      ]
    },
    {
      codigo: "POSAS-cuidador",
      nome: "A cicatriz, vista por quem cuida (POSAS 3.0, reduzido)",
      fonte: "Patient scale da POSAS 3.0 (Carrière et al., Qual Life Res 2023). Nesta idade é respondida por quem cuida: a criança sabe dizer se dói ou faz comichão, mas não avalia rigidez nem espessura.",
      reduzido: true,
      respondente: "cuidador",
      resultado: "Flexibilidade da cicatriz",
      momentos: ["3m", "12m", "anual"],
      escala: "nrs",
      sentido: "alto-mau",
      maximo: 40,
      intro: "De 1 (como pele normal) a 10 (o pior que consegue imaginar).",
      itens: [
        { id: "cor",       label: "Cor da cicatriz, comparada com a pele à volta" },
        { id: "rigidez",   label: "Rigidez — a cicatriz está dura ou repuxa" },
        { id: "espessura", label: "Espessura — a cicatriz está elevada" },
        { id: "irregular", label: "Irregularidade da superfície" }
      ]
    },
    {
      codigo: "PSQ",
      nome: "Como os outros reagem (PSQ, reduzido)",
      fonte: "Perceived Stigmatisation Questionnaire (Lawrence et al.). Validado em 361 crianças e adolescentes queimados dos 8 aos 18 anos (Lawrence et al., Rehabil Psychol 2010).",
      reduzido: true,
      respondente: "crianca",
      idadeMinima: 8,
      resultado: "Estigma percebido",
      momentos: ["12m", "anual"],
      escala: "likert",
      sentido: "alto-mau",
      maximo: 20,
      intro: "Nos últimos tempos, com que frequência é que isto aconteceu?",
      itens: [
        { id: "olhar",     label: "As pessoas ficam a olhar para mim",                opcoes: LIKERT_FREQUENCIA },
        { id: "perguntas", label: "As pessoas fazem perguntas sobre a minha pele",    opcoes: LIKERT_FREQUENCIA },
        { id: "nomes",     label: "Chamam-me nomes ou gozam comigo",                  opcoes: LIKERT_FREQUENCIA },
        { id: "afastam",   label: "Há meninos que se afastam de mim",                 opcoes: LIKERT_FREQUENCIA },
        { id: "amigos",    label: "Sinto que faço amigos com mais dificuldade do que antes", opcoes: LIKERT_FREQUENCIA }
      ]
    },
    {
      codigo: "SCQ",
      nome: "Como me sinto com os outros (SCQ, reduzido)",
      fonte: "Social Comfort Questionnaire (Lawrence et al.), validado na mesma amostra pediátrica dos 8 aos 18 anos.",
      reduzido: true,
      respondente: "crianca",
      idadeMinima: 8,
      resultado: "Conforto social",
      momentos: ["12m", "anual"],
      escala: "likert",
      sentido: "alto-mau",
      maximo: 12,
      itens: [
        { id: "encaixo",  label: "Sinto que não encaixo com os outros meninos",  opcoes: LIKERT_FREQUENCIA },
        { id: "evito",    label: "Evito sítios com muita gente",                 opcoes: LIKERT_FREQUENCIA },
        { id: "esconder", label: "Escondo a minha cicatriz com a roupa",         opcoes: LIKERT_FREQUENCIA }
      ]
    }
  ],

  /* ====================== 11 AOS 17 ANOS — autopreenchimento =========== */
  "11-17": [
    {
      codigo: "NRS-dor",
      nome: "Dor",
      fonte: "Escala numérica 0-10, o instrumento de dor do núcleo de valor em queimados.",
      reduzido: false,
      respondente: "crianca",
      resultado: "Dor",
      momentos: ["alta", "2s", "3m", "12m", "anual"],
      escala: "nrs-0-10",
      rotulos: ["Sem dor", "A pior dor que consigo imaginar"],
      sentido: "alto-mau",
      maximo: 10,
      itens: [{ id: "dor", label: "Nos últimos 7 dias, qual foi a tua pior dor?" }]
    },
    {
      codigo: "ItchMan",
      nome: "Comichão",
      fonte: "Itch Man Scale (Blakeney & Marvin).",
      reduzido: false,
      respondente: "crianca",
      resultado: "Prurido",
      momentos: ["alta", "2s", "3m", "12m", "anual"],
      escala: "prurido",
      sentido: "alto-mau",
      maximo: 4,
      itens: [
        { id: "prurido", label: "Nos últimos 7 dias, qual foi a pior comichão?" },
        { id: "prurido_sono", label: "A comichão acordou-te durante a noite?", escala: "likert", opcoes: ["Nenhuma noite", "1 a 2 noites", "3 ou mais noites"] }
      ]
    },
    {
      codigo: "BOQ-11-18",
      nome: "Burn Outcomes Questionnaire 11-18 (reduzido)",
      fonte: "Daltroy et al., J Burn Care Res 2000;21:29-39. 52 itens e 12 subescalas no original; validado em 86 adolescentes queimados, com consistência interna 0,75-0,92 e fiabilidade teste-reteste 0,67-0,99. É o único instrumento específico de queimados validado em autopreenchimento nesta idade.",
      reduzido: true,
      respondente: "crianca",
      resultado: "Função física, dor, aparência, saúde emocional, adesão e regresso à escola",
      momentos: ["alta", "3m", "12m", "anual"],
      escala: "likert",
      sentido: "alto-mau",
      maximo: 24,
      intro: "Nas últimas duas semanas, quanta dificuldade tiveste em...",
      itens: [
        { id: "membro_superior", label: "Usar os braços e as mãos no dia a dia",            opcoes: LIKERT_DIFICULDADE },
        { id: "desporto",        label: "Fazer desporto ou educação física",                opcoes: LIKERT_DIFICULDADE },
        { id: "mobilidade",      label: "Andar, subir escadas, levantar-te",                opcoes: LIKERT_DIFICULDADE },
        { id: "adesao",          label: "Cumprir os tratamentos em casa (creme, malha de pressão, exercícios)", opcoes: LIKERT_DIFICULDADE },
        { id: "aparencia",       label: "Lidar com o aspeto da tua pele",                   opcoes: LIKERT_DIFICULDADE },
        { id: "escola",          label: "Acompanhar a escola e estar com a turma",          opcoes: LIKERT_DIFICULDADE }
      ]
    },
    {
      codigo: "POSAS-doente",
      nome: "A tua cicatriz (POSAS 3.0, reduzido)",
      fonte: "Patient scale da POSAS 3.0 (Carrière et al., Qual Life Res 2023), o instrumento de cicatriz do núcleo de valor em queimados.",
      reduzido: true,
      respondente: "crianca",
      resultado: "Flexibilidade da cicatriz",
      momentos: ["3m", "12m", "anual"],
      escala: "nrs",
      sentido: "alto-mau",
      maximo: 40,
      intro: "De 1 (igual à pele normal) a 10 (o pior que consegues imaginar).",
      itens: [
        { id: "cor",       label: "Cor" },
        { id: "rigidez",   label: "Rigidez — repuxa ou está dura" },
        { id: "espessura", label: "Espessura — está elevada" },
        { id: "irregular", label: "Superfície irregular" }
      ]
    },
    {
      codigo: "PSQ",
      nome: "Como os outros reagem (PSQ, reduzido)",
      fonte: "Perceived Stigmatisation Questionnaire (Lawrence et al.), validado dos 8 aos 18 anos em queimados pediátricos.",
      reduzido: true,
      respondente: "crianca",
      resultado: "Estigma percebido",
      momentos: ["12m", "anual"],
      escala: "likert",
      sentido: "alto-mau",
      maximo: 20,
      intro: "Nos últimos tempos, com que frequência aconteceu?",
      itens: [
        { id: "olhar",     label: "As pessoas ficam a olhar para mim",                   opcoes: LIKERT_FREQUENCIA },
        { id: "perguntas", label: "Fazem-me perguntas sobre as minhas cicatrizes",       opcoes: LIKERT_FREQUENCIA },
        { id: "nomes",     label: "Chamam-me nomes ou gozam comigo",                     opcoes: LIKERT_FREQUENCIA },
        { id: "afastam",   label: "Há pessoas que se afastam de mim",                    opcoes: LIKERT_FREQUENCIA },
        { id: "amizades",  label: "Sinto que é mais difícil fazer amizades do que antes", opcoes: LIKERT_FREQUENCIA }
      ]
    },
    {
      codigo: "SCQ",
      nome: "Como me sinto com os outros (SCQ, reduzido)",
      fonte: "Social Comfort Questionnaire (Lawrence et al.).",
      reduzido: true,
      respondente: "crianca",
      resultado: "Conforto social",
      momentos: ["12m", "anual"],
      escala: "likert",
      sentido: "alto-mau",
      maximo: 16,
      itens: [
        { id: "encaixo",  label: "Sinto que não encaixo com as outras pessoas",  opcoes: LIKERT_FREQUENCIA },
        { id: "evito",    label: "Evito sítios com muita gente",                 opcoes: LIKERT_FREQUENCIA },
        { id: "esconder", label: "Escolho a roupa para esconder as cicatrizes",  opcoes: LIKERT_FREQUENCIA },
        { id: "conversa", label: "Fico desconfortável quando falam da minha pele", opcoes: LIKERT_FREQUENCIA }
      ]
    },
    {
      codigo: "CRIES-8",
      nome: "Depois do que aconteceu (CRIES-8, reduzido)",
      fonte: "Children's Revised Impact of Event Scale, versão pediátrica da escala que o núcleo de valor usa nos adultos (IES-6). Rastreio de sintomas pós-traumáticos a partir dos 8 anos.",
      reduzido: true,
      respondente: "crianca",
      resultado: "Sintomas pós-traumáticos",
      momentos: ["3m", "12m", "anual"],
      escala: "likert",
      sentido: "alto-mau",
      maximo: 20,
      intro: "Nos últimos 7 dias, com que frequência é que isto aconteceu?",
      aviso: "Rastreio, não diagnóstico. Uma pontuação alta é motivo para falar com a psicologia da unidade, não um resultado em si.",
      itens: [
        { id: "pensamentos", label: "Vieram-me à cabeça imagens do que aconteceu, sem eu querer", opcoes: LIKERT_FREQUENCIA },
        { id: "evitar",      label: "Tentei não pensar no assunto",                               opcoes: LIKERT_FREQUENCIA },
        { id: "sobressalto", label: "Assusto-me com facilidade",                                  opcoes: LIKERT_FREQUENCIA },
        { id: "sono",        label: "Tive dificuldade em adormecer ou sonhos maus",               opcoes: LIKERT_FREQUENCIA }
      ]
    },
    {
      codigo: "EQ-5D-Y",
      nome: "Como está a tua saúde hoje (EQ-5D-Y)",
      fonte: "Versão pediátrica do EQ-5D, o instrumento genérico do núcleo de valor em queimados. Permite comparar com normas e com outras áreas da saúde.",
      reduzido: false,
      respondente: "crianca",
      resultado: "Qualidade de vida",
      momentos: ["alta", "3m", "12m", "anual"],
      escala: "likert",
      sentido: "alto-mau",
      maximo: 10,
      intro: "Escolhe o que melhor descreve a tua saúde hoje.",
      itens: [
        { id: "mobilidade",  label: "Andar",                        opcoes: ["Não tenho problemas", "Tenho alguns problemas", "Tenho muitos problemas"] },
        { id: "autocuidado", label: "Tomar conta de mim (lavar-me, vestir-me)", opcoes: ["Não tenho problemas", "Tenho alguns problemas", "Tenho muitos problemas"] },
        { id: "atividades",  label: "Atividades do costume (escola, brincar, desporto)", opcoes: ["Não tenho problemas", "Tenho alguns problemas", "Tenho muitos problemas"] },
        { id: "dor",         label: "Ter dores ou mal-estar",       opcoes: ["Não tenho", "Tenho um pouco", "Tenho muito"] },
        { id: "humor",       label: "Estar preocupado, triste ou infeliz", opcoes: ["Não estou", "Estou um pouco", "Estou muito"] }
      ]
    }
  ]
};

/* ------------------------------------------------------------------------
   PERGUNTAS DE QUEM CUIDA — sempre presentes, em qualquer faixa etária.
   São os dois domínios que o BOQ mede e que nenhum instrumento de adulto
   tem: a preocupação dos pais e a perturbação da vida familiar. O núcleo
   de valor em adultos chama-lhe "regresso ao trabalho"; aqui são duas
   coisas distintas — a escola da criança e o trabalho de quem falta ao
   emprego para a trazer aos tratamentos.
   ---------------------------------------------------------------------- */
const ITENS_CUIDADOR = {
  codigo: "Cuidador",
  nome: "Para quem cuida",
  fonte: "Subescalas 'parental concern' e 'family disruption' do BOQ, e o item de regresso à escola/trabalho do VBHC-burns core set (adaptado do ICHOM).",
  reduzido: true,
  respondente: "cuidador",
  resultado: "Impacto na família e regresso à escola",
  momentos: ["alta", "2s", "3m", "12m", "anual"],
  escala: "likert",
  sentido: "alto-mau",
  maximo: 16,
  itens: [
    { id: "escola",     label: "A criança está a ir à escola ou à creche como antes?", opcoes: ["Sim, como antes", "Sim, mas com limitações", "Só a tempo parcial", "Ainda não voltou", "Não se aplica"] },
    { id: "faltas",     label: "Teve de faltar ao trabalho por causa dos tratamentos?", opcoes: ["Não", "Um ou dois dias", "Vários dias", "Muitos dias", "Deixei de trabalhar"] },
    { id: "preocupado", label: "Quão preocupado(a) se sente com a recuperação da criança?", opcoes: LIKERT_INCOMODO },
    { id: "apoio",      label: "Sente que sabe o que fazer em casa entre consultas?", opcoes: ["Sei bem", "Sei quase tudo", "Mais ou menos", "Pouco", "Não sei"] }
  ]
};

/* ------------------------------------------------------------------------
   SELEÇÃO
   ---------------------------------------------------------------------- */

/** Instrumentos a aplicar a esta criança, nesta avaliação. Filtra por faixa
 *  etária, por momento e pela idade mínima de cada instrumento (o PSQ e o
 *  SCQ só a partir dos 8 anos — abaixo disso não há validação, e perguntar
 *  a uma criança de 6 anos se "os outros se afastam" cria a ideia em vez de
 *  a medir). */
function instrumentosPara(idade, momento) {
  const faixa = faixaPromPorIdade(idade);
  const lista = (BATERIAS_PROM[faixa.id] || []).filter(function (inst) {
    if (inst.idadeMinima != null && (idade == null || idade < inst.idadeMinima)) return false;
    return inst.momentos.indexOf(momento) !== -1;
  });
  if (ITENS_CUIDADOR.momentos.indexOf(momento) !== -1) lista.push(ITENS_CUIDADOR);
  return { faixa: faixa, instrumentos: lista };
}

/** Número total de perguntas — serve para avisar a família do tempo que
 *  demora, que foi uma das limitações apontadas ao núcleo de valor dos
 *  adultos (entre 14 e 53 perguntas, com risco de sobrecarga). */
function contarItens(instrumentos) {
  return instrumentos.reduce(function (t, i) { return t + i.itens.length; }, 0);
}

/** Momento de avaliação a partir dos dias decorridos desde a alta. */
function momentoPorDiasDesdeAlta(dias) {
  if (dias == null) return "3m";
  if (dias < 7) return "alta";
  if (dias < 45) return "2s";
  if (dias < 180) return "3m";
  if (dias < 540) return "12m";
  return "anual";
}
