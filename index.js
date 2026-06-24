const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

// 1. START EXPRESS SERVER (Required for Render Free Tier uptime)
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('WhatsApp Cloud Forwarder Engine is Active.'));
app.listen(PORT, () => console.log(`[Cloud Engine] Monitoring port ${PORT}`));

// 2. CONFIGURATION VARIABLES
// IMPORTANT: Put your phone number here starting with country code, NO plus sign (+) or spaces.
// Example: If your number is +91 98765 43210, write: '919876543210'
const MY_PHONE_NUMBER = '91 8589822129'; 

const SOURCE_GROUP = '120363428389082831@g.us'; 
const TARGET_GROUP = '120363424960811886@g.us@g.us'; 

async function startForwarder() {
    const { state, saveCreds } = await useMultiFileAuthState('render_auth_session');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Disables the broken log QR code entirely
        browser: Browsers.macOS('Chrome') // Simulates a desktop browser layout (Required for pairing keys)
    });

    sock.ev.on('creds.update', saveCreds);

    // 3. GENERATE TEXT PAIRING CODE IF NOT SECURELY CONNECTED
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                console.log(`\n===========================================================`);
                console.log(`⏳ [Pairing Request] Requesting code for: +${MY_PHONE_NUMBER}...`);
                console.log(`===========================================================\n`);
                
                const pairingCode = await sock.requestPairingCode(MY_PHONE_NUMBER);
                
                console.log(`\n===========================================================`);
                console.log(`🔑 YOUR WHATSAPP LINKING CODE: ${pairingCode}`);
                console.log(`===========================================================`);
                console.log(`👉 HOW TO USE IT ON YOUR PHONE:`);
                console.log(`1. Open WhatsApp -> Tap 3 Dots Menu -> Linked Devices`);
                console.log(`2. Tap "Link a Device"`);
                console.log(`3. Tap "Link with phone number instead" at the bottom screen`);
                console.log(`4. Enter the 8-character code shown above!`);
                console.log(`===========================================================\n`);
            } catch (err) {
                console.error('[Error] Failed to generate alphanumeric code:', err);
            }
        }, 5000); // Wait 5 seconds for backend systems to fully clear before requesting code
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[System] Session dropped. Reconnecting automatically:', shouldReconnect);
            if (shouldReconnect) startForwarder();
        } else if (connection === 'open') {
            console.log('\n===========================================================');
            console.log('🎉 SUCCESS: Cloud Forwarder is officially linked to WhatsApp!');
            console.log('===========================================================\n');
        }
    });

    // 4. CHAT AUTOMATION LOGIC LOOP
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const chatId = msg.key.remoteJid;

        // HELPER ID SNIFFER (Prints active group identities to the Render console)
        if (chatId.endsWith('@g.us')) {
            console.log(`[ID Sniffer Tool] Group Chat Texted! Name: "${msg.pushName || 'User'}". ID: ${chatId}`);
        }

        const isImage = msg.message.imageMessage;
        
        if (chatId === SOURCE_GROUP && isImage) {
            try {
                console.log('[Forwarder] New image received in supplier chat. Relaying...');
                await sock.sendMessage(TARGET_GROUP, { forward: msg });
                console.log('✨ Success! Image forwarded to customer channel.');
            } catch (err) {
                console.error('[Error] Forwarding relay failure:', err);
            }
        }
    });
}

startForwarder();
