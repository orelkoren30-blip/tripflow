import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
    DndContext, closestCenter,
    KeyboardSensor, PointerSensor,
    useSensor, useSensors,
} from '@dnd-kit/core'
import {
    SortableContext, sortableKeyboardCoordinates,
    useSortable, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import '../globals.css'

// ─────────────────────────────────────────────────────────────────
// ברירות מחדל לשעות פעילות לפי סוג
// ─────────────────────────────────────────────────────────────────
const DEFAULT_HOURS = {
    'מוזיאון':      '09:00-17:00',
    'גלריה':        '10:00-18:00',
    'שוק':          '08:00-22:00',
    'שוק מקומי':    '08:00-22:00',
    'פארק':         '06:00-20:00',
    'גן':           '07:00-19:00',
    'מסעדה':        '12:00-23:00',
    'בר':           '17:00-02:00',
    'קפה':          '07:00-22:00',
    'חוף':          '06:00-21:00',
    'חוף ים':       '06:00-21:00',
    'מקדש':         '08:00-18:00',
    'כנסייה':       '08:00-18:00',
    'מסגד':         '09:00-17:00',
    'מצודה':        '09:00-17:00',
    'ארמון':        '09:00-17:00',
    'אנדרטה':       '00:00-23:59',
    'גשר':          '00:00-23:59',
    'טבע':          '06:00-20:00',
    'הר':           '06:00-20:00',
    'נפלאות טבע':   '06:00-20:00',
    'אטרקציה':      '09:00-18:00',
    'קניון':        '10:00-22:00',
    'שוק לילה':     '18:00-02:00',
}

function getDefaultHours(type) {
    if (!type) return null
    return DEFAULT_HOURS[type] ?? null
}

// ─────────────────────────────────────────────────────────────────
// פונקציות עזר
// ─────────────────────────────────────────────────────────────────

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371
    const toRad = x => x * Math.PI / 180
    const dLat  = toRad(lat2 - lat1)
    const dLon  = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.asin(Math.sqrt(a))
}

// "09:00-18:00" → { open: 540, close: 1080 }
function parseHours(str) {
    if (!str) return null
    const m = str.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/)
    if (!m) return null
    return {
        open:  parseInt(m[1]) * 60 + parseInt(m[2]),
        close: parseInt(m[3]) * 60 + parseInt(m[4]),
    }
}

// "1-2 שעות" → 90,  "30 דקות" → 30,  "יום שלם" → 360
function parseDuration(str) {
    if (!str) return 60
    const range = str.match(/(\d+)-(\d+)\s*שעות?/)
    if (range) return Math.round(((+range[1] + +range[2]) / 2) * 60)
    const hrs  = str.match(/(\d+)\s*שעות?/)
    if (hrs)   return +hrs[1] * 60
    const mins = str.match(/(\d+)\s*דקות/)
    if (mins)  return +mins[1]
    if (str.includes('יום')) return 360
    return 60
}

function minsToTime(m) {
    const totalMins = ((m % (24 * 60)) + 24 * 60) % (24 * 60)
    const h  = Math.floor(totalMins / 60)
    const mn = totalMins % 60
    return `${h.toString().padStart(2, '0')}:${mn.toString().padStart(2, '0')}`
}

// בדוק אם זמן הגעה (דקות) נכנס בתוך שעות הפעילות
function fitsHours(att, arrivalMins) {
    const hoursStr = att.opening_hours || getDefaultHours(att.type)
    const h = parseHours(hoursStr)
    if (!h) return true  // אין שעות = פתוח תמיד
    return arrivalMins >= h.open && arrivalMins < h.close
}

// ─────────────────────────────────────────────────────────────────
// אלגוריתם אופטימיזציה
// ─────────────────────────────────────────────────────────────────

const TRAVEL_MINS = 20

function calcArrivals(route) {
    let cur = 9 * 60  // 09:00
    return route.map(att => {
        const arrival  = cur
        const duration = parseDuration(att.estimated_duration)
        cur += duration + TRAVEL_MINS
        return arrival
    })
}

