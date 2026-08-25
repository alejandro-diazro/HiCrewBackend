const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');

const router = express.Router();
const prisma = new PrismaClient();

// Manual cleanup of abandoned flights (admin only)
router.post('/abandoned-flights', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    try {
        console.log('Manual abandoned flights cleanup initiated by admin');
        
        // Find flights without startFlight and closeFlight (abandoned flights)
        const abandonedFlights = await prisma.flight.findMany({
            where: {
                startFlight: null,
                closeFlight: null,
                status: 1 // Only pending flights
            },
            select: {
                id: true,
                callsign: true,
                departureIcao: true,
                arrivalIcao: true,
                createdAt: true,
                fleetId: true,
                pilotId: true
            }
        });

        if (abandonedFlights.length > 0) {
            // Release fleet resources for charter flights
            const fleetIds = abandonedFlights
                .filter(flight => flight.fleetId)
                .map(flight => flight.fleetId);
            
            if (fleetIds.length > 0) {
                await prisma.fleet.updateMany({
                    where: { id: { in: fleetIds } },
                    data: { state: 0 } // Set to Free
                });
            }

            // Delete the abandoned flights
            const flightIds = abandonedFlights.map(flight => flight.id);
            const deletedCount = await prisma.flight.deleteMany({
                where: { id: { in: flightIds } }
            });

            res.json({
                success: true,
                message: `Deleted ${deletedCount.count} abandoned flights and freed ${fleetIds.length} fleet units`,
                deletedFlights: deletedCount.count,
                freedFleets: fleetIds.length,
                flights: abandonedFlights.map(f => ({ 
                    id: f.id, 
                    callsign: f.callsign, 
                    route: `${f.departureIcao}-${f.arrivalIcao}`,
                    createdAt: f.createdAt
                }))
            });
        } else {
            res.json({
                success: true,
                message: 'No abandoned flights found',
                deletedFlights: 0,
                freedFleets: 0,
                flights: []
            });
        }
    } catch (error) {
        console.error('Manual abandoned flights cleanup failed:', error);
        res.status(500).json({ 
            success: false,
            error: 'Cleanup failed', 
            message: error.message 
        });
    }
});

// Manual cleanup of unfinished flights (admin only)
router.post('/unfinished-flights', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    try {
        const { hoursThreshold = 48 } = req.body; // Allow custom threshold, default 48h
        
        console.log(`Manual unfinished flights cleanup initiated by admin (${hoursThreshold}h threshold)`);
        
        // Calculate threshold hours ago
        const thresholdTime = new Date();
        thresholdTime.setHours(thresholdTime.getHours() - hoursThreshold);
        
        // Find flights with startFlight but no closeFlight after threshold
        const unfinishedFlights = await prisma.flight.findMany({
            where: {
                startFlight: {
                    not: null,
                    lt: thresholdTime
                },
                closeFlight: null,
                status: 1 // Only pending flights
            },
            select: {
                id: true,
                callsign: true,
                departureIcao: true,
                arrivalIcao: true,
                startFlight: true,
                fleetId: true,
                pilotId: true
            }
        });

        if (unfinishedFlights.length > 0) {
            // Release fleet resources and update pilot locations for charter flights
            const fleetUpdates = [];
            const pilotUpdates = [];
            
            for (const flight of unfinishedFlights) {
                if (flight.fleetId) {
                    fleetUpdates.push(
                        prisma.fleet.update({
                            where: { id: flight.fleetId },
                            data: { 
                                state: 0, // Set to Free
                                locationIcao: flight.arrivalIcao // Move to intended destination
                            }
                        })
                    );
                }
                
                // Update pilot location to intended destination
                pilotUpdates.push(
                    prisma.pilot.update({
                        where: { id: flight.pilotId },
                        data: { locationIcao: flight.arrivalIcao }
                    })
                );
            }

            // Execute fleet and pilot updates
            await Promise.all([...fleetUpdates, ...pilotUpdates]);

            // Delete the unfinished flights
            const flightIds = unfinishedFlights.map(flight => flight.id);
            const deletedCount = await prisma.flight.deleteMany({
                where: { id: { in: flightIds } }
            });

            res.json({
                success: true,
                message: `Deleted ${deletedCount.count} unfinished flights (>${hoursThreshold}h) and updated ${fleetUpdates.length} fleet units and ${pilotUpdates.length} pilot locations`,
                deletedFlights: deletedCount.count,
                updatedFleets: fleetUpdates.length,
                updatedPilots: pilotUpdates.length,
                hoursThreshold: hoursThreshold,
                flights: unfinishedFlights.map(f => ({ 
                    id: f.id, 
                    callsign: f.callsign, 
                    route: `${f.departureIcao}-${f.arrivalIcao}`,
                    startFlight: f.startFlight,
                    hoursActive: Math.round((new Date() - new Date(f.startFlight)) / (1000 * 60 * 60))
                }))
            });
        } else {
            res.json({
                success: true,
                message: `No unfinished flights found (>${hoursThreshold}h threshold)`,
                deletedFlights: 0,
                updatedFleets: 0,
                updatedPilots: 0,
                hoursThreshold: hoursThreshold,
                flights: []
            });
        }
    } catch (error) {
        console.error('Manual unfinished flights cleanup failed:', error);
        res.status(500).json({ 
            success: false,
            error: 'Cleanup failed', 
            message: error.message 
        });
    }
});

