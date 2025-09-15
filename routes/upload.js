const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const r2Service = require('../services/r2Service');
const { uploadSingle, uploadMultiple, handleUploadError } = require('../middleware/uploadMiddleware');
const authenticate = require('../middleware/auth');
const checkPermission = require('../middleware/permissions');

const prisma = new PrismaClient();

/**
 * Upload single image
 * POST /upload/single
 * Body: multipart/form-data with 'image' field
 * Query params: folder (aircraft, events, tours, pilots)
 */
router.post('/single', 
    authenticate,
    checkPermission(['ADMIN', 'DOC_MANAGER']),
    uploadSingle,
    handleUploadError,
    async (req, res) => {
        try {
            // upload.any() almacena archivos en req.files
            const file = req.files && req.files[0] ? req.files[0] : req.file;
            
            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const folder = req.query.folder || 'general';
            const allowedFolders = ['aircraft', 'events', 'tours', 'pilots', 'liveries', 'general', 'documents'];
            
            if (!allowedFolders.includes(folder)) {
                return res.status(400).json({ 
                    error: `Invalid folder. Allowed folders: ${allowedFolders.join(', ')}` 
                });
            }

            // Para PDFs, no optimizar ni generar thumbnails
            const isPDF = file.mimetype === 'application/pdf';
            const result = await r2Service.uploadImage(file, folder, {
                generateThumbnail: !isPDF,
                optimize: !isPDF,
                customName: req.body.customName || null
            });

            res.json(result);
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ 
                error: 'Failed to upload file', 
                details: error.message 
            });
        }
    }
);

/**
 * Upload multiple images
 * POST /upload/multiple
 * Body: multipart/form-data with 'images' field (max 5)
 * Query params: folder
 */
router.post('/multiple',
    authenticate,
    checkPermission(['ADMIN']),
    uploadMultiple,
    handleUploadError,
    async (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'No files uploaded' });
            }

            const folder = req.query.folder || 'general';
            const allowedFolders = ['aircraft', 'events', 'tours', 'pilots', 'liveries', 'general'];
            
            if (!allowedFolders.includes(folder)) {
                return res.status(400).json({ 
                    error: `Invalid folder. Allowed folders: ${allowedFolders.join(', ')}` 
                });
            }

            const uploadPromises = req.files.map(file => 
                r2Service.uploadImage(file, folder, {
                    generateThumbnail: true,
                    optimize: true
                })
            );

            const results = await Promise.all(uploadPromises);

            res.json({
                success: true,
                count: results.length,
                files: results
            });
        } catch (error) {
            console.error('Multiple upload error:', error);
            res.status(500).json({ 
                error: 'Failed to upload images', 
                details: error.message 
            });
        }
    }
);

/**
 * Delete image and its variants
 * DELETE /upload/delete
 * Body: { url: "image_url" }
 */
router.delete('/delete',
    authenticate,
    checkPermission(['ADMIN']),
    async (req, res) => {
        try {
            const { url } = req.body;
            
            if (!url) {
                return res.status(400).json({ error: 'URL is required' });
            }

            const result = await r2Service.deleteRelatedFiles(url);
            res.json(result);
        } catch (error) {
            console.error('Delete error:', error);
            res.status(500).json({ 
                error: 'Failed to delete image', 
                details: error.message 
            });
        }
    }
);

/**
 * Upload aircraft image specifically
 * POST /upload/aircraft/:aircraftId
 */
router.post('/aircraft/:aircraftId',
    authenticate,
    checkPermission(['ADMIN']),
    uploadSingle,
    handleUploadError,
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { aircraftId } = req.params;

            // Verificar que el aircraft existe
            const aircraft = await prisma.aircraft.findUnique({
                where: { id: parseInt(aircraftId) }
            });

            if (!aircraft) {
                return res.status(404).json({ error: 'Aircraft not found' });
            }

            // Si ya tiene imagen, intentar eliminar la anterior (solo si es de R2)
            if (aircraft.img && aircraft.img.includes(process.env.R2_PUBLIC_URL)) {
                await r2Service.deleteRelatedFiles(aircraft.img).catch(err => {
                    console.log('Could not delete previous image:', err.message);
                });
            }

            // Subir nueva imagen
            const result = await r2Service.uploadImage(req.file, 'aircraft', {
                generateThumbnail: true,
                optimize: true,
                customName: `aircraft-${aircraftId}`
            });

            // Actualizar en base de datos
            await prisma.aircraft.update({
                where: { id: parseInt(aircraftId) },
                data: { 
                    img: result.urls.medium || result.urls.original 
                }
            });

            res.json({
                success: true,
                message: 'Aircraft image updated successfully',
                ...result
            });
        } catch (error) {
            console.error('Aircraft upload error:', error);
            res.status(500).json({ 
                error: 'Failed to upload aircraft image', 
                details: error.message 
            });
        }
    }
);

/**
 * Upload event banner
 * POST /upload/event/:eventId
 */
