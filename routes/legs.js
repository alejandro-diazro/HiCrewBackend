const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
    try {
        const legs = await prisma.leg.findMany({
            select: {
                id: true,
                tourId: true,
                airportDepartureIcao: true,
                airportDeparture: {
                    select: {
                        icao: true,
                        iata: true,
                        name: true,
                        country: true,
                    },
                },
                airportArrivalIcao: true,
                airportArrival: {
                    select: {
                        icao: true,
                        iata: true,
                        name: true,
                        country: true,
                    },
                },
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(legs);
    } catch (error) {
        console.error('Failed to fetch legs:', error);
        res.status(500).json({ error: 'Failed to fetch legs' });
    }
});

router.post('/', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    const { tourId, airportDepartureIcao, airportArrivalIcao } = req.body;

    if (!tourId || !airportDepartureIcao || !airportArrivalIcao) {
        return res.status(400).json({ error: 'tourId, airportDepartureIcao, and airportArrivalIcao are required' });
    }
    if (airportDepartureIcao.length !== 4 || airportArrivalIcao.length !== 4) {
        return res.status(400).json({ error: 'airportDepartureIcao and airportArrivalIcao must be exactly 4 characters' });
    }
    if (airportDepartureIcao === airportArrivalIcao) {
        return res.status(400).json({ error: 'airportDepartureIcao and airportArrivalIcao cannot be the same' });
    }

    try {
        const leg = await prisma.leg.create({
            data: {
                tourId,
                airportDepartureIcao,
                airportArrivalIcao,
            },
            select: {
                id: true,
                tourId: true,
                airportDepartureIcao: true,
                airportArrivalIcao: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Leg created successfully', leg });
    } catch (error) {
        console.error('Failed to create leg:', error);
        res.status(500).json({ error: 'Failed to create leg' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { tourId, airportDepartureIcao, airportArrivalIcao } = req.body;

    if (!tourId && !airportDepartureIcao && !airportArrivalIcao) {
        return res.status(400).json({ error: 'At least one of tourId, airportDepartureIcao, or airportArrivalIcao is required' });
    }
    if (airportDepartureIcao && airportDepartureIcao.length !== 4) {
        return res.status(400).json({ error: 'airportDepartureIcao must be exactly 4 characters' });
    }
    if (airportArrivalIcao && airportArrivalIcao.length !== 4) {
        return res.status(400).json({ error: 'airportArrivalIcao must be exactly 4 characters' });
    }
    if (airportDepartureIcao && airportArrivalIcao && airportDepartureIcao === airportArrivalIcao) {
        return res.status(400).json({ error: 'airportDepartureIcao and airportArrivalIcao cannot be the same' });
    }

    try {
        const leg = await prisma.leg.update({
            where: { id: parseInt(id) },
            data: {
                tourId: tourId || undefined,
                airportDepartureIcao: airportDepartureIcao || undefined,
                airportArrivalIcao: airportArrivalIcao || undefined,
            },
            select: {
                id: true,
                tourId: true,
                airportDepartureIcao: true,
                airportArrivalIcao: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Leg updated successfully', leg });
    } catch (error) {
        console.error('Failed to update leg:', error);
        res.status(500).json({ error: 'Failed to update leg' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.leg.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Leg deleted successfully' });
    } catch (error) {
        console.error('Failed to delete leg:', error);
        res.status(500).json({ error: 'Failed to delete leg' });
    }
});

module.exports = router;