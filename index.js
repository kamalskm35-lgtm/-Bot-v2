const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// === GANTI TOKEN DI SINI JIKA PERLU ===
const TOKEN = "8601171352:AAFsUvcVaL-LKnB4r5U-m7d-8lZo8-VNXIU";
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

app.post("/", async (req, res) => {
  res.sendStatus(200);

  const message = req.body.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text;

  if (text === "/start") {
    await sendMessage(chatId, "🚀 Bot Gudang V2 Aktif (Node.js)");
  } else {
    await sendMessage(chatId, "Bot aktif 🔥");
  }
});

async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
