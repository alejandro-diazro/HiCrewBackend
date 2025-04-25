const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const medals = await prisma.medal.findMany({
            select: {
                id: true,
                img: true,
                text: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(medals);
    } catch (error) {
        console.error('Failed to fetch medals:', error);
        res.status(500).json({ error: 'Failed to fetch medals' });
    }
});

router.post('/', authenticate, checkPermissions(['USER_MANAGER']), async (req, res) => {
    const { img, text } = req.body;

    if (!img || !text) {
        return res.status(400).json({ error: 'img and text are required' });
    }
    if (img.length > 255) {
        return res.status(400).json({ error: 'img must be 255 characters or less' });
    }
    if (text.length > 255) {
        return res.status(400).json({ error: 'text must be 255 characters or less' });
    }

    try {
        const medal = await prisma.medal.create({
            data: {
                img,
                text,
            },
            select: {
                id: true,
                img: true,
                text: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Medal created successfully', medal });
    } catch (error) {
        console.error('Failed to create medal:', error);
        res.status(500).json({ error: 'Failed to create medal' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['USER_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { img, text } = req.body;

    if (!img && !text) {
        return res.status(400).json({ error: 'At least one of img or text is required' });
    }
    if (img && img.length > 255) {
        return res.status(400).json({ error: 'img must be 255 characters or less' });
    }
    if (text && text.length > 255) {
        return res.status(400).json({ error: 'text must be 255 characters or less' });
    }

    try {
        const medal = await prisma.medal.update({
            where: { id: parseInt(id) },
            data: {
                img: img || undefined,
                text: text || undefined,
            },
            select: {
                id: true,
                img: true,
                text: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Medal updated successfully', medal });
    } catch (error) {
        console.error('Failed to update medal:', error);
        res.status(500).json({ error: 'Failed to update medal' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['USER_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.medal.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Medal deleted successfully' });
    } catch (error) {
        console.error('Failed to delete medal:', error);
        res.status(500).json({ error: 'Failed to delete medal' });
    }
});

module.exports = router;