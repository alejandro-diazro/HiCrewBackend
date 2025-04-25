const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
    try {
        const fleet = await prisma.fleet.findMany({
            select: {
                id: true,
                name: true,
                state: true,
                life: true,
                rankId: true,
                aircraft: {
                    select: {
                        id: true,
                        icao: true,
                        manufacturer: true,
                        range: true,
                        max_passengers: true,
                        img: true,
                    },
                },
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(fleet);
    } catch (error) {
        console.error('Failed to fetch fleet:', error);
        res.status(500).json({ error: 'Failed to fetch fleet' });
    }
});

router.post('/', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { aircraftId, name, state, life, rankId } = req.body;

    if (!aircraftId || !name || !state || life === undefined) {
        return res.status(400).json({ error: 'aircraftId, name, state, and life are required' });
    }
    if (name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (state.length > 50) {
        return res.status(400).json({ error: 'state must be 50 characters or less' });
    }
    if (!Number.isInteger(life) || life < 0 || life > 100) {
        return res.status(400).json({ error: 'life must be an integer between 0 and 100' });
    }
    if (rankId !== null && !Number.isInteger(rankId)) {
        return res.status(400).json({ error: 'rankId must be an integer or null' });
    }

    try {
        const fleet = await prisma.fleet.create({
            data: {
                aircraftId,
                name,
                state,
                life,
                rankId: rankId || undefined,
            },
            select: {
                id: true,
                aircraftId: true,
                name: true,
                state: true,
                life: true,
                rankId: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Fleet unit created successfully', fleet });
    } catch (error) {
        console.error('Failed to create fleet unit:', error);
        res.status(500).json({ error: 'Failed to create fleet unit' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { aircraftId, name, state, life, rankId } = req.body;

    if (!aircraftId && !name && !state && life === undefined && rankId === undefined) {
        return res.status(400).json({ error: 'At least one of aircraftId, name, state, life, or rankId is required' });
    }
    if (name && name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (state && state.length > 50) {
        return res.status(400).json({ error: 'state must be 50 characters or less' });
    }
    if (life !== undefined && (!Number.isInteger(life) || life < 0 || life > 100)) {
        return res.status(400).json({ error: 'life must be an integer between 0 and 100' });
    }
    if (rankId !== undefined && rankId !== null && !Number.isInteger(rankId)) {
        return res.status(400).json({ error: 'rankId must be an integer or null' });
    }

    try {
        const fleet = await prisma.fleet.update({
            where: { id: parseInt(id) },
            data: {
                aircraftId: aircraftId || undefined,
                name: name || undefined,
                state: state || undefined,
                life: life !== undefined ? life : undefined,
                rankId: rankId !== undefined ? rankId : undefined,
            },
            select: {
                id: true,
                aircraftId: true,
                name: true,
                state: true,
                life: true,
                rankId: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Fleet unit updated successfully', fleet });
    } catch (error) {
        console.error('Failed to update fleet unit:', error);
        res.status(500).json({ error: 'Failed to update fleet unit' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.fleet.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Fleet unit deleted successfully' });
    } catch (error) {
        console.error('Failed to delete fleet unit:', error);
        res.status(500).json({ error: 'Failed to delete fleet unit' });
    }
});

module.exports = router;