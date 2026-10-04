// Cartaz de procurado (no estilo dos cartazes de One Piece): papel envelhecido, "PROCURADO", o retrato,
// "VIVO", "MORTO" ou "VIVO OU MORTO", o nome e a recompensa em Lírios. Desenhado num canvas, para
// aparecer no livro de Procurados e para baixar como imagem.

export const LARGURA = 600;
export const ALTURA = 860;

// Um livro de cartazes tem um campo de seleção com "Vivo ou Morto" (o Procurados da Guarda).
export const campoCondicao = l => l.campos.find(c => c.tipo === 'selecao' && (c.opcoes || []).some(o => /vivo ou morto/i.test(o)));
export const ehLivroDeCartaz = l => !!campoCondicao(l);

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const campoPor = (l, ...nomes) => l.campos.find(c => nomes.some(n => c.id === n || norm(c.nome).startsWith(n)));

// Os dados do cartaz a partir de um registro do livro.
export function dadosDoCartaz(l, dados) {
  const cNome = campoPor(l, 'nome');
  const cRetrato = l.campos.find(c => c.tipo === 'imagem');
  const cRecompensa = campoPor(l, 'recompensa');
  const cCrime = campoPor(l, 'crime');
  const cSituacao = campoPor(l, 'situacao');
  const cCond = campoCondicao(l);
  const bruto = cRecompensa ? dados[cRecompensa.id] : null;
  const valor = Number(String(bruto ?? '').replace(/[^\d]/g, '')) || 0;
  return {
    nome: String((cNome && dados[cNome.id]) || 'Desconhecido'),
    retrato: cRetrato ? dados[cRetrato.id] || null : null,
    condicao: String((cCond && dados[cCond.id]) || 'Vivo ou Morto'),
    recompensa: valor,
    crime: String((cCrime && dados[cCrime.id]) || ''),
    situacao: String((cSituacao && dados[cSituacao.id]) || ''),
  };
}

const imagens = new Map();
function carregarImagem(src) {
  if (!src) return Promise.resolve(null);
  if (!imagens.has(src)) {
    imagens.set(src, new Promise(ok => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ok(null);
      i.src = src;
    }));
  }
  return imagens.get(src);
}