// Manual cleanup of old SimBrief data (admin only)
router.post('/simbrief-data', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    try {
        const { monthsThreshold = 1 } = req.body; // Allow custom threshold, default 1 month
        
        console.log(`Manual SimBrief data cleanup initiated by admin (${monthsThreshold} month(s) threshold)`);
        
        // Calculate threshold months ago
        const thresholdTime = new Date();
        thresholdTime.setMonth(thresholdTime.getMonth() - monthsThreshold);
        
        // Find completed flights with SimBrief data older than threshold
        const oldFlights = await prisma.flight.findMany({
            where: {
                startFlight: { not: null },
                closeFlight: { not: null },
                simbriefData: { not: null },
                closeFlight: {
                    lt: thresholdTime
                }
            },
            select: {
                id: true,
                callsign: true,
                departureIcao: true,
                arrivalIcao: true,
                closeFlight: true
            }
        });

        if (oldFlights.length > 0) {
            // Clear SimBrief data from these flights
            const flightIds = oldFlights.map(flight => flight.id);
            const updatedCount = await prisma.flight.updateMany({
                where: { id: { in: flightIds } },
                data: { simbriefData: null }
            });

            res.json({
                success: true,
                message: `Cleared SimBrief data from ${updatedCount.count} completed flights older than ${monthsThreshold} month(s)`,
                clearedFlights: updatedCount.count,
                monthsThreshold: monthsThreshold,
                flights: oldFlights.map(f => ({ 
                    id: f.id, 
                    callsign: f.callsign, 
                    route: `${f.departureIcao}-${f.arrivalIcao}`,
                    completed: f.closeFlight,
                    ageInDays: Math.floor((new Date() - new Date(f.closeFlight)) / (1000 * 60 * 60 * 24))
                }))
            });
        } else {
            res.json({
                success: true,
                message: `No SimBrief data found to clean (>${monthsThreshold} month(s) threshold)`,
                clearedFlights: 0,
                monthsThreshold: monthsThreshold,
                flights: []
            });
        }
    } catch (error) {
        console.error('Manual SimBrief data cleanup failed:', error);
        res.status(500).json({ 
            success: false,
            error: 'SimBrief cleanup failed', 
            message: error.message 
        });
    }
});

