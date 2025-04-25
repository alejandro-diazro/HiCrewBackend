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
                name: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
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

router.post('/', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    const { name, isActive } = req.body;

    if (!name || isActive === undefined) {
        return res.status(400).json({ error: 'name and isActive are required' });
    }
    if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    try {
        const config = await prisma.config.create({
            data: {
                name,
                isActive,
            },
            select: {
                name: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Configuration created successfully', config });
    } catch (error) {
        console.error('Failed to create configuration:', error);
        res.status(500).json({ error: 'Failed to create configuration' });
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

router.delete('/:name', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    const { name } = req.params;

    try {
        await prisma.config.delete({
            where: { name },
        });
        res.json({ message: 'Configuration deleted successfully' });
    } catch (error) {
        console.error('Failed to delete configuration:', error);
        res.status(500).json({ error: 'Failed to delete configuration' });
    }
});

module.exports = router;