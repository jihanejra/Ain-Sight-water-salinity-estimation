"""
AinSight WhatsApp AI Agent
==========================
A WhatsApp chatbot that guides farmers through water quality analysis.
Uses Twilio for WhatsApp messaging, Claude AI for advice.

Setup:
  1. Create Twilio account → get SID + Auth Token
  2. Join WhatsApp Sandbox: send "join <sandbox-word>" to +1 415 523 8886
  3. Set webhook URL in Twilio console → https://your-server.com/webhook
  4. Copy .env.example → .env and fill in credentials
  5. pip install -r requirements.txt && python bot.py
"""

import os, math, json, logging
from datetime import datetime
from flask import Flask, request
from twilio.rest import Client
from twilio.twiml.messaging_response import MessagingResponse
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ainsight")

app = Flask(__name__)

# ═══════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════
TWILIO_SID   = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_NUM   = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
CLAUDE_KEY   = os.getenv("ANTHROPIC_API_KEY", "")

twilio_client = Client(TWILIO_SID, TWILIO_TOKEN) if TWILIO_SID else None

# ═══════════════════════════════════════════════════
# CONVERSATION STATE (in-memory; use Redis in prod)
# ═══════════════════════════════════════════════════
sessions: dict[str, dict] = {}

def get_session(phone: str) -> dict:
    if phone not in sessions:
        sessions[phone] = {
            "step": "welcome",     # welcome → location → depth → crop → result
            "name": "",
            "lat": 0.0,
            "lng": 0.0,
            "zone": "",
            "depth": 0,
            "culture": "",
            "culture_label": "",
            "created": datetime.now().isoformat()
        }
    return sessions[phone]

def reset_session(phone: str):
    if phone in sessions:
        del sessions[phone]

# ═══════════════════════════════════════════════════
# CE PREDICTION (same formula as web app)
# ═══════════════════════════════════════════════════
CROPS = {
    "1": ("olivier",     "الزيتون",   "Olivier"),
    "2": ("maraichage",  "الخضروات",  "Maraîchage"),
    "3": ("agrumes",     "الحوامض",   "Agrumes"),
    "4": ("cereales",    "الحبوب",    "Céréales"),
    "5": ("palmiers",    "النخيل",    "Palmiers"),
}

CROP_OFFSET = {
    "olivier": 0, "maraichage": 0.3, "agrumes": 0.15,
    "cereales": -0.1, "palmiers": 0.2
}

def get_zone(lat: float, lng: float) -> str:
    if lng < -8.3:
        return "Chichaoua"
    elif lat < 31.3:
        return "Mejjate"
    return "Haouz"

def predict_ce(lat: float, lng: float, depth: int, culture: str) -> dict:
    base = 1.8
    if lng < -8.3:
        base = 2.4
    if lat < 31.3:
        base = 1.5

    offset = CROP_OFFSET.get(culture, 0)
    ce = max(0.3, min(5.5,
        base + (depth / 100) * 0.6 + offset
        + (math.sin(lat * 100) + math.cos(lng * 80)) * 0.3
    ))
    ce = round(ce, 1)

    def level(v, low, mid):
        return "good" if v < low else "moderate" if v < mid else "high"

    calc = ce * 0.85 + math.sin(lng * 50) * 0.3
    nit  = max(0.2, ce * 0.4 + math.cos(lat * 70) * 0.2)

    return {
        "ce": ce,
        "risk": level(ce, 0.7, 3.0),
        "salinity": level(ce, 0.7, 3.0),
        "calcaire": level(calc, 0.7, 2.5),
        "nitrates": level(nit, 0.5, 1.5),
    }

# ═══════════════════════════════════════════════════
# AI ADVICE
# ═══════════════════════════════════════════════════
def get_ai_advice(pred: dict, zone: str, depth: int, culture_label: str) -> str:
    """Get advice from Claude AI, with fallback."""
    risk_ar = {
        "good": "جيدة", "moderate": "متوسطة الملوحة", "high": "ملوحة عالية"
    }[pred["risk"]]

    # Try Claude API
    if CLAUDE_KEY:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=CLAUDE_KEY)
            msg = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=500,
                system="أنت مستشار زراعي خبير في مراكش-آسفي. اكتب بالدارجة المغربية السهلة. جمل قصيرة. أسلوبك كجار ناصح.",
                messages=[{
                    "role": "user",
                    "content": f"فلاح في {zone}, بير {depth}م, زراعة {culture_label}, ماء {risk_ar} (CE={pred['ce']}). عطيه نصائح مختصرة: ماء، أسمدة، ري."
                }]
            )
            return msg.content[0].text
        except Exception as e:
            log.warning(f"Claude API error: {e}")

    # Fallback advice
    if pred["risk"] == "good":
        return (
            f"الماء ديالك مزيان والحمد لله! صالح لـ{culture_label} بلا مشاكل.\n\n"
            "كمل بالأسمدة العادية، زيد شوية بوطاس.\n\n"
            "سقي بانتظام وما تكثرش."
        )
    elif pred["risk"] == "moderate":
        return (
            f"الماء فيه شوية ملوحة. مازال صالح لـ{culture_label} ولكن دير بالك.\n\n"
            "استعمل سلفات البوطاس بلاصت كلورور. نقص الآزوت 20%.\n"
            "زيد الجبس 2 كيلو/م².\n\n"
            "زيد الماء 15% باش تغسل الملوحة. سقي بكري.\n\n"
            "دير تحليل مختبر مرة فالعام."
        )
    else:
        return (
            f"الماء فيه ملوحة عالية! خاصك تدير بالك بزاف مع {culture_label}.\n\n"
            "وقف أي سماد فيه كلور. استعمل غير سلفات البوطاس.\n\n"
            "زيد الماء 30% للغسيل. ركب فيلتر إذا ممكن.\n\n"
            "دير تحليل مختبر ضروري! شاور مهندس زراعي."
        )

# ═══════════════════════════════════════════════════
# MESSAGE FORMATTING
# ═══════════════════════════════════════════════════
def risk_emoji(level: str) -> str:
    return {"good": "✅", "moderate": "⚠️", "high": "🔴"}[level]

def format_result(pred: dict, zone: str, depth: int, culture_label: str) -> str:
    risk_label = {"good": "جودة جيدة", "moderate": "ملوحة متوسطة", "high": "ملوحة عالية"}
    return (
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📊 *نتائج تحليل المياه*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n\n"
        f"📍 المنطقة: *{zone}*\n"
        f"⛏️ العمق: *{depth} م*\n"
        f"🌱 المحصول: *{culture_label}*\n\n"
        f"{risk_emoji(pred['risk'])} *{risk_label[pred['risk']]}*\n"
        f"CE = {pred['ce']} dS/m\n\n"
        f"🧂 الملوحة: {risk_emoji(pred['salinity'])} {risk_label.get(pred['salinity'], '')}\n"
        f"🪨 الكلس: {risk_emoji(pred['calcaire'])} {risk_label.get(pred['calcaire'], '')}\n"
        f"🌿 النترات: {risk_emoji(pred['nitrates'])} {risk_label.get(pred['nitrates'], '')}\n\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"⚠️ _تقدير للمنطقة — يُوصى بتحليل مخبري_"
    )

