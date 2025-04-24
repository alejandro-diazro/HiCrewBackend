const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
    try {
        const currentDate = new Date();
        const events = await prisma.event.findMany({
            where: {
                open_view_date: { lte: currentDate },
                close_view_date: { gte: currentDate },
            },
            orderBy: {
                time_event_start: 'asc',
            },
            select: {
                id: true,
                time_event_start: true,
                time_event_end: true,
                open_view_date: true,
                close_view_date: true,
                text: true,
                banner: true,
                points: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        events.sort((a, b) => {
            const diffA = Math.abs(new Date(a.time_event_start) - currentDate);
            const diffB = Math.abs(new Date(b.time_event_start) - currentDate);
            return diffA - diffB;
        });
        res.json(events);
    } catch (error) {
        console.error('Failed to fetch visible events:', error);
        res.status(500).json({ error: 'Failed to fetch visible events' });
    }
});

router.get('/active', authenticate, async (req, res) => {
    try {
        const currentDate = new Date();
        const events = await prisma.event.findMany({
            where: {
                time_event_start: { lte: currentDate },
                time_event_end: { gte: currentDate },
            },
            orderBy: {
                time_event_start: 'asc',
            },
            select: {
                id: true,
                time_event_start: true,
                time_event_end: true,
                open_view_date: true,
                close_view_date: true,
                text: true,
                banner: true,
                points: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        events.sort((a, b) => {
            const diffA = Math.abs(new Date(a.time_event_start) - currentDate);
            const diffB = Math.abs(new Date(b.time_event_start) - currentDate);
            return diffA - diffB;
        });
        res.json(events);
    } catch (error) {
        console.error('Failed to fetch active events:', error);
        res.status(500).json({ error: 'Failed to fetch active events' });
    }
});

router.get('/all', authenticate, checkPermissions(['EVENT_MANAGER']), async (req, res) => {
    try {
        const currentDate = new Date();
        const events = await prisma.event.findMany({
            orderBy: {
                time_event_start: 'asc',
            },
            select: {
                id: true,
                time_event_start: true,
                time_event_end: true,
                open_view_date: true,
                close_view_date: true,
                text: true,
                banner: true,
                points: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        events.sort((a, b) => {
            const diffA = Math.abs(new Date(a.time_event_start) - currentDate);
            const diffB = Math.abs(new Date(b.time_event_start) - currentDate);
            return diffA - diffB;
        });
        res.json(events);
    } catch (error) {
        console.error('Failed to fetch all events:', error);
        res.status(500).json({ error: 'Failed to fetch all events' });
    }
});

router.post('/', authenticate, checkPermissions(['EVENT_MANAGER']), async (req, res) => {
    const { time_event_start, time_event_end, open_view_date, close_view_date, text, banner, points } = req.body;

    if (!time_event_start || !time_event_end || !open_view_date || !close_view_date || !text || !banner || points === undefined) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    if (text.length > 1024) {
        return res.status(400).json({ error: 'text must be 1024 characters or less' });
    }
    if (banner.length > 255) {
        return res.status(400).json({ error: 'banner must be 255 characters or less' });
    }
    if (!Number.isInteger(points) || points < 0) {
        return res.status(400).json({ error: 'points must be a non-negative integer' });
    }

    try {
        const event = await prisma.event.create({
            data: {
                time_event_start: new Date(time_event_start),
                time_event_end: new Date(time_event_end),
                open_view_date: new Date(open_view_date),
                close_view_date: new Date(close_view_date),
                text,
                banner,
                points,
            },
            select: {
                id: true,
                time_event_start: true,
                time_event_end: true,
                open_view_date: true,
                close_view_date: true,
                text: true,
                banner: true,
                points: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Event created successfully', event });
    } catch (error) {
        console.error('Failed to create event:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['EVENT_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { time_event_start, time_event_end, open_view_date, close_view_date, text, banner, points } = req.body;

    if (!time_event_start && !time_event_end && !open_view_date && !close_view_date && !text && !banner && points === undefined) {
        return res.status(400).json({ error: 'At least one field is required' });
    }
    if (text && text.length > 1024) {
        return res.status(400).json({ error: 'text must be 1024 characters or less' });
    }
    if (banner && banner.length > 255) {
        return res.status(400).json({ error: 'banner must be 255 characters or less' });
    }
    if (points !== undefined && (!Number.isInteger(points) || points < 0)) {
        return res.status(400).json({ error: 'points must be a non-negative integer' });
    }

    try {
        const event = await prisma.event.update({
            where: { id: parseInt(id) },
            data: {
                time_event_start: time_event_start ? new Date(time_event_start) : undefined,
                time_event_end: time_event_end ? new Date(time_event_end) : undefined,
                open_view_date: open_view_date ? new Date(open_view_date) : undefined,
                close_view_date: close_view_date ? new Date(close_view_date) : undefined,
                text: text || undefined,
                banner: banner || undefined,
                points: points !== undefined ? points : undefined,
            },
            select: {
                id: true,
                time_event_start: true,
                time_event_end: true,
                open_view_date: true,
                close_view_date: true,
                text: true,
                banner: true,
                points: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Event updated successfully', event });
    } catch (error) {
        console.error('Failed to update event:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['EVENT_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.event.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Failed to delete event:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

module.exports = router;