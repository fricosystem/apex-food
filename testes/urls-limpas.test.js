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

test('Vercel habilita URLs limpas e o PWA inicia na raiz', () => {
  const vercel = JSON.parse(ler('vercel.json'));
  const manifest = JSON.parse(ler('manifest.webmanifest'));
  assert.equal(vercel.cleanUrls, true);
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.icons[0].src, '/assets/apex-food-logo-aprimorada.png');
  assert.equal(manifest.icons[0].type, 'image/png');
  assert.match(manifest.icons[0].purpose, /maskable/);
});

test('links visíveis do shell e do sidebar não expõem .html', () => {
  const shell = extrairBlocoPagina('scripts/shell/apex-shell.js', 'const paginas = {', '  };');
  const index = extrairBlocoPagina('index.html', 'const sidebarSections = [', '  ];');
  const mapa = extrairBlocoPagina('mapa-mesas.html', 'const sidebarSections = [', '  ];');
  for (const [arquivo, bloco] of [['scripts/shell/apex-shell.js', shell], ['index.html', index], ['mapa-mesas.html', mapa]]) {
    assert.doesNotMatch(bloco, /href:\s*['"][^'"]+\.html['"]/, `${arquivo}: href visível ainda usa .html`);
  }
});

test('fragmentos internos continuam referenciando arquivos HTML físicos', () => {
  const shell = extrairBlocoPagina('scripts/shell/apex-shell.js', 'const paginas = {', '  };');
  const fragmentos = [...shell.matchAll(/fragmento:\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  assert.ok(fragmentos.length >= 1);
  for (const fragmento of fragmentos) {
    assert.match(fragmento, /\.html$/);
    assert.equal(fs.existsSync(path.join(raiz, fragmento)), true, `fragmento ausente: ${fragmento}`);
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
