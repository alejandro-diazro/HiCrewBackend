const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    try {
        const permissions = await prisma.permission.findMany({
            select: {
                id: true,
                name: true,
                description: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(permissions);
    } catch (error) {
        console.error('Failed to fetch permissions:', error);
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

router.get('/:id/permissions', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    const { id } = req.params;

    try {
        const pilot = await prisma.pilot.findUnique({
            where: { id: parseInt(id) },
        });
        if (!pilot) {
            return res.status(404).json({ error: 'Pilot not found' });
        }

        // Fetch permissions for the pilot
        const permissions = await prisma.pilotPermission.findMany({
            where: { pilotId: parseInt(id) },
            select: {
                permission: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        });

        res.json(permissions.map(p => p.permission));
    } catch (error) {
        console.error('Failed to fetch pilot permissions:', error);
        res.status(500).json({ error: 'Failed to fetch pilot permissions' });
    }
});

router.post('/:id/permissions', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    const { id } = req.params;
    const { permissionIds } = req.body;

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
        return res.status(400).json({ error: 'permissionIds must be a non-empty array' });
    }

    try {
        const pilot = await prisma.pilot.findUnique({
            where: { id: parseInt(id) },
        });
        if (!pilot) {
            return res.status(404).json({ error: 'Pilot not found' });
        }

        const permissions = await prisma.permission.findMany({
            where: { id: { in: permissionIds.map(id => parseInt(id)) } },
        });
        if (permissions.length !== permissionIds.length) {
            return res.status(400).json({ error: 'One or more permission IDs are invalid' });
        }

        const data = permissionIds.map(permissionId => ({
            pilotId: parseInt(id),
            permissionId: parseInt(permissionId),
        }));

        await prisma.pilotPermission.createMany({
            data,
            skipDuplicates: true,
        });

        const updatedPermissions = await prisma.pilotPermission.findMany({
            where: { pilotId: parseInt(id) },
            select: {
                permission: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        });

        res.status(201).json({
            message: 'Permissions added successfully',
            permissions: updatedPermissions.map(p => p.permission),
        });
    } catch (error) {
        console.error('Failed to add permissions:', error);
        res.status(500).json({ error: 'Failed to add permissions' });
    }
});

router.delete('/:id/permissions', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
    const { id } = req.params;
    const { permissionIds } = req.body;

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
        return res.status(400).json({ error: 'permissionIds must be a non-empty array' });
    }

    try {
        const pilot = await prisma.pilot.findUnique({
            where: { id: parseInt(id) },
        });
        if (!pilot) {
            return res.status(404).json({ error: 'Pilot not found' });
        }

        await prisma.pilotPermission.deleteMany({
            where: {
                pilotId: parseInt(id),
                permissionId: { in: permissionIds.map(id => parseInt(id)) },
            },
        });

        const updatedPermissions = await prisma.pilotPermission.findMany({
            where: { pilotId: parseInt(id) },
            select: {
                permission: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        });

        res.json({
            message: 'Permissions removed successfully',
            permissions: updatedPermissions.map(p => p.permission),
        });
    } catch (error) {
        console.error('Failed to remove permissions:', error);
        res.status(500).json({ error: 'Failed to remove permissions' });
    }
});

module.exports = router;