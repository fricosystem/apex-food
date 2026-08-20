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
    const pausa = minutosHora(intervalo);
    if (pausa < inicio || pausa > fim) throw new ApiError(400, 'INTERVALO_INVALIDO', 'O intervalo deve estar dentro da jornada.');
  }
  return { inicio, fim };
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
    const inicio = jornadaExistente.inicio;
    let fim = jornadaExistente.fim;
    const inicioNova = jornadaNova.inicio;
    let fimNova = jornadaNova.fim;
    if (fim < inicio) fim += 24 * 60;
    if (fimNova < inicioNova) fimNova += 24 * 60;
    if (inicioNova < fim && fimNova > inicio) throw new ApiError(409, 'ESCALA_EM_CONFLITO', 'Já existe uma escala sobreposta para este funcionário e data.');
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
