import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const user = await prisma.user.upsert({
  where: { email: 'admin@demo.nexora.local' },
  update: {},
  create: { email: 'admin@demo.nexora.local', name: 'Demo Admin', passwordHash: await bcrypt.hash('ChangeMe123!', 10) },
});
const organization = await prisma.organization.upsert({
  where: { slug: 'demo-observability' },
  update: {},
  create: { name: 'Demo Observability', slug: 'demo-observability' },
});
await prisma.membership.upsert({
  where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
  update: { role: 'ADMIN' },
  create: { userId: user.id, organizationId: organization.id, role: 'ADMIN' },
});
if (!await prisma.executionMetric.count({ where: { tenantId: organization.id } })) {
  await prisma.executionMetric.createMany({
    data: [
      { tenantId: organization.id, type: 'WORKFLOW', status: 'SUCCESS', durationMs: 120 },
      { tenantId: organization.id, type: 'DOCUMENT', status: 'SUCCESS', durationMs: 240 },
      { tenantId: organization.id, type: 'INTEGRATION', status: 'ERROR', durationMs: 80, errorCode: 'HTTP_502' },
    ],
  });
}
console.log(`Seed listo: ${organization.id} / admin@demo.nexora.local`);
await prisma.$disconnect();
