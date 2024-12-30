// security.js
const SecurityLogger = {
    log(message) {
        console.log(`[Security] ${message}`);
    },
    
    warn(message) {
        console.warn(`[Security] ${message}`);
    },
    
    error(message) {
        console.error(`[Security] ${message}`);
    }
};