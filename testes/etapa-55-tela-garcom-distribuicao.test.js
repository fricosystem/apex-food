const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const documento = (id, dados) => ({ id, data: () => dados });
const equipe = require('../api/_lib/equipe');
const pedidos = require('../api/_lib/pedidos-handler');

test('equipe expõe os enums e limites operacionais da Fase 3', () => {
  assert.ok(equipe.PAPEIS_OPERACIONAIS.has('garcom'));
  assert.ok(equipe.DISPONIBILIDADES_ATENDIMENTO.has('disponivel'));
  assert.ok(equipe.DISPONIBILIDADES_ATENDIMENTO.has('em_atendimento'));
  assert.equal(equipe.MAX_CAPACIDADE_OPERACIONAL, 1000);
});

test('dados de funcionário normalizam papel, disponibilidade, capacidade e prioridade', () => {
  const dados = equipe.dadosFuncionario({ nome: 'Ana Lima', cargo: 'Garçom', setor: 'Salão', turno: 'Jantar', papelOperacional: 'garcom', disponibilidadeAtendimento: 'disponivel', capacidadeMesas: 6, capacidadeComandas: 4, capacidadePedidos: 12, prioridadeDistribuicao: 2 });
  assert.deepEqual({ papel: dados.papelOperacional, disponibilidade: dados.disponibilidadeAtendimento, mesas: dados.capacidadeMesas, comandas: dados.capacidadeComandas, pedidos: dados.capacidadePedidos, prioridade: dados.prioridadeDistribuicao }, { papel: 'garcom', disponibilidade: 'disponivel', mesas: 6, comandas: 4, pedidos: 12, prioridade: 2 });
});

test('capacidades operacionais não aceitam zero, fração, negativos ou valores ilimitados', () => {
  assert.throws(() => equipe.capacidadeOperacional(0, 'capacidadeMesas'), /inteiro positivo/);
  assert.throws(() => equipe.capacidadeOperacional(-1, 'capacidadeMesas'), /inteiro não negativo/);
  assert.throws(() => equipe.capacidadeOperacional(1.5, 'capacidadePedidos'), /inteiro não negativo/);
  assert.throws(() => equipe.capacidadeOperacional(1001, 'capacidadeComandas'), /inteiro não negativo/);
  assert.throws(() => equipe.dadosFuncionario({ nome: 'Ana', cargo: 'Garçom', setor: 'Salão', turno: 'Jantar', disponibilidadeAtendimento: 'fora_do_padrao' }), /disponibilidadeAtendimento é inválido/);
});

test('DTO público da equipe entrega carga e última atribuição sem dados sensíveis', () => {
  const dto = equipe.dtoFuncionario(documento('FUN-1', { idRestaurante: 'segredo', nome: 'Ana Lima', cargo: 'Garçom', setor: 'Salão', turno: 'Jantar', papelOperacional: 'garcom', disponibilidadeAtendimento: 'em_atendimento', capacidadeMesas: 6, capacidadeComandas: 4, capacidadePedidos: 12, cargaAtual: { mesasAtivas: 2, comandasAtivas: 1, pedidosPendentes: 3 }, prioridadeDistribuicao: 1, ultimaAtribuicaoEm: { toDate: () => new Date('2026-08-22T00:00:00.000Z') }, telefone: '11999999999' }));
  assert.equal(dto.papelOperacional, 'garcom');
  assert.deepEqual(dto.cargaAtual, { mesasAtivas: 2, comandasAtivas: 1, pedidosPendentes: 3, tarefasAtivas: 0 });
  assert.match(dto.ultimaAtribuicaoEm, /^2026-08-22T00:00:00\.000Z$/);
  assert.equal(dto.idRestaurante, undefined);
  assert.equal(dto.telefone, '*******9999');
});

test('pontuação de distribuição aplica os pesos contratuais', () => {
  const pontuacao = pedidos.pontuacaoGarcom({ mesasAtivas: 1, comandasAtivas: 2, pedidosPendentes: 3 }, { capacidadeMesas: 2, capacidadeComandas: 4, capacidadePedidos: 10 });
  assert.equal(pontuacao, 0.46);
});

