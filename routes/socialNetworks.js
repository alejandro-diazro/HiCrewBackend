const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const socialNetworks = await prisma.socialNetwork.findMany({
            select: {
                id: true,
                icon: true,
                url: true,
                name: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(socialNetworks);
    } catch (error) {
        console.error('Failed to fetch social networks:', error);
        res.status(500).json({ error: 'Failed to fetch social networks' });
    }
});

router.post('/', authenticate, checkPermissions(['SOCIAL_MANAGER']), async (req, res) => {
    const { icon, url, name } = req.body;

    if (!icon || !url || !name) {
        return res.status(400).json({ error: 'icon, url, and name are required' });
    }
    if (icon.length > 255) {
        return res.status(400).json({ error: 'icon must be 255 characters or less' });
    }
    if (url.length > 255) {
        return res.status(400).json({ error: 'url must be 255 characters or less' });
    }
    if (name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }

    try {
        const socialNetwork = await prisma.socialNetwork.create({
            data: {
                icon,
                url,
                name,
            },
            select: {
                id: true,
                icon: true,
                url: true,
                name: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Social network created successfully', socialNetwork });
    } catch (error) {
        console.error('Failed to create social network:', error);
        res.status(500).json({ error: 'Failed to create social network' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['SOCIAL_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { icon, url, name } = req.body;

    if (!icon && !url && !name) {
        return res.status(400).json({ error: 'At least one of icon, url, or name is required' });
    }
    if (icon && icon.length > 255) {
        return res.status(400).json({ error: 'icon must be 255 characters or less' });
    }
    if (url && url.length > 255) {
        return res.status(400).json({ error: 'url must be 255 characters or less' });
    }
    if (name && name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }

    try {
        const socialNetwork = await prisma.socialNetwork.update({
            where: { id: parseInt(id) },
            data: {
                icon: icon || undefined,
                url: url || undefined,
                name: name || undefined,
            },
            select: {
                id: true,
                icon: true,
                url: true,
                name: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Social network updated successfully', socialNetwork });
    } catch (error) {
        console.error('Failed to update social network:', error);
        res.status(500).json({ error: 'Failed to update social network' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['SOCIAL_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.socialNetwork.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Social network deleted successfully' });
    } catch (error) {
        console.error('Failed to delete social network:', error);
        res.status(500).json({ error: 'Failed to delete social network' });
    }
});

module.exports = router;