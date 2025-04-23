const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    const permissions = [
        { name: 'ADMIN', description: 'Full access to all actions' },
        { name: 'RULE_ADMIN', description: 'Create, edit, and delete rules' },
    ];

    for (const permission of permissions) {
        await prisma.permission.upsert({
            where: { name: permission.name },
            update: {},
            create: permission,
        });
    }

    console.log('Permissions created');
}

seed()
    .catch((e) => {
        console.error('Failed to seed permissions:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });