const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const guard = fs.readFileSync(`${__dirname}/../scripts/auth/sessao-guard.js`, 'utf8');

async function simularGuard(pathname, status) {
  let verificarSessao;
  const location = {
    pathname,
    replacements: [],
    replace(destino) {
      this.replacements.push(destino);
    },
  };
  const contexto = {
    window: {
      location,
      addEventListener(evento, callback) {
        if (evento === 'DOMContentLoaded') verificarSessao = callback;
      },
    },
    document: { documentElement: { style: {} } },
    fetch: async () => ({
      ok: status >= 200 && status < 300,
      status,
    }),
  };

  vm.runInNewContext(guard, contexto, { filename: 'sessao-guard.js' });
  await verificarSessao();
  return { location, visibility: contexto.document.documentElement.style.visibility };
}

test('guard usa URL limpa e destinos absolutos sem duplicar o caminho', async () => {
  const raizSemSessao = await simularGuard('/', 401);
  assert.deepEqual(raizSemSessao.location.replacements, ['/autenticacao']);
  assert.equal(raizSemSessao.visibility, 'hidden');

  const autenticacaoLimpa = await simularGuard('/autenticacao', 401);
  assert.deepEqual(autenticacaoLimpa.location.replacements, []);
  assert.equal(autenticacaoLimpa.visibility, '');

  const autenticacaoLegada = await simularGuard('/paginas/autenticacao.html', 401);
  assert.deepEqual(autenticacaoLegada.location.replacements, []);
  assert.equal(autenticacaoLegada.visibility, '');

  const autenticacaoComSessao = await simularGuard('/autenticacao', 200);
  assert.deepEqual(autenticacaoComSessao.location.replacements, ['/']);

  assert.doesNotMatch(guard, /replace\(['"](?:paginas\/)?autenticacao/);
});