# ═══════════════════════════════════════════════════
# CONVERSATION HANDLER
# ═══════════════════════════════════════════════════
def handle_message(phone: str, body: str, lat: float = None, lng: float = None, media_url: str = None) -> list[str]:
    """
    Process incoming message and return list of response messages.
    Returns a list because some steps send multiple messages.
    """
    body = body.strip()
    session = get_session(phone)
    step = session["step"]
    responses = []

    # ─── RESET command
    if body.lower() in ["reset", "0", "إعادة", "جديد"]:
        reset_session(phone)
        return [
            "تم البدء من جديد.\n\n"
            "مرحبا بك في *Ain Sight*\n"
            "مستشارك الزراعي لجودة المياه.\n\n"
            "أرسل اسمك للبدء:"
        ]

    # ─── STEP: welcome
    if step == "welcome":
        session["name"] = body if body else "مستخدم"
        session["step"] = "location"
        return [
            f"مرحبا *{session['name']}*! 👋\n\n"
            "أنا Ain Sight — مستشارك الزراعي.\n"
            "غادي نساعدك تعرف جودة ماء البير.\n\n"
            "📍 *أرسل لي موقع البير:*\n\n"
            "الطريقة 1: أرسل الموقع من واتساب\n"
            "  ← اضغط على 📎 ← الموقع\n\n"
            "الطريقة 2: أكتب الإحداثيات\n"
            "  مثلا: 31.63, -8.01"
        ]

    # ─── STEP: location
    if step == "location":
        # Check if location was shared via WhatsApp
        if lat is not None and lng is not None:
            session["lat"] = lat
            session["lng"] = lng
        else:
            # Try to parse coordinates from text
            try:
                parts = body.replace("،", ",").split(",")
                parsed_lat = float(parts[0].strip())
                parsed_lng = float(parts[1].strip())
                session["lat"] = parsed_lat
                session["lng"] = parsed_lng
            except (ValueError, IndexError):
                return [
                    "ما فهمتش الموقع. جرب:\n\n"
                    "1️⃣ أرسل الموقع من واتساب (📎 ← الموقع)\n"
                    "2️⃣ أو اكتب الإحداثيات: 31.63, -8.01"
                ]

        session["zone"] = get_zone(session["lat"], session["lng"])
        session["step"] = "depth"
        return [
            f"📍 تم! أنت في منطقة *{session['zone']}*\n"
            f"({session['lat']:.3f}, {session['lng']:.3f})\n\n"
            "⛏️ *شحال عمق البير بالمتر؟*\n"
            "مثلا: 50"
        ]

    # ─── STEP: depth
    if step == "depth":
        try:
            depth = int(body.replace("م", "").replace("متر", "").strip())
            if depth < 5 or depth > 500:
                return ["العمق خاصو يكون بين 5 و 500 متر. جرب مرة أخرى:"]
            session["depth"] = depth
            session["step"] = "crop"

            crop_list = "\n".join([f"  {k} ← {v[1]} ({v[2]})" for k, v in CROPS.items()])
            return [
                f"⛏️ عمق البير: *{depth} متر*\n\n"
                f"🌱 *أشنو كتزرع؟*\n"
                f"أرسل الرقم:\n\n"
                f"{crop_list}"
            ]
        except ValueError:
            return ["أرسل العمق بالأرقام فقط. مثلا: 50"]

    # ─── STEP: crop
    if step == "crop":
        choice = body.strip()
        if choice not in CROPS:
            # Try matching by name
            for k, v in CROPS.items():
                if choice in v[1] or choice.lower() in v[0]:
                    choice = k
                    break

        if choice not in CROPS:
            return ["أرسل رقم المحصول (1-5). مثلا: 1"]

        crop_id, crop_ar, crop_fr = CROPS[choice]
        session["culture"] = crop_id
        session["culture_label"] = crop_ar
        session["step"] = "result"

        # Run analysis
        pred = predict_ce(session["lat"], session["lng"], session["depth"], crop_id)

        # Get AI advice
        advice = get_ai_advice(pred, session["zone"], session["depth"], crop_ar)

        # Format result
        result_msg = format_result(pred, session["zone"], session["depth"], crop_ar)

        # Reset for next analysis
        session["step"] = "done"

        return [
            "🔬 جاري التحليل...",
            result_msg,
            f"💡 *التوصيات:*\n\n{advice}",
            "━━━━━━━━━━━━━━━━━━━━\n"
            "أرسل *جديد* لتحليل بير آخر\n"
            "أو اسأل أي سؤال على الماء والزراعة."
        ]

    # ─── STEP: done (free chat)
    if step == "done":
        if CLAUDE_KEY:
            try:
                import anthropic
                client = anthropic.Anthropic(api_key=CLAUDE_KEY)
                msg = client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=300,
                    system="أنت مستشار زراعي خبير في مراكش-آسفي. اكتب بالدارجة المغربية السهلة. جمل قصيرة.",
                    messages=[{"role": "user", "content": body}]
                )
                return [msg.content[0].text]
            except Exception:
                pass

        return [
            "شكرا على سؤالك!\n\n"
            "دابا ما قدرتش نجاوبك (مفتاح API غير مفعل).\n"
            "أرسل *جديد* لتحليل بير آخر."
        ]

    return ["أرسل *جديد* للبدء من جديد."]


