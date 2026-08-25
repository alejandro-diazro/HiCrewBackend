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
            orderBy: {
                id: 'desc',
            },
        });
        res.json(requests);
    } catch (error) {
        console.error('Failed to fetch join requests:', error);
        res.status(500).json({ error: 'Failed to fetch join requests' });
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
        const result = await prisma.$transaction(async (prisma) => {
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
                    password: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            if (status === 1) {
                const existingPilot = await prisma.pilot.findFirst({
                    where: {
                        OR: [
                            { email: request.email },
                            { ivaoId: request.id_ivao || undefined },
                            { vatsimId: request.id_vatsim || undefined },
                        ].filter(condition => condition[Object.keys(condition)[0]] !== undefined),
                    },
                });

                if (existingPilot) {
                    throw new Error('A pilot with this email, IVAO VID, or VATSIM VID already exists');
                }

                const [firstName, ...lastNameParts] = request.name.split(' ');
                const lastName = lastNameParts.join(' ') || 'Unknown';

                const defaultRank = await prisma.rank.findFirst({
                    where: { name: 'Cadet' },
                }) || await prisma.rank.findFirst({
                    orderBy: { id: 'asc' },
                });

                if (!defaultRank) {
                    throw new Error('No default rank available. Please create ranks first.');
                }

                const pilot = await prisma.pilot.create({
                    data: {
                        email: request.email,
                        ivaoId: request.id_ivao,
                        vatsimId: request.id_vatsim,
                        firstName,
                        lastName,
                        birthDate: request.birthday,
                        callsign: null,
                        password: request.password,
                        rank: {
                            connect: { id: defaultRank.id }
                        },
                        hours: 0,
                    },
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        rank: true,
                        createdAt: true,
                    },
                });

                // Auto-assign airline if there's only one
                const airlines = await prisma.airline.findMany({
                    where: { can_join: true }
                });

                if (airlines.length === 1) {
                    await prisma.pilotAirline.create({
                        data: {
                            pilotId: pilot.id,
                            airlineId: airlines[0].id
                        }
                    });
                }

                // Delete the RequestJoin after successful approval
                await prisma.requestJoin.delete({
                    where: { id: request.id }
                });

                return { pilot };
            }

            return { request };
        });

        res.json({
            message: status === 1 
                ? 'Join request approved and pilot created successfully' 
                : 'Join request updated successfully',
            ...(result.request && { request: result.request }),
            ...(result.pilot && { pilot: result.pilot }),
        });
    } catch (error) {
        console.error('Failed to update join request:', error);
        if (error.message.includes('A pilot with this email')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to update join request' });
    }
});

module.exports = router;