router.post('/event/:eventId',
    authenticate,
    checkPermission(['EVENT_MANAGER']),
    uploadSingle,
    handleUploadError,
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { eventId } = req.params;

            // Verificar que el evento existe
            const event = await prisma.event.findUnique({
                where: { id: parseInt(eventId) }
            });

            if (!event) {
                return res.status(404).json({ error: 'Event not found' });
            }

            // Si ya tiene imagen, intentar eliminar la anterior (solo si es de R2)
            if (event.img && event.img.includes(process.env.R2_PUBLIC_URL)) {
                await r2Service.deleteRelatedFiles(event.img).catch(err => {
                    console.log('Could not delete previous image:', err.message);
                });
            }

            // Subir nueva imagen
            const result = await r2Service.uploadImage(req.file, 'events', {
                generateThumbnail: true,
                optimize: true,
                customName: `event-${eventId}`
            });

            // Actualizar en base de datos
            await prisma.event.update({
                where: { id: parseInt(eventId) },
                data: { 
                    img: result.urls.medium || result.urls.original 
                }
            });

            res.json({
                success: true,
                message: 'Event banner updated successfully',
                ...result
            });
        } catch (error) {
            console.error('Event upload error:', error);
            res.status(500).json({ 
                error: 'Failed to upload event banner', 
                details: error.message 
            });
        }
    }
);

/**
 * Upload tour image
 * POST /upload/tour/:tourId
 */
router.post('/tour/:tourId',
    authenticate,
    checkPermission(['TOUR_MANAGER']),
    uploadSingle,
    handleUploadError,
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { tourId } = req.params;

            // Verificar que el tour existe
            const tour = await prisma.tour.findUnique({
                where: { id: parseInt(tourId) }
            });

            if (!tour) {
                return res.status(404).json({ error: 'Tour not found' });
            }

            // Si ya tiene imagen, intentar eliminar la anterior (solo si es de R2)
            if (tour.img && tour.img.includes(process.env.R2_PUBLIC_URL)) {
                await r2Service.deleteRelatedFiles(tour.img).catch(err => {
                    console.log('Could not delete previous image:', err.message);
                });
            }

            // Subir nueva imagen
            const result = await r2Service.uploadImage(req.file, 'tours', {
                generateThumbnail: true,
                optimize: true,
                customName: `tour-${tourId}`
            });

            // Actualizar en base de datos
            await prisma.tour.update({
                where: { id: parseInt(tourId) },
                data: { 
                    img: result.urls.medium || result.urls.original 
                }
            });

            res.json({
                success: true,
                message: 'Tour image updated successfully',
                ...result
            });
        } catch (error) {
            console.error('Tour upload error:', error);
            res.status(500).json({ 
                error: 'Failed to upload tour image', 
                details: error.message 
            });
        }
    }
);

/**
 * Upload document PDF
 * POST /upload/document
 * Body: multipart/form-data with 'file' field
 * Returns URL for document
 */
router.post('/document',
    authenticate,
    checkPermission(['ADMIN', 'DOC_MANAGER']),
    uploadSingle,
    handleUploadError,
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            // Verificar que es un PDF
            if (req.file.mimetype !== 'application/pdf') {
                return res.status(400).json({ error: 'Only PDF files are allowed for documents' });
            }

            // Subir el PDF sin optimización de imagen
            const result = await r2Service.uploadImage(req.file, 'documents', {
                generateThumbnail: false,
                optimize: false,
                customName: req.body.customName || null
            });

            res.json({
                success: true,
                message: 'Document uploaded successfully',
                ...result
            });
        } catch (error) {
            console.error('Document upload error:', error);
            res.status(500).json({ 
                error: 'Failed to upload document', 
                details: error.message 
            });
        }
    }
);

/**
 * Upload pilot avatar
 * POST /upload/pilot/:pilotId
 * Can be used by the pilot themselves or ADMIN/USER_MANAGER
 */
router.post('/pilot/:pilotId',
    authenticate,
    uploadSingle,
    handleUploadError,
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { pilotId } = req.params;
            
            // Verificar permisos: puede ser el mismo piloto o un admin
            const requestingPilotId = req.user.pilot_id;
            const isOwnProfile = parseInt(pilotId) === requestingPilotId;
            
            if (!isOwnProfile) {
                // Verificar si tiene permisos de admin
                const hasPermission = await prisma.pilotPermissions.findFirst({
                    where: {
                        pilot_id: requestingPilotId,
                        permission: {
                            name: { in: ['ADMIN', 'USER_MANAGER'] }
                        }
                    }
                });

                if (!hasPermission) {
                    return res.status(403).json({ 
                        error: 'You can only upload your own avatar or need ADMIN/USER_MANAGER permission' 
                    });
                }
            }

            // Verificar que el piloto existe
            const pilot = await prisma.pilot.findUnique({
                where: { id: parseInt(pilotId) }
            });

            if (!pilot) {
                return res.status(404).json({ error: 'Pilot not found' });
            }

            // Si ya tiene avatar, intentar eliminar el anterior (solo si es de R2)
            if (pilot.avatar && pilot.avatar.includes(process.env.R2_PUBLIC_URL)) {
                await r2Service.deleteRelatedFiles(pilot.avatar).catch(err => {
                    console.log('Could not delete previous avatar:', err.message);
                });
            }

            // Subir nueva imagen
            const result = await r2Service.uploadImage(req.file, 'pilots', {
                generateThumbnail: true,
                optimize: true,
                customName: `pilot-${pilotId}-avatar`
            });

            // Actualizar en base de datos
            await prisma.pilot.update({
                where: { id: parseInt(pilotId) },
                data: { 
                    avatar: result.urls.thumbnail || result.urls.original 
                }
            });

            res.json({
                success: true,
                message: 'Avatar updated successfully',
                ...result
            });
        } catch (error) {
            console.error('Pilot avatar upload error:', error);
            res.status(500).json({ 
                error: 'Failed to upload avatar', 
                details: error.message 
            });
        }
    }
);

module.exports = router;