const express = require("express");
const fetch = require("node-fetch");
const { google } = require("googleapis");

const app = express();
app.use(express.json());

const TOKEN = process.env.TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth });

let sessions = {};

app.post("/", async (req, res) => {
  res.sendStatus(200);

  const message = req.body.message;
  if (!message) return;

  const chatId = message.chat.id;
  const text = message.text;
  const photo = message.photo;

  if (!sessions[chatId]) sessions[chatId] = { mode: null, step: null, photos: [] };

  if (text === "/start") return sendMenu(chatId);

  if (text === "➕ Barang Masuk") {
    sessions[chatId] = { mode: "masuk", step: "kode", photos: [] };
    return sendMessage(chatId, "Masukkan Kode Barang:", cancelKeyboard());
  }

  if (text === "📤 Barang Keluar") {
    sessions[chatId] = { mode: "keluar", step: "nomor", photos: [] };
    return sendMessage(chatId, "Masukkan Nomor Barang / Box / Kontainer:", cancelKeyboard());
  }

  if (text === "❌ Batal") {
    sessions[chatId] = { mode: null, step: null, photos: [] };
    return sendMenu(chatId, "❌ Input dibatalkan");
  }

  const s = sessions[chatId];

  // ===== BARANG MASUK =====
  if (s.mode === "masuk") {

    if (s.step === "kode") {
      s.kode = text; s.step = "kapal";
      return sendMessage(chatId, "Nomor Kapal?", cancelKeyboard());
    }

    if (s.step === "kapal") {
      s.kapal = text; s.step = "gudang";
      return sendMessage(chatId, "Lokasi Gudang?", cancelKeyboard());
    }

    if (s.step === "gudang") {
      s.gudang = text; s.step = "blok";
      return sendMessage(chatId, "Lokasi Blok?", cancelKeyboard());
    }

    if (s.step === "blok") {
      s.blok = text; s.step = "kendaraan";
      return sendMessage(chatId, "Nomor Kendaraan (ketik - jika tidak ada)", cancelKeyboard());
    }

    if (s.step === "kendaraan") {
      s.kendaraan = text; s.step = "foto";
      return sendMessage(chatId, "Kirim foto maksimal 5 lalu tekan ✅ Selesai", finishKeyboard());
    }

    if (s.step === "foto") {
      if (photo && s.photos.length < 5) {
        s.photos.push(photo[photo.length - 1].file_id);
        return sendMessage(chatId, `Foto diterima (${s.photos.length}/5)`);
      }

      if (text === "✅ Selesai") {
        if (s.photos.length === 0)
          return sendMessage(chatId, "⚠ Minimal 1 foto wajib dikirim");

        await appendRow("DATA_MASUK", [
          new Date().toISOString(),
          s.kode,
          s.kapal,
          s.gudang,
          s.blok,
          s.kendaraan,
          ...fillPhotos(s.photos),
          chatId
        ]);

        sessions[chatId] = { mode: null, step: null, photos: [] };
        return sendMenu(chatId, "✅ Barang Masuk berhasil disimpan");
      }
    }
  }

  // ===== BARANG KELUAR =====
  if (s.mode === "keluar") {

    if (s.step === "nomor") {
      s.nomor = text; s.step = "gudang";
      return sendMessage(chatId, "Lokasi Gudang?", cancelKeyboard());
    }

    if (s.step === "gudang") {
      s.gudang = text; s.step = "blok";
      return sendMessage(chatId, "Lokasi Blok?", cancelKeyboard());
    }

    if (s.step === "blok") {
      s.blok = text; s.step = "tanggal";
      return sendMessage(chatId, "Tanggal Ambil (YYYY-MM-DD)?", cancelKeyboard());
    }

    if (s.step === "tanggal") {
      s.tanggal = text; s.step = "pengambil";
      return sendMessage(chatId, "Pengambil (User/Perusahaan)?", cancelKeyboard());
    }

    if (s.step === "pengambil") {
      s.pengambil = text; s.step = "kendaraan";
      return sendMessage(chatId, "Nomor Kendaraan?", cancelKeyboard());
    }

    if (s.step === "kendaraan") {
      s.kendaraan = text; s.step = "nama";
      return sendMessage(chatId, "Nama Pengambil?", cancelKeyboard());
    }

    if (s.step === "nama") {
      s.nama = text; s.step = "foto";
      return sendMessage(chatId, "Kirim foto maksimal 5 lalu tekan ✅ Selesai", finishKeyboard());
    }

    if (s.step === "foto") {
      if (photo && s.photos.length < 5) {
        s.photos.push(photo[photo.length - 1].file_id);
        return sendMessage(chatId, `Foto diterima (${s.photos.length}/5)`);
      }

      if (text === "✅ Selesai") {
        if (s.photos.length === 0)
          return sendMessage(chatId, "⚠ Minimal 1 foto wajib dikirim");

        await appendRow("DATA_KELUAR", [
          new Date().toISOString(),
          s.nomor,
          s.gudang,
          s.blok,
          s.tanggal,
          s.pengambil,
          s.kendaraan,
          s.nama,
          ...fillPhotos(s.photos),
          chatId
        ]);

        sessions[chatId] = { mode: null, step: null, photos: [] };
        return sendMenu(chatId, "✅ Barang Keluar berhasil disimpan");
      }
    }
  }
});

async function appendRow(sheet, row) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheet + "!A1",
    valueInputOption: "RAW",
    requestBody: { values: [row] }
  });
}

function fillPhotos(photos) {
  const arr = ["", "", "", "", ""];
  photos.forEach((p, i) => arr[i] = p);
  return arr;
}

function sendMenu(chatId, msg = "📦 SISTEM GUDANG") {
  fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: msg,
      reply_markup: {
        keyboard: [["➕ Barang Masuk"], ["📤 Barang Keluar"]],
        resize_keyboard: true
      }
    })
  });
}

function sendMessage(chatId, text, keyboard = null) {
  fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: keyboard })
  });
}

function cancelKeyboard() {
  return { keyboard: [["❌ Batal"]], resize_keyboard: true };
}

function finishKeyboard() {
  return { keyboard: [["✅ Selesai"], ["❌ Batal"]], resize_keyboard: true };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