# ═══════════════════════════════════════════════════
# TWILIO WEBHOOK
# ═══════════════════════════════════════════════════
@app.route("/webhook", methods=["POST"])
def webhook():
    """Twilio WhatsApp webhook handler."""
    phone = request.form.get("From", "")
    body  = request.form.get("Body", "")
    lat   = request.form.get("Latitude")
    lng   = request.form.get("Longitude")
    media = request.form.get("MediaUrl0")

    lat_f = float(lat) if lat else None
    lng_f = float(lng) if lng else None

    log.info(f"Message from {phone}: {body[:50]}{'...' if len(body)>50 else ''}")

    responses = handle_message(phone, body, lat_f, lng_f, media)

    # Send responses using Twilio REST API (for multi-message support)
    if twilio_client and len(responses) > 1:
        for msg in responses:
            twilio_client.messages.create(
                from_=TWILIO_NUM,
                to=phone,
                body=msg
            )
        return "", 200

    # Single response via TwiML
    resp = MessagingResponse()
    for msg in responses:
        resp.message(msg)
    return str(resp)


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "ainsight-whatsapp", "sessions": len(sessions)}


# ═══════════════════════════════════════════════════
# LOCAL TESTING (without Twilio)
# ═══════════════════════════════════════════════════
def test_locally():
    """Run a simulated conversation in the terminal."""
    print("=" * 50)
    print("  AinSight WhatsApp Bot — Local Test Mode")
    print("  Type messages as if you were on WhatsApp")
    print("  Type 'quit' to exit")
    print("=" * 50)

    phone = "test_user"
    # Send initial greeting
    welcome = handle_message(phone, "أحمد")
    for msg in welcome:
        print(f"\n🤖 Bot:\n{msg}")

    while True:
        user_input = input("\n👤 You: ").strip()
        if user_input.lower() == "quit":
            break

        # Check if it looks like coordinates
        lat_f, lng_f = None, None
        if "," in user_input:
            try:
                parts = user_input.replace("،", ",").split(",")
                lat_f = float(parts[0].strip())
                lng_f = float(parts[1].strip())
            except (ValueError, IndexError):
                pass

        responses = handle_message(phone, user_input, lat_f, lng_f)
        for msg in responses:
            print(f"\n🤖 Bot:\n{msg}")


# ═══════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════
if __name__ == "__main__":
    import sys
    if "--test" in sys.argv:
        test_locally()
    else:
        port = int(os.getenv("PORT", 5000))
        log.info(f"Starting AinSight WhatsApp bot on port {port}")
        log.info(f"Webhook URL: http://localhost:{port}/webhook")
        log.info(f"Twilio {'connected' if twilio_client else 'NOT configured — set TWILIO_ACCOUNT_SID'}")
        log.info(f"Claude {'connected' if CLAUDE_KEY else 'NOT configured — using fallback advice'}")
        app.run(host="0.0.0.0", port=port, debug=True)
