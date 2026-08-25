const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

// Get all active tours (public endpoint)
router.get('/', async (req, res) => {
    try {
        const tours = await prisma.tour.findMany({
            where: {
                isActive: true,
                close_day: {
                    gte: new Date() // Tours that haven't closed yet
                }
            },
            select: {
                id: true,
                medalId: true,
                medal: {
                    select: {
                        id: true,
                        img: true,
                        text: true
                    }
                },
                img: true,
                name: true,
                shortDescription: true,
                open_day: true,
                close_day: true,
                recommendedAircrafts: true,
                legs: {
                    select: {
                        id: true,
                        distance: true,
                        estimatedTime: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Calculate total distance and time for each tour
        const toursWithStats = tours.map(tour => {
            const totalDistance = tour.legs.reduce((acc, leg) => acc + (leg.distance || 0), 0);
            const totalTime = tour.legs.reduce((acc, leg) => acc + (leg.estimatedTime || 0), 0);
            const { legs, ...tourWithoutLegs } = tour;
            return {
                ...tourWithoutLegs,
                totalDistance,
                totalTime,
                totalLegs: legs.length
            };
        });

        res.json(toursWithStats);
    } catch (error) {
        console.error('Failed to fetch tours:', error);
        res.status(500).json({ error: 'Failed to fetch tours' });
    }
});

// Get tour details with all legs
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const tour = await prisma.tour.findUnique({
            where: { id: parseInt(id) },
            include: {
                medal: true,
                legs: {
                    include: {
                        airportDeparture: {
                            select: {
                                icao: true,
                                iata: true,
                                name: true,
                                country: true,
                                latitude: true,
                                longitude: true
                            }
                        },
                        airportArrival: {
                            select: {
                                icao: true,
                                iata: true,
                                name: true,
                                country: true,
                                latitude: true,
                                longitude: true
                            }
                        }
                    },
                    orderBy: {
                        order: 'asc'
                    }
                }
            }
        });

        if (!tour) {
            return res.status(404).json({ error: 'Tour not found' });
        }

        // Calculate total distance and time
        const totalDistance = tour.legs.reduce((acc, leg) => acc + (leg.distance || 0), 0);
        const totalTime = tour.legs.reduce((acc, leg) => acc + (leg.estimatedTime || 0), 0);

        res.json({
            ...tour,
            totalDistance,
            totalTime
        });
    } catch (error) {
        console.error('Failed to fetch tour details:', error);
        res.status(500).json({ error: 'Failed to fetch tour details' });
    }
});

// Get pilot's progress for a specific tour
router.get('/:id/progress', authenticate, async (req, res) => {
    const { id } = req.params;
    const pilotId = req.user.pilotId;
    
    try {
        // Get tour with all legs
        const tour = await prisma.tour.findUnique({
            where: { id: parseInt(id) },
            include: {
                legs: {
                    orderBy: {
                        order: 'asc'
                    }
                }
            }
        });

        if (!tour) {
            return res.status(404).json({ error: 'Tour not found' });
        }

        // Get pilot's completed flights that match tour legs
        const completedLegs = [];
        for (const leg of tour.legs) {
            const flight = await prisma.flight.findFirst({
                where: {
                    pilotId: pilotId,
                    departureIcao: leg.airportDepartureIcao,
                    arrivalIcao: leg.airportArrivalIcao,
                    status: 2, // Accepted flights only
                    createdAt: {
                        gte: tour.open_day,
                        lte: tour.close_day || new Date('2100-01-01')
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
            
            if (flight) {
                completedLegs.push({
                    legId: leg.id,
                    flightId: flight.id,
                    completedAt: flight.createdAt
                });
            }
        }

        const progress = {
            tourId: tour.id,
            totalLegs: tour.legs.length,
            completedLegs: completedLegs.length,
            completedLegIds: completedLegs.map(cl => cl.legId),
            percentage: Math.round((completedLegs.length / tour.legs.length) * 100),
            isCompleted: completedLegs.length === tour.legs.length,
            completedFlights: completedLegs
        };

        res.json(progress);
    } catch (error) {
        console.error('Failed to fetch tour progress:', error);
        res.status(500).json({ error: 'Failed to fetch tour progress' });
    }
});

router.post('/', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    const { 
        medalId, 
        img, 
        name, 
        description, 
        shortDescription,
        open_day, 
        close_day,
        recommendedAircrafts,
        bannerImage,
        isActive = true
    } = req.body;

    if (!img || !name || !description || !shortDescription || !open_day || !close_day) {
        return res.status(400).json({ error: 'img, name, description, shortDescription, open_day, and close_day are required' });
    }
    if (img.length > 500) {
        return res.status(400).json({ error: 'img must be 500 characters or less' });
    }
    if (name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (shortDescription.length > 255) {
        return res.status(400).json({ error: 'shortDescription must be 255 characters or less' });
    }
    if (isNaN(new Date(open_day).getTime()) || isNaN(new Date(close_day).getTime())) {
        return res.status(400).json({ error: 'open_day and close_day must be valid dates' });
    }
    if (new Date(open_day) >= new Date(close_day)) {
        return res.status(400).json({ error: 'open_day must be before close_day' });
    }

    try {
        const tour = await prisma.tour.create({
            data: {
                medalId: medalId || null,
                img,
                name,
                description,
                shortDescription,
                open_day: new Date(open_day),
                close_day: new Date(close_day),
                recommendedAircrafts,
                bannerImage,
                isActive
            },
            include: {
                medal: true
            }
        });
        res.status(201).json({ message: 'Tour created successfully', tour });
    } catch (error) {
        console.error('Failed to create tour:', error);
        res.status(500).json({ error: 'Failed to create tour' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { 
        medalId, 
        img, 
        name, 
        description, 
        shortDescription,
        open_day, 
        close_day,
        recommendedAircrafts,
        bannerImage,
        isActive
    } = req.body;

    if (!medalId && !img && !name && !description && !shortDescription && !open_day && !close_day && !recommendedAircrafts && !bannerImage && isActive === undefined) {
        return res.status(400).json({ error: 'At least one field is required to update' });
    }
    if (img && img.length > 500) {
        return res.status(400).json({ error: 'img must be 500 characters or less' });
    }
    if (shortDescription && shortDescription.length > 255) {
        return res.status(400).json({ error: 'shortDescription must be 255 characters or less' });
    }
    if (name && name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (description && description.length > 255) {
        return res.status(400).json({ error: 'description must be 255 characters or less' });
    }
    if (open_day && isNaN(new Date(open_day).getTime())) {
        return res.status(400).json({ error: 'open_day must be a valid date' });
    }
    if (close_day && isNaN(new Date(close_day).getTime())) {
        return res.status(400).json({ error: 'close_day must be a valid date' });
    }
    if (open_day && close_day && new Date(open_day) >= new Date(close_day)) {
        return res.status(400).json({ error: 'open_day must be before close_day' });
    }

    try {
        const tour = await prisma.tour.update({
            where: { id: parseInt(id) },
            data: {
                medalId: medalId !== undefined ? medalId : undefined,
                img: img || undefined,
                name: name || undefined,
                description: description || undefined,
                shortDescription: shortDescription || undefined,
                open_day: open_day ? new Date(open_day) : undefined,
                close_day: close_day ? new Date(close_day) : undefined,
                recommendedAircrafts: recommendedAircrafts !== undefined ? recommendedAircrafts : undefined,
                bannerImage: bannerImage !== undefined ? bannerImage : undefined,
                isActive: isActive !== undefined ? isActive : undefined
            },
            include: {
                medal: true,
                legs: {
                    orderBy: {
                        order: 'asc'
                    }
                }
            }
        });
        res.json({ message: 'Tour updated successfully', tour });
    } catch (error) {
        console.error('Failed to update tour:', error);
        res.status(500).json({ error: 'Failed to update tour' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.tour.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Tour deleted successfully' });
    } catch (error) {
        console.error('Failed to delete tour:', error);
        res.status(500).json({ error: 'Failed to delete tour' });
    }
});

module.exports = router;