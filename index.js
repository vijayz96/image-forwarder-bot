const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const express = require('express');

// EXPRESS SERVER
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('WhatsApp Forwarder Running');
});

app.listen(PORT, () => {
    console.log(`[Cloud Engine] Running on port ${PORT}`);
});

// CONFIGURATION
const MY_PHONE_NUMBER = '918589822129'; // Your number without + or spaces

const SOURCE_GROUP = '120363428389082831@g.us';
const TARGET_GROUP = '120363424960811886@g.us';

async function startForwarder() {

    const { state, saveCreds } = await useMultiFileAuthState('render_auth_session');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS('Chrome')
    });

    sock.ev.on('creds.update', saveCreds);

    // Pairing code
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(MY_PHONE_NUMBER);

                console.log('\n============================');
                console.log('PAIRING CODE:', code);
                console.log('============================\n');

            } catch (err) {
                console.error(err);
            }
        }, 5000);
    }

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {

        if (connection === 'open') {
            console.log('✅ WhatsApp Connected');
        }

        if (connection === 'close') {

            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log('Reconnecting...');
                startForwarder();
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {

        const msg = messages[0];

        if (!msg.message || msg.key.fromMe) return;

        const chatId = msg.key.remoteJid;

        // Detect image in source group
        if (
            chatId === SOURCE_GROUP &&
            msg.message.imageMessage
        ) {

            try {

                console.log('Image detected');

                await sock.sendMessage(
                    TARGET_GROUP,
                    {
                        image: {
                            url: './media/custom.jpg'
                        },
                        caption: '🔥 Image received successfully'
                    }
                );

                console.log('Custom image sent');

            } catch (err) {

                console.error('Error:', err);

            }

        }

    });

}

startForwarder();