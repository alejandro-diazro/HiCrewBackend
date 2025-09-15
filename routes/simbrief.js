const express = require('express');
const axios = require('axios');
const authenticate = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const airlineConfig = require('../config/airline.config');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/flightplan', authenticate, async (req, res) => {
    try {
        const pilot = await prisma.pilot.findUnique({
            where: { id: req.user.id },
            select: { simbriefAccount: true }
        });

        if (!pilot.simbriefAccount) {
            return res.status(400).json({ 
                error: 'SimBrief account not configured',
                message: 'Please configure your SimBrief account in your profile first'
            });
        }

        const simbriefResponse = await axios.get(
            `https://www.simbrief.com/api/xml.fetcher.php?username=${pilot.simbriefAccount}&json=1`
        );

        if (!simbriefResponse.data || !simbriefResponse.data.fetch) {
            return res.status(404).json({ 
                error: 'No flight plan found',
                message: 'No active SimBrief flight plan found for your account'
            });
        }

        const ofp = simbriefResponse.data.fetch;

        const flightPlan = {
            // Flight identification
            airline: ofp.airline || ofp.general?.icao_airline,
            flightNumber: ofp.flightnumber || ofp.general?.flight_number,
            callsign: ofp.callsign || ofp.atc?.callsign || `${ofp.airline || ''}${ofp.flightnumber || ''}`,
            
            // Aircraft
            aircraft: ofp.aircraftcode || ofp.aircraft?.icao_code,
            aircraftReg: ofp.reg || ofp.aircraft?.reg,
            
            // Airports
            origin: ofp.orig || ofp.depicao || ofp.origin?.icao_code || ofp.origin,
            destination: ofp.dest || ofp.arricao || ofp.destination?.icao_code || ofp.destination,
            alternate: ofp.altn || ofp.alternate?.icao_code || ofp.alternate,
            
            // Times (Unix timestamps)
            schedDeparture: ofp.times.sched_dep,
            schedArrival: ofp.times.sched_arr,
            blockTime: ofp.times.est_block,
            
            // Flight levels and route
            cruiseAltitude: ofp.altitude,
            route: ofp.route,
            distance: ofp.distance,
            
            // Weights
            paxCount: ofp.weights.pax_count,
            cargoWeight: ofp.weights.cargo,
            payloadWeight: ofp.weights.payload,
            zeroFuelWeight: ofp.weights.est_zfw,
            fuelPlan: ofp.fuel.plan_ramp,
            
            // IVAO/VATSIM prefile data
            atcFlightPlan: ofp.atc ? {
                flightRules: ofp.atc.flighttype,
                departure: ofp.atc.dep,
                arrival: ofp.atc.arr,
                alternate: ofp.atc.altn,
                cruiseSpeed: ofp.atc.cruise_speed,
                altitude: ofp.atc.altitude,
                route: ofp.atc.route,
                remarks: ofp.atc.remarks,
                eet: ofp.atc.eet
            } : null,
            
            // Links
            links: {
                charts: ofp.links.charts,
                weather: ofp.links.weather,
                ofp: ofp.links.ofp
            },
            
            // Full OFP data (for advanced use)
            raw: ofp
        };

        res.json(flightPlan);
        
    } catch (error) {
        console.error('Failed to fetch SimBrief flight plan:', error.message);
        
        if (error.response?.status === 400) {
            return res.status(404).json({ 
                error: 'Invalid SimBrief account',
                message: 'The SimBrief username/ID appears to be invalid'
            });
        }
        
        res.status(500).json({ 
            error: 'Failed to fetch SimBrief flight plan',
            message: error.message 
        });
    }
});

