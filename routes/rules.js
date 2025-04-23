const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const rules = await prisma.rules.findMany({
            select: {
                id: true,
                lang: true,
                text: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(rules);
    } catch (error) {
        console.error('Failed to fetch rules:', error);
        res.status(500).json({ error: 'Failed to fetch rules' });
    }
});

router.get('/:lang', async (req, res) => {
    const { lang } = req.params;

    if (lang.length > 4) {
        return res.status(400).json({ error: 'lang must be 4 characters or less' });
    }

    try {
        const rules = await prisma.rules.findMany({
            where: { lang },
            select: {
                id: true,
                lang: true,
                text: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(rules);
    } catch (error) {
        console.error('Failed to fetch rules by language:', error);
        res.status(500).json({ error: 'Failed to fetch rules by language' });
    }
});

router.post('/', authenticate, checkPermissions(['RULE_ADMIN']), async (req, res) => {
    const { lang, text } = req.body;

    if (!lang || !text) {
        return res.status(400).json({ error: 'lang and text are required' });
    }
    if (lang.length > 4) {
        return res.status(400).json({ error: 'lang must be 4 characters or less' });
    }
    if (text.length > 1024) {
        return res.status(400).json({ error: 'text must be 1024 characters or less' });
    }

    try {
        const rule = await prisma.rules.create({
            data: {
                lang,
                text,
            },
            select: {
                id: true,
                lang: true,
                text: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Rule created successfully', rule });
    } catch (error) {
        console.error('Failed to create rule:', error);
        res.status(500).json({ error: 'Failed to create rule' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['RULE_ADMIN']), async (req, res) => {
    const { id } = req.params;
    const { lang, text } = req.body;

    if (!lang && !text) {
        return res.status(400).json({ error: 'At least one of lang or text is required' });
    }
    if (lang && lang.length > 4) {
        return res.status(400).json({ error: 'lang must be 4 characters or less' });
    }
    if (text && text.length > 1024) {
        return res.status(400).json({ error: 'text must be 1024 characters or less' });
    }

    try {
        const rule = await prisma.rules.update({
            where: { id: parseInt(id) },
            data: {
                lang: lang || undefined,
                text: text || undefined,
            },
            select: {
                id: true,
                lang: true,
                text: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Rule updated successfully', rule });
    } catch (error) {
        console.error('Failed to update rule:', error);
        res.status(500).json({ error: 'Failed to update rule' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['RULE_ADMIN']), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.rules.delete({
            where: { id: parseInt(id) },
        });
        res.json({ message: 'Rule deleted successfully' });
    } catch (error) {
        console.error('Failed to delete rule:', error);
        res.status(500).json({ error: 'Failed to delete rule' });
    }
});

module.exports = router;