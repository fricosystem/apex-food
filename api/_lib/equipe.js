'use strict';

const { ApiError } = require('./http');
const {
  caminhoRestaurante,
  obterIdentidadeOperacional,
  limitarInteiro,
  textoObrigatorio,
  textoOpcional,
  inteiroNaoNegativo,
  enumObrigatorio,
  timestampParaIso,
  mascararContato,
  queryString,
  listarColecao,
  registrarAuditoriaOperacional,
} = require('./modulos-operacionais');

const PAPEIS_LEITURA_EQUIPE = ['proprietario', 'administrador', 'gerente', 'financeiro', 'analista', 'auditor'];
const PAPEIS_MUTACAO_EQUIPE = ['proprietario', 'administrador'];
const PAPEIS_ESCALA = ['proprietario', 'administrador', 'gerente'];
const PAPEIS_COMISSAO = ['proprietario', 'administrador', 'gerente', 'financeiro', 'analista', 'auditor'];
const STATUS_FUNCIONARIO = new Set(['ativo', 'ferias', 'inativo']);
const STATUS_ESCALA = new Set(['agendado', 'presente', 'folga', 'falta', 'cancelado']);
const TURNOS = new Set(['Almoço', 'Jantar', 'Integral']);
const SETORES = new Set(['Salão', 'Cozinha', 'Bar', 'Gestão']);
const PAPEIS_OPERACIONAIS = new Set(['garcom', 'cozinha', 'caixa', 'supervisor']);
const DISPONIBILIDADES_ATENDIMENTO = new Set(['disponivel', 'em_atendimento', 'pausado', 'indisponivel']);
const MAX_CAPACIDADE_OPERACIONAL = 1000;
const MAX_PRIORIDADE_DISTRIBUICAO = 1000;

function idDocumento(valor, campo = 'id') {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(valor)) {
    throw new ApiError(400, 'ID_INVALIDO', `${campo} inválido.`);
  }
  return valor;
}

function nomeInicial(nome) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((parte) => parte[0].toUpperCase()).join('') || '—';
}

function percentualSeguro(valor, campo = 'percentualComissao') {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || numero > 100 || Math.round(numero * 100) !== numero * 100) {
    throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} é inválido.`);
  }
  return Number(numero.toFixed(2));
}

function dataEquipe(valor, campo = 'data') {
  if (typeof valor !== 'string') throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} é obrigatória.`);
  const texto = valor.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const data = new Date(`${texto}T00:00:00Z`);
    if (!Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto) return texto;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [dia, mes, ano] = texto.split('/');
    const normalizada = `${ano}-${mes}-${dia}`;
    const data = new Date(`${normalizada}T00:00:00Z`);
    if (!Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === normalizada) return normalizada;
  }
  throw new ApiError(400, 'DATA_INVALIDA', `${campo} é inválida.`);
}

function horaEquipe(valor, campo) {
  if (typeof valor !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor.trim())) {
    throw new ApiError(400, 'HORARIO_INVALIDO', `${campo} é inválido.`);
  }
  return valor.trim();
}

function minutosHora(valor) {
  const [hora, minuto] = valor.split(':').map(Number);
  return hora * 60 + minuto;
}

function validarJornada(entrada, saida, intervalo) {
  const inicio = minutosHora(entrada);
  let fim = minutosHora(saida);
  if (fim <= inicio) fim += 24 * 60;
  if (fim - inicio < 30 || fim - inicio > 16 * 60) throw new ApiError(400, 'JORNADA_INVALIDA', 'A jornada deve ter entre 30 minutos e 16 horas.');
  if (intervalo) {
    let pausa = minutosHora(intervalo);
    if (pausa < inicio) pausa += 24 * 60;
    if (pausa < inicio || pausa > fim) throw new ApiError(400, 'INTERVALO_INVALIDO', 'O intervalo deve estar dentro da jornada.');
  }
  return { inicio, fim };
}

function jornadasSobrepostas(primeira, segunda) {
  const intervalosPrimeira = [primeira, [primeira[0] - 24 * 60, primeira[1] - 24 * 60], [primeira[0] + 24 * 60, primeira[1] + 24 * 60]];
  const intervalosSegunda = [segunda, [segunda[0] - 24 * 60, segunda[1] - 24 * 60], [segunda[0] + 24 * 60, segunda[1] + 24 * 60]];
  return intervalosPrimeira.some(([inicioA, fimA]) => intervalosSegunda.some(([inicioB, fimB]) => inicioA < fimB && fimA > inicioB));
}

