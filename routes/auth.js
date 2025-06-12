const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const authenticate = require("../middleware/auth");
const checkPermissions = require("../middleware/permissions");
const router = express.Router();
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
    const { email, password, firstName, lastName, birthDate, callsign, ivaoId, vatsimId } = req.body;

    try {
        if (!email || !password || !firstName || !lastName || !birthDate) {
            return res.status(400).json({ error: 'All required fields must be provided' });
        }

        if (!ivaoId && !vatsimId) {
            return res.status(400).json({ error: 'At least one of IVAO VID or VATSIM VID must be provided' });
        }

        // Check ALLOW_PUBLIC and ALLOW_CREATE_ACCOUNT configurations
        const configs = await prisma.config.findMany({
            where: {
                name: { in: ['ALLOW_PUBLIC', 'ALLOW_CREATE_ACCOUNT'] },
            },
            select: { name: true, isActive: true },
        });

        const allowPublic = configs.find(c => c.name === 'ALLOW_PUBLIC')?.isActive || false;
        const allowCreateAccount = configs.find(c => c.name === 'ALLOW_CREATE_ACCOUNT')?.isActive || false;

        // Case 1: Both ALLOW_PUBLIC and ALLOW_CREATE_ACCOUNT are false
        if (!allowPublic && !allowCreateAccount) {
            return res.status(403).json({ error: 'Registration is currently disabled' });
        }

        // Case 2: Only ALLOW_CREATE_ACCOUNT is true (create RequestJoin)
        if (!allowPublic && allowCreateAccount) {
            const existingPilot = await prisma.pilot.findFirst({
                where: {
                    OR: [
                        { email },
                        { ivaoId: ivaoId || undefined },
                        { vatsimId: vatsimId || undefined },
                    ].filter(condition => condition[Object.keys(condition)[0]] !== undefined),
                },
            });
            if (existingPilot) {
                return res.status(400).json({ error: 'Email, IVAO VID, or VATSIM VID is already registered as a pilot' });
            }

            const existingRequest = await prisma.requestJoin.findFirst({
                where: {
                    OR: [
                        { email },
                        { id_ivao: ivaoId || undefined },
                        { id_vatsim: vatsimId || undefined },
                    ].filter(condition => condition[Object.keys(condition)[0]] !== undefined),
                },
            });
            if (existingRequest) {
                return res.status(400).json({ error: 'Email, IVAO VID, or VATSIM VID is already in a pending request' });
            }

            const requestJoin = await prisma.requestJoin.create({
                data: {
                    name: `${firstName} ${lastName}`,
                    id_ivao: ivaoId || null,
                    id_vatsim: vatsimId || null,
                    birthday: new Date(birthDate),
                    email,
                    status: 0, // Pending
                },
            });

            return res.status(201).json({ message: 'Registration request submitted successfully', requestJoin });
        }

        // Case 3: Both ALLOW_PUBLIC and ALLOW_CREATE_ACCOUNT are true (create Pilot)
        if (allowPublic && allowCreateAccount) {
            const existingPilot = await prisma.pilot.findFirst({
                where: {
                    OR: [
                        { email },
                        { ivaoId: ivaoId || undefined },
                        { vatsimId: vatsimId || undefined },
                    ].filter(condition => condition[Object.keys(condition)[0]] !== undefined),
                },
            });
            if (existingPilot) {
                return res.status(400).json({ error: 'Email, IVAO VID, or VATSIM VID is already registered' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const rank = await prisma.rank.findUnique({
                where: { id: 1 },
            });
            if (!rank) {
                return res.status(500).json({ error: 'Default rank (ID: 1) not found in the database' });
            }

            const pilot = await prisma.pilot.create({
                data: {
                    email,
                    password: hashedPassword,
                    firstName,
                    lastName,
                    birthDate: new Date(birthDate),
                    callsign,
                    ivaoId: ivaoId || null,
                    vatsimId: vatsimId || null,
                    rankId: 1,
                    points: 0,
                },
                include: {
                    pilotPermissions: {
                        include: {
                            permission: true,
                        },
                    },
                    rank: true,
                    location: true,
                },
            });

            const token = jwt.sign({ id: pilot.id, email: pilot.email }, process.env.JWT_SECRET, {
                expiresIn: '7d',
            });

            const pilotResponse = {
                ...pilot,
                permissions: pilot.pilotPermissions.map((pp) => pp.permission),
                pilotPermissions: undefined,
            };

            return res.status(201).json({ message: 'Register Success', pilot: pilotResponse, token });
        }

        return res.status(403).json({ error: 'Registration requires account creation to be enabled' });
    } catch (error) {
        console.error('Failed to process registration:', error);
        res.status(500).json({ error: 'Failed to process registration' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const pilot = await prisma.pilot.findUnique({
            where: { email },
            include: {
                pilotPermissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });
        if (!pilot || !pilot.password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, pilot.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: pilot.id, email: pilot.email }, process.env.JWT_SECRET, {
            expiresIn: '7d',
        });

        const pilotResponse = {
            ...pilot,
            permissions: pilot.pilotPermissions.map((pp) => pp.permission),
            pilotPermissions: undefined,
        };

        res.json({ message: 'Login success', pilot: pilotResponse, token });
    } catch (error) {
        console.error('Failed to login:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

router.get('/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token was provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const pilot = await prisma.pilot.findUnique({
            where: { id: decoded.id },
            include: {
                pilotPermissions: {
                    include: {
                        permission: true,
                    },
                },
                pilotAirline: {
                    select: {
                        airline: {
                            select: {
                                id: true,
                                name: true,
                                logo: true,
                                tail: true,
                                can_join: true,
                            },
                        },
                    },
                },
                pilotHub: {
                    select: {
                        hub: {
                            include: {
                                airline: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
                                airport: {
                                    select: {
                                        icao: true,
                                        name: true,
                                        country: true,
                                    },
                                },
                            },
                        },
                    },
                },
                pilotMedals: {
                    select: {
                        medal: {
                            select: {
                                id: true,
                                img: true,
                                text: true,
                                createdAt: true,
                                updatedAt: true,
                            },
                        },
                    },
                },
                rank: true,
            },
        });

        if (!pilot) {
            return res.status(404).json({ error: 'Pilot not found' });
        }

        const pilotResponse = {
            ...pilot,
            permissions: pilot.pilotPermissions.map((pp) => pp.permission),
            airline: pilot.pilotAirline?.airline || null,
            hub: pilot.pilotHub?.hub || null,
            medals: pilot.pilotMedals.map((pm) => pm.medal),
            pilotPermissions: undefined,
            pilotAirline: undefined,
            pilotHub: undefined,
            pilotMedals: undefined,
        };

        res.json({ pilot: pilotResponse });
    } catch (error) {
        console.error('Error getting data from the pilot:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

router.delete('/delete-me', authenticate, async (req, res) => {
    const userId = req.user.id;

    try {
        const pilot = await prisma.pilot.findUnique({
            where: { id: userId },
        });

        if (!pilot) {
            return res.status(404).json({ error: 'Pilot not found' });
        }

        await prisma.pilot.delete({
            where: { id: userId },
        });

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Failed to delete account:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

router.delete('/delete/:pilotId', authenticate, checkPermissions(['USER_MANAGER']), async (req, res) => {
    const { pilotId } = req.params;

    if (!Number.isInteger(parseInt(pilotId))) {
        return res.status(400).json({ error: 'pilotId must be an integer' });
    }

    try {
        const pilot = await prisma.pilot.findUnique({
            where: { id: parseInt(pilotId) },
        });

        if (!pilot) {
            return res.status(404).json({ error: 'Pilot not found' });
        }

        await prisma.pilot.delete({
            where: { id: parseInt(pilotId) },
        });

        res.json({ message: 'Pilot account deleted successfully' });
    } catch (error) {
        console.error('Failed to delete pilot account:', error);
        res.status(500).json({ error: 'Failed to delete pilot account' });
    }
});


module.exports = router;