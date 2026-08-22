'use strict';

const PLACEHOLDERS = /replace-with|example\.com|<[^>]+>|changeme|your[-_]/i;
const PROJETO_DEVELOPMENT = 'apex-food-6c1cb';
const CONFIRMACAO_SOMENTE_LEITURA = 'APEX-RELATORIO-SOMENTE-LEITURA';
const AMBIENTES_VALIDOS = new Set(['development', 'preview', 'production']);

function exigir(env, nome, erros) {
  const valor = env[nome];
  if (typeof valor !== 'string' || !valor.trim() || PLACEHOLDERS.test(valor)) erros.push(`${nome}_AUSENTE_OU_PLACEHOLDER`);
  return typeof valor === 'string' ? valor.trim() : '';
}

function validarPreflight({ env = process.env, argumentos = [] } = {}) {
  const erros = [];
  const ambiente = String(env.APP_ENV || '').trim().toLowerCase();
  const projeto = exigir(env, 'FIREBASE_PROJECT_ID', erros);
  if (!AMBIENTES_VALIDOS.has(ambiente)) erros.push('APP_ENV_INVALIDO');
  if (ambiente !== 'development' && projeto === PROJETO_DEVELOPMENT) erros.push('PROJETO_DEVELOPMENT_FORA_DO_AMBIENTE');
  if (ambiente === 'production' && env.APP_CHECK_MODE !== 'enforce') erros.push('APPCHECK_PRODUCTION_DEVE_SER_ENFORCE');
  exigir(env, 'FIREBASE_CLIENT_EMAIL', erros);
  exigir(env, 'FIREBASE_PRIVATE_KEY', erros);
  exigir(env, 'SESSION_SECRET', erros);
  exigir(env, 'CSRF_SECRET', erros);
  if ((env.SESSION_SECRET || '').length < 32) erros.push('SESSION_SECRET_CURTO');
  if ((env.CSRF_SECRET || '').length < 32) erros.push('CSRF_SECRET_CURTO');
  if (env.SESSION_SECRET && env.SESSION_SECRET === env.CSRF_SECRET) erros.push('SEGREDOS_IGUAIS');
  if (!argumentos.includes('--somente-leitura')) erros.push('CONFIRMACAO_SOMENTE_LEITURA_AUSENTE');
  if (argumentos.some((argumento) => /^--(aplicar|forcar|excluir|corrigir)(=|$)/.test(argumento))) erros.push('MODO_DESTRUTIVO_NAO_PERMITIDO');
  if (env.MIGRACAO_CONFIRMACAO && env.MIGRACAO_CONFIRMACAO !== CONFIRMACAO_SOMENTE_LEITURA) erros.push('CONFIRMACAO_INVALIDA');
  return { valido: erros.length === 0, erros, ambiente, projeto: projeto || null, modo: 'somente_leitura' };
}

if (require.main === module) {
  const resultado = validarPreflight();
  if (!resultado.valido) {
    console.error('MIGRACAO_PREFLIGHT_FALHOU');
    for (const erro of resultado.erros) console.error(`- ${erro}`);
    process.exitCode = 1;
  } else {
    console.log(`MIGRACAO_PREFLIGHT_OK: ambiente=${resultado.ambiente}; modo=${resultado.modo}; nenhum segredo foi exibido.`);
  }
}

module.exports = { validarPreflight, CONFIRMACAO_SOMENTE_LEITURA, AMBIENTES_VALIDOS, PROJETO_DEVELOPMENT };
