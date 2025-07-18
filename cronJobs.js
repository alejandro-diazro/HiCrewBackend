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

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down cron jobs...');
    await prisma.$disconnect();
    process.exit(0);
});