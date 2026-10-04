# Casa Luckham · Sistema de Lyendell

Sistema de administração da cidade de Lyendell: Tabelionato, Guarda do Coelho, Hospital, Congresso,
Galeria, Mural de Anúncios, Mural de Atividades e Recreação, com login por nome de personagem e níveis de acesso.

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
| Família Nobre | Tudo, menos criar usuários e mexer nos cargos (e as pegadinhas, que são só do Bobo) |
| Tabeliã | Tudo no Tabelionato: aprovar registros, editar, apagar, criar livros, seções, campos e opções, e marcar pagamentos |
| Escriba | Fazer registros no Tabelionato, que vão para a aprovação da Tabeliã |
| Comandante da Guarda | Tudo na Guarda do Coelho, inclusive aprovar os registros dos guardas |
| Guarda | Ver todos os livros da Guarda e registrar em qualquer um deles; os registros vão para a aprovação do Comandante |
| Diretor do Hospital | Tudo no Hospital, inclusive aprovar os registros dos médicos |
| Médico | Ver o Hospital e registrar pacientes, que vão para a aprovação do Diretor do Hospital |
| Senadora | Tudo no Congresso: publica as PECs, leis e regras votadas, aprova o que outros enviarem e avalia as propostas do povo |
| Lorde Comandante | Faz as Leis de Lyendell junto com a Família Nobre: escreve, publica, edita e revoga |
| Bobo da Corte | A Caixa de Pegadinhas, só dele: prega peças no pessoal e conta piadas na praça (veja "Bobo da Corte") |
| Morador | Ver tudo (menos o Hospital), ajudar nas atividades, usar a Recreação e mandar propostas ao Congresso |

Qualquer usuário pode ser marcado como **criança** (veja "Personagem criança" mais abaixo): mesmo com cargo, só olha, brinca e ajuda.

O Hospital não é aberto a todos os moradores, porque guarda o prontuário dos pacientes: só o
Diretor, os Médicos, a Família Nobre e o administrador veem. Para abrir a todos, marque
"Ver os livros e registros" do Hospital no cargo Morador, na tela **Cargos**.

Quem está acima de morador também publica anúncios, cria atividades e envia fotos.

O administrador pode mudar o que cada cargo faz, ou criar cargos novos, na tela **Cargos**.
Ninguém consegue conceder a outra pessoa um poder que não tem: por isso a Família Nobre
não consegue, por exemplo, dar a si mesma o poder de criar usuários.

## Livros (Tabelionato, Guarda, Hospital, Congresso e Leis de Lyendell)

Cada módulo tem livros de registro, e cada livro tem o próprio formulário. Quem comanda
o módulo pode, pelo próprio site:

- criar livros novos (ex.: Registro de Nascimentos);
- adicionar, renomear, reordenar e remover campos (texto, data, número, lista de opções, sim ou não, imagem);
- dividir o formulário em seções;
- editar as opções das listas;
- deixar um livro **restrito**: só quem comanda o módulo registra nele (os livros padrão vêm todos abertos);
- ligar **pagamentos periódicos** num livro do Tabelionato (veja abaixo).

Livros que já vêm prontos:

- **Hospital**: Registro de Pacientes (motivo, gravidade, diagnóstico, tratamento, situação, alta
  e os médicos responsáveis, escolhidos da Equipe) e Equipe do Hospital.
- **Congresso**: Leis e Mudanças (título, tipo: PEC, lei, regra, emenda, decreto..., data da
  votação, resultado, o que muda, texto completo, votos e situação). As últimas publicações
  aparecem para todo mundo na tela de início, em **Novidades do Congresso**.
  O Congresso também tem as **Propostas do povo** (veja abaixo).
- **Leis de Lyendell**: as leis da capital (título, tipo: lei, decreto, edital, proibição, imposto...,
  data, quem fez, o que diz, a pena para quem descumprir e a situação). Só o Lorde Comandante e a
  Família Nobre escrevem, e publicam direto, sem aprovação. As novas aparecem na tela de início, em
  **Novas Leis de Lyendell**.

**Como cada um vê as leis.** O menu **Leis de Lyendell** abre a leitura, igual para todo mundo: as
leis arrumadas como um código, separadas por tipo (Leis, Decretos, Proibições, Impostos...), com um
índice ao lado, busca (sem precisar de acento), filtro por tipo, a pena em destaque e o selo "Nova"
nas da última semana. Lei comprida começa recolhida ("Ler a lei inteira"), as suspensas aparecem
marcadas e as revogadas ficam guardadas no fim, para consulta. Cada lei tem "Copiar link" e
"Baixar .book", e o livro inteiro (só as que valem) também sai em .book.

Quem escreve as leis (Lorde Comandante e Família Nobre) vê ainda o botão **Escrever e editar leis**,
que abre os livros como nos outros módulos (em `#/leis/livros`): lá se escreve, edita, revoga e se
criam outros livros de regras. Cada livro novo vira uma aba na leitura, e a leitura acha sozinha o
título, o tipo, o texto, a pena e as datas pelos nomes dos campos.

## Personagem criança

Ao criar ou editar um usuário, o administrador pode ligar **Personagem criança**. A criança pode ter
qualquer cargo (até Família Nobre, e o cargo continua aparecendo), mas só fica com o que uma criança
faria:

- **pode**: olhar tudo o que o cargo deixa ver (os livros, o mapa, as leis, a galeria, os anúncios),
  brincar e conversar na Recreação, ajudar nas atividades, arrumar o próprio perfil e deixar recados;
- **não pode**: registrar, editar, apagar, aprovar, publicar anúncios, enviar fotos, mexer no mapa,
  moderar o chat ou ver a administração. O servidor bloqueia de verdade (não é só esconder botão), e
  qualquer porta fechada responde "Isso é coisa de gente grande!".

E o site aparece para ela **do jeito de uma criança**:

- céu de noite estrelado com lua, letra de caderno, cantos redondos e cores de giz de cera;
- os lugares com nome de criança: Minha toca (início), O mapa do tesouro, A casa dos livros
  gigantes (Tabelionato), Os soldados de armadura (Guarda), Onde cuidam dos dodóis (Hospital), A casa
  do falatório (Congresso), As regras dos grandes (Leis), Hora de brincar! (Recreação), As
  figurinhas (Galeria), Ajudar os grandes (Atividades)...;
- cada tela explica o lugar como uma criança entende ("Os grandes entram lá, falam, falam, falam...");
- na toca, o coelho da Casa fala com ela, tem portas grandes para os lugares, as "aventuras de hoje"
  (as missões) e uma curiosidade do dia;
- os livros ganham nomes de criança ("O livro dos casamentos (eca, beijo!)", "Quem está de castigo
  na torre") e avisam que "dá para olhar tudinho, mas não pode rabiscar";
- no mapa, cada prédio tem "o que eu acho" do lugar ("Onde guardam as moedinhas. Será que dá para
  pegar uma?").

**Palavrão some para a criança.** No chat da Recreação, no chat do Lyendell Dorme e nos recados do perfil,
cada palavrão ou xingamento chega para a criança trocado por uma palavra de criança ("Que porra é essa?"
vira algo como "Que batatinha é essa?"), e o mesmo palavrão vira sempre a mesma palavra. Os adultos
continuam vendo a mensagem como foi escrita. O filtro acha a palavra mesmo disfarçada (p0rr4,
caraaaalho, maiúscula, sem acento) e deixa em paz as palavras inocentes do RP (burro e veado, os bichos;
lixo; trouxa...). A troca é feita no servidor: a palavra feia nem chega ao navegador da criança. A lista
fica em `src/censura.js`.

Para os outros, o perfil e a comunidade mostram a etiqueta "Criança". Os textos de criança ficam em
`public/js/crianca.js`.

## Juramento da Casa Luckham

A aba **Juramento** (no menu da Cidade) mostra o juramento que se repete diante da bandeira para se
tornar morador da Capital, num pergaminho com o brasão, e logo abaixo **os que juraram**, na ordem em
que juraram, com a foto do registro, o endereço (nick) e a data.

Só **Moradores e Nobres** fazem o juramento: quem está no Registro de Outros nunca jura (é de outra
casa ou presta serviço à Capital). Quem tem registro aprovado de Morador ou de Nobre já conta como
quem jurou; a **Família Nobre e a Tabeliã** (permissão "Marcar quem já fez o Juramento") têm o botão
**Colocar ou retirar**, que abre uma telinha: em cima, colocar na lista procurando pelo nome ou endereço
(os Moradores e Nobres do Tabelionato que estão fora da lista); embaixo, a tabela de quem está na
lista, com o botão Retirar em cada linha. A data do juramento é a "Data de chegada" do registro; sem ela,
o dia em que foi marcado que jurou, ou o dia em que o registro foi aprovado. Dá para filtrar por
Moradores e Nobres, procurar pelo nome ou pelo endereço, e clicar no nome abre o registro. Registro
que ainda espera a Tabeliã não entra na lista.

Os botões **Copiar** (o juramento em texto, para colar no chat do jogo ou no Discord), **Baixar .book**
(o juramento como livro do Minecraft, para ler diante da bandeira) e **Lista em .book** (todos que
juraram, num livro) ficam na própria página.

## Propostas do povo (Congresso)

Na aba **Propostas do povo** do Congresso, qualquer morador manda uma ideia para a cidade: lei, PEC,
emenda, regra, decreto, resolução ou outra, com o título, o que muda, o texto completo (se quiser) e
por que é uma boa ideia, sem limite de tamanho (cabe uma lei inteira, artigo por artigo; no cartão aparece o
começo e um "Ler tudo"). Dá para ter até 3 propostas esperando ao mesmo tempo, corrigir enquanto não
foram avaliadas e retirar. Os outros moradores podem **apoiar** as propostas, para a Senadora ver
quais o povo mais quer.

1. **A Senadora avalia**: **viável** vai para a pauta do Congresso (com um recado opcional);
   **inviável** volta com o motivo, que todos leem. Ela pode reconsiderar uma inviável.
2. **O Congresso vota** (na sessão do RP): ela registra o resultado, **aprovada**, **rejeitada** ou
   **adiada** (continua na pauta), com a data e os votos a favor, contra e abstenções.
3. **A aprovada vira lei**: o botão "Publicar no livro do Congresso" abre o formulário do livro Leis
   e Mudanças já preenchido com a proposta, e a proposta ganha o link para o registro.

Quem propôs é avisado na hora a cada passo, e a Senadora é avisada quando chega proposta nova (o
menu do Congresso mostra quantas esperam). Cada proposta guarda o andamento (quem fez o quê e quando).
Qualquer um baixa cada proposta como **livro (.book)** no modelo da Casa (capa do Congresso, a proposta, a
avaliação da Senadora e a votação), e a Senadora baixa a **pauta** inteira para ler na sessão dentro do
jogo (um livro do Minecraft vai até 100 páginas; o que passar disso fica no site). Ela também pode apagar
propostas (ex.: repetidas). A criança vê as propostas, mas não manda nem apoia. Ter uma proposta
aprovada dá a conquista **Voz do povo**.

## Aprovação de registros

**No Tabelionato, nem o administrador aprova o próprio registro**: tudo que ele registra lá fica
aguardando a Tabeliã, como o de qualquer Escriba (nos outros módulos ele continua publicando direto).


O que o Escriba registra no Tabelionato fica **aguardando a Tabeliã**; o que o Guarda registra na
Guarda do Coelho fica **aguardando o Comandante**; o que o Médico registra no Hospital fica
**aguardando o Diretor do Hospital**; o que outros enviam ao Congresso fica **aguardando a Senadora**.
Cada fila é separada. Enquanto não é aprovado, o registro não aparece no livro oficial.

- Quem aprova vê a aba **Aguardando aprovação** (e um número no menu) e pode aprovar, editar ou recusar com um motivo.
- Quem enviou vê a aba **Meus envios**: pode corrigir ou cancelar enquanto não foi aprovado, e os recusados mostram o motivo e podem ser corrigidos e reenviados.
- Registros de quem já tem a permissão de aprovar (Tabeliã, Comandante, Diretor do Hospital, Senadora, administrador) entram aprovados direto.
- Aprovar é exclusivo de um cargo por módulo: nem a Família Nobre aprova.

## Pagamentos dos comerciantes

O Registro de Comerciantes já vem com pagamento **a cada 14 dias**, contado a partir da
**Data de abertura** de cada comerciante. Quem abriu em 28/09/2026 paga em 12/10, 26/10 e assim por diante.

- A tabela do livro mostra, para cada comerciante, se está em dia (e quando é o próximo) ou quantas parcelas estão atrasadas. Dá para filtrar por "Com atraso".
- Clicando nisso abre a checklist de parcelas: período, vencimento, situação e observação.
- Só quem tem a permissão **Marcar pagamentos** (a Tabeliã, e a Família Nobre, que pode tudo) marca como paga, e sempre com uma **observação** dizendo como foi pago (ex.: "Lírios: 30" ou "Itens: 2 pacotes de trigo").
- Quando um comércio fecha, a Tabeliã usa **Encerrar cobrança** para ele parar de acumular parcelas.
- O intervalo (14 dias) e o campo de data se mudam em **Configurar livro**, e qualquer outro livro do Tabelionato pode ganhar pagamentos (ex.: aluguel de propriedades).

## Livros do Minecraft (.book)

Tudo que é registrado tem um botão **Baixar .book**: cada registro do Tabelionato, da Guarda, do
Hospital e do Congresso (cada módulo com a sua capa),
o livro inteiro (com os filtros aplicados), cada anúncio, cada atividade (com quem ajudou e
quanto cada um recebe) e a tabela de pagamentos de um comerciante.

O arquivo é o mesmo formato que o mod **Scribble** salva. Para usar no jogo:

1. coloque o `.book` na pasta `books` do perfil do Minecraft (no Modrinth: `ModrinthApp\profiles\<perfil>\books`);
2. no jogo, abra um livro e pena e use o botão do Scribble para carregar um livro salvo.

As fichas de **Moradores**, **Nobres** e **Outros** saem no modelo feito pela Casa no jogo: capa com
o cabeçalho do Tabelionato (verde, dourado e azul, nessa ordem), o número do registro com 4 dígitos e
o nome entre os coelhos; depois os campos, cada valor na linha logo abaixo do rótulo, e no fim quem
registrou e quando.

**O livro sempre segue o formulário de registro**: os mesmos campos, na mesma ordem e com os mesmos
nomes que estão no formulário do site. Campo que não existe no formulário não vai para o livro, e se a
Tabeliã criar, renomear ou mudar a ordem de um campo, o livro muda junto (as imagens ficam de fora,
porque o livro do Minecraft não mostra imagem). No RP ninguém fala "nickname": o nick do jogador é o
**Endereço** da pessoa, e a rua e o número são a **Residência**; por isso o campo do nick se chama
Endereço em todos os livros.

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
- **Lyendell Dorme** (o "Cidade Dorme" ou "Lobisomem" da Casa), de 4 a 15 pessoas: veja abaixo.
- **Cobrinha ao vivo**, de 2 a 4 pessoas (1v1, 1v1v1 ou 1v1v1v1) no mesmo tabuleiro: quem abre a sala
  começa quando tiver gente, e há uma contagem de 3 segundos. Quem bate na borda, noutra cobra ou em
  si mesma sai e o corpo vira cenouras; vence quem sobrar. Cabeça com cabeça tira as duas.
  O servidor anda 8 passos por segundo, mas a tela desenha 60: as cobras deslizam de uma casa para
  a outra, mesmo com a internet irregular, e a sua cobra vira na hora em que você aperta (o site mede
  o atraso da conexão para saber se o servidor ainda vai aplicar a virada naquele passo).
- **Jogo da Velha**, **Pedra, Papel e Tesoura** (melhor de três), **Lig 4** (quatro em linha, 7
  colunas; dá para jogar com as teclas 1 a 7) e **Damas**, ao vivo contra outro morador.
- **Damas** seguem as regras brasileiras: a pedra anda para a frente e captura para trás também; a
  captura é obrigatória e vale a lei da maioria (a sequência que pega mais peças); a dama anda e
  captura de longe; a pedra só vira dama se terminar a jogada na última fileira. Perde quem fica sem
  peça ou sem jogada; 20 lances de cada lado só com damas, sem captura, é empate. Clique na peça e
  depois nas casas por onde ela passa (as casas possíveis acendem). Cada um vê as próprias peças embaixo.
  Quem abre a partida espera alguém clicar em **Entrar**; os outros podem **Assistir**.
  No fim dá para pedir revanche (quem não começou, começa).
- **Pac-Coelho**: o coelho da Casa come os Lírios do labirinto e foge de quatro raposas
  (Rubra, Ártica, Cinzenta e Fenec, cada uma caça de um jeito). O Lírio grande deixa as raposas
  com medo; a cenoura é o bônus. Vida extra aos 10.000 pontos.
- **Cobrinha**, comendo cenouras (setas, W A S D, ou deslizando o dedo no celular).
- **Quebra-cabeça** com as fotos da Galeria, em 3x3, 4x4 ou 5x5.
- **Jogo da Memória**, em 4x4, 4x6 ou 6x6: ache os pares com o menor número de jogadas.
- **Campo Minado**, no fácil (9x9, 10 armadilhas), médio (16x16, 40) ou difícil (30x16, 99). O
  primeiro clique nunca explode; botão direito (ou segurar o dedo, ou o botão "Tocar põe bandeira" no
  celular) põe bandeira; clicar num número com as bandeiras certas em volta abre o resto. Vale o tempo.
- **2048**: deslize com as setas, W A S D ou o dedo; os blocos iguais viram um só. Vale a pontuação.
- **Barris do Raposo** (no estilo do Donkey Kong): lá do alto da torre o Raposo joga barris pelas vigas;
  o coelho sobe as escadas, pula os barris (+100) e resgata a Princesa Cenoura. Marretas quebram os
  barris por alguns segundos, as fagulhas saem do tonel de piche, e o bônus cai com o tempo. A cada
  resgate o nível fica mais rápido (e a torre muda de lado).
- **Super Coelho** (no estilo do Super Mario): quatro fases (Campos de Lyendell, Tocas Subterrâneas,
  Copas das Árvores e o Castelo do Raposo) para salvar a Princesa Cenoura. Cenoura faz crescer, Flor de
  Fogo atira, Estrela deixa invencível; Raposinhos se pisam, Tatus viram bola e Ouriços não se pisam.
- **Travessia** (no estilo do Crossy Road): pulinhos por campos, estradas de carroças, rios com troncos
  e trilhos de trem, até onde o coelho aguentar. Ficar parado demais chama o gavião. Vale a fileira mais
  longe.

Os três de fliperama (`public/js/arcade.js` com cada jogo em `public/js/jogos/`) têm som (dá para
desligar no alto-falante), botões na tela para o celular, ranking, versus e co-op ao vivo e quem assiste.

Os jogos novos (Damas, Campo Minado e 2048) são por vez ou rodam inteiros no navegador: nada fica
indo e vindo pela internet o tempo todo, então não travam mesmo com a conexão ruim.

### Versus e co-op

Cada jogo tem os modos que fazem sentido, nos botões do cartão do jogo no salão:

| Jogo | Versus | Co-op |
|---|---|---|
| Quiz | todos contra todos, ou dois times | em equipe: a sala inteira contra a meta de 60% de acertos |
| Cobrinha ao vivo | todos contra todos, ou 2 contra 2 | Colheita: juntos, comer as cenouras da meta antes do tempo (quem bate renasce) |
| Velha, Lig 4 e Damas | um contra o outro | contra a Raposa (o computador), sozinho ou em dupla, um lance cada |
| Barris, Super Coelho e Travessia | todos no mesmo mundo ao mesmo tempo, vendo os coelhos dos outros: nos Barris e no Super Coelho vence quem chegar primeiro na Princesa (3 vidas); na Travessia, quem sobrar vivo (1 vida) | o mesmo mundo, com vidas da equipe (2 + 1 por pessoa): nos Barris e no Super Coelho, quando alguém chega a fase passa para todos; na Travessia, todos precisam cruzar a linha de chegada |
| Pac-Coelho | o mesmo labirinto (o servidor roda as raposas): cada Lírio, raposa e cenoura vale para quem pegou; pego perde 10% e volta; vence quem tiver mais quando os Lírios acabarem | o mesmo labirinto com vidas da equipe (3 + 1 por pessoa); limpar tudo e todos vencem |
| 2048 | cada um no seu tabuleiro, mas juntar 64 ou mais joga pedras no tabuleiro dos outros; vence quem sobrar | todos mexem no mesmo tabuleiro até a meta (maior com mais gente) |
| Campo Minado | todos no mesmo campo: cada casa aberta fica com a cor de quem abriu e as bandeiras são de cada um; quem pisa numa armadilha está fora; vence quem abrir mais casas | todos abrem o mesmo campo; se alguém pisar numa armadilha, a equipe perde |
| Quebra-cabeça | todos na mesma imagem: peça que vai para o lugar certo fica presa e conta para quem pôs; vence quem pôs mais | todos montam a mesma imagem, trocando as peças |
| Jogo da Memória | cada um na sua vez (achou o par, joga de novo); vence quem achar mais pares | a equipe, um de cada vez, acha todos os pares sem passar da meta de jogadas |

Pedra, Papel e Tesoura continua só versus, e o Lyendell Dorme já é por times. "Jogando agora" mostra
o modo de cada sala. Ninguém joga "por pontos" separado: todos jogam juntos a mesma partida, e quanto
mais gente, mais difícil (x1,15 com 2, x1,30 com 3, x1,45 com 4...: barris e carroças mais rápidos,
mais raposas, mais armadilhas no Campo Minado, quebra-cabeça maior, meta maior na Colheita). Nos jogos
de fliperama cada navegador roda o mesmo mundo (mesma semente e o mesmo relógio) e o servidor só decide
quem pegou primeiro, quem caiu e quem chegou; o Pac-Coelho e o 2048 rodam no servidor. Cada coelho
aparece com o visual do Club Coelho.

### Festa na Toca

Um tabuleiro com minijogos, no estilo do Mario Party, de 1 a 10 pessoas (com menos de 4, os lugares
vazios podem ser coelhos da casa, que jogam sozinhos). Com mais de 5 coelhos as pausas entre as jogadas
encurtam, e nos minijogos em times vale a média de cada time (times de tamanhos diferentes ficam justos). Todo mundo joga o dado para ver a ordem; em cada rodada cada um
joga o dado e anda pelo Jardim da Toca:

- **Casa azul** dá 3 cenouras, **vermelha** tira 3, **sorte** sorteia algo bom ou ruim, **Raposo**
  apronta (rouba cenouras, cobra imposto de todos...), e a **loja** vende itens (Dado Duplo, Dado
  Triplo e o Apito Dourado, que leva para perto da cenoura dourada).
- Ao passar pela **cenoura dourada** dá para comprá-la por 20 cenouras; depois ela muda de lugar.
- Nas bifurcações quem joga escolhe o caminho.
- No fim de cada rodada tem um **minijogo** (todos contra todos, ou times azul e vermelho conforme as
  casas em que cada um parou). Quem vence ganha cenouras.
- As 3 últimas rodadas valem o dobro, e no fim saem 3 estrelas bônus (uma cenoura dourada cada).
- Vence quem tiver mais cenouras douradas (desempata nas cenouras). Dá para escolher 10, 15 ou 20
  rodadas. Quem sai no meio vira um coelho da casa e a festa continua.

As cenouras da festa viram cenouras do Club Coelho (um quinto delas, até 40), e a festa tem aba no
ranking (vitórias, festas e douradas). O código está em `src/festa.js` (as regras),
`public/js/telas/festa.js` (o tabuleiro) e `public/js/festa-minijogos.js` (os minijogos).

### Códigos secretos

Os jogos de uma pessoa só escondem códigos: uma sequência de setas (no teclado, deslizando o dedo ou
nas setinhas da tela) ou uma palavra escrita no teclado. O código liga um modo secreto, e repetir o
código desliga. Os que facilitam deixam a partida sem recorde; os de enfeite e os que dificultam
valem. Nos jogos juntos (versus e co-op) os códigos não funcionam, para todos jogarem igual.

| Jogo | Código | O que faz |
|---|---|---|
| Cobrinha | ↓ ↓ ↑ ↑ ← ← → → | cobra arco-íris (vale recorde; quem assiste também vê) |
| Cobrinha | ← → ← → ← → | paredes de portal: sai de um lado e entra do outro |
| Cobrinha | ↑ ↓ ↑ ↓ ↑ ↓ | cobra turbo, bem mais rápida (vale recorde) |
| Pac-Coelho | ↑ ↑ ↓ ↓ ← → ← → (Konami) | mais 5 vidas, uma vez por partida |
| Pac-Coelho | escrever "buuu" | as raposas levam um susto, uma vez por nível |
| Pac-Coelho | escrever "neve" | coelho branquinho (vale recorde) |
| 2048 | ↑ ↑ ↓ ↓ ← → ← → | botão de desfazer jogada |
| 2048 | escrever "ouro" | um bloco de 128, uma vez por partida |
| 2048 | escrever "coelho" | blocos com coelhinho (vale recorde) |
| Campo Minado | escrever "xyzzy" | o pontinho fica vermelho com o mouse em cima de uma armadilha (o truque do Windows antigo) |
| Memória | escrever "espiar" | mostra todas as cartas por 2 segundos, uma vez por partida |
| Quebra-cabeça | escrever "numeros" | cada peça mostra o número do lugar dela |
| Quebra-cabeça | escrever "ima" | as peças no lugar certo brilham |
| Minado, Memória, Quebra | escrever "festa" | chuva de confete quando ganha (vale recorde) |
| Barris do Raposo | escrever "marreta" | uma marreta na hora, uma vez por partida |
| Barris do Raposo | escrever "devagar" | barris e fagulhas na metade da velocidade |
| Barris do Raposo | escrever "luckham" | o coelho sobe de coroa (vale recorde) |
| Super Coelho | ↑ ↑ ↓ ↓ ← → ← → | mais 5 vidas, uma vez por partida |
| Super Coelho | escrever "lua" | pouca gravidade, pulos de astronauta |
| Super Coelho | escrever "fogo" | vira o Coelho de Fogo na hora |
| Travessia | escrever "fantasma" | carroças e trem passam através do coelho (a água ainda pega) |
| Travessia | escrever "ouro" | coelho dourado de coroa, com rastro de brilho (vale recorde) |
| Travessia | escrever "noite" | tudo escuro, só lanternas iluminam (mais difícil, vale recorde) |

Cada código descoberto fica no **livro de segredos**, no salão da Recreação: os descobertos aparecem
com o código, e os que faltam aparecem como "???" com uma dica. Descobrir dá conquistas (Curioso,
Caçador de segredos, Mestre dos segredos e, com os 23, Lenda do fliperama). As palavras precisam de teclado; as setas funcionam
também no celular.

### Club Coelho

Um clube social no estilo do Club Penguin (`#/clube`, no menu e no alto do salão da Recreação).
Cada morador tem um coelho que passeia pelas salas: clique no chão para andar e nas portas para entrar.

- **Salas**: a Praça (com a fonte e as portas), o Café da Cenoura (clique no balcão e o coelho segura um
  café), o Armarinho da Dona Felpuda (a loja, e o provador), o Salão de Dança (pista que muda de cor) e
  o Lago Cintilante (pescaria). Quem está na mesma sala se vê andando ao vivo.
- **Conversa** em balões em cima do coelho (com o mesmo anti-spam do chat, e a criança recebe sem
  palavrão), emotes (aceno, coração, risada...), **dançar** e **sentar**.
- **Cenouras** são a moeda do clube: 300 para começar, 50 de presente por dia, e mais jogando: a
  **Pescaria** (3 por peixe), a **Dança da Toca** (setas no ritmo da música) e cada partida dos
  joguinhos da Recreação (até 40 por partida). O que se ganha jogando tem teto de 400 por dia.
- **Loja**: 14 cores de pelo, 41 roupas e acessórios (cabeça, rosto, pescoço, costas, roupa e o que vai
  na mão) e 20 móveis, além de chão e parede para a toca. Roupa e pelo se compram uma vez; móveis, vários.
- **Minha toca**: cada um tem a sua. Em **Decorar**, os móveis entram com um clique e se arrastam pela
  sala; dá para virar, guardar, trocar o chão e a parede e fechar a toca para visitas. O **Mapa** leva
  para qualquer sala e lista as tocas abertas, com quantas pessoas estão em cada uma.

O servidor guarda o perfil de cada um na tabela `clube` (cenouras, roupa, itens e toca) e quem está em
cada sala na memória (`src/clube.js`, rotas em `src/rotas/clube.js`). Os desenhos ficam em
`public/js/roupas-coelho.js` (as roupas), `public/js/clube-salas.js` (salas e móveis),
`public/js/clube-minijogos.js` e `public/js/telas/clube.js`.

### Lyendell Dorme

O jogo do "Cidade Dorme" (ou "Lobisomem") da Casa: de 4 a 15 pessoas, cada uma com uma carta
secreta. Quem abre a sala escolhe o tempo do dia (1, 2 ou 3 minutos), se a classe de quem morre
aparece e quais classes podem sair; começa quando quiser, com pelo menos 4 pessoas.

- **Noite**: a praça fecha. Os **Raposos** (os assassinos) escolhem juntos quem pegar, com um chat
  só deles; quem tem poder usa (cada um vê na tela o que pode fazer). A noite acaba quando todo mundo
  fez a sua parte ou o tempo acaba.
- **Amanhecer**: todos veem quem morreu, como morreu e (se ligado) a classe. Cada um recebe em
  segredo o que descobriu ("Só você sabe").
- **Dia**: a cidade conversa na praça e vota em quem executar (os votos aparecem para todos). Empate
  ou "pular" não executa ninguém.
- Quem morre vê todas as cartas e conversa no chat dos mortos; quem assiste não vê nenhuma carta.

**A vila dos coelhos.** O jogo acontece numa vila desenhada: cada pessoa tem um coelho e uma toca com
o nome dela, numa roda em volta da praça com a fogueira. Dá para andar com as setas ou W A S D (ou
clicando no chão), fazer emotes (teclas 1 a 6 ou os botões embaixo) e, na sala de espera, escolher a
cor do pelo e um acessório (laço, chapéu de palha, coroa de flores, cachecol, óculos ou coroa); a
escolha fica guardada no navegador. O que cada um fala na praça aparece num balão em cima do coelho.

- Para usar o poder, clique na toca (de noite) ou no coelho (de dia) de alguém, ou chegue perto e
  aperte E: abre um menu com o que dá para fazer ali. As tocas e os coelhos onde dá para agir brilham,
  e o que você escolheu aparece em cima da toca (os Raposos veem as patas de cada um). Os botões de
  sempre continuam embaixo da vila.
- Ao anoitecer e ao amanhecer todo mundo volta para a porta da própria toca. De noite a vila escurece
  (só a fogueira, as lanternas e a luz em volta do seu coelho) e cada um só vê o próprio coelho; os
  Raposos se veem, como raposas. Quem assiste não vê ninguém de noite.
- Quem morre vira fantasma: vê todo mundo, mas só os outros mortos o veem; a toca ganha uma lápide.
- De dia aparecem os votos (uma linha de quem vota até quem foi votado e a contagem em cima do
  coelho). O executado vai para a pedra da praça, com uma luz em cima, e todos o veem.
- O servidor guarda onde está cada coelho e manda para cada pessoa só os coelhos que ela enxerga
  (umas 10 vezes por segundo, só quando alguém anda). Fica em `src/cidade-mundo.js` e
  `public/js/telas/cidade-mundo.js`.

Quantos Raposos: 1 com 4 a 6 pessoas, 2 com 7 a 10 e 3 com 11 a 15. A partir de 7 pessoas entra um
neutro (dois a partir de 12) e, a partir de 9, pode entrar o Traidor. O resto são coelhos, quase
todos com poder. A lista das classes da partida aparece para todos (sem dizer de quem é cada uma).

As 20 classes:

| Time | Classe | O que faz |
|---|---|---|
| Coelhos | Coelho | Sem poder; vota de dia |
| Coelhos | Vidente | Toda noite descobre se alguém é Raposo |
| Coelhos | Aprendiz de Vidente | Vira a Vidente quando ela morre |
| Coelhos | Curandeira | Protege alguém por noite (não a mesma pessoa duas noites seguidas) |
| Coelhos | Guarda-Costas | Fica de guarda na casa de alguém e morre no lugar dela |
| Coelhos | Caçador | Quando morre, atira em alguém e leva junto |
| Coelhos | Boticária | Vê quem os Raposos atacam; uma poção de vida e uma de veneno |
| Coelhos | Nobre | O voto vale por dois |
| Coelhos | Cupido | Na primeira noite flecha dois apaixonados, que morrem juntos |
| Coelhos | Vigia | Vigia uma casa e sabe quem foi lá |
| Coelhos | Médium | Lê o chat dos mortos e, à noite, escreve lá sem mostrar o nome |
| Coelhos | Sacerdote do Septo | Uma vez: água benta mata um Raposo; se errar, morre ele |
| Coelhos | Ancião | Aguenta o primeiro ataque |
| Raposos | Raposo | Ataca à noite com os outros Raposos |
| Raposos | Raposo Alfa | Desempata o ataque; a Vidente vê como coelho |
| Raposos | Raposa Farejadora | Ataca e descobre a classe exata de alguém por noite |
| Raposos | Traidor | Coelho que sabe quem são os Raposos e ajuda de dia; parece coelho |
| Neutro | Bobo da Corte | Vence se for executado |
| Neutro | Gatuno | Mata alguém por noite; vence se sobrar sozinho ou com mais um |
| Neutro | Andarilho | 2 coletes; vence se estiver vivo no fim |

Os coelhos vencem quando não sobra Raposo nem Gatuno; os Raposos, quando são tantos quanto o resto;
os apaixonados, se forem os dois últimos. Quem sai da partida no meio morre na cidade.

As perguntas do quiz ficam no banco: quem tem o poder "Criar e editar as perguntas do quiz"
(a Família Nobre, e o administrador) corrige, apaga e cria perguntas no botão **Perguntas**
do cartão do quiz. O sistema já vem com umas 115 perguntas.

Cada jogo tem ranking: vitórias e acertos no quiz, vitórias e partidas em Lyendell Dorme, vitórias e cenouras na cobrinha ao vivo, vitórias
nos jogos de dois (velha, pedra, papel e tesoura, Lig 4 e Damas), pontos no Pac-Coelho e no 2048,
cenouras na cobrinha, o menor tempo no quebra-cabeça e no Campo Minado (por dificuldade) e o
menor número de jogadas na memória. Quem sai de uma partida no
meio perde (no quiz, fica fora do resultado); quem cai da internet tem 30 segundos para voltar. A Família Nobre (e quem tiver o poder "Apagar mensagens de outros no chat") pode
apagar mensagens impróprias; cada um pode apagar as suas.

Dá para **assistir qualquer jogo**: as partidas ao vivo (quiz, Lyendell Dorme, velha, pedra, papel e
tesoura, Lig 4, Damas, cobrinha ao vivo) e também quem está jogando sozinho. Quem abre o Pac-Coelho, a Cobrinha, o
Quebra-cabeça, a Memória, o Campo Minado ou o 2048 aparece
em **Jogando agora**, no salão; clicando em Assistir, dá para ver o jogo ao vivo, com o chat do
lado. Quem joga vê quantas pessoas estão assistindo.

**Anti-spam do chat:**

- mensagem colada na outra (menos de 0,7 s) ou repetida dentro de 1 minuto é barrada, e o texto
  volta para a caixa;
- mais de 6 mensagens em 10 segundos silencia a pessoa: 20 segundos na primeira vez, depois 1, 3
  e 10 minutos se continuar (zera após 15 minutos sem spam). A caixa do chat fica travada com a contagem;
- **missões e XP**: só conta mensagem de verdade (3 letras ou mais, não só "kkkk"), no máximo uma a
  cada 15 segundos, e quem foi silenciado fica mais 5 minutos sem o chat contar para XP e missões.

O chat guarda as últimas 2000 mensagens. As partidas em andamento ficam só na memória do
servidor: se o site reiniciar (por exemplo, depois de um `git push`), elas se perdem, mas o
chat, os resultados e os recordes ficam salvos.

## Bobo da Corte

Quem tem o cargo **Bobo da Corte** ganha a **Caixa de Pegadinhas** no menu (e o botão "Pregar uma
peça" no perfil das pessoas):

- **Torta na cara**: um respingo de creme na tela da pessoa, que precisa limpar (3 cliques).
- **Mundo de ponta-cabeça**: o site da pessoa vira de cabeça para baixo por 8 segundos.
- **Almofada de pum**: o barulho (feito pelo próprio navegador, sem arquivo de som) e uma nuvenzinha.
- **Nariz de palhaço**: um nariz vermelho na foto da pessoa por 30 minutos, e todo mundo vê.
- **Estouro de coelhos**: uma manada de coelhinhos atravessa a tela.
- **Chuva de confete**: na tela de todo mundo que está no site.
- **Piada na praça**: aparece em destaque no chat da cidade ("Ba dum tss!"), com um botão de ideias.

Tempos justos: uma pegadinha a cada 10 minutos; quem caiu fica protegido por 2 horas (de qualquer
Bobo); confete a cada 30 minutos e piada a cada 15. Quem está fora do site cai quando entrar (até 2
dias depois). Quem caiu pode responder "Kkkk, essa foi boa!" ou "Vou me vingar!", e o Bobo fica
sabendo na hora. No chat, o nome do Bobo aparece colorido, com o chapéu de guizos. A Caixa mostra o
mural das últimas pegadinhas e quem mais caiu, e há conquistas (Primeira travessura, Mestre das
gargalhadas e, para quem cai, Bom de rir). Nem a Família Nobre tem as pegadinhas (o administrador
tem, para testar). Um Bobo criança também pode, porque pegadinha é brincadeira.

## Mapa de Lyendell

A tela **Mapa de Lyendell** mostra a capital vista de cima, como uma planta escura no estilo do
site: o rio, as muralhas, as torres e o portão com a ponte, as casas em grade, as 4 avenidas
(douradas) e as 10 ruas alinhadas (só retas e cantos), com o nome escrito em cada uma, e os prédios.

- Arraste para andar pelo mapa; use a rodinha, a pinça no celular ou os botões + e − para o zoom.
- Clique numa rua (no mapa ou na lista embaixo) para destacar e ver onde fica.
- **Baixar imagem** gera um PNG do mapa inteiro, bom para mandar no Discord.

**Prédios e pontos.** Cada prédio é um selo com um ícone e o nome embaixo: dourado para os prédios
públicos, verde-água para os comércios e bege para os outros pontos. Os que já vêm no mapa: Septo,
Coliseu, Toca do Coelho (o Castelo da Família Nobre Luckham), Tabelionato (com a estrela roxa do
Centro da cidade), Banco, Quartel General e o Senado (entre a Rua Corvos e a Rua Bank).

Clicando num prédio abre a ficha dele:

- as **fotos**, de fora e de dentro (com setas, miniaturas e o filtro "Por fora" / "Por dentro");
- **para que serve**;
- **quem mora aqui** e **quem trabalha aqui**, com a função de cada um (ex.: Taverneiro). Quem está
  no Tabelionato aparece com a foto e os dados do registro, como nas casas; quem não está, só com o nome;
- **mais informações** (pares como "Fundado em" ou "Horário") e um texto livre **sobre** o lugar;
- um botão que abre a tela ligada ao prédio (o Senado abre o Congresso, o Quartel abre a Guarda).

**Casas.** Cada casa é um quadradinho numerado ao lado da rua (dourado: com morador; verde: comércio;
tracejado: sem dono, que é o mesmo que sem morador). A casa pode ganhar um ícone (ex.: Loja ou
Taverna), que aparece no quadradinho no lugar do número. Passando o mouse, ou clicando, aparece a
ficha: o endereço e quem mora, com a foto e os dados do registro no Tabelionato (Moradores, Nobres e
Outros) e um link que abre o registro. Quem mora é escolhido à mão ao editar a casa. Sem ninguém
escolhido, o mapa tenta achar pelo nome da casa ("Rudeus" acha "Rudeus Greyrat", se for o único),
menos em casa de família: nem todo mundo com o sobrenome mora nela, então o formulário só sugere quem
tem o sobrenome e mostra onde cada um já mora. Quem foi escolhido para uma casa ou para morar num
prédio não aparece em outra casa pelo nome parecido. Só entram registros aprovados.

Quem tem o poder "Colocar, mover e editar as casas e os prédios do mapa" (a Família Nobre e a
Tabeliã) usa **Editar mapa** e escolhe o que pôr: **Casa** ou **Prédio ou ponto**.

- clicar num lugar vazio põe o que foi escolhido (a casa encosta alinhada na rua mais perto; o
  prédio fica onde foi clicado);
- arrastar uma casa ou um prédio muda o lugar; clicar abre para editar;
- no prédio dá para escolher o nome, o que é, a categoria (público, comércio ou outro), o tamanho do
  selo (grande, médio ou pequeno), o ícone (casa, loja, mercado, taverna, padaria, peixaria,
  ferraria, boticário, fazenda, estábulo, porto, castelo, torre, templo, capela, senado, justiça,
  guarda, prisão, arena, banco, hospital, biblioteca, teatro, jardim, poço e outros), as fotos (até
  24, de fora e de dentro), quem mora e quem trabalha, as informações e o texto sobre o lugar;
- **Colar lista de uma rua**: uma linha "Esquerda" ou "Direita" e depois "Casa 02 - Nome" em cada
  linha. O site põe as casas enfileiradas dos dois lados, na mesma altura, desviando das esquinas e
  dos prédios. "Sem dono" e "Sem morador" viram casas vazias; bar, peixaria, pousada e afins viram comércio.

Numa rua em pé, esquerda é o lado oeste; numa rua deitada, é o lado de cima. Os números crescem de
cima para baixo, ou da esquerda para a direita. As casas da Avenida Santa Menefreda já vêm no mapa.

As ruas e o contorno da cidade ficam em `public/js/mapa-lyendell.js`, com as coordenadas tiradas da
vista de cima do jogo (imagem de 1154 x 773, norte para cima). As casas e os prédios ficam no banco
e são mexidos pelo próprio mapa; os prédios que vêm prontos estão em `src/predios-padrao.js`.

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
- **Missões do dia**: três por pessoa, que renovam à meia-noite: uma **da sua função** (do cargo:
  registrar ou conferir no Tabelionato, na Guarda ou no Hospital, enviar ao Congresso ou avaliar as
  propostas do povo, escrever leis,
  marcar pagamento, mexer no mapa, publicar anúncio, criar atividade, conferir entrega, enviar foto,
  criar pergunta do quiz, ou pregar peças e contar piadas, para o Bobo) e duas para todo mundo (chat,
  partidas, vitória, jogar em equipe, quiz, jogos sozinho, recado, entrega). Quem não trabalha no
  Tabelionato nunca recebe missão de registrar lá; o morador sem cargo recebe só as de todo mundo.
- **Conquistas**: 37 no total (Tagarela, Sábio da Toca, Terror das Raposas, Faro afiado, Dama de ferro, Primeira travessura, Voz do povo, Mestre dos segredos...).

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
