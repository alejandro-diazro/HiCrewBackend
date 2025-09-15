const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/monthly-stats/:year/:month', authenticate, checkPermissions(['ADMIN', 'USER_MANAGER']), async (req, res) => {
    const { year, month } = req.params;
    
    try {
        const targetYear = parseInt(year);
        const targetMonth = parseInt(month);

        // Calculate start and end dates for the month
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
        
        // Get flights for the month (accepted flights only)
        const flights = await prisma.flight.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate
                },
                status: 2 // Accepted flights only
            },
            include: {
                pilot: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        callsign: true
                    }
                }
            }
        });
        
        // Calculate statistics
        const totalFlights = flights.length;
        const uniquePilots = new Set(flights.map(f => f.pilot.id)).size;
        
        // Calculate total flight time (assuming duration is in minutes)
        // You might need to adjust this based on your actual flight duration storage
        const totalHours = flights.reduce((total, flight) => {
            // If you store duration in the flight table, use it
            // Otherwise calculate from startFlight and closeFlight
            if (flight.startFlight && flight.closeFlight) {
                const duration = (new Date(flight.closeFlight) - new Date(flight.startFlight)) / (1000 * 60); // minutes
                return total + duration;
            }
            return total;
        }, 0) / 60; // Convert to hours
        
        // Group flights by pilot
        const pilotStats = {};
        flights.forEach(flight => {
            const pilotId = flight.pilot.id;
            if (!pilotStats[pilotId]) {
                pilotStats[pilotId] = {
                    pilot: flight.pilot,
                    flights: 0,
                    hours: 0
                };
            }
            pilotStats[pilotId].flights++;
            
            // Calculate flight duration
            if (flight.startFlight && flight.closeFlight) {
                const duration = (new Date(flight.closeFlight) - new Date(flight.startFlight)) / (1000 * 60 * 60); // hours
                pilotStats[pilotId].hours += duration;
            }
        });
        
        // Convert to array and sort by flights descending
        const pilotStatsArray = Object.values(pilotStats).sort((a, b) => b.flights - a.flights);
        
        res.json({
            month: targetMonth,
            year: targetYear,
            totalFlights,
            uniquePilots,
            totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimals
            pilotStats: pilotStatsArray
        });
        
    } catch (error) {
        console.error('Failed to fetch monthly stats:', error);
        res.status(500).json({ error: 'Failed to fetch monthly statistics' });
    }
});

// Get pilots who flew last month but not this month
router.get('/inactive-current-month/:year/:month', authenticate, checkPermissions(['ADMIN', 'USER_MANAGER']), async (req, res) => {
    const { year, month } = req.params;
    
    try {
        const targetYear = parseInt(year);
        const targetMonth = parseInt(month);
        
        // Current month dates
        const currentStart = new Date(targetYear, targetMonth - 1, 1);
        const currentEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
        
        // Previous month dates
        const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
        const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
        const prevStart = new Date(prevYear, prevMonth - 1, 1);
        const prevEnd = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);
        
        // Get pilots who flew last month
        const lastMonthFlights = await prisma.flight.findMany({
            where: {
                createdAt: {
                    gte: prevStart,
                    lte: prevEnd
                },
                status: 2
            },
            select: {
                pilotId: true
            },
            distinct: ['pilotId']
        });
        
        const lastMonthPilotIds = lastMonthFlights.map(f => f.pilotId);
        
        // Get pilots who flew this month
        const thisMonthFlights = await prisma.flight.findMany({
            where: {
                createdAt: {
                    gte: currentStart,
                    lte: currentEnd
                },
                status: 2
            },
            select: {
                pilotId: true
            },
            distinct: ['pilotId']
        });
        
        const thisMonthPilotIds = thisMonthFlights.map(f => f.pilotId);
        
        // Find pilots who flew last month but not this month
        const inactivePilotIds = lastMonthPilotIds.filter(id => !thisMonthPilotIds.includes(id));
        
        // Get pilot details
        const inactivePilots = await prisma.pilot.findMany({
            where: {
                id: {
                    in: inactivePilotIds
                },
                onVacation: false // Exclude pilots on vacation
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                callsign: true,
                flights: {
                    where: {
                        status: 2,
                        createdAt: {
                            gte: prevStart,
                            lte: prevEnd
                        }
                    },
                    select: {
                        createdAt: true
                    }
                }
            }
        });
        
        // Calculate stats for each inactive pilot
        const inactivePilotsWithStats = inactivePilots.map(pilot => ({
            ...pilot,
            lastMonthFlights: pilot.flights.length,
            flights: undefined // Remove the flights array from response
        }));
        
        res.json({
            previousMonth: prevMonth,
            previousYear: prevYear,
            currentMonth: targetMonth,
            currentYear: targetYear,
            count: inactivePilotsWithStats.length,
            pilots: inactivePilotsWithStats
        });
        
    } catch (error) {
        console.error('Failed to fetch inactive pilots:', error);
        res.status(500).json({ error: 'Failed to fetch inactive pilots' });
    }
});

// Get pilots who haven't flown in 3+ months (excluding those on vacation)
router.get('/long-inactive', authenticate, checkPermissions(['ADMIN', 'USER_MANAGER']), async (req, res) => {
    try {
        // Calculate date 3 months ago
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        // Get all pilots with their last flight date
        const pilots = await prisma.pilot.findMany({
            where: {
                onVacation: false // Exclude pilots on vacation
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                callsign: true,
                flights: {
                    where: {
                        status: 2 // Accepted flights only
                    },
                    select: {
                        createdAt: true
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1
                }
            }
        });
        
        // Filter pilots who haven't flown in 3+ months
        const longInactivePilots = pilots.filter(pilot => {
            if (pilot.flights.length === 0) {
                // No flights ever - consider inactive
                return true;
            }
            
            const lastFlightDate = new Date(pilot.flights[0].createdAt);
            return lastFlightDate < threeMonthsAgo;
        });
        
        // Add last flight date to response
        const longInactivePilotsWithDate = longInactivePilots.map(pilot => ({
            id: pilot.id,
            firstName: pilot.firstName,
            lastName: pilot.lastName,
            callsign: pilot.callsign,
            lastFlightDate: pilot.flights.length > 0 ? pilot.flights[0].createdAt : null,
            daysSinceLastFlight: pilot.flights.length > 0 
                ? Math.floor((new Date() - new Date(pilot.flights[0].createdAt)) / (1000 * 60 * 60 * 24))
                : null
        }));
        
        // Sort by days since last flight (descending)
        longInactivePilotsWithDate.sort((a, b) => {
            if (a.daysSinceLastFlight === null) return 1;
            if (b.daysSinceLastFlight === null) return -1;
            return b.daysSinceLastFlight - a.daysSinceLastFlight;
        });
        
        res.json({
            thresholdMonths: 3,
            count: longInactivePilotsWithDate.length,
            pilots: longInactivePilotsWithDate
        });
        
    } catch (error) {
        console.error('Failed to fetch long inactive pilots:', error);
        res.status(500).json({ error: 'Failed to fetch long inactive pilots' });
    }
});

module.exports = router;