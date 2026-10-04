# Lumi — Guia: publicar no GitHub Pages e ligar a uma base de dados real

Este guia leva o protótipo **Lumi** de "site estático com dados fictícios" a
**site publicado, com base de dados real (Supabase) a guardar PROMs, dados de
alta, metas, exercícios e dúvidas**.

Está dividido em duas partes independentes:

- **Parte A** — publicar o site tal como está (grátis, ~10 minutos)
- **Parte B** — ligar a uma base de dados real (grátis para uma demonstração, ~1 hora)

Pode fazer só a Parte A se, para já, só quiser um link para mostrar o site.

---

## Antes de começar: base de dados partilhada ou própria?

O Lumi nasceu como réplica pediátrica da plataforma de adultos, e o ficheiro
`assets/js/supabase-config.js` veio de lá **com as credenciais do mesmo projeto
Supabase**. Nesse estado, as duas plataformas escrevem na mesma base de dados.

Isso é cómodo para uma demonstração — o Lumi funciona assim que o abre, sem
configurar nada — e é **mau para produção**, por três razões que não têm a ver
com informática:

1. Os dados são de menores, e o consentimento que os cobre é de quem exerce as
   responsabilidades parentais. Misturá-los com os de adultos num só projeto
   torna impossível responder com clareza a "quem pode aceder a quê".
2. As crianças pediátricas apareceriam na lista de doentes da plataforma de
   adultos, e vice-versa.
3. Os instrumentos são diferentes. Uma série de `NRS-dor` deixa de poder ser
   lida se, na mesma tabela, uns valores forem de adultos e outros de crianças
   de dois anos avaliadas pela FLACC.

**Para um piloto clínico, crie um projeto Supabase próprio** (Parte B, passo
B1) e substitua os dois valores em `assets/js/supabase-config.js`. É uma
alteração de duas linhas. A migração `021_lumi_pediatria.sql` foi escrita como
aditiva precisamente para que a partilha funcione durante a fase de
demonstração, sem impedir a separação depois.

---

## Parte A — Publicar no GitHub Pages

