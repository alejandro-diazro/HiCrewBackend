const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
    try {
        const routes = await prisma.route.findMany({
            select: {
                id: true,
                departureIcao: true,
                departure: {
                    select: {
                        icao: true,
                        iata: true,
                        name: true,
                        country: true,
                    },
                },
                arrivalIcao: true,
                arrival: {
                    select: {
                        icao: true,
                        iata: true,
                        name: true,
                        country: true,
                    },
                },
                aircraftId: true,
                aircraft: {
                    select: {
                        id: true,
                        icao: true,
                        manufacturer: true,
                    },
                },
                airlineId: true,
                airline: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                callsign: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(routes);
    } catch (error) {
        console.error('Failed to fetch routes:', error);
        res.status(500).json({ error: 'Failed to fetch routes' });
    }
});

router.post('/', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { departureIcao, arrivalIcao, aircraftId, airlineId, callsign } = req.body;

    if (!departureIcao || !arrivalIcao || !aircraftId || !airlineId) {
        return res.status(400).json({ error: 'departureIcao, arrivalIcao, aircraftId, and airlineId are required' });
    }
    if (departureIcao.length !== 4 || arrivalIcao.length !== 4) {
        return res.status(400).json({ error: 'departureIcao and arrivalIcao must be exactly 4 characters' });
    }
    if (departureIcao === arrivalIcao) {
        return res.status(400).json({ error: 'departureIcao and arrivalIcao cannot be the same' });
    }
    if (callsign.length > 8) {
        return res.status(400).json({ error: 'callsign must not exceed 8 characters' });
    }

    try {
        const route = await prisma.route.create({
            data: {
                departureIcao,
                arrivalIcao,
                aircraftId,
                airlineId,
                callsign,
            },
            select: {
                id: true,
                departureIcao: true,
                arrivalIcao: true,
                aircraftId: true,
                airlineId: true,
                callsign: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Route created successfully', route });
    } catch (error) {
        console.error('Failed to create route:', error);
        res.status(500).json({ error: 'Failed to create route' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { departureIcao, arrivalIcao, aircraftId, airlineId, callsign } = req.body;

    if (!departureIcao && !arrivalIcao && !aircraftId && !airlineId && callsign === undefined) {
        return res.status(400).json({ error: 'At least one of departureIcao, arrivalIcao, aircraftId, or airlineId is required' });
    }
    if (departureIcao && departureIcao.length !== 4) {
        return res.status(400).json({ error: 'departureIcao must be exactly 4 characters' });
    }
    if (arrivalIcao && arrivalIcao.length !== 4) {
        return res.status(400).json({ error: 'arrivalIcao must be exactly 4 characters' });
    }
    if (departureIcao && arrivalIcao && departureIcao === arrivalIcao) {
        return res.status(400).json({ error: 'departureIcao and arrivalIcao cannot be the same' });
    }
    if (callsign && callsign.length > 8) {
        return res.status(400).json({ error: 'callsign must not exceed 8 characters' });
    }

    try {
        const route = await prisma.route.update({
            where: { id: parseInt(id) },
            data: {
                departureIcao: departureIcao || undefined,
                arrivalIcao: arrivalIcao || undefined,
                aircraftId: aircraftId || undefined,
                airlineId: airlineId || undefined,
                callsign: callsign || undefined,
            },
            select: {
                id: true,
                departureIcao: true,
                arrivalIcao: true,
                aircraftId: true,
                airlineId: true,
                callsign: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Route updated successfully', route });
    } catch (error) {
        console.error('Failed to update route:', error);
        res.status(500).json({ error: 'Failed to update route' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.route.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Route deleted successfully' });
    } catch (error) {
        console.error('Failed to delete route:', error);
        res.status(500).json({ error: 'Failed to delete route' });
    }
});

module.exports = router;