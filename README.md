# Casa Luckham · Sistema de Lyendell

Sistema de administração da cidade de Lyendell: Tabelionato, Guarda do Coelho, Galeria,
Mural de Anúncios, Mural de Atividades e Recreação, com login por nome de personagem e níveis de acesso.

## Como rodar

Precisa do Node.js 20 ou mais novo.

```bash
npm install
npm start
```

Abra http://localhost:3000 e entre com o administrador definido no arquivo `.env`
(`ROOT_NOME` e `ROOT_SENHA`). Esse administrador é criado só na primeira vez que o sistema
roda; depois a senha pode ser trocada em "Meu perfil".

Para desenvolver com recarga automática: `npm run dev`.

## Níveis de acesso

Todo usuário é morador. Os cargos somam poderes em cima disso, e uma pessoa pode ter mais de um.

| Cargo | O que pode |
|---|---|
| Administrador (Evran) | Tudo, inclusive criar usuários e criar ou editar cargos |
| Família Nobre | Tudo, menos criar usuários e mexer nos cargos |
| Tabeliã | Tudo no Tabelionato: aprovar registros, editar, apagar, criar livros, seções, campos e opções, e marcar pagamentos |
| Escriba | Fazer registros no Tabelionato, que vão para a aprovação da Tabeliã |
| Comandante da Guarda | Tudo na Guarda do Coelho, inclusive aprovar os registros dos guardas |
| Guarda | Ver a Guarda e registrar prisioneiros, que vão para a aprovação do Comandante |
| Morador | Ver tudo, ajudar nas atividades e usar a Recreação |

Quem está acima de morador também publica anúncios, cria atividades e envia fotos.

O administrador pode mudar o que cada cargo faz, ou criar cargos novos, na tela **Cargos**.
Ninguém consegue conceder a outra pessoa um poder que não tem: por isso a Família Nobre
não consegue, por exemplo, dar a si mesma o poder de criar usuários.

## Livros (Tabelionato e Guarda)

Cada módulo tem livros de registro, e cada livro tem o próprio formulário. Quem comanda
o módulo pode, pelo próprio site:

- criar livros novos (ex.: Registro de Nascimentos);
- adicionar, renomear, reordenar e remover campos (texto, data, número, lista de opções, sim ou não, imagem);
- dividir o formulário em seções;
- editar as opções das listas;
- deixar um livro **restrito**: só quem comanda o módulo registra nele (ex.: Guardas da Capital);
- ligar **pagamentos periódicos** num livro do Tabelionato (veja abaixo).

## Aprovação de registros

O que o Escriba registra no Tabelionato fica **aguardando a Tabeliã**; o que o Guarda registra na
Guarda do Coelho fica **aguardando o Comandante**. As duas filas são separadas. Enquanto não é
aprovado, o registro não aparece no livro oficial.

- Quem aprova vê a aba **Aguardando aprovação** (e um número no menu) e pode aprovar, editar ou recusar com um motivo.
- Quem enviou vê a aba **Meus envios**: pode corrigir ou cancelar enquanto não foi aprovado, e os recusados mostram o motivo e podem ser corrigidos e reenviados.
- Registros de quem já tem a permissão de aprovar (Tabeliã, Comandante, Família Nobre, administrador) entram aprovados direto.

## Pagamentos dos comerciantes

O Registro de Comerciantes já vem com pagamento **a cada 14 dias**, contado a partir da
**Data de abertura** de cada comerciante. Quem abriu em 28/09/2026 paga em 12/10, 26/10 e assim por diante.

- A tabela do livro mostra, para cada comerciante, se está em dia (e quando é o próximo) ou quantas parcelas estão atrasadas. Dá para filtrar por "Com atraso".
- Clicando nisso abre a checklist de parcelas: período, vencimento, situação e observação.
- Só quem tem a permissão **Marcar pagamentos** (a Tabeliã, e a Família Nobre, que pode tudo) marca como paga, e sempre com uma **observação** dizendo como foi pago (ex.: "Lírios: 30" ou "Itens: 2 pacotes de trigo").
- Quando um comércio fecha, a Tabeliã usa **Encerrar cobrança** para ele parar de acumular parcelas.
- O intervalo (14 dias) e o campo de data se mudam em **Configurar livro**, e qualquer outro livro do Tabelionato pode ganhar pagamentos (ex.: aluguel de propriedades).

## Livros do Minecraft (.book)

Tudo que é registrado tem um botão **Baixar .book**: cada registro do Tabelionato e da Guarda,
o livro inteiro (com os filtros aplicados), cada anúncio, cada atividade (com quem ajudou e
quanto cada um recebe) e a tabela de pagamentos de um comerciante.

O arquivo é o mesmo formato que o mod **Scribble** salva. Para usar no jogo:

