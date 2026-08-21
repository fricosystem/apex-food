'use strict';

const { executar } = require('./middleware');
const { ApiError } = require('./http');
const {
  PAPEIS_LEITURA,
  caminhoRestaurante,
  obterIdentidadeOperacional,
  limitarInteiro,
  queryString,
  timestampParaIso,
} = require('./modulos-operacionais');

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const FAIXAS = ['11h–12h', '12h–13h', '13h–14h', '14h–15h', '15h–16h', '18h–19h', '19h–20h', '20h–21h', '21h–22h', '22h–23h'];
const ESTADOS_CANCELADOS = new Set(['cancelado', 'cancelada', 'cancelado_pelo_cliente', 'excluido', 'excluida']);
const ESTADOS_CONCLUIDOS = new Set(['finalizado', 'finalizada', 'fechado', 'fechada', 'pago', 'paga', 'concluido', 'concluida']);

function dataHojeNoFuso(fusoHorario = 'America/Sao_Paulo') {
  try {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: fusoHorario,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const mapa = Object.fromEntries(partes.filter((parte) => parte.type !== 'literal').map((parte) => [parte.type, parte.value]));
    return `${mapa.year}-${mapa.month}-${mapa.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function dataIso(valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  const isoTimestamp = timestampParaIso(valor);
  if (isoTimestamp && /^\d{4}-\d{2}-\d{2}/.test(isoTimestamp)) return isoTimestamp.slice(0, 10);
  if (typeof valor !== 'string') return '';
  const texto = valor.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
  const brasileiro = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return brasileiro ? `${brasileiro[3]}-${brasileiro[2]}-${brasileiro[1]}` : '';
}

function dataExibicao(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function horarioDeValor(valor) {
  const iso = timestampParaIso(valor);
  if (iso && /T\d{2}:\d{2}/.test(iso)) return iso.slice(11, 16);
  if (typeof valor !== 'string') return '';
  const match = valor.match(/(?:T|\s)(\d{2}:\d{2})/);
  return match ? match[1] : (/^\d{2}:\d{2}/.test(valor) ? valor.slice(0, 5) : '');
}

function dataValida(valor, campo) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new ApiError(400, 'DATA_INVALIDA', `${campo} é inválida.`);
  const data = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) throw new ApiError(400, 'DATA_INVALIDA', `${campo} é inválida.`);
  return valor;
}

function deslocarData(iso, dias) {
  const data = new Date(`${iso}T00:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function intervalo(req, fusoHorario) {
  const hoje = dataHojeNoFuso(fusoHorario);
  const tipo = queryString(req, 'periodo') || 'dia';
  let inicio = queryString(req, 'inicio');
  let fim = queryString(req, 'fim');
  if (tipo === 'dia') inicio = fim = hoje;
  else if (tipo === 'semana') {
    inicio = deslocarData(hoje, -6);
    fim = hoje;
  } else if (tipo === 'mes') {
    inicio = `${hoje.slice(0, 7)}-01`;
    fim = hoje;
  } else if (tipo === 'ano') {
    inicio = `${hoje.slice(0, 4)}-01-01`;
    fim = hoje;
  } else if (tipo !== 'personalizado') {
    throw new ApiError(400, 'PERIODO_INVALIDO', 'Tipo de período inválido.');
  } else {
    inicio = inicio || hoje;
    fim = fim || inicio;
  }
  inicio = dataValida(inicio, 'inicio');
  fim = dataValida(fim, 'fim');
  if (inicio > fim) throw new ApiError(400, 'PERIODO_INVALIDO', 'A data inicial não pode ser posterior à data final.');
  const diferencaDias = (Date.parse(`${fim}T00:00:00.000Z`) - Date.parse(`${inicio}T00:00:00.000Z`)) / 86400000;
  if (diferencaDias > 366) throw new ApiError(400, 'PERIODO_INVALIDO', 'O período máximo para a Visão Geral é de 367 dias.');
  return { tipo, inicio, fim };
}

function dentroPeriodo(data, periodo) {
  return Boolean(data) && data >= periodo.inicio && data <= periodo.fim;
}

function valorCentavos(dados, ...campos) {
  for (const campo of campos) {
    if (dados[campo] === undefined || dados[campo] === null || dados[campo] === '') continue;
    const numero = Number(dados[campo]);
    if (!Number.isFinite(numero)) continue;
    return campo.endsWith('Centavos') ? Math.round(numero) : Math.round(numero * 100);
  }
  return 0;
}

function reais(valor) {
  return Number((Number(valor || 0) / 100).toFixed(2));
}

function inteiro(valor) {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? Math.max(0, Math.round(numero)) : 0;
}

function primeiroCampo(dados, campos) {
  for (const campo of campos) {
    if (dados[campo] !== undefined && dados[campo] !== null && dados[campo] !== '') return dados[campo];
  }
  return '';
}

function documentosDados(snapshot) {
  return snapshot.docs.map((documento) => ({ id: documento.id, dados: documento.data() || {} }));
}

function naoExcluido(item) {
  const estado = String(item.dados.estado || item.dados.status || '').toLowerCase();
  return !item.dados.excluidoEm && !['excluido', 'excluida'].includes(estado);
}

function normalizarCanal(valor) {
  const canal = String(valor || '').trim().toLowerCase();
  const mapa = { salão: 'salao', salao: 'salao', mesa: 'salao', restaurante: 'salao', delivery: 'delivery', entrega: 'delivery', retirada: 'retirada', takeout: 'retirada' };
  return mapa[canal] || canal || 'outros';
}

function nomeCanal(canal) {
  return { salao: 'Restaurante', delivery: 'Delivery', retirada: 'Retirada', outros: 'Outros' }[canal] || canal;
}

function rotuloEstadoPedido(estado) {
  const rotulos = {
    novo: 'Novo',
    aguardando_confirmacao_garcom: 'Aguardando confirmação',
    confirmado_garcom: 'Confirmado pelo garçom',
    enviado_cozinha: 'Enviado à cozinha',
    em_preparo: 'Em preparo',
    preparo: 'Em preparo',
    pronto: 'Pronto',
    servido: 'Servido',
    rejeitado_garcom: 'Recusado pelo garçom',
    cancelado: 'Cancelado',
    finalizado: 'Finalizado',
    concluido: 'Concluído',
  };
  return rotulos[estado] || estado || 'Sem status';
}

function normalizarPedido(item) {
  const dados = item.dados;
  const estado = String(dados.estado || dados.status || '').toLowerCase();
  const data = dataIso(primeiroCampo(dados, ['data', 'dataPedido', 'abertoEm', 'criadoEm']));
  const itens = Array.isArray(dados.itens) ? dados.itens : [];
  const totalCentavos = valorCentavos(dados, 'totalCentavos', 'valorCentavos', 'total');
  return {
    id: item.id,
    data,
    estado,
    statusLabel: rotuloEstadoPedido(estado),
    canal: normalizarCanal(primeiroCampo(dados, ['canal', 'origem'])),
    totalCentavos,
    horario: String(primeiroCampo(dados, ['horario', 'hora']) || horarioDeValor(primeiroCampo(dados, ['criadoEm', 'dataPedido']))),
    tempo: primeiroCampo(dados, ['tempoMinutos', 'tempoPreparo', 'tempo']) || '',
    mesa: String(primeiroCampo(dados, ['mesaId', 'idMesa', 'mesa']) || ''),
    itens,
    cliente: String(primeiroCampo(dados, ['clienteNome', 'nomeCliente']) || ''),
  };
}

function normalizarMovimentacao(item) {
  const dados = item.dados;
  return {
    id: item.id,
    data: dataIso(primeiroCampo(dados, ['data', 'dataMovimento', 'dataEm', 'criadoEm'])),
    tipo: String(dados.tipo || '').toLowerCase(),
    categoria: String(dados.categoria || ''),
    descricao: String(dados.descricao || ''),
    origem: String(dados.origem || ''),
    forma: String(dados.forma || dados.formaPagamento || ''),
    valorCentavos: valorCentavos(dados, 'valorCentavos', 'valor'),
    pedidoId: String(dados.pedidoId || ''),
    estado: String(dados.estado || dados.status || '').toLowerCase(),
  };
}

function normalizarReserva(item) {
  const dados = item.dados;
  const inicio = primeiroCampo(dados, ['inicioEm', 'inicio', 'data']);
  const inicioIso = dataIso(inicio);
  return {
    id: item.id,
    data: dataExibicao(inicioIso),
    dataIso: inicioIso,
    horario: horarioDeValor(inicio),
    cliente: String(dados.nomeCliente || dados.cliente || 'Cliente'),
    mesa: String(dados.idMesa || dados.mesaId || dados.mesa || ''),
    pessoas: inteiro(dados.quantidadePessoas || dados.pessoas),
    status: String(dados.estado || dados.status || '').toLowerCase(),
  };
}

function mesRelatorio(valor) {
  const texto = String(valor || '').trim();
  let match = texto.match(/^(\d{4})-(\d{2})$/);
  if (match) return { chave: texto, rotulo: `${MESES[Number(match[2]) - 1] || match[2]}/${match[1]}` };
  match = texto.match(/^(\d{2})\/(\d{4})$/);
  if (match) return { chave: `${match[2]}-${match[1]}`, rotulo: `${MESES[Number(match[1]) - 1] || match[1]}/${match[2]}` };
  match = texto.match(/^([A-Za-zÀ-ÿ]{3,})[\/-](\d{4})$/i);
  if (match) {
    const indice = MESES.findIndex((mes) => mes.toLocaleLowerCase('pt-BR') === match[1].slice(0, 3).toLocaleLowerCase('pt-BR'));
    if (indice >= 0) return { chave: `${match[2]}-${String(indice + 1).padStart(2, '0')}`, rotulo: `${MESES[indice]}/${match[2]}` };
  }
  return { chave: '', rotulo: texto };
}

function normalizarRelatorioFinanceiro(item) {
  const dados = item.dados || {};
  const mes = mesRelatorio(dados.mes || dados.periodo);
  const vendasCentavos = valorCentavos(dados, 'vendasCentavos', 'vendas');
  const despesasCentavos = valorCentavos(dados, 'despesasCentavos', 'despesas');
  const resultadoCentavos = dados.resultadoCentavos !== undefined || dados.resultado !== undefined
    ? valorCentavos(dados, 'resultadoCentavos', 'resultado')
    : vendasCentavos - despesasCentavos;
  return {
    id: item.id,
    mes: mes.rotulo,
    chaveMes: mes.chave,
    vendasCentavos,
    despesasCentavos,
    resultadoCentavos,
    categorias: Array.isArray(dados.categorias) ? dados.categorias.map((categoria) => ({
      nome: String(categoria.nome || categoria.categoria || ''),
      valorCentavos: valorCentavos(categoria, 'valorCentavos', 'valor', 'vendasCentavos', 'vendas'),
      percentual: Number(categoria.percentual || 0),
      cor: String(categoria.cor || 'bg-accent'),
    })).filter((categoria) => categoria.nome) : [],
  };
}

function construirCategoriasFinanceiras(relatorios, periodo) {
  const categorias = new Map();
  for (const relatorio of relatorios) {
    if (!relatorio.chaveMes || relatorio.chaveMes < periodo.inicio.slice(0, 7) || relatorio.chaveMes > periodo.fim.slice(0, 7)) continue;
    for (const categoria of relatorio.categorias) {
      const atual = categorias.get(categoria.nome) || { nome: categoria.nome, valorCentavos: 0, percentual: 0, cor: categoria.cor };
      atual.valorCentavos += categoria.valorCentavos;
      atual.percentual = Math.max(atual.percentual, categoria.percentual);
      categorias.set(categoria.nome, atual);
    }
  }
  const total = [...categorias.values()].reduce((soma, categoria) => soma + categoria.valorCentavos, 0);
  return [...categorias.values()]
    .sort((a, b) => b.valorCentavos - a.valorCentavos)
    .slice(0, 10)
    .map((categoria) => ({
      nome: categoria.nome,
      valor: reais(categoria.valorCentavos),
      percentual: total ? Math.round((categoria.valorCentavos / total) * 100) : categoria.percentual,
      cor: categoria.cor,
    }));
}

function dtoPedidoResumo(pedido) {
  return {
    id: pedido.id,
    status: pedido.estado,
    statusLabel: pedido.statusLabel,
    valor: reais(pedido.totalCentavos),
    canal: pedido.canal,
    mesa: pedido.mesa,
    cliente: pedido.cliente,
    horario: pedido.horario,
    tempo: pedido.tempo,
    data: pedido.data,
  };
}

function construirCategoriasDePedidos(pedidos, produtos, categorias, periodo) {
  const produtosPorId = new Map(produtos.map((item) => [String(item.id), item.dados]));
  const categoriasPorId = new Map(categorias.map((item) => [String(item.id), item.dados]));
  const agrupadas = new Map();
  for (const pedido of pedidos) {
    if (!dentroPeriodo(pedido.data, periodo) || ESTADOS_CANCELADOS.has(pedido.estado)) continue;
    for (const bruto of pedido.itens) {
      const item = bruto || {};
      const produtoId = String(item.produtoId || item.idProduto || item.id || '');
      const produto = produtosPorId.get(produtoId) || {};
      const categoriaId = String(item.categoriaId || produto.categoriaId || produto.categoria || '');
      const nome = String(item.categoria || categoriasPorId.get(categoriaId)?.nome || 'Sem categoria');
      const detalhe = totalDeItem(item);
      const atual = agrupadas.get(nome) || { nome, valorCentavos: 0 };
      atual.valorCentavos += detalhe.subtotal;
      agrupadas.set(nome, atual);
    }
  }
  const total = [...agrupadas.values()].reduce((soma, categoria) => soma + categoria.valorCentavos, 0);
  return [...agrupadas.values()].sort((a, b) => b.valorCentavos - a.valorCentavos).slice(0, 10).map((categoria, indice) => ({ nome: categoria.nome, valor: reais(categoria.valorCentavos), percentual: total ? Math.round((categoria.valorCentavos / total) * 100) : 0, cor: ['bg-accent', 'bg-blue', 'bg-green', 'bg-purple', 'bg-yellow'][indice % 5] }));
}

function normalizarAvaliacao(item) {
  const dados = item.dados || {};
  const dataIsoValor = dataIso(primeiroCampo(dados, ['data', 'criadoEm']));
  const cliente = String(dados.nomeCliente || dados.cliente || 'Cliente');
  return {
    id: item.id,
    cliente,
    iniciais: cliente.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase(),
    canal: String(dados.canal || dados.origem || 'não informado'),
    data: dataExibicao(dataIsoValor),
    dataIso: dataIsoValor,
    nota: inteiro(dados.nota),
    comentario: String(dados.comentario || dados.observacao || dados.mensagem || ''),
    categoria: String(dados.categoria || 'Sem categoria'),
    respondida: dados.respondida === true || Boolean(dados.respondidoEm),
  };
}

function calcularPicos(registros, periodo) {
  const grupos = { almoco: new Map(), jantar: new Map() };
  for (const registro of registros) {
    if (!dentroPeriodo(registro.data, periodo) || ESTADOS_CANCELADOS.has(registro.estado) || !registro.horario || !/^\d{2}:\d{2}/.test(registro.horario)) continue;
    const hora = Number(registro.horario.slice(0, 2));
    const faixa = FAIXAS.find((item) => hora >= Number(item.slice(0, 2)) && hora < Number(item.slice(0, 2)) + 1);
    if (!faixa) continue;
    if (hora >= 11 && hora < 16) grupos.almoco.set(faixa, (grupos.almoco.get(faixa) || 0) + 1);
    if (hora >= 18 && hora < 24) grupos.jantar.set(faixa, (grupos.jantar.get(faixa) || 0) + 1);
  }
  const maior = (grupo) => [...grupo.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || '—';
  return { picoAlmoco: maior(grupos.almoco), picoJantar: maior(grupos.jantar) };
}

function totalDeItem(item) {
  const quantidade = inteiro(item.quantidade || item.qtd || 1) || 1;
  const subtotal = valorCentavos(item, 'subtotalCentavos', 'valorTotalCentavos', 'valorCentavos', 'subtotal', 'valor');
  return { quantidade, subtotal };
}

function construirSeries(registros, periodo, movimentacoes = [], relatoriosFinanceiros = []) {
  const diarios = new Map();
  const mensais = new Map();
  const canais = new Map();
  const vendasPorCanalDia = new Map();
  const despesasPorData = new Map();
  const despesasPorMes = new Map();
  const heatmap = Array.from({ length: 7 }, () => Array(FAIXAS.length).fill(0));
  for (const movimentacao of movimentacoes) {
    if (!dentroPeriodo(movimentacao.data, periodo) || movimentacao.tipo !== 'saida' || ESTADOS_CANCELADOS.has(movimentacao.estado)) continue;
    const dia = movimentacao.data;
    const mes = dia.slice(0, 7);
    despesasPorData.set(dia, (despesasPorData.get(dia) || 0) + movimentacao.valorCentavos);
    despesasPorMes.set(mes, (despesasPorMes.get(mes) || 0) + movimentacao.valorCentavos);
  }
  const relatoriosPorMes = new Map(relatoriosFinanceiros.filter((item) => item.chaveMes).map((item) => [item.chaveMes, item]));
  for (const registro of registros) {
    if (!dentroPeriodo(registro.data, periodo) || ESTADOS_CANCELADOS.has(registro.estado)) continue;
    const chaveDia = registro.data;
    const dia = diarios.get(chaveDia) || { data: chaveDia, label: chaveDia.slice(8, 10) + '/' + chaveDia.slice(5, 7), pedidos: 0, vendasCentavos: 0, despesasCentavos: despesasPorData.get(chaveDia) || 0 };
    dia.pedidos += 1;
    dia.vendasCentavos += registro.totalCentavos;
    diarios.set(chaveDia, dia);
    const chaveMes = registro.data.slice(0, 7);
    const mes = mensais.get(chaveMes) || { chave: chaveMes, periodo: `${MESES[Number(chaveMes.slice(5, 7)) - 1]}/${chaveMes.slice(0, 4)}`, pedidos: 0, vendasCentavos: 0, despesasCentavos: despesasPorMes.get(chaveMes) || 0 };
    mes.pedidos += 1;
    mes.vendasCentavos += registro.totalCentavos;
    mensais.set(chaveMes, mes);
    const canal = normalizarCanal(registro.canal);
    const canalAtual = canais.get(canal) || { id: canal, nome: nomeCanal(canal), vendasCentavos: 0, pedidos: 0 };
    canalAtual.vendasCentavos += registro.totalCentavos;
    canalAtual.pedidos += 1;
    canais.set(canal, canalAtual);
    const chaveCanalDia = `${canal}|${chaveDia}`;
    const canalDia = vendasPorCanalDia.get(chaveCanalDia) || { canal, data: chaveDia, label: chaveDia.slice(8, 10) + '/' + chaveDia.slice(5, 7), pedidos: 0, vendasCentavos: 0 };
    canalDia.vendasCentavos += registro.totalCentavos;
    canalDia.pedidos += 1;
    vendasPorCanalDia.set(chaveCanalDia, canalDia);
    if (registro.horario && /^\d{2}:\d{2}/.test(registro.horario)) {
      const hora = Number(registro.horario.slice(0, 2));
      const faixa = FAIXAS.findIndex((item) => hora >= Number(item.slice(0, 2)) && hora < Number(item.slice(0, 2)) + 1);
      const diaSemana = (Date.parse(`${registro.data}T00:00:00.000Z`) / 86400000 + 4) % 7;
      if (faixa >= 0 && Number.isInteger(diaSemana)) heatmap[diaSemana][faixa] += 1;
    }
  }
  for (const [data, despesasCentavos] of despesasPorData.entries()) {
    if (!diarios.has(data)) diarios.set(data, { data, label: data.slice(8, 10) + '/' + data.slice(5, 7), pedidos: 0, vendasCentavos: 0, despesasCentavos });
  }
  for (const [mes, relatorio] of relatoriosPorMes.entries()) {
    if (!mensais.has(mes) && mes >= periodo.inicio.slice(0, 7) && mes <= periodo.fim.slice(0, 7)) mensais.set(mes, { chave: mes, periodo: `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`, pedidos: 0, vendasCentavos: relatorio.vendasCentavos, despesasCentavos: relatorio.despesasCentavos });
    else if (mensais.has(mes) && !despesasPorMes.has(mes) && relatorio.despesasCentavos > 0) mensais.get(mes).despesasCentavos = relatorio.despesasCentavos;
  }
  const vendasDiarias = [...diarios.values()].sort((a, b) => a.data.localeCompare(b.data)).map((item) => ({ ...item, vendas: reais(item.vendasCentavos), despesas: reais(item.despesasCentavos), resultado: reais(item.vendasCentavos - item.despesasCentavos), ticketMedio: reais(item.pedidos ? item.vendasCentavos / item.pedidos : 0) }));
  const vendasMensais = [...mensais.values()].sort((a, b) => a.chave.localeCompare(b.chave)).map((item) => ({ ...item, vendas: reais(item.vendasCentavos), despesas: reais(item.despesasCentavos), resultado: reais(item.vendasCentavos - item.despesasCentavos), ticketMedio: reais(item.pedidos ? item.vendasCentavos / item.pedidos : 0) }));
  const totalVendasCentavos = registros.reduce((total, registro) => total + (dentroPeriodo(registro.data, periodo) && !ESTADOS_CANCELADOS.has(registro.estado) ? registro.totalCentavos : 0), 0);
  const totalPedidos = registros.filter((registro) => dentroPeriodo(registro.data, periodo) && !ESTADOS_CANCELADOS.has(registro.estado)).length;
  const despesasMovimentacoesCentavos = [...despesasPorData.values()].reduce((total, valor) => total + valor, 0);
  const despesasRelatoriosCentavos = vendasMensais.reduce((total, item) => total + Number(item.despesasCentavos || 0), 0);
  const despesasPeriodoCentavos = despesasMovimentacoesCentavos || despesasRelatoriosCentavos;
  const vendasSemanais = totalPedidos || despesasPeriodoCentavos ? [{ periodo: `${periodo.inicio.slice(8, 10)}/${periodo.inicio.slice(5, 7)}–${periodo.fim.slice(8, 10)}/${periodo.fim.slice(5, 7)}`, pedidos: totalPedidos, vendas: reais(totalVendasCentavos), despesas: reais(despesasPeriodoCentavos), resultado: reais(totalVendasCentavos - despesasPeriodoCentavos), ticketMedio: reais(totalPedidos ? totalVendasCentavos / totalPedidos : 0) }] : [];
  const totalCanais = [...canais.values()].reduce((total, canal) => total + canal.vendasCentavos, 0);
  const canaisDto = [...canais.values()].sort((a, b) => b.vendasCentavos - a.vendasCentavos).map((canal) => ({ id: canal.id, nome: canal.nome, percentual: totalCanais ? Math.round((canal.vendasCentavos / totalCanais) * 100) : 0, vendas: reais(canal.vendasCentavos), pedidos: canal.pedidos }));
  const vendasPorCanal = [...vendasPorCanalDia.values()].sort((a, b) => a.data.localeCompare(b.data) || a.canal.localeCompare(b.canal)).map((item) => ({ canal: item.canal, nomeCanal: nomeCanal(item.canal), data: item.data, label: item.label, pedidos: item.pedidos, vendas: reais(item.vendasCentavos) }));
  const temHeatmap = heatmap.some((linha) => linha.some((valor) => valor > 0));
  const despesasTotalCentavos = despesasPeriodoCentavos;
  const picos = calcularPicos(registros, periodo);
  return {
    vendasDiarias,
    vendasSemanais,
    vendasMensais,
    despesasTotalCentavos,
    picos,
    canais: canaisDto,
    vendasPorCanal,
    diasSemana: temHeatmap ? DIAS.slice(1).concat(DIAS[0]) : [],
    faixasHorarias: temHeatmap ? FAIXAS : [],
    mapaCalor: temHeatmap ? heatmap.slice(1).concat([heatmap[0]]) : [],
    totalVendasCentavos,
    totalPedidos,
  };
}

function construirRankingProdutos(pedidos, produtos, categorias, periodo) {
  const produtosPorId = new Map(produtos.map((item) => [String(item.id), item.dados]));
  const categoriasPorId = new Map(categorias.map((item) => [String(item.id), item.dados]));
  const ranking = new Map();
  for (const pedido of pedidos) {
    if (!dentroPeriodo(pedido.data, periodo) || ESTADOS_CANCELADOS.has(pedido.estado)) continue;
    for (const bruto of pedido.itens) {
      const item = bruto || {};
      const produtoId = String(item.produtoId || item.idProduto || item.id || '');
      const dadosProduto = produtosPorId.get(produtoId) || {};
      const nome = String(item.nome || item.nomeProduto || dadosProduto.nome || '');
      if (!nome) continue;
      const detalhe = totalDeItem(item);
      const chave = produtoId || nome;
      const atual = ranking.get(chave) || { produtoId: produtoId || null, nome, quantidade: 0, receitaCentavos: 0, categoriaId: String(item.categoriaId || dadosProduto.categoriaId || dadosProduto.categoria || '') };
      atual.quantidade += detalhe.quantidade;
      atual.receitaCentavos += detalhe.subtotal;
      ranking.set(chave, atual);
    }
  }
  return [...ranking.values()].sort((a, b) => b.quantidade - a.quantidade || b.receitaCentavos - a.receitaCentavos).slice(0, 10).map((item, indice) => ({
    posicao: indice + 1,
    produtoId: item.produtoId,
    nome: item.nome,
    quantidade: item.quantidade,
    receita: reais(item.receitaCentavos),
    categoriaId: item.categoriaId,
    categoria: categoriasPorId.get(item.categoriaId)?.nome || 'Sem categoria',
  }));
}

function construirAvaliacoes(avaliacoes, periodo) {
  const notas = new Map();
  let soma = 0;
  let total = 0;
  let respondidas = 0;
  const itens = [];
  for (const item of avaliacoes) {
    const avaliacao = normalizarAvaliacao(item);
    if (!dentroPeriodo(avaliacao.dataIso, periodo)) continue;
    if (avaliacao.nota < 1 || avaliacao.nota > 5) continue;
    total += 1;
    soma += avaliacao.nota;
    notas.set(avaliacao.nota, (notas.get(avaliacao.nota) || 0) + 1);
    if (avaliacao.respondida) respondidas += 1;
    itens.push(avaliacao);
  }
  const distribuicaoNotas = [5, 4, 3, 2, 1].map((nota) => ({ nota, quantidade: notas.get(nota) || 0, percentual: total ? Math.round(((notas.get(nota) || 0) / total) * 100) : 0 }));
  return { distribuicaoNotas, indicadores: { notaMedia: total ? Number((soma / total).toFixed(1)) : 0, totalAvaliacoes: total, taxaResposta: total ? Math.round((respondidas / total) * 100) : 0 }, avaliacoes: itens.sort((a, b) => b.dataIso.localeCompare(a.dataIso)).slice(0, 20) };
}

function dtoCatalogo(item) {
  const dados = item.dados;
  return {
    id: item.id,
    nome: String(dados.nome || ''),
    descricao: String(dados.descricao || ''),
    categoria: String(dados.idCategoria || dados.categoriaId || dados.categoria || ''),
    preco: reais(valorCentavos(dados, 'precoCentavos', 'preco')),
    custo: reais(valorCentavos(dados, 'custoCentavos', 'custo')),
    disponibilidade: dados.disponibilidade !== undefined ? Boolean(dados.disponibilidade) : dados.disponivel !== false,
    ativo: dados.ativo !== false && dados.estado !== 'inativo',
    estoque: inteiro(dados.estoque),
  };
}

function dtoCategoria(item) {
  const dados = item.dados;
  return { id: item.id, nome: String(dados.nome || ''), descricao: String(dados.descricao || ''), ordem: inteiro(dados.ordem), ativo: dados.ativo !== false && dados.estado !== 'inativo' };
}

function construirFuncionarios(funcionarios) {
  return funcionarios
    .filter(naoExcluido)
    .map((item, indice) => {
      const dados = item.dados;
      return {
        funcionarioId: item.id,
        nome: String(dados.nome || ''),
        cargo: String(dados.cargo || ''),
        status: String(dados.estado || dados.status || ''),
        vendas: reais(valorCentavos(dados, 'vendasMesCentavos', 'vendasCentavos')),
        pedidos: inteiro(dados.pedidos),
        avaliacao: Number(dados.avaliacao || 0),
        posicao: indice + 1,
      };
    })
    .filter((item) => item.nome)
    .sort((a, b) => b.vendas - a.vendas)
    .map((item, indice) => ({ ...item, posicao: indice + 1 }));
}

async function listarColecoes(restaurante, nomes, limite) {
  const documentos = await Promise.all(nomes.map(async (nome) => [nome, await restaurante.collection(nome).limit(limite).get()]));
  return Object.fromEntries(documentos);
}

async function listarVisaoGeral(identidade, req) {
  const restaurante = caminhoRestaurante(identidade.idRestaurante);
  const restauranteDocumento = await restaurante.get();
  const dadosRestaurante = restauranteDocumento.exists ? restauranteDocumento.data() || {} : {};
  const fusoHorario = String(dadosRestaurante.fusoHorario || 'America/Sao_Paulo');
  const periodo = intervalo(req, fusoHorario);
  const limite = limitarInteiro(req.query?.limite, 500, 1000);
  const colecoes = await listarColecoes(restaurante, ['pedidos', 'movimentacoesCaixa', 'fechamentosCaixa', 'relatoriosFinanceiros', 'mesas', 'reservas', 'produtosCardapio', 'categoriasCardapio', 'funcionarios', 'avaliacoes'], limite);
  const pedidos = documentosDados(colecoes.pedidos).filter(naoExcluido).map(normalizarPedido);
  const movimentacoes = documentosDados(colecoes.movimentacoesCaixa).filter(naoExcluido).map(normalizarMovimentacao);
  const pedidosComVenda = pedidos.filter((pedido) => pedido.totalCentavos > 0 && ESTADOS_CONCLUIDOS.has(pedido.estado));
  const vendasPorMovimentacao = movimentacoes.filter((movimentacao) => movimentacao.tipo === 'entrada' && movimentacao.valorCentavos > 0 && !ESTADOS_CANCELADOS.has(movimentacao.estado) && (movimentacao.pedidoId || /venda|delivery|retirada|sal[aã]o/i.test(`${movimentacao.categoria} ${movimentacao.origem}`))).map((movimentacao) => ({ ...movimentacao, totalCentavos: movimentacao.valorCentavos, canal: normalizarCanal(movimentacao.origem || movimentacao.categoria || 'outros'), estado: movimentacao.estado }));
  const registrosVenda = pedidosComVenda.length ? pedidosComVenda : vendasPorMovimentacao;
  const relatoriosFinanceiros = documentosDados(colecoes.relatoriosFinanceiros).filter(naoExcluido).map(normalizarRelatorioFinanceiro).filter((item) => item.mes);
  const categoriasFinanceiras = construirCategoriasFinanceiras(relatoriosFinanceiros, periodo);
  const series = construirSeries(registrosVenda, periodo, movimentacoes, relatoriosFinanceiros);
  const mesas = documentosDados(colecoes.mesas).filter(naoExcluido).map((item) => ({ id: item.id, nome: String(item.dados.nome || item.dados.numero || `Mesa ${item.id}`), capacidade: inteiro(item.dados.capacidade), status: String(item.dados.estado || item.dados.status || 'disponivel') }));
  const reservas = documentosDados(colecoes.reservas).filter(naoExcluido).map(normalizarReserva).filter((item) => dentroPeriodo(item.dataIso, periodo));
  const produtos = documentosDados(colecoes.produtosCardapio).filter(naoExcluido);
  const categorias = documentosDados(colecoes.categoriasCardapio).filter(naoExcluido);
  const categoriasDePedidos = construirCategoriasDePedidos(pedidos, produtos, categorias, periodo);
  const categoriasVisao = categoriasDePedidos.length ? categoriasDePedidos : categoriasFinanceiras;
  const funcionarios = documentosDados(colecoes.funcionarios).filter(naoExcluido);
  const avaliacoes = documentosDados(colecoes.avaliacoes).filter(naoExcluido);
  const ocupadas = mesas.filter((mesa) => mesa.status === 'ocupada').length;
  const bloqueadas = mesas.filter((mesa) => mesa.status === 'indisponivel').length;
  const fechamentos = documentosDados(colecoes.fechamentosCaixa).filter(naoExcluido).sort((a, b) => dataIso(primeiroCampo(b.dados, ['data', 'criadoEm'])).localeCompare(dataIso(primeiroCampo(a.dados, ['data', 'criadoEm']))));
  const fechamentoAtual = fechamentos[0]?.dados || null;
  const fluxo = movimentacoes.filter((item) => dentroPeriodo(item.data, periodo)).map((item) => ({ ...item, valor: reais(item.valorCentavos) }));
  const despesasCentavos = series.despesasTotalCentavos || fluxo.filter((item) => item.tipo === 'saida').reduce((total, item) => total + item.valorCentavos, 0);
  const financeiro = {
    caixaAtual: fechamentoAtual ? { data: dataIso(primeiroCampo(fechamentoAtual, ['data', 'criadoEm'])), vendas: reais(valorCentavos(fechamentoAtual, 'vendasCentavos', 'vendas')), abertura: reais(valorCentavos(fechamentoAtual, 'aberturaCentavos', 'abertura')), suprimentos: reais(valorCentavos(fechamentoAtual, 'suprimentosCentavos', 'suprimentos')), sangrias: reais(valorCentavos(fechamentoAtual, 'sangriasCentavos', 'sangrias')), retiradas: reais(valorCentavos(fechamentoAtual, 'retiradasCentavos', 'retiradas')), saldoEsperado: reais(valorCentavos(fechamentoAtual, 'saldoEsperadoCentavos', 'saldoEsperado')), status: String(fechamentoAtual.estado || fechamentoAtual.status || '') } : {},
    recebimentos: Array.isArray(fechamentoAtual?.recebimentos) ? fechamentoAtual.recebimentos.map((item) => ({ meio: String(item.meio || ''), valor: reais(valorCentavos(item, 'valorCentavos', 'valor')), transacoes: inteiro(item.transacoes) })) : [],
    fluxo,
    contas: [],
    relatoriosMensais: series.vendasMensais.map((item) => ({ mes: item.periodo, vendas: item.vendas, despesas: item.despesas, resultado: item.resultado })),
    categorias: categoriasVisao,
    resumoFinanceiro: { vendasCentavos: series.totalVendasCentavos, despesasCentavos, resultadoCentavos: series.totalVendasCentavos - despesasCentavos },
  };
  const avaliacao = construirAvaliacoes(avaliacoes, periodo);
  const diasComMesas = Math.max(mesas.length, 1);
  const resposta = {
    periodo,
    financeiro,
    salao: { mesas, reservas, ocupacao: Math.round((ocupadas / diasComMesas) * 100), ocupadas, disponiveis: mesas.filter((mesa) => mesa.status === 'disponivel').length, bloqueadas },
    operacao: { pedidosAtivos: pedidos.filter((pedido) => dentroPeriodo(pedido.data, periodo) && !ESTADOS_CANCELADOS.has(pedido.estado) && !ESTADOS_CONCLUIDOS.has(pedido.estado)).map(dtoPedidoResumo), pedidosHistorico: pedidos.filter((pedido) => dentroPeriodo(pedido.data, periodo)).map(dtoPedidoResumo) },
    cardapio: { produtos: produtos.map(dtoCatalogo).filter((item) => item.nome), categorias: categorias.map(dtoCategoria).filter((item) => item.nome), produtosMaisVendidos: construirRankingProdutos(pedidos, produtos, categorias, periodo) },
    equipe: { funcionarios: construirFuncionarios(funcionarios), comissoes: [] },
    relatorios: { ...series, ...avaliacao, indicadores: { ...series.indicadores, ...series.picos, ...avaliacao.indicadores }, produtosMaisVendidos: construirRankingProdutos(pedidos, produtos, categorias, periodo), performanceEquipe: construirFuncionarios(funcionarios), atualizadoEm: new Date().toISOString(), origem: 'Cloud Firestore' },
    indicadores: { vendasCentavos: series.totalVendasCentavos, pedidos: series.totalPedidos, despesasCentavos, resultadoCentavos: series.totalVendasCentavos - despesasCentavos, picoAlmoco: series.picos.picoAlmoco, picoJantar: series.picos.picoJantar, notaMedia: avaliacao.indicadores.notaMedia, totalAvaliacoes: avaliacao.indicadores.totalAvaliacoes },
    meta: { idRestaurante: identidade.idRestaurante, fusoHorario, inicio: periodo.inicio, fim: periodo.fim, limite, fonte: 'firestore', dadosDisponiveis: Boolean(series.totalPedidos || mesas.length || reservas.length || produtos.length || funcionarios.length || fluxo.length) },
  };
  return { corpo: resposta };
}

async function visaoGeral(req, res) {
  return executar(req, res, { metodos: ['GET'], mutacao: false, appCheck: true }, async () => {
    const identidade = await obterIdentidadeOperacional(req, PAPEIS_LEITURA);
    return listarVisaoGeral(identidade, req);
  });
}

module.exports = visaoGeral;
module.exports.internals = {
  intervalo,
  normalizarPedido,
  normalizarMovimentacao,
  normalizarReserva,
  normalizarRelatorioFinanceiro,
  construirCategoriasFinanceiras,
  construirCategoriasDePedidos,
  construirSeries,
  construirAvaliacoes,
  calcularPicos,
};
