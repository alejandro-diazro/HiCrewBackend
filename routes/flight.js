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

    router.delete('/:id', authenticate, async (req, res) => {
        try {
            const flightId = parseInt(req.params.id);

            const flight = await prisma.flight.findUnique({
                where: { id: flightId },
                select: {
                    pilotId: true,
                    status: true,
                    startFlight: true,
                    closeFlight: true,
                    fleetId: true
                }
            });

            if (!flight || flight.pilotId !== req.user.id) {
                return res.status(404).json({ error: 'Flight not found or not authorized' });
            }

            if (flight.status !== 1) {
                return res.status(400).json({ error: 'Only pending flights can be deleted' });
            }

            if (!(flight.startFlight === null && flight.closeFlight === null) &&
                !(flight.startFlight !== null && flight.closeFlight === null)) {
                return res.status(400).json({ error: 'Flight does not meet deletion criteria' });
            }

            if (flight.fleetId) {
                await prisma.fleet.update({
                    where: { id: flight.fleetId },
                    data: { state: 0 }
                });
            }

            await prisma.flight.delete({
                where: { id: flightId }
            });

            res.status(204).send();
        } catch (error) {
            console.error('Failed to delete flight:', error);
            res.status(500).json({ error: 'Failed to delete flight' });
        }
    });

    router.get('/flight-active', authenticate, async (req, res) => {
        try {
            const flights = await prisma.flight.findMany({
                where: {
                    pilotId: req.user.id,
                    status: 1,
                    OR: [
                        {
                            startFlight: null,
                            closeFlight: null
                        },
                        {
                            startFlight: { not: null },
                            closeFlight: null
                        }
                    ]
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
            console.error('Failed to fetch active flights:', error);
            res.status(500).json({ error: 'Failed to fetch active flights' });
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
                const isCharter = type.toLowerCase() === 'charter';

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

                if (isCharter) {
                    if (!fleetId) {
                        return res.status(400).json({ error: 'Fleet ID is required for charter flights' });
                    }

                    const fleet = await prisma.fleet.findUnique({
                        where: { id: parseInt(fleetId) },
                        select: { state: true, locationIcao: true }
                    });

                    if (!fleet) {
                        return res.status(400).json({ error: 'Invalid fleet ID' });
                    }

                    if (fleet.state !== 0) {
                        return res.status(400).json({ error: 'Selected aircraft is not available' });
                    }

                    await prisma.fleet.update({
                        where: { id: parseInt(fleetId) },
                        data: { state: 1 }
                    });
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

                if (type.toLowerCase() === 'manual') {
                    await prisma.pilot.update({
                        where: { id: req.user.id },
                        data: { locationIcao: flight.arrivalIcao }
                    });
                }

                res.status(201).json(flight);
            } catch (error) {
                console.error(`Failed to create ${type} flight:`, error);
                res.status(500).json({ error: `Failed to create ${type} flight` });
            }
        });
    };

    ['manual', 'regular', 'charter', 'acars', 'free-mode'].forEach(type => createFlightEndpoint(type));

    module.exports = router;