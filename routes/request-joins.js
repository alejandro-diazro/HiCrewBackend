const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, checkPermissions(['USER_MANAGER']), async (req, res) => {
    try {
        const requests = await prisma.requestJoin.findMany({
            select: {
                id: true,
                name: true,
                id_ivao: true,
                id_vatsim: true,
                birthday: true,
                email: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(requests);
    } catch (error) {
        console.error('Failed to fetch join requests:', error);
        res.status(500).json({ error: 'Failed to fetch join requests' });
    }
});

router.post('/', async (req, res) => {
    const { name, id_ivao, id_vatsim, birthday, email } = req.body;

    if (!name || !birthday || !email) {
        return res.status(400).json({ error: 'name, birthday, and email are required' });
    }
    if (name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (id_ivao && id_ivao.length > 20) {
        return res.status(400).json({ error: 'id_ivao must be 20 characters or less' });
    }
    if (id_vatsim && id_vatsim.length > 20) {
        return res.status(400).json({ error: 'id_vatsim must be 20 characters or less' });
    }
    if (email.length > 255) {
        return res.status(400).json({ error: 'email must be 255 characters or less' });
    }
    if (isNaN(new Date(birthday).getTime())) {
        return res.status(400).json({ error: 'birthday must be a valid date' });
    }

    try {
        const request = await prisma.requestJoin.create({
            data: {
                name,
                id_ivao: id_ivao || null,
                id_vatsim: id_vatsim || null,
                birthday: new Date(birthday),
                email,
                status: 0,
            },
            select: {
                id: true,
                name: true,
                id_ivao: true,
                id_vatsim: true,
                birthday: true,
                email: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Join request created successfully', request });
    } catch (error) {
        console.error('Failed to create join request:', error);
        res.status(500).json({ error: 'Failed to create join request' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['USER_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (status === undefined) {
        return res.status(400).json({ error: 'status is required' });
    }
    if (![0, 1, 2].includes(status)) {
        return res.status(400).json({ error: 'status must be 0 (pending), 1 (approved), or 2 (rejected)' });
    }

    try {
        const request = await prisma.requestJoin.update({
            where: { id: parseInt(id) },
            data: { status },
            select: {
                id: true,
                name: true,
                id_ivao: true,
                id_vatsim: true,
                birthday: true,
                email: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Join request updated successfully', request });
    } catch (error) {
        console.error('Failed to update join request:', error);
        res.status(500).json({ error: 'Failed to update join request' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['USER_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.requestJoin.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Join request deleted successfully' });
    } catch (error) {
        console.error('Failed to delete join request:', error);
        res.status(500).json({ error: 'Failed to delete join request' });
    }
});

module.exports = router;