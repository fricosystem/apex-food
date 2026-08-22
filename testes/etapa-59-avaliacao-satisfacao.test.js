'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

test('avaliação pública exige comanda encerrada e respeita prazo pós-caixa', () => {
  const qrcode = ler('api/_lib/qrcode-mesas.js');
  assert.match(qrcode, /obterContextoAvaliacaoPublica/);
  assert.match(qrcode, /statusComanda !== 'encerrada'/);
  assert.match(qrcode, /AVALIACAO_AGUARDANDO_CAIXA/);
  assert.match(qrcode, /AVALIACAO_EXPIRADA/);
  assert.match(qrcode, /7 \* 24 \* 60 \* 60 \* 1000/);
});

test('avaliação valida nota, limita comentário e persiste vínculo operacional em português', () => {
  const qrcode = ler('api/_lib/qrcode-mesas.js');
  assert.match(qrcode, /NOTA_INVALIDA/);
  assert.match(qrcode, /nota < 1 \|\| nota > 5/);
  assert.match(qrcode, /textoOpcional\(corpo\.comentario \|\| corpo\.observacao, 'comentario', 1000\)/);
  for (const campo of ['idRestaurante', 'idComanda', 'idMesa', 'idParticipante', 'idGarcomResponsavel', 'nomeCliente', 'nota', 'comentario', 'categoria', 'canal', 'respondida']) assert.match(qrcode, new RegExp(`\\b${campo}\\b`));
  assert.match(qrcode, /collection\('avaliacoes'\)/);
});

test('avaliação é única por comanda e participante e usa idempotência transacional', () => {
  const qrcode = ler('api/_lib/qrcode-mesas.js');
  assert.match(qrcode, /idAvaliacaoComanda/);
  assert.match(qrcode, /AVALIACAO_JA_ENVIADA/);
  assert.match(qrcode, /transacao\.create\(avaliacaoRef/);
  assert.match(qrcode, /transacao\.create\(idempotenciaRef/);
  assert.match(qrcode, /tipoOperacao: 'avaliacao_publica'/);
  assert.match(qrcode, /avaliacao\.publica\.criada/);
});

test('endpoint público do QR expõe consulta e envio da avaliação sem função nova', () => {
  const endpoint = ler('api/v1/qrcode-mesa.js');
  assert.match(endpoint, /acao === 'avaliacao'/);
  assert.match(endpoint, /limitarAcaoPublica\(req, 'avaliacao'\)/);
  assert.match(endpoint, /corpo\.acao === 'avaliacao'/);
  assert.match(endpoint, /criarAvaliacaoPublica/);
  assert.match(endpoint, /avaliacao: await consultarAvaliacaoPublica/);
  assert.match(endpoint, /avaliacao: \[5, 300_000\]/);
  assert.match(endpoint, /SESSAO_MESA_EXPIRADA/);
});

test('comanda pública mostra avaliação após o caixa e bloqueia novo pedido', () => {
  const html = ler('paginas/publico/mesa.html');
  const js = ler('scripts/publico/mesa.js');
  for (const id of ['mesaPublicaAvaliacao', 'mesaPublicaAvaliacaoNotas', 'mesaPublicaAvaliacaoComentario', 'mesaPublicaEnviarAvaliacao', 'mesaPublicaAvaliacaoEnviada']) assert.match(html, new RegExp(id));
  assert.match(html, /data-mesa-avaliacao-nota="5"/);
  assert.match(js, /renderizarAvaliacao/);
  assert.match(js, /dados\.avaliacao/);
  assert.match(js, /acao: 'avaliacao'/);
  assert.match(js, /estado\.atendimentoEncerrado/);
  assert.match(js, /estado\.pollingAtivo = false/);
  assert.match(js, /!estado\.atendimentoEncerrado/);
});

test('Visão Geral e Avaliações dos Clientes já consomem nota e comentário persistidos', () => {
  const visao = ler('api/_lib/visao-geral-handler.js');
  const relatorios = ler('scripts/relatorios/dados-relatorios.js');
  const tela = ler('scripts/relatorios/avaliacoes-clientes.js');
  assert.match(visao, /avaliacoes/);
  assert.match(visao, /dados\.nota/);
  assert.match(visao, /dados\.comentario/);
  assert.match(visao, /notaMedia/);
  assert.match(relatorios, /avaliacoes/);
  assert.match(tela, /dados\.avaliacoes/);
});

test('shell versiona a comanda pública e mantém o limite de funções serverless', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  assert.match(shell, /mesa\.html\?v=etapa34-logo-mesa/);
  assert.match(shell, /mesa\.js\?v=etapa34-logo-mesa/);
  assert.match(shell, /mesa\.html\?v=etapa23-comanda-passos-mobile/);
  assert.equal(fs.readdirSync(path.join(raiz, 'api', 'v1')).filter(nome => nome.endsWith('.js')).length, 4);
  assert.equal(fs.existsSync(path.join(raiz, '.github', 'workflows')), false);
});