// Import SimBrief flight plan to active flight
router.post('/import/:flightId', authenticate, async (req, res) => {
    try {
        const flightId = parseInt(req.params.flightId);
        
        // Verify the flight belongs to the user and is active
        const flight = await prisma.flight.findFirst({
            where: {
                id: flightId,
                pilotId: req.user.id,
                status: 1 // Pending
            },
            include: {
                departure: true,
                arrival: true
            }
        });

        if (!flight) {
            return res.status(404).json({ 
                error: 'Flight not found',
                message: 'No active flight found to import SimBrief data'
            });
        }

        // Get pilot's SimBrief account
        const pilot = await prisma.pilot.findUnique({
            where: { id: req.user.id },
            select: { simbriefAccount: true }
        });

        if (!pilot.simbriefAccount) {
            return res.status(400).json({ 
                error: 'SimBrief account not configured'
            });
        }

        // Fetch SimBrief OFP
        
        const simbriefResponse = await axios.get(
            `https://www.simbrief.com/api/xml.fetcher.php?username=${pilot.simbriefAccount}&json=1`
        );


        // According to old-experimental-website, the OFP data is at the root level, NOT under fetch
        const ofp = simbriefResponse.data;
        
        // Check if we have actual OFP data - it should have origin, destination, etc.
        if (!ofp || !ofp.origin || !ofp.destination) {
            // If we only have fetch with basic info, there's no OFP
            if (ofp?.fetch && !ofp.origin) {
                return res.status(404).json({ 
                    error: 'No active SimBrief OFP found',
                    message: 'Please generate an OFP in SimBrief first. Use the "Create in SimBrief" button to open SimBrief with pre-filled data, then complete the OFP generation before importing.',
                    details: 'SimBrief user found but no flight plan generated yet'
                });
            }
            
            return res.status(404).json({ 
                error: 'No active SimBrief OFP found',
                message: 'Could not find flight plan data in SimBrief response',
                details: `Response keys: ${ofp ? Object.keys(ofp).slice(0, 10).join(', ') : 'none'}`
            });
        }

        
        // According to old-experimental-website, the structure is: origin.icao_code and destination.icao_code
        const simbriefOrigin = ofp.origin?.icao_code || 
                               ofp.origin?.icao ||
                               ofp.orig || 
                               ofp.depicao || 
                               ofp.dep || 
                               ofp.atc?.dep || 
                               ofp.general?.orig_icao;
                               
        const simbriefDestination = ofp.destination?.icao_code || 
                                    ofp.destination?.icao ||
                                    ofp.dest || 
                                    ofp.arricao || 
                                    ofp.arr || 
                                    ofp.atc?.arr || 
                                    ofp.general?.dest_icao;
        
        // Verify the flight plan matches the active flight
        if (simbriefOrigin !== flight.departure.icao || 
            simbriefDestination !== flight.arrival.icao) {
            return res.status(400).json({ 
                error: 'Flight plan mismatch',
                message: `SimBrief flight plan (${simbriefOrigin}-${simbriefDestination}) does not match active flight (${flight.departure.icao}-${flight.arrival.icao})`
            });
        }

        // Update flight with complete SimBrief data
        const aircraftCode = ofp.aircraft?.icaocode || ofp.aircraft?.icao_code || ofp.aircraftcode;
        
        // Store ALL SimBrief data - both processed and raw
        const simbriefFullData = {
            imported: new Date().toISOString(),
            // Flight identification
            airline: ofp.general?.icao_airline || ofp.airline || airlineConfig.icaoCode,
            flightNumber: ofp.general?.flight_number || ofp.flightnumber || '',
            callsign: `${ofp.general?.icao_airline || airlineConfig.icaoCode}${ofp.general?.flight_number || ''}`,
            
            // Aircraft
            aircraft: {
                icaocode: aircraftCode,
                reg: ofp.aircraft?.reg || '',
                name: ofp.aircraft?.name || ''
            },
            
            // Airports
            origin: {
                icao: simbriefOrigin,
                name: ofp.origin?.name || '',
                lat: ofp.origin?.lat || 0,
                lon: ofp.origin?.lon || 0
            },
            destination: {
                icao: simbriefDestination,
                name: ofp.destination?.name || '',
                lat: ofp.destination?.lat || 0,
                lon: ofp.destination?.lon || 0
            },
            alternate: {
                icao: ofp.alternate?.icao_code || '',
                name: ofp.alternate?.name || ''
            },
            
            // Route and navigation
            route: ofp.general?.route || '',
            distance: ofp.general?.distance || ofp.distance || '',
            cruiseAltitude: ofp.general?.initial_altitude || '',
            costIndex: ofp.general?.costindex || '',
            
            // Times
            times: {
                scheduled_out: ofp.times?.sched_out || '',
                scheduled_off: ofp.times?.sched_off || '',
                scheduled_on: ofp.times?.sched_on || '',
                scheduled_in: ofp.times?.sched_in || '',
                scheduled_block: ofp.times?.sched_block || '',
                estimated_block: ofp.times?.est_block || ''
            },
            
            // Fuel
            fuel: {
                plan_ramp: ofp.fuel?.plan_ramp || 0,
                plan_takeoff: ofp.fuel?.plan_takeoff || 0,
                plan_landing: ofp.fuel?.plan_landing || 0,
                plan_taxi: ofp.fuel?.plan_taxi || 0,
                reserve: ofp.fuel?.reserve || 0,
                contingency: ofp.fuel?.contingency || 0,
                alternate: ofp.fuel?.alternate_burn || 0,
                extra: ofp.fuel?.extra || 0
            },
            
            // Weights
            weights: {
                oew: ofp.weights?.oew || 0,
                pax_count: ofp.weights?.pax_count || ofp.general?.passengers || 0,
                cargo: ofp.weights?.cargo || 0,
                payload: ofp.weights?.payload || 0,
                est_zfw: ofp.weights?.est_zfw || 0,
                est_tow: ofp.weights?.est_tow || 0,
                est_ldw: ofp.weights?.est_ldw || 0,
                max_tow: ofp.weights?.max_tow || 0,
                max_ldw: ofp.weights?.max_ldw || 0
            },
            
            // Weather
            weather: {
                dep_metar: ofp.weather?.dep_metar || '',
                arr_metar: ofp.weather?.arr_metar || '',
                altn_metar: ofp.weather?.altn_metar || ''
            },
            
            // ATC (for IVAO prefile)
            atc: ofp.atc || {},
            
            // Files and links
            files: {
                pdf: ofp.files?.pdf?.link || '',
                directory: ofp.files?.directory || ''
            },
            
            // SimBrief identifiers
            params: {
                request_id: ofp.params?.request_id || '',
                user_id: ofp.params?.user_id || ''
            },
            
            // Store the ENTIRE raw OFP for maximum flexibility
            // This allows us to access any field later without re-importing
            raw: ofp
        };
        
        const updatedFlight = await prisma.flight.update({
            where: { id: flightId },
            data: {
                // Store complete SimBrief data in the new JSON field
                simbriefData: simbriefFullData
            },
            include: {
                departure: true,
                arrival: true
            }
        });

        res.json({
            message: 'SimBrief flight plan imported successfully',
            flight: updatedFlight,
            simbrief: {
                imported: true,
                callsign: simbriefFullData.callsign,
                aircraft: simbriefFullData.aircraft.icaocode,
                route: simbriefFullData.route,
                altitude: simbriefFullData.cruiseAltitude,
                fuel: simbriefFullData.fuel.plan_ramp,
                pax: simbriefFullData.weights.pax_count,
                blockTime: simbriefFullData.times.estimated_block,
                pdfLink: simbriefFullData.files.pdf
            }
        });
        
    } catch (error) {
        console.error('Failed to import SimBrief flight plan:', error);
        res.status(500).json({ 
            error: 'Failed to import SimBrief flight plan',
            message: error.message
        });
    }
});