// Get cleanup statistics (admin only)
router.get('/stats', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    try {
        // Count abandoned flights
        const abandonedCount = await prisma.flight.count({
            where: {
                startFlight: null,
                closeFlight: null,
                status: 1
            }
        });

        // Count unfinished flights (>48h)
        const fortyEightHoursAgo = new Date();
        fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
        
        const unfinishedCount = await prisma.flight.count({
            where: {
                startFlight: {
                    not: null,
                    lt: fortyEightHoursAgo
                },
                closeFlight: null,
                status: 1
            }
        });

        // Count old SimBrief data (>1 month)
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        const oldSimbriefCount = await prisma.flight.count({
            where: {
                startFlight: { not: null },
                closeFlight: { not: null },
                simbriefData: { not: null },
                closeFlight: {
                    lt: oneMonthAgo
                }
            }
        });

        // Count total active flights
        const activeFlights = await prisma.flight.count({
            where: { status: 1 }
        });

        // Count flights with occupied fleets
        const occupiedFleets = await prisma.flight.count({
            where: {
                status: 1,
                fleetId: { not: null }
            }
        });

        // Count total flights with SimBrief data
        const flightsWithSimbrief = await prisma.flight.count({
            where: {
                simbriefData: { not: null }
            }
        });

        res.json({
            success: true,
            stats: {
                abandonedFlights: abandonedCount,
                unfinishedFlights: unfinishedCount,
                oldSimbriefData: oldSimbriefCount,
                totalActiveFlights: activeFlights,
                occupiedFleets: occupiedFleets,
                flightsWithSimbrief: flightsWithSimbrief,
                cleanupRecommended: abandonedCount > 0 || unfinishedCount > 0 || oldSimbriefCount > 0
            }
        });
    } catch (error) {
        console.error('Failed to get cleanup stats:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to get stats', 
            message: error.message 
        });
    }
});

// Test endpoint to verify cron functionality (admin only)
router.get('/test-cron', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    try {
        const now = new Date();
        res.json({
            success: true,
            message: 'Cleanup service is running',
            timestamp: now.toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            cronSchedules: {
                abandonedFlights: 'Every 12 hours at 00:00 and 12:00 (0 */12 * * *)',
                unfinishedFlights: 'Daily at 02:00 (0 2 * * *)',
                simbriefDataCleanup: 'Weekly on Sundays at 03:00 (0 3 * * 0)',
                nextAbandonedCleanup: getNextCronTime('0 */12 * * *'),
                nextUnfinishedCleanup: getNextCronTime('0 2 * * *'),
                nextSimbriefCleanup: getNextCronTime('0 3 * * 0')
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Test failed', 
            message: error.message 
        });
    }
});

// Helper function to calculate next cron execution time
function getNextCronTime(cronExpression) {
    // This is a simplified calculation for display purposes
    const now = new Date();
    const hours = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    
    if (cronExpression === '0 */12 * * *') {
        // Every 12 hours at 00:00 and 12:00
        const nextHour = hours < 12 ? 12 : 24;
        const next = new Date(now);
        next.setHours(nextHour % 24, 0, 0, 0);
        if (nextHour === 24) next.setDate(next.getDate() + 1);
        return next.toISOString();
    } else if (cronExpression === '0 2 * * *') {
        // Daily at 02:00
        const next = new Date(now);
        next.setHours(2, 0, 0, 0);
        if (hours >= 2) next.setDate(next.getDate() + 1);
        return next.toISOString();
    } else if (cronExpression === '0 3 * * 0') {
        // Weekly on Sundays at 03:00
        const next = new Date(now);
        next.setHours(3, 0, 0, 0);
        
        // Calculate days until next Sunday
        let daysUntilSunday = (7 - dayOfWeek) % 7;
        if (daysUntilSunday === 0 && (hours >= 3 || dayOfWeek !== 0)) {
            daysUntilSunday = 7; // Next Sunday
        }
        
        next.setDate(next.getDate() + daysUntilSunday);
        return next.toISOString();
    }
    return 'Unknown';
}

module.exports = router;