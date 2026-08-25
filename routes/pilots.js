const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const pilots = await prisma.pilot.findMany({
            where: {
                onVacation: false,
                callsign: { not: null }
            },
            select: {
                id: true,
                ivaoId: true,
                vatsimId: true,
                firstName: true,
                callsign: true,
                hours: true,
                rank: true,
            },
            orderBy: {
                callsign: 'asc'
            }
        });

        res.json(pilots);
    } catch (error) {
        console.error('Failed to fetch pilots:', error);
        res.status(500).json({ error: 'Failed to fetch pilots' });
    }
});

router.get('/authenticated', authenticate, async (req, res) => {
    try {
        const pilots = await prisma.pilot.findMany({
            where: {
                onVacation: false,
                callsign: { not: null }
            },
            select: {
                id: true,
                ivaoId: true,
                vatsimId: true,
                firstName: true,
                lastName: true,
                birthDate: true,
                callsign: true,
                hours: true,
                rank: true,
            },
            orderBy: {
                callsign: 'asc'
            }
        });

        const processedPilots = pilots.map(pilot => ({
            ...pilot,
            lastName: pilot.lastName ? pilot.lastName.charAt(0) + '.' : ''
        }));
        
        res.json(processedPilots);
    } catch (error) {
        console.error('Failed to fetch authenticated pilots:', error);
        res.status(500).json({ error: 'Failed to fetch pilots' });
    }
});

router.get('/admin', authenticate, checkPermissions(['ADMIN', 'USER_MANAGER']), async (req, res) => {
    try {
        const pilots = await prisma.pilot.findMany({
            include: {
                pilotPermissions: {
                    include: {
                        permission: true,
                    },
                },
                flights: {
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1,
                    select: {
                        createdAt: true
                    }
                }
            },
            orderBy: {
                callsign: 'asc'
            }
        });
        res.json(pilots);
    } catch (error) {
        console.error('Failed to fetch pilots for admin:', error);
        res.status(500).json({ error: 'Failed to fetch pilots' });
    }
});

// Admin endpoint to update any pilot's data
router.put('/:id/admin', authenticate, checkPermissions(['ADMIN', 'USER_MANAGER']), async (req, res) => {
    try {
        const pilotId = parseInt(req.params.id);
        
        // Only allow updating specific fields for security
        const { firstName, lastName, email, callsign, ivaoId, vatsimId } = req.body;
        
        const updateData = {};
        
        // Only add fields that were provided
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (email !== undefined) updateData.email = email;
        if (callsign !== undefined) updateData.callsign = callsign || null;
        if (ivaoId !== undefined) updateData.ivaoId = ivaoId || null;
        if (vatsimId !== undefined) updateData.vatsimId = vatsimId || null;
        
        const updatedPilot = await prisma.pilot.update({
            where: { id: pilotId },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                callsign: true,
                ivaoId: true,
                vatsimId: true,
                birthDate: true,
                hours: true,
                rankId: true,
                locationIcao: true,
                points: true,
                simbriefAccount: true,
                onVacation: true,
                createdAt: true,
                updatedAt: true
            }
        });
        
        res.json(updatedPilot);
    } catch (error) {
        console.error('Failed to update pilot (admin):', error);
        
        // Check for unique constraint violations
        if (error.code === 'P2002') {
            const field = error.meta?.target?.[0];
            if (field === 'email') {
                return res.status(400).json({ error: 'Email already in use by another pilot' });
            }
            if (field === 'callsign') {
                return res.status(400).json({ error: 'Callsign already in use by another pilot' });
            }
        }
        
        res.status(500).json({ error: 'Failed to update pilot' });
    }
});

// Regular pilot self-update endpoint
router.put('/:id', authenticate, async (req, res) => {
    try {
        const pilotId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Check if user is updating their own profile or is admin
        const isAdmin = await prisma.pilotPermission.findFirst({
            where: {
                pilotId: userId,
                permission: {
                    name: 'ADMIN'
                }
            }
        });
        
        if (pilotId !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Unauthorized to update this profile' });
        }
        
        // Only allow updating specific fields
        const { simbriefAccount, onVacation } = req.body;
        
        // If admin is changing vacation status
        const updateData = {};
        if (simbriefAccount !== undefined) {
            updateData.simbriefAccount = simbriefAccount || null;
        }
        
        // Only admin or USER_MANAGER can change vacation status
        const hasUserManagerPermission = await prisma.pilotPermission.findFirst({
            where: {
                pilotId: userId,
                permission: {
                    name: 'USER_MANAGER'
                }
            }
        });
        
        if (onVacation !== undefined && (isAdmin || hasUserManagerPermission)) {
            updateData.onVacation = onVacation;
        }
        
        const updatedPilot = await prisma.pilot.update({
            where: { id: pilotId },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                callsign: true,
                ivaoId: true,
                vatsimId: true,
                birthDate: true,
                hours: true,
                rankId: true,
                locationIcao: true,
                points: true,
                simbriefAccount: true,
                onVacation: true,
                createdAt: true,
                updatedAt: true
            }
        });
        
        res.json(updatedPilot);
    } catch (error) {
        console.error('Failed to update pilot:', error);
        res.status(500).json({ error: 'Failed to update pilot' });
    }
});

module.exports = router;