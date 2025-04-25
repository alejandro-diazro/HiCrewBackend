const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
    const userId = req.user.id;

    try {
        const reports = await prisma.reportTour.findMany({
            where: { userId },
            select: {
                id: true,
                userId: true,
                legId: true,
                status: true,
                time_departure: true,
                time_arrival: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(reports);
    } catch (error) {
        console.error('Failed to fetch tour reports:', error);
        res.status(500).json({ error: 'Failed to fetch tour reports' });
    }
});

router.get('/pending', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    try {
        const reports = await prisma.reportTour.findMany({
            where: { status: 0 },
            select: {
                id: true,
                userId: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                legId: true,
                leg: {
                    select: {
                        id: true,
                        airportDepartureIcao: true,
                        airportArrivalIcao: true,
                    },
                },
                status: true,
                time_departure: true,
                time_arrival: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(reports);
    } catch (error) {
        console.error('Failed to fetch pending tour reports:', error);
        res.status(500).json({ error: 'Failed to fetch pending tour reports' });
    }
});

router.get('/accepted', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    try {
        const reports = await prisma.reportTour.findMany({
            where: { status: 1 },
            select: {
                id: true,
                userId: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                legId: true,
                leg: {
                    select: {
                        id: true,
                        airportDepartureIcao: true,
                        airportArrivalIcao: true,
                    },
                },
                status: true,
                time_departure: true,
                time_arrival: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(reports);
    } catch (error) {
        console.error('Failed to fetch accepted tour reports:', error);
        res.status(500).json({ error: 'Failed to fetch accepted tour reports' });
    }
});

router.get('/rejected', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    try {
        const reports = await prisma.reportTour.findMany({
            where: { status: 2 },
            select: {
                id: true,
                userId: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                legId: true,
                leg: {
                    select: {
                        id: true,
                        airportDepartureIcao: true,
                        airportArrivalIcao: true,
                    },
                },
                status: true,
                time_departure: true,
                time_arrival: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(reports);
    } catch (error) {
        console.error('Failed to fetch rejected tour reports:', error);
        res.status(500).json({ error: 'Failed to fetch rejected tour reports' });
    }
});

router.post('/', authenticate, async (req, res) => {
    const { legId, time_departure, time_arrival } = req.body;
    const userId = req.user.id;

    if (!legId || !time_departure || !time_arrival) {
        return res.status(400).json({ error: 'legId, time_departure, and time_arrival are required' });
    }
    if (isNaN(new Date(time_departure).getTime()) || isNaN(new Date(time_arrival).getTime())) {
        return res.status(400).json({ error: 'time_departure and time_arrival must be valid dates' });
    }
    if (new Date(time_departure) >= new Date(time_arrival)) {
        return res.status(400).json({ error: 'time_departure must be before time_arrival' });
    }

    try {
        const report = await prisma.reportTour.create({
            data: {
                userId,
                legId,
                status: 0,
                time_departure: new Date(time_departure),
                time_arrival: new Date(time_arrival),
            },
            select: {
                id: true,
                userId: true,
                legId: true,
                status: true,
                time_departure: true,
                time_arrival: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Tour report created successfully', report });
    } catch (error) {
        console.error('Failed to create tour report:', error);
        res.status(500).json({ error: 'Failed to create tour report' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (status === undefined) {
        return res.status(400).json({ error: 'status is required' });
    }
    if (![0, 1, 2].includes(status)) {
        return res.status(400).json({ error: 'status must be 0 (pending), 1 (accepted), or 2 (rejected)' });
    }

    try {
        const report = await prisma.reportTour.update({
            where: { id: parseInt(id) },
            data: { status },
            select: {
                id: true,
                userId: true,
                legId: true,
                status: true,
                time_departure: true,
                time_arrival: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Tour report updated successfully', report });
    } catch (error) {
        console.error('Failed to update tour report:', error);
        res.status(500).json({ error: 'Failed to update tour report' });
    }
});

module.exports = router;