const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys")

const P = require("pino")

// CHANGE THESE
const SOURCE_GROUP = "SOURCE_GROUP_ID@g.us"
const TARGET_GROUP = "TARGET_GROUP_ID@g.us"

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info")

    const sock = makeWASocket({
        auth: state,
        logger: P({ level: "silent" }),
        printQRInTerminal: false
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update

        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !==
                DisconnectReason.loggedOut

            console.log("Disconnected")

            if (shouldReconnect) {
                startBot()
            }
        }

        if (connection === "open") {
            console.log("✅ WhatsApp Connected")
        }
    })

    // Pairing Code Login
    if (!sock.authState?.creds?.registered) {
        const phoneNumber = process.env.PHONE_NUMBER

        const code = await sock.requestPairingCode(phoneNumber)

        console.log("")
        console.log("PAIRING CODE:")
        console.log(code)
        console.log("")
    }

    // Listen for messages
    sock.ev.on("messages.upsert", async ({ messages }) => {
        try {
            const msg = messages[0]

            if (!msg.message) return

            const jid = msg.key.remoteJid

            if (jid !== SOURCE_GROUP) return

            if (!msg.message.imageMessage) return

            console.log("🖼️ Image detected")

            const buffer = await sock.downloadMediaMessage(msg)

            await sock.sendMessage(
                TARGET_GROUP,
                {
                    image: buffer
                }
            )

            console.log("✅ Image forwarded")
        } catch (err) {
            console.error("Forward Error:", err)
        }
    })
}

startBot()
