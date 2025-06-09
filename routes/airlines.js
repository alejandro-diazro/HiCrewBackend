const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const airlines = await prisma.airline.findMany({
            select: {
                id: true,
                name: true,
                logo: true,
                tail: true,
                can_join: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(airlines);
    } catch (error) {
        console.error('Failed to fetch airlines:', error);
        res.status(500).json({ error: 'Failed to fetch airlines' });
    }
});

router.post('/', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { name, logo, tail, can_join } = req.body;

    if (!name || !logo || !tail || can_join === undefined) {
        return res.status(400).json({ error: 'name, logo, and can_join are required' });
    }
    if (name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (logo.length > 255) {
        return res.status(400).json({ error: 'logo must be 255 characters or less' });
    }
    if (tail.length > 255) {
        return res.status(400).json({ error: 'tail must be 255 characters or less' });
    }
    if (typeof can_join !== 'boolean') {
        return res.status(400).json({ error: 'can_join must be a boolean' });
    }

    try {
        const airline = await prisma.airline.create({
            data: {
                name,
                logo,
                tail,
                can_join,
            },
            select: {
                id: true,
                name: true,
                logo: true,
                tail: true,
                can_join: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Airline created successfully', airline });
    } catch (error) {
        console.error('Failed to create airline:', error);
        res.status(500).json({ error: 'Failed to create airline' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { name, logo, tail, can_join } = req.body;

    if (!name && !logo && !tail && can_join === undefined) {
        return res.status(400).json({ error: 'At least one of name, logo, or can_join is required' });
    }
    if (name && name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (logo && logo.length > 255) {
        return res.status(400).json({ error: 'logo must be 255 characters or less' });
    }
    if (tail && tail.length > 255) {
        return res.status(400).json({ error: 'tail must be 255 characters or less' });
    }
    if (can_join !== undefined && typeof can_join !== 'boolean') {
        return res.status(400).json({ error: 'can_join must be a boolean' });
    }

    try {
        const airline = await prisma.airline.update({
            where: { id: parseInt(id) },
            data: {
                name: name || undefined,
                logo: logo || undefined,
                tail: tail || undefined,
                can_join: can_join !== undefined ? can_join : undefined,
            },
            select: {
                id: true,
                name: true,
                logo: true,
                tail: true,
                can_join: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Airline updated successfully', airline });
    } catch (error) {
        console.error('Failed to update airline:', error);
        res.status(500).json({ error: 'Failed to update airline' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.airline.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Airline deleted successfully' });
    } catch (error) {
        console.error('Failed to delete airline:', error);
        res.status(500).json({ error: 'Failed to delete airline' });
    }
});

module.exports = router;