1. coloque o `.book` na pasta `books` do perfil do Minecraft (no Modrinth: `ModrinthApp\profiles\<perfil>\books`);
2. no jogo, abra um livro e pena e use o botão do Scribble para carregar um livro salvo.

As fichas de **Moradores**, **Nobres** e **Outros** saem exatamente no modelo feito pela Casa no
jogo: capa com o cabeçalho do Tabelionato (verde, dourado e azul, nessa ordem), o número do
registro com 4 dígitos e o nome entre os coelhos; depois os campos do modelo (Nickname, Nome,
Idade, Cargo, Residência, Estado Civil e Profissão; no Outros: Nickname, Idade, Gênero, Estado
civil, Endereço, família e cargo na família), cada valor na linha logo abaixo do rótulo, e no fim
quem registrou e quando. Uma ficha em branco sai igual, byte por byte, ao arquivo modelo.
Os campos são achados pelo nome no formulário, então o Tabelionato pode ter outros campos além
desses (eles só não entram no livro).

Os outros livros (Comerciantes, Casamentos, Prisioneiros...) seguem o mesmo desenho, com os
próprios campos. O livro inteiro junta as fichas uma atrás da outra, até 100 páginas. Se um valor
for comprido demais, o que não cabe passa para a página seguinte.

Anúncios, atividades e pagamentos continuam no estilo antigo (moldura e cabeçalhos com ✦).

## Mural de Atividades

Alguém cria uma atividade com o item e a meta (ex.: 960 batatas, que o sistema mostra como
15 pacotes). Cada pessoa clica em **Quero ajudar**, diz quanto pretende entregar e registra
as entregas conforme vai trazendo. A atividade mostra o progresso (ex.: 200 / 960), quem entregou
quanto e a porcentagem de cada um. Se houver recompensa, ela é dividida proporcionalmente.

Quem criou a atividade (ou quem gerencia atividades) **confere** as entregas, para ninguém
marcar batata que não entregou. A atividade fecha sozinha quando bate a meta.

## Recreação

Um salão com **chat ao vivo**, a lista de quem está online e os jogos:

- **Quiz de Lyendell**, ao vivo, até 10 pessoas: perguntas de A a D sobre a Família Luckham,
  coelhos, Minecraft e regras de RP (metagaming, powergaming, anti-RP, flaming...). Quem abre a
  sala escolhe as categorias e o tamanho (5, 10 ou 15 perguntas) e começa quando quiser.
  Cada pergunta tem 20 segundos; acertar vale de 500 a 1000 pontos (quanto mais rápido, mais).
  Sozinho vale como treino. No fim aparece o pódio, e quem abriu pode começar outra rodada.
- **Jogo da Velha** e **Pedra, Papel e Tesoura** (melhor de três), ao vivo contra outro morador.
  Quem abre a partida espera alguém clicar em **Entrar**; os outros podem **Assistir**.
  No fim dá para pedir revanche (quem não começou, começa).
- **Pac-Coelho**: o coelho da Casa come os Lírios do labirinto e foge de quatro raposas
  (Rubra, Ártica, Cinzenta e Fenec, cada uma caça de um jeito). O Lírio grande deixa as raposas
  com medo; a cenoura é o bônus. Vida extra aos 10.000 pontos.
- **Cobrinha**, comendo cenouras (setas, W A S D, ou deslizando o dedo no celular).
- **Quebra-cabeça** com as fotos da Galeria, em 3x3, 4x4 ou 5x5.

As perguntas do quiz ficam no banco: quem tem o poder "Criar e editar as perguntas do quiz"
(a Família Nobre, e o administrador) corrige, apaga e cria perguntas no botão **Perguntas**
do cartão do quiz. O sistema já vem com umas 115 perguntas.

Cada jogo tem ranking: vitórias e acertos no quiz, vitórias nos jogos de dois, pontos no
Pac-Coelho, cenouras na cobrinha e o menor tempo no quebra-cabeça. Quem sai de uma partida no
meio perde (no quiz, fica fora do resultado); quem cai da internet tem 30 segundos para voltar. A Família Nobre (e quem tiver o poder "Apagar mensagens de outros no chat") pode
apagar mensagens impróprias; cada um pode apagar as suas.

Dá para **assistir qualquer jogo**: as partidas ao vivo (quiz, velha, pedra, papel e tesoura) e
também quem está jogando sozinho. Quem abre o Pac-Coelho, a Cobrinha ou o Quebra-cabeça aparece
em **Jogando agora**, no salão; clicando em Assistir, dá para ver o jogo ao vivo, com o chat do
lado. Quem joga vê quantas pessoas estão assistindo.

O chat guarda as últimas 2000 mensagens. As partidas em andamento ficam só na memória do
servidor: se o site reiniciar (por exemplo, depois de um `git push`), elas se perdem, mas o
chat, os resultados e os recordes ficam salvos.

## Perfil e Comunidade

