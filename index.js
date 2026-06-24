const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys")

const P = require("pino")

// CHANGE THESE
const SOURCE_GROUP = "120363428389082831@g.us"
const TARGET_GROUP = "120363424960811886@g.us"

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
    console.log("🔄 Reconnecting in 5 seconds...")
    setTimeout(() => startBot(), 5000)
}
            }
        }

        if (connection === "open") {
            console.log("✅ WhatsApp Connected")
        }
    })

    // Pairing Code Login
if (!state.creds.registered) {
    try {
        const phoneNumber = process.env.PHONE_NUMBER

        console.log("Generating pairing code...")

        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber)

                console.log("")
                console.log("🔑 PAIRING CODE:")
                console.log(code)
                console.log("")
                console.log("Enter this code in WhatsApp > Linked Devices > Link with phone number")
            } catch (err) {
                console.log("Pairing request failed:", err.message)
            }
        }, 5000)

    } catch (err) {
        console.log("Pairing Error:", err)
    }
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
const http = require("http")

http.createServer((req, res) => {
    res.writeHead(200)
    res.end("Bot Running")
}).listen(process.env.PORT || 3000)

startBot()
