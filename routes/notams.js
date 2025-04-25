const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
    try {
        const currentDate = new Date();
        const notams = await prisma.notam.findMany({
            where: {
                active_date: { lte: currentDate },
                desactivate_date: { gte: currentDate },
            },
            select: {
                id: true,
                text: true,
                lang: true,
                active_date: true,
                desactivate_date: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(notams);
    } catch (error) {
        console.error('Failed to fetch active NOTAMs:', error);
        res.status(500).json({ error: 'Failed to fetch active NOTAMs' });
    }
});

router.get('/all', authenticate, checkPermissions(['NOTAMS_MANAGER']), async (req, res) => {
    try {
        const notams = await prisma.notam.findMany({
            select: {
                id: true,
                text: true,
                lang: true,
                active_date: true,
                desactivate_date: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(notams);
    } catch (error) {
        console.error('Failed to fetch all NOTAMs:', error);
        res.status(500).json({ error: 'Failed to fetch all NOTAMs' });
    }
});

router.post('/', authenticate, checkPermissions(['NOTAMS_MANAGER']), async (req, res) => {
    const { text, lang, active_date, desactivate_date } = req.body;

    // Basic validation
    if (!text || !lang || !active_date || !desactivate_date) {
        return res.status(400).json({ error: 'text, lang, active_date, and desactivate_date are required' });
    }
    if (text.length > 1024) {
        return res.status(400).json({ error: 'text must be 1024 characters or less' });
    }
    if (lang.length > 4) {
        return res.status(400).json({ error: 'lang must be 4 characters or less' });
    }

    try {
        const notam = await prisma.notam.create({
            data: {
                text,
                lang,
                active_date: new Date(active_date),
                desactivate_date: new Date(desactivate_date),
            },
            select: {
                id: true,
                text: true,
                lang: true,
                active_date: true,
                desactivate_date: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'NOTAM created successfully', notam });
    } catch (error) {
        console.error('Failed to create NOTAM:', error);
        res.status(500).json({ error: 'Failed to create NOTAM' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['NOTAMS_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { text, lang, active_date, desactivate_date } = req.body;

    if (!text && !lang && !active_date && !desactivate_date) {
        return res.status(400).json({ error: 'At least one of text, lang, active_date, or desactivate_date is required' });
    }
    if (text && text.length > 1024) {
        return res.status(400).json({ error: 'text must be 1024 characters or less' });
    }
    if (lang && lang.length > 4) {
        return res.status(400).json({ error: 'lang must be 4 characters or less' });
    }

    try {
        const notam = await prisma.notam.update({
            where: { id: parseInt(id) },
            data: {
                text: text || undefined,
                lang: lang || undefined,
                active_date: active_date ? new Date(active_date) : undefined,
                desactivate_date: desactivate_date ? new Date(desactivate_date) : undefined,
            },
            select: {
                id: true,
                text: true,
                lang: true,
                active_date: true,
                desactivate_date: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'NOTAM updated successfully', notam });
    } catch (error) {
        console.error('Failed to update NOTAM:', error);
        res.status(500).json({ error: 'Failed to update NOTAM' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['NOTAMS_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.notam.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'NOTAM deleted successfully' });
    } catch (error) {
        console.error('Failed to delete NOTAM:', error);
        res.status(500).json({ error: 'Failed to delete NOTAM' });
    }
});

module.exports = router;