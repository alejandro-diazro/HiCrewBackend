/**
 * Minimal configuration from environment variables
 */

// Only include what's actually needed
module.exports = {
    // For callsign formatting
    icaoCode: process.env.ICAO_AIRLINE?.replace(/"/g, '') || 'HWC',

    // For emails
    email: {
        from: process.env.EMAIL_USER || 'noreply@example.com',
        name: process.env.EMAIL_NAME || 'Virtual Airline'
    },

    // JWT secret
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',

    // Frontend URL for CORS
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

    // Port
    port: parseInt(process.env.PORT) || 8000,

    // Helper function
    formatCallsign: function(number) {
        return `${this.icaoCode}${String(number).padStart(3, '0')}`;
    }
};