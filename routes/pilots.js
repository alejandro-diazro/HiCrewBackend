const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const pilots = await prisma.pilot.findMany({
            select: {
                id: true,
                ivaoId: true,
                vatsimId: true,
                firstName: true,
                callsign: true,
                hours: true,
                rank: true,
            },
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
        });
        res.json(pilots);
    } catch (error) {
        console.error('Failed to fetch authenticated pilots:', error);
        res.status(500).json({ error: 'Failed to fetch pilots' });
    }
});

router.get('/admin', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    try {
        const pilots = await prisma.pilot.findMany({
            include: {
                pilotPermissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });
        res.json(pilots);
    } catch (error) {
        console.error('Failed to fetch pilots for admin:', error);
        res.status(500).json({ error: 'Failed to fetch pilots' });
    }
});

module.exports = router;