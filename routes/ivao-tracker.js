const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const axios = require('axios');
const router = express.Router();
const prisma = new PrismaClient();

// IVAO API Configuration from environment variables
const IVAO_API_KEY = process.env.IVAO_API_KEY;
const IVAO_CLIENT_ID = process.env.IVAO_CLIENT_ID;
const IVAO_CLIENT_SECRET = process.env.IVAO_CLIENT_SECRET;
const IVAO_API_BASE = 'https://api.ivao.aero/v2';

// Check if IVAO configuration is available

// Get pilot's flights from IVAO
router.get('/available-flights', authenticate, async (req, res) => {
    // Check if IVAO API is configured
    if (!IVAO_API_KEY) {
        return res.status(503).json({ 
            error: 'IVAO integration not configured',
            message: 'Please configure IVAO API credentials in environment variables'
        });
    }

    try {
        const pilot = await prisma.pilot.findUnique({
            where: { id: req.user.id },
            select: { callsign: true, ivaoId: true }
        });

        if (!pilot) {
            return res.status(404).json({ error: 'Pilot not found' });
        }

        
        let allSessions = [];
        
        try {
            // Get sessions based on whether we have IVAO ID or not
            let sessionsUrl;
            let sessionsParams;
            
            if (pilot.ivaoId) {
                // If we have IVAO ID, use it with proper parameters
                sessionsUrl = `${IVAO_API_BASE}/tracker/sessions`;
                sessionsParams = {
                    userId: pilot.ivaoId,
                    connectionType: 'PILOT',
                    page: 1,
                    perPage: 50
                };
            } else {
                // Fallback to callsign search
                sessionsUrl = `${IVAO_API_BASE}/tracker/sessions`;
                sessionsParams = {
                    callsign: pilot.callsign,
                    page: 1,
                    perPage: 50
                };
            }
            
            const sessionsResponse = await axios.get(sessionsUrl, {
                headers: {
                    'X-API-Key': IVAO_API_KEY,
                    'Accept': 'application/json'
                },
                params: sessionsParams
            });
            
            // IVAO API returns paginated data
            const sessionData = sessionsResponse.data;
            allSessions = sessionData.items || [];
            
            
            // Limit to last 10 sessions for performance
            const recentSessions = allSessions.slice(0, 10);
            
            // Now fetch detailed flight plans for each session that has them
            const sessionsWithFlightPlans = [];
            
            for (const session of recentSessions) {
                try {
                    // Only fetch flight plans if the session indicates it has them
                    if (session.flightPlans && session.flightPlans.length > 0) {
                        
                        const flightPlansResponse = await axios.get(
                            `${IVAO_API_BASE}/tracker/sessions/${session.id}/flightPlans`,
                            {
                                headers: {
                                    'X-API-Key': IVAO_API_KEY,
                                    'Accept': 'application/json'
                                }
                            }
                        );
                        
                        // Replace the basic flight plans with detailed ones
                        session.detailedFlightPlans = flightPlansResponse.data.items || flightPlansResponse.data || [];
                        
                    }
                    sessionsWithFlightPlans.push(session);
                } catch (fpError) {
                    // Still include the session even if we can't get detailed flight plans
                    sessionsWithFlightPlans.push(session);
                }
            }
            
            allSessions = sessionsWithFlightPlans;
            
        } catch (apiError) {
            // IVAO API error - return empty array silently
            
            // Return empty array if API fails completely
            allSessions = [];
        }
        
        // Get already imported flights to mark them
        const existingFlights = await prisma.flight.findMany({
            where: {
                pilotId: req.user.id,
                network: 'IVAO'
            },
            select: {
                departureIcao: true,
                arrivalIcao: true,
                startFlight: true,
                comment: true,
                extraData: true
            }
        });

        // Process IVAO sessions and check which ones are already imported
        
        const processedFlights = allSessions
            .filter(session => {
                // IMPORTANT: Only show COMPLETED flights
                if (!session.completedAt) {
                    return false; // Skip flights that are still in progress
                }
                
                // Use detailed flight plans if available, otherwise use basic ones
                const flightPlans = session.detailedFlightPlans || session.flightPlans || [];
                
                // Session must have at least one flight plan and match pilot's callsign
                const hasFlightPlan = flightPlans.length > 0;
                const matchesPilotCallsign = (session.callsign || '') === pilot.callsign;
                
                if (!hasFlightPlan) {
                    return false;
                }
                
                if (!matchesPilotCallsign) {
                    return false;
                }
                
                // Check if any flight plan has valid data
                const hasValidFlightPlan = flightPlans.some(fp => fp.departureId && fp.arrivalId);
                
                if (!hasValidFlightPlan) {
                    return false;
                }
                
                // All checks passed - flight is completed, matches pilot's callsign and has valid data
                return true;
            })
            .map(session => {
                // Use detailed flight plans if available, otherwise use basic ones
                const flightPlans = session.detailedFlightPlans || session.flightPlans || [];
                // Get the most recent/relevant flight plan
                const flightPlan = flightPlans[flightPlans.length - 1] || {};
                
                // Check if this flight was already imported
                const isImported = existingFlights.some(existing => {
                    // Check by airports and approximate time
                    if (existing.departureIcao === flightPlan.departureId && 
                        existing.arrivalIcao === flightPlan.arrivalId) {
                        if (existing.startFlight && session.createdAt) {
                            const timeDiff = Math.abs(new Date(existing.startFlight).getTime() - new Date(session.createdAt).getTime());
                            return timeDiff < 3600000; // Within 1 hour
                        }
                        // Also check if the extraData contains this session ID
                        if (existing.extraData) {
                            try {
                                const extraData = typeof existing.extraData === 'string' 
                                    ? JSON.parse(existing.extraData) 
                                    : existing.extraData;
                                return extraData.ivaoSessionId === session.id;
                            } catch (e) {
                                // extraData is not valid JSON
                            }
                        }
                        return true; // Same route, assume imported
                    }
                    return false;
                });

                // Calculate duration from start to end time if not provided
                let duration = session.time || 0;
                if (!duration && session.createdAt && session.completedAt) {
                    const startTime = new Date(session.createdAt).getTime();
                    const endTime = new Date(session.completedAt).getTime();
                    duration = Math.round((endTime - startTime) / 1000); // Duration in seconds
                }
                
                // Use distance from flight plan or set to 0 (will be calculated later if airports exist)
                let distance = 0;
                if (flightPlan.distance && flightPlan.distance > 0) {
                    distance = Math.round(flightPlan.distance);
                }
                
                return {
                    id: session.id,
                    sessionId: session.id,
                    callsign: session.callsign,
                    aircraft: (flightPlan.aircraftId || 'ZZZZ').replace(/\/.*$/, ''), // Remove equipment codes
                    departureIcao: flightPlan.departureId,
                    arrivalIcao: flightPlan.arrivalId,
                    startTime: session.createdAt,
                    endTime: session.completedAt,
                    duration: duration,
                    distance: distance, // Will be 0 if not provided by IVAO
                    isImported: isImported,
                    remarks: flightPlan.remarks || '',
                    route: flightPlan.route || '',
                    // Include additional details if available
                    cruiseAltitude: flightPlan.cruiseAltitude,
                    alternateId: flightPlan.alternateId,
                    aircraftEquipment: flightPlan.aircraftEquipment,
                    transponderTypes: flightPlan.transponderTypes
                };
            });

        res.json({
            flights: processedFlights,
            totalAvailable: processedFlights.filter(f => !f.isImported).length,
            totalImported: processedFlights.filter(f => f.isImported).length
        });

    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to fetch IVAO flights',
            details: error.message 
        });
    }
});

