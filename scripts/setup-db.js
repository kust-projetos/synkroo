#!/usr/bin/env node

/**
 * Synkroo - Database Setup Script
 *
 * Verifica e configura o ambiente PostgreSQL local com pgvector.
 * Requirements: Docker, Docker Compose, DATABASE_URL configurada.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envExamplePath = path.join(__dirname, '..', '.env.example');

  if (!fs.existsSync(envPath)) {
    log('❌ Arquivo .env.local não encontrado!', 'red');
    if (fs.existsSync(envExamplePath)) {
      log('📋 Copiando .env.example para .env.local...', 'yellow');
      fs.copyFileSync(envExamplePath, envPath);
      log('✅ .env.local criado. Edite e configure as variáveis!', 'green');
    }
    return false;
  }
  log('✅ .env.local encontrado', 'green');

  // Load env
  require('dotenv').config({ path: envPath });
  return true;
}

function checkDocker() {
  try {
    execSync('docker info', { stdio: 'pipe' });
    log('✅ Docker está rodando', 'green');
    return true;
  } catch {
    log('❌ Docker não está rodando', 'red');
    log('   Instale e inicie o Docker Desktop ou engine', 'yellow');
    return false;
  }
}

function checkDockerCompose() {
  try {
    execSync('docker compose version', { stdio: 'pipe' });
    log('✅ Docker Compose disponível', 'green');
    return true;
  } catch {
    log('❌ Docker Compose não encontrado', 'red');
    log('   docker compose faz parte do Docker Desktop', 'yellow');
    return false;
  }
}

function checkDatabaseUrl() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    log('❌ DATABASE_URL não configurada', 'red');
    log('   Adicione DATABASE_URL ao .env.local', 'yellow');
    return false;
  }

  // Basic sanity: must be a postgres:// URL
  if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
    log(`❌ DATABASE_URL inválida: ${dbUrl}`, 'red');
    log('   Deve começar com postgres:// ou postgresql://', 'yellow');
    return false;
  }

  log(`✅ DATABASE_URL configurada`, 'green');
  return true;
}

function checkContainer() {
  try {
    const status = execSync(
      'docker compose ps --format json postgres 2>nul',
      { encoding: 'utf-8', stdio: 'pipe' },
    ).trim();

    if (status && status.includes('"State":"running"')) {
      log('✅ Container PostgreSQL está rodando', 'green');
      return true;
    }

    if (status && status.includes('"State"')) {
      // Container exists but not running
      log('⚠️  Container PostgreSQL existe mas não está rodando', 'yellow');
      log('   Execute: docker compose up -d', 'blue');
      return false;
    }

    log('⚠️  Container PostgreSQL não iniciado', 'yellow');
    log('   Execute: docker compose up -d', 'blue');
    return false;
  } catch {
    log('⚠️  Container PostgreSQL não encontrado', 'yellow');
    log('   Execute: docker compose up -d', 'blue');
    return false;
  }
}

function checkPgvector() {
  try {
    const result = execSync(
      `docker compose exec -T postgres psql -U ${process.env.POSTGRES_USER || 'synkroo'} -d ${process.env.POSTGRES_DB || 'synkroo'} -c "SELECT extname FROM pg_extension WHERE extname = 'vector';" 2>/dev/null`,
      { encoding: 'utf-8', stdio: 'pipe' },
    ).trim();
    if (result.includes('vector')) {
      log('✅ pgvector extension disponível', 'green');
      return true;
    }
    log('⚠️  pgvector não detectado (será ativado nas migrations)', 'yellow');
    return false;
  } catch {
    log('⚠️  Não foi possível verificar pgvector', 'yellow');
    return false;
  }
}

async function main() {
  log('\n🔍 Verificando ambiente PostgreSQL do Synkroo...\n', 'blue');

  const checks = [
    { name: '.env.local', fn: checkEnvFile },
    { name: 'Docker', fn: checkDocker },
    { name: 'Docker Compose', fn: checkDockerCompose },
    { name: 'DATABASE_URL', fn: checkDatabaseUrl },
    { name: 'Container PostgreSQL', fn: checkContainer },
    { name: 'pgvector extension', fn: checkPgvector },
  ];

  const results = [];
  for (const check of checks) {
    log(`\n📋 ${check.name}:`, 'blue');
    const result = check.fn();
    results.push({ name: check.name, passed: result });
  }

  log('\n' + '='.repeat(50), 'blue');
  log('📊 Resumo da Verificação:', 'blue');
  log('='.repeat(50), 'blue');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(r => {
    const icon = r.passed ? '✅' : '⚠️ ';
    const color = r.passed ? 'green' : 'yellow';
    log(`${icon} ${r.name}`, color);
  });

  log(`\n${passed}/${total} verificações OK`, passed === total ? 'green' : 'yellow');

  if (passed === total) {
    log('\n🚀 Tudo pronto! Execute:', 'green');
    log('   npm run db:migrate    # Aplicar migrations', 'blue');
    log('   npm run db:seed       # Popular dados de exemplo', 'blue');
  } else {
    log('\n⚠️  Corrija os problemas acima antes de continuar', 'yellow');
    log('\n   Comandos úteis:', 'blue');
    log('   docker compose up -d                         # Iniciar PostgreSQL', 'blue');
    log('   docker compose ps                            # Ver status', 'blue');
    log('   DATABASE_URL=postgres://... npm run db:migrate  # Migrar', 'blue');
  }
}

main().catch(console.error);
