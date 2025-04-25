const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
    try {
        const paintkits = await prisma.paintkit.findMany({
            select: {
                id: true,
                simulatorId: true,
                url: true,
                aircraftId: true,
                developer: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(paintkits);
    } catch (error) {
        console.error('Failed to fetch paintkits:', error);
        res.status(500).json({ error: 'Failed to fetch paintkits' });
    }
});

router.post('/', authenticate, checkPermissions(['PAINT_MANAGER']), async (req, res) => {
    const { simulatorId, url, aircraftId, developer } = req.body;

    if (!simulatorId || !url || !aircraftId || !developer) {
        return res.status(400).json({ error: 'simulatorId, url, aircraftId, and developer are required' });
    }
    if (url.length > 255) {
        return res.status(400).json({ error: 'url must be 255 characters or less' });
    }
    if (developer.length > 100) {
        return res.status(400).json({ error: 'developer must be 100 characters or less' });
    }

    try {
        const paintkit = await prisma.paintkit.create({
            data: {
                simulatorId,
                url,
                aircraftId,
                developer,
            },
            select: {
                id: true,
                simulatorId: true,
                url: true,
                aircraftId: true,
                developer: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Paintkit created successfully', paintkit });
    } catch (error) {
        console.error('Failed to create paintkit:', error);
        res.status(500).json({ error: 'Failed to create paintkit' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['PAINT_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { simulatorId, url, aircraftId, developer } = req.body;

    if (!simulatorId && !url && !aircraftId && !developer) {
        return res.status(400).json({ error: 'At least one of simulatorId, url, aircraftId, or developer is required' });
    }
    if (url && url.length > 255) {
        return res.status(400).json({ error: 'url must be 255 characters or less' });
    }
    if (developer && developer.length > 100) {
        return res.status(400).json({ error: 'developer must be 100 characters or less' });
    }

    try {
        const paintkit = await prisma.paintkit.update({
            where: { id: parseInt(id) },
            data: {
                simulatorId: simulatorId || undefined,
                url: url || undefined,
                aircraftId: aircraftId || undefined,
                developer: developer || undefined,
            },
            select: {
                id: true,
                simulatorId: true,
                url: true,
                aircraftId: true,
                developer: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Paintkit updated successfully', paintkit });
    } catch (error) {
        console.error('Failed to update paintkit:', error);
        res.status(500).json({ error: 'Failed to update paintkit' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['PAINT_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.paintkit.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Paintkit deleted successfully' });
    } catch (error) {
        console.error('Failed to delete paintkit:', error);
        res.status(500).json({ error: 'Failed to delete paintkit' });
    }
});

module.exports = router;