function buildNearestNeighborRoute(atts) {
    const withCoords    = atts.filter(a => a.latitude && a.longitude)
    const withoutCoords = atts.filter(a => !a.latitude || !a.longitude)

    if (withCoords.length === 0) return atts

    const remaining = [...withCoords]
    const result    = [remaining.splice(0, 1)[0]]
    while (remaining.length > 0) {
        const last = result[result.length - 1]
        let ni = 0, nd = Infinity
        for (let i = 0; i < remaining.length; i++) {
            const d = haversine(last.latitude, last.longitude, remaining[i].latitude, remaining[i].longitude)
            if (d < nd) { nd = d; ni = i }
        }
        result.push(remaining.splice(ni, 1)[0])
    }
    return [...result, ...withoutCoords]
}

function optimizeAttractions(attractions) {
    if (attractions.length <= 1)
        return attractions.map(a => ({ ...a, _arrival: null, has_conflict: false }))

    // 1. בנה מסלול NN
    let route = buildNearestNeighborRoute(attractions)

    // 2. חשב שעות הגעה ומצא קונפליקטים
    let arrivals = calcArrivals(route)
    const conflictIds = new Set(
        route.filter((att, i) => !fitsHours(att, arrivals[i])).map(a => a.id)
    )

    // 3. נסה להזיז כל אטרקציה עם קונפליקט למקום טוב יותר
    for (const cid of [...conflictIds]) {
        const cIdx = route.findIndex(a => a.id === cid)
        if (cIdx === -1) continue

        const att          = route[cIdx]
        const routeWithout = [...route.slice(0, cIdx), ...route.slice(cIdx + 1)]
        let   bestPos      = cIdx
        let   resolved     = false

        for (let pos = 0; pos <= routeWithout.length; pos++) {
            const testRoute    = [...routeWithout.slice(0, pos), att, ...routeWithout.slice(pos)]
            const testArrivals = calcArrivals(testRoute)
            if (fitsHours(att, testArrivals[pos])) {
                bestPos   = pos
                resolved  = true
                break
            }
        }

        if (resolved) {
            route    = [...routeWithout.slice(0, bestPos), att, ...routeWithout.slice(bestPos)]
            arrivals = calcArrivals(route)
            conflictIds.delete(cid)
        }
        // אחרת נשאר עם has_conflict: true
    }

    // 4. חשב arrivals סופי ובנה תוצאה
    const finalArrivals = calcArrivals(route)
    return route.map((att, i) => ({
        ...att,
        _arrival:     minsToTime(finalArrivals[i]),
        has_conflict: conflictIds.has(att.id),
    }))
}

// חשב קונפליקטים לאטרקציות שכבר יש להן estimated_arrival_time (מה-DB)
function recomputeConflictsFromDB(atts) {
    return atts.map(att => {
        if (!att.estimated_arrival_time) return att
        const h = parseHours(att.opening_hours || getDefaultHours(att.type))
        if (!h) return att
        const [hh, mm]   = att.estimated_arrival_time.split(':').map(Number)
        const arrivalMin = hh * 60 + mm
        return { ...att, has_conflict: arrivalMin < h.open || arrivalMin >= h.close }
    })
}

