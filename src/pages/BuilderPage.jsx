import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ATTRACTIONS_BY_DESTINATION } from '../data/attractionsByDestination'
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
import StatusBadge from '../components/StatusBadge'
import '../globals.css'

// ─────────────────────────────────────────────────────────────────
const DEFAULT_HOURS_BY_TYPE = {
    'מוזיאון':    '09:00-17:00', 'גלריה':      '10:00-18:00',
    'שוק':        '08:00-22:00', 'שוק מקומי':  '08:00-22:00',
    'שוק לילה':   '18:00-02:00', 'פארק':       '06:00-20:00',
    'גן':         '07:00-19:00', 'מסעדה':      '12:00-23:00',
    'בר':         '17:00-02:00', 'קפה':        '07:00-22:00',
    'חוף':        '06:00-21:00', 'חוף ים':     '06:00-21:00',
    'מקדש':       '08:00-18:00', 'כנסייה':     '08:00-18:00',
    'מסגד':       '09:00-17:00', 'מצודה':      '09:00-17:00',
    'ארמון':      '09:00-17:00', 'אנדרטה':     '00:00-23:59',
    'גשר':        '00:00-23:59', 'טבע':        '06:00-20:00',
    'הר':         '06:00-20:00', 'נפלאות טבע': '06:00-20:00',
    'אטרקציה':    '09:00-18:00', 'קניון':      '10:00-22:00',
}
function getDefaultHours(type) { return DEFAULT_HOURS_BY_TYPE[type] ?? null }

// ─────────────────────────────────────────────────────────────────
// אלגוריתם אופטימיזציה
// ─────────────────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, toRad = x => x * Math.PI / 180
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.asin(Math.sqrt(a))
}
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
function calcArrivals(route) {
    let cur = 9 * 60
    return route.map(att => { const a = cur; cur += parseDuration(att.estimated_duration) + 20; return a })
}
function fitsHours(att, arrivalMins) {
    const h = parseHours(att.opening_hours || getDefaultHours(att.type))
    return h ? arrivalMins >= h.open && arrivalMins < h.close : true
}
function buildNNRoute(atts) {
    const withCoords = atts.filter(a => a.latitude && a.longitude)
    const without    = atts.filter(a => !a.latitude || !a.longitude)
    if (!withCoords.length) return atts
    const rem = [...withCoords], result = [rem.splice(0, 1)[0]]
    while (rem.length) {
        const last = result[result.length - 1]
        let ni = 0, nd = Infinity
        for (let i = 0; i < rem.length; i++) {
            const d = haversine(last.latitude, last.longitude, rem[i].latitude, rem[i].longitude)
            if (d < nd) { nd = d; ni = i }
        }
        result.push(rem.splice(ni, 1)[0])
    }
    return [...result, ...without]
}
function optimizeAttractions(attractions) {
    if (attractions.length <= 1) return attractions.map(a => ({ ...a, has_conflict: false }))
    let route = buildNNRoute(attractions)
    let arrivals = calcArrivals(route)
    const conflictIds = new Set(route.filter((att, i) => !fitsHours(att, arrivals[i])).map(a => a.id))
    for (const cid of [...conflictIds]) {
        const cIdx = route.findIndex(a => a.id === cid)
        if (cIdx < 0) continue
        const att = route[cIdx], rest = [...route.slice(0, cIdx), ...route.slice(cIdx + 1)]
        for (let pos = 0; pos <= rest.length; pos++) {
            const test = [...rest.slice(0, pos), att, ...rest.slice(pos)]
            if (fitsHours(att, calcArrivals(test)[pos])) {
                route = test; arrivals = calcArrivals(route); conflictIds.delete(cid); break
            }
        }
    }
    return route.map(att => ({ ...att, has_conflict: conflictIds.has(att.id) }))
}

// ─────────────────────────────────────────────────────────────────
// SortableItem
// ─────────────────────────────────────────────────────────────────
function SortableItem({ att, index, onDelete, onStatusChange }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: att.id })
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 999 : 'auto' }
    const openingHoursText = att.opening_hours || getDefaultHours(att.type) || 'לא צוין'
    const isDefaultHours   = !att.opening_hours && !!getDefaultHours(att.type)
    const hasConflict      = att.has_conflict ?? false

    return (
        <div ref={setNodeRef} style={style}>
            <div style={{
                background: 'white', borderRadius: 18, padding: '14px 16px', marginBottom: 10,
                boxShadow: hasConflict
                    ? '0 0 0 2px #fc8181, 0 4px 16px rgba(252,129,129,0.15)'
                    : '0 4px 16px rgba(255,143,171,0.12)',
                display: 'flex', alignItems: 'flex-start', gap: 12,
                border: hasConflict ? '1px solid #fecaca' : '1px solid #F2DCE8',
            }}>
                {/* מספר */}
                <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                    background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 800, fontSize: 13,
                    boxShadow: '0 3px 10px rgba(255,143,171,0.35)',
                }}>
                    {typeof att.icon === 'string' && att.icon.length <= 2 ? att.icon : index + 1}
                </div>

                {/* תוכן */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <p style={{ fontWeight: 700, fontSize: 14, color: '#4A4458' }}>{att.name}</p>
                        <StatusBadge status={att.status} onChange={(s) => onStatusChange(att, s)} />
                    </div>
                    {att.type && <p style={{ color: '#8B7E96', fontSize: 11, marginTop: 2 }}>{att.type}</p>}
                    {att.description && (
                        <p style={{ color: '#B5A8C0', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {att.description}
                        </p>
                    )}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: hasConflict ? '#fff5f5' : '#FFF8FB',
                        border: `1px solid ${hasConflict ? '#fecaca' : '#F2DCE8'}`,
                        borderRadius: 8, padding: '3px 9px', marginTop: 7,
                    }}>
                        <span style={{ fontSize: 11 }}>🕐</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#4A4458' }}>שעות פעילות:</span>
                        <span style={{
                            fontSize: 11,
                            color: openingHoursText === 'לא צוין' ? '#B5A8C0'
                                 : isDefaultHours ? '#9B7ED4'
                                 : '#4A4458',
                        }}>
                            {openingHoursText}
                            {isDefaultHours && <span style={{ color: '#D4C2F0', marginRight: 3 }}>*</span>}
                        </span>
                    </div>
                    {hasConflict && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                            <span style={{ fontSize: 12 }}>⚠️</span>
                            <span style={{ fontSize: 11, color: '#c53030', fontWeight: 700 }}>ייתכן שהמקום יהיה סגור בשעה המתוכננת</span>
                        </div>
                    )}
                </div>

                {/* drag + מחיקה */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <div {...attributes} {...listeners} title="גרור לשינוי סדר" style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: '#FFF8FB', border: '1px solid #F2DCE8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: isDragging ? 'grabbing' : 'grab',
                        fontSize: 16, color: '#B5A8C0',
                        touchAction: 'none', userSelect: 'none',
                    }}>⠿</div>
                    <button onClick={() => onDelete(att)} style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: '#fff5f5', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: 14,
                    }}>🗑️</button>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// BuilderPage
// ─────────────────────────────────────────────────────────────────
const INPUT = {
    width: '100%', padding: '13px 16px',
    borderRadius: 14, border: '1px solid #F2DCE8',
    background: '#FFF8FB', fontSize: 14, color: '#4A4458',
    outline: 'none', direction: 'rtl', marginBottom: 12,
}

export default function BuilderPage({ tripId, navigate }) {
    const [trip,        setTrip]        = useState(null)
    const [attractions, setAttractions] = useState([])
    const [loading,     setLoading]     = useState(true)
    const [error,       setError]       = useState(null)
    const [tab,         setTab]         = useState('preset')
    const [form,        setForm]        = useState({ name: '', description: '' })
    const [saving,      setSaving]      = useState(false)
    const [addingId,    setAddingId]    = useState(null)
    const [presetError, setPresetError] = useState(null)
    const [optimizing,  setOptimizing]  = useState(false)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

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

    async function addPreset(preset) {
        if (addingId === preset.name) return
        if (attractions.some(a => a.name === preset.name)) return
        setAddingId(preset.name); setPresetError(null)
        const { error } = await supabase.from('attractions').insert({
            trip_id: tripId, name: preset.name, description: preset.description,
            type: preset.type, icon: preset.icon,
            latitude:  typeof preset.latitude  === 'number' ? preset.latitude  : parseFloat(preset.latitude),
            longitude: typeof preset.longitude === 'number' ? preset.longitude : parseFloat(preset.longitude),
            order_index: attractions.length,
            opening_hours: preset.openingHours ?? null,
            estimated_duration: preset.estimatedDuration ?? null,
        })
        if (error) setPresetError(`שגיאה בהוספת "${preset.name}": ${error.message}`)
        else { await supabase.from('trips').update({ stops: attractions.length + 1 }).eq('id', tripId); await loadAll() }
        setAddingId(null)
    }

    function setField(field) { return e => setForm(prev => ({ ...prev, [field]: e.target.value })) }

    async function addManual(e) {
        e.preventDefault()
        if (!form.name.trim()) return
        setSaving(true); setError(null)
        const { error } = await supabase.from('attractions').insert({
            trip_id: tripId, name: form.name.trim(), description: form.description.trim(), order_index: attractions.length,
        })
        if (error) { setError(error.message); setSaving(false); return }
        await supabase.from('trips').update({ stops: attractions.length + 1 }).eq('id', tripId)
        setForm({ name: '', description: '' }); await loadAll(); setSaving(false)
    }

    async function deleteAttraction(att) {
        await supabase.from('attractions').delete().eq('id', att.id)
        await supabase.from('trips').update({ stops: attractions.length - 1 }).eq('id', tripId)
        setAttractions(prev => prev.filter(a => a.id !== att.id))
    }

    async function updateStatus(att, status) {
        setAttractions(prev => prev.map(a => a.id === att.id ? { ...a, status } : a))
        await supabase.from('attractions').update({ status }).eq('id', att.id)
    }

    async function handleDragEnd({ active, over }) {
        if (!over || active.id === over.id) return
        const oldIdx = attractions.findIndex(a => a.id === active.id)
        const newIdx = attractions.findIndex(a => a.id === over.id)
        const reordered = arrayMove(attractions, oldIdx, newIdx)
        setAttractions(reordered)
        await Promise.all(reordered.map((att, i) => supabase.from('attractions').update({ order_index: i }).eq('id', att.id)))
    }

    async function autoSort() {
        if (attractions.length < 2) return
        setOptimizing(true)
        const optimized = optimizeAttractions(attractions)
        setAttractions(optimized)
        await Promise.all(optimized.map((att, i) => supabase.from('attractions').update({ order_index: i }).eq('id', att.id)))
        setOptimizing(false)
    }

    const destName   = trip?.destination ?? trip?.name ?? ''
    const presetList = ATTRACTIONS_BY_DESTINATION[destName] ?? []
    const addedNames = new Set(attractions.map(a => a.name))
    const hasPresets = presetList.length > 0

    return (
        <div style={{ background: '#FFF8FB', minHeight: '100vh', direction: 'rtl' }}>

            {/* ═══ HEADER ═══ */}
            <div style={{ background: 'linear-gradient(135deg, #FFE4EC, #F0E8FA, #E0F7FA)', padding: '52px 20px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => navigate('flow', tripId)} style={{ background: 'white', border: '1px solid #F2DCE8', borderRadius: 12, padding: '8px 14px', color: '#4A4458', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,143,171,0.1)' }}>
                    ← חזרה
                </button>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#8B7E96', fontSize: 11 }}>בניית מסלול</p>
                    <p style={{ color: '#4A4458', fontSize: 16, fontWeight: 800 }}>{trip?.name ?? '...'}</p>
                    {destName && <p style={{ color: '#B5A8C0', fontSize: 11, marginTop: 2 }}>📍 {destName}</p>}
                </div>
                <button onClick={() => navigate('flow', tripId)} style={{ background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)', border: 'none', borderRadius: 12, padding: '8px 16px', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,143,171,0.4)' }}>
                    ✓ סיום
                </button>
            </div>

            <div style={{ padding: '20px 20px 80px' }}>

                {/* ═══ TABS ═══ */}
                <div style={{ display: 'flex', background: 'white', borderRadius: 18, padding: 4, boxShadow: '0 2px 12px rgba(255,143,171,0.1)', marginBottom: 20, border: '1px solid #F2DCE8' }}>
                    {[
                        { key: 'preset', label: `🎯 המלצות ליעד${hasPresets ? ` (${presetList.length})` : ''}` },
                        { key: 'manual', label: '✏️ הוסיפי ידנית' },
                    ].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)} style={{
                            flex: 1, padding: '11px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
                            fontSize: 13, fontWeight: 700,
                            background: tab === t.key ? 'linear-gradient(135deg, #FF8FAB, #D4C2F0)' : 'transparent',
                            color:      tab === t.key ? 'white' : '#8B7E96',
                            boxShadow:  tab === t.key ? '0 3px 10px rgba(255,143,171,0.35)' : 'none',
                            transition: 'all 0.2s',
                        }}>{t.label}</button>
                    ))}
                </div>

                {/* ═══ PRESET TAB ═══ */}
                {tab === 'preset' && (
                    <div>
                        {!hasPresets ? (
                            <div style={{ background: 'white', borderRadius: 22, padding: '32px 20px', textAlign: 'center', boxShadow: '0 4px 16px rgba(255,143,171,0.1)', marginBottom: 24, border: '1px solid #F2DCE8' }}>
                                <p style={{ fontSize: 36, marginBottom: 10 }}>🔍</p>
                                <p style={{ fontSize: 15, fontWeight: 700, color: '#4A4458' }}>אין המלצות ליעד זה</p>
                                <p style={{ color: '#B5A8C0', fontSize: 13, marginTop: 6 }}>עברי לטאב "הוסיפי ידנית" להוספת מקומות</p>
                            </div>
                        ) : (
                            <>
                                {presetError && (
                                    <div style={{ background: '#FFEFE0', border: '1px solid #FFD4B8', borderRadius: 14, padding: '12px 14px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ color: '#B45309', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{presetError}</p>
                                            <p style={{ color: '#D97706', fontSize: 11 }}>
                                                אם השגיאה חוזרת, הריצי ב-Supabase SQL Editor:<br />
                                                <code style={{ background: '#fff7ed', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>
                                                    ALTER TABLE attractions ADD COLUMN IF NOT EXISTS opening_hours text, ADD COLUMN IF NOT EXISTS estimated_duration text;
                                                </code>
                                            </p>
                                        </div>
                                        <button onClick={() => setPresetError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D97706', fontSize: 16 }}>✕</button>
                                    </div>
                                )}
                                <p style={{ color: '#8B7E96', fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
                                    בחרי מקומות להוסיף למסלול שלך ב{destName}:
                                </p>
                                {presetList.map(preset => {
                                    const isAdded   = addedNames.has(preset.name)
                                    const isLoading = addingId === preset.name
                                    return (
                                        <div key={preset.name} style={{
                                            background: 'white', borderRadius: 18, padding: '14px 16px',
                                            marginBottom: 10, boxShadow: '0 4px 16px rgba(255,143,171,0.1)',
                                            display: 'flex', alignItems: 'center', gap: 14,
                                            opacity: isAdded ? 0.65 : 1,
                                            border: '1px solid #F2DCE8',
                                        }}>
                                            <div style={{ width: 48, height: 48, borderRadius: 16, background: isAdded ? '#E8F8F0' : 'linear-gradient(135deg, #FFF8FB, #F2DCE8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                                                {preset.icon}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontWeight: 700, fontSize: 14, color: '#4A4458' }}>{preset.name}</p>
                                                <p style={{ color: '#8B7E96', fontSize: 11, marginTop: 2 }}>{preset.type}</p>
                                                <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                                                    {preset.estimatedDuration && (
                                                        <span style={{ color: '#B5A8C0', fontSize: 10 }}>⏱ {preset.estimatedDuration}</span>
                                                    )}
                                                    {preset.openingHours && (
                                                        <span style={{ color: '#B5A8C0', fontSize: 10 }}>🕐 {preset.openingHours}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => !isAdded && addPreset(preset)}
                                                disabled={isAdded || isLoading}
                                                style={{
                                                    flexShrink: 0, width: 40, height: 40, borderRadius: 12, border: 'none',
                                                    cursor: isAdded ? 'default' : 'pointer',
                                                    background: isAdded
                                                        ? 'linear-gradient(135deg, #48bb78, #38a169)'
                                                        : isLoading ? '#F2DCE8'
                                                        : 'linear-gradient(135deg, #FF8FAB, #D4C2F0)',
                                                    color: isAdded ? 'white' : isLoading ? '#B5A8C0' : 'white',
                                                    fontSize: 18, fontWeight: 700,
                                                    boxShadow: isAdded || isLoading ? 'none' : '0 3px 10px rgba(255,143,171,0.4)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}
                                            >
                                                {isLoading ? '…' : isAdded ? '✓' : '+'}
                                            </button>
                                        </div>
                                    )
                                })}
                            </>
                        )}
                    </div>
                )}

                {/* ═══ MANUAL TAB ═══ */}
                {tab === 'manual' && (
                    <div style={{ background: 'white', borderRadius: 22, padding: 20, marginBottom: 24, boxShadow: '0 4px 20px rgba(255,143,171,0.1)', border: '1px solid #F2DCE8' }}>
                        <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: '#4A4458' }}>הוסיפי מקום בעצמך</h2>
                        <form onSubmit={addManual}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>שם המקום *</label>
                            <input value={form.name} onChange={setField('name')} placeholder="למשל: מוזיאון הלובר" required style={INPUT} />
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>תיאור</label>
                            <textarea value={form.description} onChange={setField('description')} placeholder="מה מיוחד במקום הזה?" rows={3} style={{ ...INPUT, resize: 'vertical', lineHeight: 1.5 }} />
                            {error && <p style={{ color: '#c53030', fontSize: 12, marginBottom: 12 }}>שגיאה: {error}</p>}
                            <button type="submit" disabled={saving || !form.name.trim()} style={{
                                width: '100%', padding: 14, borderRadius: 16, border: 'none',
                                background: saving ? '#F2DCE8' : 'linear-gradient(135deg, #FF8FAB, #D4C2F0)',
                                color: saving ? '#B5A8C0' : 'white', fontSize: 15, fontWeight: 700,
                                cursor: saving ? 'not-allowed' : 'pointer',
                                boxShadow: saving ? 'none' : '0 4px 14px rgba(255,143,171,0.4)',
                            }}>
                                {saving ? 'שומר...' : '+ הוסיפי לטיול'}
                            </button>
                        </form>
                    </div>
                )}

                {/* ═══ המסלול שלי ═══ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, marginTop: 8 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: '#4A4458' }}>המסלול שלי</h2>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {attractions.length >= 2 && (
                            <button onClick={autoSort} disabled={optimizing} style={{
                                background: optimizing ? '#F2DCE8' : 'linear-gradient(135deg, #A8E6E6, #B8E8D4)',
                                border: 'none', borderRadius: 10, padding: '7px 12px',
                                color: optimizing ? '#B5A8C0' : '#2D6E6E',
                                fontSize: 11, fontWeight: 700,
                                cursor: optimizing ? 'not-allowed' : 'pointer',
                                boxShadow: optimizing ? 'none' : '0 3px 10px rgba(168,230,230,0.5)',
                                whiteSpace: 'nowrap',
                            }}>
                                {optimizing ? '⏳...' : '✨ סדר אוטומטית'}
                            </button>
                        )}
                        <span style={{ background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)', color: 'white', fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '4px 12px', whiteSpace: 'nowrap' }}>
                            {attractions.length} עצירות
                        </span>
                    </div>
                </div>

                {loading ? (
                    <>
                        <div className="skeleton" style={{ height: 80, marginBottom: 10 }} />
                        <div className="skeleton" style={{ height: 80 }} />
                    </>
                ) : attractions.length === 0 ? (
                    <div style={{ background: 'white', borderRadius: 18, padding: '30px 20px', textAlign: 'center', boxShadow: '0 4px 16px rgba(255,143,171,0.1)', border: '1px dashed #FFB3C6' }}>
                        <p style={{ fontSize: 32, marginBottom: 8 }}>🗺️</p>
                        <p style={{ color: '#B5A8C0', fontSize: 14 }}>עדיין אין עצירות — הוסיפי את הראשונה!</p>
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={attractions.map(a => a.id)} strategy={verticalListSortingStrategy}>
                            {attractions.map((att, index) => (
                                <SortableItem key={att.id} att={att} index={index} onDelete={deleteAttraction} onStatusChange={updateStatus} />
                            ))}
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </div>
    )
}
