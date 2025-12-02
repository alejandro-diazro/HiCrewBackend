const cron = require('node-cron');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// IVAO Cron Job: Runs every minute
cron.schedule('* * * * *', async () => {
    try {
        // Fetch IVAO data
        const response = await axios.get('https://api.ivao.aero/v2/tracker/whazzup');
        const ivaoData = response.data;
        const ivaoPilots = ivaoData?.clients?.pilots || [];

        const ivaoFlights = await prisma.flight.findMany({
            where: {
                network: 'IVAO',
                status: 1,
            },
            select: {
                id: true,
                callsign: true,
                status: true,
                type: true,
                aircraft: true,
                startFlight: true,
                closeFlight: true,
                fleetId: true,
                arrivalIcao: true,
                pilotId: true,
            },
        });

        for (const flight of ivaoFlights) {
            const matchingPilot = ivaoPilots.find((pilot) =>
                pilot.callsign.includes(flight.callsign) && pilot.lastTrack
            );

            if (matchingPilot) {
                const now = new Date();
                let updateData = {};

                // For free-mode flights, update aircraft from network data
                if (flight.type === 5 && flight.aircraft === 'ZZZZ' && matchingPilot.flightPlan?.aircraftId) {
                    updateData.aircraft = matchingPilot.flightPlan.aircraftId;

                    await prisma.flight.update({
                        where: { id: flight.id },
                        data: updateData,
                    });
                }

                // Handle Departing state (start flight)
                if (matchingPilot.lastTrack.state === 'Departing' && flight.status === 1 && !flight.startFlight) {
                    updateData = {
                        startFlight: now,
                    };

                    await prisma.flight.update({
                        where: { id: flight.id },
                        data: updateData,
                    });
                }

                // Handle On Blocks state (end flight)
                if (matchingPilot.lastTrack.state === 'On Blocks' && flight.status === 1 && flight.startFlight && !flight.closeFlight) {
                    updateData = {
                        closeFlight: now,
                    };

                    await prisma.flight.update({
                        where: { id: flight.id },
                        data: updateData,
                    });

                    // If charter flight, update fleet state to Free (0) and location to arrivalIcao
                    if (flight.fleetId) {
                        await prisma.fleet.update({
                            where: { id: flight.fleetId },
                            data: {
                                state: 0,
                                locationIcao: flight.arrivalIcao,
                            },
                        });
                    }

                    // Update pilot location to arrivalIcao
                    await prisma.pilot.update({
                        where: { id: flight.pilotId },
                        data: { locationIcao: flight.arrivalIcao },
                    });
                }
            }
        }
    } catch (error) {
        console.error('IVAO cron job failed:', error.message);
    }
});

// VATSIM Cron Job: Runs every minute
cron.schedule('* * * * *', async () => {
    try {
        const response = await axios.get('https://data.vatsim.net/v3/vatsim-data.json');
        const vatsimData = response.data;
        const vatsimPilots = vatsimData?.pilots || [];

        const vatsimFlights = await prisma.flight.findMany({
            where: {
                network: 'VATSIM',
                status: 1,
            },
            select: {
                id: true,
                callsign: true,
                status: true,
                type: true,
                aircraft: true,
                startFlight: true,
                closeFlight: true,
                fleetId: true,
                arrivalIcao: true,
                pilotId: true,
            },
        });

        for (const flight of vatsimFlights) {
            const matchingPilot = vatsimPilots.find(
                (pilot) => pilot.callsign.includes(flight.callsign) && pilot.flight_plan
            );

            if (matchingPilot) {
                const now = new Date();
                let updateData = {};

                // For free-mode flights, update aircraft from network data
                if (flight.type === 5 && flight.aircraft === 'ZZZZ' && matchingPilot.flight_plan?.aircraft) {
                    updateData.aircraft = matchingPilot.flight_plan.aircraft;

                    await prisma.flight.update({
                        where: { id: flight.id },
                        data: updateData,
                    });
                }

                // Handle flight start (groundspeed >= 60)
                if (matchingPilot.groundspeed >= 60 && flight.status === 1 && !flight.startFlight) {
                    updateData = {
                        startFlight: now,
                    };

                    await prisma.flight.update({
                        where: { id: flight.id },
                        data: updateData,
                    });
                }

                // Handle flight end (groundspeed <= 60)
                if (matchingPilot.groundspeed <= 60 && flight.status === 1 && flight.startFlight && !flight.closeFlight) {
                    updateData = {
                        closeFlight: now,
                    };

                    await prisma.flight.update({
                        where: { id: flight.id },
                        data: updateData,
                    });

                    // If charter flight, update fleet state to Free (0) and location to arrivalIcao
                    if (flight.fleetId) {
                        await prisma.fleet.update({
                            where: { id: flight.fleetId },
                            data: {
                                state: 0, // Free
                                locationIcao: flight.arrivalIcao,
                            },
                        });
                    }

                    // Update pilot location to arrivalIcao
                    await prisma.pilot.update({
                        where: { id: flight.pilotId },
                        data: { locationIcao: flight.arrivalIcao },
                    });
                }
            }
        }
    } catch (error) {
        console.error('VATSIM cron job failed:', error.message);
    }
});

