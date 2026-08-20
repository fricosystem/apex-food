'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('tokens compartilhados definem escala tipográfica hierárquica', () => {
  const tokens = ler('estilos/compartilhados/tokens-apex.css');
  assert.match(tokens, /--apex-fonte-micro:\s*0\.6875rem/);
  assert.match(tokens, /--apex-fonte-auxiliar:\s*0\.75rem/);
  assert.match(tokens, /--apex-fonte-corpo:\s*0\.875rem/);
  assert.match(tokens, /--apex-fonte-subtitulo:\s*1rem/);
  assert.match(tokens, /--apex-fonte-titulo-secao:\s*1\.125rem/);
  assert.match(tokens, /--apex-fonte-valor:\s*1\.5rem/);
  assert.match(tokens, /text-\[10px\]/);
  assert.match(tokens, /text-\[11px\]/);
});

test('componentes específicos não mantêm microtextos abaixo da escala definida', () => {
  const home = ler('estilos/home/home.css');
  const pedidos = ler('estilos/pedidos/pedidos.css');
  const mapa = ler('estilos/mapa-mesas.css');
  assert.doesNotMatch(home, /font-size:\s*\.5[0-9]+rem/);
  assert.doesNotMatch(home, /font-size:\s*\.6[0-4][0-9]*rem/);
  assert.match(home, /\.home-modulo-kicker[\s\S]*font-size:\s*\.75rem/);
  assert.match(pedidos, /\.section-title\s*\{[^}]*font-size:\s*0\.75rem/);
  assert.match(mapa, /\.section-header \.section-title\s*\{[^}]*font-size:\s*0\.75rem/);
});

test('fontes de autenticação preservam hierarquia entre textos auxiliares e títulos', () => {
  const auth = ler('estilos/auth/auth.css');
  assert.match(auth, /\.auth-eyebrow[\s\S]*font-size:\s*0\.78rem/);
  assert.match(auth, /font-size:\s*clamp\(2\.55rem/);
  assert.match(auth, /font-size:\s*1rem;/);
});
