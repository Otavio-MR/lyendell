# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
A comunidade do RP medieval de Minecraft "Casa Luckham", na cidade de Lyendell. Prioridade: a administração da cidade, isto é, a Família Nobre (o Lorde Evran Luckham é o administrador root), a Tabeliã, o Comandante da Guarda, o Diretor do Hospital, a Senadora, o Mestre da Moeda, o Diretor da Escola e outros cargos. Eles usam o site para registrar moradores, aprovar registros, cuidar de finanças, escola, mapa e leis. Em segundo lugar vêm os moradores, que veem anúncios, mapa, perfis e jogam na Recreação e no Club Coelho. Existem também Aliados (convidados de outras casas, só veem o que for marcado para eles) e o personagem criança (visão infantil, sem modificar nada). O uso é principalmente no computador, mas tudo precisa funcionar bem no celular.

## Product Purpose
Sistema de administração e vida comunitária da cidade de Lyendell: registros oficiais (Tabelionato, Guarda, Hospital, Congresso, Leis), gestão financeira e folha de pagamento, Escola Luckham, mapa com casas e prédios, murais de anúncios e atividades, galeria, juramento, perfis com progresso, a IA "Grande Nadir" e uma área de jogos e Club Coelho para a comunidade passar tempo. Sucesso: a administração mantém a cidade organizada sem planilhas soltas, e os moradores têm um motivo para voltar.

## Positioning
O site é o "governo e a vida" de um RP específico: cargos com permissões que somam, registros que viram livros `.book` para o Minecraft, e uma cidade inteira (mapa, casas, escola, finanças) ligada ao mesmo cadastro de pessoas. Um site genérico de comunidade não conhece os cargos, o lore nem os livros do jogo.

## Operating Context
- Hospedagem 100% gratuita: Render Free com banco Turso (SQLite). Cada push no GitHub (Otavio-MR/lyendell, branch main) atualiza o site.
- Frontend em JavaScript puro com módulos ES, sem etapa de build; backend Node, Express 5, `@libsql/client`, WebSocket para jogos e avisos.
- Os registros viram livros `.book` do mod Scribble (Minecraft 1.21.4 Fabric) com 14 linhas por página e códigos de cor.
- Moeda do RP: Lírios. No RP, 1 ano equivale a 1 mês de verdade. O "Endereço" de uma pessoa é o nick do jogador; a "Residência" é a rua e o número.

## Capabilities and Constraints
- Cargos somam permissões; "Morador" é a base. Só o root mexe em cargos. Aprovação de registros é exclusiva de um cargo por módulo.
- Todo texto feito para o dono do projeto fica em português do Brasil e sem travessão (— ou –).
- Segredos só no `.env` (e no Render); contas externas são criadas pelo dono.
- Jogos e telas precisam se ajustar a qualquer tamanho de janela e rotação.
- O tema atual é a identidade combinada (ver Brand Commitments).

## Brand Commitments
- Tema escuro verde quase preto com dourado, fontes Cinzel e Garamond, brasão do coelho coroado, herdados do site público da família (Familia Luckham, GitHub Pages Otavio-MR/site-luckham). Dark é o padrão e fica.
- O personagem criança tem visual próprio (céu estrelado, fontes Fredoka e Patrick Hand); isso se mantém separado.
- O mapa usa o Norte para baixo e o Sul para cima, e vem de uma planta do jogo; não inverter.
- Nome da casa: Casa Luckham; cidade: Lyendell; coelhos e o Raposo (vilão de brincadeira) fazem parte do mundo.

## Evidence on Hand
- Site no ar em produção com dados reais do Tabelionato; testes de regressão em scratchpad (51 suítes) e README.md completo no projeto.
- Não há métricas de uso, depoimentos nem pesquisa com usuários; nada disso deve ser inventado.

## Product Principles
1. A administração vem primeiro: ações de gestão claras, rápidas e seguras (confirmação em destrutivas, aprovação visível).
2. Sigilo por padrão: dados sensíveis só para quem tem acesso (prontuários, finanças, notas de alunos).
3. O site e o jogo são o mesmo mundo: o que se registra aqui sai como livro `.book` e o lore (cargos, lugares, moedas) se mantém.
4. Funciona em qualquer tela: PC primeiro, mas celular, tablet e rotação nunca quebram, e jogos se ajustam à janela.
5. Honestidade com a comunidade: nada de dados, preços ou lore inventados; o dono completa o que falta.

## Accessibility & Inclusion
Alvos de toque de pelo menos 44px nas ações principais, foco de teclado visível, contraste legível no tema escuro, modais com foco preso e Esc, respeito a movimento reduzido. O personagem criança deve ser protegido: sem ações destrutivas e sem acesso a áreas de adultos (escola, finanças).
