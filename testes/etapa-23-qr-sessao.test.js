const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('contrato QR usa token opaco, hash Firestore, sessão assinada e nome completo', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  assert.match(helper, /randomBytes\(32\)/);
  assert.match(helper, /hashSha256\(token\)/);
  assert.match(helper, /collectionGroup\('mesas'\)/);
  assert.match(helper, /collection\('sessoesMesa'\)/);
  assert.match(helper, /collection\('participantes'\)/);
  assert.match(helper, /validarNomeCompleto/);
  assert.match(helper, /SESSION_SECRET/);
  assert.match(helper, /httpOnly:\s*true/);
  assert.match(helper, /chaveIdempotencia/);
  assert.doesNotMatch(helper, /localStorage|sessionStorage|fingerprint|deviceId/i);
});

test('endpoint público separa validação, abertura POST com CSRF e consulta da própria sessão', () => {
  const endpoint = ler('api/v1/qrcode-mesa.js');
  assert.match(endpoint, /metodos:\s*\['GET', 'POST'\]/);
  assert.match(endpoint, /acao === 'validar'/);
  assert.match(endpoint, /acao === 'sessao'/);
  assert.match(endpoint, /corpo\.acao === 'abrir'/);
  assert.match(endpoint, /abrirSessaoMesa/);
  assert.match(endpoint, /appCheck:\s*false/);
});

test('endpoint administrativo exige papéis de gestão e possui gerar/revogar', () => {
  const endpoint = ler('api/v1/qrcode-mesa.js');
  assert.match(endpoint, /PAPEIS_QR_ADMIN = \['proprietario', 'administrador', 'gerente'\]/);
  assert.match(endpoint, /verificarAppCheck/);
  assert.match(endpoint, /acao/);
  assert.match(endpoint, /gerar/);
  assert.match(endpoint, /revogar/);
  assert.match(endpoint, /gerarQrMesa/);
  assert.match(endpoint, /revogarQrMesa/);
});

test('geração de QR cifra token para idempotência e não persiste token claro', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  assert.match(helper, /aes-256-gcm/);
  assert.match(helper, /tokenCifrado/);
  assert.match(helper, /transacao\.create\(idempotenciaRef/);
  assert.match(helper, /qrHash: hash/);
  assert.doesNotMatch(helper, /qrToken:\s*token/);
});

test('tela pública exige nome, não usa armazenamento local e limpa o token da URL após validação', () => {
  const pagina = ler('paginas/publico/mesa.html');
  const script = ler('scripts/publico/mesa.js');
  assert.match(pagina, /id="mesaPublicaNome"[^>]+required/);
  assert.match(pagina, /Nome completo para atendimento/);
  assert.match(script, /fetch\('\/api\/v1\/auth\/csrf'/);
  assert.match(script, /nomeCompleto: nome/);
  assert.match(script, /history\.replaceState/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|deviceId|fingerprint/i);
});

test('rota pública mesa usa shell único, guard explícito e URLs limpas', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const guard = ler('scripts/auth/sessao-guard.js');
  const vercel = JSON.parse(ler('vercel.json'));
  const rota = vercel.routes.find(item => String(item.src || '').includes('mesa|novo-pedido'));
  assert.match(shell, /href: '\/mesa'/);
  assert.match(shell, /paginas\/publico\/mesa\.html\?v=etapa4-cardapio/);
  assert.match(guard, /paginaMesaPublica/);
  assert.match(guard, /caminhoAtual === '\/mesa'/);
  assert.ok(rota);
  assert.match(String(rota.src), /mesa/);
});

test('DTO do Salão não expõe hash secreto do QR Code', () => {
  const handler = ler('api/_lib/salao-handler.js');
  assert.match(handler, /delete dto\.qrHash/);
});

test('configuração de mesas usa API própria e não serviço externo para QR', () => {
  const controller = ler('scripts/salao/configuracao-mesas.js');
  const pagina = ler('paginas/salao/configuracao-mesas.html');
  assert.match(controller, /apexModulosApi\.gerarQrMesa/);
  assert.match(controller, /apexModulosApi\.revogarQrMesa/);
  assert.match(controller, /qrDataUrl/);
  assert.match(pagina, /modalQrMesaConfig/);
  assert.match(pagina, /qrMesaConfigRevogar/);
  assert.doesNotMatch(controller, /quickchart|api\.qrserver|goqr/i);
});

test('cliente API expõe geração e revogação pelo endpoint administrativo', () => {
  const cliente = ler('scripts/api/modulos-client.js');
  assert.match(cliente, /function gerarQrMesa/);
  assert.match(cliente, /function revogarQrMesa/);
  assert.match(cliente, /requisitar\('\/qrcode-mesa'/);
});