// Import selected flights from IVAO
router.post('/import', authenticate, async (req, res) => {
    // Check if IVAO API is configured
    if (!IVAO_API_KEY) {
        return res.status(503).json({ 
            error: 'IVAO integration not configured',
            message: 'Please configure IVAO API credentials in environment variables'
        });
    }

    try {
        const { flights } = req.body;

        if (!flights || !Array.isArray(flights) || flights.length === 0) {
            return res.status(400).json({ error: 'No flights selected for import' });
        }

        const importedFlights = [];
        const errors = [];

        for (const ivaoFlight of flights) {
            try {
                // Ensure airports exist
                const departureIcao = ivaoFlight.departureIcao.toUpperCase();
                const arrivalIcao = ivaoFlight.arrivalIcao.toUpperCase();

                // Check/create departure airport
                let departureAirport = await prisma.airport.findUnique({
                    where: { icao: departureIcao }
                });

                if (!departureAirport) {
                    departureAirport = await prisma.airport.create({
                        data: {
                            icao: departureIcao,
                            name: `Airport ${departureIcao}`,
                            country: 'Unknown',
                            latitude: 0,
                            longitude: 0,
                            altitude: 0
                        }
                    });
                }

                // Check/create arrival airport
                let arrivalAirport = await prisma.airport.findUnique({
                    where: { icao: arrivalIcao }
                });

                if (!arrivalAirport) {
                    arrivalAirport = await prisma.airport.create({
                        data: {
                            icao: arrivalIcao,
                            name: `Airport ${arrivalIcao}`,
                            country: 'Unknown',
                            latitude: 0,
                            longitude: 0,
                            altitude: 0
                        }
                    });
                }

                // Calculate distance if not provided or is 0
                let distance = ivaoFlight.distance || 0;
                if ((!distance || distance === 0) && departureAirport && arrivalAirport) {
                    // Only calculate if both airports have valid coordinates (not 0,0)
                    if (departureAirport.latitude !== 0 && arrivalAirport.latitude !== 0 &&
                        departureAirport.longitude !== 0 && arrivalAirport.longitude !== 0) {
                        // Calculate great circle distance
                        const R = 3440.07; // Earth radius in nautical miles
                        const lat1 = departureAirport.latitude * Math.PI / 180;
                        const lat2 = arrivalAirport.latitude * Math.PI / 180;
                        const deltaLat = (arrivalAirport.latitude - departureAirport.latitude) * Math.PI / 180;
                        const deltaLon = (arrivalAirport.longitude - departureAirport.longitude) * Math.PI / 180;
                        
                        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                                  Math.cos(lat1) * Math.cos(lat2) *
                                  Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        distance = Math.round(R * c);
                    } else {
                        // If coordinates are invalid, use a default estimated distance
                        distance = 100; // Default 100 NM for flights without valid coordinates
                    }
                }
                
                // Create the flight record
                const flight = await prisma.flight.create({
                    data: {
                        pilotId: req.user.id,
                        status: 1, // Pending validation
                        type: 2, // 2=REGULAR (integer, not string)
                        callsign: ivaoFlight.callsign,
                        aircraft: ivaoFlight.aircraft,
                        departureIcao: departureIcao,
                        arrivalIcao: arrivalIcao,
                        startFlight: ivaoFlight.startTime ? new Date(ivaoFlight.startTime) : new Date(),
                        closeFlight: ivaoFlight.endTime ? new Date(ivaoFlight.endTime) : new Date(),
                        network: 'IVAO',
                        pirep: `https://tracker.ivao.aero/flight/${ivaoFlight.sessionId}`,
                        comment: `Importado de IVAO - ${departureIcao} → ${arrivalIcao}`,
                        extraData: {
                            source: 'IVAO Tracker Import',
                            ivaoSessionId: ivaoFlight.sessionId,
                            route: ivaoFlight.route,
                            remarks: ivaoFlight.remarks,
                            distance: distance,
                            duration: ivaoFlight.duration,
                            cruiseAltitude: ivaoFlight.cruiseAltitude,
                            alternateId: ivaoFlight.alternateId,
                            importedAt: new Date().toISOString()
                        }
                    },
                    select: {
                        id: true,
                        callsign: true,
                        departureIcao: true,
                        arrivalIcao: true,
                        startFlight: true,
                        closeFlight: true
                    }
                });

                importedFlights.push(flight);

            } catch (error) {
                errors.push({
                    flightId: ivaoFlight.id,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            imported: importedFlights.length,
            failed: errors.length,
            flights: importedFlights,
            errors: errors
        });

    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to import flights',
            details: error.message 
        });
    }
});

