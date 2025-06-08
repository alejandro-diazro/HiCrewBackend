const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/:name', async (req, res) => {
    const { name } = req.params;

    try {
        const config = await prisma.config.findUnique({
            where: { name },
            select: {
                isActive: true,
            },
        });

        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }

        res.json(config);
    } catch (error) {
        console.error('Failed to fetch configuration:', error);
        res.status(500).json({ error: 'Failed to fetch configuration' });
    }
});

router.get('/', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    try {
        const configs = await prisma.config.findMany({
            select: {
                name: true,
                description: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!configs || configs.length === 0) {
            return res.status(404).json({ error: 'No configurations found' });
        }

        res.json(configs);
    } catch (error) {
        console.error('Failed to fetch configurations:', error);
        res.status(500).json({ error: 'Failed to fetch configurations' });
    }
});

router.patch('/:name', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    const { name } = req.params;
    const { isActive } = req.body;

    if (isActive === undefined) {
        return res.status(400).json({ error: 'isActive is required' });
    }
    if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    try {
        const config = await prisma.config.update({
            where: { name },
            data: { isActive },
            select: {
                name: true,
                description: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Configuration updated successfully', config });
    } catch (error) {
        console.error('Failed to update configuration:', error);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

module.exports = router;