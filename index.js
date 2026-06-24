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

// Render health check
app.get("/", (req, res) => {
res.send("WhatsApp Bot Running");
});

app.listen(PORT, () => {
console.log("🚀 Server running on port ${PORT}");
});

// Your WhatsApp number (country code + number, no + sign)
const MY_PHONE_NUMBER = "918589822129";

// Source and Target Groups
const SOURCE_GROUP = "120363428389082831@g.us";
const TARGET_GROUP = "120363424960811886@g.us";

async function startBot() {
console.log("🔄 Starting bot...");

const { state, saveCreds } = await useMultiFileAuthState(
"render_auth_session"
);

const sock = makeWASocket({
auth: state,
logger: pino({ level: "silent" }),
browser: Browsers.ubuntu("Chrome")
});

sock.ev.on("creds.update", saveCreds);

sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {

console.log("Connection Update:", connection);

if (connection === "open") {
  console.log("✅ WhatsApp Connected Successfully");
}

if (connection === "close") {
  console.log("❌ Connection Closed");

  const shouldReconnect =
    lastDisconnect?.error?.output?.statusCode !==
    DisconnectReason.loggedOut;

  if (shouldReconnect) {
    console.log("♻️ Reconnecting...");
    startBot();
  }
}

});

// Generate Pairing Code
if (!state.creds.registered) {
console.log("⏳ Waiting 20 seconds before requesting pairing code...");

setTimeout(async () => {
  try {
    console.log("📱 Requesting pairing code...");

    const code = await sock.requestPairingCode(
      MY_PHONE_NUMBER
    );

    console.log("");
    console.log("=================================");
    console.log("PAIRING CODE:", code);
    console.log("=================================");
    console.log("");

  } catch (err) {
    console.error("❌ Pairing Error:");
    console.error(err);
  }
}, 20000);

}

// Listen for Images
sock.ev.on("messages.upsert", async ({ messages }) => {
try {
const msg = messages[0];

  if (!msg?.message) return;
  if (msg.key.fromMe) return;

  const chatId = msg.key.remoteJid;

  if (
    chatId === SOURCE_GROUP &&
    msg.message.imageMessage
  ) {
    console.log("🖼️ Image detected in source group");

    await sock.sendMessage(
      TARGET_GROUP,
      {
        image: {
          url: "./coustum.jpg"
        },
        caption: "🔥 Image received successfully"
      }
    );

    console.log("✅ Custom image sent");
  }

} catch (err) {
  console.error("❌ Message Error:");
  console.error(err);
}

});
}

startBot().catch(console.error);