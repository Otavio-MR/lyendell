// Cobrança periódica dos registros (ex.: comerciantes pagam a cada 14 dias).
// A parcela nº k vence em  início + k × intervalo  e cobre o período anterior a essa data.

const FUSO = process.env.FUSO || 'America/Sao_Paulo';

// "Hoje" no horário de Brasília, mesmo que o servidor esteja em outro fuso.
function hoje() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const paraDia = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
const deDia = n => new Date(n * 864e5).toISOString().slice(0, 10);

/**
 * Monta a lista de parcelas de um registro.
 * Mostra todas as que já venceram e as próximas (pelo menos `futuras`, e sempre uma ainda não paga).
 */
function cronograma({ inicio, intervalo, fim, pagos = [], hojeStr = hoje(), futuras = 3, maximo = 500 }) {
  if (!inicio) return null;
  const porVencimento = new Map(pagos.map(p => [p.vencimento, p]));
  const i0 = paraDia(inicio);
  const hj = paraDia(hojeStr);
  const limite = fim ? paraDia(fim) : Infinity;
  const parcelas = [];
  let vistasFuturas = 0;
  let futuraAberta = false;

  for (let k = 1; parcelas.length < maximo; k++) {
    const venc = i0 + k * intervalo;
    if (venc > limite) break;
    if (venc > hj) {
      if (vistasFuturas >= futuras && futuraAberta) break;
      vistasFuturas++;
      if (!porVencimento.has(deDia(venc))) futuraAberta = true;
    }
    parcelas.push({ numero: k, inicio: deDia(venc - intervalo), vencimento: deDia(venc) });
  }

  // Pagamentos que não caem mais no cronograma (ex.: o intervalo mudou) continuam aparecendo.
  const noCronograma = new Set(parcelas.map(p => p.vencimento));
  for (const p of pagos) {
    if (!noCronograma.has(p.vencimento)) parcelas.push({ numero: null, inicio: null, vencimento: p.vencimento, avulso: true });
  }
  parcelas.sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  let pendenteMarcada = false;
  for (const p of parcelas) {
    const pago = porVencimento.get(p.vencimento);
    if (pago) { p.status = 'pago'; p.pagamento = pago; continue; }
    const v = paraDia(p.vencimento);
    if (v < hj) { p.status = 'atrasado'; p.diasAtraso = hj - v; }
    else if (!pendenteMarcada) { p.status = v === hj ? 'hoje' : 'proximo'; pendenteMarcada = true; }
    else p.status = 'futuro';
  }

  const pendente = parcelas.find(p => p.status === 'hoje' || p.status === 'proximo');
  return {
    parcelas,
    atrasados: parcelas.filter(p => p.status === 'atrasado').length,
    proximo: pendente ? pendente.vencimento : null,
    venceHoje: pendente?.status === 'hoje',
  };
}

// Resumo curto para a tabela do livro.
function resumo(livro, registro, pagos, hojeStr = hoje()) {
  const cfg = livro.cobranca;
  const inicio = registro.dados[cfg.campo];
  if (!inicio) return { semInicio: true };
  const c = cronograma({ inicio, intervalo: cfg.intervalo, fim: registro.cobranca_fim, pagos, hojeStr, futuras: 1 });
  return { atrasados: c.atrasados, proximo: c.proximo, venceHoje: c.venceHoje, encerrada: !!registro.cobranca_fim };
}

module.exports = { hoje, cronograma, resumo };
