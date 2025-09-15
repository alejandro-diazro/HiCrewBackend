const multer = require('multer');

// Configuración de multer para almacenar en memoria
const storage = multer.memoryStorage();

// Filtro de archivos
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 
        'image/jpg', 
        'image/png', 
        'image/webp', 
        'image/gif',
        'application/pdf'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
    }
};

// Configuración de multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 5 // Máximo 5 archivos por request
    }
});

// Middleware para manejar errores de multer
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                error: 'File size too large. Maximum size is 10MB' 
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ 
                error: 'Too many files. Maximum is 5 files per upload' 
            });
        }
        return res.status(400).json({ 
            error: `Upload error: ${err.message}` 
        });
    } else if (err) {
        return res.status(400).json({ 
            error: err.message 
        });
    }
    next();
};

module.exports = {
    uploadSingle: upload.single('file'), // Un solo archivo con campo 'file'
    uploadMultiple: upload.array('images', 5),
    uploadFields: upload.fields([
        { name: 'main', maxCount: 1 },
        { name: 'gallery', maxCount: 10 }
    ]),
    handleUploadError
};