/**
 * AinSight WhatsApp AI Agent
 * ===========================
 * Uses whatsapp-web.js — NO Twilio, NO paid API.
 * Now uses the real Flask backend for predictions + chatbot.
 *
 * Run: node index.js
 * Scan the QR code that appears in the terminal with WhatsApp.
 * Send a message from any number to YOUR WhatsApp → bot replies.
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const BACKEND_URL = 'http://127.0.0.1:5001'; // Flask backend

// Ignore all messages received before bot startup
const BOT_START_TIME = Math.floor(Date.now() / 1000);

// ─────────────────────────────────────────────
// SESSION STORE (in-memory)
// ─────────────────────────────────────────────
const sessions = {};

function getSession(phone) {
    if (!sessions[phone]) {
        sessions[phone] = {
            step: 'welcome', name: '', lat: 0, lng: 0,
            zone: '', depth: 0, culture: '', cultureLabel: '',
            prediction: null, chatHistory: [],
        };
    }
    return sessions[phone];
}

// ─────────────────────────────────────────────
// CROPS (matches backend's 8 FAO cultures)
// ─────────────────────────────────────────────
const CROPS = {
    '1': { id: 'olivier', ar: 'زيتون', fr: 'Olivier' },
    '2': { id: 'tomate', ar: 'طماطم', fr: 'Tomate' },
    '3': { id: 'agrumes', ar: 'لبرتقال', fr: 'Agrumes' },
    '4': { id: 'pasteque', ar: 'دلاح', fr: 'Pastèque' },
    '5': { id: 'ble', ar: 'القمح', fr: 'Blé' },
    '6': { id: 'luzerne', ar: 'الفصة', fr: 'Luzerne' },
    '7': { id: 'palmier', ar: 'النخل', fr: 'Palmier' },
    '8': { id: 'mais', ar: 'الدرا', fr: 'Maïs' },
};

function getZone(lat, lng) {
    if (lng < -8.3) return 'Chichaoua';
    if (lat < 31.3) return 'Mejjate';
    return 'Haouz';
}

// Marrakech-Safi region bounds
const REGION = { latMin: 30.5, latMax: 32.5, lonMin: -10.0, lonMax: -7.0 };
function isInRegion(lat, lng) {
    return lat >= REGION.latMin && lat <= REGION.latMax && lng >= REGION.lonMin && lng <= REGION.lonMax;
}

// ─────────────────────────────────────────────
// BACKEND API CALLS
// ─────────────────────────────────────────────

async function callPredict(lat, lng, depth, culture) {
    const res = await fetch(`${BACKEND_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng, profondeur: depth, culture }),
    });
    if (!res.ok) throw new Error(`Backend error ${res.status}`);
    return res.json();
}

async function callChat(message, history, context) {
    const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, context }),
    });
    if (!res.ok) throw new Error(`Chat error ${res.status}`);
    const data = await res.json();
    return data.reply || 'عذرا، ما قدرتش نجاوبك.';
}

async function callSTT(audioBuffer, filename) {
    const FormData = (await import('formdata-node')).FormData;
    const { Blob } = (await import('buffer'));
    // Use native fetch with multipart
    const tmpPath = path.join(os.tmpdir(), filename || 'voice.ogg');
    fs.writeFileSync(tmpPath, audioBuffer);
    try {
        // Use the backend /stt with a multipart form upload
        const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
        const form = new FormData();
        form.append('audio', blob, filename || 'voice.ogg');
        const res = await fetch(`${BACKEND_URL}/stt`, {
            method: 'POST',
            body: form,
        });
        const data = await res.json();
        return data.text || '';
    } finally {
        try { fs.unlinkSync(tmpPath); } catch (e) { }
    }
}

async function callTTS(text) {
    const res = await fetch(`${BACKEND_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`TTS error ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
}

async function sendVoiceNote(msg, text) {
    try {
        const audioBuffer = await callTTS(text);
        const base64 = audioBuffer.toString('base64');
        const media = new MessageMedia('audio/mpeg', base64, 'reply.mp3');
        await msg.reply(media, undefined, { sendAudioAsVoice: true });
    } catch (e) {
        console.error('Voice note error:', e.message);
    }
}

// ─────────────────────────────────────────────
// FORMAT
// ─────────────────────────────────────────────
function riskIcon(level) { return { safe: '✅', moderate: '⚠️', severe: '🔴' }[level] || '⚠️'; }
function riskLabel(level) { return { safe: 'جودة جيدة', moderate: 'ملوحة متوسطة', severe: 'ملوحة عالية' }[level] || 'ملوحة متوسطة'; }

function formatResult(data, zone, depth, cultureLabel) {
    const compat = (data.cultures || [])
        .map(c => `${c.compatible ? '✅' : '❌'} ${c.nom_ar}`)
        .join('\n');

    const factors = (data.factors || []).slice(0, 3)
        .map(f => `${f.direction === 'up' ? '⬆️' : '⬇️'} ${f.nom_ar}: ${f.shap > 0 ? '+' : ''}${f.shap}`)
        .join('\n');

    return (
        `━━━━━━━━━━━━━━━━━━\n` +
        `📊 *نتائج تحليل المياه*\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `📍 المنطقة: *${zone}*\n` +
        `⛏️ العمق: *${depth} م*\n` +
        `🌱 المحصول: *${cultureLabel}*\n\n` +
        `${riskIcon(data.level)} *${riskLabel(data.level)}*\n` +
        `CE = *${data.ce} dS/m*\n` +
        `IC 95%: [${data.ci_lower} – ${data.ci_upper}]\n\n` +
        (factors ? `📈 *العوامل المؤثرة:*\n${factors}\n\n` : '') +
        `🌱 *ملاءمة المحاصيل:*\n${compat}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ _تقدير للمنطقة — يُوصى بتحليل مخبري_`
    );
}

// ─────────────────────────────────────────────
// CONVERSATION HANDLER
// ─────────────────────────────────────────────
async function handleMessage(phone, body, location) {
    body = body.trim();
    const session = getSession(phone);
    const { step } = session;

    // Reset
    if (['reset', '0', 'إعادة', 'جديد'].includes(body.toLowerCase())) {
        delete sessions[phone];
        return ['مرحبا بك في *Ain Sight* 🌱\nمستشارك الزراعي لجودة المياه.\n\nأرسل اسمك للبدء:'];
    }

    // WELCOME
    if (step === 'welcome') {
        session.name = body || 'مستخدم';
        session.step = 'location';
        return [
            `مرحبا *${session.name}*!\n\n` +
            `أنا *Ain Sight* — مستشارك الزراعي.\n` +
            `غادي نساعدك تعرف جودة ماء البير.\n\n` +
            `📍 *أرسل لي موقع البير:*\n\n` +
            `الطريقة 1: أرسل الموقع من واتساب\n` +
            `  ← اضغط على 📎 ← الموقع\n\n` +
            `الطريقة 2: أكتب الإحداثيات\n` +
            `  مثلا: 31.63, -8.01`
        ];
    }

    // LOCATION
    if (step === 'location') {
        if (location) {
            session.lat = location.latitude;
            session.lng = location.longitude;
        } else {
            try {
                const parts = body.replace('،', ',').split(',');
                session.lat = parseFloat(parts[0].trim());
                session.lng = parseFloat(parts[1].trim());
                if (isNaN(session.lat) || isNaN(session.lng)) throw new Error();
            } catch {
                return ['ما فهمتش الموقع. جرب:\n\n1️⃣ أرسل الموقع من واتساب (📎 ← الموقع)\n2️⃣ أو اكتب الإحداثيات: 31.63, -8.01'];
            }
        }
        // Validate region
        if (!isInRegion(session.lat, session.lng)) {
            session.lat = 0;
            session.lng = 0;
            return [
                '⚠️ *هاد الموقع خارج منطقة مراكش-آسفي!*\n\n' +
                'النموذج ديالنا خاص بمنطقة مراكش-آسفي (الحوز، الرحامنة، شيشاوة).\n' +
                'البيانات والتحليل غير دقيق خارج هاد المنطقة.\n\n' +
                '📍 *أرسل موقع داخل منطقة مراكش-آسفي:*\nمثلا: 31.63, -8.01'
            ];
        }
        session.zone = getZone(session.lat, session.lng);
        session.step = 'depth';
        return [
            `📍 تم! أنت في منطقة *${session.zone}*\n` +
            `(${session.lat.toFixed(3)}, ${session.lng.toFixed(3)})\n\n` +
            `⛏️ *شحال عمق البير بالمتر؟*\nمثلا: 50`
        ];
    }

    // DEPTH
    if (step === 'depth') {
        const depth = parseInt(body.replace('م', '').replace('متر', '').trim());
        if (isNaN(depth) || depth < 5 || depth > 500) {
            return ['أرسل العمق بالأرقام (بين 5 و 500). مثلا: 50'];
        }
        session.depth = depth;
        session.step = 'crop';
        const cropList = Object.entries(CROPS).map(([k, v]) => `  ${k} ← ${v.ar} (${v.fr})`).join('\n');
        return [
            `⛏️ عمق البير: *${depth} متر*\n\n` +
            `🌱 *أشنو كتزرع؟*\nأرسل الرقم:\n\n${cropList}`
        ];
    }

    // CROP → PREDICT
    if (step === 'crop') {
        let choice = body.trim();
        if (!CROPS[choice]) {
            for (const [k, v] of Object.entries(CROPS)) {
                if (body.includes(v.ar) || body.toLowerCase().includes(v.id)) { choice = k; break; }
            }
        }
        if (!CROPS[choice]) return ['أرسل رقم المحصول (1-8). مثلا: 1'];

        const { id, ar } = CROPS[choice];
        session.culture = id;
        session.cultureLabel = ar;

        try {
            // Call real backend
            const data = await callPredict(session.lat, session.lng, session.depth, id);
            session.prediction = data;
            const result = formatResult(data, session.zone, session.depth, ar);

            session.step = 'done';
            session.chatHistory = [];

            const responses = [
                '🔬 جاري التحليل... تسنا شوية عافاك ⚙️',
                result,
            ];

            // Get GPT farmer-friendly advice
            try {
                const adviceRes = await fetch(`${BACKEND_URL}/generate-advice`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ce: data.ce,
                        level: data.level,
                        culture: ar,
                        culture_key: id,
                        factors: data.factors || [],
                        zone: session.zone,
                    }),
                });
                if (adviceRes.ok) {
                    const adviceData = await adviceRes.json();
                    responses.push(`💡 *التوصيات:*\n\n${adviceData.advice || data.darija_text || ''}`);
                } else if (data.darija_text) {
                    responses.push(`💡 *التوصيات:*\n\n${data.darija_text}`);
                }
            } catch {
                if (data.darija_text) {
                    responses.push(`💡 *التوصيات:*\n\n${data.darija_text}`);
                }
            }

            responses.push('━━━━━━━━━━━━━━━━━━\nأرسل *جديد* لتحليل بير آخر\nأو اسأل أي سؤال على الماء والزراعة 💬');

            return responses;
        } catch (err) {
            console.error('Backend predict error:', err);
            return ['عذرا، تعذر الاتصال بالخادم. تأكد أن الخادم يعمل.\nأرسل *جديد* للبدء من جديد.'];
        }
    }

    // FREE CHAT (uses backend /chat with full Darija system prompt)
    if (step === 'done') {
        try {
            // Build full context with SHAP factors and model parameters
            const context = session.prediction ? {
                ce: session.prediction.ce,
                ce_rf: session.prediction.ce_rf,
                ce_krigeage: session.prediction.ce_krigeage,
                poids_rf: session.prediction.poids_rf,
                poids_krigeage: session.prediction.poids_krigeage,
                ci_lower: session.prediction.ci_lower,
                ci_upper: session.prediction.ci_upper,
                zone: session.zone,
                culture: session.cultureLabel,
                level: session.prediction.level,
                factors: session.prediction.factors || [],
                features: session.prediction.features || {},
                cultures: session.prediction.cultures || [],
            } : {};

            const reply = await callChat(body, session.chatHistory, context);

            // Keep history for context
            session.chatHistory.push({ role: 'user', content: body });
            session.chatHistory.push({ role: 'assistant', content: reply });

            // Trim history to last 10
            if (session.chatHistory.length > 20) {
                session.chatHistory = session.chatHistory.slice(-20);
            }

            return [reply];
        } catch (err) {
            console.error('Chat error:', err);
            return ['عذرا، ما قدرتش نجاوبك دابا.\nأرسل *جديد* لتحليل بير آخر.'];
        }
    }

    return ['أرسل *جديد* للبدء من جديد.'];
}


// ─────────────────────────────────────────────
// WHATSAPP CLIENT
// ─────────────────────────────────────────────
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  📱 Scan this QR code with WhatsApp:');
    console.log('  WhatsApp → Settings → Linked Devices → Link a Device');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ✅ Ain Sight WhatsApp Bot is READY!');
    console.log('  Using backend at: ' + BACKEND_URL);
    console.log('  8 crops | Real ML predictions | Darija chatbot');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

client.on('message', async (msg) => {
    // Skip group messages and status updates
    if (msg.from.includes('@g.us') || msg.from === 'status@broadcast') return;

    // Skip old/queued messages from before bot started
    if (msg.timestamp < BOT_START_TIME) {
        console.log(`⏭️ Skipping old message from ${msg.from} (timestamp ${msg.timestamp} < ${BOT_START_TIME})`);
        return;
    }

    const phone = msg.from;
    const body = msg.body || '';

    // Check for location message
    let location = null;
    if (msg.location) {
        location = { latitude: msg.location.latitude, longitude: msg.location.longitude };
    }

    console.log(`📨 ${phone}: ${body.substring(0, 50)}${body.length > 50 ? '...' : ''}`);

    try {
        // Handle voice messages
        let textBody = body;
        let isVoiceMessage = false;
        if (msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio')) {
            isVoiceMessage = true;
            console.log(`🎙️ Voice message from ${phone}, transcribing...`);
            await msg.reply('🎙️ سمعتك! تسنا شوية غادي نحول الصوتية ديالك...');
            try {
                const media = await msg.downloadMedia();
                if (media && media.data) {
                    const audioBuffer = Buffer.from(media.data, 'base64');
                    const ext = media.mimetype.includes('ogg') ? 'ogg' : 'mp3';
                    const transcribed = await callSTT(audioBuffer, `voice.${ext}`);
                    if (transcribed) {
                        textBody = transcribed;
                        console.log(`✅ Transcribed: "${transcribed.substring(0, 60)}..."`);
                    } else {
                        await msg.reply('ما قدرتش نفهم الصوت. جرب مرة أخرى أو اكتب سؤالك.');
                        return;
                    }
                }
            } catch (sttErr) {
                console.error('STT error:', sttErr);
                await msg.reply('تعذر تحويل الرسالة الصوتية. جرب اكتب سؤالك.');
                return;
            }
        }

        const session = getSession(phone);

        // Send waiting message for chat questions (step === 'done')
        if (session.step === 'done' && !['reset', '0', 'إعادة', 'جديد'].includes(textBody.toLowerCase())) {
            await msg.reply('⛏️ تسنا شوية غادي نجاوبك...');
        }

        const responses = await handleMessage(phone, textBody, location);

        // Send each response with a small delay (feels natural)
        for (let i = 0; i < responses.length; i++) {
            if (i > 0) await new Promise(r => setTimeout(r, 1000));
            await msg.reply(responses[i]);
        }

        // For voice messages or chat replies, also send voice note back
        const updatedSession = getSession(phone);
        if (updatedSession.step === 'done' && responses.length > 0) {
            const lastReply = responses[responses.length - 1];
            // Send voice note for chat replies (especially if incoming was voice)
            if (lastReply.length < 600) {
                if (isVoiceMessage) {
                    // Always reply with voice if they sent voice
                    await sendVoiceNote(msg, lastReply);
                } else if (lastReply.length < 400) {
                    // For text messages, send voice for shorter replies
                    await sendVoiceNote(msg, lastReply);
                }
            }
        }
    } catch (err) {
        console.error('Error handling message:', err);
        await msg.reply('عذرا، وقعات مشكلة تقنية. أرسل *جديد* للبدء من جديد.');
    }
});

client.on('auth_failure', () => {
    console.error('❌ Authentication failed. Delete .wwebjs_auth folder and try again.');
});

client.on('disconnected', (reason) => {
    console.log('Disconnected:', reason);
});

console.log('🚀 Starting Ain Sight WhatsApp Bot...');
console.log('   Backend: ' + BACKEND_URL);
console.log('   Waiting for QR code...\n');
client.initialize();
