# AinSight WhatsApp Bot

No Twilio. No paid API. Just scan a QR code.

## Quick Start

```bash
cd whatsapp_bot
npm install
node index.js
```

A QR code appears in the terminal. Scan it with **WhatsApp → Settings → Linked Devices → Link a Device**.

That's it. Anyone who texts your WhatsApp number gets the water quality analysis.

## How It Works

```
Someone texts you → Bot takes over the conversation:

1. "أحمد"         → Bot: مرحبا! أرسل لي موقع البير
2. Send location  → Bot: تم! شحال عمق البير؟
3. "50"           → Bot: أشنو كتزرع؟ (1=زيتون 2=خضروات...)
4. "1"            → Bot: 📊 ملوحة متوسطة, CE=2.6 dS/m
                     + توصيات بالدارجة
```

## Features

- **QR code login** — scan and go, uses your personal WhatsApp
- **Location sharing** — farmer sends WhatsApp location (📎 → Location)
- **Text coordinates** — or just type "31.63, -8.01"
- **Same analysis** as the web app (CE, salinity, calcaire, nitrates)
- **Darija advice** — built-in + optional Claude AI follow-up
- **Session per user** — handles multiple conversations at once
- **Auto-reconnect** — stays connected after first scan

## Optional: Claude AI

Set your key in `index.js` to enable follow-up Q&A:
```js
const CLAUDE_API_KEY = 'sk-ant-...';
```

## Files

| File | Description |
|------|-------------|
| `index.js` | Main bot — conversation + WhatsApp client |
| `bot.py` | Alternative Python version (needs Twilio) |
