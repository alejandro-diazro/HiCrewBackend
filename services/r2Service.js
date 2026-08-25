const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sharp = require('sharp');
require('dotenv').config();

// Configuración del cliente S3 para Cloudflare R2
const r2Client = new S3Client({
    region: 'auto',
    endpoint: 'https://b2f9dbec43ebb219e1c8208b02e460cc.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: false, // Cambiado a false para usar virtual-hosted-style
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'executive';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-41e2d12bf195431087858dbaf69eba65.r2.dev';

// Configuración de optimización de imágenes
const IMAGE_SIZES = {
    thumbnail: { width: 150, height: 150 },
    small: { width: 400, height: 300 },
    medium: { width: 800, height: 600 },
    large: { width: 1200, height: 900 },
    original: null // Sin redimensionar
};

// Tipos de archivo permitidos
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

class R2Service {
    /**
     * Subir archivo (imagen o PDF) con optimización opcional
     * @param {Object} file - Archivo de multer
     * @param {String} folder - Carpeta destino (aircraft, events, tours, pilots, documents)
     * @param {Object} options - Opciones de upload
     * @returns {Object} URLs de los archivos generados
     */
    async uploadFile(file, folder, options = {}) {
        try {
            const {
                generateThumbnail = true,
                optimize = true,
                customName = null
            } = options;

            // Validar tipo de archivo
            if (!ALLOWED_TYPES.includes(file.mimetype)) {
                throw new Error(`File type not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}`);
            }

            // Validar tamaño
            if (file.size > MAX_FILE_SIZE) {
                throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
            }

            const timestamp = Date.now();
            const baseName = customName || `${timestamp}-${Math.random().toString(36).substring(7)}`;
            const urls = {};
            const isPDF = file.mimetype === 'application/pdf';
            const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);

            // Si es PDF, subir directamente sin procesamiento
            if (isPDF) {
                const pdfKey = `${folder}/${baseName}.pdf`;
                await this.uploadToR2(file.buffer, pdfKey, file.mimetype);
                urls.original = `${PUBLIC_URL}/${pdfKey}`;
                
                return {
                    success: true,
                    type: 'document',
                    urls,
                    metadata: {
                        originalName: file.originalname,
                        size: file.size,
                        mimeType: file.mimetype,
                        uploadedAt: new Date().toISOString()
                    }
                };
            }

            // Procesar y subir imagen original
            let processedBuffer = file.buffer;
            
            if (optimize && isImage && file.mimetype !== 'image/gif') {
                // Optimizar imagen (convertir a webp si no es gif)
                processedBuffer = await sharp(file.buffer)
                    .webp({ quality: 85 })
                    .toBuffer();
                
                const originalKey = `${folder}/${baseName}.webp`;
                await this.uploadToR2(processedBuffer, originalKey, 'image/webp');
                urls.original = `${PUBLIC_URL}/${originalKey}`;
            } else {
                // Subir sin optimizar
                const extension = file.originalname.split('.').pop();
                const originalKey = `${folder}/${baseName}.${extension}`;
                await this.uploadToR2(file.buffer, originalKey, file.mimetype);
                urls.original = `${PUBLIC_URL}/${originalKey}`;
            }

            // Generar y subir thumbnail si se requiere
            if (generateThumbnail && file.mimetype !== 'image/gif') {
                const thumbnailBuffer = await sharp(file.buffer)
                    .resize(IMAGE_SIZES.thumbnail.width, IMAGE_SIZES.thumbnail.height, {
                        fit: 'cover',
                        position: 'center'
                    })
                    .webp({ quality: 80 })
                    .toBuffer();

                const thumbnailKey = `${folder}/thumbnails/${baseName}-thumb.webp`;
                await this.uploadToR2(thumbnailBuffer, thumbnailKey, 'image/webp');
                urls.thumbnail = `${PUBLIC_URL}/${thumbnailKey}`;
            }

            // Generar tamaño mediano para visualización en web
            if (optimize && file.mimetype !== 'image/gif') {
                const mediumBuffer = await sharp(file.buffer)
                    .resize(IMAGE_SIZES.medium.width, IMAGE_SIZES.medium.height, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .webp({ quality: 85 })
                    .toBuffer();

                const mediumKey = `${folder}/medium/${baseName}-medium.webp`;
                await this.uploadToR2(mediumBuffer, mediumKey, 'image/webp');
                urls.medium = `${PUBLIC_URL}/${mediumKey}`;
            }

            return {
                success: true,
                type: 'image',
                urls,
                metadata: {
                    originalName: file.originalname,
                    size: file.size,
                    mimeType: file.mimetype,
                    uploadedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('Error uploading to R2:', error);
            throw error;
        }
    }

    /**
     * Subir buffer a R2
     * @private
     */
    async uploadToR2(buffer, key, contentType) {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        });

        await r2Client.send(command);
    }

    /**
     * Eliminar archivo de R2
     * @param {String} key - Clave del archivo en R2
     */
    async deleteFile(key) {
        try {
            // Extraer la clave del URL si se proporciona URL completo
            if (key.startsWith('http')) {
                key = key.replace(`${PUBLIC_URL}/`, '');
            }

            const command = new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            });

            await r2Client.send(command);
            
            return { success: true, message: 'File deleted successfully' };
        } catch (error) {
            console.error('Error deleting from R2:', error);
            throw error;
        }
    }

    /**
     * Eliminar múltiples archivos relacionados (original, thumbnail, medium)
     * @param {String} baseUrl - URL de cualquier versión del archivo
     */
    async deleteRelatedFiles(baseUrl) {
        try {
            if (!baseUrl) return { success: false, message: 'No URL provided' };

            // Verificar si es una URL de R2
            if (!baseUrl.includes(PUBLIC_URL)) {
                return { success: false, message: 'Not an R2 URL' };
            }

            // Verificar que tenemos credenciales configuradas
            if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
                console.log('R2 credentials not configured, skipping delete');
                return { success: false, message: 'R2 not configured' };
            }

            // Extraer información del archivo
            const urlParts = baseUrl.replace(`${PUBLIC_URL}/`, '').split('/');
            const folder = urlParts[0];
            
            // Intentar eliminar todas las versiones posibles
            const deletions = [];
            
            // Buscar el nombre base del archivo
            const fileName = urlParts[urlParts.length - 1];
            const baseName = fileName.replace(/-thumb|-medium/, '').split('.')[0];

            // Intentar eliminar original
            deletions.push(this.deleteFile(`${folder}/${baseName}.webp`).catch(() => {}));
            deletions.push(this.deleteFile(`${folder}/${baseName}.jpg`).catch(() => {}));
            deletions.push(this.deleteFile(`${folder}/${baseName}.png`).catch(() => {}));
            
            // Intentar eliminar thumbnail
            deletions.push(this.deleteFile(`${folder}/thumbnails/${baseName}-thumb.webp`).catch(() => {}));
            
            // Intentar eliminar medium
            deletions.push(this.deleteFile(`${folder}/medium/${baseName}-medium.webp`).catch(() => {}));

            // Usar Promise.allSettled para que no falle si alguna promesa falla
            await Promise.allSettled(deletions);
            
            return { success: true, message: 'Delete operation completed' };
        } catch (error) {
            console.log('Non-critical error during file deletion:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generar URL firmado para descarga privada (si se necesita en el futuro)
     * @param {String} key - Clave del archivo
     * @param {Number} expiresIn - Tiempo de expiración en segundos
     */
    async getSignedUrl(key, expiresIn = 3600) {
        try {
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            });

            const url = await getSignedUrl(r2Client, command, { expiresIn });
            return url;
        } catch (error) {
            console.error('Error generating signed URL:', error);
            throw error;
        }
    }

    /**
     * Validar si un archivo existe en R2
     * @param {String} key - Clave del archivo
     */
    async fileExists(key) {
        try {
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            });

            await r2Client.send(command);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Alias para compatibilidad con código existente
     */
    async uploadImage(file, folder, options = {}) {
        return this.uploadFile(file, folder, options);
    }
}

module.exports = new R2Service();