// ─────────────────────────────────────────────────────────────────
// SortableCard
// ─────────────────────────────────────────────────────────────────
function SortableCard({ att, index, onDelete, onStart, onStop, isActive, elapsed, completedDuration }) {
    const {
        attributes, listeners,
        setNodeRef, transform, transition, isDragging,
    } = useSortable({ id: att.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex:  isDragging ? 999 : 'auto',
    }

    const fmtTimer = (s) => {
        const h   = Math.floor(s / 3600).toString().padStart(2, '0')
        const m   = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
        const sec = (s % 60).toString().padStart(2, '0')
        return `${h}:${m}:${sec}`
    }

    const openingHoursText = att.opening_hours || getDefaultHours(att.type) || 'לא צוין'
    const isDefaultHours   = !att.opening_hours && !!getDefaultHours(att.type)
    const arrivalTime      = att.estimated_arrival_time ?? att._arrival ?? null
    const hasConflict      = att.has_conflict ?? false

    return (
        <div ref={setNodeRef} style={style}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>

                {/* index dot */}
                <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0f3460, #1a4a8a)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 800, fontSize: 12,
                    flexShrink: 0, zIndex: 1, marginTop: 4,
                    boxShadow: '0 3px 10px rgba(15,52,96,0.35)',
                }}>
                    {typeof att.icon === 'string' && att.icon.length <= 2 ? att.icon : index + 1}
                </div>

                {/* card body */}
                <div style={{
                    flex: 1, background: 'white', borderRadius: 18, padding: '14px 16px',
                    boxShadow: isActive
                        ? '0 0 0 2px #e96c50, 0 6px 20px rgba(233,108,80,0.18)'
                        : hasConflict
                        ? '0 0 0 2px #fc8181, 0 4px 16px rgba(252,129,129,0.2)'
                        : '0 4px 16px rgba(0,0,0,0.08)',
                    transition: 'box-shadow 0.2s',
                }}>

                    {/* name + drag handle + delete */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: 15, color: '#1a202c', lineHeight: 1.3 }}>{att.name}</p>
                            {att.type && (
                                <p style={{ color: '#718096', fontSize: 11, marginTop: 2 }}>{att.type}</p>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginRight: -4 }}>
                            {/* drag handle — only this element gets the listeners */}
                            <div
                                {...attributes}
                                {...listeners}
                                title="גרור לשינוי סדר"
                                style={{
                                    width: 32, height: 32, borderRadius: 10,
                                    background: '#f7f9fc', border: '1px solid #e2e8f0',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: isDragging ? 'grabbing' : 'grab',
                                    fontSize: 16, color: '#a0aec0',
                                    touchAction: 'none', userSelect: 'none',
                                }}
                            >
                                ⠿
                            </div>
                            <button
                                onClick={() => onDelete(att)}
                                style={{
                                    width: 32, height: 32, borderRadius: 10,
                                    background: '#fff5f5', border: 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', fontSize: 14,
                                }}
                            >
                                🗑️
                            </button>
                        </div>
                    </div>

                    {att.description && (
                        <p style={{ color: '#718096', fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
                            {att.description}
                        </p>
                    )}

                    {/* info block */}
                    <div style={{
                        background: '#f7f9fc', borderRadius: 12,
                        padding: '10px 12px', marginBottom: 10,
                    }}>
                        {/* שעות פעילות */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                            <span style={{ fontSize: 13 }}>🕐</span>
                            <span style={{ fontSize: 12, color: '#4a5568', fontWeight: 700 }}>שעות פעילות:</span>
                            <span style={{
                                fontSize: 12,
                                color: openingHoursText === 'לא צוין' ? '#a0aec0'
                                     : isDefaultHours ? '#805ad5'
                                     : '#2d3748',
                                fontStyle: isDefaultHours ? 'italic' : 'normal',
                            }}>
                                {openingHoursText}
                                {isDefaultHours && <span style={{ fontSize: 10, color: '#a0aec0', marginRight: 4 }}>*משוער</span>}
                            </span>
                        </div>

                        {/* זמן ביקור משוער */}
                        {att.estimated_duration && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: arrivalTime ? 5 : 0 }}>
                                <span style={{ fontSize: 13 }}>⏱</span>
                                <span style={{ fontSize: 12, color: '#4a5568', fontWeight: 700 }}>ביקור משוער:</span>
                                <span style={{ fontSize: 12, color: '#2d3748' }}>{att.estimated_duration}</span>
                            </div>
                        )}

                        {/* הגעה משוערת (מופיעה אחרי Optimize) */}
                        {arrivalTime && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 13 }}>🗺️</span>
                                <span style={{ fontSize: 12, color: '#4a5568', fontWeight: 700 }}>הגעה משוערת:</span>
                                <span style={{ fontSize: 12, color: '#0f3460', fontWeight: 800 }}>{arrivalTime}</span>
                            </div>
                        )}
                    </div>

                    {/* ⚠️ קונפליקט — אדום */}
                    {hasConflict && (
                        <div style={{
                            background: '#fff5f5', border: '1px solid #fc8181',
                            borderRadius: 10, padding: '8px 12px', marginBottom: 10,
                            display: 'flex', gap: 8, alignItems: 'center',
                        }}>
                            <span style={{ fontSize: 15 }}>⚠️</span>
                            <p style={{ fontSize: 11, color: '#c53030', fontWeight: 700, margin: 0 }}>
                                ייתכן שהמקום יהיה סגור בשעה זו
                            </p>
                        </div>
                    )}

                    {/* טיימר */}
                    <div style={{ borderTop: '1px solid #f0f4f8', paddingTop: 10 }}>
                        {completedDuration != null ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                                <span style={{ color: '#48bb78', fontSize: 12, fontWeight: 700 }}>
                                    ✅ זמן בפועל: {completedDuration} דקות
                                </span>
                                {att.estimated_duration && (
                                    <span style={{ color: '#a0aec0', fontSize: 11 }}>משוער: {att.estimated_duration}</span>
                                )}
                            </div>
                        ) : isActive ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                <span style={{
                                    color: '#e96c50', fontSize: 15, fontWeight: 800,
                                    fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px',
                                }}>
                                    ⏱ {fmtTimer(elapsed)}
                                </span>
                                <button
                                    onClick={() => onStop(att.id)}
                                    style={{
                                        background: 'linear-gradient(135deg, #e53e3e, #fc8181)',
                                        border: 'none', borderRadius: 10, padding: '6px 14px',
                                        color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                    }}
                                >
                                    ⏹ סיים ביקור
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => onStart(att)}
                                style={{
                                    background: 'linear-gradient(135deg, #0f3460, #1a4a8a)',
                                    border: 'none', borderRadius: 10, padding: '7px 16px',
                                    color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                    boxShadow: '0 3px 10px rgba(15,52,96,0.25)',
                                }}
                            >
                                ▶️ התחל ביקור
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// FlowPage
// ─────────────────────────────────────────────────────────────────
export default function FlowPage({ tripId, navigate }) {
    const [trip,        setTrip]        = useState(null)
    const [attractions, setAttractions] = useState([])
    const [loading,     setLoading]     = useState(true)
    const [error,       setError]       = useState(null)
    const [optimizing,  setOptimizing]  = useState(false)

    const [activeTimer,        setActiveTimer]        = useState(null)
    const [elapsed,            setElapsed]            = useState(0)
    const [completedDurations, setCompletedDurations] = useState({})
    const elapsedRef = useRef(0)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    useEffect(() => {
        if (!tripId) { navigate('dashboard'); return }
        loadAll()
    }, [tripId])

    useEffect(() => {
        if (!activeTimer) return
        const id = setInterval(() => {
            setElapsed(prev => { const n = prev + 1; elapsedRef.current = n; return n })
        }, 1000)
        return () => clearInterval(id)
    }, [activeTimer])

    async function loadAll() {
        setLoading(true)
        const [tripRes, attRes] = await Promise.all([
            supabase.from('trips').select('*').eq('id', tripId).single(),
            supabase.from('attractions').select('*').eq('trip_id', tripId).order('order_index'),
        ])
        if (tripRes.error) { setError(tripRes.error.message); setLoading(false); return }
        setTrip(tripRes.data)
        const atts = recomputeConflictsFromDB(attRes.data ?? [])
        setAttractions(atts)
        const restored = {}
        atts.forEach(a => { if (a.actual_duration_minutes != null) restored[a.id] = a.actual_duration_minutes })
        setCompletedDurations(restored)
        setLoading(false)
    }

    // ── DnD ──────────────────────────────────
    async function handleDragEnd({ active, over }) {
        if (!over || active.id === over.id) return
        const oldIdx    = attractions.findIndex(a => a.id === active.id)
        const newIdx    = attractions.findIndex(a => a.id === over.id)
        const reordered = arrayMove(attractions, oldIdx, newIdx)
        setAttractions(reordered)
        await Promise.all(
            reordered.map((att, i) =>
                supabase.from('attractions').update({ order_index: i }).eq('id', att.id)
            )
        )
    }

    // ── Optimize ─────────────────────────────
    async function optimizeFlow() {
        if (attractions.length < 2) return
        setOptimizing(true)

        const optimized = optimizeAttractions(attractions)
        setAttractions(optimized)

        await Promise.all(
            optimized.map((att, i) =>
                supabase.from('attractions').update({
                    order_index:            i,
                    estimated_arrival_time: att._arrival ?? null,
                }).eq('id', att.id)
            )
        )
        setOptimizing(false)
    }

    // ── Timer ─────────────────────────────────
    async function startVisit(att) {
        if (activeTimer) await stopVisit(activeTimer.attId)
        setActiveTimer({ attId: att.id })
        setElapsed(0); elapsedRef.current = 0
        await supabase.from('attractions')
            .update({ actual_start_time: new Date().toISOString() })
            .eq('id', att.id)
    }

    async function stopVisit(attId) {
        const mins = Math.max(1, Math.round(elapsedRef.current / 60))
        setCompletedDurations(prev => ({ ...prev, [attId]: mins }))
        setActiveTimer(null); setElapsed(0); elapsedRef.current = 0
        await supabase.from('attractions')
            .update({ actual_duration_minutes: mins })
            .eq('id', attId)
    }

    // ── Delete ────────────────────────────────
    async function deleteAttraction(att) {
        if (activeTimer?.attId === att.id) {
            setActiveTimer(null); setElapsed(0); elapsedRef.current = 0
        }
        await supabase.from('attractions').delete().eq('id', att.id)
        await supabase.from('trips').update({ stops: attractions.length - 1 }).eq('id', tripId)
        setAttractions(prev => prev.filter(a => a.id !== att.id))
        setCompletedDurations(prev => { const n = { ...prev }; delete n[att.id]; return n })
    }

    // ── Date label ────────────────────────────
    const dateLabel = (() => {
        if (!trip?.start_date && !trip?.end_date) return null
        const opts = { day: 'numeric', month: 'short' }
        return [trip?.start_date, trip?.end_date]
            .filter(Boolean)
            .map(d => new Date(d + 'T12:00').toLocaleDateString('he-IL', opts))
            .join(' – ')
    })()

    // ── RENDER ────────────────────────────────
    if (loading) return (
        <div style={CENTER_SCREEN}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>✈️</p>
            <p style={{ color: '#718096', fontSize: 14 }}>טוען טיול...</p>
        </div>
    )

    if (error) return (
        <div style={CENTER_SCREEN}>
            <p style={{ fontSize: 36, marginBottom: 10 }}>⚠️</p>
            <p style={{ color: '#e53e3e', fontSize: 14 }}>שגיאה: {error}</p>
            <button onClick={() => navigate('dashboard')} style={BACK_BTN}>חזרה</button>
        </div>
    )

    const conflictCount = attractions.filter(a => a.has_conflict).length

    return (
        <div style={{ background: '#F7F9FC', minHeight: '100vh', direction: 'rtl', paddingBottom: 40 }}>

            {/* ═══ HERO ═══ */}
            <div style={{ position: 'relative', height: 260 }}>
                {trip.cover_image_url
                    ? <img src={trip.cover_image_url} alt={trip.name}
                           style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{
                        width: '100%', height: '100%',
                        background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72,
                      }}>
                        {trip.cover_emoji || '🗺️'}
                      </div>
                }
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.3) 100%)' }} />

                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '52px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={() => navigate('dashboard')} style={HERO_BTN}>← חזרה</button>
                    <button onClick={() => navigate('builder', tripId)} style={EDIT_BTN}>✏️ ערוך מסלול</button>
                </div>

                <div style={{ position: 'absolute', bottom: 20, right: 20, left: 20 }}>
                    {dateLabel && <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 6 }}>📅 {dateLabel}</p>}
                    <h1 style={{ color: 'white', fontSize: 26, fontWeight: 900, marginBottom: 6 }}>{trip.name}</h1>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>📍 {attractions.length} עצירות</p>
                </div>
            </div>

            {/* ═══ TIMELINE ═══ */}
            <div style={{ padding: '24px 20px' }}>

                {/* header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                        <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1a202c' }}>מסלול הטיול</h2>
                        {conflictCount > 0 && (
                            <p style={{ color: '#c53030', fontSize: 11, fontWeight: 700, marginTop: 2 }}>
                                ⚠️ {conflictCount} עצירות עם קונפליקט בשעות פעילות
                            </p>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {activeTimer && (
                            <span style={{ background: 'linear-gradient(135deg, #e96c50, #f4a261)', color: 'white', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>
                                ⏱ פעיל
                            </span>
                        )}
                        {attractions.length >= 2 && (
                            <button
                                onClick={optimizeFlow}
                                disabled={optimizing}
                                style={{
                                    background: optimizing ? '#e2e8f0' : 'linear-gradient(135deg, #6b46c1, #805ad5)',
                                    border: 'none', borderRadius: 12, padding: '8px 14px',
                                    color: optimizing ? '#718096' : 'white',
                                    fontSize: 12, fontWeight: 700,
                                    cursor: optimizing ? 'not-allowed' : 'pointer',
                                    boxShadow: optimizing ? 'none' : '0 3px 12px rgba(107,70,193,0.4)',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {optimizing ? '⏳ מסדר...' : '✨ Optimize My Flow'}
                            </button>
                        )}
                    </div>
                </div>

                {attractions.length === 0 ? (
                    <div style={{ background: 'white', borderRadius: 22, padding: '40px 20px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}>
                        <p style={{ fontSize: 38, marginBottom: 10 }}>🗺️</p>
                        <p style={{ fontSize: 15, fontWeight: 700, color: '#1a202c' }}>המסלול ריק</p>
                        <p style={{ color: '#a0aec0', fontSize: 13, marginTop: 6 }}>לחצי על "ערוך מסלול" להוספת עצירות</p>
                        <button onClick={() => navigate('builder', tripId)} style={{ marginTop: 18, background: 'linear-gradient(135deg, #e96c50, #f4a261)', border: 'none', borderRadius: 14, padding: '12px 24px', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                            ✏️ בני את המסלול
                        </button>
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={attractions.map(a => a.id)} strategy={verticalListSortingStrategy}>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', top: 18, bottom: 18, right: 13, width: 2, background: '#0f3460', opacity: 0.12, borderRadius: 1 }} />
                                {attractions.map((att, index) => (
                                    <SortableCard
                                        key={att.id}
                                        att={att}
                                        index={index}
                                        onDelete={deleteAttraction}
                                        onStart={startVisit}
                                        onStop={stopVisit}
                                        isActive={activeTimer?.attId === att.id}
                                        elapsed={activeTimer?.attId === att.id ? elapsed : 0}
                                        completedDuration={completedDurations[att.id] ?? null}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}

                {attractions.length > 0 && (
                    <button
                        onClick={() => navigate('builder', tripId)}
                        style={{
                            width: '100%', marginTop: 8, padding: '14px', borderRadius: 18,
                            border: '2px dashed #e2e8f0', background: 'transparent',
                            cursor: 'pointer', color: '#718096', fontSize: 14, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}
                    >
                        <span style={{ fontSize: 18 }}>+</span> הוסיפי עצירה
                    </button>
                )}
            </div>
        </div>
    )
}

// ─── shared styles ───────────────────────────────────────────────
const CENTER_SCREEN = {
    background: '#F7F9FC', minHeight: '100vh',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    direction: 'rtl',
}

const BACK_BTN = {
    marginTop: 16, background: '#0f3460', border: 'none', borderRadius: 14,
    padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
}

const HERO_BTN = {
    background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 12, padding: '8px 14px', color: 'white', fontSize: 13,
    fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(8px)',
}

const EDIT_BTN = {
    background: 'linear-gradient(135deg, #e96c50, #f4a261)', border: 'none',
    borderRadius: 12, padding: '8px 16px', color: 'white', fontSize: 13,
    fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(233,108,80,0.5)',
}
