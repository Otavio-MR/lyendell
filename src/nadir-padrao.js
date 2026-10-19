// O Livro de Nadir como ele começa: o que a Grande Nadir sabe do mundo, da fé, da Casa Luckham, de Lyendell e
// das pessoas, além do que ela lê ao vivo no próprio site (fichas do Tabelionato, perfis, leis, mapa...).
// Entra uma vez só (veja semear em db.js); depois a Família Nobre edita tudo pelo site, em Nadir > Livro de Nadir.
// Fontes: o site da família (história, Código de Honra, os membros) e o que o Evran contou sobre o mundo.
// Nada aqui é inventado: onde falta saber, a Nadir diz que não sabe, e a pergunta fica anotada para completar.

const CATEGORIAS = {
  fe: 'A fé',
  mundo: 'O mundo de Eldoria',
  casa: 'A Casa Luckham',
  cidade: 'Lyendell, a Capital',
  pessoa: 'As pessoas',
  site: 'O site da Casa',
  outro: 'Outros saberes',
};

// A Escola Luckham (do jornal). Também entra no Livro de bancos que já existiam (migração v34 em db.js).
const SABER_ESCOLA = {
  categoria: 'cidade', titulo: 'A Escola Luckham', apelidos: 'escola, aulas, alunos, professores, matrícula, disciplinas',
  texto: `A Escola Luckham é a escola de Lyendell, dirigida pelo Lorde Evran Luckham (o Diretor da Escola). Tem sistema próprio no site, em Escola Luckham, fora do Tabelionato.
Pela educação, pelo conhecimento e pelo futuro de Eldoria. As matrículas são abertas a crianças e jovens de 1 a 16 anos, sem distinção de origem ou Casa.
As disciplinas: História de Eldoria; Matemática e Economia; Geografia de Eldoria; Autodefesa; Linguagem (falar, ler e escrever); Etiqueta.
Cada disciplina tem um professor titular e, se necessário, um substituto de confiança, escolhidos entre os inscritos.
Para inscrever um aluno ou se candidatar a professor: procurar o Lorde Evran Luckham ou alguém do Tabelionato de Lyendell, incluindo a Srta. Layla Weeslay.
Só quem trabalha na escola vê a lista de alunos, as notas e a frequência.`,
};

// O Hospital Imperial (também entra no Livro de bancos que já existiam: migração v38 em db.js).
const SABER_HOSPITAL = {
  categoria: 'cidade', titulo: 'O Hospital Imperial', apelidos: 'hospital, cura, curandeiros, médicos, hospital imperial',
  texto: `O Hospital Imperial é onde são curadas pessoas de todo o Império, não apenas os Luckham. Fica na Capital, no lugar do antigo Coliseu no mapa, e atende feridos e doentes de qualquer Casa ou região.
Quem cuida dele é o Diretor do Hospital, junto com a equipe. Os atendimentos ficam no livro Pacientes do Hospital Imperial, dentro do Hospital no site. Os prontuários são sigilosos: só a equipe do Hospital vê.`,
};

