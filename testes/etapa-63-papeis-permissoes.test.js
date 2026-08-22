'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const raiz = path.resolve(__dirname, '..');
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const papeis = require('../api/_lib/papeis');

test('catálogo local contém Diretor, Porteiro, Garçom, Cozinheiro e Caixa', () => {
  const codigos = papeis.PAPEIS_NATIVOS.map((papel) => papel.codigo);
  for (const codigo of ['diretor', 'porteiro', 'garcom', 'cozinheiro', 'caixa']) assert.ok(codigos.includes(codigo), `papel ausente: ${codigo}`);
  assert.equal(codigos.includes('desenvolvedor'), false);
});

test('Diretor pode gerir papéis locais, mas Desenvolvedor nunca é papel local', () => {
  assert.ok(papeis.PAPEIS_GESTAO.includes('diretor'));
  assert.equal(papeis.PAPEIS_GESTAO.includes('desenvolvedor'), false);
  assert.throws(() => papeis.dadosPapel({ codigo: 'desenvolvedor', nome: 'Desenvolvedor', permissoes: [] }), /reservado/);
  assert.throws(() => papeis.validarPermissoes(['desenvolvedor.gerenciar']), /globais/);
});

test('papel personalizado normaliza código e aceita somente permissões do catálogo', () => {
  assert.equal(papeis.normalizarCodigo('Recepção'), 'recepcao');
  assert.deepEqual(papeis.dadosPapel({ codigo: 'recepcao', nome: 'Recepção', descricao: 'Entrada de clientes', permissoes: ['estabelecimento.visualizar', 'pedidos.visualizar'] }), {
    codigo: 'recepcao',
    nome: 'Recepção',
    descricao: 'Entrada de clientes',
    permissoes: ['estabelecimento.visualizar', 'pedidos.visualizar'],
  });
  assert.throws(() => papeis.dadosPapel({ codigo: 'recepcao', nome: 'Recepção', permissoes: ['permissao.inexistente'] }), /permissões válidas|globais/);
});

test('rota, tela e cliente de Papéis e Permissões estão registrados', () => {
  const shell = ler('scripts/shell/apex-shell.js');
  const index = ler('index.html');
  const pagina = ler('paginas/equipe/papeis.html');
  const script = ler('scripts/equipe/papeis.js');
  const cliente = ler('scripts/api/modulos-client.js');
  const vercel = ler('vercel.json');
  assert.match(shell, /papeis:\s*\{ titulo: 'Papéis e Permissões'/);
  assert.match(shell, /papeis\.html\?v=fase51-papeis-locais/);
  assert.match(index, /href: '\/papeis'/);
  assert.match(pagina, /id="novoPapel"/);
  assert.match(pagina, /id="listaPermissoesPapel"/);
  assert.match(script, /listarPapeis/);
  assert.match(script, /criarPapel/);
  assert.match(script, /arquivarPapel/);
  assert.match(cliente, /async function listarPapeis/);
  assert.ok(vercel.includes('papeis\\\\.html'));
  assert.ok(vercel.includes('Location":"/papeis"'));
  assert.ok(vercel.includes('funcionarios|papeis|dashboard-estabelecimentos|gerenciar-estabelecimentos|escala-trabalho'));
});

test('handler de papéis usa middleware, contexto local e auditoria', () => {
  const handler = ler('api/_lib/papeis-handler.js');
  const dispatcher = ler('api/v1/operacional.js');
  const backend = ler('api/_lib/papeis.js');
  assert.match(handler, /obterIdentidadeOperacional/);
  assert.match(handler, /PAPEIS_GESTAO/);
  assert.match(handler, /appCheck: true/);
  assert.match(dispatcher, /papeis: require\('\.\.\/\_lib\/papeis-handler'\)/);
  assert.match(backend, /registrarAuditoriaOperacional/);
  assert.match(backend, /PAPEL_EM_USO/);
  assert.doesNotMatch(backend, /localStorage|sessionStorage/);
});
