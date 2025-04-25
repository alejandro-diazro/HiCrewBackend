const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const ranks = await prisma.rank.findMany({
            select: {
                id: true,
                name: true,
                img: true,
                hours: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(ranks);
    } catch (error) {
        console.error('Failed to fetch ranks:', error);
        res.status(500).json({ error: 'Failed to fetch ranks' });
    }
});

router.post('/', authenticate, checkPermissions(['USER_MANAGER']), async (req, res) => {
    const { name, img, hours } = req.body;

    if (!name || !img || hours === undefined) {
        return res.status(400).json({ error: 'name, img, and hours are required' });
    }
    if (name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (img.length > 255) {
        return res.status(400).json({ error: 'img must be 255 characters or less' });
    }
    if (!Number.isInteger(hours) || hours < 0) {
        return res.status(400).json({ error: 'hours must be a non-negative integer' });
    }

    try {
        const rank = await prisma.rank.create({
            data: {
                name,
                img,
                hours,
            },
            select: {
                id: true,
                name: true,
                img: true,
                hours: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Rank created successfully', rank });
    } catch (error) {
        console.error('Failed to create rank:', error);
        res.status(500).json({ error: 'Failed to create rank' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['USER_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { name, img, hours } = req.body;

    if (!name && !img && hours === undefined) {
        return res.status(400).json({ error: 'At least one of name, img, or hours is required' });
    }
    if (name && name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (img && img.length > 255) {
        return res.status(400).json({ error: 'img must be 255 characters or less' });
    }
    if (hours !== undefined && (!Number.isInteger(hours) || hours < 0)) {
        return res.status(400).json({ error: 'hours must be a non-negative integer' });
    }

    try {
        const rank = await prisma.rank.update({
            where: { id: parseInt(id) },
            data: {
                name: name || undefined,
                img: img || undefined,
                hours: hours !== undefined ? hours : undefined,
            },
            select: {
                id: true,
                name: true,
                img: true,
                hours: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Rank updated successfully', rank });
    } catch (error) {
        console.error('Failed to update rank:', error);
        res.status(500).json({ error: 'Failed to update rank' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['USER_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.rank.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Rank deleted successfully' });
    } catch (error) {
        console.error('Failed to delete rank:', error);
        res.status(500).json({ error: 'Failed to delete rank' });
    }
});

module.exports = router;