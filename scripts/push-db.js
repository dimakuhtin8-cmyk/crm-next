const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.join(__dirname, '../packages/database/prisma/schema.prisma');
const backupPath = schemaPath + '.bak';
const original = fs.readFileSync(schemaPath, 'utf-8');
fs.writeFileSync(backupPath, original);

const target = process.argv[2]; // postgresql, mysql, sqlserver

const configs = {
  postgresql: {
    provider: 'postgresql',
    url: 'postgresql://postgres@localhost:5432/crm_next_postgres',
  },
  mysql: {
    provider: 'mysql',
    url: 'mysql://crm_user:CrmDev2026!@localhost:3306/crm_next_mariadb',
  },
  sqlserver: {
    provider: 'sqlserver',
    url: 'sqlserver://localhost:1433;database=crm_next_mssql;user=sa;password=YourStrong!Pass123;trustServerCertificate=true',
  },
};

if (!configs[target]) {
  console.error('Usage: node scripts/push-db.js postgresql|mysql|sqlserver');
  process.exit(1);
}

const cfg = configs[target];
let schema = original
  .replace(/provider\s*=\s*"[^"]+"/, `provider = "${cfg.provider}"`)
  .replace(/url\s*=\s*env\("[^"]+"\)/, `url      = "${cfg.url}"`);

fs.writeFileSync(schemaPath, schema);
console.log(`Pushing to ${target}...`);

try {
  execSync('npx prisma db push --accept-data-loss', {
    cwd: path.join(__dirname),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: cfg.url },
  });
  console.log(`Done!`);
} catch (e) {
  console.error('Push failed');
} finally {
  fs.writeFileSync(schemaPath, original);
  console.log('Schema restored');
}
