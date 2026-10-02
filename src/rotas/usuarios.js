const express = require('express');
const { db } = require('../db');
const { hashSenha, validarSenhaNova } = require('../senhas');
const { carregarUsuario, montarUsuario, comandoDerrubarSessoes, exigir } = require('../auth');
const { anotar } = require('../diario');
const { comandoApagarArquivo } = require('../uploads');
const { erro, linha, chaveNome, idDaRota } = require('../util');

const r = express.Router();

// Regra de ouro: ninguém mexe em quem tem mais poder que si, nem concede o que não tem.
// Assim a Família Nobre não consegue se dar o poder de criar usuários, por exemplo.
function podeGerenciar(ator, alvo) {
  if (ator.is_root) return !alvo.is_root || alvo.id === ator.id;
  if (alvo.is_root) return false;
  for (const p of alvo.permissoes) if (!ator.permissoes.has(p)) return false;
  return true;
}

function podeConceder(ator, cargo) {
  if (ator.is_root) return true;
  return JSON.parse(cargo.permissoes).every(p => ator.permissoes.has(p));
}

function validarNome(bruto) {
  const nome = linha(bruto, 40);
  if (nome.length < 2) throw erro(400, 'O nome do personagem precisa ter pelo menos 2 letras.');
  if (!/^[\p{L}\p{M}\p{N} '._-]+$/u.test(nome)) throw erro(400, 'Use só letras, números, espaços, ponto, hífen ou apóstrofo no nome.');
  return nome;
}

async function nomeLivre(nome, excetoId = 0) {
  const existe = await db.get('SELECT nome FROM usuarios WHERE chave = ? AND id <> ?', chaveNome(nome), excetoId);
  if (existe) throw erro(409, `Já existe um usuário chamado "${existe.nome}".`);
}

// Recebe uma lista de ids de cargo e confere se o ator pode conceder cada um.
async function validarCargos(ator, ids) {
  if (!Array.isArray(ids)) throw erro(400, 'Lista de cargos inválida.');
  const unicos = [...new Set(ids.map(Number).filter(Number.isInteger))];
  if (!unicos.length) return [];
  const cargos = await db.all(`SELECT * FROM cargos WHERE id IN (${unicos.map(() => '?').join(', ')})`, ...unicos);
  if (cargos.length !== unicos.length) throw erro(400, 'Um dos cargos escolhidos não existe mais.');
  const lista = cargos.filter(c => !c.base);
  for (const c of lista) {
    if (!podeConceder(ator, c)) throw erro(403, `Você não pode conceder o cargo "${c.nome}", porque ele tem poderes que você não tem.`);
  }
  return lista;
}

// Nomes ficam guardados junto dos registros para não sumirem se o usuário for removido.
const comandosRenomear = (id, nome) => [
  ['UPDATE registros SET criado_por_nome = ? WHERE criado_por = ?', nome, id],
  ['UPDATE fotos SET enviado_por_nome = ? WHERE enviado_por = ?', nome, id],
  ['UPDATE anuncios SET autor_nome = ? WHERE autor_id = ?', nome, id],
  ['UPDATE atividades SET criado_por_nome = ? WHERE criado_por = ?', nome, id],
  ['UPDATE participantes SET usuario_nome = ? WHERE usuario_id = ?', nome, id],
  ['UPDATE contribuicoes SET usuario_nome = ? WHERE usuario_id = ?', nome, id],
  ['UPDATE chat_mensagens SET usuario_nome = ? WHERE usuario_id = ?', nome, id],
  ['UPDATE recordes SET usuario_nome = ? WHERE usuario_id = ?', nome, id],
  ['UPDATE partidas SET jogador1_nome = ? WHERE jogador1_id = ?', nome, id],
  ['UPDATE partidas SET jogador2_nome = ? WHERE jogador2_id = ?', nome, id],
  ['UPDATE quiz_resultados SET usuario_nome = ? WHERE usuario_id = ?', nome, id],
  ['UPDATE resultados SET usuario_nome = ? WHERE usuario_id = ?', nome, id],
  ['UPDATE recados SET autor_nome = ? WHERE autor_id = ?', nome, id],
];

async function buscarAlvo(req) {
  const alvo = await carregarUsuario(idDaRota(req));
  if (!alvo) throw erro(404, 'Usuário não encontrado.');
  return alvo;
}

r.get('/', exigir('usuarios.ver'), async (req, res) => {
  const [lista, vinculos, todosCargos] = await Promise.all([
    db.all('SELECT id, nome, foto, is_root, ativo, crianca, criado_em, ultimo_acesso FROM usuarios ORDER BY is_root DESC, chave'),
    db.all('SELECT usuario_id, cargo_id FROM usuario_cargos'),
    db.all('SELECT * FROM cargos ORDER BY ordem, id'),
  ]);
  const idsDe = new Map();
  for (const v of vinculos) {
    if (!idsDe.has(v.usuario_id)) idsDe.set(v.usuario_id, new Set());
    idsDe.get(v.usuario_id).add(v.cargo_id);
  }
  res.json({
    usuarios: lista.map(u => {
      const ids = idsDe.get(u.id) || new Set();
      const completo = montarUsuario(u, todosCargos.filter(c => c.base || ids.has(c.id)));
      return {
        ...u,
        is_root: !!u.is_root,
        ativo: !!u.ativo,
        crianca: !!u.crianca,
        cargos: [...ids],
        gerenciavel: podeGerenciar(req.usuario, completo),
      };
    }),
    concediveis: todosCargos.filter(c => !c.base && podeConceder(req.usuario, c)).map(c => c.id),
  });
});

r.post('/', exigir('usuarios.criar'), async (req, res) => {
  const nome = validarNome(req.body?.nome);
  await nomeLivre(nome);
  const problema = validarSenhaNova(req.body?.senha);
  if (problema) throw erro(400, problema);
  const cargos = await validarCargos(req.usuario, req.body?.cargos || []);
  const chave = chaveNome(nome);
  const crianca = req.body?.crianca ? 1 : 0;

  const [criado] = await db.lote([
    ['INSERT INTO usuarios (nome, chave, senha_hash, crianca) VALUES (?, ?, ?, ?)', nome, chave, await hashSenha(req.body.senha), crianca],
    ...cargos.map(c => ['INSERT INTO usuario_cargos (usuario_id, cargo_id) SELECT id, ? FROM usuarios WHERE chave = ?', c.id, chave]),
  ]);
  await anotar(req, 'Criou um usuário', `${nome}${crianca ? ', criança' : ''}${cargos.length ? ` (${cargos.map(c => c.nome).join(', ')})` : ''}`);
  res.status(201).json({ id: Number(criado.lastInsertRowid) });
});

r.put('/:id', exigir('usuarios.editar'), async (req, res) => {
  const alvo = await buscarAlvo(req);
  if (!podeGerenciar(req.usuario, alvo)) throw erro(403, 'Você não pode editar este usuário.');
  const proprio = alvo.id === req.usuario.id;
  const comandos = [];
  const mudancas = [];

  // Confere tudo antes; só grava no final, de uma vez.
  if (req.body?.nome !== undefined) {
    const nome = validarNome(req.body.nome);
    if (nome !== alvo.nome) {
      await nomeLivre(nome, alvo.id);
      comandos.push(['UPDATE usuarios SET nome = ?, chave = ? WHERE id = ?', nome, chaveNome(nome), alvo.id], ...comandosRenomear(alvo.id, nome));
      mudancas.push(`nome para "${nome}"`);
    }
  }
  if (req.body?.senha) {
    const problema = validarSenhaNova(req.body.senha);
    if (problema) throw erro(400, problema);
    comandos.push(['UPDATE usuarios SET senha_hash = ? WHERE id = ?', await hashSenha(req.body.senha), alvo.id],
      comandoDerrubarSessoes(alvo.id, proprio ? req.tokenSessao : null));
    mudancas.push('senha');
  }
  if (req.body?.cargos !== undefined && !alvo.is_root) {
    const cargos = await validarCargos(req.usuario, req.body.cargos);
    // Cargos que o ator não pode conceder também não podem ser tirados por ele.
    const tirados = alvo.cargos.filter(c => !cargos.some(x => x.id === c.id));
    if (tirados.length) {
      const completos = await db.all(`SELECT * FROM cargos WHERE id IN (${tirados.map(() => '?').join(', ')})`, ...tirados.map(c => c.id));
      const proibido = completos.find(c => !podeConceder(req.usuario, c));
      if (proibido) throw erro(403, `Você não pode tirar o cargo "${proibido.nome}".`);
    }
    comandos.push(['DELETE FROM usuario_cargos WHERE usuario_id = ?', alvo.id],
      ...cargos.map(c => ['INSERT INTO usuario_cargos (usuario_id, cargo_id) VALUES (?, ?)', alvo.id, c.id]));
    mudancas.push(`cargos: ${cargos.map(c => c.nome).join(', ') || 'só morador'}`);
  }
  if (req.body?.crianca !== undefined && !alvo.is_root && !!req.body.crianca !== alvo.crianca) {
    comandos.push(['UPDATE usuarios SET crianca = ? WHERE id = ?', req.body.crianca ? 1 : 0, alvo.id]);
    mudancas.push(req.body.crianca ? 'agora é criança' : 'não é mais criança');
  }
  if (req.body?.ativo !== undefined && !alvo.is_root && !proprio) {
    const ativo = req.body.ativo ? 1 : 0;
    comandos.push(['UPDATE usuarios SET ativo = ? WHERE id = ?', ativo, alvo.id]);
    if (!ativo) comandos.push(comandoDerrubarSessoes(alvo.id));
    mudancas.push(ativo ? 'reativou' : 'desativou');
  }

  await db.lote(comandos);
  if (mudancas.length) await anotar(req, 'Editou um usuário', `${alvo.nome}: ${mudancas.join('; ')}`);
  res.json({ ok: true });
});

r.delete('/:id', exigir('usuarios.remover'), async (req, res) => {
  const alvo = await buscarAlvo(req);
  if (alvo.is_root) throw erro(403, 'O administrador principal não pode ser removido.');
  if (alvo.id === req.usuario.id) throw erro(400, 'Você não pode remover a si mesmo.');
  if (!podeGerenciar(req.usuario, alvo)) throw erro(403, 'Você não pode remover este usuário.');
  // O que a pessoa fez continua registrado, só perde o vínculo com a conta.
  const id = alvo.id;
  const { capa } = await db.get('SELECT capa FROM usuarios WHERE id = ?', id);
  await db.lote([
    ['DELETE FROM sessoes WHERE usuario_id = ?', id],
    ['DELETE FROM usuario_cargos WHERE usuario_id = ?', id],
    ['DELETE FROM participantes WHERE usuario_id = ?', id],
    ['UPDATE registros SET criado_por = NULL WHERE criado_por = ?', id],
    ['UPDATE fotos SET enviado_por = NULL WHERE enviado_por = ?', id],
    ['UPDATE anuncios SET autor_id = NULL WHERE autor_id = ?', id],
    ['UPDATE atividades SET criado_por = NULL WHERE criado_por = ?', id],
    ['UPDATE contribuicoes SET usuario_id = NULL WHERE usuario_id = ?', id],
    ['UPDATE pagamentos SET marcado_por = NULL WHERE marcado_por = ?', id],
    ['UPDATE arquivos SET enviado_por = NULL WHERE enviado_por = ?', id],
    ['UPDATE chat_mensagens SET usuario_id = NULL WHERE usuario_id = ?', id],
    ['UPDATE recordes SET usuario_id = NULL WHERE usuario_id = ?', id],
    ['UPDATE partidas SET jogador1_id = NULL WHERE jogador1_id = ?', id],
    ['UPDATE partidas SET jogador2_id = NULL WHERE jogador2_id = ?', id],
    ['UPDATE quiz_resultados SET usuario_id = NULL WHERE usuario_id = ?', id],
    ['UPDATE resultados SET usuario_id = NULL WHERE usuario_id = ?', id],
    ['UPDATE recados SET autor_id = NULL WHERE autor_id = ?', id],
    ['DELETE FROM recados WHERE perfil_id = ?', id],
    ['DELETE FROM conquistas_usuario WHERE usuario_id = ?', id],
    ['DELETE FROM eventos_dia WHERE usuario_id = ?', id],
    ['UPDATE propostas SET autor_id = NULL WHERE autor_id = ?', id],
    ['DELETE FROM proposta_apoios WHERE usuario_id = ?', id],
    ['DELETE FROM segredos WHERE usuario_id = ?', id],
    ['DELETE FROM pegadinhas WHERE alvo_id = ? OR de_id = ?', id, id],
    ['DELETE FROM usuarios WHERE id = ?', id],
    comandoApagarArquivo(alvo.foto),
    comandoApagarArquivo(capa),
  ]);
  await anotar(req, 'Removeu um usuário', alvo.nome);
  res.json({ ok: true });
});

// Quem administra usuários pode tirar uma foto de perfil imprópria.
r.delete('/:id/foto', exigir('usuarios.editar'), async (req, res) => {
  const alvo = await buscarAlvo(req);
  if (!podeGerenciar(req.usuario, alvo)) throw erro(403, 'Você não pode editar este usuário.');
  if (!alvo.foto) return res.json({ ok: true });
  await db.lote([['UPDATE usuarios SET foto = NULL WHERE id = ?', alvo.id], comandoApagarArquivo(alvo.foto)]);
  await anotar(req, 'Removeu a foto de perfil de um usuário', alvo.nome);
  res.json({ ok: true });
});

module.exports = r;
