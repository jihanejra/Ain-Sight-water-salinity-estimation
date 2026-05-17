import { useState, useEffect, useRef } from 'react'
import './App.css'

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
const API_URL = import.meta.env.VITE_API_URL ?? 'http://192.168.100.117:5001'

type Screen = 'login' | 'home' | 'map' | 'details' | 'loading' | 'results' | 'chat'
interface ChatMessage { role: 'user' | 'assistant'; content: string }
type RiskLevel = 'good' | 'moderate' | 'high'
interface WellData { lat: number; lng: number; depth: number; culture: string; cultureLabel: string; symptoms: string[]; zone: string }
interface Factor { nom_fr: string; nom_ar: string; shap: number; direction: 'up' | 'down'; value: number }
interface CropResult { key: string; nom_fr: string; nom_ar: string; seuil: number; compatible: boolean }
interface Prediction {
  ce: number; ce_rf: number; ce_krigeage: number;
  poids_rf: number; poids_krigeage: number;
  ci_lower: number; ci_upper: number;
  risk: RiskLevel; level: string; color: string;
  verdict_fr: string; verdict_ar: string;
  factors: Factor[]; cultures: CropResult[];
  culture_selected: CropResult & { key: string };
  darija_text: string;
  features: Record<string, number>;
  elapsed_ms: number;
}

// ═══════════════════════════════════════════════
// SVG ICONS (inline, no emojis)
// ═══════════════════════════════════════════════
const Icon = {
  droplet: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" /></svg>,
  map: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  layers: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 12.5-8.97 4.08a2 2 0 0 1-1.66 0L2.4 12.5" /><path d="m22 17.5-8.97 4.08a2 2 0 0 1-1.66 0L2.4 17.5" /></svg>,
  settings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>,
  check: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  arrowRight: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>,
  arrowLeft: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>,
  target: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  mic: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>,
  volume: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>,
  alert: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>,
  refresh: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>,
  user: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  shield: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>,
  satellite: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 7 9 3 5 7l4 4" /><path d="m17 11 4 4-4 4-4-4" /><path d="m8 12 4 4 6-6-4-4Z" /><path d="m16 8 3-3" /><path d="M9 21a6 6 0 0 0-6-6" /></svg>,
  leaf: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg>,
  cloud: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></svg>,
  brain: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" /><path d="M17.599 6.5a3 3 0 0 0 .399-1.375" /><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" /><path d="M3.477 10.896a4 4 0 0 1 .585-.396" /><path d="M19.938 10.5a4 4 0 0 1 .585.396" /><path d="M6 18a4 4 0 0 1-1.967-.516" /><path d="M19.967 17.484A4 4 0 0 1 18 18" /></svg>,
  messageCircle: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>,
}

// ═══════════════════════════════════════════════
// BACKEND HELPERS
// ═══════════════════════════════════════════════
function getZone(lat: number, lng: number) { return lng < -8.3 ? 'Chichaoua' : lat < 31.3 ? 'Mejjate' : 'Haouz' }
function mapLevel(level: string): RiskLevel { return level === 'safe' ? 'good' : level === 'moderate' ? 'moderate' : 'high' }

// ═══════════════════════════════════════════════
// MAP COMPONENT
// ═══════════════════════════════════════════════
function MapView({ onConfirm }: { onConfirm: (lat: number, lng: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const inst = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const boundaryRef = useRef<any>(null)
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
  const [L, setL] = useState<any>(null)
  const [gpsError, setGpsError] = useState('')
  const [outsideRegion, setOutsideRegion] = useState(false)

  // Marrakech-Safi bounds
  const REGION = { latMin: 30.5, latMax: 32.5, lonMin: -10.0, lonMax: -7.0 }
  const isInRegion = (lat: number, lng: number) =>
    lat >= REGION.latMin && lat <= REGION.latMax && lng >= REGION.lonMin && lng <= REGION.lonMax

  useEffect(() => {
    (async () => {
      if (!document.querySelector('link[href*="leaflet"]')) {
        const c = document.createElement('link'); c.rel = 'stylesheet'; c.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(c)
      }
      if (!(window as any).L) {
        await new Promise<void>(r => { const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = () => r(); document.head.appendChild(s) })
      }
      setL((window as any).L)
    })()
  }, [])

  useEffect(() => {
    if (!L || !ref.current || inst.current) return
    const map = L.map(ref.current, { center: [31.6295, -8.0082], zoom: 9, zoomControl: false })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {}).addTo(map)

    // Draw Marrakech-Safi region boundary
    const bounds = [[REGION.latMin, REGION.lonMin], [REGION.latMax, REGION.lonMax]] as any
    boundaryRef.current = L.rectangle(bounds, {
      color: '#004275', weight: 2, fillColor: '#004275', fillOpacity: 0.05, dashArray: '8, 4'
    }).addTo(map)

    // Restrict panning to region (with padding)
    const maxBounds = L.latLngBounds(
      [REGION.latMin - 0.5, REGION.lonMin - 0.5],
      [REGION.latMax + 0.5, REGION.lonMax + 0.5]
    )
    map.setMaxBounds(maxBounds)

    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng
      if (!isInRegion(lat, lng)) {
        setOutsideRegion(true)
        setPin(null)
        setTimeout(() => setOutsideRegion(false), 3000)
        return
      }
      setOutsideRegion(false)
      setPin({ lat, lng })
      if (markerRef.current) map.removeLayer(markerRef.current)
      const icon = L.divIcon({ html: `<div style="width:14px;height:14px;background:#004275;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.2)"></div>`, iconSize: [14, 14], iconAnchor: [7, 7], className: '' })
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map)
    })
    inst.current = map
    return () => { map.remove(); inst.current = null }
  }, [L])

  const gps = () => {
    if (!L || !inst.current) return
    setGpsError('')

    if (!navigator.geolocation) {
      setGpsError('الموقع غير مدعوم في هذا الجهاز')
      return
    }

    // Try high accuracy first, fallback to low accuracy
    const tryGPS = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        p => {
          const { latitude: lat, longitude: lng } = p.coords
          if (!isInRegion(lat, lng)) {
            setOutsideRegion(true)
            setGpsError('موقعك خارج منطقة مراكش-آسفي. اختر موقع داخل المنطقة.')
            setTimeout(() => setOutsideRegion(false), 4000)
            return
          }
          setOutsideRegion(false)
          setGpsError('')
          setPin({ lat, lng }); inst.current.setView([lat, lng], 13)
          if (markerRef.current) inst.current.removeLayer(markerRef.current)
          const icon = L.divIcon({ html: `<div style="width:14px;height:14px;background:#004275;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.2)"></div>`, iconSize: [14, 14], iconAnchor: [7, 7], className: '' })
          markerRef.current = L.marker([lat, lng], { icon }).addTo(inst.current)
        },
        err => {
          if (highAccuracy) {
            // Retry with low accuracy
            tryGPS(false)
          } else {
            console.error('GPS error:', err)
            if (err.code === 1) setGpsError('الرجاء السماح بالوصول للموقع في إعدادات الجهاز')
            else if (err.code === 2) setGpsError('لم نتمكن من تحديد موقعك. اختر موقعك على الخريطة')
            else setGpsError('انتهت المهلة. حاول مرة أخرى أو اختر موقعك على الخريطة')
          }
        },
        { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 8000 : 15000, maximumAge: 60000 }
      )
    }
    tryGPS(true)
  }

  return (
    <div className="h-[100dvh] relative screen-enter">
      <div ref={ref} className="absolute inset-0" />
      {/* Nav */}
      <div className="absolute top-0 left-0 right-0 z-[1000]">
        <div className="bg-white/90 backdrop-blur-sm border-b border-[#c1c7d2] px-5 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#f4f4ef] flex items-center justify-center text-[#004275]">{Icon.map}</div>
          <div className="flex-1">
            <p className="font-bold text-sm text-[#1a1c19]">حدد موقع البير</p>
            <p className="text-[#828891] text-[11px]">Localiser votre puits</p>
          </div>
          <span className="text-[#004275] text-xs font-semibold bg-[#f4f4ef] px-2.5 py-1 rounded-lg">1 / 3</span>
        </div>
      </div>
      {/* GPS */}
      <button onClick={gps} className="absolute top-20 right-4 z-[1000] bg-white rounded-xl px-4 py-2.5 text-sm font-semibold text-[#004275] shadow-lg flex items-center gap-2 active:scale-95 transition-transform border border-[#c1c7d2]">
        <span className="text-[#004275]">{Icon.target}</span> موقعي
      </button>
      {/* Region label */}
      <div className="absolute top-20 left-4 z-[1000] bg-[#004275]/90 backdrop-blur-sm rounded-xl px-3 py-2 text-xs font-semibold text-white shadow-lg">
        منطقة مراكش-آسفي
      </div>
      {/* GPS Error */}
      {gpsError && (
        <div className="absolute top-32 left-4 right-4 z-[1000] bg-[#ffdad6] border border-[#ffc2b8] rounded-xl px-4 py-3 text-sm text-[#ba1a1a] shadow-lg animate-slide-up">
          {gpsError}
        </div>
      )}
      {/* Outside region warning */}
      {outsideRegion && (
        <div className="absolute top-32 left-4 right-4 z-[1000] bg-[#fff8e1] border border-[#ffe082] rounded-xl px-4 py-3 text-sm text-[#5b4137] shadow-lg animate-slide-up flex items-center gap-2">
          <span>{Icon.alert}</span>
          <span>هاد الموقع خارج منطقة مراكش-آسفي. اختر موقع داخل المنطقة المحددة.</span>
        </div>
      )}
      {/* Confirm */}
      {pin && (
        <div className="absolute bottom-0 left-0 right-0 z-[1000] p-4 bg-gradient-to-t from-white via-white/90 to-transparent pt-10 animate-slide-up">
          <button onClick={() => onConfirm(pin.lat, pin.lng)} className="btn-primary flex items-center justify-center gap-2">
            تأكيد الموقع
            <span className="text-white/80">{Icon.check}</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState<Screen>('login')
  const [user, setUser] = useState({ name: '', phone: '' })
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [well, setWell] = useState<WellData>({ lat: 0, lng: 0, depth: 50, culture: '', cultureLabel: '', symptoms: [], zone: '' })
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [aiAdvice, setAiAdvice] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Voice features
  const [isRecording, setIsRecording] = useState(false)
  const [ttsPlayingIdx, setTtsPlayingIdx] = useState<number | null>(null)
  const [ttsLoading, setTtsLoading] = useState(false)
  const [ttsLoadingIdx, setTtsLoadingIdx] = useState<number | null>(null)
  const [loadingStep, setLoadingStep] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)

  const sendChat = async () => {
    const msg = chatInput.trim()
    if (!msg || chatLoading) return
    setChatInput('')
    const userMsg: ChatMessage = { role: 'user', content: msg }
    setChatMessages(prev => [...prev, userMsg])
    setChatLoading(true)
    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: chatMessages,
          context: prediction ? {
            ce: prediction.ce,
            ce_rf: prediction.ce_rf,
            ce_krigeage: prediction.ce_krigeage,
            poids_rf: prediction.poids_rf,
            poids_krigeage: prediction.poids_krigeage,
            ci_lower: prediction.ci_lower,
            ci_upper: prediction.ci_upper,
            zone: well.zone,
            culture: well.cultureLabel,
            level: prediction.level,
            factors: prediction.factors,
            features: prediction.features,
            cultures: prediction.cultures,
          } : {}
        })
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'عْذْرًا...' }])
    } catch { setChatMessages(prev => [...prev, { role: 'assistant', content: 'تَعَذَّرَ الِاتِّصَالْ — جَرَّبْ مَرَّة أُخْرَى.' }]) }
    setChatLoading(false)
  }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const toggle = (s: string) => setWell(w => ({ ...w, symptoms: w.symptoms.includes(s) ? w.symptoms.filter(x => x !== s) : [...w.symptoms, s] }))

  const handleLogin = async () => {
    if (!user.name.trim() || !user.phone.trim()) return
    setLoginError('')
    setLoginLoading(true)
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: user.name.trim(), phone: user.phone.trim() })
      })
      const data = await res.json()
      if (data.success) {
        setScreen('home')
      } else {
        setLoginError(data.error || 'المعلومات غير صحيحة')
      }
    } catch {
      setLoginError('تعذر الاتصال بالخادم')
    }
    setLoginLoading(false)
  }

  const analyze = async () => {
    setScreen('loading')
    setLoadingStep(0)
    // Animate loading steps
    const stepTimers = [500, 1200, 2000, 2800]
    stepTimers.forEach((t, i) => setTimeout(() => setLoadingStep(i + 1), t))
    try {
      const res = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: well.lat,
          longitude: well.lng,
          profondeur: well.depth,
          culture: well.culture,
        })
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const pred: Prediction = {
        ...data,
        risk: mapLevel(data.level),
      }
      setPrediction(pred)
      setAiAdvice('')
      setAiLoading(true)
      // Show results while AI advice loads
      setTimeout(() => setScreen('results'), 1500)
      // Call GPT for farmer-friendly advice
      try {
        const adviceRes = await fetch(`${API_URL}/generate-advice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ce: pred.ce,
            level: pred.level,
            culture: well.cultureLabel,
            culture_key: well.culture,
            factors: pred.factors,
            zone: well.zone,
          })
        })
        if (adviceRes.ok) {
          const adviceData = await adviceRes.json()
          setAiAdvice(adviceData.advice || data.darija_text || '')
        } else {
          setAiAdvice(data.darija_text || '')
        }
      } catch {
        setAiAdvice(data.darija_text || '')
      }
      setAiLoading(false)
    } catch (err) {
      console.error('Backend error:', err)
      alert('تعذر الاتصال بالخادم. تأكد أن الخادم يعمل على المنفذ 5000.\n\npython api.py')
      setScreen('details')
    }
  }

  // ── Stop any playing audio ──
  const stopAllAudio = () => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current.currentTime = 0
      const src = ttsAudioRef.current.src
      ttsAudioRef.current = null
      if (src) URL.revokeObjectURL(src)
    }
    setTtsPlayingIdx(null)
    setTtsLoadingIdx(null)
    setIsSpeaking(false)
    setTtsLoading(false)
  }

  // ── OpenAI TTS: play text as speech ──
  const playTTS = async (text: string, idx?: number) => {
    // If same source is playing, just toggle off
    const wasPlaying = ttsAudioRef.current !== null
    const wasSameIdx = idx !== undefined && idx === ttsPlayingIdx
    const wasSpeaking = idx === undefined && isSpeaking

    // Always stop current audio first
    stopAllAudio()

    // If we were playing the same thing, just stop (toggle off)
    if (wasPlaying && (wasSameIdx || wasSpeaking)) return

    try {
      if (idx !== undefined) { setTtsLoadingIdx(idx) } else { setTtsLoading(true) }
      const res = await fetch(`${API_URL}/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      if (!res.ok) throw new Error('TTS failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      ttsAudioRef.current = audio
      if (idx !== undefined) { setTtsLoadingIdx(null); setTtsPlayingIdx(idx) } else { setTtsLoading(false); setIsSpeaking(true) }
      audio.onended = () => { setTtsPlayingIdx(null); setIsSpeaking(false); ttsAudioRef.current = null; URL.revokeObjectURL(url) }
      audio.play()
    } catch (e) { console.error('TTS error:', e); stopAllAudio() }
  }

  const speak = () => playTTS(aiAdvice)

  // ── OpenAI Whisper STT: record mic ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (blob.size < 100) return
        setChatLoading(true)
        try {
          const form = new FormData()
          form.append('audio', blob, 'recording.webm')
          const res = await fetch(`${API_URL}/stt`, { method: 'POST', body: form })
          const data = await res.json()
          if (data.text) {
            setChatInput(data.text)
          }
        } catch (e) { console.error('STT error:', e) }
        setChatLoading(false)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch (e) { console.error('Mic error:', e); alert('تعذر الوصول للميكروفون') }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    setIsRecording(false)
  }

  const reset = () => { setWell({ lat: 0, lng: 0, depth: 50, culture: '', cultureLabel: '', symptoms: [], zone: '' }); setPrediction(null); setAiAdvice(''); setChatMessages([]); speechSynthesis.cancel(); setIsSpeaking(false); setScreen('map') }

  // ────────── LOGIN ──────────
  if (screen === 'login') return (
    <div className="min-h-[100dvh] bg-[#fafaf5] flex flex-col screen-enter relative">
      {/* Engineering Grid Background */}
      <div className="dot-grid-bg" />

      {/* Top Bar */}
      <header className="w-full flex justify-between items-center px-6 py-6">
        <div className="flex items-center gap-2">
          <img src="/logo.jpeg" alt="Ain Sight" className="w-8 h-8 rounded-lg object-cover" />
          <h1 className="font-headline font-extrabold tracking-wider uppercase text-[#004275] text-sm">Ain Sight | عين سايت</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#f4f4ef] rounded-full mb-6">
            {Icon.droplet}
          </div>
          <h2 className="font-headline text-2xl font-extrabold text-[#1a1c19] tracking-tight mb-2">مستشارك الزراعي</h2>
          <p className="text-[#414750] text-sm">Votre conseiller agricole pour la qualité de l'eau</p>
        </div>

        {/* Form */}
        <div className="w-full space-y-4 max-w-sm">
          <div className="relative">
            <input className="input-field pr-12" placeholder="الاسم الكامل / Nom Complet" value={user.name} onChange={e => setUser(u => ({ ...u, name: e.target.value }))} />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#727781]">{Icon.user}</span>
          </div>
          <div className="relative">
            <input className="input-field pr-12" placeholder="رقم الهاتف / Téléphone" type="tel" value={user.phone} onChange={e => setUser(u => ({ ...u, phone: e.target.value }))} />
          </div>

          <button onClick={handleLogin} disabled={!user.name.trim() || !user.phone.trim() || loginLoading}
            className="btn-primary flex items-center justify-center gap-3 mt-2">
            <span>{loginLoading ? 'جاري التحقق...' : 'دخول / Access Ledger'}</span>
            {!loginLoading && <span className="text-white/70">{Icon.arrowLeft}</span>}
          </button>

          {loginError && (
            <div className="text-[#93000a] text-sm text-center mt-3 bg-[#ffdad6] rounded-xl px-4 py-2.5">{loginError}</div>
          )}

          <div className="flex flex-col items-center gap-2 pt-4">
            <span className="text-[#414750] text-sm hover:text-[#004275] cursor-pointer transition-colors">مساعدة النظام / Aide</span>
          </div>
        </div>
      </main>

      {/* Partners Footer */}
      <footer className="w-full bg-[#f4f4ef] py-8 px-6">
        <p className="text-center font-label text-[10px] uppercase tracking-widest text-[#72778180] mb-4">الشركاء الاستراتيجيون</p>
        <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
          {[
            { icon: Icon.satellite, label: 'NASA' },
            { icon: Icon.layers, label: 'BRGM' },
            { icon: Icon.cloud, label: 'IRESEN' },
          ].map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-full bg-[#e3e3de] flex items-center justify-center text-[#414750]">{p.icon}</div>
              <span className="font-headline font-extrabold text-xs tracking-tight text-[#1a1c19]">{p.label}</span>
            </div>
          ))}
        </div>
      </footer>
    </div>
  )

  // ────────── HOME ──────────
  if (screen === 'home') return (
    <div className="min-h-[100dvh] bg-[#fafaf5] screen-enter">
      {/* Header */}
      <div className="nav-header justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden">
            <img src="/logo.jpeg" alt="Ain Sight" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-[#1a1c19] font-headline font-bold text-base">Ain Sight</h2>
        </div>
        <div className="text-center flex-1">
          <p className="text-[#727781] text-xs">مرحبا {user.name}</p>
        </div>
        <button className="text-[#828891]">{Icon.settings}</button>
      </div>

      <div className="px-5 py-5">
        {/* Hero */}
        <div className="card p-6 mb-5 animate-fade-up">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#004275] to-[#005a9c] flex items-center justify-center text-white shrink-0">
              {Icon.droplet}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-[#1a1c19]">تحليل جودة مياه البير</h2>
              <p className="text-[#727781] text-sm mt-1 leading-relaxed">احصل على تقييم شامل لجودة مياه الري وتوصيات مخصصة لمحصولك.</p>
            </div>
          </div>
          <button onClick={() => setScreen('map')} className="btn-primary mt-5 flex items-center justify-center gap-2">
            ابدأ التحليل
            <span>{Icon.arrowLeft}</span>
          </button>
        </div>

        {/* Steps */}
        <p className="text-[#727781] text-xs font-semibold mb-3 px-1">كيف يعمل التطبيق</p>
        <div className="space-y-2.5 stagger mb-6">
          {[
            { icon: Icon.map, title: 'حدد موقع البير', desc: 'اختر الموقع على الخريطة', n: '1' },
            { icon: Icon.layers, title: 'أدخل المعلومات', desc: 'عمق البير ونوع المحصول', n: '2' },
            { icon: Icon.brain, title: 'احصل على التوصيات', desc: 'نصائح مخصصة من الذكاء الاصطناعي', n: '3' },
          ].map((s, i) => (
            <div key={i} className="card px-4 py-3.5 flex items-center gap-3.5 animate-fade-up opacity-0">
              <div className="w-8 h-8 rounded-lg bg-[#f4f4ef] flex items-center justify-center text-[#004275] shrink-0 text-sm font-bold">{s.n}</div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-[#1a1c19]">{s.title}</p>
                <p className="text-[#828891] text-xs">{s.desc}</p>
              </div>
              <span className="text-[#c1c7d2]">{Icon.arrowLeft}</span>
            </div>
          ))}
        </div>

        {/* Trust */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-[#727781] mb-2.5">مصادر البيانات</p>
          <div className="flex flex-wrap gap-2">
            {[
              { icon: Icon.satellite, label: 'أقمار صناعية' },
              { icon: Icon.layers, label: 'BRGM جيولوجيا' },
              { icon: Icon.cloud, label: 'NASA POWER' },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-[#e3e3de] rounded-lg px-3 py-2 text-xs font-medium text-[#414750]">
                <span className="text-[#828891]">{b.icon}</span>
                {b.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  // ────────── MAP ──────────
  if (screen === 'map') return <MapView onConfirm={(lat, lng) => { setWell(w => ({ ...w, lat, lng, zone: getZone(lat, lng) })); setScreen('details') }} />

  // ────────── DETAILS ──────────
  if (screen === 'details') {
    const crops = [
      { id: 'olivier', label: 'زيتون', desc: 'Olivier' },
      { id: 'tomate', label: 'طماطم', desc: 'Tomate' },
      { id: 'agrumes', label: 'لبرتقال', desc: 'Agrumes' },
      { id: 'pasteque', label: 'دلاح', desc: 'Pastèque' },
      { id: 'ble', label: 'القمح', desc: 'Blé' },
      { id: 'luzerne', label: 'الفصة', desc: 'Luzerne' },
      { id: 'palmier', label: 'النخل', desc: 'Palmier' },
      { id: 'mais', label: 'الدرا', desc: 'Maïs' },
    ]
    const syms = [
      { id: 'yellowing', label: 'اصفرار الأوراق' },
      { id: 'clogging', label: 'انسداد التنقيط' },
      { id: 'yield', label: 'انخفاض المحصول' },
      { id: 'deposits', label: 'ترسبات بيضاء' },
    ]
    return (
      <div className="min-h-[100dvh] bg-[#fafaf5] pb-28 screen-enter">
        <div className="nav-header justify-between">
          <button onClick={() => setScreen('map')} className="text-[#004275] p-1">{Icon.arrowRight}</button>
          <span className="text-[#1a1c19] font-bold text-sm">معلومات البير</span>
          <span className="text-[#004275] text-xs font-semibold bg-[#f4f4ef] px-2.5 py-1 rounded-lg">2 / 3</span>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Depth */}
          <div className="card p-5 animate-fade-up">
            <p className="font-bold text-[#1a1c19] mb-0.5">عمق البير</p>
            <p className="text-[#828891] text-xs mb-5">Profondeur du puits</p>
            <div className="text-center mb-5">
              <span className="text-4xl font-extrabold text-[#004275]">{well.depth}</span>
              <span className="text-[#005a9c] text-lg font-bold mr-1">م</span>
            </div>
            <input type="range" min={10} max={200} step={5} value={well.depth} onChange={e => setWell(w => ({ ...w, depth: +e.target.value }))} />
            <div className="flex justify-between text-[10px] text-[#828891] mt-2" style={{ direction: 'ltr' }}>
              <span>10</span><span>100</span><span>200</span>
            </div>
          </div>

          {/* Crops */}
          <div className="card p-5 animate-fade-up" style={{ animationDelay: '.08s', opacity: 0 }}>
            <p className="font-bold text-[#1a1c19] mb-0.5">نوع المحصول</p>
            <p className="text-[#828891] text-xs mb-4">Culture pratiquée</p>
            <div className="grid grid-cols-2 gap-2.5">
              {crops.map(c => (
                <button key={c.id} onClick={() => setWell(w => ({ ...w, culture: c.id, cultureLabel: c.label }))}
                  className={`rounded-xl p-3.5 text-right transition-all active:scale-95 border ${well.culture === c.id
                    ? 'bg-[#f4f4ef] border-[#004275] shadow-sm'
                    : 'bg-white border-[#c1c7d2] hover:border-[#828891]'}`}>
                  {well.culture === c.id && <span className="float-left text-[#004275]">{Icon.check}</span>}
                  <p className="font-semibold text-sm text-[#1a1c19]">{c.label}</p>
                  <p className="text-[#828891] text-[10px]">{c.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Symptoms */}
          <div className="card p-5 animate-fade-up" style={{ animationDelay: '.16s', opacity: 0 }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-[#1a1c19]">أعراض ملاحظة</p>
                <p className="text-[#828891] text-xs">اختياري</p>
              </div>
            </div>
            <div className="space-y-2">
              {syms.map(s => (
                <button key={s.id} onClick={() => toggle(s.id)}
                  className="w-full flex items-center justify-between bg-[#fafaf5] rounded-xl px-4 py-3 border border-[#c1c7d2] active:scale-[.98] transition-all">
                  <span className="text-sm text-[#414750]">{s.label}</span>
                  <div className={`toggle ${well.symptoms.includes(s.id) ? 'on' : ''}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-[430px] mx-auto p-4 bg-gradient-to-t from-[#fafaf5] via-[#fafaf5]/95 to-transparent pt-8">
            {!well.culture && <p className="text-center text-[#828891] text-xs mb-2">اختر نوع المحصول أولا</p>}
            <button onClick={analyze} disabled={!well.culture} className="btn-primary flex items-center justify-center gap-2">
              تحليل جودة المياه
              <span>{Icon.arrowLeft}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ────────── LOADING ──────────
  if (screen === 'loading') {
    const steps = [
      { icon: Icon.satellite, t: 'جمع بيانات الأقمار الصناعية', sub: 'Données satellites' },
      { icon: Icon.layers, t: 'تحليل جيولوجيا المنطقة', sub: 'Géologie régionale' },
      { icon: Icon.cloud, t: 'معالجة بيانات المناخ', sub: 'Données climatiques' },
      { icon: Icon.brain, t: 'تحليل الذكاء الاصطناعي', sub: 'Analyse IA' },
    ]
    const loadingMessages = [
      'جاري البحث عن بيانات موقعك...',
      'نحلل خصائص المنطقة...',
      'نقارن مع قاعدة البيانات...',
      'الذكاء الاصطناعي يعمل على التحليل...',
      'جاري تحضير النتائج...',
    ]
    return (
      <div className="h-[100dvh] bg-gradient-to-b from-white via-[#f4f4ef] to-white flex flex-col items-center justify-center px-8 screen-enter">
        {/* Animated Logo */}
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-xl animate-pulse-slow">
            <img src="/logo.jpeg" alt="Ain Sight" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -inset-3 rounded-3xl border-2 border-[#004275]/20 animate-ping-slow" />
        </div>
        <h2 className="text-xl font-bold text-[#1a1c19] mb-1">جاري التحليل</h2>
        <p className="text-[#004275] text-sm font-medium mb-2 animate-fade-in">
          {loadingMessages[Math.min(loadingStep, loadingMessages.length - 1)]}
        </p>
        <p className="text-[#828891] text-xs mb-8">يرجى الانتظار قليلا...</p>
        
        <div className="w-full space-y-3">
          {steps.map((s, i) => {
            const done = loadingStep > i
            const active = loadingStep === i
            return (
              <div key={i} className={`flex items-center gap-3 transition-all duration-500 ${done || active ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  done ? 'bg-[#004275] text-white shadow-md' : active ? 'bg-[#f4f4ef] text-[#004275] border-2 border-[#004275] animate-pulse' : 'bg-[#e3e3de] text-[#828891]'
                }`}>
                  {done ? Icon.check : s.icon}
                </div>
                <div className="flex-1">
                  <span className={`text-sm font-semibold ${done ? 'text-[#004275]' : active ? 'text-[#1a1c19]' : 'text-[#828891]'}`}>{s.t}</span>
                  <p className="text-[10px] text-[#828891]">{s.sub}</p>
                </div>
                {done && (
                  <span className="text-[#004275] text-xs font-bold animate-scale-in">✓</span>
                )}
                {active && (
                  <div className="w-4 h-4 border-2 border-[#c1c7d2] border-t-[#004275] rounded-full animate-spin" />
                )}
              </div>
            )
          })}
        </div>
        
        {/* Progress bar */}
        <div className="w-full mt-8">
          <div className="h-1.5 bg-[#c1c7d2] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#004275] to-[#1261a3] rounded-full transition-all duration-700 ease-out" 
                 style={{ width: `${Math.min((loadingStep + 1) * 25, 100)}%` }} />
          </div>
          <p className="text-center text-[10px] text-[#828891] mt-2">{Math.min((loadingStep + 1) * 25, 100)}%</p>
        </div>
      </div>
    )
  }

  // ────────── RESULTS ──────────
  if (screen === 'results' && prediction) {
    const riskCfg = {
      good: { bg: 'bg-[#e8f5e9]', border: 'border-[#a0f399]', color: 'text-[#1b6d24]', label: 'جودة جيدة', fr: 'Bonne qualité', sub: 'المياه صالحة للري بدون قيود' },
      moderate: { bg: 'bg-[#fff8e1]', border: 'border-[#ffe082]', color: 'text-[#e65100]', label: 'ملوحة متوسطة', fr: 'Salinité modérée', sub: 'صالحة مع بعض الاحتياطات' },
      high: { bg: 'bg-[#ffdad6]', border: 'border-[#ffc2b8]', color: 'text-[#ba1a1a]', label: 'ملوحة عالية', fr: 'Salinité élevée', sub: 'يوصى بتحليل مخبري' },
    }[prediction.risk]

    return (
      <div className="min-h-[100dvh] bg-[#fafaf5] pb-8 screen-enter">
        <div className="nav-header justify-between">
          <button onClick={() => setScreen('details')} className="text-[#004275] p-1">{Icon.arrowRight}</button>
          <span className="text-[#1a1c19] font-bold text-sm">نتائج التحليل</span>
          <span className="text-[#004275] text-xs font-semibold bg-[#f4f4ef] px-2.5 py-1 rounded-lg">3 / 3</span>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Result banner */}
          <div className={`card ${riskCfg.bg} ${riskCfg.border} p-6 text-center animate-fade-up`}>
            <div className={`w-12 h-12 mx-auto rounded-full ${riskCfg.bg} border ${riskCfg.border} flex items-center justify-center ${riskCfg.color} mb-3`}>
              {prediction.risk === 'good' ? Icon.check : Icon.alert}
            </div>
            <h2 className={`text-xl font-extrabold ${riskCfg.color}`}>{riskCfg.label}</h2>
            <p className="text-[#727781] text-sm mt-1">{riskCfg.fr}</p>
            <p className="text-[#828891] text-xs mt-2">{riskCfg.sub}</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-[#1a1c19] font-bold text-lg">CE = {prediction.ce} dS/m</span>
            </div>
            <p className="text-[#828891] text-[10px] mt-1">IC 95%: [{prediction.ci_lower} – {prediction.ci_upper}]</p>
          </div>

          {/* SHAP Factors */}
          {prediction.factors && prediction.factors.length > 0 && (
            <div className="card p-4 animate-fade-up" style={{ animationDelay: '.08s', opacity: 0 }}>
              <p className="font-bold text-sm text-[#1a1c19] mb-3">العوامل المؤثرة</p>
              <div className="space-y-2.5">
                {prediction.factors.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${f.direction === 'up' ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#e8f5e9] text-[#1b6d24]'
                      }`}>{f.direction === 'up' ? '↑' : '↓'}</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#1a1c19]">{f.nom_ar}</p>
                      <p className="text-[#828891] text-[10px]">{f.nom_fr} = {f.value}</p>
                    </div>
                    <span className={`text-xs font-bold ${f.direction === 'up' ? 'text-[#ba1a1a]' : 'text-[#1b6d24]'}`}>
                      {f.shap > 0 ? '+' : ''}{f.shap}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Crop compatibility */}
          {prediction.cultures && (
            <div className="card p-4 animate-fade-up" style={{ animationDelay: '.12s', opacity: 0 }}>
              <p className="font-bold text-sm text-[#1a1c19] mb-3">ملاءمة المحاصيل</p>
              <div className="grid grid-cols-2 gap-2">
                {prediction.cultures.slice(0, 6).map((c, i) => (
                  <div key={i} className={`rounded-lg px-3 py-2 border text-sm flex items-center justify-between ${c.compatible ? 'bg-[#e8f5e9] border-[#a0f399]' : 'bg-[#ffdad6] border-[#ffc2b8]'
                    }`}>
                    <span className="text-[#1a1c19] font-medium">{c.nom_ar}</span>
                    <span className={`text-xs font-bold ${c.compatible ? 'text-[#1b6d24]' : 'text-[#ba1a1a]'}`}>
                      {c.compatible ? '✓' : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Advice */}
          <div className="card p-5 animate-fade-up" style={{ animationDelay: '.2s', opacity: 0 }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#f4f4ef] flex items-center justify-center text-[#004275]">{Icon.brain}</div>
                <div>
                  <p className="font-bold text-sm text-[#1a1c19]">التوصيات</p>
                  <p className="text-[#828891] text-[10px]">Recommandations</p>
                </div>
              </div>
              {aiAdvice && (
                <button onClick={speak} disabled={ttsLoading} className="flex items-center gap-1 text-[#004275] text-xs font-semibold bg-[#f4f4ef] px-3 py-1.5 rounded-lg active:scale-95 transition-transform disabled:opacity-60">
                  {ttsLoading ? (
                    <><div className="w-3.5 h-3.5 border-[1.5px] border-[#a1c9ff] border-t-[#004275] rounded-full animate-spin" /> جاري التحضير...</>
                  ) : isSpeaking ? (
                    <><span className="text-[#004275]">{Icon.volume}</span> إيقاف</>
                  ) : (
                    <><span className="text-[#004275]">{Icon.volume}</span> استمع</>
                  )}
                </button>
              )}
            </div>
            {aiLoading ? (
              <div className="text-center py-6">
                <div className="relative w-12 h-12 mx-auto mb-4">
                  <div className="w-12 h-12 border-2 border-[#c1c7d2] border-t-[#004275] rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-[#004275]">{Icon.brain}</div>
                </div>
                <p className="text-[#1a1c19] text-sm font-semibold mb-1">الذكاء الاصطناعي يعمل...</p>
                <p className="text-[#828891] text-xs">جاري تحضير نصائح مخصصة لموقعك ومحصولك</p>
                <div className="flex justify-center gap-1 mt-3">
                  <div className="w-1.5 h-1.5 bg-[#004275] rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="w-1.5 h-1.5 bg-[#004275] rounded-full animate-bounce" style={{ animationDelay: '.15s' }} />
                  <div className="w-1.5 h-1.5 bg-[#004275] rounded-full animate-bounce" style={{ animationDelay: '.3s' }} />
                </div>
              </div>
            ) : (
              <div className="text-[14px] leading-[1.9] text-[#414750] whitespace-pre-line">{aiAdvice}</div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="card p-4 bg-[#fff8e1] border-[#ffe082] animate-fade-up" style={{ animationDelay: '.3s', opacity: 0 }}>
            <div className="flex items-start gap-2">
              <span className="text-[#e65100] mt-0.5">{Icon.alert}</span>
              <div>
                <p className="text-sm text-[#5b4137] font-medium">هذا تقدير ولا يغني عن التحليل المخبري.</p>
                <p className="text-xs text-[#8d6e63] mt-0.5">Estimation régionale — une analyse en laboratoire reste recommandée.</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2.5 animate-fade-up" style={{ animationDelay: '.35s', opacity: 0 }}>
            <button onClick={() => { setChatMessages([]); setScreen('chat') }} className="btn-primary flex items-center justify-center gap-2">
              <span>{Icon.messageCircle}</span>
              اسأل المستشار
            </button>
            <button onClick={reset} className="btn-outline flex items-center justify-center gap-2">
              <span>{Icon.refresh}</span>
              تحليل جديد
            </button>
            <button onClick={() => setScreen('home')} className="btn-outline flex items-center justify-center gap-2">
              <span>{Icon.arrowRight}</span>
              العودة للرئيسية
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ────────── CHAT ──────────
  if (screen === 'chat') return (
    <div className="h-[100dvh] flex flex-col bg-[#fafaf5] screen-enter">
      {/* Header */}
      <div className="bg-white border-b border-[#c1c7d2] px-5 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => setScreen('results')} className="text-[#004275] p-1">{Icon.arrowRight}</button>
        <div className="w-9 h-9 rounded-xl overflow-hidden">
          <img src="/logo.jpeg" alt="Ain Sight" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm text-[#1a1c19]">المستشار الزراعي</p>
          <p className="text-[#828891] text-[10px]">Conseiller agricole — Darija</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Welcome message */}
        {chatMessages.length === 0 && (
          <div className="bg-white rounded-2xl rounded-tl-md p-4 max-w-[85%] shadow-sm border border-[#c1c7d2]">
            <p className="text-[14px] leading-[1.8] text-[#414750] whitespace-pre-line">
              {prediction ? `مَرْحَبَا! أَنَا لْمُسْتَشَارْ دْيَالْكْ.\n\nشُفْتْ نَتَائِجْ لْبِيرْ دْيَالْكْ — CE = ${prediction.ce} dS/m.\nسْوَّلْنِي أَيّ سُؤَالْ عْلَى لْمَا وَلَّا الزِّرَاعَة 💬` : 'مَرْحَبَا! سْوَّلْنِي أَيّ سُؤَالْ عْلَى الزِّرَاعَة وَ لْمَلْحْ 💬'}
            </p>
          </div>
        )}
        {chatMessages.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-2xl p-3.5 ${m.role === 'user'
            ? 'bg-[#004275] text-white self-end ml-auto rounded-br-md'
            : 'bg-white text-[#414750] border border-[#c1c7d2] shadow-sm rounded-tl-md'
            }`}>
            <p className="text-[14px] leading-[1.8] whitespace-pre-line">{m.content}</p>
            {m.role === 'assistant' && (
              <button onClick={() => playTTS(m.content, i)}
                disabled={ttsLoadingIdx === i}
                className="mt-2 flex items-center gap-1.5 text-[11px] text-[#004275] hover:text-[#005a9c] transition-colors disabled:opacity-60">
                {ttsLoadingIdx === i ? (
                  <><div className="w-3 h-3 border-[1.5px] border-[#a1c9ff] border-t-[#004275] rounded-full animate-spin" /> جاري تحضير الصوت...</>
                ) : ttsPlayingIdx === i ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg> إيقاف</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg> استمع 🔊</>
                )}
              </button>
            )}
          </div>
        ))}
        {chatLoading && (
          <div className="bg-white rounded-2xl rounded-tl-md p-4 max-w-[75%] shadow-sm border border-[#c1c7d2]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 border-[1.5px] border-[#c1c7d2] border-t-[#004275] rounded-full animate-spin" />
              <span className="text-[11px] text-[#004275] font-semibold">المستشار يفكر...</span>
            </div>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 bg-[#004275] rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <div className="w-2 h-2 bg-[#004275] rounded-full animate-bounce" style={{ animationDelay: '.15s' }} />
              <div className="w-2 h-2 bg-[#004275] rounded-full animate-bounce" style={{ animationDelay: '.3s' }} />
            </div>
            <p className="text-[10px] text-[#828891] mt-2">جاري معالجة سؤالك...</p>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-[#c1c7d2] px-4 py-3 flex items-center gap-2 shrink-0">
        {/* Mic button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#e3e3de] text-[#727781] border border-[#c1c7d2] hover:bg-[#c1c7d2]'
            }`}
          title={isRecording ? 'إيقاف التسجيل' : 'تسجيل صوتي 🎙️'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isRecording ? (<><line x1="4" y1="4" x2="20" y2="20" /><line x1="20" y1="4" x2="4" y2="20" /></>) : (<>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </>)}
          </svg>
        </button>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendChat()}
          placeholder={isRecording ? '🔴 جاري التسجيل...' : 'اكتب أو سجل سؤالك...'}
          className="flex-1 bg-[#e3e3de] rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#004275]/20 border border-[#c1c7d2]"
          dir="rtl"
          disabled={isRecording}
        />
        <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
          className="w-10 h-10 rounded-full bg-[#004275] text-white flex items-center justify-center shrink-0 disabled:bg-[#c1c7d2] active:scale-95 transition-transform">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        </button>
      </div>
    </div>
  )

  return null
}