// Get IVAO prefile format
router.get('/ivao-prefile/:flightId', authenticate, async (req, res) => {
    try {
        const flightId = parseInt(req.params.flightId);
        
        // Get flight
        const flight = await prisma.flight.findFirst({
            where: {
                id: flightId,
                pilotId: req.user.id
            },
            include: {
                departure: true,
                arrival: true
            }
        });

        if (!flight) {
            return res.status(404).json({ error: 'Flight not found' });
        }

        // Try to get ATC data from stored SimBrief data first
        let atc = null;
        let simbriefStored = false;
        
        if (flight.simbriefData) {
            // Use the new simbriefData field
            const sbData = flight.simbriefData;
            if (sbData.atc) {
                atc = sbData.atc;
                simbriefStored = true;
            }
        }
        
        // If no stored ATC data, fetch from SimBrief
        if (!atc) {
            // Get pilot's SimBrief account
            const pilot = await prisma.pilot.findUnique({
                where: { id: req.user.id },
                select: { simbriefAccount: true }
            });

            if (!pilot.simbriefAccount) {
                return res.status(400).json({ 
                    error: 'SimBrief account not configured',
                    message: 'Please import SimBrief data first or configure your SimBrief account'
                });
            }

            // Fetch SimBrief OFP
            const simbriefResponse = await axios.get(
                `https://www.simbrief.com/api/xml.fetcher.php?username=${pilot.simbriefAccount}&json=1`
            );

            if (!simbriefResponse.data?.fetch?.atc) {
                return res.status(404).json({ 
                    error: 'No ATC flight plan found',
                    message: 'Please import SimBrief data first'
                });
            }

            atc = simbriefResponse.data.fetch.atc;
        }
        
        // Build proper IVAO flight plan object (using base64 encoded JSON format)
        // Use current time + 30 minutes for departure time in UTC
        const now = new Date();
        const depTime = new Date(now.getTime() + 30 * 60 * 1000); // Add 30 minutes
        
        // IVAO expects departure time as SECONDS since midnight UTC, not minutes
        const depTimeSeconds = depTime.getUTCHours() * 3600 + depTime.getUTCMinutes() * 60;
        
        
        // Get data from SimBrief or defaults
        const simbriefData = flight.simbriefData || {};
        const cruiseSpeed = parseInt(atc?.cruise_speed || simbriefData.cruiseSpeed || '350');
        const cruiseAltitude = parseInt((atc?.initial_altitude || simbriefData.cruiseAltitude || '35000').replace(/[^0-9]/g, '')) / 100;
        const eet = parseInt(simbriefData.times?.estimated_block || '7200'); // Keep in seconds for IVAO
        const passengers = simbriefData.weights?.pax_count || 0;
        
        // Calculate endurance from SimBrief fuel data
        // SimBrief provides: plan_ramp (total fuel) and estimated fuel flow
        // Endurance = total fuel / fuel flow per hour * 3600 (to get seconds)
        // If not available, use a safe default of 5 hours (18000 seconds)
        let endurance = 18000; // Default 5 hours in seconds
        
        if (simbriefData.fuel?.plan_ramp && simbriefData.fuel?.avg_fuel_flow) {
            // plan_ramp is in lbs or kg, avg_fuel_flow is per hour per engine
            const totalFuel = parseInt(simbriefData.fuel.plan_ramp);
            const fuelFlow = parseInt(simbriefData.fuel.avg_fuel_flow) * (simbriefData.general?.engine_count || 2);
            if (totalFuel > 0 && fuelFlow > 0) {
                const enduranceHours = totalFuel / fuelFlow;
                endurance = Math.round(enduranceHours * 3600); // Convert to seconds
            }
        }
        
        // Make sure endurance is reasonable (between 1 hour and 24 hours)
        endurance = Math.max(3600, Math.min(endurance, 86400));
        
        // Build remarks
        const remarksArray = [
            'PBN/A1B1C1D1O1S1',
            `DOF/${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`,
            simbriefData.aircraft?.reg ? `REG/${simbriefData.aircraft.reg}` : '',
            `OPR/${airlineConfig.icaoCode}`,
            'PER/C',
            `IVAOVA/${airlineConfig.icaoCode}`,  // Important for IVAO VA identification
            'RMK/TCAS EQUIPPED',
            'SIMBRIEF'
        ].filter(r => r); // Remove empty strings
        
        const flightPlan = {
            callsign: flight.callsign,
            flightRules: 'I',  // IFR
            flightType: 'N',   // Non-scheduled
            aircraftNumber: 1,
            aircraftId: flight.aircraft,
            aircraftWakeTurbulence: 'M',  // Medium (can be adjusted based on aircraft type)
            aircraftEquipments: ['S', 'D', 'E2', 'E3', 'F', 'G', 'I', 'R', 'W', 'Y'], // Updated to match IVAO standards
            aircraftTransponderTypes: ['H'], // Mode S transponder for commercial aircraft
            departureId: flight.departureIcao,
            departureTime: depTimeSeconds,
            cruisingSpeedType: 'N',  // Knots
            cruisingSpeed: cruiseSpeed,
            altitudeType: 'F',  // Flight level
            altitude: cruiseAltitude,
            route: atc?.route || simbriefData.route || 'DCT',
            arrivalId: flight.arrivalIcao,
            eet: Math.round(eet),
            alternativeId: atc?.altn || simbriefData.alternate?.icao || flight.arrivalIcao,
            alternative2Id: null,
            remarks: remarksArray.join(' '),
            endurance: endurance,
            pob: passengers  // Persons on board
        };
        
        // Encode flight plan to base64
        const encodedFlightPlan = Buffer.from(JSON.stringify(flightPlan)).toString('base64');
        
        // Generate proper IVAO prefile URL
        const ivaoPrefileUrl = `https://fpl.ivao.aero/flight-plans/create?flightPlan=${encodedFlightPlan}`;

        res.json({
            flightPlan: {
                callsign: flight.callsign,
                departure: flight.departure.icao,
                arrival: flight.arrival.icao,
                aircraft: flight.aircraft,
                route: atc.route,
                altitude: atc.altitude,
                remarks: atc.remarks
            },
            ivaoPrefileUrl,
            raw: atc
        });
        
    } catch (error) {
        console.error('Failed to generate IVAO prefile:', error);
        res.status(500).json({ 
            error: 'Failed to generate IVAO prefile',
            message: error.message
        });
    }
});

