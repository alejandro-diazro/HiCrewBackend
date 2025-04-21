const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
    const { email, password, firstName, lastName, birthDate, callsign, ivaoId, vatsimId } = req.body;

    try {
        const existingPilot = await prisma.pilot.findFirst({
            where: {
                OR: [{ email }, { ivaoId }, { vatsimId }],
            },
        });
        if (existingPilot) {
            return res.status(400).json({ error: 'Email, IVAO VID or VATSIM VID is already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const pilot = await prisma.pilot.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                birthDate: birthDate ? new Date(birthDate) : null,
                callsign,
                ivaoId,
                vatsimId,
                rank: 'Cadet',
            },
            include: {
                pilotPermissions: {
                    include: {
                        permission: true,
                    },
                },
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

        res.status(201).json({ message: 'Register Success', pilot: pilotResponse, token });
    } catch (error) {
        console.error('Failed to register:', error);
        res.status(500).json({ error: 'Failed to register' });
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

module.exports = router;