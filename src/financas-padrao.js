// Valores de demonstração da Gestão Financeira, para começar a testar. Entram uma vez só (no semear) e o
// Mestre da Moeda edita tudo depois. Não são regras definitivas: as profissões e os itens vêm marcados como
// "demonstração", e a folha avisa quando um pagamento usa um valor que ainda não foi conferido.

// Turnos previstos por semana no salário fixo (o exemplo: o guarda cumpre 3 de 5 turnos).
const TURNOS_SEMANA = 5;

const PROFISSOES_PADRAO = [
  { nome: 'Guarda', remuneracao: 'fixo', salario_base: 40, proporcional: 1, regra: 'Salário semanal, proporcional à presença' },
  { nome: 'Tabelião', remuneracao: 'fixo', salario_base: 60, proporcional: 0, regra: 'Salário semanal' },
  { nome: 'Médico', remuneracao: 'fixo', salario_base: 50, proporcional: 0, regra: 'Salário semanal' },
  { nome: 'Conselheiro', remuneracao: 'fixo', salario_base: 50, proporcional: 0, regra: 'Salário semanal' },
  { nome: 'Mestre da Moeda', remuneracao: 'fixo', salario_base: 60, proporcional: 0, regra: 'Salário semanal' },
  { nome: 'Mão do Lorde', remuneracao: 'fixo', salario_base: 60, proporcional: 0, regra: 'Salário semanal' },
  // Produção: um item genérico por profissão, com o valor de referência. O Mestre da Moeda detalha por
  // produto ou recurso (batata, ferro, espada...) antes de usar em pagamentos de verdade.
  { nome: 'Artesão', remuneracao: 'producao', regra: 'Por lote aceito', itens: [{ nome: 'Lote de artesanato aceito', unidade: 'lote', valor: 10 }] },
  { nome: 'Ferreiro', remuneracao: 'producao', regra: 'Por lote aceito', itens: [{ nome: 'Lote de ferraria aceito', unidade: 'lote', valor: 15 }] },
  { nome: 'Fazendeiro', remuneracao: 'producao', regra: 'Por baú de produto aceito', itens: [{ nome: 'Baú de produto agrícola', unidade: 'baú', valor: 10 }] },
  { nome: 'Coletor de recursos', remuneracao: 'producao', regra: 'Por baú de recurso aceito', itens: [{ nome: 'Baú de recurso', unidade: 'baú', valor: 10 }] },
];

// O tesouro começa com 1.000 Lírios (um lançamento de saldo inicial, feito uma vez só).
// Teto de planejamento da folha regular e reserva: só geram alertas, nunca cortam pagamentos.
const SALDO_INICIAL = 1000;
const CONFIG_PADRAO = {
  teto_folha: 800,
  reserva: 200,
  frequencia_padrao: 'semanal',
};

module.exports = { PROFISSOES_PADRAO, TURNOS_SEMANA, SALDO_INICIAL, CONFIG_PADRAO };
