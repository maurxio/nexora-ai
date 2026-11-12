module.exports = async () => {
  await import('../env.js');
  const { default: prisma } = await import('../../apps/api/src/infrastructure/prisma.js');
  try {
    await prisma.organization.deleteMany({
      where: { memberships: { some: { user: { email: { startsWith: 'e2e-' } } } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-' } } });
  } finally {
    await prisma.$disconnect();
  }
};