Em **Meu perfil** cada pessoa escolhe a foto (ou a cabeça da skin do Minecraft, pelo nick), a
capa (8 prontas ou uma imagem própria), a cor de destaque (aparece no perfil e no nome no chat),
a moldura da foto, uma frase, o "sobre mim" e até 3 conquistas para mostrar em destaque.

A **Comunidade** mostra todo mundo, com quem está online e quem está jogando. O perfil público
de cada um tem nível, sequência de dias, números da Recreação, conquistas e um **mural de
recados**. Quem escreveu, o dono do perfil e a moderação apagam recados.

## Níveis, missões e conquistas

Para incentivar a visita de todo dia:

- **XP e níveis**: conversar no chat, jogar, ganhar partidas, acertar no quiz, ter entregas
  conferidas nas atividades, publicar anúncios, enviar fotos, registrar e deixar recados dão XP
  (com um limite por dia, para ninguém ganhar XP mandando mensagem à toa). Cada nível tem um título
  de coelho (Filhote, Láparo, Coelho do Campo... até Coelho Coroado) e libera molduras novas
  (bronze no 5, prata no 10, ouro no 15, esmeralda no 20 e coroa no 25).
- **Sequência de dias**: entrar todo dia aumenta a sequência e o XP da visita.
- **Missões do dia**: três por dia, as mesmas para todo mundo, que renovam à meia-noite.
- **Conquistas**: 24 no total (Tagarela, Sábio da Toca, Terror das Raposas, Braço forte...).

Conquistas, missões cumpridas, nível novo e recado novo aparecem na hora, em qualquer tela.
A tela de início mostra o progresso, as missões, as conquistas recentes e os mais ativos da semana.

## Trilha sonora

Um player pequeno no canto da tela toca a trilha enquanto a pessoa navega pelo site (a música não
para ao trocar de tela). Ele tem tocar/pausar, anterior, próxima, ordem aleatória, volume e a barra
para avançar; a setinha recolhe o player numa bolinha (no celular ele já começa recolhido).

Nos **três pontinhos** fica a lista de músicas (clique para tocar). Quem tem o poder "Adicionar e
tirar músicas da trilha sonora" (a Família Nobre e o administrador) também vê ali:

- **Adicionar música**: escolhe um ou vários arquivos (MP3, OGG, M4A ou WEBM, até 8 MB cada). O
  título vem do nome do arquivo (`Taverna_do_Coelho.mp3` vira "Taverna do Coelho");
- a **lixeira** em cada música, que tira a música da trilha e apaga o arquivo do site.

As músicas ficam guardadas no próprio site: tocam inteiras para todo mundo, de graça, sem anúncio e
sem conta em lugar nenhum. Música medieval grátis para baixar: Kevin MacLeod (incompetech.com, pede
crédito), OpenGameArt (muitas em domínio público) e Pixabay Music.

## Onde ficam os dados

Tudo fica num banco SQLite, inclusive as imagens (que o site diminui antes de enviar):

- **na internet:** no [Turso](https://turso.tech), definido por `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`;
- **no computador**, sem essas variáveis: no arquivo `data/lyendell.db`.

As imagens só abrem para quem está logado.

## Colocar na internet (grátis)

São três serviços grátis, sem cartão:

| Serviço | Para quê |
|---|---|
| [Turso](https://turso.tech) | Banco de dados e imagens (5 GB grátis) |
| [Render](https://render.com) | Roda o site (plano Free) |
| [cron-job.org](https://cron-job.org) | Visita o site a cada 10 minutos para ele não "dormir" |

1. **Turso:** crie um banco na região *AWS US East (Virginia)*. Anote a URL (`libsql://...turso.io`) e gere um token.
2. **GitHub:** o código precisa estar num repositório (pode ser privado).
3. **Render:** New > Blueprint > escolha o repositório. O `render.yaml` já configura tudo; o Render
   pede `ROOT_SENHA`, `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`. O site fica em `https://casa-luckham.onrender.com`
   (ou parecido).
4. **cron-job.org:** crie uma tarefa que acessa `https://SEU-SITE.onrender.com/api/saude` a cada 10 minutos.

Sem o passo 4 funciona igual, mas depois de 15 minutos sem ninguém entrar o Render desliga o site,
e a próxima pessoa espera cerca de 1 minuto até ele ligar de novo.

Cada `git push` para o GitHub atualiza o site sozinho.

O administrador é criado na primeira vez que o site sobe, com a senha de `ROOT_SENHA`.
Depois dá para apagar essa variável no Render e trocar a senha em "Meu perfil".

## Personalizar

- Brasão: `public/img/brasao.png` e `public/img/favicon.png`.
- Cores e fontes: `public/css/estilo.css` (variáveis no topo).
- Livros e cargos que vêm prontos na primeira execução: `src/livros-padrao.js` e `src/permissoes.js`.
