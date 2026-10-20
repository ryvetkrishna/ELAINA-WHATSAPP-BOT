const express = require('express');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const config = require('./config');

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || config.port || 3000;
const SESSION_DIR = process.env.SESSION_DIR || path.join(__dirname, 'session');

let sock = null;
let qrDataUrl = null;
let pairingCode = null;
let connectionStatus = 'disconnected';
let lastError = null;
let connectLock = false;

function authorized(req, res, next) {
  const expected = process.env.DASHBOARD_TOKEN || config.dashboardToken;
  if (!expected) return res.status(503).json({ error: 'Set DASHBOARD_TOKEN before using the dashboard.' });
  const supplied = req.get('x-dashboard-token') || req.body?.token;
  if (supplied !== expected) return res.status(401).json({ error: 'Invalid dashboard token.' });
  next();
}

async function startWhatsApp() {
  if (connectLock) return;
  connectLock = true;
  try {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Elaina', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        try { qrDataUrl = await QRCode.toDataURL(qr); } catch (e) { lastError = e.message; }
      }
      if (connection === 'connecting') connectionStatus = 'connecting';
      if (connection === 'open') {
        connectionStatus = 'connected';
        qrDataUrl = null;
        pairingCode = null;
        lastError = null;
      }
      if (connection === 'close') {
        connectionStatus = 'disconnected';
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) {
          setTimeout(() => { connectLock = false; startWhatsApp(); }, 3000);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') continue;
        const text = msg.message.conversation ||
          msg.message.extendedTextMessage?.text || '';
        const command = text.trim().toLowerCase();
        if (command === '!ping') {
          await sock.sendMessage(msg.key.remoteJid, { text: 'Pong! 🟢' }, { quoted: msg });
        } else if (command === '!alive') {
          await sock.sendMessage(msg.key.remoteJid, { text: `${config.botName} is online. ⚡` }, { quoted: msg });
        } else if (command === '!menu') {
          await sock.sendMessage(msg.key.remoteJid, {
            text: `╭─「 ${config.botName} 」\n│ !ping - Check response\n│ !alive - Bot status\n│ !menu - Show commands\n╰────────────`
          }, { quoted: msg });
        }
      }
    });
  } catch (err) {
    lastError = err.message;
    connectionStatus = 'error';
    connectLock = false;
    throw err;
  }
}

app.get('/api/status', authorized, (_req, res) => {
  res.json({ status: connectionStatus, hasQr: Boolean(qrDataUrl), hasPairingCode: Boolean(pairingCode), error: lastError });
});

app.get('/api/qr', authorized, (_req, res) => {
  if (!qrDataUrl) return res.status(404).json({ error: 'QR not ready. Start connection first or refresh shortly.' });
  res.json({ qr: qrDataUrl });
});

app.post('/api/connect', authorized, async (_req, res) => {
  try {
    if (!sock && !connectLock) await startWhatsApp();
    res.json({ ok: true, status: connectionStatus, message: 'Connection started. Refresh status in a few seconds.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/pair', authorized, async (req, res) => {
  const number = String(req.body?.number || '').replace(/\D/g, '');
  if (!number || number.length < 8 || number.length > 15) {
    return res.status(400).json({ error: 'Enter a valid number with country code, digits only (example: 919876543210).' });
  }
  try {
    if (!sock && !connectLock) await startWhatsApp();
    if (!sock) return res.status(503).json({ error: 'WhatsApp socket is not ready yet. Try again in a few seconds.' });
    const code = await sock.requestPairingCode(number);
    pairingCode = code;
    res.json({ code });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Could not generate pairing code.' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`${config.botName} dashboard listening on port ${PORT}`);
  if (process.env.AUTO_CONNECT === 'true') startWhatsApp().catch(console.error);
});
