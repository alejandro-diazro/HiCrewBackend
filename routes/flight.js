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

    router.get('/pilot/:pilotId', authenticate, async (req, res) => {
        const { pilotId } = req.params;

        if (!Number.isInteger(parseInt(pilotId))) {
            return res.status(400).json({ error: 'pilotId must be an integer' });
        }

        try {
            const flights = await prisma.flight.findMany({
                where: {
                    pilotId: parseInt(pilotId),
                    status: 2 // Only show accepted flights for public view
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
                    createdAt: true,
                    network: true,
                    departure: {
                        select: { icao: true, name: true }
                    },
                    arrival: {
                        select: { icao: true, name: true }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
            res.json(flights);
        } catch (error) {
            console.error('Failed to fetch pilot flights:', error);
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

            // Get flight details before updating
            const flightDetails = await prisma.flight.findUnique({
                where: { id: flightId },
                select: {
                    pilotId: true,
                    startFlight: true,
                    closeFlight: true,
                    status: true
                }
            });

            if (!flightDetails) {
                return res.status(404).json({ error: 'Flight not found' });
            }

            // Update flight status
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
                    comment: true,
                    tourEnrollmentId: true,
                    legId: true,
                    pilotId: true
                }
            });

            // If flight is being accepted (status 2) and wasn't already accepted, update pilot hours and rank
            if (status === 2 && flightDetails.status !== 2 && flightDetails.startFlight && flightDetails.closeFlight) {
                // Calculate flight duration in hours (decimal)
                const durationMs = new Date(flightDetails.closeFlight) - new Date(flightDetails.startFlight);
                const hoursToAdd = durationMs / (1000 * 60 * 60); // Convert to decimal hours

                // Get current pilot hours and rank
                const pilot = await prisma.pilot.findUnique({
                    where: { id: flightDetails.pilotId },
                    select: { hours: true, rankId: true }
                });

                // Calculate new total hours (keep as decimal)
                const newHours = (pilot.hours || 0) + hoursToAdd;

                // Get all ranks to determine appropriate rank
                const ranks = await prisma.rank.findMany({
                    orderBy: { hours: 'asc' }
                });

                // Determine the appropriate rank based on hours
                let appropriateRank = ranks[0]; // Default to lowest rank
                for (const rank of ranks) {
                    if (newHours >= rank.hours) {
                        appropriateRank = rank;
                    } else {
                        break;
                    }
                }

                // Prepare update data
                const updateData = { hours: newHours };
                
                // Update rank if necessary
                if (!pilot.rankId || pilot.rankId !== appropriateRank.id) {
                    updateData.rankId = appropriateRank.id;
                    console.log(`Pilot ${flightDetails.pilotId} promoted to ${appropriateRank.name}`);
                }

                // Update pilot hours and possibly rank
                await prisma.pilot.update({
                    where: { id: flightDetails.pilotId },
                    data: updateData
                });

                console.log(`Updated pilot ${flightDetails.pilotId} hours: ${newHours.toFixed(2)}h (added ${hoursToAdd.toFixed(2)}h), Rank: ${appropriateRank.name}`);

                // Check if this flight completes a tour leg
                if (flight.tourEnrollmentId && flight.legId) {
                    // Flight is associated with a tour, update the enrollment
                    const enrollment = await prisma.tourEnrollment.findUnique({
                        where: { id: flight.tourEnrollmentId },
                        include: {
                            tour: {
                                include: {
                                    legs: {
                                        orderBy: { order: 'asc' }
                                    }
                                }
                            }
                        }
                    });

                    if (enrollment) {
                        const completedLeg = enrollment.tour.legs.find(l => l.id === flight.legId);
                        
                        if (completedLeg && completedLeg.order === enrollment.currentLegOrder) {
                            // Create record in ReportTour
                            await prisma.reportTour.create({
                                data: {
                                    userId: flight.pilotId,
                                    legId: flight.legId,
                                    status: 1, // Accepted
                                    time_departure: flightDetails.startFlight,
                                    time_arrival: flightDetails.closeFlight
                                }
                            });

                            // Update tour enrollment progress
                            const totalLegs = enrollment.tour.legs.length;
                            const newCompletedLegs = enrollment.completedLegs + 1;
                            const isLastLeg = newCompletedLegs === totalLegs;

                            const updateData = {
                                completedLegs: newCompletedLegs,
                                currentLegOrder: isLastLeg ? enrollment.currentLegOrder : enrollment.currentLegOrder + 1
                            };

                            if (isLastLeg) {
                                updateData.isCompleted = true;
                                updateData.completedAt = new Date();
                            }

                            await prisma.tourEnrollment.update({
                                where: { id: enrollment.id },
                                data: updateData
                            });

                            // Award medal if tour is complete
                            if (isLastLeg && enrollment.tour.medalId) {
                                await prisma.pilotMedal.create({
                                    data: {
                                        pilotId: flightDetails.pilotId,
                                        medalId: enrollment.tour.medalId
                                    }
                                }).catch(err => {
                                    console.log('Medal already awarded or error:', err.message);
                                });
                                
                                console.log(`Tour ${enrollment.tour.name} completed!`);
                            }
                        }
                    }
                }
            }

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

            // Only check status - if it's pending (1), it can be deleted
            if (flight.status !== 1) {
                return res.status(400).json({ error: 'Only pending flights can be deleted' });
            }
            
            // Status 1 means pending, so it should be deletable regardless of other fields

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
                    status: 1, // Pending flight
                    closeFlight: null // NOT finished - still in progress or not started
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
                    simbriefData: true, // Include SimBrief data
                    extraData: true, // Include extra data (passengers, fuel, etc.)
                    createdAt: true,
                    network: true,
                    tourEnrollmentId: true,
                    legId: true,
                    departure: {
                        select: { icao: true, name: true }
                    },
                    arrival: {
                        select: { icao: true, name: true }
                    },
                    tourEnrollment: {
                        select: {
                            tour: {
                                select: { id: true, name: true }
                            }
                        }
                    },
                    leg: {
                        select: { id: true, order: true }
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
            const pilotCount = await prisma.pilot.count();

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

            // Best Pilot per Month (based on flight count)
            const bestPilotPerMonthRaw = await prisma.$queryRaw`
                SELECT 
                    DATE_FORMAT(createdAt, '%Y-%m') AS month,
                    pilotId,
                    COUNT(*) AS flightCount
                FROM Flight
                WHERE createdAt >= ${new Date(new Date().getFullYear(), 0, 1)}
                    AND status = 2
                GROUP BY DATE_FORMAT(createdAt, '%Y-%m'), pilotId
                ORDER BY month, flightCount DESC
            `;

            // Process to get best pilot per month
            const bestPilotPerMonth = [];
            const monthGroups = {};
            
            bestPilotPerMonthRaw.forEach(row => {
                const month = row.month;
                if (!monthGroups[month] || Number(row.flightCount) > monthGroups[month].flightCount) {
                    monthGroups[month] = {
                        month,
                        pilotId: Number(row.pilotId),
                        flightCount: Number(row.flightCount)
                    };
                }
            });

            // Get pilot details for best pilots
            const bestPilotIds = Object.values(monthGroups).map(g => g.pilotId);
            const bestPilotDetails = await prisma.pilot.findMany({
                where: { id: { in: bestPilotIds } },
                select: { id: true, callsign: true, firstName: true, lastName: true },
            });

            Object.values(monthGroups).forEach(group => {
                const pilot = bestPilotDetails.find(p => p.id === group.pilotId);
                bestPilotPerMonth.push({
                    month: group.month,
                    pilot: pilot ? {
                        id: pilot.id,
                        callsign: pilot.callsign,
                        name: `${pilot.firstName} ${pilot.lastName}`
                    } : null,
                    flightCount: group.flightCount
                });
            });

            // Sort by month
            bestPilotPerMonth.sort((a, b) => a.month.localeCompare(b.month));

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
                bestPilotPerMonth,
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
                const { callsign,aircraft, departureIcao, arrivalIcao, routeId, fleetId, startFlight, closeFlight, pirep, network, passengers, extraFuelMinutes  } = req.body;
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

                    finalAircraft= aircraft;
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

                // Verificar que los aeropuertos existen, si no, crearlos
                const departureAirport = await prisma.airport.findUnique({
                    where: { icao: departureIcao }
                });
                
                if (!departureAirport) {
                    // Crear aeropuerto de salida si no existe
                    await prisma.airport.create({
                        data: {
                            icao: departureIcao,
                            iata: '',
                            name: `Airport ${departureIcao}`,
                            country: 'Unknown',
                            latitude: 0,
                            longitude: 0,
                            altitude: 0
                        }
                    });
                }

                const arrivalAirport = await prisma.airport.findUnique({
                    where: { icao: arrivalIcao }
                });
                
                if (!arrivalAirport) {
                    // Crear aeropuerto de llegada si no existe
                    await prisma.airport.create({
                        data: {
                            icao: arrivalIcao,
                            iata: '',
                            name: `Airport ${arrivalIcao}`,
                            country: 'Unknown',
                            latitude: 0,
                            longitude: 0,
                            altitude: 0
                        }
                    });
                }

                // Si el piloto está de vacaciones, quitarlo automáticamente
                const pilot = await prisma.pilot.findUnique({
                    where: { id: req.user.id },
                    select: { onVacation: true }
                });
                
                if (pilot && pilot.onVacation) {
                    await prisma.pilot.update({
                        where: { id: req.user.id },
                        data: { onVacation: false }
                    });
                }

                // Detectar si el vuelo corresponde a una etapa de tour activa
                let tourEnrollmentId = null;
                let legId = null;

                const enrollment = await prisma.tourEnrollment.findFirst({
                    where: {
                        pilotId: req.user.id,
                        isCompleted: false
                    },
                    include: {
                        tour: {
                            include: {
                                legs: {
                                    where: {
                                        airportDepartureIcao: departureIcao,
                                        airportArrivalIcao: arrivalIcao
                                    },
                                    orderBy: { order: 'asc' }
                                }
                            }
                        }
                    }
                });

                if (enrollment && enrollment.tour.legs.length > 0) {
                    // Buscar si alguna etapa coincide con la etapa actual del piloto
                    const matchingLeg = enrollment.tour.legs.find(leg => 
                        leg.order === enrollment.currentLegOrder
                    );
                    
                    if (matchingLeg) {
                        tourEnrollmentId = enrollment.id;
                        legId = matchingLeg.id;
                    }
                }

                // Store optional free mode data in extraData field as JSON
                let extraData = null;
                if (isFreeMode && (passengers || extraFuelMinutes)) {
                    extraData = {
                        passengers: passengers || null,
                        extraFuelMinutes: extraFuelMinutes || null
                    };
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
                        comment: null,
                        extraData: extraData,
                        tourEnrollmentId: tourEnrollmentId,
                        legId: legId,
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
                        comment: true,
                        extraData: true,
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