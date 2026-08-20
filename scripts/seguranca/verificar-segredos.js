'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const RAIZ = path.resolve(process.env.APEX_SCAN_ROOT || path.join(__dirname, '..', '..'));
const LIMITE_ARQUIVO = 5 * 1024 * 1024;
const EXTENSOES_TEXTO = new Set([
  '.cjs', '.css', '.env', '.html', '.js', '.json', '.md', '.mjs', '.rules', '.sh', '.txt', '.ts', '.yml', '.yaml',
]);

function padraoPrivado(marcador) {
  return new RegExp(`-----BEGIN (?:RSA |EC |OPENSSH |)${marcador} KEY-----`, 'i');
}

const PADROES = [
  ['chave privada PEM', padraoPrivado('PRIVATE')],
  ['token GitHub ghp', new RegExp(`ghp${'_'}[A-Za-z0-9]{20,}`)],
  ['token GitHub fine-grained', new RegExp(`github_pat${'_'}[A-Za-z0-9_]{20,}`)],
  ['chave AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['token Slack', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['chave de API secreta', /\bsk-[A-Za-z0-9]{20,}\b/],
  ['variável de chave privada preenchida', new RegExp(`FIREBASE_PRIVATE${'_'}KEY\\s*[:=]\\s*(?!replace-with${'-'}|<|$)[^\\s#]+`, 'i')],
];

function arquivosVersionados() {
  try {
    const saida = execFileSync('git', ['-C', RAIZ, 'ls-files', '-co', '--exclude-standard'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return saida.split('\n').map((item) => item.trim()).filter(Boolean);
  } catch {
    const encontrados = [];
    const visitar = (diretorio) => {
      for (const entrada of fs.readdirSync(diretorio, { withFileTypes: true })) {
        if (['.git', 'node_modules', 'coverage', 'dist'].includes(entrada.name)) continue;
        const absoluto = path.join(diretorio, entrada.name);
        if (entrada.isDirectory()) visitar(absoluto);
        else encontrados.push(path.relative(RAIZ, absoluto));
      }
    };
    visitar(RAIZ);
    return encontrados;
  }
}

function linhaDoIndice(texto, indice) {
  return texto.slice(0, indice).split('\n').length;
}

function verificar() {
  const achados = [];
  for (const relativo of arquivosVersionados()) {
    const absoluto = path.join(RAIZ, relativo);
    const extensao = path.extname(relativo).toLowerCase();
    if (!EXTENSOES_TEXTO.has(extensao)) continue;
    let conteudo;
    try {
      const dados = fs.readFileSync(absoluto);
      if (dados.length > LIMITE_ARQUIVO || dados.includes(0)) continue;
      conteudo = dados.toString('utf8');
    } catch {
      continue;
    }
    for (const [nome, padrao] of PADROES) {
      const correspondencia = conteudo.match(padrao);
      if (correspondencia) {
        achados.push({ arquivo: relativo, linha: linhaDoIndice(conteudo, correspondencia.index), tipo: nome });
      }
    }
  }
  return achados;
}

if (require.main === module) {
  const achados = verificar();
  if (achados.length) {
    console.error('Falha: possíveis segredos encontrados:');
    for (const achado of achados) console.error(`${achado.arquivo}:${achado.linha} — ${achado.tipo}`);
    process.exitCode = 1;
  } else {
    console.log('SEGREDOS_OK: nenhum padrão de credencial sensível foi encontrado nos arquivos versionados.');
  }
}

module.exports = { verificar };
