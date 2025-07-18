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
                locationIcao: true,
                hubId: true,
                life: true,
                rankId: true,
                reg: true,
                airline: {
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                        tail: true,
                    }
                },
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
                location: {
                    select: {
                        icao: true,
                        name: true,
                    },
                },
                hub: {
                    select: {
                        id: true,
                        airport: {
                            select: {
                                icao: true,
                                name: true,
                            },
                        },
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
    const { aircraftId, airlineId, name, reg, state, locationIcao, hubId, life, rankId } = req.body;

    if (!aircraftId || !airlineId || !name || !reg || state === undefined || !locationIcao || life === undefined) {
        return res.status(400).json({ error: 'aircraftId, airlineId, name, reg, state, locationIcao, and life are required' });
    }
    if (name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (reg.length !== 6) {
        return res.status(400).json({ error: 'reg must be exactly 6 characters' });
    }
    if (state.length > 50) {
        return res.status(400).json({ error: 'state must be 50 characters or less' });
    }
    if (!Number.isInteger(airlineId)) {
        return res.status(400).json({ error: 'airlineId must be an integer' });
    }
    if (!Number.isInteger(life) || life < 0 || life > 100) {
        return res.status(400).json({ error: 'life must be an integer between 0 and 100' });
    }
    if (hubId !== undefined && hubId !== null && !Number.isInteger(hubId)) {
        return res.status(400).json({ error: 'hubId must be an integer or null' });
    }
    if (rankId !== null && !Number.isInteger(rankId)) {
        return res.status(400).json({ error: 'rankId must be an integer or null' });
    }

    const airport = await prisma.airport.findUnique({ where: { icao: locationIcao } });
    if (!airport) {
        return res.status(400).json({ error: 'Invalid locationIcao: Airport not found' });
    }

    if (hubId) {
        const hub = await prisma.hub.findUnique({ where: { id: hubId } });
        if (!hub) {
            return res.status(400).json({ error: 'Invalid hubId: Hub not found' });
        }
    }

    try {
        const fleet = await prisma.fleet.create({
            data: {
                aircraftId,
                airlineId,
                name,
                reg,
                state,
                locationIcao,
                hubId: hubId || undefined,
                life,
                rankId: rankId || undefined,
            },
            select: {
                id: true,
                aircraftId: true,
                airlineId: true,
                name: true,
                reg: true,
                state: true,
                locationIcao: true,
                hubId: true,
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
    const { aircraftId, airlineId, name, reg, state, locationIcao, hubId, life, rankId } = req.body;

    if (!aircraftId && !airlineId && !name && !reg && state === undefined && !locationIcao && hubId === undefined && life === undefined && rankId === undefined) {
        return res.status(400).json({ error: 'At least one of aircraftId, airlineId, name, reg, state, locationIcao, hubId, life, or rankId is required' });
    }
    if (name && name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (reg && reg.length !== 6) {
        return res.status(400).json({ error: 'reg must be exactly 6 characters' });
    }
    if (state && state.length > 50) {
        return res.status(400).json({ error: 'state must be 50 characters or less' });
    }
    if (life !== undefined && (!Number.isInteger(life) || life < 0 || life > 100)) {
        return res.status(400).json({ error: 'life must be an integer between 0 and 100' });
    }
    if (airlineId && !Number.isInteger(airlineId)) {
        return res.status(400).json({ error: 'airlineId must be an integer' });
    }
    if (rankId !== undefined && rankId !== null && !Number.isInteger(rankId)) {
        return res.status(400).json({ error: 'rankId must be an integer or null' });
    }
    if (hubId !== undefined && hubId !== null && !Number.isInteger(hubId)) {
        return res.status(400).json({ error: 'hubId must be an integer or null' });
    }
    if (locationIcao) {
        const airport = await prisma.airport.findUnique({ where: { icao: locationIcao } });
        if (!airport) {
            return res.status(400).json({ error: 'Invalid locationIcao: Airport not found' });
        }
    }
    if (hubId) {
        const hub = await prisma.hub.findUnique({ where: { id: hubId } });
        if (!hub) {
            return res.status(400).json({ error: 'Invalid hubId: Hub not found' });
        }
    }

    try {
        const fleet = await prisma.fleet.update({
            where: { id: parseInt(id) },
            data: {
                aircraftId: aircraftId || undefined,
                airlineId: airlineId || undefined,
                name: name || undefined,
                reg: reg || undefined,
                state: state !== undefined ? state : undefined,
                locationIcao: locationIcao || undefined,
                hubId: hubId !== undefined ? hubId : undefined,
                life: life !== undefined ? life : undefined,
                rankId: rankId !== undefined ? rankId : undefined,
            },
            select: {
                id: true,
                aircraftId: true,
                airlineId: true,
                name: true,
                reg: true,
                state: true,
                locationIcao: true,
                hubId: true,
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

router.get('/hubs', authenticate, async (req, res) => {
    try {
        const hubs = await prisma.hub.findMany({
            select: {
                id: true,
                airport: {
                    select: {
                        icao: true,
                        name: true,
                    },
                },
                airline: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        res.json(hubs);
    } catch (error) {
        console.error('Failed to fetch hubs:', error);
        res.status(500).json({ error: 'Failed to fetch hubs' });
    }
});

module.exports = router;