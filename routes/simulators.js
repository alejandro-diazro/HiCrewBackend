const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const simulators = await prisma.simulator.findMany({
            select: {
                id: true,
                name: true,
                logo: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(simulators);
    } catch (error) {
        console.error('Failed to fetch simulators:', error);
        res.status(500).json({ error: 'Failed to fetch simulators' });
    }
});

router.post('/', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { name, logo } = req.body;

    if (!name || !logo) {
        return res.status(400).json({ error: 'name and logo are required' });
    }
    if (name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (logo.length > 255) {
        return res.status(400).json({ error: 'logo must be 255 characters or less' });
    }

    try {
        const simulator = await prisma.simulator.create({
            data: {
                name,
                logo,
            },
            select: {
                id: true,
                name: true,
                logo: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Simulator created successfully', simulator });
    } catch (error) {
        console.error('Failed to create simulator:', error);
        res.status(500).json({ error: 'Failed to create simulator' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { name, logo } = req.body;

    if (!name && !logo) {
        return res.status(400).json({ error: 'At least one of name or logo is required' });
    }
    if (name && name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (logo && logo.length > 255) {
        return res.status(400).json({ error: 'logo must be 255 characters or less' });
    }

    try {
        const simulator = await prisma.simulator.update({
            where: { id: parseInt(id) },
            data: {
                name: name || undefined,
                logo: logo || undefined,
            },
            select: {
                id: true,
                name: true,
                logo: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Simulator updated successfully', simulator });
    } catch (error) {
        console.error('Failed to update simulator:', error);
        res.status(500).json({ error: 'Failed to update simulator' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.simulator.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Simulator deleted successfully' });
    } catch (error) {
        console.error('Failed to delete simulator:', error);
        res.status(500).json({ error: 'Failed to delete simulator' });
    }
});

module.exports = router;