const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
    try {
        const hubs = await prisma.hub.findMany({
            select: {
                id: true,
                airportId: true,
                airlineId: true,
                rankId: true,
                airport: {
                    select: {
                        icao: true,
                        name: true,
                        country: true,
                    },
                },
                airline: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                rank: {
                    select: {
                        id: true,
                        name: true,
                        hours: true,
                    },
                },
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(hubs);
    } catch (error) {
        console.error('Failed to fetch hubs:', error);
        res.status(500).json({ error: 'Failed to fetch hubs' });
    }
});

router.post('/', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { airportId, airlineId, rankId } = req.body;

    if (!airportId || !airlineId) {
        return res.status(400).json({ error: 'airportId and airlineId are required' });
    }
    if (typeof airportId !== 'string' || airportId.length > 4) {
        return res.status(400).json({ error: 'airportId must be a valid ICAO code (4 characters or less)' });
    }
    if (!Number.isInteger(airlineId)) {
        return res.status(400).json({ error: 'airlineId must be an integer' });
    }
    if (rankId !== undefined && rankId !== null && !Number.isInteger(rankId)) {
        return res.status(400).json({ error: 'rankId must be an integer or null' });
    }

    const airportExists = await prisma.airport.findUnique({ where: { icao: airportId } });
    if (!airportExists) {
        return res.status(400).json({ error: 'Invalid airportId' });
    }
    const airlineExists = await prisma.airline.findUnique({ where: { id: airlineId } });
    if (!airlineExists) {
        return res.status(400).json({ error: 'Invalid airlineId' });
    }
    if (rankId) {
        const rankExists = await prisma.rank.findUnique({ where: { id: rankId } });
        if (!rankExists) {
            return res.status(400).json({ error: 'Invalid rankId' });
        }
    }

    try {
        const hub = await prisma.hub.create({
            data: {
                airportId,
                airlineId,
                rankId: rankId || undefined,
            },
            select: {
                id: true,
                airportId: true,
                airlineId: true,
                rankId: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Hub created successfully', hub });
    } catch (error) {
        console.error('Failed to create hub:', error);
        res.status(500).json({ error: 'Failed to create hub' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { airportId, airlineId, rankId } = req.body;

    if (!airportId && !airlineId && rankId === undefined) {
        return res.status(400).json({ error: 'At least one of airportId, airlineId, or rankId is required' });
    }
    if (airportId && (typeof airportId !== 'string' || airportId.length > 4)) {
        return res.status(400).json({ error: 'airportId must be a valid ICAO code (4 characters or less)' });
    }
    if (airlineId && !Number.isInteger(airlineId)) {
        return res.status(400).json({ error: 'airlineId must be an integer' });
    }
    if (rankId !== undefined && rankId !== null && !Number.isInteger(rankId)) {
        return res.status(400).json({ error: 'rankId must be an integer or null' });
    }

    if (airportId) {
        const airportExists = await prisma.airport.findUnique({ where: { icao: airportId } });
        if (!airportExists) {
            return res.status(400).json({ error: 'Invalid airportId' });
        }
    }
    if (airlineId) {
        const airlineExists = await prisma.airline.findUnique({ where: { id: airlineId } });
        if (!airlineExists) {
            return res.status(400).json({ error: 'Invalid airlineId' });
        }
    }
    if (rankId) {
        const rankExists = await prisma.rank.findUnique({ where: { id: rankId } });
        if (!rankExists) {
            return res.status(400).json({ error: 'Invalid rankId' });
        }
    }

    try {
        const hub = await prisma.hub.update({
            where: { id: parseInt(id) },
            data: {
                airportId: airportId || undefined,
                airlineId: airlineId || undefined,
                rankId: rankId !== undefined ? rankId : undefined,
            },
            select: {
                id: true,
                airportId: true,
                airlineId: true,
                rankId: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Hub updated successfully', hub });
    } catch (error) {
        console.error('Failed to update hub:', error);
        res.status(500).json({ error: 'Failed to update hub' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.hub.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Hub deleted successfully' });
    } catch (error) {
        console.error('Failed to delete hub:', error);
        res.status(500).json({ error: 'Failed to delete hub' });
    }
});

router.post('/change-hub', authenticate, async (req, res) => {
    const { hubId } = req.body;
    const userId = req.user.id;

    if (!hubId || !Number.isInteger(hubId)) {
        return res.status(400).json({ error: 'hubId is required and must be an integer' });
    }

    const hubExists = await prisma.hub.findUnique({
        where: { id: hubId },
    });
    if (!hubExists) {
        return res.status(400).json({ error: 'Invalid hubId' });
    }

    try {
        const existingPilotHub = await prisma.pilotHub.findUnique({
            where: { pilotId: userId },
        });

        let pilotHub;
        if (existingPilotHub) {
            pilotHub = await prisma.pilotHub.update({
                where: { id: existingPilotHub.id },
                data: { hubId },
                select: {
                    id: true,
                    pilotId: true,
                    hubId: true,
                    hub: {
                        select: {
                            id: true,
                            airport: {
                                select: {
                                    icao: true,
                                    name: true,
                                    country: true,
                                },
                            },
                            airline: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    createdAt: true,
                    updatedAt: true,
                },
            });
            return res.json({ message: 'Hub updated successfully', pilotHub });
        } else {
            pilotHub = await prisma.pilotHub.create({
                data: {
                    pilotId: userId,
                    hubId,
                },
                select: {
                    id: true,
                    pilotId: true,
                    hubId: true,
                    hub: {
                        select: {
                            id: true,
                            airport: {
                                select: {
                                    icao: true,
                                    name: true,
                                    country: true,
                                },
                            },
                            airline: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    createdAt: true,
                    updatedAt: true,
                },
            });
            return res.status(201).json({ message: 'Hub assigned successfully', pilotHub });
        }
    } catch (error) {
        console.error('Failed to change hub:', error);
        res.status(500).json({ error: 'Failed to change hub' });
    }
});

module.exports = router;