const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

// Get my tour enrollments
router.get('/my-enrollments', authenticate, async (req, res) => {
    try {
        const enrollments = await prisma.tourEnrollment.findMany({
            where: { pilotId: req.user.id },
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
        res.json(enrollments);
    } catch (error) {
        console.error('Failed to fetch enrollments:', error);
        res.status(500).json({ error: 'Failed to fetch enrollments' });
    }
});

// Enroll in a tour
router.post('/enroll', authenticate, async (req, res) => {
    const { tourId } = req.body;

    try {
        // Check if already enrolled
        const existing = await prisma.tourEnrollment.findUnique({
            where: {
                pilotId_tourId: {
                    pilotId: req.user.id,
                    tourId: parseInt(tourId)
                }
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'Already enrolled in this tour' });
        }

        // Create enrollment
        const enrollment = await prisma.tourEnrollment.create({
            data: {
                pilotId: req.user.id,
                tourId: parseInt(tourId),
                currentLegOrder: 1,
                completedLegs: 0
            }
        });

        res.status(201).json(enrollment);
    } catch (error) {
        console.error('Failed to enroll:', error);
        res.status(500).json({ error: 'Failed to enroll in tour' });
    }
});

// Get tour progress
router.get('/progress/:tourId', authenticate, async (req, res) => {
    try {
        const enrollment = await prisma.tourEnrollment.findUnique({
            where: {
                pilotId_tourId: {
                    pilotId: req.user.id,
                    tourId: parseInt(req.params.tourId)
                }
            },
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

        if (!enrollment) {
            return res.json({ enrolled: false });
        }

        // Check for pending flights for each leg (completed but not validated)
        const pendingFlights = await prisma.flight.findMany({
            where: {
                pilotId: req.user.id,
                tourEnrollmentId: enrollment.id,
                status: 1, // Pending validation
                closeFlight: { not: null } // Only completed flights, not active ones
            },
            select: {
                id: true,
                legId: true,
                departureIcao: true,
                arrivalIcao: true,
                status: true
            }
        });

        // Create a map of leg IDs to pending status
        const pendingLegIds = new Set(pendingFlights.map(f => f.legId));

        res.json({
            enrolled: true,
            enrollment,
            currentLegOrder: enrollment.currentLegOrder,
            completedLegs: enrollment.completedLegs,
            totalLegs: enrollment.tour.legs.length,
            percentage: Math.round((enrollment.completedLegs / enrollment.tour.legs.length) * 100),
            pendingFlights,
            pendingLegIds: Array.from(pendingLegIds)
        });
    } catch (error) {
        console.error('Failed to fetch progress:', error);
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
});

module.exports = router;