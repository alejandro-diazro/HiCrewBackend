const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/pilot/:pilotId', authenticate, checkPermissions(['USER_MANAGER']), async (req, res) => {
    const { pilotId } = req.params;

    if (!Number.isInteger(parseInt(pilotId))) {
        return res.status(400).json({ error: 'pilotId must be an integer' });
    }

    try {
        const pilotExists = await prisma.pilot.findUnique({
            where: { id: parseInt(pilotId) },
        });
        if (!pilotExists) {
            return res.status(404).json({ error: 'Pilot not found' });
        }

        const pilotMedals = await prisma.pilotMedal.findMany({
            where: { pilotId: parseInt(pilotId) },
            select: {
                pilotId: true,
                medalId: true,
                medal: {
                    select: {
                        id: true,
                        img: true,
                        text: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        });
        res.json(pilotMedals);
        
    } catch (error) {
        console.error('Failed to fetch pilot medals:', error);
        res.status(500).json({ error: 'Failed to fetch pilot medals' });
    }
});

router.post('/', authenticate, checkPermissions(['USER_MANAGER']), async (req, res) => {
    const { pilotId, medalId } = req.body;

    if (!pilotId || !Number.isInteger(pilotId)) {
        return res.status(400).json({ error: 'pilotId is required and must be an integer' });
    }
    if (!medalId || !Number.isInteger(medalId)) {
        return res.status(400).json({ error: 'medalId is required and must be an integer' });
    }

    const pilotExists = await prisma.pilot.findUnique({
        where: { id: pilotId },
    });
    if (!pilotExists) {
        return res.status(404).json({ error: 'Pilot not found' });
    }

    const medalExists = await prisma.medal.findUnique({
        where: { id: medalId },
    });
    if (!medalExists) {
        return res.status(404).json({ error: 'Medal not found' });
    }

    const existingPilotMedal = await prisma.pilotMedal.findUnique({
        where: {
            pilotId_medalId: {
                pilotId,
                medalId,
            },
        },
    });
    if (existingPilotMedal) {
        return res.status(400).json({ error: 'Pilot already has this medal' });
    }

    try {
        const pilotMedal = await prisma.pilotMedal.create({
            data: {
                pilotId,
                medalId,
            },
            select: {
                pilotId: true,
                medalId: true,
                createdAt: true,
                updatedAt: true,
                medal: {
                    select: {
                        id: true,
                        img: true,
                        text: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        });
        res.status(201).json({ message: 'Medal assigned successfully', pilotMedal });
    } catch (error) {
        console.error('Failed to assign medal:', error);
        res.status(500).json({ error: 'Failed to assign medal' });
    }
});

router.delete('/:pilotId/:medalId', authenticate, checkPermissions(['USER_MANAGER']), async (req, res) => {
    const { pilotId, medalId } = req.params;

    if (!Number.isInteger(parseInt(pilotId))) {
        return res.status(400).json({ error: 'pilotId must be an integer' });
    }
    if (!Number.isInteger(parseInt(medalId))) {
        return res.status(400).json({ error: 'medalId must be an integer' });
    }

    try {
        const pilotMedal = await prisma.pilotMedal.findUnique({
            where: {
                pilotId_medalId: {
                    pilotId: parseInt(pilotId),
                    medalId: parseInt(medalId),
                },
            },
        });
        if (!pilotMedal) {
            return res.status(404).json({ error: 'Pilot does not have this medal' });
        }

        await prisma.pilotMedal.delete({
            where: {
                pilotId_medalId: {
                    pilotId: parseInt(pilotId),
                    medalId: parseInt(medalId),
                },
            },
        });
        res.json({ message: 'Medal removed successfully' });
    } catch (error) {
        console.error('Failed to remove medal:', error);
        res.status(500).json({ error: 'Failed to remove medal' });
    }
});

module.exports = router;