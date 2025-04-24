const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const documents = await prisma.documentation.findMany({
            where: { isPublic: true },
            select: {
                id: true,
                url: true,
                name: true,
                isPublic: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(documents);
    } catch (error) {
        console.error('Failed to fetch public documents:', error);
        res.status(500).json({ error: 'Failed to fetch public documents' });
    }
});

router.get('/all', authenticate, async (req, res) => {
    try {
        const documents = await prisma.documentation.findMany({
            select: {
                id: true,
                url: true,
                name: true,
                isPublic: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(documents);
    } catch (error) {
        console.error('Failed to fetch all documents:', error);
        res.status(500).json({ error: 'Failed to fetch all documents' });
    }
});

router.post('/', authenticate, checkPermissions(['DOC_MANAGER']), async (req, res) => {
    const { url, name, isPublic } = req.body;

    if (!url || !name) {
        return res.status(400).json({ error: 'url and name are required' });
    }
    if (url.length > 255) {
        return res.status(400).json({ error: 'url must be 255 characters or less' });
    }
    if (name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (isPublic !== undefined && typeof isPublic !== 'boolean') {
        return res.status(400).json({ error: 'isPublic must be a boolean' });
    }

    try {
        const document = await prisma.documentation.create({
            data: {
                url,
                name,
                isPublic: isPublic ?? false,
            },
            select: {
                id: true,
                url: true,
                name: true,
                isPublic: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Document created successfully', document });
    } catch (error) {
        console.error('Failed to create document:', error);
        res.status(500).json({ error: 'Failed to create document' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['DOC_MANAGER']), async (req, res) => {
    const { id } = req.params;
    const { url, name, isPublic } = req.body;

    // Basic validation
    if (!url && !name && isPublic === undefined) {
        return res.status(400).json({ error: 'At least one of url, name, or isPublic is required' });
    }
    if (url && url.length > 255) {
        return res.status(400).json({ error: 'url must be 255 characters or less' });
    }
    if (name && name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (isPublic !== undefined && typeof isPublic !== 'boolean') {
        return res.status(400).json({ error: 'isPublic must be a boolean' });
    }

    try {
        const document = await prisma.documentation.update({
            where: { id: parseInt(id) },
            data: {
                url: url || undefined,
                name: name || undefined,
                isPublic: isPublic !== undefined ? isPublic : undefined,
            },
            select: {
                id: true,
                url: true,
                name: true,
                isPublic: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Document updated successfully', document });
    } catch (error) {
        console.error('Failed to update document:', error);
        res.status(500).json({ error: 'Failed to update document' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['DOC_MANAGER']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.documentation.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Failed to delete document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

module.exports = router;