// Get VATSIM prefile format
router.get('/vatsim-prefile/:flightId', authenticate, async (req, res) => {
    try {
        const flightId = parseInt(req.params.flightId);

        // Get flight
        const flight = await prisma.flight.findFirst({
            where: {
                id: flightId,
                pilotId: req.user.id
            },
            include: {
                departure: true,
                arrival: true
            }
        });

        if (!flight) {
            return res.status(404).json({ error: 'Flight not found' });
        }

        // Try to get data from stored SimBrief data first
        let flightPlanData = null;
        let simbriefStored = false;

        if (flight.simbriefData) {
            const sbData = flight.simbriefData;
            if (sbData.atc) {
                flightPlanData = sbData;
                simbriefStored = true;
            }
        }

        // If no stored data, fetch from SimBrief
        if (!flightPlanData) {
            // Get pilot's SimBrief account
            const pilot = await prisma.pilot.findUnique({
                where: { id: req.user.id },
                select: { simbriefAccount: true }
            });

            if (!pilot.simbriefAccount) {
                return res.status(400).json({
                    error: 'SimBrief account not configured',
                    message: 'Please import SimBrief data first or configure your SimBrief account'
                });
            }

            // Fetch SimBrief OFP
            const simbriefResponse = await axios.get(
                `https://www.simbrief.com/api/xml.fetcher.php?username=${pilot.simbriefAccount}&json=1`
            );

            if (!simbriefResponse.data?.fetch?.atc) {
                return res.status(404).json({
                    error: 'No ATC flight plan found',
                    message: 'Please import SimBrief data first'
                });
            }

            flightPlanData = {
                atc: simbriefResponse.data.fetch.atc,
                aircraft: simbriefResponse.data.fetch.aircraft,
                general: simbriefResponse.data.fetch.general,
                fuel: simbriefResponse.data.fetch.fuel,
                weights: simbriefResponse.data.fetch.weights,
                times: simbriefResponse.data.fetch.times,
                alternate: simbriefResponse.data.fetch.alternate
            };
        }

        const atc = flightPlanData.atc || {};
        const simbriefData = flight.simbriefData || flightPlanData || {};

        // Build VATSIM flight plan in FPL format
        const aircraft = simbriefData.aircraft || {};
        const general = simbriefData.general || {};
        const fuel = simbriefData.fuel || {};
        const weights = simbriefData.weights || {};
        const times = simbriefData.times || {};

        // Aircraft type code (e.g., B738, A320, etc.)
        const aircraftType = aircraft.icaocode || flight.aircraft || 'B738';

        // Equipment codes - VATSIM format
        const equipment = 'SBDGHM1RWXY/LB2';

        // Departure time in HHMM format
        const now = new Date();
        const depTime = new Date(now.getTime() + 30 * 60 * 1000); // Add 30 minutes
        const depTimeStr = depTime.getUTCHours().toString().padStart(2, '0') +
                          depTime.getUTCMinutes().toString().padStart(2, '0');

        // Speed and altitude
        const cruiseSpeed = 'N' + (atc.cruise_speed || '0450').padStart(4, '0');
        const cruiseAlt = 'F' + (atc.initial_altitude || '350').replace(/[^0-9]/g, '').padStart(3, '0');

        // Route
        const route = atc.route || simbriefData.route || 'DCT';

        // EET calculation in HHMM format
        const eetSeconds = parseInt(times.estimated_block || times.est_block || '7200');
        const eetHours = Math.floor(eetSeconds / 3600);
        const eetMinutes = Math.floor((eetSeconds % 3600) / 60);
        const eetStr = eetHours.toString().padStart(2, '0') + eetMinutes.toString().padStart(2, '0');

        // Alternate airport
        const alternate = simbriefData.alternate?.icao || atc.altn || flight.arrivalIcao;

        // Build DOF (Date of Flight)
        const dof = now.getFullYear().toString().slice(-2) +
                   (now.getMonth() + 1).toString().padStart(2, '0') +
                   now.getDate().toString().padStart(2, '0');

        // Registration (from SimBrief or generate one)
        const registration = aircraft.reg || `N${Math.floor(Math.random() * 900) + 100}EX`;

        // Build the FPL string
        const fpl = `(FPL-${flight.callsign}-IS
-${aircraftType}/M-${equipment}
-${flight.departureIcao}${depTimeStr}
-${cruiseSpeed}${cruiseAlt} ${route}
-${flight.arrivalIcao}${eetStr} ${alternate}
-PBN/A1B2C2D2D3O2O3S2 DOF/${dof} REG/${registration} EET/VARIOUS OPR/${airlineConfig.icaoCode} PER/C IVAOVA/${airlineConfig.icaoCode} RMK/TCAS EQUIPPED SIMBRIEF)`;

        // Calculate fuel time in HHMM format for endurance
        let enduranceSeconds = 18000; // Default 5 hours
        if (fuel.plan_ramp && fuel.avg_fuel_flow) {
            const totalFuel = parseInt(fuel.plan_ramp);
            const fuelFlow = parseInt(fuel.avg_fuel_flow) * (general.engine_count || 2);
            if (totalFuel > 0 && fuelFlow > 0) {
                const enduranceHours = totalFuel / fuelFlow;
                enduranceSeconds = Math.round(enduranceHours * 3600);
            }
        }
        const fuelHours = Math.floor(enduranceSeconds / 3600);
        const fuelMinutes = Math.floor((enduranceSeconds % 3600) / 60);
        const fuelTime = fuelHours.toString().padStart(2, '0') + fuelMinutes.toString().padStart(2, '0');

        // Build VATSIM prefile URL
        const vatsimUrl = `https://my.vatsim.net/pilots/flightplan?raw=${encodeURIComponent(fpl)}&fuel_time=${fuelTime}`;

        res.json({
            success: true,
            url: vatsimUrl,
            flightPlan: fpl,
            fuelTime: fuelTime,
            message: 'VATSIM prefile URL generated successfully'
        });

    } catch (error) {
        console.error('Failed to generate VATSIM prefile:', error);
        res.status(500).json({
            error: 'Failed to generate VATSIM prefile',
            message: error.message
        });
    }
});

module.exports = router;