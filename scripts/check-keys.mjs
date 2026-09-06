import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const tenants = await prisma.tenant.findMany({
  select: { id: true, name: true, aiApiKey: true, geminiApiKey: true },
});
for (const t of tenants) {
  const mask = (v) => {
    if (!v) return '(пусто)';
    if (v.includes(':') && v.split(':').length === 3) return 'iv:tag:ciphertext ✓ (зашифровано)';
    return 'PLAINTEXT: ' + v.slice(0, 8) + '...';
  };
  console.log('Tenant: ' + t.name);
  console.log('  aiApiKey:    ' + mask(t.aiApiKey));
  console.log('  geminiApiKey:' + mask(t.geminiApiKey));
}
await prisma.$disconnect();
