const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

// Get rules for a specific language with fallback to English
router.get('/:lang', async (req, res) => {
    const { lang } = req.params;

    if (lang.length > 4) {
        return res.status(400).json({ error: 'lang must be 4 characters or less' });
    }

    try {
        // First try to get rules in requested language
        let rules = await prisma.rules.findFirst({
            where: { 
                lang,
                isActive: true 
            },
            select: {
                id: true,
                lang: true,
                title: true,
                text: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        // If not found, fallback to English
        if (!rules && lang !== 'en') {
            rules = await prisma.rules.findFirst({
                where: { 
                    lang: 'en',
                    isActive: true 
                },
                select: {
                    id: true,
                    lang: true,
                    title: true,
                    text: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
        }

        if (!rules) {
            return res.json({ 
                lang: lang,
                title: 'Rules',
                text: '# Rules\n\nNo rules have been defined yet.',
                isFallback: true
            });
        }

        res.json({
            ...rules,
            isFallback: rules.lang !== lang
        });
    } catch (error) {
        console.error('Failed to fetch rules by language:', error);
        res.status(500).json({ error: 'Failed to fetch rules by language' });
    }
});

// Get all rules (admin)
router.get('/', authenticate, checkPermissions(['RULE_ADMIN']), async (req, res) => {
    try {
        const rules = await prisma.rules.findMany({
            select: {
                id: true,
                lang: true,
                title: true,
                text: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                lang: 'asc'
            }
        });
        res.json(rules);
    } catch (error) {
        console.error('Failed to fetch rules:', error);
        res.status(500).json({ error: 'Failed to fetch rules' });
    }
});

// Create or update rules for a language
router.put('/:lang', authenticate, checkPermissions(['RULE_ADMIN']), async (req, res) => {
    const { lang } = req.params;
    const { title, text, isActive } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'text is required' });
    }
    if (lang.length > 4) {
        return res.status(400).json({ error: 'lang must be 4 characters or less' });
    }
    // Remove old character limit - TEXT type supports up to 65,535 characters
    if (text.length > 65535) {
        return res.status(400).json({ error: 'text must be 65,535 characters or less' });
    }

    try {
        // Use upsert to create or update
        const rule = await prisma.rules.upsert({
            where: { 
                lang_title: {
                    lang,
                    title: title || 'Rules'
                }
            },
            update: {
                title: title || 'Rules',
                text,
                isActive: isActive !== undefined ? isActive : true,
            },
            create: {
                lang,
                title: title || 'Rules',
                text,
                isActive: isActive !== undefined ? isActive : true,
            },
            select: {
                id: true,
                lang: true,
                title: true,
                text: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Rules saved successfully', rule });
    } catch (error) {
        console.error('Failed to save rules:', error);
        res.status(500).json({ error: 'Failed to save rules' });
    }
});

// Toggle active status
router.patch('/:lang/toggle-active', authenticate, checkPermissions(['RULE_ADMIN']), async (req, res) => {
    const { lang } = req.params;

    try {
        const current = await prisma.rules.findUnique({
            where: { lang },
            select: { isActive: true }
        });

        if (!current) {
            return res.status(404).json({ error: 'Rules not found for this language' });
        }

        const rule = await prisma.rules.update({
            where: { lang },
            data: {
                isActive: !current.isActive
            },
            select: {
                id: true,
                lang: true,
                title: true,
                isActive: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Rules status updated successfully', rule });
    } catch (error) {
        console.error('Failed to toggle rules status:', error);
        res.status(500).json({ error: 'Failed to toggle rules status' });
    }
});

// Delete rules for a language
router.delete('/:lang', authenticate, checkPermissions(['RULE_ADMIN']), async (req, res) => {
    const { lang } = req.params;

    // Prevent deleting English rules (fallback)
    if (lang === 'en') {
        return res.status(400).json({ error: 'Cannot delete English rules (used as fallback)' });
    }

    try {
        await prisma.rules.delete({
            where: { lang },
        });
        res.json({ message: 'Rules deleted successfully' });
    } catch (error) {
        console.error('Failed to delete rules:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Rules not found for this language' });
        }
        res.status(500).json({ error: 'Failed to delete rules' });
    }
});

module.exports = router;