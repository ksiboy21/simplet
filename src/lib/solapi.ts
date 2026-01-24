export const generateSignature = async (apiSecret: string, dateTime: string, salt: string) => {
    const encoder = new TextEncoder();
    const message = dateTime + salt;
    const keyData = encoder.encode(apiSecret);
    const messageData = encoder.encode(message);

    const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", key, messageData);

    // Convert ArrayBuffer to Hex string
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

export const sendSMS = async (to: string, text: string) => {
    const apiKey = import.meta.env.VITE_SOLAPI_API_KEY?.trim();
    const apiSecret = import.meta.env.VITE_SOLAPI_API_SECRET?.trim();

    if (!apiKey || !apiSecret) {
        throw new Error('Solapi API Key or Secret is missing in environment variables.');
    }

    if (apiSecret.includes('CHANGE_ME')) {
        throw new Error('Please update VITE_SOLAPI_API_SECRET in .env with your actual secret key.');
    }

    const date = new Date().toISOString().split('.')[0] + 'Z';
    // Use safer random generation than randomUUID for wider compatibility
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    const signature = await generateSignature(apiSecret, date, salt);

    const authHeader = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

    try {
        // Use absolute URL for direct call (requires strict CORS handling or proxy)
        // In static deployment, local proxy '/api/solapi' does not exist.
        // We attempt direct call. If CORS fails, a backend proxy is required.
        // Use proxy path to avoid CORS issues in browser
        // Local: Vite proxy handles '/api/solapi' -> 'https://api.solapi.com'
        // Production: Vercel rewrites should handle this
        const apiUrl = '/api/solapi/messages/v4/send';

        // console.log("Sending SMS to:", to, "using Key:", apiKey ? apiKey.slice(0, 4) + '***' : 'MISSING');

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: {
                    to,
                    from: import.meta.env.VITE_SOLAPI_SENDER_NUMBER || '01000000000',
                    text,
                },
                agent: {
                    sdkVersion: 'js/4.0.0',
                    osPlatform: 'browser',
                }
            }),
        });

        // console.log("Response Status:", response.status, response.statusText);

        if (!response.ok) {
            let errorMsg = 'Failed to send SMS';
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || JSON.stringify(errorData);
                console.error('Solapi API Error (JSON):', errorData);
            } catch (e) {
                const errorText = await response.text();
                errorMsg = `API Error (Text): ${errorText}`;
                console.error('Solapi API Error (Raw):', errorText);
            }
            throw new Error(errorMsg);
        }

        const result = await response.json();
        // console.log("Solapi Success Result:", result);
        return result;
    } catch (error) {
        console.error('Send SMS Error:', error);
        throw error;
    }
};
