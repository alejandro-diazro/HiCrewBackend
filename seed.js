const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    const permissions = [
        { name: 'ADMIN', description: 'Full access to all actions' },
        { name: 'RULE_ADMIN', description: 'Create, edit, and delete rules' },
        { name: 'SOCIAL_MANAGER', description: 'Create, edit, and delete social networks' },
        { name: 'DOC_MANAGER', description: 'Create, edit, and delete documentation' },
        { name: 'EVENT_MANAGER', description: 'Create, edit, and delete events' },
        { name: 'NOTAMS_MANAGER', description: 'Create, edit, and delete NOTAMs' },
        { name: 'OPERATIONS_MANAGER', description: 'Manage simulators and airlines' },
        { name: 'USER_MANAGER', description: 'Manage medals and ranks, users' },
        { name: 'PAINT_MANAGER', description: 'Manage paintkits' },
        { name: 'TOUR_MANAGER', description: 'Manage tours, legs, and tour reports' },
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