const SABER_PADRAO = [
  /* ─── A fé ─── */
  { categoria: 'fe', titulo: 'A Grande Nadir', apelidos: 'Nadir, Mãe Nadir, Coelha Mãe, Coelha Mãe Sagrada',
    texto: `A Grande Nadir é a Coelha Mãe Sagrada, a divindade da Fé dos Luckham (a Fé de Nadir). Quem segue essa fé segue "o caminho da Mãe Nadir".
O Padre da Fé de Nadir é Keydran Nhamuri Luckham, irmão de Evran. Graças aos seus ancestrais, ele tem forte ligação com os espíritos e com a natureza.
A Fé de Nadir ainda não tem um templo próprio em Lyendell.
Uma das avenidas da Capital leva o nome dela: a Avenida Nadir.
A bênção do Padre: "Que a Grande Nadir guie nossos espíritos e nossos passos."` },
  { categoria: 'fe', titulo: 'A Fé dos Sete', apelidos: 'os Sete, Septo',
    texto: `A Fé dos Sete é a outra fé presente em Lyendell. O seu templo é o Septo, um dos prédios públicos da Capital.
Os Sete são: o Pai, a Mãe, o Guerreiro, o Ferreiro, a Donzela, a Velha e o Estranho.
No Septo acontecem as orações, os casamentos, as bênçãos e os ritos da Fé dos Sete.` },

  /* ─── O mundo ─── */
  { categoria: 'mundo', titulo: 'Eldoria', apelidos: 'o mundo, o continente',
    texto: `Eldoria é o mundo onde a Casa Luckham vive e onde fica Lyendell, a sua capital.
A Casa Luckham nasceu nas Terras Centrais e depois partiu rumo a Eldoria.
Em Eldoria existem outras casas e outras regiões além de Lyendell. Cada região tem o seu Mestre da Moeda.
(Este trecho ainda é curto: a história do mundo, as outras casas e os reinos devem ser escritos aqui pela Família Nobre.)` },
  { categoria: 'mundo', titulo: 'O tempo em Eldoria', apelidos: 'calendário, anos, idade, aniversário',
    texto: `Em Eldoria o tempo corre mais rápido: um ano de Eldoria passa em um mês do mundo de fora.
Por isso o aniversário de cada pessoa volta sempre no mesmo dia do mês, um mês sim e um mês não.` },
  { categoria: 'mundo', titulo: 'Os Lírios', apelidos: 'moeda, dinheiro, Lírio',
    texto: 'O Lírio é a moeda usada em Lyendell e em Eldoria. Salários, multas, recompensas e pagamentos são contados em Lírios.' },
  { categoria: 'mundo', titulo: 'O Banco do Continente e a Família Seraphim', apelidos: 'Banco, Seraphim',
    texto: `O Banco não pertence a Lyendell: ele é do continente, e quem o administra é a Família Seraphim.
Cada região tem o seu Mestre da Moeda, que trabalha em parceria com o Banco. Em Lyendell, essa parceria é feita pelo Mestre da Moeda da Capital, que cuida do tesouro e dos pagamentos da Prefeitura.
Há uma agência do Banco entre os prédios públicos de Lyendell.` },

  /* ─── A Casa ─── */
  { categoria: 'casa', titulo: 'A origem da Casa Luckham', apelidos: 'história da Casa, fundação, Família Luckham',
    texto: `A Casa Luckham não nasceu de sangue nobre nem de conquista militar. Nasceu da terra, das mãos calejadas de dois jovens das Terras Centrais que decidiram, antes mesmo de ter qualquer coisa, que um dia teriam tudo.
Evran e Alianor não herdaram o sobrenome Luckham: eles o escolheram, como escolheram cada passo que deram desde então.
A casa ainda está em seus primeiros passos, mas seus fundadores sabem que grandes casas não se constroem em um dia. A Casa Luckham cresce em silêncio, move-se com cuidado e protege os seus com tudo o que tem.
A história da Casa é contada em atos. Ato I, "A Escolha do Nome": nas Terras Centrais, Evran e Alianor escolheram o nome Luckham e assentaram, do nada, a primeira pedra da casa. O Ato II ainda será escrito.` },
  { categoria: 'casa', titulo: 'O brasão: o coelho coroado', apelidos: 'brasão, símbolo, coelho dourado, bandeira',
    texto: 'O brasão da Casa Luckham é o coelho coroado, o coelho dourado. Ele diz quem os Luckham são: espertos, adaptáveis, capazes de sobreviver onde outros fracassam.' },
  { categoria: 'casa', titulo: 'O Código de Honra da Casa Luckham', apelidos: 'código, pilares, honra',
    texto: `O Código de Honra tem cinco pilares:
1. A lealdade é sagrada. A Casa Luckham não abandona os seus. Quem caminha ao lado do coelho dourado tem a proteção da família enquanto merecer esse lugar.
2. A bondade é uma força, não uma fraqueza. A casa acredita que tratar bem as pessoas é o caminho certo, mas não confunde bondade com ingenuidade. Generosidade tem limites, e esses limites existem para proteger a todos.
3. Pense antes de dar. Todo favor tem um peso, toda aliança tem um custo. A casa age com o coração, mas não sem pensar nas consequências.
4. Proteja os seus acima de tudo. Família, aliados e amigos vêm antes de qualquer causa maior. A Casa Luckham não sacrifica os seus por ideais abstratos.
5. Cresça com dignidade. A casa não chegará ao topo pisando em quem não merece. Mas também não recuará quando for necessário agir com firmeza.` },
  { categoria: 'casa', titulo: 'O Juramento da Casa Luckham', apelidos: 'juramento, jurar, virar morador',
    texto: `Para se tornar um morador da Capital, a pessoa faz um juramento de honra e servidão à Casa Luckham, diante da bandeira, dando a sua palavra e força de vontade aos Luckham.
As palavras do juramento:
"Eu, por minha própria vontade, diante de todos aqui presentes, juro minha lealdade à Casa Luckham.
Eu me comprometo a honrar seu nome, respeitar seus membros e defender seus interesses.
Juro permanecer leal nos tempos de paz e firme nos tempos de conflito.
Não trairei aqueles que depositarem sua confiança em mim, nem abandonarei a Casa enquanto meu juramento permanecer de pé.
A partir deste momento, minha palavra está dada e minha lealdade, oferecida.
Pela honra. Pela lealdade. Pela Casa Luckham."
Só os Moradores e os Nobres juram. Quem é de outra casa ou só presta serviço não jura.` },
  { categoria: 'casa', titulo: 'Portadores do Nome e Membros da Casa', apelidos: 'membros, portadores do nome, família',
    texto: `A Casa tem dois grupos. Os Portadores do Nome carregam o sobrenome Luckham: Evran, Alianor, Lancelot, Nikolash, Keydran, Henrique, Manu e Caim.
Os Membros da Casa não carregam o nome, mas pertencem a ela: guardas, pesquisadores, o bobo, o bardo e outros.
O trio ruivo são os irmãos Weeslay: Layla, Lorian e Lia, pesquisadores da Casa.
A guarda gêmea são os irmãos Larelis, Joseph (o Sol) e Avery (a Lua), que zelam por Alianor.` },

  /* ─── A cidade ─── */
  { categoria: 'cidade', titulo: 'Lyendell, a Capital', apelidos: 'Capital, cidade, ruas, avenidas',
    texto: `Lyendell é a capital da Casa Luckham.
As avenidas: Avenida Bandeirinhas, Avenida Nadir, Avenida Sarará e Avenida Santa Menefreda.
As ruas: Rua Corvos, Rua Coelho, Rua Toca, Rua Floral, Rua Café com Leite, Rua Alecrim, Rua Resenha, Rua Bank, Rua Raposo e Rua Gatuno.
Os prédios públicos: a Toca do Coelho (o castelo da Família Nobre Luckham), o Tabelionato (que marca o Centro da cidade), o Septo, o Coliseu, o Senado, o Quartel General da Guarda do Coelho, o Banco, o Hospital, a Biblioteca, a Escola e a Forja.
Os detalhes de cada casa e de cada prédio (quem mora, quem trabalha, para que serve) estão no Mapa de Lyendell.` },
  { categoria: 'cidade', titulo: 'Como a Capital funciona', apelidos: 'instituições, cargos, governo',
    texto: `O Tabelionato guarda os registros e os documentos importantes: moradores, nobres, comerciantes, casamentos e propriedades. Quem aprova os registros é a Tabeliã; o Escriba faz registros, que vão para a aprovação dela.
A Guarda do Coelho protege a Capital: faz as rondas, registra presos e procurados. Quem aprova é o Lorde Comandante ou o General, o braço direito dele. Os cartazes de procurados e banidos são públicos.
O Hospital cuida dos feridos e doentes. Os prontuários são sigilosos: só a equipe do Hospital vê.
O Senado é onde o Congresso se reúne e vota as leis, PECs e regras. Qualquer morador pode mandar uma proposta; a Senadora avalia e leva à pauta.
As Leis de Lyendell são feitas pelo Lorde Comandante junto com a Família Nobre.
O Mestre da Moeda cuida do tesouro da Capital, dos salários e da folha de pagamento.
A Biblioteca guarda livros publicados por terceiros, doados ou comprados, para ensino, aprendizado e diversão.
O Bobo da Corte alegra a cidade com piadas e pegadinhas.
Os Aliados são convidados de outras casas: não são moradores.
Em Lyendell, o "Endereço" de uma pessoa é o nome pelo qual ela é chamada no jogo; a "Residência" é a rua e o número da casa.` },
  SABER_ESCOLA,
  SABER_HOSPITAL,
  { categoria: 'cidade', titulo: 'O Raposo', apelidos: 'raposa, raposos, vilão',
    texto: `Nas histórias e brincadeiras da Toca, o Raposo é o grande rival dos coelhos: é ele quem ataca à noite no jogo Lyendell Dorme, quem joga os barris e quem leva a Princesa Cenoura. Há até uma Rua Raposo na Capital.` },

  /* ─── O site ─── */
  { categoria: 'site', titulo: 'O que dá para fazer no site da Casa', apelidos: 'site, ajuda, como usar',
    texto: `No menu: Início (novidades, aniversariantes e cartazes de procurados), Comunidade (o perfil de cada um), Mapa de Lyendell, Mural de Anúncios, Congresso (leis votadas e propostas do povo), Juramento, Leis de Lyendell, Mural de Atividades (pedidos de ajuda com metas), Galeria de fotos, Recreação (chat e jogos, com ranking) e Club Coelho.
Em Registros ficam o Tabelionato, a Guarda do Coelho e o Hospital (este só para a equipe).
Para registrar um morador, falar com a Tabeliã ou com o Escriba. Para denunciar, procurar um guarda. Para sugerir uma lei, usar Congresso > Propostas.
Em Meu perfil a pessoa põe foto, frase, história, o dia do aniversário e liga as notificações.` },

  /* ─── As pessoas (do site da família) ─── */
  { categoria: 'pessoa', titulo: 'Evran Solde Luckham', apelidos: 'Evran, Lorde, Patriarca, Lorde Soberano',
    texto: `Líder Principal e Patriarca da Casa Luckham, e Lorde Soberano de Lyendell. Fundou a Casa ao lado de Alianor.
Líder, marido, pai e irmão. Carrega o peso de uma casa inteira nos ombros, mas nunca deixa o coração endurecer: cuida de cada membro como o coelho cuida de seus filhotes. Sob o seu comando, a família segue unida.
Família: marido de Alianor; pai de Lancelot e de Manu; irmão de Nikolash e de Keydran; primo de Henrique.
Quem o protege: Feryn Caldrak (onde Evran vai, Feryn vai junto) e a guarda de Edward Th.
Frase: "Quando se ama alguma coisa, você a protege, essa é a reação mais natural do mundo."` },
  { categoria: 'pessoa', titulo: 'Alianor Bulton Luckham', apelidos: 'Alianor, Lorde Consorte, Braço Direito',
    texto: `Conselheiro e Braço Direito da Casa, Lorde Consorte de Lyendell. Fundou a Casa ao lado de Evran.
Marido de Evran e pai de Lancelot e de Manu; irmão de Caim. É a mente mais brilhante da Casa Luckham: vive mergulhado em livros, mas jamais falta quando Evran precisa dele. De mão firme, nunca por maldade: só quer que tudo acabe bem.
Quem o protege: a guarda gêmea, Joseph e Avery Larelis.
Frase: "Ser firme, quando o mundo desabar."` },
  { categoria: 'pessoa', titulo: 'Lancelot Luckham', apelidos: 'Lancelot, herdeiro',
    texto: `Filho de Evran e Alianor e herdeiro da Casa. Herdou o bom coração de um pai e a mente afiada do outro, e vive na forja, encantado por martelos e pelo aço: é aprendiz de ferreiro. Irmão de Manu.
Frase: "O ferro se molda no fogo... e homens destinados à grandeza também. Eu sou Lancelot Luckham, e meu nome ainda ecoará por este reino."` },
  { categoria: 'pessoa', titulo: 'Nikolash Mishkins Luckham', apelidos: 'Niko, Nikolash, Mão do Lorde, Braço Esquerdo',
    texto: `Irmão de Evran e seu braço esquerdo. Conselheiro da Casa: ajuda o líder a pesar cada decisão, e é o abraço certo nos momentos difíceis. É a Mão do Lorde.
Chamam-no de Niko. Tem só uma fraqueza: não resiste a uma ruiva.
Quem o protege: Edward Th, guarda da Casa.
Frase: "Se o mar não me levar, talvez uma ruiva leve."` },
  { categoria: 'pessoa', titulo: 'Keydran Nhamuri Luckham', apelidos: 'Keydran, Padre, Padre da Fé de Nadir',
    texto: `Irmão de Evran e Padre da Fé dos Luckham, devotado à Grande Nadir, a Coelha Mãe Sagrada. Graças aos seus ancestrais, carrega forte ligação com os espíritos e a natureza, seguindo sempre o caminho da Mãe Nadir.
Fala dele: "Que a Grande Nadir guie nossos espíritos e nossos passos."` },
  { categoria: 'pessoa', titulo: 'Henrique Skylord Luckham', apelidos: 'Henrique, mensageiro',
    texto: `Primo de Evran e mensageiro da Casa: recebe e entrega as cartas dos Luckham a cada membro e a cada aliado. Jovem e de espírito veloz, está sempre correndo de um lado a outro, e sempre com um sorriso no rosto.
Frase: "Lute pelo que vale a pena."` },
  { categoria: 'pessoa', titulo: 'Manu Luckham', apelidos: 'Manu',
    texto: 'Filha de Evran e Alianor, irmã de Lancelot. Ainda criança, é fofa, aventureira e exploradora nata, curiosa com absolutamente tudo. Onde houver um cantinho novo para desbravar, lá está a pequena Manu.' },
  { categoria: 'pessoa', titulo: 'Caim Bulton Luckham', apelidos: 'Caim',
    texto: 'Irmão de Alianor, um homem honroso e digno de estar entre os Luckham. Seu passado é complicado e envolto em mistério, mas, aconteça o que acontecer, ele honrará a sua família.' },
  { categoria: 'pessoa', titulo: 'Feryn Caldrak', apelidos: 'Feryn, o Último Romântico',
    texto: `Guarda da Casa, a espada que guarda o líder: onde Evran vai, Feryn vai junto, sempre pronto. Encara qualquer inimigo sem piscar, mas perde feio diante de uma mulher bonita: trava na hora de falar e se apaixona num piscar. Chamam-no de o Último Romântico.
Frase: "Briga eu sei evitar. Mulher bonita... ainda tô aprendendo."` },
  { categoria: 'pessoa', titulo: 'Cafeinado de Amerin', apelidos: 'Café, Cafeinado, Bobo da Casa, Bobo',
    texto: `O Bobo da Casa: o bobo, o palhaço, ou melhor, a própria piada. Usa máscara e não mostra o rosto. O seu único objetivo é fazer a família e cada membro da Casa Luckham sorrir e rir, até o seu último dia. Chamam-no de Café.` },
  { categoria: 'pessoa', titulo: 'Joseph Larelis', apelidos: 'Joseph, o Sol',
    texto: `Metade da guarda gêmea que zela por Alianor, ao lado da irmã Avery. Joseph é o Sol do par: caloroso e radiante, o amanhecer que protege quando a escuridão chega.
Frase: "Eu serei o amanhecer que guia os perdidos, a chama que permanece acesa mesmo quando o mundo escurece. Enquanto houver alguém para proteger, meu sol nunca deixará de nascer."` },
  { categoria: 'pessoa', titulo: 'Avery Larelis', apelidos: 'Avery, a Lua',
    texto: `A outra metade da guarda gêmea que zela por Alianor, ao lado do irmão Joseph. Avery é a Lua do par: serena e vigilante, a luz silenciosa que protege na calada da noite.
Frase: "Eu serei a luz que permanece quando o dia se cala, o silêncio que observa e a sombra que protege. Enquanto houver alguém para salvar, minha lua nunca deixará de brilhar."` },
  { categoria: 'pessoa', titulo: 'Layla Weeslay', apelidos: 'Layla',
    texto: `Do trio ruivo, a irmã mais esperta. Está sempre à frente quando o assunto é pesquisa e exploração, e é uma ótima conselheira nos momentos que realmente importam. Pesquisadora da Casa Luckham. Irmã de Lorian e de Lia.
Frase: "Dizem que o tempo cura tudo. Talvez cure... mas ainda existem noites em que o som de um sino parece mais alto do que deveria."` },
  { categoria: 'pessoa', titulo: 'Lorian Weeslay', apelidos: 'Lorian',
    texto: `Do trio ruivo, o irmão mais curioso e intelectual. Racional, mas sem perder o carinho, pensa rápido e com clareza: um ótimo conselheiro para as questões mais técnicas. Pesquisador da Casa Luckham. Irmão de Layla e de Lia.
Frase: "A distância entre a vida e a morte é um único instante. A vida que carrego foi comprada pelo sacrifício de dois. E eu os honrarei até meu último dia."` },
  { categoria: 'pessoa', titulo: 'Lia Weeslay', apelidos: 'Lia',
    texto: 'Do trio ruivo, a irmã mais carinhosa. Quando alguém precisa conversar, ou só de um ombro amigo, a Lia sempre estará lá, apoiando os irmãos e os amigos. Pesquisadora da Casa Luckham. Irmã de Layla e de Lorian.' },
  { categoria: 'pessoa', titulo: 'Edward Th', apelidos: 'Edward',
    texto: `Membro da guarda de Evran e da Casa Luckham. A sua missão é zelar pela segurança dos seus, em especial do conselheiro Nikolash. De coração bondoso, mas sabe muito bem a hora de levantar e usar a espada.
Frase: "Eu sou eu e ninguém é mais eu do que eu mesmo."` },
  { categoria: 'pessoa', titulo: 'Tisu', apelidos: '',
    texto: 'Guarda da Casa Luckham e um exímio coletor de recursos. Está sempre armadurado dos pés à cabeça e nunca, jamais, passa fome. Onde há o que colher, Tisu colhe; onde há o que defender, a sua espada fala.' },
  { categoria: 'pessoa', titulo: 'Osiris Abadi', apelidos: 'Osiris, bardo',
    texto: 'O bardo da Casa Luckham. A sua música e o seu talento com incontáveis instrumentos fazem dele uma presença essencial, tanto nos momentos bons quanto nos ruins da família e da casa. Onde há Osiris, há canção.' },
];

module.exports = { SABER_PADRAO, SABER_ESCOLA, SABER_HOSPITAL, CATEGORIAS };