// Flight Cleanup Job: Runs every 12 hours at 00:00 and 12:00
// Deletes abandoned flights (no startFlight and no closeFlight)
cron.schedule('0 */12 * * *', async () => {
    try {
        console.log('Starting abandoned flights cleanup...');
        
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
            console.log(`Found ${abandonedFlights.length} abandoned flights to delete`);
            
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

            console.log(`Deleted ${deletedCount.count} abandoned flights and freed ${fleetIds.length} fleet units`);
        } else {
            console.log('No abandoned flights found');
        }
    } catch (error) {
        console.error('Abandoned flights cleanup failed:', error.message);
    }
});

// Flight Cleanup Job: Runs daily at 02:00
// Deletes unfinished flights (with startFlight but no closeFlight after 48 hours)
cron.schedule('0 2 * * *', async () => {
    try {
        console.log('Starting unfinished flights cleanup...');
        
        // Calculate 48 hours ago
        const fortyEightHoursAgo = new Date();
        fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
        
        // Find flights with startFlight but no closeFlight after 48 hours
        const unfinishedFlights = await prisma.flight.findMany({
            where: {
                startFlight: {
                    not: null,
                    lt: fortyEightHoursAgo // startFlight is older than 48 hours
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
            console.log(`Found ${unfinishedFlights.length} unfinished flights (>48h) to delete`);
            
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

            console.log(`Deleted ${deletedCount.count} unfinished flights and updated ${fleetUpdates.length} fleet units and ${pilotUpdates.length} pilot locations`);
        } else {
            console.log('No unfinished flights found');
        }
    } catch (error) {
        console.error('Unfinished flights cleanup failed:', error.message);
    }
});

// SimBrief Data Cleanup Job: Runs weekly on Sundays at 03:00
// Clears SimBrief data from completed flights older than 1 month
cron.schedule('0 3 * * 0', async () => {
    try {
        console.log('Starting SimBrief data cleanup...');
        
        // Calculate 1 month ago
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        // Find completed flights with SimBrief data older than 1 month
        const oldFlights = await prisma.flight.findMany({
            where: {
                startFlight: { not: null },
                closeFlight: { not: null },
                simbriefData: { not: null },
                closeFlight: {
                    lt: oneMonthAgo // Completed more than 1 month ago
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
            console.log(`Found ${oldFlights.length} completed flights with old SimBrief data to clean`);
            
            // Clear SimBrief data from these flights
            const flightIds = oldFlights.map(flight => flight.id);
            const updatedCount = await prisma.flight.updateMany({
                where: { id: { in: flightIds } },
                data: { simbriefData: null }
            });

            console.log(`Cleared SimBrief data from ${updatedCount.count} completed flights older than 1 month`);
            
            // Log some details about the flights cleaned
            const sampleFlights = oldFlights.slice(0, 5); // Show first 5 as sample
            console.log('Sample cleaned flights:', sampleFlights.map(f => ({
                callsign: f.callsign,
                route: `${f.departureIcao}-${f.arrivalIcao}`,
                completed: f.closeFlight.toISOString().split('T')[0],
                ageInDays: Math.floor((new Date() - new Date(f.closeFlight)) / (1000 * 60 * 60 * 24))
            })));
        } else {
            console.log('No old SimBrief data found to clean');
        }
    } catch (error) {
        console.error('SimBrief data cleanup failed:', error.message);
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down cron jobs...');
    await prisma.$disconnect();
    process.exit(0);
});