### A1. Criar conta no GitHub (se ainda não tiver)
Em [github.com](https://github.com), crie uma conta gratuita.

### A2. Criar um repositório novo
1. Clique em **New repository**
2. Nome sugerido: `lumi-uls-sao-jose`
3. Deixe "Public" selecionado (o GitHub Pages gratuito exige repositório público)
4. Não marque nenhuma opção de inicialização (README, .gitignore, licença) — vamos enviar os ficheiros que já existem
5. **Create repository**

### A3. Enviar os ficheiros do site
Duas formas, escolha a que lhe for mais fácil:

**Opção simples (sem instalar nada):** na página do repositório recém-criado,
clique em **"uploading an existing file"** e arraste **todo o conteúdo** da
pasta `LUMI/` (não a pasta em si — o `index.html` deve ficar na raiz do
repositório). Confirme o commit.

**Opção com Git instalado no computador:**
```bash
cd LUMI
git init
git add .
git commit -m "Primeira publicação do site Lumi"
git branch -M main
git remote add origin https://github.com/<o-seu-utilizador>/lumi-uls-sao-jose.git
git push -u origin main
```

### A4. Ativar o GitHub Pages
1. No repositório, vá a **Settings → Pages**
2. Em "Source", escolha o branch `main` e a pasta `/ (root)`
3. **Save**
4. Ao fim de 1–2 minutos, o site fica disponível em:
   `https://<o-seu-utilizador>.github.io/lumi-uls-sao-jose/`

**Está feito.** Já tem um link público para mostrar o protótipo — mas continua
sem guardar dados a sério. Para isso, siga a Parte B.

---

## Parte B — Ligar a uma base de dados real (Supabase)

### B1. Criar conta e projeto no Supabase
1. Em [supabase.com](https://supabase.com), crie uma conta gratuita (pode entrar
   diretamente com a conta do GitHub)
2. **New project**
3. Escolha um nome (ex. `lumi-uls-sao-jose`), uma password para a base de
   dados (guarde-a nas suas notas), e uma região — **escolha uma região da
   União Europeia** (ex. Frankfurt), para manter os dados em território
   europeu, relevante para RGPD mesmo em fase de testes
4. Aguarde 1–2 minutos enquanto o projeto é criado

### B2. Criar as tabelas da base de dados

**Num projeto novo e vazio, é um único ficheiro.**

1. No painel do projeto, vá a **SQL Editor** (barra lateral)
2. **New query**
3. Abra o ficheiro **`database/000_instalacao_completa.sql`**, copie o conteúdo
   todo e cole no editor
4. **Run**
5. No fim aparece uma tabela de verificação, com uma linha por cada coisa que
   tinha de ficar criada e a palavra `ok` à frente. Se alguma disser `FALTA`,
   alguma coisa correu mal acima.

Esse ficheiro é a concatenação, pela ordem certa, do `schema.sql` e das
dezassete migrações — mais a criação do *bucket* das fotos das metas, que de
outra forma seria um passo manual no meio da instalação. Está gerado a partir
dos ficheiros originais, que continuam todos lá: **quem já tenha uma base de
dados a meio deve correr as migrações uma a uma**, a partir da que lhe falta, e
não este ficheiro.

Duas delas merecem nota:

- **`021_lumi_pediatria.sql` é a que torna esta base de dados pediátrica.**
  Acrescenta a `proms_respostas` as colunas que dizem **quem respondeu** (a
  criança ou quem cuida), **com que bateria** e **em que momento**; acrescenta
  a `formularios_alta` os sinais da revisão de sistemas pediátrica; e
  acrescenta a `doentes` a escola e o cuidador principal. Sem ela o site
  funciona, mas grava respostas sem contexto — e uma pontuação de dor sem se
  saber se foi observada ou autorrelatada não é interpretável.

- **`005_tabelas_em_falta.sql` reconstrói o que as migrações 001 a 005 faziam.**
  Essas nunca foram commitadas — o código chama-lhes pelo nome, mas os
  ficheiros não existem. Sem esta migração faltam quatro tabelas
  (`historico_clinico`, `agendamentos`, `checkins_humor`,
  `avaliacoes_recursos`), a função do contador de acessos e a coluna
  `duvidas.contacto_telefonico`, e com elas o Histórico, os Agendamentos, o
  check-in de humor e o "foi útil?" dos recursos.

- **`023_privilegios.sql` é indispensável num projeto Supabase criado
  recentemente.** O esquema nunca concedeu privilégios nas tabelas: apoiava-se
  em os projetos Supabase antigos virem com `alter default privileges ... grant
  all on tables to anon, authenticated`. Os projetos novos já não trazem isso —
  concedem as permissões inócuas (truncar, referenciar, gatilhos) e retiram o
  acesso aos dados. Sem esta migração a instalação parece perfeita (tabelas
  criadas, RLS ligada, perfis ligados às contas) e o login falha na mesma, com
  *"Este login não tem um perfil associado na tabela 'perfis'"* — porque o site
  não consegue ler a linha que lá está. Concede a `authenticated` e a mais
  ninguém: um visitante sem sessão continua barrado antes de a RLS ser
  sequer consultada.

- **`022_colunas_em_falta.sql` corrige um buraco herdado da plataforma de
  adultos.** O Formulário de Alta escreve três campos em `doentes` — `email`,
  `genero` e `gestor_caso_id` — que existiam na base de dados de produção
  porque foram acrescentados à mão no painel, mas que não estavam em migração
  nenhuma. Numa instalação nova, sem esta migração, a avaliação de alta seria
  preenchida inteira e só rebentaria ao gravar.

### B3. Criar o espaço de armazenamento para as fotos das metas
1. Vá a **Storage** na barra lateral
2. **New bucket** → nome: `fotos-metas` → pode deixar como bucket privado (as regras abaixo tratam do acesso)
3. **Create bucket**
4. Volte ao **SQL Editor** e corra este bloco adicional (não fica incluído no
   `schema.sql` principal porque só pode ser corrido depois de o bucket existir):
   ```sql
   update storage.buckets set public = true where id = 'fotos-metas';

   create policy "utilizadores autenticados podem enviar fotos de metas"
   on storage.objects for insert
   with check (bucket_id = 'fotos-metas' and auth.role() = 'authenticated');

   create policy "utilizadores autenticados podem ver fotos de metas"
   on storage.objects for select
   using (bucket_id = 'fotos-metas' and auth.role() = 'authenticated');
   ```
   Sem este passo, o envio de fotos falha com o erro "new row violates row-level
   security policy" — as tabelas e o armazenamento de ficheiros têm sistemas de
   regras separados no Supabase.

### B4. Obter as credenciais de ligação
1. Vá a **Project Settings → API**
2. Copie o **Project URL** (algo como `https://xxxxx.supabase.co`)
3. Copie a **anon public key** (uma chave longa) — **não copie a `service_role key`**, essa é secreta e nunca deve sair do servidor

### B5. Configurar o site com as suas credenciais
1. Na pasta `assets/js/`, copie o ficheiro `supabase-config.example.js` e
   renomeie a cópia para `supabase-config.js`
2. Abra `supabase-config.js` e substitua os dois valores pelos que copiou no
   passo anterior:
   ```js
   window.LUMI_CONFIG = {
     SUPABASE_URL: "https://xxxxx.supabase.co",
     SUPABASE_ANON_KEY: "a-sua-chave-longa-aqui"
   };
   ```
3. Guarde o ficheiro

### B6. Criar as duas primeiras contas de teste (uma de profissional, uma da família)

**Atalho:** depois de criar as duas contas em **Authentication → Users → Add
user** (marcando **Auto Confirm User** nas duas, ou o login não funciona),
cole o ficheiro **`database/900_contas_iniciais.sql`** no SQL Editor e corra.
Ele liga as contas aos perfis, cria uma criança de demonstração de 9 anos com
alta há 3 meses — idade que cai na bateria dos 5-10, a mais interessante de
mostrar, por já incluir o PSQ e o SCQ — e termina com uma tabela a confirmar o
que ficou ligado a quê. Correr duas vezes não duplica nada.

O resto desta secção explica o que esse ficheiro faz, para quem preferir fazê-lo
à mão.


1. No Supabase, vá a **Authentication → Users → Add user** e crie um utilizador
   com um email e password à sua escolha (ex. `profissional@teste.pt`)
2. Volte ao **Table Editor → perfis → Insert row**, e crie uma linha associada
   a esse utilizador com `papel = profissional` e `especialidade` preenchida
3. Repita para um segundo utilizador com `papel = doente` — mas antes precisa
   de ter pelo menos um doente na tabela `doentes` (crie uma linha de teste lá
   primeiro) para poder preencher o campo `doente_id` no perfil

*(Este passo manual serve só para testar. No fluxo normal do site, é a página
"Novo Doente" que cria estes registos automaticamente através do
`lumiApi.criarDoenteEConta(...)`.)*

### B7. Ligar as páginas HTML ao Supabase
Cada página que precisa de dados reais tem de incluir, antes do
`main.js`, estas três linhas:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../assets/js/supabase-config.js"></script>
<script src="../assets/js/supabase-client.js"></script>
```

E depois usar as funções de `lumiApi` (documentadas com exemplos dentro de
`assets/js/supabase-client.js`) em vez das funções de demonstração de
`main.js`. Por exemplo, em vez de:
```js
adicionarMetaPessoal(titulo, importante);   // demonstração, não persiste
```
passa a ser:
```js
await lumiApi.adicionarMeta(doenteId, { label: titulo, importante, origem: "doente" });
```

**Nota importante:** já preparei o esquema da base de dados e todas as
funções de ligação (`lumiApi`), mas ainda não substituí o código dentro de
cada uma das 14 páginas HTML — são pontos de partida prontos a usar, não uma
migração automática. Isso é o próximo passo lógico e faz mais sentido ser
feito página a página, testando cada funcionalidade à medida que é ligada,
para garantir que tudo continua a funcionar como espera. Posso continuar a
partir daqui consigo, se quiser.

### B8. Publicar as alterações
Depois de configurar `supabase-config.js` localmente, envie as alterações
para o GitHub (repita o A3) para que o site publicado passe a usar a base de
dados real.

---

## Perguntas frequentes

**Preciso de pagar alguma coisa?**
Não, para uma demonstração ou piloto pequeno. GitHub Pages é sempre gratuito
para repositórios públicos. O Supabase tem um nível gratuito com 500 MB de
base de dados e 50 mil utilizadores autenticados por mês — mais do que
suficiente aqui. Um projeto gratuito pausa ao fim de 7 dias sem atividade
(basta abrir o painel para o reativar).

**Isto já está pronto para dados reais de doentes?**
Não. Mesmo com base de dados real, isto continua a ser um protótipo:
- Não há revisão de segurança nem auditoria formal
- O envio de códigos de ativação por SMS/email não está implementado (precisa
  de uma Supabase Edge Function ligada a um serviço de envio — feito à parte)
- Não existe um acordo de tratamento de dados (DPA) formal com o Supabase
  para dados de saúde reais
- Não há integração com o SClínico/SPMS

Para dados reais de doentes, isto teria de passar por aprovação institucional
da ULS, avaliação de RGPD/segurança, e provavelmente alojamento em
infraestrutura própria ou aprovada pela SPMS — exatamente como já tínhamos
discutido no documento de arquitetura.

**E se eu quiser guardar as fotos das metas com mais privacidade?**
O bucket `fotos-metas` está configurado como público para leitura (qualquer
pessoa com o link exato da foto consegue vê-la, mas não há uma lista pública
de todas as fotos). Para maior privacidade, seria preciso mudar para URLs
assinadas temporárias em vez de URLs públicas — uma alteração pequena em
`marcarMetaConquistada()` que faço quando quiser avançar para essa parte.

---

## Avisos por email à equipa

Sempre que um doente coloca uma dúvida ou submete uma resposta a um
questionário, a equipa pode receber um email. O envio é feito por uma Supabase
Edge Function, chamada pela própria base de dados.

**Porque não é feito no browser.** O envio de email exige uma chave secreta do
fornecedor. Se essa chave estivesse na plataforma, qualquer pessoa que a
abrisse conseguiria lê-la e enviar email em nome da Unidade. Além disso, um
aviso disparado pelo browser não sairia se o doente fechasse a página logo a
seguir a submeter. Por isso o gatilho está na base de dados.

**O que o email leva.** Apenas a indicação de que há algo novo e uma ligação
para a plataforma. Não leva o nome do doente, o número de processo, o texto da
dúvida nem resultados. O email sai para fora dos sistemas da ULS, passa por um
fornecedor externo e fica em caixas de correio que a instituição não controla —
dados de saúde não devem viajar assim.

### Passos

1. **Conta no fornecedor de email.** Basta uma conta em resend.com.

   **Não é preciso uma conta separada** para os avisos à equipa e para os
   emails ao doente. A mesma conta envia de vários endereços, e permite criar
   várias API keys. O recomendado é **uma conta, duas chaves**: uma para os
   avisos à equipa, outra para os emails ao doente. Assim, se uma for
   comprometida ou tiver de ser trocada, revoga-se só essa e o outro circuito
   continua a funcionar. Duas contas separadas também funcionam, mas obrigam a
   verificar o domínio duas vezes, a gerir dois planos e a procurar em dois
   sítios quando algo falha — sem nenhuma vantagem em troca.

   Em Resend → API Keys → Create API Key, dê-lhe um nome que se perceba
   (ex. `lumi-avisos-equipa`). A chave só é mostrada uma vez.

   **Atenção ao remetente de testes.** Enquanto não verificar um domínio, o
   Resend só deixa enviar de `onboarding@resend.dev` **e só para o endereço
   com que se registou na conta**. Qualquer outro destinatário é recusado.
   Serve para um primeiro teste, mas para a Unidade receber mesmo os avisos
   é preciso verificar um domínio em Resend → Domains e usar um remetente
   desse domínio em `EMAIL_REMETENTE`.

2. **Correr a migração.** No SQL Editor do Supabase, corra
   `database/011_notificacoes_email.sql`.

3. **Publicar a Edge Function.** Com o Supabase CLI instalado:

   ```
   supabase login
   supabase link --project-ref <id-do-projeto>
   supabase functions deploy notificar-equipa
   ```

4. **Definir as variáveis**, no painel do Supabase em
   **Edge Functions → Secrets**, ou diretamente em
   `https://supabase.com/dashboard/project/<id-do-projeto>/functions/secrets`.

   Atenção: esta página pertence à **secção** Edge Functions, e não a uma
   função em particular. Se abrir a função `notificar-equipa`, os separadores
   são Overview, Invocations, Logs, Code e Settings — não há ali nenhum
   "Secrets". Os segredos são partilhados por todas as funções do projeto,
   como se explica mais abaixo.

   - `SEGREDO_WEBHOOK` — uma frase longa à sua escolha, inventada por si
   - `URL_PLATAFORMA` — ex. `https://lizzardu.github.io/lumi-demo`

   E, para a chave e o remetente, **depende de já existirem no projeto**:

   | Situação | O que definir |
   |---|---|
   | Ainda não há nenhum email a sair do projeto | `RESEND_API_KEY` e `EMAIL_REMETENTE` |
   | Já existem, usados pelos emails ao doente | `RESEND_API_KEY_EQUIPA` e `EMAIL_REMETENTE_EQUIPA` |

   **Porquê dois nomes.** Os segredos das Edge Functions são partilhados por
   todo o projeto, e não por função: o que estiver em `RESEND_API_KEY` é visto
   por todas as funções. Se os emails ao doente já usam esse nome, esta função
   apanharia a mesma chave e — pior — o mesmo remetente, e a equipa passaria a
   receber avisos com o endereço que o doente vê.

   Por isso a função procura primeiro `RESEND_API_KEY_EQUIPA` e
   `EMAIL_REMETENTE_EQUIPA`, e só cai nos nomes partilhados se esses não
   existirem. Sem fazer nada, reutiliza o que já lá está; definindo os nomes
   com `_EQUIPA`, os dois circuitos ficam independentes e cada chave pode ser
   revogada sem afetar o outro.

   (`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são preenchidas
   automaticamente pelo Supabase.)

5. **Dizer à base de dados onde está a função.** No SQL Editor, substituindo os
   três valores — o segredo tem de ser exatamente o mesmo do passo 4:

   ```sql
   insert into integracoes_config (chave, valor) values
     ('url_notificar_equipa', 'https://<id-do-projeto>.supabase.co/functions/v1/notificar-equipa'),
     ('segredo_webhook',      '<o mesmo segredo do passo 4>'),
     ('chave_anon',           '<a chave publicável, a mesma de supabase-config.js>')
   on conflict (chave) do update set valor = excluded.valor;
   ```

   A `chave_anon` é obrigatória: o Supabase recusa qualquer chamada a uma Edge
   Function que não traga cabeçalho `Authorization`, e rejeita-a no gateway
   antes de o código da função correr. Não é um segredo — é a mesma chave
   publicável que já está no site. Quem autoriza de facto é o
   `segredo_webhook`.

   Se instalou os avisos antes de setembro de 2026, corra também
   `database/012_corrige_chamada_edge_function.sql`: a primeira versão do
   gatilho não enviava esse cabeçalho e as chamadas eram recusadas em
   silêncio.

6. **Indicar quem recebe.** Na plataforma, em Definições → Avisos por email,
   acrescente o endereço da Unidade e escolha que avisos quer ligados.

### Enquanto não estiver configurado

Nada rebenta. Os gatilhos verificam se `integracoes_config` está preenchida e,
se não estiver, não fazem nada. As dúvidas e as respostas continuam a ser
gravadas normalmente. A secção nas Definições diz o que falta.

Um aviso que falhe nunca impede a gravação: o gatilho apanha o erro e deixa-o
no log do Postgres como *warning*.


---

## O que é diferente nesta versão, e porquê

Esta secção existe para quem conheça a plataforma de adultos e queira saber
onde é que as duas divergem — e, sobretudo, **porque é que divergem**. As
decisões clínicas estão documentadas no código, nos sítios indicados.

### Os instrumentos não são os mesmos
`assets/js/proms-pediatricos.js`

A plataforma de adultos usa BSHS-B, POSAS, 5-D Itch, EQ-5D-5L e PHQ-9. Nenhum
destes foi validado em crianças queimadas. A revisão sistemática de Griffiths e
colegas (*Burns* 2015;41:212-24) percorreu 6250 artigos e encontrou 32
instrumentos usados em investigação de queimaduras pediátricas; destes, apenas
**três** tinham evidência psicométrica obtida nesta população — o PSQ e o SCQ
(estigma percebido e conforto social, 8 aos 18 anos) e o Burn Outcomes
Questionnaire da American Burn Association / Shriners (o único específico de
queimados, com versões de 0-5, 5-18 e 11-18 anos).

São esses que estão aqui, com as escalas de dor e de prurido desenhadas para
crianças (FLACC, FPS-R, Itch Man) e com os instrumentos genéricos pediátricos
(EQ-5D-Y, CRIES-8). Os resultados medidos continuam a ser os do núcleo de valor
em queimados (Spronk e colegas, *Burns* 2024;50:1925-34), com uma troca: onde
os adultos têm o regresso ao trabalho, as crianças têm o regresso à escola.

**Limitação assumida:** nenhum destes instrumentos tem validação linguística
publicada para português europeu, e vários estão implementados em versão
reduzida (assinalada instrumento a instrumento no campo `reduzido`). Servem
para acompanhar a trajetória e disparar alertas. Não servem para publicar
resultados nem para comparar com normas.

### As perguntas mudam com a idade
`assets/js/proms-pediatricos.js` · `area-doente/prom.html`

Três baterias: **0-4** (responde sempre quem cuida), **5-10** (a criança
responde às caras, quem cuida responde ao resto) e **11-17**
(autopreenchimento). Os cortes não são arbitrários — são onde os instrumentos
mudam: aos 5 anos muda a versão do BOQ, aos 8 começa a validação pediátrica do
PSQ e do SCQ, aos 11 começa o autopreenchimento do BOQ.

Dentro de cada faixa, o que é pedido muda com o momento do seguimento. Às duas
semanas pergunta-se dor, prurido e sono, que é quando estão no pico; o estigma
percebido só aos 12 meses. A página `area-profissional/agenda-proms.html`
mostra, para cada criança, o que vai receber em cada momento **com a idade que
terá nessa altura**.

Para ver qualquer bateria sem criar contas:
`area-doente/prom.html?demo=7&momento=12m` (a idade e o momento são
parâmetros). Nessa modalidade nada é gravado.

### A mascote tem seis idades
`assets/js/main.js`, `FIGURAS_LUMI`

O Lumi cresce com quem o vê: até aos 3, dos 3 aos 6, dos 6 aos 8, dos 8 aos 10,
dos 10 aos 15 e dos 15 aos 18. Um jovem de catorze anos que abre a plataforma e
encontra um bebé de fralda percebe de imediato que aquilo não é para ele — e
deixa de ler o resto.

São cortes de **imagem**, não de instrumento, e por isso não coincidem com os
das baterias: acompanham o que muda na vida da criança (a chucha sai antes dos
3, a escola entra aos 6, a autonomia entra na pré-adolescência), não o que muda
na validação dos questionários. Nos limites a faixa de baixo fecha e a de cima
abre — quem faz 6 anos passa nesse dia da figura do infantário para a da
escola. Sem data de nascimento fica a figura dos 8-10, a do meio da idade
pediátrica.

### A matriz de prioridade inverte a idade
`assets/js/main.js`, `PESOS_PRIORIDADE`

Na versão de adultos somavam-se pontos acima dos 50 e dos 65 anos. Aqui o risco
está no extremo oposto: abaixo dos dois anos a pele é mais fina, a criança não
descreve o que sente, e a cicatriz vai acompanhar anos de crescimento. A
adolescência entra pelo outro eixo, o psicossocial.

Saíram "vive sozinho" e "regresso ao trabalho", que não querem dizer nada numa
criança. Entraram o número de adultos capazes de assegurar os cuidados em casa,
a angústia de quem cuida (o preditor mais consistente do ajustamento
psicológico da criança), a sinalização a CPCJ ou a núcleo de apoio a crianças
em risco, e o regresso à escola.

### O BURN-OP não foi transposto
`assets/js/main.js`, `ITENS_REVISAO_PED`

O BURN-OP (Bhattacharya e colegas, *Burns* 2024) pergunta por varizes, cancro
da pele, consumo de álcool e de substâncias, e se o doente "alguma vez esteve
grávida ou foi pai de uma criança" — este último com o peso máximo. Numa
criança metade dos itens não pode ser positivo, e um limiar calibrado numa
coorte de adultos deixa de ser um limiar.

Em vez dele, o quadro 9 do Formulário de Alta tem uma **revisão de sistemas
pediátrica**, organizada pelas sequelas que o seguimento a longo prazo procura:
a cicatriz que repuxa com o crescimento, o sono, o comportamento, a regressão
de aquisições e o regresso à escola. **Não tem pontuação**, porque não há
limiar publicado para esta lista. A equipa vê quantos sinais ficaram positivos
e, sobretudo, de que grupo são.

### O seguimento não encerra aos 12 meses
`assets/js/main.js`, `CADENCIAS_SEGUIMENTO`

Uma cicatriz que atravessa uma articulação acompanha o crescimento, e o momento
em que volta a limitar costuma ser um estirão — não uma consulta marcada. Todas
as cadências continuam com revisão anual, e a alta do acompanhamento tem de a
dispensar explicitamente.

---

## Nota sobre os segredos das Edge Functions

As funções em `supabase/functions/` procuram os segredos por várias ordens de
preferência, incluindo nomes com o prefixo `FENIX_`
(`FENIX_RESEND_API_KEY`, `FENIX_EMAIL_REMETENTE`, `FENIX_URL_PLATAFORMA`,
`FENIX_SEGREDO_WEBHOOK`). **Esses nomes foram deixados como estão de
propósito**: são os nomes com que os segredos já estão guardados no projeto
Supabase, e renomeá-los no código partiria o envio de email sem avisar. Se
criar um projeto Supabase próprio para o Lumi, pode usar os nomes canónicos
(`RESEND_API_KEY_DOENTE`, `EMAIL_REMETENTE_DOENTE`, `URL_PLATAFORMA`,
`SEGREDO_WEBHOOK`), que são os primeiros a ser procurados.
