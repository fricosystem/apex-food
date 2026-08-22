const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('Etapa 21 remove fixtures locais dos bridges de mesas e reservas', () => {
  const mesas = ler('scripts/salao/dados-mesas.js');
  const reservas = ler('scripts/salao/dados-reservas.js');
  assert.match(mesas, /window\.dadosMesas = \[\]/);
  assert.match(reservas, /window\.dadosReservasApexFood = \[\]/);
  assert.doesNotMatch(mesas, /dadosMesasPreview|ambienteMesasLocal|localhost/);
  assert.doesNotMatch(reservas, /dadosReservasPreview|ambienteReservasLocal|localhost/);
});

test('bridge de mesas combina mesas e reservas reais e preserva metadados QR públicos', () => {
  const bridge = ler('scripts/salao/dados-mesas.js');
  assert.match(bridge, /api\.listarSalao\(\)/);
  assert.match(bridge, /dados\.reservas/);
  assert.match(bridge, /reservaStatus/);
  assert.match(bridge, /reservaInicioEm/);
  assert.match(bridge, /qrAtivo/);
  assert.doesNotMatch(bridge, /qrHash|qrTokenCifrado/);
});

test('bridge de reservas usa cliente same-origin e atualiza apenas dados reais', () => {
  const bridge = ler('scripts/salao/dados-reservas.js');
  assert.match(bridge, /api\.listarSalao\('reservas'\)/);
  assert.match(bridge, /modulos-client\.js\?v=etapa21-salao-tempo-real/);
  assert.match(bridge, /apex:reservas-atualizado/);
  assert.doesNotMatch(bridge, /firebase|localStorage|sessionStorage|dadosReservasPreview/i);
});

test('criação e reativação de reserva usam conflito transacional por mesa e horário', () => {
  const handler = ler('api/_lib/salao-handler.js');
  assert.match(handler, /async function validarConflitoReserva/);
  assert.match(handler, /where\('idMesa', '==', idMesa\)/);
  assert.match(handler, /RESERVA_EM_CONFLITO/);
  assert.match(handler, /await validarConflitoReserva\(transacao, restaurante/);
});

test('chegada de cliente sincroniza a mesa e cancelamento libera mesa sem comanda', () => {
  const handler = ler('api/_lib/salao-handler.js');
  assert.match(handler, /estadoAtendimento: 'aguardando_confirmacao'/);
  assert.match(handler, /reserva_cliente_chegou/);
  assert.match(handler, /reserva_cancelada/);
  assert.match(handler, /!mesa\.idComandaAberta/);
  assert.match(handler, /estado: 'disponivel'/);
});

test('mesa ocupada ou com comanda não pode ser bloqueada manualmente', () => {
  const handler = ler('api/_lib/salao-handler.js');
  assert.match(handler, /dados\.estado === 'indisponivel'/);
  assert.match(handler, /atual\.estado === 'ocupada'/);
  assert.match(handler, /atual\.idComandaAberta/);
  assert.match(handler, /MESA_EM_ATENDIMENTO/);
});

test('QR público consulta reservas ativas dentro da transação antes de abrir sessão', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  assert.match(helper, /function reservaBloqueiaQr/);
  assert.match(helper, /where\('idMesa', '==', mesaRef\.id\)/);
  assert.match(helper, /reservaAtiva/);
  assert.match(helper, /MESA_RESERVADA/);
  assert.match(helper, /ESTADOS_MESA_BLOQUEADOS/);
});

test('Mapa e Reservas atualizam dados automaticamente com backoff e encerram timers', () => {
  const mapa = ler('scripts/salao/mapa-mesas.js');
  const reservas = ler('scripts/salao/reservas.js');
  for (const script of [mapa, reservas]) {
    assert.match(script, /setTimeout/);
    assert.match(script, /Math\.min\(30000/);
    assert.match(script, /Math\.random\(\)/);
    assert.match(script, /beforeunload/);
  }
  assert.match(mapa, /recarregarMesasReais/);
  assert.match(reservas, /recarregarReservasReais/);
});

test('shell e cliente global usam o versionamento da Etapa 21', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const index = ler('index.html');
  assert.match(shell, /mapa-mesas[^\n]*etapa21-salao-tempo-real/);
  assert.match(shell, /reservas[^\n]*etapa21-salao-tempo-real/);
  assert.match(shell, /configuracao-mesas[^\n]*etapa21-salao-tempo-real/);
  assert.match(index, /apex-shell\.js\?v=etapa24-navegacao-fluida/);
  assert.match(index, /modulos-client\.js\?v=etapa22-dados-reais-global/);
});
