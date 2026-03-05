import CryptoJS from 'crypto-js';

// Get a secret key from environment variables or use a default fallback (Not recommended for production without ENV)
// Consider moving the real key to a secure Vercel environment variable
const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'simpleticket_secure_key_2026';
const ENC_PREFIX = 'ENC:';

export const encryptData = (text: string | undefined | null): string => {
    if (!text) return '';
    // If it's already encrypted, don't double encrypt
    if (text.startsWith(ENC_PREFIX)) return text;

    try {
        const encrypted = CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
        return `${ENC_PREFIX}${encrypted}`;
    } catch (error) {
        console.error('Encryption failed:', error);
        return text; // Fallback to plain text if error occurs
    }
};

export const decryptData = (text: string | undefined | null): string => {
    if (!text) return '';
    // Only decrypt if it has the prefix
    if (!text.startsWith(ENC_PREFIX)) return text;

    try {
        const actualEncryptedString = text.substring(ENC_PREFIX.length);
        const bytes = CryptoJS.AES.decrypt(actualEncryptedString, SECRET_KEY);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

        // In case decryption fails (e.g. wrong key), it returns empty string. Fallback to original
        if (!decryptedText) return text;

        return decryptedText;
    } catch (error) {
        console.error('Decryption failed:', error);
        return text; // Fallback to original text if error occurs
    }
};
