    const express = require('express');
    const { PrismaClient } = require('@prisma/client');
    const authenticate = require('../middleware/auth');
    const checkPermissions = require('../middleware/permissions');
    const router = express.Router();
    const prisma = new PrismaClient();

    router.get('/my-flights', authenticate, async (req, res) => {
        try {
            const flights = await prisma.flight.findMany({
                where: {
                    pilotId: req.user.id
                },
                select: {
                    id: true,
                    status: true,
                    type: true,
                    callsign: true,
                    aircraft: true,
                    departureIcao: true,
                    arrivalIcao: true,
                    startFlight: true,
                    closeFlight: true,
                    pirep: true,
                    comment: true,
                    createdAt: true,
                    network: true,
                    departure: {
                        select: { icao: true, name: true }
                    },
                    arrival: {
                        select: { icao: true, name: true }
                    }
                }
            });
            res.json(flights);
        } catch (error) {
            console.error('Failed to fetch user flights:', error);
            res.status(500).json({ error: 'Failed to fetch flights' });
        }
    });

    router.get('/status/:number', authenticate, async (req, res) => {
        try {
            const status = parseInt(req.params.number);
            if (![1, 2, 3].includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const flights = await prisma.flight.findMany({
                where: {
                    pilotId: req.user.id,
                    status
                },
                select: {
                    id: true,
                    status: true,
                    type: true,
                    callsign: true,
                    aircraft: true,
                    departureIcao: true,
                    arrivalIcao: true,
                    startFlight: true,
                    closeFlight: true,
                    pirep: true,
                    comment: true,
                    createdAt: true,
                    departure: {
                        select: { icao: true, name: true }
                    },
                    arrival: {
                        select: { icao: true, name: true }
                    }
                }
            });
            res.json(flights);
        } catch (error) {
            console.error('Failed to fetch flights by status:', error);
            res.status(500).json({ error: 'Failed to fetch flights' });
        }
    });

    router.get('/pending', authenticate, checkPermissions(['VALIDATOR_MANAGER']), async (req, res) => {
        try {
            const flights = await prisma.flight.findMany({
                where: {
                    status: 1
                },
                include: {
                    pilot: {
                        select: {
                            id: true,
                            firstName: true,
                            callsign: true
                        }
                    },
                    departure: {
                        select: { icao: true, name: true }
                    },
                    arrival: {
                        select: { icao: true, name: true }
                    }
                }
            });
            res.json(flights);
        } catch (error) {
            console.error('Failed to fetch pending flights:', error);
            res.status(500).json({ error: 'Failed to fetch pending flights' });
        }
    });

    router.put('/:id/status', authenticate, checkPermissions(['VALIDATOR_MANAGER']), async (req, res) => {
        try {
            const flightId = parseInt(req.params.id);
            const { status, comment } = req.body;

            if (![2, 3].includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const flight = await prisma.flight.update({
                where: { id: flightId },
                data: {
                    status,
                    comment: comment || null,
                    updatedAt: new Date()
                },
                select: {
                    id: true,
                    status: true,
                    comment: true
                }
            });
            res.json(flight);
        } catch (error) {
            console.error('Failed to update flight status:', error);
            res.status(500).json({ error: 'Failed to update flight status' });
        }
    });

    const createFlightEndpoint = (type) => {
        router.post(`/report/${type.toLowerCase()}`, authenticate, async (req, res) => {
            try {
                const { callsign,aircraft, departureIcao, arrivalIcao, routeId, fleetId, startFlight, closeFlight, pirep, network  } = req.body;
                const typeMap = {
                    manual: 1,
                    regular: 2,
                    charter: 3,
                    acars: 4,
                    'free-mode': 5
                };

                const isFreeMode = type.toLowerCase() === 'free-mode';

                let finalCallsign = callsign;
                let finalAircraft = aircraft;
                if (isFreeMode) {
                    const pilot = await prisma.pilot.findUnique({
                        where: { id: req.user.id },
                        select: { callsign: true }
                    });
                    if (!pilot || !pilot.callsign) {
                        return res.status(400).json({ error: 'User callsign not found' });
                    }
                    finalCallsign = pilot.callsign;

                    finalAircraft= "ZZZZ";
                }


                const flight = await prisma.flight.create({
                    data: {
                        pilotId: req.user.id,
                        status: 1,
                        type: typeMap[type.toLowerCase()],
                        callsign: finalCallsign,
                        aircraft: finalAircraft,
                        departureIcao,
                        arrivalIcao,
                        routeId: routeId ? parseInt(routeId) : null,
                        fleetId: fleetId ? parseInt(fleetId) : null,
                        startFlight: startFlight ? new Date(startFlight) : null,
                        closeFlight: closeFlight ? new Date(closeFlight) : null,
                        pirep: pirep || null,
                        network: network || null,
                    },
                    select: {
                        id: true,
                        status: true,
                        type: true,
                        aircraft: true,
                        callsign: true,
                        departureIcao: true,
                        arrivalIcao: true,
                        startFlight: true,
                        closeFlight: true,
                        network: true,
                    }
                });
                res.status(201).json(flight);
            } catch (error) {
                console.error(`Failed to create ${type} flight:`, error);
                res.status(500).json({ error: `Failed to create ${type} flight` });
            }
        });
    };

    ['manual', 'regular', 'charter', 'acars', 'free-mode'].forEach(type => createFlightEndpoint(type));

    module.exports = router;