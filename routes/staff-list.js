const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    try {
        const staffList = await prisma.staffList.findMany({
            select: {
                id: true,
                pilotId: true,
                nameRolePosition: true,
                priority: true,
                createdAt: true,
                updatedAt: true,
                pilot: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        callsign: true,
                    },
                },
            },
            orderBy: {
                priority: 'asc',
            },
        });
        res.json(staffList);
    } catch (error) {
        console.error('Failed to fetch staff list:', error);
        res.status(500).json({ error: 'Failed to fetch staff list' });
    }
});

router.post('/', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    const { pilotId, nameRolePosition, priority } = req.body;

    if (!pilotId || !nameRolePosition || priority === undefined) {
        return res.status(400).json({ error: 'pilotId, nameRolePosition, and priority are required' });
    }

    if (!Number.isInteger(priority) || priority < 0) {
        return res.status(400).json({ error: 'priority must be a non-negative integer' });
    }

    try {
        const pilot = await prisma.pilot.findUnique({
            where: { id: pilotId },
        });
        if (!pilot) {
            return res.status(404).json({ error: 'Pilot not found' });
        }

        const staffEntry = await prisma.staffList.create({
            data: {
                pilotId,
                nameRolePosition,
                priority,
            },
            select: {
                id: true,
                pilotId: true,
                nameRolePosition: true,
                priority: true,
                createdAt: true,
                updatedAt: true,
                pilot: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        callsign: true,
                    },
                },
            },
        });

        res.status(201).json({ message: 'Staff entry created successfully', staffEntry });
    } catch (error) {
        console.error('Failed to create staff entry:', error);
        if (error.code === 'P2002' && error.meta?.target?.includes('pilotId')) {
            return res.status(400).json({ error: 'Staff entry already exists for this pilot' });
        }
        res.status(500).json({ error: 'Failed to create staff entry' });
    }
});

router.patch('/:id', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    const { id } = req.params;
    const { pilotId, nameRolePosition, priority } = req.body;

    if (!pilotId && !nameRolePosition && priority === undefined) {
        return res.status(400).json({ error: 'At least one field (pilotId, nameRolePosition, priority) is required' });
    }

    if (priority !== undefined && (!Number.isInteger(priority) || priority < 0)) {
        return res.status(400).json({ error: 'priority must be a non-negative integer' });
    }

    try {
        const existingStaff = await prisma.staffList.findUnique({
            where: { id: parseInt(id) },
        });
        if (!existingStaff) {
            return res.status(404).json({ error: 'Staff entry not found' });
        }

        if (pilotId) {
            const pilot = await prisma.pilot.findUnique({
                where: { id: pilotId },
            });
            if (!pilot) {
                return res.status(404).json({ error: 'Pilot not found' });
            }
        }

        const staffEntry = await prisma.staffList.update({
            where: { id: parseInt(id) },
            data: {
                ...(pilotId && { pilotId }),
                ...(nameRolePosition && { nameRolePosition }),
                ...(priority !== undefined && { priority }),
            },
            select: {
                id: true,
                pilotId: true,
                nameRolePosition: true,
                priority: true,
                createdAt: true,
                updatedAt: true,
                pilot: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        callsign: true,
                    },
                },
            },
        });

        res.json({ message: 'Staff entry updated successfully', staffEntry });
    } catch (error) {
        console.error('Failed to update staff entry:', error);
        if (error.code === 'P2002' && error.meta?.target?.includes('pilotId')) {
            return res.status(400).json({ error: 'Another staff entry already exists for this pilot' });
        }
        res.status(500).json({ error: 'Failed to update staff entry' });
    }
});

router.delete('/:id', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    const { id } = req.params;

    try {
        const existingStaff = await prisma.staffList.findUnique({
            where: { id: parseInt(id) },
        });
        if (!existingStaff) {
            return res.status(404).json({ error: 'Staff entry not found' });
        }

        await prisma.staffList.delete({
            where: { id: parseInt(id) },
        });

        res.json({ message: 'Staff entry deleted successfully' });
    } catch (error) {
        console.error('Failed to delete staff entry:', error);
        res.status(500).json({ error: 'Failed to delete staff entry' });
    }
});

module.exports = router;