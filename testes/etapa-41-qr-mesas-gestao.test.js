const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('regeneração exige QR ativo e usa operação separada da geração inicial', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  assert.match(helper, /async function gerarQrMesa\([^)]*regenerar = false \}\)/);
  assert.match(helper, /const tipoOperacao = regenerar \? 'regenerar' : 'gerar'/);
  assert.match(helper, /regenerar && documento\.data\(\)\?\.qrAtivo !== true/);
  assert.match(helper, /'QR_NAO_ATIVO'/);
});

test('geração, regeneração e revogação registram auditoria operacional', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  assert.match(helper, /salao\.mesa\.qrGerado/);
  assert.match(helper, /salao\.mesa\.qrRegenerado/);
  assert.match(helper, /salao\.mesa\.qrRevogado/);
  assert.match(helper, /registrarAuditoriaOperacional\(/);
});

test('idempotência diferencia gerar, regenerar e revogar', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  assert.match(helper, /qr-\$\{tipoOperacao\}:\$\{mesaId\}:\$\{chave\}/);
  assert.match(helper, /tipoOperacao,/);
  assert.match(helper, /qr-revogar:\$\{mesaId\}:\$\{chave\}/);
  assert.match(helper, /repeticaoIdempotente/);
});

test('endpoint administrativo aceita a ação regenerar sem criar nova função serverless', () => {
  const endpoint = ler('api/v1/qrcode-mesa.js');
  assert.match(endpoint, /corpo\.acao === 'gerar' \|\| corpo\.acao === 'regenerar'/);
  assert.match(endpoint, /regenerar: corpo\.acao === 'regenerar'/);
  assert.match(endpoint, /gerarQrMesa\(/);
  assert.doesNotMatch(endpoint, /qrcode-mesa-regenerar/);
});

test('cliente same-origin expõe regeneração com ação explícita', () => {
  const cliente = ler('scripts/api/modulos-client.js');
  assert.match(cliente, /async function regenerarQrMesa\(payload\)/);
  assert.match(cliente, /body: \{ acao: 'regenerar', \.\.\.payload \}/);
  assert.match(cliente, /regenerarQrMesa,/);
});

test('adaptador de mesas transporta apenas metadados públicos do QR', () => {
  const dados = ler('scripts/salao/dados-mesas.js');
  const handler = ler('api/_lib/salao-handler.js');
  assert.match(dados, /qrAtivo: mesa\.qrAtivo === true/);
  assert.match(dados, /qrVersao: mesa\.qrVersao \|\| null/);
  assert.match(dados, /qrGeradoEm: mesa\.qrGeradoEm \|\| null/);
  assert.match(handler, /delete dto\.qrHash/);
  assert.doesNotMatch(dados, /qrHash/);
});

test('interface confirma regeneração e revogação antes de invalidar o código', () => {
  const controller = ler('scripts/salao/configuracao-mesas.js');
  const pagina = ler('paginas/salao/configuracao-mesas.html');
  assert.match(controller, /window\.confirm\(`Regenerar/);
  assert.match(controller, /window\.confirm\(`Revogar/);
  assert.match(controller, /apexModulosApi\.regenerarQrMesa/);
  assert.match(controller, /QR Code revogado/);
  assert.match(pagina, /id="qrMesaConfigRegenerar"/);
  assert.match(pagina, /id="qrMesaConfigRevogar"/);
});

test('impressão do QR usa data URL recebido da API e não serviço externo', () => {
  const controller = ler('scripts/salao/configuracao-mesas.js');
  assert.match(controller, /window\.open\('', '_blank'/);
  assert.match(controller, /qrMesaAtual\?\.qrDataUrl/);
  assert.match(controller, /janela\.print\(\)/);
  assert.doesNotMatch(controller, /quickchart|api\.qrserver|goqr/i);
});

test('asset do cliente de módulos usa o versionamento da Etapa 21', () => {
  const dados = ler('scripts/salao/dados-mesas.js');
  assert.match(dados, /modulos-client\.js\?v=etapa21-salao-tempo-real/);
});

test('consulta administrativa recupera o link ativo sem regenerar o QR', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  const endpoint = ler('api/v1/qrcode-mesa.js');
  const cliente = ler('scripts/api/modulos-client.js');
  assert.match(helper, /async function consultarQrMesa\(identidade, \{ idMesa, req \}\)/);
  assert.match(helper, /decifrarToken\(mesa\.qrTokenCifrado\)/);
  assert.match(helper, /tipoOperacao: 'consultar'/);
  assert.match(endpoint, /corpo\.acao === 'consultar'/);
  assert.match(endpoint, /consultarQrMesa\(/);
  assert.match(cliente, /async function consultarQrMesa\(payload\)/);
  assert.match(cliente, /body: \{ acao: 'consultar', \.\.\.payload \}/);
});

test('token cifrado do QR fica server-side e é removido na revogação', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  const handler = ler('api/_lib/salao-handler.js');
  assert.match(helper, /qrTokenCifrado: tokenCifrado/);
  assert.match(helper, /qrTokenCifrado: FieldValue\.delete\(\)/);
  assert.match(handler, /delete dto\.qrTokenCifrado/);
  assert.doesNotMatch(helper, /qrTokenCifrado\s*:\s*token\b/);
});

test('interface consulta QR ativo e solicita confirmação para QR legado não recuperável', () => {
  const controller = ler('scripts/salao/configuracao-mesas.js');
  assert.match(controller, /apexModulosApi\.consultarQrMesa/);
  assert.match(controller, /erro\.code === 'QR_NAO_RECUPERAVEL'/);
  assert.match(controller, /await regenerarQrMesa\(id\)/);
  assert.match(controller, /Ver QR e link/);
});
