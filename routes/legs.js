const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

// Get legs by tour ID
router.get('/tour/:tourId', async (req, res) => {
    const { tourId } = req.params;
    
    try {
        const legs = await prisma.leg.findMany({
            where: { tourId: parseInt(tourId) },
            select: {
                id: true,
                tourId: true,
                order: true,
                distance: true,
                estimatedTime: true,
                airportDepartureIcao: true,
                airportDeparture: {
                    select: {
                        icao: true,
                        iata: true,
                        name: true,
                        country: true,
                        latitude: true,
                        longitude: true,
                    },
                },
                airportArrivalIcao: true,
                airportArrival: {
                    select: {
                        icao: true,
                        iata: true,
                        name: true,
                        country: true,
                        latitude: true,
                        longitude: true,
                    },
                },
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                order: 'asc'
            }
        });
        res.json(legs);
    } catch (error) {
        console.error('Failed to fetch legs:', error);
        res.status(500).json({ error: 'Failed to fetch legs' });
    }
});

// Get all legs (admin)
router.get('/', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    try {
        const legs = await prisma.leg.findMany({
            include: {
                tour: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                airportDeparture: true,
                airportArrival: true
            },
            orderBy: [
                { tourId: 'asc' },
                { order: 'asc' }
            ]
        });
        res.json(legs);
    } catch (error) {
        console.error('Failed to fetch legs:', error);
        res.status(500).json({ error: 'Failed to fetch legs' });
    }
});

// Create a new leg
router.post('/', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    const { 
        tourId, 
        order,
        airportDepartureIcao, 
        airportArrivalIcao,
        distance,
        estimatedTime,
        description 
    } = req.body;

    if (!tourId || order === undefined || !airportDepartureIcao || !airportArrivalIcao) {
        return res.status(400).json({ error: 'tourId, order, airportDepartureIcao, and airportArrivalIcao are required' });
    }
    if (airportDepartureIcao.length !== 4 || airportArrivalIcao.length !== 4) {
        return res.status(400).json({ error: 'Airport ICAO codes must be exactly 4 characters' });
    }
    if (airportDepartureIcao === airportArrivalIcao) {
        return res.status(400).json({ error: 'Departure and arrival airports cannot be the same' });
    }

    try {
        // Check if airports exist
        const [depAirport, arrAirport] = await Promise.all([
            prisma.airport.findUnique({ where: { icao: airportDepartureIcao } }),
            prisma.airport.findUnique({ where: { icao: airportArrivalIcao } })
        ]);

        if (!depAirport) {
            return res.status(400).json({ error: `Departure airport ${airportDepartureIcao} not found` });
        }
        if (!arrAirport) {
            return res.status(400).json({ error: `Arrival airport ${airportArrivalIcao} not found` });
        }

        // Calculate distance if not provided
        let calculatedDistance = distance;
        if (!distance && depAirport.latitude && depAirport.longitude && arrAirport.latitude && arrAirport.longitude) {
            const R = 3440.07; // Earth radius in nautical miles
            const lat1 = depAirport.latitude * Math.PI / 180;
            const lat2 = arrAirport.latitude * Math.PI / 180;
            const deltaLat = (arrAirport.latitude - depAirport.latitude) * Math.PI / 180;
            const deltaLon = (arrAirport.longitude - depAirport.longitude) * Math.PI / 180;

            const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                    Math.cos(lat1) * Math.cos(lat2) *
                    Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            calculatedDistance = Math.round(R * c);
        }

        const leg = await prisma.leg.create({
            data: {
                tourId,
                order,
                airportDepartureIcao,
                airportArrivalIcao,
                distance: calculatedDistance,
                estimatedTime,
                description
            },
            include: {
                airportDeparture: true,
                airportArrival: true
            }
        });
        res.status(201).json({ message: 'Leg created successfully', leg });
    } catch (error) {
        console.error('Failed to create leg:', error);
        if (error.code === 'P2002') {
            res.status(400).json({ error: 'A leg with this order already exists for this tour' });
        } else {
            res.status(500).json({ error: 'Failed to create leg' });
        }
    }
});

// Create multiple legs at once
router.post('/bulk', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    const { tourId, legs } = req.body;

    if (!tourId || !legs || !Array.isArray(legs) || legs.length === 0) {
        return res.status(400).json({ error: 'tourId and legs array are required' });
    }

    try {
        const createdLegs = [];
        
        for (let i = 0; i < legs.length; i++) {
            const leg = legs[i];
            const order = i + 1;
            
            // Check if airports exist
            const [depAirport, arrAirport] = await Promise.all([
                prisma.airport.findUnique({ where: { icao: leg.departureIcao } }),
                prisma.airport.findUnique({ where: { icao: leg.arrivalIcao } })
            ]);

            if (!depAirport || !arrAirport) {
                continue; // Skip if airports don't exist
            }

            // Calculate distance
            let distance = leg.distance;
            if (!distance && depAirport.latitude && depAirport.longitude && arrAirport.latitude && arrAirport.longitude) {
                const R = 3440.07;
                const lat1 = depAirport.latitude * Math.PI / 180;
                const lat2 = arrAirport.latitude * Math.PI / 180;
                const deltaLat = (arrAirport.latitude - depAirport.latitude) * Math.PI / 180;
                const deltaLon = (arrAirport.longitude - depAirport.longitude) * Math.PI / 180;

                const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                        Math.cos(lat1) * Math.cos(lat2) *
                        Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                distance = Math.round(R * c);
            }

            const createdLeg = await prisma.leg.create({
                data: {
                    tourId,
                    order,
                    airportDepartureIcao: leg.departureIcao,
                    airportArrivalIcao: leg.arrivalIcao,
                    distance,
                    estimatedTime: leg.estimatedTime
                }
            });
            
            createdLegs.push(createdLeg);
        }

        res.status(201).json({ 
            message: `${createdLegs.length} legs created successfully`, 
            legs: createdLegs 
        });
    } catch (error) {
        console.error('Failed to create legs:', error);
        res.status(500).json({ error: 'Failed to create legs' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { 
        tourId, 
        order,
        airportDepartureIcao, 
        airportArrivalIcao,
        distance,
        estimatedTime,
        description
    } = req.body;

    if (!tourId && order === undefined && !airportDepartureIcao && !airportArrivalIcao && distance === undefined && estimatedTime === undefined && description === undefined) {
        return res.status(400).json({ error: 'At least one field is required to update' });
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
                order: order !== undefined ? order : undefined,
                airportDepartureIcao: airportDepartureIcao || undefined,
                airportArrivalIcao: airportArrivalIcao || undefined,
                distance: distance !== undefined ? distance : undefined,
                estimatedTime: estimatedTime !== undefined ? estimatedTime : undefined,
                description: description !== undefined ? description : undefined
            },
            include: {
                airportDeparture: true,
                airportArrival: true
            }
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