// Get IVAO tracking link for verification
router.get('/tracking-link/:flightId', authenticate, async (req, res) => {
    try {
        const flight = await prisma.flight.findUnique({
            where: { 
                id: parseInt(req.params.flightId),
                pilotId: req.user.id
            }
        });

        if (!flight) {
            return res.status(404).json({ error: 'Flight not found' });
        }

        // Parse the extraData to get the IVAO flight ID if it exists
        let ivaoSessionId = null;
        if (flight.extraData) {
            try {
                const extraData = typeof flight.extraData === 'string' 
                    ? JSON.parse(flight.extraData) 
                    : flight.extraData;
                ivaoSessionId = extraData.ivaoSessionId || extraData.ivaoFlightId;
            } catch (e) {
                // extraData is not valid JSON or doesn't have ivaoSessionId
            }
        }
        // Fallback to parsing the pirep URL if no extraData
        if (!ivaoSessionId && flight.pirep) {
            const match = flight.pirep.match(/\/flight\/(\d+)/);
            if (match) {
                ivaoSessionId = match[1];
            }
        }

        if (ivaoSessionId) {
            res.json({
                trackingUrl: `https://tracker.ivao.aero/flight/${ivaoSessionId}`,
                ivaoSessionId: ivaoSessionId
            });
        } else {
            res.status(404).json({ error: 'No IVAO tracking data found for this flight' });
        }

    } catch (error) {
        res.status(500).json({ error: 'Failed to get tracking link' });
    }
});

module.exports = router;