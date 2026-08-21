const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = relativo => fs.readFileSync(path.join(raiz, relativo), 'utf8');

test('handlers globais preservam coleções Firestore em português por módulo', () => {
  const contratos = [
    ['api/_lib/cardapio-handler.js', ['categoriasCardapio', 'produtosCardapio', 'promocoesCardapio', 'movimentacoesEstoque']],
    ['api/_lib/pedidos-handler.js', ['pedidos', 'comandas', 'estoque']],
    ['api/_lib/salao-handler.js', ['mesas', 'reservas', 'eventosMesas']],
    ['api/_lib/equipe-handler.js', ['funcionarios', 'dadosPrivadosFuncionarios', 'escalas', 'comissoes']],
    ['api/_lib/financeiro-handler.js', ['movimentacoesCaixa', 'contasPagar', 'contasReceber', 'fechamentosCaixa']],
  ];
  for (const [arquivo, colecoes] of contratos) {
    const conteudo = ler(arquivo);
    for (const colecao of colecoes) assert.match(conteudo, new RegExp(colecao));
  }
});

test('Visão Geral consolida dados reais e identifica a fonte Firestore', () => {
  const handler = ler('api/_lib/visao-geral-handler.js');
  assert.match(handler, /listarColecoes\(restaurante/);
  assert.match(handler, /'pedidos'/);
  assert.match(handler, /'produtosCardapio'/);
  assert.match(handler, /'funcionarios'/);
  assert.match(handler, /fonte: 'firestore'/);
  assert.match(handler, /dadosDisponiveis/);
});

test('cliente global expõe APIs same-origin para os módulos de gestão', () => {
  const cliente = ler('scripts/api/modulos-client.js');
  for (const funcao of ['listarCardapio', 'listarPedidos', 'listarSalao', 'listarEquipe', 'listarFinanceiro', 'listarVisaoGeral']) {
    assert.match(cliente, new RegExp(`async function ${funcao}`));
  }
  assert.match(cliente, /credentials: 'same-origin'/);
  assert.match(cliente, /X-CSRF-Token/);
  assert.doesNotMatch(cliente, /initializeApp|FIREBASE_PRIVATE_KEY|localStorage|sessionStorage/);
});

test('bridges já reais iniciam sem registros de negócio e validam o restaurante retornado', () => {
  for (const arquivo of ['scripts/cardapio/dados-cardapio.js', 'scripts/salao/dados-mesas.js', 'scripts/salao/dados-reservas.js', 'scripts/home/dados-visao-geral.js']) {
    const conteudo = ler(arquivo);
    assert.doesNotMatch(conteudo, /preview[A-Za-z]+\s*=\s*\{/i);
    assert.match(conteudo, /meta\?\.idRestaurante/);
  }
});

test('contrato global não autoriza novas funções serverless', () => {
  const arquivos = fs.readdirSync(path.join(raiz, 'api/v1')).filter(nome => nome.endsWith('.js'));
  assert.equal(arquivos.length, 4);
});

test('frontend operacional não contém credenciais ou acesso direto ao Firebase', () => {
  const arquivos = [];
  for (const diretorio of ['paginas']) {
    function percorrer(atual) {
      for (const nome of fs.readdirSync(path.join(raiz, atual))) {
        const relativo = path.join(atual, nome);
        const absoluto = path.join(raiz, relativo);
        if (fs.statSync(absoluto).isDirectory()) {
          if (relativo === 'scripts/seguranca') continue;
          percorrer(relativo);
        }
        else if (/\.(js|html)$/.test(nome)) arquivos.push(relativo);
      }
    }
    percorrer(diretorio);
  }
  for (const arquivo of arquivos) {
    const conteudo = ler(arquivo);
    assert.doesNotMatch(conteudo, /FIREBASE_PRIVATE_KEY|firebase-admin|localStorage|sessionStorage/);
  }
});
