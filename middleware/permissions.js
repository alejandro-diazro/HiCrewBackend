const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const checkPermissions = (requiredPermissions) => {
    return async (req, res, next) => {
        const userId = req.user.id;

        try {
            const pilot = await prisma.pilot.findUnique({
                where: { id: userId },
                include: {
                    pilotPermissions: {
                        include: {
                            permission: true,
                        },
                    },
                },
            });

            if (!pilot) {
                return res.status(404).json({ error: 'Pilot not found' });
            }

            const userPermissions = pilot.pilotPermissions.map((pp) => pp.permission.name);

            const hasPermission = requiredPermissions.some((perm) => userPermissions.includes(perm));

            if (!hasPermission) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            next();
        } catch (error) {
            console.error('Failed to check permissions:', error);
            res.status(500).json({ error: 'Failed to check permissions' });
        }
    };
};

module.exports = checkPermissions;