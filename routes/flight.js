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

    router.get('/stats', async (req, res) => {
        try {
            // Monthly Flights: Aggregate by year and month (MariaDB-compatible)
            const monthlyFlightsRaw = await prisma.$queryRaw`
            SELECT 
                DATE_FORMAT(createdAt, '%Y-%m') AS month,
                COUNT(*) AS count
            FROM Flight
            WHERE createdAt >= ${new Date(new Date().getFullYear(), 0, 1)}
            GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
            ORDER BY month
        `;
            const monthlyFlights = monthlyFlightsRaw.map(r => ({
                month: r.month,
                count: Number(r.count),
            }));

            // Annual Flights: Aggregate by year (MariaDB-compatible)
            const annualFlightsRaw = await prisma.$queryRaw`
            SELECT 
                YEAR(createdAt) AS year,
                COUNT(*) AS count
            FROM Flight
            GROUP BY YEAR(createdAt)
            ORDER BY year
        `;
            const annualFlights = annualFlightsRaw.map(r => ({
                year: Number(r.year),
                count: Number(r.count),
            }));

            // Number of Unique Pilots
            const pilotCount = await prisma.flight.aggregate({
                _count: { pilotId: true },
                where: { status: { in: [1, 2] } },
            }).then(result => result._count.pilotId);

            // Most Flown Aircraft Types
            const mostFlownAircraft = await prisma.flight.groupBy({
                by: ['aircraft'],
                _count: { id: true },
                where: { status: { in: [1, 2] } },
                orderBy: { _count: { id: 'desc' } },
                take: 5,
            }).then(results => results.map(r => ({
                aircraft: r.aircraft,
                count: r._count.id,
            })));

            // Most Flown Fleet Aircraft
            const mostFlownFleet = await prisma.flight.groupBy({
                by: ['fleetId'],
                _count: { id: true },
                where: { fleetId: { not: null }, status: { in: [1, 2] } },
                orderBy: { _count: { id: 'desc' } },
                take: 5,
            }).then(async results => {
                const fleetDetails = await prisma.fleet.findMany({
                    where: { id: { in: results.map(r => r.fleetId) } },
                    select: { id: true, reg: true, name: true },
                });
                return results.map(r => ({
                    fleetId: r.fleetId,
                    registration: fleetDetails.find(f => f.id === r.fleetId)?.reg || 'Unknown',
                    name: fleetDetails.find(f => f.id === r.fleetId)?.name || 'Unknown',
                    count: r._count.id,
                }));
            });

            // Flight Hours (Monthly)
            const monthlyHours = await prisma.flight.findMany({
                where: {
                    startFlight: { not: null },
                    closeFlight: { not: null },
                    createdAt: { gte: new Date(new Date().getFullYear(), 0, 1) },
                },
                select: { startFlight: true, closeFlight: true },
            }).then(results => {
                const hoursByMonth = {};
                results.forEach(flight => {
                    const month = `${flight.startFlight.getFullYear()}-${(flight.startFlight.getMonth() + 1).toString().padStart(2, '0')}`;
                    const hours = (flight.closeFlight - flight.startFlight) / (1000 * 60 * 60);
                    hoursByMonth[month] = (hoursByMonth[month] || 0) + hours;
                });
                return Object.entries(hoursByMonth).map(([month, hours]) => ({ month, hours: Math.round(hours * 10) / 10 }));
            });

            // Flight Hours (Annual)
            const annualHours = await prisma.flight.findMany({
                where: { startFlight: { not: null }, closeFlight: { not: null } },
                select: { startFlight: true, closeFlight: true },
            }).then(results => {
                const hoursByYear = {};
                results.forEach(flight => {
                    const year = flight.startFlight.getFullYear();
                    const hours = (flight.closeFlight - flight.startFlight) / (1000 * 60 * 60);
                    hoursByYear[year] = (hoursByYear[year] || 0) + hours;
                });
                return Object.entries(hoursByYear).map(([year, hours]) => ({ year, hours: Math.round(hours * 10) / 10 }));
            });

            // Most Active Pilot per Month
            const mostActivePilots = await prisma.flight.groupBy({
                by: ['pilotId', 'createdAt'],
                _count: { id: true },
                where: {
                    createdAt: { gte: new Date(new Date().getFullYear(), 0, 1) },
                    status: { in: [1, 2] },
                },
            }).then(async results => {
                const pilotsByMonth = {};
                results.forEach(r => {
                    const month = `${r.createdAt.getFullYear()}-${(r.createdAt.getMonth() + 1).toString().padStart(2, '0')}`;
                    if (!pilotsByMonth[month] || r._count.id > pilotsByMonth[month].count) {
                        pilotsByMonth[month] = { pilotId: r.pilotId, count: r._count.id };
                    }
                });
                const pilotDetails = await prisma.pilot.findMany({
                    where: { id: { in: Object.values(pilotsByMonth).map(p => p.pilotId) } },
                    select: { id: true, callsign: true },
                });
                return Object.entries(pilotsByMonth).map(([month, data]) => ({
                    month,
                    pilot: pilotDetails.find(p => p.id === data.pilotId)?.callsign || 'Unknown',
                    count: data.count,
                }));
            });

            // Most Frequent Departure Airports
            const mostFrequentDepartures = await prisma.flight.groupBy({
                by: ['departureIcao'],
                _count: { id: true },
                where: { status: { in: [1, 2] } },
                orderBy: { _count: { id: 'desc' } },
                take: 5,
            }).then(async results => {
                const airports = await prisma.airport.findMany({
                    where: { icao: { in: results.map(r => r.departureIcao) } },
                    select: { icao: true, name: true },
                });
                return results.map(r => ({
                    icao: r.departureIcao,
                    name: airports.find(a => a.icao === r.departureIcao)?.name || 'Unknown',
                    count: r._count.id,
                }));
            });

            // Most Frequent Arrival Airports
            const mostFrequentArrivals = await prisma.flight.groupBy({
                by: ['arrivalIcao'],
                _count: { id: true },
                where: { status: { in: [1, 2] } },
                orderBy: { _count: { id: 'desc' } },
                take: 5,
            }).then(async results => {
                const airports = await prisma.airport.findMany({
                    where: { icao: { in: results.map(r => r.arrivalIcao) } },
                    select: { icao: true, name: true },
                });
                return results.map(r => ({
                    icao: r.arrivalIcao,
                    name: airports.find(a => a.icao === r.arrivalIcao)?.name || 'Unknown',
                    count: r._count.id,
                }));
            });

            // Flights by Network and Type
            const flightsByNetworkAndType = await prisma.flight.groupBy({
                by: ['network', 'type'],
                _count: { id: true },
                where: { status: { in: [1, 2] } },
            }).then(results => {
                const typeMap = {
                    1: 'Manual',
                    2: 'Regular',
                    3: 'Charter',
                    4: 'ACARS',
                    5: 'Free Mode',
                };
                return results.map(r => ({
                    network: r.network || 'Offline',
                    type: typeMap[r.type] || 'Unknown',
                    count: r._count.id,
                }));
            });

            res.json({
                monthlyFlights,
                annualFlights,
                pilotCount,
                mostFlownAircraft,
                mostFlownFleet,
                monthlyHours,
                annualHours,
                mostActivePilots,
                mostFrequentDepartures,
                mostFrequentArrivals,
                flightsByNetworkAndType,
            });
        } catch (error) {
            console.error('Failed to fetch statistics:', error);
            res.status(500).json({ error: 'Failed to fetch statistics' });
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