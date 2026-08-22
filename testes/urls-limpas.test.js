const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

function extrairBlocoPagina(arquivo, inicio, fim) {
  const conteudo = ler(arquivo);
  const inicioIndice = conteudo.indexOf(inicio);
  assert.notEqual(inicioIndice, -1, `${arquivo}: bloco inicial não encontrado`);
  const fimIndice = conteudo.indexOf(fim, inicioIndice);
  assert.notEqual(fimIndice, -1, `${arquivo}: bloco final não encontrado`);
  return conteudo.slice(inicioIndice, fimIndice + fim.length);
}

test('Vercel habilita URLs limpas, PWA na raiz e rewrites do shell', () => {
  const vercel = JSON.parse(ler('vercel.json'));
  const manifest = JSON.parse(ler('manifest.webmanifest'));
  assert.equal(vercel.cleanUrls, true);
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.icons[0].src, '/assets/apex-food-logo-aprimorada.png');
  assert.equal(manifest.icons[0].type, 'image/png');
  assert.match(manifest.icons[0].purpose, /maskable/);
  assert.ok(vercel.redirects.some(redirect => redirect.source === '/paginas/autenticacao.html' && redirect.destination === '/autenticacao'));
  const rotaFragmentoHome = vercel.routes.find(route => route.src === '^/paginas/home\\.html$');
  assert.ok(rotaFragmentoHome);
  assert.deepEqual(rotaFragmentoHome.missing, [{ type: 'header', key: 'X-Apex-Fragment' }]);
  assert.equal(rotaFragmentoHome.status, 308);
  assert.equal(rotaFragmentoHome.headers.Location, '/');
  assert.ok(vercel.routes.some(route => route.src === '^/autenticacao$' && route.dest === '/paginas/autenticacao'));
  assert.ok(vercel.routes.some(route => route.src.includes('mapa-mesas') && route.dest === '/index'));
  assert.ok(vercel.routes.some(route => route.src.includes('configuracoes-perfil') && route.dest === '/index'));
});

test('links visíveis usam somente rotas públicas sem .html, /paginas/ ou hash', () => {
  const shell = extrairBlocoPagina('scripts/shell/apex-shell.js', 'const paginas = {', '  };');
  const index = extrairBlocoPagina('index.html', 'const sidebarSections = [', '  ];');
  for (const [arquivo, bloco] of [['scripts/shell/apex-shell.js', shell], ['index.html', index]]) {
    const hrefs = [...bloco.matchAll(/href:\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
    for (const href of hrefs) {
      assert.ok(href.startsWith('/'), `${arquivo}: rota pública não é absoluta: ${href}`);
      assert.doesNotMatch(href, /^\/paginas(?:\/|$)/, `${arquivo}: rota pública expõe /paginas/: ${href}`);
      assert.doesNotMatch(href, /^#/, `${arquivo}: rota pública usa hash: ${href}`);
      assert.doesNotMatch(href, /\.html$/, `${arquivo}: rota pública expõe .html: ${href}`);
    }
  }
});

test('shell usa History API e mantém compatibilidade com hash legado', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  assert.match(shell, /history\[opcoes\.substituir \? 'replaceState' : 'pushState'\]/);
  assert.match(shell, /addEventListener\('popstate'/);
  assert.match(shell, /migrarHashLegado/);
  assert.match(shell, /X-Apex-Fragment/);
  assert.doesNotMatch(shell, /window\.location\.hash\s*=/);
});

test('navegação carrega o estilo antes do fragmento e fecha estados transitórios', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  assert.match(shell, /const atualizarEstilos = async pagina/);
  assert.match(shell, /await atualizarEstilos\(pagina\);\s+if \(token !== carregamentoAtual\) return;\s+const fragmentoReal = document\.createElement\('div'\)/);
  assert.match(shell, /fragmentoReal\.hidden = true;[\s\S]*fragmentoReal\.innerHTML = html;[\s\S]*container\.appendChild\(fragmentoReal\)/);
  assert.match(shell, /const fecharEstadosTransitorios = \(\) =>/);
  assert.match(shell, /fecharEstadosTransitorios\(\);\s+if \(window\.location\.pathname !== destino\)/);
});

test('skeleton global aguarda o Firestore antes de revelar cada fragmento', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const tokens = ler('estilos/compartilhados/tokens-apex.css');
  assert.match(shell, /const criarSkeletonPagina = \(chave, pagina\)/);
  assert.match(shell, /data-apex-skeleton="true"/);
  assert.match(shell, /const promessasPorPagina = \{/);
  assert.match(shell, /await aguardarDadosPagina\(chave\)/);
  assert.match(shell, /fragmentoReal\.hidden = false;/);
  for (const nome of ['dadosVisaoGeralPronto', 'dadosPedidosPronto', 'dadosCardapioPronto', 'dadosMesasPronto', 'dadosEquipePronto', 'dadosFinanceirosPronto', 'dadosRelatoriosPronto']) {
    assert.match(shell, new RegExp(nome));
  }
  assert.match(tokens, /\.apex-skeleton-pagina/);
  assert.match(tokens, /@keyframes apexSkeletonShimmer/);
  assert.match(tokens, /prefers-reduced-motion/);
});

test('controllers autônomos expõem prontidão para o skeleton global', () => {
  assert.match(ler('scripts/cardapio/cardapio-digital.js'), /window\.dadosCardapioDigitalPronto = carregarConfiguracao\(\)/);
  assert.match(ler('scripts/configuracoes/perfil.js'), /window\.dadosPerfilPronto = carregar\(\)/);
  assert.match(ler('scripts/equipe/comissoes.js'), /window\.dadosComissoesPronto/);
  assert.match(ler('scripts/publico/mesa.js'), /window\.dadosMesaPublicaPronto = carregarMesa\(\)/);
});

test('fragmentos internos continuam referenciando arquivos HTML físicos', () => {
  const shell = extrairBlocoPagina('scripts/shell/apex-shell.js', 'const paginas = {', '  };');
  const fragmentos = [...shell.matchAll(/fragmento:\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  assert.ok(fragmentos.length >= 1);
  for (const fragmento of fragmentos) {
    assert.match(fragmento, /\.html(?:\?|$)/);
    const arquivoFisico = fragmento.split(/[?#]/, 1)[0];
    assert.equal(fs.existsSync(path.join(raiz, arquivoFisico)), true, `fragmento ausente: ${arquivoFisico}`);
  }
});

test('autenticação usa logo aprimorada e links sem .html', () => {
  const autenticacao = ler('paginas/autenticacao.html');
  const imagens = [...autenticacao.matchAll(/<img\s+src="([^"]+)"/g)].map(match => match[1]);
  const marcas = imagens.filter(src => src.includes('apex-food-logo'));
  assert.equal(marcas.length, 2);
  assert.ok(marcas.every(src => src.endsWith('apex-food-logo-aprimorada.png')));
  assert.doesNotMatch(autenticacao, /<img[^>]+apex-food-logo\.jpg/);
  assert.doesNotMatch(autenticacao, /href="\.\.\/index\.html"/);
  assert.equal(fs.existsSync(path.join(raiz, 'assets/apex-food-logo-aprimorada.png')), true);
});

test('logo aprimorada é PNG com canal alfa', () => {
  const buffer = fs.readFileSync(path.join(raiz, 'assets/apex-food-logo-aprimorada.png'));
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(buffer.toString('ascii', 12, 16), 'IHDR');
  const tipoCor = buffer[25];
  assert.ok(tipoCor === 4 || tipoCor === 6, `PNG não possui canal alfa: tipo de cor ${tipoCor}`);
});
