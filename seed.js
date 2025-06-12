const { PrismaClient } = require('@prisma/client');
const bcrypt = require("bcrypt");
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

    const configurations = [
        { name: 'ALLOW_PUBLIC', description: 'Allow public access to register', isActive: false },
        { name: 'ALLOW_CHARTER', description: 'Allow charter flights', isActive: false },
        { name: 'ALLOW_FREE_MODE', description: 'Allow free mode operations', isActive: false },
        { name: 'ALLOW_MANUAL_REPORT', description: 'Allow manual report submissions', isActive: false },
        { name: 'ALLOW_ACARS', description: 'Allow ACARS system integration', isActive: false },
        { name: 'ALLOW_AUTOMATIC_REPORT', description: 'Allow automatic report submissions', isActive: false },
        { name: 'ALLOW_CREATE_ACCOUNT', description: 'Allow new user account creation', isActive: false },
    ];

    for (const config of configurations) {
        await prisma.config.upsert({
            where: { name: config.name },
            update: {},
            create: config,
        });
    }

    const roles = [
        { name: 'Newbie', hours:0, img:'' }
    ];

    for (const role of roles) {
        await prisma.rank.upsert({
            where: { id: 1 },
            update: {},
            create: role,
        });
    }

    console.log('Permissions, ranks, configurations created');
}

seed()
    .catch((e) => {
        console.error('Failed to seed permissions and configurations:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });