import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable } from '@dnd-kit/core'
import '../globals.css'

// ─────────────────────────────────────────────────────────────────
// קבועי ציר הזמן
// ─────────────────────────────────────────────────────────────────
const DAY_START_MIN = 6 * 60    // 06:00
const DAY_END_MIN   = 23 * 60   // 23:00
const PX_PER_MIN     = 1.4
const SNAP_MIN        = 15

// ברירות מחדל לשעות פעילות לפי סוג (עקבי עם BuilderPage/FlowPage)
const DEFAULT_HOURS = {
    'מוזיאון':      '09:00-17:00', 'גלריה':      '10:00-18:00',
    'שוק':          '08:00-22:00', 'שוק מקומי':  '08:00-22:00',
    'שוק לילה':     '18:00-02:00', 'פארק':       '06:00-20:00',
    'גן':           '07:00-19:00', 'מסעדה':      '12:00-23:00',
    'בר':           '17:00-02:00', 'קפה':        '07:00-22:00',
    'חוף':          '06:00-21:00', 'חוף ים':     '06:00-21:00',
    'מקדש':         '08:00-18:00', 'כנסייה':     '08:00-18:00',
    'מסגד':         '09:00-17:00', 'מצודה':      '09:00-17:00',
    'ארמון':        '09:00-17:00', 'אנדרטה':     '00:00-23:59',
    'גשר':          '00:00-23:59', 'טבע':        '06:00-20:00',
    'הר':           '06:00-20:00', 'נפלאות טבע': '06:00-20:00',
    'אטרקציה':      '09:00-18:00', 'קניון':      '10:00-22:00',
}
function getDefaultHours(type) { return DEFAULT_HOURS[type] ?? null }
function parseHours(str) {
    if (!str) return null
    const m = str.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/)
    return m ? { open: +m[1] * 60 + +m[2], close: +m[3] * 60 + +m[4] } : null
}
function parseDuration(str) {
    if (!str) return 60
    const range = str.match(/(\d+)-(\d+)\s*שעות?/)
    if (range) return Math.round(((+range[1] + +range[2]) / 2) * 60)
    const hrs = str.match(/(\d+)\s*שעות?/)
    if (hrs) return +hrs[1] * 60
    const mins = str.match(/(\d+)\s*דקות/)
    if (mins) return +mins[1]
    if (str.includes('יום')) return 360
    return 60
}
function fitsHours(att, arrivalMins) {
    const h = parseHours(att.opening_hours || getDefaultHours(att.type))
    return h ? arrivalMins >= h.open && arrivalMins < h.close : true
}
function timeToMinutes(str) {
    if (!str) return null
    const [h, m] = str.split(':').map(Number)
    return h * 60 + m
}
function minutesToTime(mins) {
    const safe = Math.round(mins)
    const h = Math.floor(safe / 60).toString().padStart(2, '0')
    const m = (safe % 60).toString().padStart(2, '0')
    return `${h}:${m}`
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)) }
function snapTo(n, step) { return Math.round(n / step) * step }

function getDayCount(trip) {
    if (!trip?.start_date || !trip?.end_date) return 1
    const start = new Date(trip.start_date + 'T00:00')
    const end   = new Date(trip.end_date + 'T00:00')
    const diff  = Math.round((end - start) / 86400000) + 1
    return diff > 0 ? diff : 1
}

// מחשב שעת התחלה לכל אטרקציה: שעה מפורשת אם קיימת, אחרת רצף מ-09:00
function withStartTimes(dayAttractions) {
    let cur = DAY_START_MIN + 180 // 09:00
    return dayAttractions.map(att => {
        const explicit = timeToMinutes(att.estimated_arrival_time)
        const start    = explicit != null ? explicit : cur
        cur = start + parseDuration(att.estimated_duration) + 20
        return { ...att, _startMin: start }
    })
}

// ─────────────────────────────────────────────────────────────────
// TimeRuler
// ─────────────────────────────────────────────────────────────────
function TimeRuler() {
    const hours = []
    for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 60) hours.push(m)
    return (
        <div style={{ position: 'relative', width: 46, flexShrink: 0 }}>
            {hours.map(m => (
                <div key={m} style={{ position: 'absolute', top: (m - DAY_START_MIN) * PX_PER_MIN - 6, right: 0, width: '100%' }}>
                    <span style={{ fontSize: 10, color: '#B5A8C0', fontWeight: 700 }}>{minutesToTime(m)}</span>
                </div>
            ))}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// TimelineBlock — גריר לשינוי שעה
// ─────────────────────────────────────────────────────────────────
function TimelineBlock({ att, top, height, dayCount, onMoveDay }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: att.id })

    const outerStyle = {
        position: 'absolute', top, left: 0, right: 0,
        height: Math.max(height, 38),
        transform: transform ? `translate3d(0px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 80 : 2,
    }

    const hasConflict = att.has_conflict

    return (
        <div ref={setNodeRef} style={outerStyle}>
            <div
                {...attributes} {...listeners}
                style={{
                    height: '100%', borderRadius: 12, padding: '5px 10px',
                    background: hasConflict ? '#fff5f5' : 'linear-gradient(135deg, #FFE4EC, #F0E8FA)',
                    border: `1.5px solid ${hasConflict ? '#fc8181' : '#FFB3C6'}`,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    overflow: 'hidden', touchAction: 'none', userSelect: 'none',
                    direction: 'rtl', boxShadow: isDragging ? '0 8px 20px rgba(255,143,171,0.4)' : 'none',
                }}
            >
                <p style={{ fontSize: 11, fontWeight: 800, color: '#4A4458', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {typeof att.icon === 'string' && att.icon.length <= 2 ? `${att.icon} ` : ''}{att.name}
                </p>
                <p style={{ fontSize: 10, color: hasConflict ? '#c53030' : '#8B7E96', marginTop: 1 }}>
                    {minutesToTime(att._startMin)}{att.estimated_duration ? ` · ${att.estimated_duration}` : ''}
                    {hasConflict ? ' ⚠️' : ''}
                </p>
            </div>

            {dayCount > 1 && (
                <button
                    onClick={(e) => { e.stopPropagation(); onMoveDay(att) }}
                    title="העבר ליום אחר"
                    style={{
                        position: 'absolute', top: 2, left: 2, zIndex: 5,
                        background: 'rgba(255,255,255,0.85)', border: '1px solid #F2DCE8',
                        borderRadius: 8, padding: '1px 6px', fontSize: 9, fontWeight: 700,
                        color: '#8B7E96', cursor: 'pointer',
                    }}
                >
                    📅 {(att.day_index ?? 0) + 1}
                </button>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// TimelineView
// ─────────────────────────────────────────────────────────────────
export default function TimelineView({ tripId, navigate }) {
    const [trip,        setTrip]        = useState(null)
    const [attractions, setAttractions] = useState([])
    const [loading,     setLoading]     = useState(true)
    const [error,       setError]       = useState(null)
    const [activeDay,   setActiveDay]   = useState(0)

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    useEffect(() => {
        if (!tripId) { navigate('dashboard'); return }
        loadAll()
    }, [tripId])

    async function loadAll() {
        setLoading(true)
        const [tripRes, attRes] = await Promise.all([
            supabase.from('trips').select('*').eq('id', tripId).single(),
            supabase.from('attractions').select('*').eq('trip_id', tripId).order('order_index'),
        ])
        if (tripRes.error) { setError(tripRes.error.message); setLoading(false); return }
        setTrip(tripRes.data)
        setAttractions(attRes.data ?? [])
        setLoading(false)
    }

    async function handleDragEnd({ active, delta }) {
        const att = dayAttractions.find(a => a.id === active.id)
        if (!att) return
        const rawMin  = att._startMin + delta.y / PX_PER_MIN
        const snapped = clamp(snapTo(rawMin, SNAP_MIN), DAY_START_MIN, DAY_END_MIN - SNAP_MIN)
        const timeStr = minutesToTime(snapped)

        setAttractions(prev => prev.map(a => a.id === att.id ? { ...a, estimated_arrival_time: timeStr } : a))
        await supabase.from('attractions').update({ estimated_arrival_time: timeStr }).eq('id', att.id)
    }

    async function moveDay(att) {
        const nextDay = ((att.day_index ?? 0) + 1) % dayCount
        setAttractions(prev => prev.map(a => a.id === att.id ? { ...a, day_index: nextDay } : a))
        await supabase.from('attractions').update({ day_index: nextDay }).eq('id', att.id)
    }

    if (loading) return (
        <div style={CENTER_SCREEN}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📊</p>
            <p style={{ color: '#8B7E96', fontSize: 14 }}>טוען ציר זמן...</p>
        </div>
    )

    if (error) return (
        <div style={CENTER_SCREEN}>
            <p style={{ fontSize: 36, marginBottom: 10 }}>⚠️</p>
            <p style={{ color: '#c53030', fontSize: 14 }}>שגיאה: {error}</p>
            <button onClick={() => navigate('flow', tripId)} style={BACK_BTN}>חזרה</button>
        </div>
    )

    const dayCount = getDayCount(trip)
    const dayAttractionsRaw = attractions
        .filter(a => (a.day_index ?? 0) === activeDay)
        .sort((a, b) => a.order_index - b.order_index)
    const dayAttractions = withStartTimes(dayAttractionsRaw)
        .map(a => ({ ...a, has_conflict: !fitsHours(a, a._startMin) }))

    const trackHeight = (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN

    return (
        <div style={{ background: '#FFF8FB', minHeight: '100vh', direction: 'rtl', paddingBottom: 40 }}>

            {/* ═══ HEADER ═══ */}
            <div style={{ background: 'linear-gradient(135deg, #FFE4EC, #F0E8FA, #E0F7FA)', padding: '52px 20px 20px', borderRadius: '0 0 36px 36px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <button onClick={() => navigate('flow', tripId)} style={{ background: 'white', border: '1px solid #F2DCE8', borderRadius: 12, padding: '8px 14px', color: '#4A4458', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,143,171,0.1)' }}>
                        ← חזרה
                    </button>
                    <p style={{ color: '#4A4458', fontSize: 16, fontWeight: 800 }}>📊 ציר זמן — {trip?.name}</p>
                </div>

                {dayCount > 1 && (
                    <div className="scroll-x" style={{ gap: 8 }}>
                        {Array.from({ length: dayCount }, (_, d) => d).map(d => (
                            <button key={d} onClick={() => setActiveDay(d)} style={{
                                flexShrink: 0, padding: '7px 16px', borderRadius: 24, cursor: 'pointer',
                                fontSize: 12, fontWeight: 700,
                                background: activeDay === d ? 'linear-gradient(135deg, #FF8FAB, #D4C2F0)' : 'white',
                                color:      activeDay === d ? 'white' : '#8B7E96',
                                border:     activeDay === d ? 'none' : '1px solid #F2DCE8',
                                boxShadow:  activeDay === d ? '0 3px 10px rgba(255,143,171,0.35)' : 'none',
                            }}>יום {d + 1}</button>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ padding: '20px 20px 0' }}>
                {dayAttractions.length === 0 ? (
                    <div style={{ background: 'white', borderRadius: 22, padding: '40px 20px', textAlign: 'center', boxShadow: '0 4px 16px rgba(255,143,171,0.1)', border: '1px solid #F2DCE8' }}>
                        <p style={{ fontSize: 38, marginBottom: 10 }}>🗺️</p>
                        <p style={{ fontSize: 15, fontWeight: 700, color: '#4A4458' }}>אין עצירות ביום הזה</p>
                        <p style={{ color: '#B5A8C0', fontSize: 13, marginTop: 6 }}>הוסיפי עצירות ב"ערוך מסלול"</p>
                    </div>
                ) : (
                    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                        <div style={{ display: 'flex', direction: 'ltr' }}>
                            <TimeRuler />
                            <div style={{ position: 'relative', flex: 1, height: trackHeight, marginRight: 10 }}>
                                {/* קווי שעה */}
                                {Array.from({ length: Math.floor((DAY_END_MIN - DAY_START_MIN) / 60) + 1 }, (_, i) => i * 60).map(m => (
                                    <div key={m} style={{ position: 'absolute', top: m * PX_PER_MIN, left: 0, right: 0, borderTop: '1px dashed #F2DCE8' }} />
                                ))}
                                {dayAttractions.map(att => (
                                    <TimelineBlock
                                        key={att.id}
                                        att={att}
                                        top={(att._startMin - DAY_START_MIN) * PX_PER_MIN}
                                        height={parseDuration(att.estimated_duration) * PX_PER_MIN}
                                        dayCount={dayCount}
                                        onMoveDay={moveDay}
                                    />
                                ))}
                            </div>
                        </div>
                    </DndContext>
                )}
            </div>
        </div>
    )
}

// ─── shared styles ───────────────────────────────────────────────
const CENTER_SCREEN = {
    background: '#FFF8FB', minHeight: '100vh',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    direction: 'rtl',
}
const BACK_BTN = {
    marginTop: 16, background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)', border: 'none', borderRadius: 14,
    padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
}