function capacidadeOperacional(valor, campo, padrao = 1) {
  if (valor === undefined || valor === null || valor === '') return padrao;
  const numero = inteiroNaoNegativo(valor, campo, MAX_CAPACIDADE_OPERACIONAL);
  if (numero < 1) throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} deve ser um inteiro positivo.`);
  return numero;
}

function prioridadeOperacional(valor) {
  if (valor === undefined || valor === null || valor === '') return 0;
  return inteiroNaoNegativo(valor, 'prioridadeDistribuicao', MAX_PRIORIDADE_DISTRIBUICAO);
}

function listaOperacional(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return [];
  const itens = Array.isArray(valor) ? valor : typeof valor === 'string' ? valor.split(',') : null;
  if (!itens || itens.length > 30) throw new ApiError(400, 'PAYLOAD_INVALIDO', `${campo} é inválido.`);
  const vistos = new Set();
  return itens.map((item) => textoObrigatorio(String(item).replace(/\s+/g, ' ').trim(), `${campo}[]`, 80)).filter(item => {
    const chave = item.toLocaleLowerCase('pt-BR');
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

function papelOperacional(valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  return enumObrigatorio(valor, PAPEIS_OPERACIONAIS, 'papelOperacional');
}

function periodoComissao(valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  if (typeof valor !== 'string') throw new ApiError(400, 'PERIODO_INVALIDO', 'Período de comissão inválido.');
  const periodo = valor.trim();
  if (!periodo || periodo.length > 40 || !/^[\p{L}\p{N}][\p{L}\p{N} .\/_-]*$/u.test(periodo)) {
    throw new ApiError(400, 'PERIODO_INVALIDO', 'Período de comissão inválido.');
  }
  return periodo;
}

function dtoFuncionario(documento) {
  const dados = documento.data() || {};
  return {
    id: documento.id,
    nome: dados.nome || '',
    iniciais: dados.iniciais || nomeInicial(dados.nome || ''),
    cargo: dados.cargo || '',
    setor: dados.setor || '',
    telefone: dados.telefoneMascarado || mascararContato(dados.telefone || ''),
    status: dados.status || 'ativo',
    turno: dados.turno || '',
    comissao: Number(dados.percentualComissao || 0),
    avaliacao: Number(dados.avaliacao || 0),
    pedidos: Number(dados.pedidos || 0),
    vendasMesCentavos: Number(dados.vendasMesCentavos || 0),
    cor: dados.cor || 'from-slate-400 to-slate-600',
    papelOperacional: dados.papelOperacional || '',
    disponibilidadeAtendimento: dados.disponibilidadeAtendimento || 'disponivel',
    capacidadeMesas: Number(dados.capacidadeMesas || 1),
    capacidadeComandas: Number(dados.capacidadeComandas || 1),
    capacidadePedidos: Number(dados.capacidadePedidos || 1),
    capacidadeTarefas: Number(dados.capacidadeTarefas || dados.capacidadePedidos || 1),
    especialidadesCozinha: Array.isArray(dados.especialidadesCozinha) ? dados.especialidadesCozinha : [],
    estacoesCozinha: Array.isArray(dados.estacoesCozinha) ? dados.estacoesCozinha : [],
    cargaAtual: {
      mesasAtivas: Number(dados.cargaAtual?.mesasAtivas || 0),
      comandasAtivas: Number(dados.cargaAtual?.comandasAtivas || 0),
      pedidosPendentes: Number(dados.cargaAtual?.pedidosPendentes || 0),
      tarefasAtivas: Number(dados.cargaAtual?.tarefasAtivas || 0),
    },
    ultimaAtribuicaoEm: timestampParaIso(dados.ultimaAtribuicaoEm),
    prioridadeDistribuicao: Number(dados.prioridadeDistribuicao || 0),
  };
}

function dtoEscala(documento) {
  const dados = documento.data() || {};
  return {
    id: documento.id,
    funcionarioId: dados.funcionarioId || '',
    data: dados.data || '',
    entrada: dados.entrada || '',
    saida: dados.saida || '',
    intervalo: dados.intervalo || '',
    turno: dados.turno || '',
    status: dados.status || 'agendado',
  };
}

function dtoComissao(documento) {
  const dados = documento.data() || {};
  return {
    id: documento.id,
    funcionarioId: dados.funcionarioId || '',
    periodo: dados.periodo || '',
    vendasCentavos: Number(dados.vendasCentavos || 0),
    percentual: Number(dados.percentual || 0),
    comissaoCentavos: Number(dados.comissaoCentavos || 0),
    pedidos: Number(dados.pedidos || 0),
    variacao: Number(dados.variacaoPercentual || 0),
    posicao: Number(dados.posicao || 0),
  };
}

function dadosFuncionario(corpo) {
  const nome = textoObrigatorio(corpo.nome, 'nome', 160);
  const cargo = textoObrigatorio(corpo.cargo, 'cargo', 80);
  const setor = enumObrigatorio(corpo.setor, SETORES, 'setor');
  const turno = enumObrigatorio(corpo.turno, TURNOS, 'turno');
  const status = corpo.status === undefined ? 'ativo' : enumObrigatorio(corpo.status, STATUS_FUNCIONARIO, 'status');
  const percentualComissao = corpo.percentualComissao === undefined ? 0 : percentualSeguro(corpo.percentualComissao);
  const telefone = textoOpcional(corpo.telefone, 'telefone', 40);
  const disponibilidadeAtendimento = corpo.disponibilidadeAtendimento === undefined ? 'disponivel' : enumObrigatorio(corpo.disponibilidadeAtendimento, DISPONIBILIDADES_ATENDIMENTO, 'disponibilidadeAtendimento');
  return {
    nome,
    iniciais: nomeInicial(nome),
    cargo,
    setor,
    turno,
    status,
    percentualComissao,
    telefone,
    telefoneMascarado: mascararContato(telefone),
    cor: typeof corpo.cor === 'string' && /^from-[a-z0-9-]+ to-[a-z0-9-]+$/.test(corpo.cor) ? corpo.cor : 'from-slate-400 to-slate-600',
    papelOperacional: papelOperacional(corpo.papelOperacional),
    disponibilidadeAtendimento,
    capacidadeMesas: capacidadeOperacional(corpo.capacidadeMesas, 'capacidadeMesas'),
    capacidadeComandas: capacidadeOperacional(corpo.capacidadeComandas, 'capacidadeComandas'),
    capacidadePedidos: capacidadeOperacional(corpo.capacidadePedidos, 'capacidadePedidos'),
    capacidadeTarefas: capacidadeOperacional(corpo.capacidadeTarefas, 'capacidadeTarefas'),
    especialidadesCozinha: listaOperacional(corpo.especialidadesCozinha, 'especialidadesCozinha'),
    estacoesCozinha: listaOperacional(corpo.estacoesCozinha, 'estacoesCozinha'),
    prioridadeDistribuicao: prioridadeOperacional(corpo.prioridadeDistribuicao),
  };
}

function dadosEscala(corpo) {
  const funcionarioId = idDocumento(corpo.funcionarioId, 'funcionarioId');
  const data = dataEquipe(corpo.data);
  const entrada = horaEquipe(corpo.entrada, 'entrada');
  const saida = horaEquipe(corpo.saida, 'saida');
  const intervalo = corpo.intervalo ? horaEquipe(corpo.intervalo, 'intervalo') : '';
  validarJornada(entrada, saida, intervalo);
  const turno = enumObrigatorio(corpo.turno, TURNOS, 'turno');
  const status = corpo.status === undefined ? 'agendado' : enumObrigatorio(corpo.status, STATUS_ESCALA, 'status');
  return { funcionarioId, data, entrada, saida, intervalo, turno, status };
}

async function garantirFuncionario(restaurante, funcionarioId) {
  const referencia = restaurante.collection('funcionarios').doc(idDocumento(funcionarioId, 'funcionarioId'));
  const documento = await referencia.get();
  if (!documento.exists || documento.data()?.estado === 'excluido') throw new ApiError(400, 'FUNCIONARIO_NAO_ENCONTRADO', 'Funcionário não encontrado.');
  return referencia;
}

async function validarConflitoEscala(transacao, restaurante, dados, idIgnorar = null) {
  const existentes = await transacao.get(restaurante.collection('escalas').where('funcionarioId', '==', dados.funcionarioId));
  const jornadaNova = validarJornada(dados.entrada, dados.saida, dados.intervalo);
  for (const documento of existentes.docs) {
    if (idIgnorar && documento.id === idIgnorar) continue;
    const escala = documento.data() || {};
    if (escala.data !== dados.data || ['cancelado', 'folga'].includes(escala.status)) continue;
    const jornadaExistente = validarJornada(escala.entrada, escala.saida, escala.intervalo);
    if (jornadasSobrepostas([jornadaExistente.inicio, jornadaExistente.fim], [jornadaNova.inicio, jornadaNova.fim])) {
      throw new ApiError(409, 'ESCALA_EM_CONFLITO', 'Já existe uma escala sobreposta para este funcionário e data.');
    }
  }
}

module.exports = {
  PAPEIS_LEITURA_EQUIPE,
  PAPEIS_MUTACAO_EQUIPE,
  PAPEIS_ESCALA,
  PAPEIS_COMISSAO,
  STATUS_FUNCIONARIO,
  STATUS_ESCALA,
  TURNOS,
  SETORES,
  PAPEIS_OPERACIONAIS,
  DISPONIBILIDADES_ATENDIMENTO,
  MAX_CAPACIDADE_OPERACIONAL,
  capacidadeOperacional,
  prioridadeOperacional,
  listaOperacional,
  idDocumento,
  nomeInicial,
  percentualSeguro,
  dataEquipe,
  horaEquipe,
  minutosHora,
  validarJornada,
  dtoFuncionario,
  dtoEscala,
  dtoComissao,
  dadosFuncionario,
  dadosEscala,
  garantirFuncionario,
  validarConflitoEscala,
  jornadasSobrepostas,
  periodoComissao,
  caminhoRestaurante,
  obterIdentidadeOperacional,
  limitarInteiro,
  textoObrigatorio,
  textoOpcional,
  inteiroNaoNegativo,
  enumObrigatorio,
  timestampParaIso,
  mascararContato,
  queryString,
  listarColecao,
  registrarAuditoriaOperacional,
};
