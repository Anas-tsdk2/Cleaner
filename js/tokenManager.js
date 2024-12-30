// tokenManager.js
const TokenManager = {
    store(bearerToken) {
        if (!bearerToken) {
            console.warn('Token vide');
            return false;
        }
        sessionStorage.setItem('bearerToken', bearerToken);
        return true;
    },

    get() {
        return sessionStorage.getItem('bearerToken');
    },

    clear() {
        sessionStorage.removeItem('bearerToken');
    },

    isValid() {
        return this.get() !== null;
    }
};