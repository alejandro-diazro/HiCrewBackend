const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
    try {
        const aircraft = await prisma.aircraft.findMany({
            select: {
                id: true,
                icao: true,
                manufacturer: true,
                range: true,
                max_passengers: true,
                img: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(aircraft);
    } catch (error) {
        console.error('Failed to fetch aircraft:', error);
        res.status(500).json({ error: 'Failed to fetch aircraft' });
    }
});

router.post('/', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { icao, manufacturer, range, max_passengers, img } = req.body;

    if (!icao || !manufacturer || range === undefined || max_passengers === undefined || !img) {
        return res.status(400).json({ error: 'icao, manufacturer, range, max_passengers, and img are required' });
    }
    if (icao.length !== 4) {
        return res.status(400).json({ error: 'icao must be exactly 4 characters' });
    }
    if (manufacturer.length > 100) {
        return res.status(400).json({ error: 'manufacturer must be 100 characters or less' });
    }
    if (!Number.isInteger(range) || range < 0) {
        return res.status(400).json({ error: 'range must be a non-negative integer' });
    }
    if (!Number.isInteger(max_passengers) || max_passengers < 0) {
        return res.status(400).json({ error: 'max_passengers must be a non-negative integer' });
    }
    if (img.length > 255) {
        return res.status(400).json({ error: 'img must be 255 characters or less' });
    }

    try {
        const aircraft = await prisma.aircraft.create({
            data: {
                icao,
                manufacturer,
                range,
                max_passengers,
                img,
            },
            select: {
                id: true,
                icao: true,
                manufacturer: true,
                range: true,
                max_passengers: true,
                img: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Aircraft created successfully', aircraft });
    } catch (error) {
        console.error('Failed to create aircraft:', error);
        res.status(500).json({ error: 'Failed to create aircraft' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { icao, manufacturer, range, max_passengers, img } = req.body;

    if (!icao && !manufacturer && range === undefined && max_passengers === undefined && !img) {
        return res.status(400).json({ error: 'At least one of icao, manufacturer, range, max_passengers, or img is required' });
    }
    if (icao && icao.length !== 4) {
        return res.status(400).json({ error: 'icao must be exactly 4 characters' });
    }
    if (manufacturer && manufacturer.length > 100) {
        return res.status(400).json({ error: 'manufacturer must be 100 characters or less' });
    }
    if (range !== undefined && (!Number.isInteger(range) || range < 0)) {
        return res.status(400).json({ error: 'range must be a non-negative integer' });
    }
    if (max_passengers !== undefined && (!Number.isInteger(max_passengers) || max_passengers < 0)) {
        return res.status(400).json({ error: 'max_passengers must be a non-negative integer' });
    }
    if (img && img.length > 255) {
        return res.status(400).json({ error: 'img must be 255 characters or less' });
    }

    try {
        const aircraft = await prisma.aircraft.update({
            where: { id: parseInt(id) },
            data: {
                icao: icao || undefined,
                manufacturer: manufacturer || undefined,
                range: range !== undefined ? range : undefined,
                max_passengers: max_passengers !== undefined ? max_passengers : undefined,
                img: img || undefined,
            },
            select: {
                id: true,
                icao: true,
                manufacturer: true,
                range: true,
                max_passengers: true,
                img: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Aircraft updated successfully', aircraft });
    } catch (error) {
        console.error('Failed to update aircraft:', error);
        res.status(500).json({ error: 'Failed to update aircraft' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.aircraft.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Aircraft deleted successfully' });
    } catch (error) {
        console.error('Failed to delete aircraft:', error);
        res.status(500).json({ error: 'Failed to delete aircraft' });
    }
});

module.exports = router;