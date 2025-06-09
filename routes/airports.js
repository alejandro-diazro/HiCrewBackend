const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
    try {
        const airports = await prisma.airport.findMany({
            select: {
                icao: true,
                iata: true,
                name: true,
                country: true,
                latitude: true,
                longitude: true,
                altitude: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json(airports);
    } catch (error) {
        console.error('Failed to fetch airports:', error);
        res.status(500).json({ error: 'Failed to fetch airports' });
    }
});

router.post('/', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { icao, iata, name, country, latitude, longitude, altitude } = req.body;

    if (!icao || !name || !country || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'icao, name, country, latitude, longitude are required' });
    }
    if (icao.length !== 4) {
        return res.status(400).json({ error: 'icao must be exactly 4 characters' });
    }
    if (iata !== null && iata !== undefined && iata.length !== 3) {
        return res.status(400).json({ error: 'iata must be exactly 3 characters or null' });
    }
    if (name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (country.length > 100) {
        return res.status(400).json({ error: 'country must be 100 characters or less' });
    }
    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
        return res.status(400).json({ error: 'latitude must be a number between -90 and 90' });
    }
    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: 'longitude must be a number between -180 and 180' });
    }
    if (altitude !== null && altitude !== undefined && !Number.isInteger(altitude)) {
        return res.status(400).json({ error: 'altitude must be an integer or null' });
    }

    try {
        const airport = await prisma.airport.create({
            data: {
                icao,
                iata: iata ?? null,
                name,
                country,
                latitude,
                longitude,
                altitude: altitude ?? null,
            },
            select: {
                icao: true,
                iata: true,
                name: true,
                country: true,
                latitude: true,
                longitude: true,
                altitude: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ message: 'Airport created successfully', airport });
    } catch (error) {
        console.error('Failed to create airport:', error);
        res.status(500).json({ error: 'Failed to create airport' });
    }
});

router.patch('/:icao', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { icao } = req.params;
    const { iata, name, country, latitude, longitude, altitude } = req.body;

    if (!iata && !name && !country && latitude === undefined && longitude === undefined && altitude === undefined) {
        return res.status(400).json({ error: 'At least one of iata, name, country, latitude, longitude, or altitude is required' });
    }
    if (iata !== undefined && iata !== null && iata.length !== 3) {
        return res.status(400).json({ error: 'iata must be exactly 3 characters or null' });
    }
    if (name && name.length > 100) {
        return res.status(400).json({ error: 'name must be 100 characters or less' });
    }
    if (country && country.length > 100) {
        return res.status(400).json({ error: 'country must be 100 characters or less' });
    }
    if (latitude !== undefined && (typeof latitude !== 'number' || latitude < -90 || latitude > 90)) {
        return res.status(400).json({ error: 'latitude must be a number between -90 and 90' });
    }
    if (longitude !== undefined && (typeof longitude !== 'number' || longitude < -180 || longitude > 180)) {
        return res.status(400).json({ error: 'longitude must be a number between -180 and 180' });
    }
    if (altitude !== undefined && altitude !== null && !Number.isInteger(altitude)) {
        return res.status(400).json({ error: 'altitude must be an integer or null' });
    }

    try {
        const airport = await prisma.airport.update({
            where: { icao },
            data: {
                iata: iata !== undefined ? iata : undefined,
                name: name || undefined,
                country: country || undefined,
                latitude: latitude !== undefined ? latitude : undefined,
                longitude: longitude !== undefined ? longitude : undefined,
                altitude: altitude !== undefined ? altitude : undefined,
            },
            select: {
                icao: true,
                iata: true,
                name: true,
                country: true,
                latitude: true,
                longitude: true,
                altitude: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ message: 'Airport updated successfully', airport });
    } catch (error) {
        console.error('Failed to update airport:', error);
        res.status(500).json({ error: 'Failed to update airport' });
    }
});

router.delete('/:icao', authenticate, checkPermissions(['OPERATIONS_MANAGER']), async (req, res) => {
    const { icao } = req.params;

    try {
        await prisma.airport.delete({
            where: { icao },
        });
        res.json({ message: 'Airport deleted successfully' });
    } catch (error) {
        console.error('Failed to delete airport:', error);
        res.status(500).json({ error: 'Failed to delete airport' });
    }
});

module.exports = router;