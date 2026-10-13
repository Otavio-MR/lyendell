require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const multer = require('multer');
const { db, iniciarBanco } = require('./src/db');
const { sessao, exigirLogin } = require('./src/auth');
const { servirArquivo, TAMANHO_MAX_MB } = require('./src/uploads');
const { erro } = require('./src/util');
const { iniciarRecreacao } = require('./src/recreacao');

const app = express();
const PORTA = Number(process.env.PORT) || 3000;
// Muda a cada atualização (no Render, é o commit publicado). O navegador compara para saber se precisa recarregar.
const VERSAO_SITE = process.env.RENDER_GIT_COMMIT || String(Date.now());

app.disable('x-powered-by');
// Na hospedagem o site fica atrás de proxies; isso faz o Express enxergar o IP real e o HTTPS.
app.set('trust proxy', true);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'X-Versao': VERSAO_SITE,
    'Content-Security-Policy': [
      "default-src 'self'",
      // Cabeça da skin do Minecraft (foto de perfil opcional).
      "img-src 'self' data: blob: https://mc-heads.net",
      // Trilha sonora: só as músicas enviadas para o próprio site.
      "media-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "script-src 'self'",
      // A recreação (chat e jogos ao vivo) conversa por WebSocket com o próprio site.
      `connect-src 'self' wss://${req.get('host')} ws://${req.get('host')}`,
      "frame-ancestors 'none'",
    ].join('; '),
  });
  next();
});

// Usado pelo serviço que visita o site de tempos em tempos para ele não "dormir".
// Também toca no banco, para ele não ser considerado parado.
app.get('/api/saude', async (req, res) => {
  await db.get('SELECT 1 AS ok');
  res.set('Cache-Control', 'no-store').json({ ok: true });
});

// Propostas do povo e textos de lei podem ser enormes (um livro inteiro): essas rotas aceitam até 5 MB.
app.use(['/api/propostas', '/api/livros', '/api/registros'], express.json({ limit: '5mb' }));
app.use(express.json({ limit: '1mb' }));

// Pedidos que alteram dados só valem vindos do próprio site.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origem = req.get('origin');
  if (origem) {
    let host = null;
    try { host = new URL(origem).host; } catch { /* origem inválida */ }
    const permitidos = [req.get('host'), req.get('x-forwarded-host')].filter(Boolean);
    if (!permitidos.includes(host)) return next(erro(403, 'Origem não permitida.'));
  }
  next();
});

app.use(sessao);

app.use('/api/auth', require('./src/rotas/auth'));
app.use('/api/usuarios', require('./src/rotas/usuarios'));
app.use('/api/cargos', require('./src/rotas/cargos'));
app.use('/api/galeria', require('./src/rotas/galeria'));
app.use('/api/anuncios', require('./src/rotas/anuncios'));
app.use('/api/atividades', require('./src/rotas/atividades'));
app.use('/api/recreacao', require('./src/rotas/recreacao'));
app.use('/api/pessoas', require('./src/rotas/pessoas'));
app.use('/api/trilha', require('./src/rotas/trilha'));
app.use('/api/casas', require('./src/rotas/casas'));
app.use('/api/predios', require('./src/rotas/predios'));
app.use('/api/bobo', require('./src/rotas/bobo'));
app.use('/api/clube', require('./src/rotas/clube'));
app.use('/api/propostas', require('./src/rotas/propostas'));
app.use('/api/juramento', require('./src/rotas/juramento'));
app.use('/api/sprites', require('./src/rotas/sprites'));
app.use('/api/notificacoes', require('./src/rotas/notificacoes'));
app.use('/api/financas', require('./src/rotas/financas'));
app.use('/api/nadir', require('./src/rotas/nadir'));
app.use('/api/escola', require('./src/rotas/escola'));
app.use('/api', require('./src/rotas/livros'));
app.use('/api', require('./src/rotas/geral'));
app.use('/api', (req, res, next) => next(erro(404, 'Rota não encontrada.')));

// Imagens enviadas (guardadas no banco) só aparecem para quem está logado.
app.get('/uploads/:nome', exigirLogin, servirArquivo);
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use((err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let mensagem = err.message;
  if (err instanceof multer.MulterError) {
    status = 400;
    mensagem = err.code === 'LIMIT_FILE_SIZE' ? `A imagem é grande demais (máximo ${TAMANHO_MAX_MB} MB).` : 'Não foi possível receber o arquivo.';
  } else if (status === 403 && req.usuario?.crianca) {
    mensagem = 'Isso é coisa de gente grande!'; // para o personagem criança, qualquer porta fechada é assim
  } else if (err.type === 'entity.parse.failed') {
    mensagem = 'Dados inválidos.';
  } else if (err.type === 'entity.too.large') {
    mensagem = 'Conteúdo grande demais.';
  }
  if (status >= 500) {
    console.error(err);
    mensagem = 'Algo deu errado no servidor. Tente de novo.';
  }
  if (req.path.startsWith('/api/')) res.status(status).json({ erro: mensagem });
  else res.status(status).type('text').send(mensagem);
});

iniciarBanco()
  .then(banco => {
    const servidor = app.listen(PORTA, () => {
      console.log('\n  Casa Luckham · Sistema de Lyendell');
      console.log(`  Banco: ${banco}`);
      console.log(`  Rodando em http://localhost:${PORTA}\n`);
    });
    iniciarRecreacao(servidor);
  })
  .catch(e => {
    console.error('\n  Não foi possível abrir o banco de dados:', e.message, '\n');
    process.exit(1);
  });