// Números "aleatórios" fixos, para as manchas do papel serem sempre as mesmas no mesmo cartaz.
function sorte(semente) {
  let s = semente >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const sementeDe = txt => [...txt].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

function papel(g, rnd) {
  const L = LARGURA;
  const A = ALTURA;
  const grad = g.createRadialGradient(L / 2, A / 2, 80, L / 2, A / 2, A * 0.75);
  grad.addColorStop(0, '#f1e0b8');
  grad.addColorStop(0.7, '#e2c795');
  grad.addColorStop(1, '#b98f57');
  g.fillStyle = grad;
  g.fillRect(0, 0, L, A);
  // Manchas e fibras do papel
  for (let k = 0; k < 90; k++) {
    g.fillStyle = `rgba(${120 + rnd() * 40}, ${80 + rnd() * 30}, ${40 + rnd() * 20}, ${0.03 + rnd() * 0.06})`;
    g.beginPath();
    g.ellipse(rnd() * L, rnd() * A, 6 + rnd() * 40, 4 + rnd() * 26, rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(110, 75, 35, 0.12)';
  g.lineWidth = 1;
  for (let k = 0; k < 40; k++) {
    const y = rnd() * A;
    g.beginPath();
    g.moveTo(rnd() * L, y);
    g.lineTo(rnd() * L, y + (rnd() - 0.5) * 30);
    g.stroke();
  }
  // Bordas queimadas
  const borda = g.createLinearGradient(0, 0, L, 0);
  borda.addColorStop(0, 'rgba(90, 55, 20, 0.35)');
  borda.addColorStop(0.06, 'rgba(90, 55, 20, 0)');
  borda.addColorStop(0.94, 'rgba(90, 55, 20, 0)');
  borda.addColorStop(1, 'rgba(90, 55, 20, 0.35)');
  g.fillStyle = borda;
  g.fillRect(0, 0, L, A);
  const bordaV = g.createLinearGradient(0, 0, 0, A);
  bordaV.addColorStop(0, 'rgba(90, 55, 20, 0.3)');
  bordaV.addColorStop(0.05, 'rgba(90, 55, 20, 0)');
  bordaV.addColorStop(0.95, 'rgba(90, 55, 20, 0)');
  bordaV.addColorStop(1, 'rgba(90, 55, 20, 0.35)');
  g.fillStyle = bordaV;
  g.fillRect(0, 0, L, A);
  // Moldura dupla
  g.strokeStyle = 'rgba(60, 38, 18, 0.75)';
  g.lineWidth = 3;
  g.strokeRect(22, 22, L - 44, A - 44);
  g.lineWidth = 1;
  g.strokeRect(30, 30, L - 60, A - 60);
}

// Texto que encolhe até caber na largura.
function textoCabe(g, txt, x, y, max, tam, fonte, cor) {
  let t = tam;
  g.font = `${t}px ${fonte}`;
  while (g.measureText(txt).width > max && t > 12) { t -= 2; g.font = `${t}px ${fonte}`; }
  g.fillStyle = cor;
  g.fillText(txt, x, y);
}

// O lírio da moeda de Lyendell, ao lado do valor.
function lirio(g, x, y, r, cor) {
  g.save();
  g.translate(x, y);
  g.fillStyle = cor;
  for (const a of [-0.55, 0, 0.55]) {
    g.save();
    g.rotate(a);
    g.beginPath();
    g.ellipse(0, -r * 0.55, r * 0.28, r * 0.6, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.fillRect(-r * 0.08, -r * 0.1, r * 0.16, r * 0.9);
  g.beginPath();
  g.ellipse(0, r * 0.15, r * 0.55, r * 0.14, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

const formatar = n => n.toLocaleString('pt-BR');

// Desenha o cartaz num canvas (LARGURA x ALTURA). Devolve uma promessa (o retrato e as fontes carregam antes).
export async function desenharCartaz(canvas, d) {
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const g = canvas.getContext('2d');
  try { await Promise.all([document.fonts.load('700 80px Cinzel'), document.fonts.load('600 30px "EB Garamond"')]); } catch { /* sem as fontes, vai a serifada do sistema */ }
  const img = await carregarImagem(d.retrato);
  const rnd = sorte(sementeDe(d.nome + d.crime));
  const L = LARGURA;
  const tinta = '#3a2412';
  const titulo = "Cinzel, 'Times New Roman', serif";
  const texto = "'EB Garamond', Georgia, serif";
  papel(g, rnd);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';

  // PROCURADO
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.15)';
  g.shadowOffsetY = 2;
  textoCabe(g, 'PROCURADO', L / 2, 128, L - 90, 92, `bold ${titulo}`, tinta);
  g.restore();

  // Retrato com moldura
  const fx = 60;
  const fy = 160;
  const fw = L - 120;
  const fh = 380;
  g.fillStyle = 'rgba(60, 38, 18, 0.85)';
  g.fillRect(fx - 6, fy - 6, fw + 12, fh + 12);
  g.fillStyle = '#d8c29a';
  g.fillRect(fx, fy, fw, fh);
  if (img) {
    const k = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
    const w = img.naturalWidth * k;
    const hh = img.naturalHeight * k;
    g.save();
    g.beginPath(); g.rect(fx, fy, fw, fh); g.clip();
    g.drawImage(img, fx + (fw - w) / 2, fy + (fh - hh) / 2, w, hh);
    // Tom de papel por cima (a foto fica "impressa" no cartaz)
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgba(226, 199, 149, 0.55)';
    g.fillRect(fx, fy, fw, fh);
    g.restore();
  } else {
    // Sem retrato: a silhueta de um coelho misterioso
    g.save();
    g.fillStyle = 'rgba(60, 38, 18, 0.55)';
    g.beginPath(); g.ellipse(L / 2, fy + fh - 40, 120, 90, 0, Math.PI, 0); g.fill();
    g.beginPath(); g.ellipse(L / 2, fy + 190, 70, 66, 0, 0, Math.PI * 2); g.fill();
    for (const [ox, rot] of [[-30, -0.2], [30, 0.2]]) { g.beginPath(); g.ellipse(L / 2 + ox, fy + 95, 18, 62, rot, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(241, 224, 184, 0.9)';
    g.font = `bold 64px ${titulo}`;
    g.fillText('?', L / 2, fy + 214);
    g.restore();
  }

  // VIVO / MORTO / VIVO OU MORTO
  const cond = d.condicao.toUpperCase();
  g.save();
  g.font = `bold 34px ${titulo}`;
  const wCond = g.measureText(cond).width;
  g.strokeStyle = tinta;
  g.lineWidth = 2;
  for (const lado of [-1, 1]) {
    const x0 = L / 2 + lado * (wCond / 2 + 14);
    g.beginPath(); g.moveTo(x0, 590); g.lineTo(x0 + lado * 60, 590); g.stroke();
  }
  g.fillStyle = /morto/i.test(d.condicao) && !/vivo/i.test(d.condicao) ? '#6e1a12' : tinta;
  g.fillText(cond, L / 2, 602);
  g.restore();

  // Nome
  textoCabe(g, d.nome.toUpperCase(), L / 2, 672, L - 100, 58, `bold ${titulo}`, tinta);

  // Recompensa
  const valor = d.recompensa ? formatar(d.recompensa) : 'A COMBINAR';
  g.font = `bold 50px ${texto}`;
  const wValor = g.measureText(valor).width;
  const total = wValor + 52;
  const x0 = L / 2 - total / 2;
  lirio(g, x0 + 18, 738, 26, tinta);
  g.textAlign = 'left';
  g.fillStyle = tinta;
  g.fillText(valor, x0 + 52, 752);
  g.textAlign = 'center';
  g.font = `600 22px ${texto}`;
  g.fillText(d.recompensa ? 'Lírios de recompensa' : 'Recompensa', L / 2, 784);
  if (d.crime) textoCabe(g, `Crime: ${d.crime}`, L / 2, 806, L - 120, 20, `italic ${texto}`, 'rgba(58, 36, 18, 0.85)');
  g.font = `bold 15px ${titulo}`;
  g.fillStyle = 'rgba(58, 36, 18, 0.7)';
  g.fillText('GUARDA DO COELHO · CASA LUCKHAM', L / 2, 824);

  // Carimbo de capturado ou perdoado
  const sit = norm(d.situacao);
  if (sit.startsWith('captur') || sit.startsWith('perdo')) {
    const capt = sit.startsWith('captur');
    g.save();
    g.translate(L / 2, 380);
    g.rotate(-0.32);
    g.globalAlpha = 0.82;
    g.strokeStyle = capt ? '#a3201a' : '#2f6b2a';
    g.fillStyle = capt ? '#a3201a' : '#2f6b2a';
    g.lineWidth = 8;
    g.font = `bold 70px ${titulo}`;
    const txt = capt ? 'CAPTURADO' : 'PERDOADO';
    const w = g.measureText(txt).width + 40;
    g.strokeRect(-w / 2, -58, w, 92);
    g.fillText(txt, 0, 16);
    g.restore();
  }
  return canvas;
}

// Baixa o cartaz como PNG.
export async function baixarCartaz(d) {
  const c = await desenharCartaz(document.createElement('canvas'), d);
  const blob = await new Promise(ok => c.toBlob(ok, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Procurado ${d.nome}.png`.replace(/[\\/:*?"<>|]/g, '');
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
