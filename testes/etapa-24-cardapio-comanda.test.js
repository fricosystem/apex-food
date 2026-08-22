const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('helper público da mesa expõe os contratos de cardápio, comanda e pedido', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  assert.match(helper, /async function obterContextoSessaoMesa/);
  assert.match(helper, /async function listarCardapioPublico/);
  assert.match(helper, /async function consultarComandaPublica/);
  assert.match(helper, /async function criarPedidoPublico/);
  assert.match(helper, /validarItensPedidoPublico/);
  assert.match(helper, /module\.exports[\s\S]*listarCardapioPublico/);
  assert.match(helper, /module\.exports[\s\S]*consultarComandaPublica/);
  assert.match(helper, /module\.exports[\s\S]*criarPedidoPublico/);
});

test('endpoint consolidado expõe cardápio, comanda e pedido sem criar nova função', () => {
  const endpoint = ler('api/v1/qrcode-mesa.js');
  assert.match(endpoint, /acao === 'cardapio'/);
  assert.match(endpoint, /acao === 'comanda'/);
  assert.match(endpoint, /corpo\.acao === 'pedido'/);
  assert.match(endpoint, /listarCardapioPublico/);
  assert.match(endpoint, /consultarComandaPublica/);
  assert.match(endpoint, /criarPedidoPublico/);
});

test('cardápio público só é servido quando publicado e filtra produtos fora de categorias públicas', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  assert.match(helper, /if \(!configuracao\.publicado\) throw new ApiError\(409, 'CARDAPIO_NAO_PUBLICADO'/);
  assert.match(helper, /categoriasCardapio/);
  assert.match(helper, /produtosCardapio/);
  assert.match(helper, /categoriasIds\.has/);
  assert.match(helper, /promocoesCardapio/);
});

test('pedido público calcula o preço no servidor e não aceita preço enviado pelo navegador', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  const trechoPedido = helper.slice(helper.indexOf('async function criarPedidoPublico'), helper.indexOf('async function gerarQrMesa'));
  assert.match(trechoPedido, /produto\.precoCentavos/);
  assert.match(trechoPedido, /precoUnitarioCentavos/);
  assert.doesNotMatch(trechoPedido, /item\.precoCentavos|item\.preco|corpo\.precoCentavos/);
  assert.match(trechoPedido, /transacao\.create\(pedidoRef\.collection\('itens'\)/);
  assert.match(trechoPedido, /hashPayload/);
});

test('pedido público exige sessão ativa, participante ativo, mesa vinculada e comanda aberta', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  assert.match(helper, /sessao\.estadoSessao !== 'ativa'/);
  assert.match(helper, /ESTADOS_COMANDA_ATIVA\.has\(comanda\.statusComanda \|\| comanda\.status\)/);
  assert.match(helper, /sessaoAtual\.estadoSessao !== 'ativa'/);
  assert.match(helper, /participanteDocumento\.data\(\)\?\.estadoParticipante !== 'ativo'/);
  assert.match(helper, /idComandaAberta/);
});

test('pedido público registra itens, evento, idempotência, atualização da comanda e auditoria', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  assert.match(helper, /pedidoRef\.collection\('itens'\)/);
  assert.match(helper, /pedidoRef\.collection\('eventos'\)/);
  assert.match(helper, /collection\('chavesIdempotencia'\)/);
  assert.match(helper, /registrarAuditoria/);
  assert.match(helper, /mesa\.pedido\.enviado/);
  assert.match(helper, /statusPedido = 'aguardando_confirmacao_garcom'/);
});

test('interface pública apresenta cardápio, carrinho, comanda e polling sem armazenamento local', () => {
  const pagina = ler('paginas/publico/mesa.html');
  const script = ler('scripts/publico/mesa.js');
  assert.match(pagina, /mesaPublicaCardapioCategorias/);
  assert.match(pagina, /mesaPublicaCardapioProdutos/);
  assert.match(pagina, /mesaPublicaCarrinhoLista/);
  assert.match(pagina, /mesaPublicaEnviarPedido/);
  assert.match(pagina, /mesaPublicaPedidos/);
  assert.match(pagina, /mesaPublicaMobilePassos/);
  assert.match(pagina, /mesaPublicaMobileIrCarrinho/);
  assert.match(pagina, /mesaPublicaMobileVoltarCardapio/);
  assert.match(pagina, /mesaPublicaMobileNovoPedido/);
  assert.match(pagina, /data-mesa-mobile-passo="escolher"/);
  assert.match(pagina, /data-mesa-mobile-passo="revisar"/);
  assert.match(pagina, /data-mesa-mobile-passo="acompanhar"/);
  assert.match(script, /etapaMobile: 'escolher'/);
  assert.match(script, /atualizarEtapaMobile\('revisar'\)|atualizarEtapaMobile\('acompanhar'\)/);
  assert.match(script, /atualizarEtapaMobile\('acompanhar'\)/);
  assert.match(script, /matchMedia\('\(max-width: 639px\)'\)/);
  assert.match(script, /acao=cardapio/);
  assert.match(script, /acao=\?comanda|acao=comanda/);
  assert.match(script, /acao: 'pedido'/);
  assert.match(script, /chaveIdempotencia/);
  assert.match(script, /agendarPolling/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|deviceId|fingerprint/i);
});

test('Fluxo público mantém os assets da mesa e avança para a central da etapa9', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const index = ler('index.html');
  assert.match(shell, /mesaPublico|paginas\/publico\/mesa\.html\?v=etapa23-comanda-passos-mobile/);
  assert.match(shell, /estilos\/publico\/mesa\.css\?v=etapa23-comanda-passos-mobile/);
  assert.match(shell, /scripts\/publico\/mesa\.js\?v=etapa23-comanda-passos-mobile/);
  assert.match(index, /apex-shell\.js\?v=etapa31-especialidades/);
});

test('comanda pública oculta todo o shell administrativo e mantém somente o corpo do cliente', () => {
  const index = ler('index.html');
  const estilos = ler('estilos/publico/mesa.css');
  assert.match(index, /class="apex-mobile-header lg:hidden/);
  assert.match(estilos, /body\.apex-publico-mesa > \.apex-mobile-header/);
  assert.match(estilos, /body\.apex-publico-mesa > main > header/);
  assert.match(estilos, /display: none !important/);
});

test('comanda pública mantém largura fluida e adapta o cardápio para telas móveis', () => {
  const estilos = ler('estilos/publico/mesa.css');
  assert.match(estilos, /body\.apex-publico-mesa\s*\{\s*overflow-x: hidden;/);
  assert.match(estilos, /\.mesa-publica-shell\s*\{[\s\S]*width: 100%;[\s\S]*min-width: 0;/);
  assert.match(estilos, /\.mesa-publica-card\s*\{[\s\S]*width: 100%;[\s\S]*max-width: 64rem;[\s\S]*min-width: 0;/);
  assert.match(estilos, /overflow-wrap: anywhere;/);
  assert.match(estilos, /@media \(max-width: 639px\)/);
  assert.match(estilos, /#mesaPublicaCardapioProdutos\s*\{\s*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(estilos, /\.mesa-publica-passos/);
  assert.match(estilos, /\.mesa-publica-etapas/);
  assert.match(estilos, /\.mesa-publica-mobile-controles/);
  assert.match(estilos, /\.mesa-publica-passos\.hidden/);
});

test('cookie da sessão é assinado com restaurante e sessão na ordem correta', () => {
  const helper = ler('api/_lib/qrcode-mesas.js');
  assert.match(helper, /codificarSessaoMesa\(idRestaurante, sessaoRef\.id, expiraEm\)/);
});