test('seleção rejeita profissionais incompatíveis e respeita a capacidade restante', () => {
  const selecionado = pedidos.selecionarGarcomResponsavel({ funcionariosDocumentos: [
    documento('FUN-1', { status: 'ativo', setor: 'Cozinha', papelOperacional: 'garcom', disponibilidadeAtendimento: 'disponivel', capacidadeMesas: 10, capacidadeComandas: 10, capacidadePedidos: 10 }),
    documento('FUN-2', { status: 'ativo', setor: 'Salão', papelOperacional: 'garcom', disponibilidadeAtendimento: 'indisponivel', capacidadeMesas: 10, capacidadeComandas: 10, capacidadePedidos: 10 }),
    documento('FUN-3', { status: 'ativo', setor: 'Salão', papelOperacional: 'garcom', disponibilidadeAtendimento: 'disponivel', capacidadeMesas: 1, capacidadeComandas: 1, capacidadePedidos: 1, cargaAtual: { mesasAtivas: 1, comandasAtivas: 0, pedidosPendentes: 0 } }),
    documento('FUN-4', { status: 'ativo', setor: 'Salão', papelOperacional: 'garcom', disponibilidadeAtendimento: 'disponivel', capacidadeMesas: 4, capacidadeComandas: 4, capacidadePedidos: 8 }),
  ], incrementoMesa: 1, incrementoComanda: 1, incrementoPedido: 1 });
  assert.equal(selecionado.id, 'FUN-4');
});

test('desempate segue prioridade, última atribuição e ID lexicográfico', () => {
  const selecionado = pedidos.selecionarGarcomResponsavel({ funcionariosDocumentos: [
    documento('FUN-2', { status: 'ativo', setor: 'Salão', papelOperacional: 'garcom', disponibilidadeAtendimento: 'disponivel', capacidadeMesas: 4, capacidadeComandas: 4, capacidadePedidos: 8, prioridadeDistribuicao: 1, ultimaAtribuicaoEm: new Date('2026-08-22T01:00:00.000Z') }),
    documento('FUN-1', { status: 'ativo', setor: 'Salão', papelOperacional: 'garcom', disponibilidadeAtendimento: 'disponivel', capacidadeMesas: 4, capacidadeComandas: 4, capacidadePedidos: 8, prioridadeDistribuicao: 0, ultimaAtribuicaoEm: new Date('2026-08-22T02:00:00.000Z') }),
    documento('FUN-3', { status: 'ativo', setor: 'Salão', papelOperacional: 'garcom', disponibilidadeAtendimento: 'disponivel', capacidadeMesas: 4, capacidadeComandas: 4, capacidadePedidos: 8, prioridadeDistribuicao: 0, ultimaAtribuicaoEm: new Date('2026-08-22T02:00:00.000Z') }),
  ] });
  assert.equal(selecionado.id, 'FUN-1');
});

test('módulo operacional exporta a validação de papel usada pelos handlers', () => {
  const modulos = require('../api/_lib/modulos-operacionais');
  assert.equal(typeof modulos.exigirPapel, 'function');
});

test('handler de pedidos usa a função de carga existente ao preservar o responsável', () => {
  const handler = ler('api/_lib/pedidos-handler.js');
  assert.match(handler, /const carga = cargaFuncionario\(dadosFuncionario\);/);
  assert.doesNotMatch(handler, /const carga = cargaAtual\(dadosFuncionario\);/);
});

test('comanda preserva a atribuição e o pedido QR recebe o snapshot do responsável', () => {
  const qrcode = ler('api/_lib/qrcode-mesas.js');
  assert.match(qrcode, /atribuirGarcomResponsavel/);
  assert.match(qrcode, /idFuncionarioResponsavel/);
  assert.match(qrcode, /idUsuarioGarcomResponsavel/);
  assert.match(qrcode, /statusDistribuicaoGarcom/);
  assert.match(qrcode, /aguardando_atribuicao/);
});

test('tela exclusiva e navegação usam o shell único e os ativos versionados', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const menu = ler('index.html');
  const pagina = ler('paginas/pedidos/atendimento-garcom.html');
  const controller = ler('scripts/pedidos/atendimento-garcom.js');
  assert.match(shell, /atendimento-garcom/);
  assert.match(shell, /etapa26-garcom-distribuicao/);
  assert.match(menu, /Atendimento dos garçons/);
  assert.match(pagina, /Mesas atribuídas/);
  assert.match(pagina, /p-4 sm:p-6 space-y-4 sm:space-y-6 fade-in/);
  assert.match(controller, /listarPedidos/);
  assert.match(controller, /atualizarStatusPedido/);
  assert.match(controller, /encaminharComandaCaixa/);
  assert.doesNotMatch(pagina, /<header|<aside/);
});

test('rotas de produção incluem a página limpa sem nova função em api/v1', () => {
  const vercel = ler('vercel.json');
  const ativos = ler('scripts/pedidos/pedidos-ativos.js');
  assert.match(vercel, /atendimento-garcom/);
  assert.match(ativos, /painel\.addEventListener\('click'/);
  assert.match(ativos, /data-pedido-id/);
  assert.doesNotMatch(ativos, /card\.addEventListener\('click'/);
  const novasFuncoes = fs.readdirSync(path.join(raiz, 'api', 'v1')).filter(nome => nome.endsWith('.js'));
  assert.ok(novasFuncoes.length <= 12);
});
