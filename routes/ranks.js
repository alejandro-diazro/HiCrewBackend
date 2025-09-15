const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const ranks = await prisma.rank.findMany({
            orderBy: { level: 'asc' },
            select: {
                id: true,
                level: true,
                name: true,
                img: true,
                hours: true,
                flights: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(ranks);
    } catch (error) {
        console.error('Failed to fetch ranks:', error);
        res.status(500).json({ error: 'Failed to fetch ranks' });
    }
});

router.patch('/level/:level', authenticate, checkPermissions(['USER_MANAGER']), async (req, res) => {
    const { level } = req.params;
    const { name, hours, flights } = req.body;

    const levelInt = parseInt(level);
    if (levelInt < 1 || levelInt > 5) {
        return res.status(400).json({ error: 'Level must be between 1 and 5' });
    }

    if (!name && hours === undefined && flights === undefined) {
        return res.status(400).json({ error: 'At least one of name, hours or flights is required' });
    }
    if (name && name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (hours !== undefined && (!Number.isInteger(hours) || hours < 0)) {
        return res.status(400).json({ error: 'hours must be a non-negative integer' });
    }
    if (flights !== undefined && (!Number.isInteger(flights) || flights < 0)) {
        return res.status(400).json({ error: 'flights must be a non-negative integer' });
    }

    try {
        const rank = await prisma.rank.update({
            where: { level: levelInt },
            data: {
                name: name || undefined,
                hours: hours !== undefined ? hours : undefined,
                flights: flights !== undefined ? flights : undefined,
            },
            select: {
                id: true,
                level: true,
                name: true,
                img: true,
                hours: true,
                flights: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Rank updated successfully', rank });
    } catch (error) {
        console.error('Failed to update rank:', error);
        res.status(500).json({ error: 'Failed to update rank' });
    }
});

router.post('/initialize', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    try {
        const existingRanks = await prisma.rank.count();

        if (existingRanks === 5) {
            return res.status(400).json({ error: 'Ranks are already initialized' });
        }

        if (existingRanks > 0) {
            await prisma.rank.deleteMany();
        }

        const defaultRanks = [
            { level: 1, name: 'Estudiante', img: '/resources/ranks/Rank1.svg', hours: 0, flights: 0 },
            { level: 2, name: 'Segundo Oficial', img: '/resources/ranks/Rank2.svg', hours: 50, flights: 10 },
            { level: 3, name: 'Primer Oficial', img: '/resources/ranks/Rank3.svg', hours: 150, flights: 30 },
            { level: 4, name: 'Capitán', img: '/resources/ranks/Rank4.svg', hours: 500, flights: 75 },
            { level: 5, name: 'Instructor', img: '/resources/ranks/Rank5.svg', hours: 1000, flights: 150 },
        ];

        const ranks = await prisma.rank.createMany({
            data: defaultRanks,
        });

        res.json({ message: 'Ranks initialized successfully', count: ranks.count });
    } catch (error) {
        console.error('Failed to initialize ranks:', error);
        res.status(500).json({ error: 'Failed to initialize ranks' });
    }
});

module.exports = router;