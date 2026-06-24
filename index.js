const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("WhatsApp Bot Running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const MY_PHONE_NUMBER = "918589822129";
const SOURCE_GROUP = "120363428389082831@g.us";
const TARGET_GROUP = "120363424960811886@g.us";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("render_auth_session");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    browser: Browsers.ubuntu("Chrome")
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {

    if (connection === "open") {
      console.log("✅ WhatsApp Connected");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log("Connection closed");

      if (shouldReconnect) {
        console.log("Reconnecting...");
        startBot();
      }
    }
  });

  // Wait before requesting pairing code
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(MY_PHONE_NUMBER);

        console.log("\n=========================");
        console.log("PAIRING CODE:", code);
        console.log("=========================\n");

      } catch (err) {
        console.log("Pairing error:", err);
      }
    }, 20000);
  }

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];

    if (!msg.message || msg.key.fromMe) return;

    const chatId = msg.key.remoteJid;

    if (
      chatId === SOURCE_GROUP &&
      msg.message.imageMessage
    ) {
      try {

        await sock.sendMessage(
          TARGET_GROUP,
          {
            image: {
              url: "./coustum.jpg"
            },
            caption: "🔥 Image received successfully"
          }
        );

        console.log("Custom image sent");

      } catch (err) {
        console.log("Send Error:", err);
      }
    }
  });
}

startBot();