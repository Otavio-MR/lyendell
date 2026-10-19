// A assinatura desenhada: { tracos: [[[x, y], ...], ...] } em uma grade de 600 x 200.
// Guarda só os números (nada de imagem do navegador), com limites de tamanho. Vazia ou inválida vira null.
// Usada pelos registros dos livros e pela Escola (fichas de alunos e professores).
function lerAssinatura(v) {
  if (!v || typeof v !== 'object' || !Array.isArray(v.tracos)) return null;
  const tracos = [];
  let pontos = 0;
  for (const t of v.tracos.slice(0, 40)) {
    if (!Array.isArray(t)) continue;
    const p = [];
    for (const q of t.slice(0, 600)) {
      const x = Number(q?.[0]); const y = Number(q?.[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      p.push([Math.min(600, Math.max(0, Math.round(x))), Math.min(200, Math.max(0, Math.round(y)))]);
    }
    pontos += p.length;
    if (p.length) tracos.push(p);
  }
  if (!tracos.length || pontos < 3 || pontos > 6000) return null;
  return JSON.stringify({ tracos });
}

module.exports = { lerAssinatura };
