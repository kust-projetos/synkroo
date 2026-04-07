#!/usr/bin/env node

/**
 * Synkroo - Database Setup Script
 * Configura e verifica o banco de dados Supabase
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
      log('✅ Arquivo criado. Configure suas variáveis de ambiente!', 'green');
    } else {
      log('📝 Criando .env.local com template...', 'yellow');
      const template = `# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MiniMax API
MINIMAX_API_KEY=your-minimax-api-key
MINIMAX_API_URL=https://api.minimax.io/v1/text/chatcompletion_v2
MINIMAX_MODEL=MiniMax-M2.7

# WhatsApp
WHATSAPP_HEADLESS=false
WHATSAPP_SESSION_PATH=./.whatsapp-session
`;
      fs.writeFileSync(envPath, template);
      log('✅ Arquivo criado. Configure suas variáveis de ambiente!', 'green');
    }
    return false;
  }

  log('✅ Arquivo .env.local encontrado', 'green');
  return true;
}

function checkSupabaseCLI() {
  try {
    const version = execSync('npx supabase --version', { encoding: 'utf-8' }).trim();
    log(`✅ Supabase CLI: ${version}`, 'green');
    return true;
  } catch (error) {
    log('❌ Supabase CLI não encontrado', 'red');
    log('   Instale com: npm install -g supabase', 'yellow');
    return false;
  }
}

function checkMigrations() {
  const migrationsPath = path.join(__dirname, '..', 'supabase', 'migrations');

  if (!fs.existsSync(migrationsPath)) {
    log('❌ Pasta de migrations não encontrada', 'red');
    return false;
  }

  const migrations = fs.readdirSync(migrationsPath).filter(f => f.endsWith('.sql'));
  log(`✅ ${migrations.length} migrations encontradas`, 'green');

  migrations.forEach(m => {
    log(`   - ${m}`, 'blue');
  });

  return true;
}

function checkSupabaseConnection() {
  try {
    // Tenta carregar variáveis de ambiente
    require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      log('❌ Variáveis Supabase não configuradas', 'red');
      return false;
    }

    if (supabaseUrl.includes('your-project')) {
      log('❌ Configure NEXT_PUBLIC_SUPABASE_URL no .env.local', 'red');
      return false;
    }

    log(`✅ Supabase URL: ${supabaseUrl}`, 'green');
    return true;
  } catch (error) {
    log('❌ Erro ao verificar conexão', 'red');
    return false;
  }
}

async function main() {
  log('\n🔍 Verificando configuração do Synkroo...\n', 'blue');

  const checks = [
    { name: 'Arquivo .env.local', fn: checkEnvFile },
    { name: 'Supabase CLI', fn: checkSupabaseCLI },
    { name: 'Migrations', fn: checkMigrations },
    { name: 'Conexão Supabase', fn: checkSupabaseConnection },
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
    const icon = r.passed ? '✅' : '❌';
    const color = r.passed ? 'green' : 'red';
    log(`${icon} ${r.name}`, color);
  });

  log(`\n${passed}/${total} verificações passaram`, passed === total ? 'green' : 'yellow');

  if (passed === total) {
    log('\n🚀 Tudo pronto! Execute:', 'green');
    log('   npx supabase db push    # Para aplicar migrations', 'blue');
  } else {
    log('\n⚠️  Corrija os problemas acima antes de continuar', 'yellow');
  }
}

main().catch(console.error);