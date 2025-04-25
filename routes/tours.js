const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
    try {
        const tours = await prisma.tour.findMany({
            select: {
                id: true,
                medalId: true,
                img: true,
                name: true,
                description: true,
                open_day: true,
                close_day: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(tours);
    } catch (error) {
        console.error('Failed to fetch tours:', error);
        res.status(500).json({ error: 'Failed to fetch tours' });
    }
});

router.post('/', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    const { medalId, img, name, description, open_day, close_day } = req.body;

    if (!medalId || !img || !name || !description || !open_day || !close_day) {
        return res.status(400).json({ error: 'medalId, img, name, description, open_day, and close_day are required' });
    }
    if (img.length > 255) {
        return res.status(400).json({ error: 'img must be 255 characters or less' });
    }
    if (name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (description.length > 255) {
        return res.status(400).json({ error: 'description must be 255 characters or less' });
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
                medalId,
                img,
                name,
                description,
                open_day: new Date(open_day),
                close_day: new Date(close_day),
            },
            select: {
                id: true,
                medalId: true,
                img: true,
                name: true,
                description: true,
                open_day: true,
                close_day: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Tour created successfully', tour });
    } catch (error) {
        console.error('Failed to create tour:', error);
        res.status(500).json({ error: 'Failed to create tour' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['TOUR_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { medalId, img, name, description, open_day, close_day } = req.body;

    if (!medalId && !img && !name && !description && !open_day && !close_day) {
        return res.status(400).json({ error: 'At least one of medalId, img, name, description, open_day, or close_day is required' });
    }
    if (img && img.length > 255) {
        return res.status(400).json({ error: 'img must be 255 characters or less' });
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
                medalId: medalId || undefined,
                img: img || undefined,
                name: name || undefined,
                description: description || undefined,
                open_day: open_day ? new Date(open_day) : undefined,
                close_day: close_day ? new Date(close_day) : undefined,
            },
            select: {
                id: true,
                medalId: true,
                img: true,
                name: true,
                description: true,
                open_day: true,
                close_day: true,
                createdAt: true,
                updatedAt: true,
            },
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