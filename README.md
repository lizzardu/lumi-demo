# Lumi — seguimento pós-alta da Unidade de Queimados Pediátricos

Protótipo da plataforma de acompanhamento das crianças depois de terem alta da
Unidade de Queimados. É a versão pediátrica do *Tive alta, e agora?* (Unidade de
Queimados de adultos, ULS São José), com a mesma estrutura — formulário de alta,
jornada de metas, plano de tratamento, consultas, dúvidas, alertas — e com o que
tinha de ser diferente **porque os doentes são crianças**.

Dados fictícios. Não é um produto clínico em uso.

---

## Ver o site

Não precisa de instalação. Qualquer servidor estático serve:

```bash
python -m http.server 8099
```

E abrir `http://127.0.0.1:8099/`.

Para ver os questionários sem criar contas, a página de avaliação aceita a idade
e o momento como parâmetros, e nessa modalidade **não grava nada**:

```
area-doente/prom.html?demo=2&momento=3m      → bebé, bateria dos 0-4
area-doente/prom.html?demo=7&momento=12m     → bateria dos 5-10
area-doente/prom.html?demo=9&momento=12m     → 5-10 já com PSQ e SCQ (≥ 8 anos)
area-doente/prom.html?demo=14&momento=12m    → autopreenchimento, 11-17
```

Momentos possíveis: `alta`, `2s`, `3m`, `12m`, `anual`.

---

## O que é diferente da versão de adultos

A lista completa, com a fundamentação, está em
[GUIA-BACKEND.md](GUIA-BACKEND.md), secção *"O que é diferente nesta versão, e
porquê"*. Em resumo:

| | Adultos | Lumi |
|---|---|---|
| Instrumentos | BSHS-B, POSAS, 5-D Itch, EQ-5D-5L, PHQ-9 | BOQ (0-5 / 5-18 / 11-18), FLACC, FPS-R, Itch Man, POSAS 3.0, PSQ, SCQ, CRIES-8, EQ-5D-Y |
| Quem responde | o próprio | muda com a idade: cuidador até aos 4, misto dos 5 aos 10, próprio dos 11 aos 17 |
| Mascote | não tem | seis figuras — até aos 3, 3-6, 6-8, 8-10, 10-15, 15-18 |
| Rastreio na alta | BURN-OP (23 itens, limiar 46) | revisão de sistemas pediátrica, **sem pontuação** |
| Idade na matriz de risco | pesa acima dos 50 e dos 65 anos | pesa abaixo dos 2 e dos 5; adolescência pesa no eixo psicossocial |
| Contexto social | vive sozinho, regresso ao trabalho | adultos disponíveis para os cuidados, angústia do cuidador, sinalização a CPCJ, regresso à escola |
| Fim do seguimento | 12 meses | revisão anual até à maturidade esquelética |

As duas referências que sustentam estas escolhas:

- Griffiths C, Armstrong-James L, White P, Rumsey N, Pleat J, Harcourt D.
  *A systematic review of patient reported outcome measures (PROMs) used in
  child and adolescent burn research.* Burns 2015;41:212-24.
- Spronk I, van Uden D, Lansdorp CA, et al.
  *Development of a value-based healthcare burns core set for adult burn care.*
  Burns 2024;50:1925-34.

---

## Limitações assumidas

- **Nenhum dos instrumentos tem validação linguística para português europeu.**
  Foram desenvolvidos e validados em inglês americano. A tradução aqui usada é
  de trabalho.
- **Vários estão em versão reduzida**, assinalada instrumento a instrumento no
  campo `reduzido` de `assets/js/proms-pediatricos.js`, e visível à família em
  cada questionário. Uma versão reduzida não é o instrumento: serve para
  acompanhar a trajetória e disparar alertas, não para publicar resultados nem
  para comparar com normas.
- **Os limiares de alerta são locais e provisórios** (`LIMIARES_ALERTA`, em
  `assets/js/main.js`). Só os de dor têm fundamentação externa; os restantes
  estão acima de metade do máximo de cada instrumento, à espera de calibração no
  piloto.
- **A matriz de prioridade não é um instrumento validado.** Em adultos podia ser
  confrontada com o BURN-OP; em pediatria não há equivalente publicado, o que a
  torna mais necessária e mais provisória ao mesmo tempo.
- **A base de dados é, por omissão, a mesma da plataforma de adultos.** Para um
  piloto clínico tem de ser separada — ver a primeira secção do
  [GUIA-BACKEND.md](GUIA-BACKEND.md).

---

## Estrutura

```
index.html                      página de entrada e login
area-doente/                    o lado da criança e de quem cuida
  prom.html                     a avaliação, montada a partir da bateria da idade
  dashboard.html                a jornada, com a Lumi
area-profissional/              o portal clínico
  formulario-alta.html          as 9 secções da avaliação de alta
  agenda-proms.html             o que cada criança recebe, e quando
  doente.html                   ficha, gráficos e prioridade de seguimento
assets/
  js/proms-pediatricos.js       os instrumentos, por faixa etária e por momento
  js/main.js                    lógica partilhada: mascote, prioridade, alertas
  img/lumi-*.{png,jpg}          marca e mascote
database/                       esquema e migrações (correr por ordem numérica)
  021_lumi_pediatria.sql        o que torna esta base de dados pediátrica
supabase/functions/             envio de email (Edge Functions)
_marca/                         os JPEG originais da marca, antes de tratados
```

## A marca

O logótipo e as duas figuras da mascote vieram como JPEG, em `_marca/`. O que o
site usa são versões tratadas:

- `assets/img/lumi-lockup.png` — o logótipo com o fundo branco tornado
  transparente, mantendo o interior branco das letras, para poder assentar sobre
  o azul-noite.
- `assets/img/lumi-{ate-3,3-6,6-8,8-10,10-15,15-18}.png` — as seis idades da
  mascote, recortadas do fundo branco pelo mesmo método do logótipo (o branco
  interior — a fralda, as meias, o logótipo na t-shirt — fica intacto). Cada
  uma tem uma versão `-peq.png` para a fila das seis na página inicial.
- `assets/img/lumi-logo-icon.png` — ícone do separador: a estrela do logótipo,
  porque "Lumi" a 32 píxeis não se lê.

A paleta sai do próprio logótipo: azul-noite `#202A45` do contorno, amarelo
`#FFD83B` da estrela, azul da t-shirt da mascote escurecido para `#1B7FA8` de
modo a poder levar texto branco.
