/**
 * scripts/migrate-neon.ts
 * Aplica as migrations SQL 0000-0005 no banco Neon (staging/produção).
 *
 * Uso:
 *   DATABASE_URL=postgres://... npx tsx scripts/migrate-neon.ts
 *
 * Ou com dotenv (opcional):
 *   npm i -D dotenv  # se não instalado
 *   npx tsx scripts/migrate-neon.ts  # lê .env.neon se existir
 *
 * Segurança: NÃO loga a connection string. NÃO commita .env.neon.
 * Idempotente: usa IF NOT EXISTS onde possível; tolera colunas/tabelas já existentes.
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // Tenta carregar .env.neon se existir (dotenv opcional)
  try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: '.env.neon' });
  } catch {
    // dotenv não instalado — user deve setar DATABASE_URL manualmente
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL não definida.');
    console.error('  Export: DATABASE_URL=postgres://...');
    console.error('  Ou crie .env.neon com DATABASE_URL=postgres://...');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  console.log('Conectado ao Neon.');

  const migrationsDir = path.resolve(__dirname, '..', 'src', 'lib', 'db', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();

  console.log(`Encontradas ${files.length} migrations: ${files.join(', ')}`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Aplicando ${file}...`);
    try {
      await client.query(sql);
      console.log(`  OK`);
    } catch (err: any) {
      // Tolerância: coluna/tabela já existe = skip com warning, outros erros = stop
      if (err.message?.includes('already exists')) {
        console.log(`  SKIP (já existe)`);
      } else {
        console.error(`  ERRO em ${file}: ${err.message}`);
        await client.end();
        process.exit(1);
      }
    }
  }

  // Verifica tabelas criadas
  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('action_logs','roles','role_permissions','user_clinic_access','user_permission_overrides','permissions','instance_modules')
    ORDER BY table_name
  `);
  console.log(`Tabelas W3/W4 encontradas: ${rows.map((r: any) => r.table_name).join(', ')}`);

  // Verifica users.is_master
  const colCheck = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_master'
  `);
  console.log(`users.is_master: ${colCheck.rows.length ? 'PRESENTE' : 'AUSENTE'}`);

  await client.end();
  console.log('Migração concluída.');
}

main().catch((e) => {
  console.error('Falha na migração:', e.message);
  process.exit(1);
});
