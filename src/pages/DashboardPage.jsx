import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { DESTINATIONS, CATEGORIES } from '../data/destinations'
import { TRIP_TYPES } from '../data/packingListsByType'
import { CURRENCIES } from '../data/currencies'
import BottomNav from '../components/BottomNav'
import '../globals.css'

const INPUT = {
    width: '100%', padding: '13px 16px',
    borderRadius: 14, border: '1px solid #F2DCE8',
    background: '#FFF8FB', fontSize: 15, color: '#4A4458',
    outline: 'none', direction: 'rtl',
}

// צבע פסטל מחזורי לכל כרטיס טיול
const CARD_COLORS = [
    { border: '#FFB3C6', badge: '#FFE4EC', badgeText: '#D4607A' },
    { border: '#A8E6E6', badge: '#E0F7FA', badgeText: '#3A9E9E' },
    { border: '#B8E8D4', badge: '#E8F8F0', badgeText: '#3A9E7A' },
    { border: '#D4C2F0', badge: '#F0E8FA', badgeText: '#7A5AAB' },
]

function formatDateRange(start, end) {
    if (!start && !end) return ''
    const opts = { day: 'numeric', month: 'short' }
    const s = start ? new Date(start + 'T12:00').toLocaleDateString('he-IL', opts) : ''
    const e = end   ? new Date(end   + 'T12:00').toLocaleDateString('he-IL', opts) : ''
    if (s && e) return `${s} – ${e}`
    return s || e
}

// ─── Confirm Delete Modal ───────────────────────────────────────
function ConfirmDeleteModal({ trip, onCancel, onConfirm, deleting, deleteError }) {
    return (
        <>
            <div onClick={!deleting ? onCancel : undefined}
                style={{ position: 'fixed', inset: 0, background: 'rgba(74,68,88,0.4)', zIndex: 300, backdropFilter: 'blur(4px)' }} />
            <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 301, background: 'white', borderRadius: 28, padding: '28px 24px',
                width: 'min(90vw, 360px)',
                boxShadow: '0 24px 60px rgba(255,143,171,0.25)',
                direction: 'rtl',
            }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FFE4EC', border: '2px solid #FFB3C6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px' }}>🗑️</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#4A4458', textAlign: 'center', marginBottom: 10 }}>מחיקת טיול</h3>
                <p style={{ fontSize: 14, color: '#8B7E96', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
                    למחוק את הטיול <span style={{ fontWeight: 800, color: '#4A4458' }}>"{trip.name}"</span>?<br />
                    פעולה זו תמחק גם את כל האטרקציות שבו ולא ניתן לבטל אותה.
                </p>
                {deleteError && (
                    <div style={{ background: '#FFEFE0', border: '1px solid #FFD4B8', borderRadius: 12, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8 }}>
                        <span style={{ fontSize: 14 }}>⚠️</span>
                        <p style={{ fontSize: 12, color: '#B45309', fontWeight: 600, lineHeight: 1.5 }}>{deleteError}</p>
                    </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onCancel} disabled={deleting}
                        style={{ flex: 1, padding: '12px 0', borderRadius: 99, border: '1px solid #F2DCE8', background: 'white', color: '#8B7E96', fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}>
                        ביטול
                    </button>
                    <button onClick={onConfirm} disabled={deleting}
                        style={{ flex: 1, padding: '12px 0', borderRadius: 99, border: 'none', background: deleting ? '#F2DCE8' : 'linear-gradient(135deg, #FF8FAB, #FFB3C6)', color: deleting ? '#B5A8C0' : 'white', fontSize: 14, fontWeight: 800, cursor: deleting ? 'not-allowed' : 'pointer', boxShadow: deleting ? 'none' : '0 4px 14px rgba(255,143,171,0.4)' }}>
                        {deleting ? 'מוחק...' : 'מחקי טיול'}
                    </button>
                </div>
            </div>
        </>
    )
}

// ─── DashboardPage ──────────────────────────────────────────────
export default function DashboardPage({ navigate, user, initialModal, clearInitialModal }) {
    const [trips,          setTrips]          = useState([])
    const [loading,        setLoading]        = useState(true)
    const [error,          setError]          = useState(null)
    const [activeCategory, setActiveCategory] = useState('הכל')
    const [showModal,      setShowModal]      = useState(false)
    const [newTrip,        setNewTrip]        = useState({ name: '', startDate: '', endDate: '', coverImageUrl: '', coverEmoji: '', destination: '', tripType: '', localCurrency: '' })
    const [urgentCounts,   setUrgentCounts]   = useState({})
    const [creating,       setCreating]       = useState(false)
    const [createError,    setCreateError]    = useState(null)
    const [deletingTrip,   setDeletingTrip]   = useState(null)
    const [deleting,       setDeleting]       = useState(false)
    const [deleteError,    setDeleteError]    = useState(null)
    const [successMsg,     setSuccessMsg]     = useState(null)

    useEffect(() => { loadTrips() }, [user])

    useEffect(() => {
        if (initialModal) {
            openModal(initialModal.coverImageUrl ?? '', initialModal.name ?? '', initialModal.destination ?? '', initialModal.coverEmoji ?? '')
            clearInitialModal?.()
        }
    }, [initialModal])

    async function loadTrips() {
        setLoading(true)
        let query = supabase.from('trips').select('*').order('created_at', { ascending: false })
        if (user?.id) query = query.eq('user_id', user.id)
        const { data, error } = await query
        if (error) setError(error.message)
        else { setTrips(data ?? []); loadUrgentCounts((data ?? []).map(t => t.id)) }
        setLoading(false)
    }

    async function loadUrgentCounts(tripIds) {
        if (!tripIds.length) { setUrgentCounts({}); return }
        const { data } = await supabase.from('attractions').select('trip_id').eq('status', 'urgent').in('trip_id', tripIds)
        const counts = {}
        ;(data ?? []).forEach(a => { counts[a.trip_id] = (counts[a.trip_id] ?? 0) + 1 })
        setUrgentCounts(counts)
    }

    function openModal(presetCoverImageUrl = '', presetName = '', presetDestination = '', presetCoverEmoji = '') {
        setNewTrip({ name: presetName, startDate: '', endDate: '', coverImageUrl: presetCoverImageUrl, coverEmoji: presetCoverEmoji, destination: presetDestination, tripType: '', localCurrency: '' })
        setCreateError(null)
        setShowModal(true)
    }

    function set(field) { return e => setNewTrip(prev => ({ ...prev, [field]: e.target.value })) }

    async function createTrip(e) {
        e.preventDefault()
        if (!newTrip.name.trim()) return
        if (!user?.id) { setCreateError('יש להתחבר לחשבון לפני יצירת טיול'); return }
        setCreating(true); setCreateError(null)
        const { data, error } = await supabase.from('trips').insert({
            name: newTrip.name.trim(), start_date: newTrip.startDate || null, end_date: newTrip.endDate || null,
            cover_image_url: newTrip.coverImageUrl.trim() || null, cover_emoji: newTrip.coverEmoji || null,
            destination: newTrip.destination || null, trip_type: newTrip.tripType || null,
            local_currency: newTrip.localCurrency || null, stops: 0, user_id: user.id,
        }).select().single()
        if (error) { setCreateError(error.message); setCreating(false); return }
        setShowModal(false)
        navigate('flow', data.id)
    }

    function requestDelete(e, trip) { e.stopPropagation(); setDeletingTrip(trip); setDeleteError(null) }
    function cancelDelete()         { if (deleting) return; setDeletingTrip(null); setDeleteError(null) }

    async function confirmDelete() {
        if (!deletingTrip) return
        setDeleting(true); setDeleteError(null)
        const { error } = await supabase.from('trips').delete().eq('id', deletingTrip.id)
        if (error) { setDeleteError(error.message); setDeleting(false); return }
        const name = deletingTrip.name
        setTrips(prev => prev.filter(t => t.id !== deletingTrip.id))
        setDeletingTrip(null); setDeleting(false)
        setSuccessMsg(`הטיול "${name}" נמחק בהצלחה ✓`)
        setTimeout(() => setSuccessMsg(null), 3000)
    }

    const visibleDests = activeCategory === 'הכל' ? DESTINATIONS : DESTINATIONS.filter(d => d.category === activeCategory)
    const STATS_COLORS = [
        { bg: '#FFE4EC', num: '#FF8FAB' },
        { bg: '#E0F7FA', num: '#7FD4D4' },
        { bg: '#E8F8F0', num: '#8FD9B8' },
    ]

    return (
        <div style={{ background: '#FFF8FB', minHeight: '100vh', direction: 'rtl' }}>

            {/* ═══ HERO ═══ */}
            <div style={{ background: 'linear-gradient(135deg, #FFE4EC, #F0E8FA, #E0F7FA)', padding: '52px 20px 28px', borderRadius: '0 0 36px 36px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                    <div>
                        <p style={{ color: '#8B7E96', fontSize: 13, marginBottom: 4 }}>
                            {user ? `שלום ${user.email.split('@')[0]} 👋` : 'שלום 👋'}
                        </p>
                        <h1 style={{ color: '#4A4458', fontSize: 27, fontWeight: 900 }}>לאן טסים הפעם?</h1>
                    </div>
                    <div onClick={() => navigate('profile')}
                        style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 18, boxShadow: '0 4px 14px rgba(255,143,171,0.45)', cursor: 'pointer' }}>
                        {user ? user.email[0].toUpperCase() : '👤'}
                    </div>
                </div>

                <div onClick={() => openModal()} style={{ background: 'white', borderRadius: 18, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #F2DCE8', cursor: 'pointer', boxShadow: '0 2px 12px rgba(255,143,171,0.1)' }}>
                    <span style={{ fontSize: 16, opacity: 0.6 }}>🔍</span>
                    <span style={{ color: '#B5A8C0', fontSize: 14 }}>חפשי יעד, עיר, מדינה...</span>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                    {[
                        { label: 'הטיולים שלי', value: loading ? '–' : trips.length },
                        { label: 'יעדים',        value: DESTINATIONS.length          },
                        { label: 'קטגוריות',     value: CATEGORIES.length - 1       },
                    ].map((s, i) => (
                        <div key={s.label} style={{ flex: 1, background: 'white', borderRadius: 16, padding: '10px 0', textAlign: 'center', boxShadow: '0 2px 10px rgba(255,143,171,0.1)', border: `1px solid ${STATS_COLORS[i].bg}` }}>
                            <p style={{ color: STATS_COLORS[i].num, fontSize: 22, fontWeight: 800 }}>{s.value}</p>
                            <p style={{ color: '#B5A8C0', fontSize: 11, marginTop: 1 }}>{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ padding: '0 20px 120px' }}>

                {/* ═══ CATEGORIES ═══ */}
                <div className="scroll-x" style={{ gap: 8, paddingTop: 22, paddingBottom: 2 }}>
                    {CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                            flexShrink: 0, padding: '8px 18px', borderRadius: 99, border: 'none', cursor: 'pointer',
                            fontSize: 13, fontWeight: 700,
                            background: activeCategory === cat ? 'linear-gradient(135deg, #FF8FAB, #D4C2F0)' : 'white',
                            color:      activeCategory === cat ? 'white' : '#8B7E96',
                            boxShadow:  activeCategory === cat ? '0 4px 14px rgba(255,143,171,0.35)' : '0 2px 8px rgba(255,143,171,0.08)',
                        }}>{cat}</button>
                    ))}
                </div>

                {/* ═══ DESTINATIONS ═══ */}
                <div style={{ marginTop: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#4A4458' }}>יעדים מהממים ✨</h2>
                        <span onClick={() => navigate('discover')} style={{ fontSize: 12, color: '#FF8FAB', fontWeight: 700, cursor: 'pointer' }}>ראי הכל ←</span>
                    </div>
                    <div className="scroll-x" style={{ gap: 14, paddingBottom: 8 }}>
                        {visibleDests.map(dest => (
                            <div key={dest.id} onClick={() => openModal(dest.img, dest.name, dest.name, dest.emoji)} style={{ flexShrink: 0, width: 148, height: 200, borderRadius: 22, overflow: 'hidden', position: 'relative', cursor: 'pointer', boxShadow: '0 8px 24px rgba(255,143,171,0.18)' }}>
                                {dest.img
                                    ? <img src={dest.img} alt={dest.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #FFE4EC, #F0E8FA, #E0F7FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56 }}>{dest.emoji ?? '🗺️'}</div>
                                }
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(74,68,88,0.82) 38%, transparent 68%)' }} />
                                <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(10px)', borderRadius: 20, padding: '3px 10px', border: '1px solid rgba(255,255,255,0.35)' }}>
                                    <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>{dest.category}</span>
                                </div>
                                <div style={{ position: 'absolute', bottom: 14, right: 14, left: 14 }}>
                                    <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, marginBottom: 3 }}>{dest.country}</p>
                                    <p style={{ color: 'white', fontSize: 16, fontWeight: 800 }}>{dest.name}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ═══ MY TRIPS ═══ */}
                <div style={{ marginTop: 32 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#4A4458' }}>הטיולים שלי 🗺️</h2>
                        <span onClick={() => openModal()} style={{ fontSize: 12, color: '#FF8FAB', fontWeight: 700, cursor: 'pointer' }}>+ טיול חדש</span>
                    </div>

                    {loading && <><div className="skeleton" style={{ height: 160, marginBottom: 14 }} /><div className="skeleton" style={{ height: 160 }} /></>}

                    {!loading && error && (
                        <div style={{ background: '#FFEFE0', border: '1px solid #FFD4B8', borderRadius: 18, padding: 18, textAlign: 'center' }}>
                            <p style={{ color: '#B45309', fontSize: 13 }}>⚠️ שגיאה: {error}</p>
                        </div>
                    )}

                    {!loading && !error && trips.length === 0 && (
                        <div onClick={() => openModal()} style={{ background: 'white', borderRadius: 24, padding: '36px 20px', textAlign: 'center', boxShadow: '0 4px 20px rgba(255,179,198,0.15)', cursor: 'pointer', border: '1px dashed #FFB3C6' }}>
                            <p style={{ fontSize: 40, marginBottom: 10 }}>✈️</p>
                            <p style={{ fontSize: 15, fontWeight: 700, color: '#4A4458' }}>עדיין אין טיולים</p>
                            <p style={{ color: '#B5A8C0', fontSize: 13, marginTop: 6 }}>לחצי כאן כדי ליצור טיול ראשון</p>
                        </div>
                    )}

                    {!loading && !error && trips.map((trip, idx) => {
                        const c = CARD_COLORS[idx % 4]
                        return (
                            <div key={trip.id} onClick={() => navigate('flow', trip.id)}
                                style={{ borderRadius: 24, overflow: 'hidden', marginBottom: 16, position: 'relative', height: 160, cursor: 'pointer', boxShadow: `0 6px 24px rgba(255,179,198,0.2), 0 0 0 2px ${c.border}` }}>
                                {trip.cover_image_url
                                    ? <img src={trip.cover_image_url} alt={trip.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${c.badge}, white)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>
                                        {trip.cover_emoji || '🗺️'}
                                      </div>
                                }
                                {trip.cover_image_url && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, rgba(74,68,88,0.75) 50%, rgba(74,68,88,0.1))' }} />}

                                <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, padding: '14px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                    {(trip.start_date || trip.end_date) && (
                                        <p style={{ color: trip.cover_image_url ? 'rgba(255,255,255,0.75)' : '#8B7E96', fontSize: 11, marginBottom: 4 }}>
                                            {formatDateRange(trip.start_date, trip.end_date)}
                                        </p>
                                    )}
                                    <h3 style={{ color: trip.cover_image_url ? 'white' : '#4A4458', fontSize: 19, fontWeight: 800 }}>{trip.name}</h3>
                                    <p style={{ color: trip.cover_image_url ? 'rgba(255,255,255,0.7)' : '#8B7E96', fontSize: 11, marginTop: 5 }}>
                                        📍 {trip.stops ?? 0} עצירות
                                        {urgentCounts[trip.id] > 0 && (
                                            <span style={{ color: '#FF6B6B', fontWeight: 800, marginRight: 8 }}> · 🔥 {urgentCounts[trip.id]} דחופות</span>
                                        )}
                                    </p>
                                </div>

                                <div style={{ position: 'absolute', top: '50%', left: 48, transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.4)' }}>
                                    <span style={{ color: 'white', fontSize: 14 }}>←</span>
                                </div>

                                {/* 🗑️ מחיקה */}
                                <button onClick={e => requestDelete(e, trip)}
                                    style={{ position: 'absolute', top: 10, left: 10, width: 32, height: 32, borderRadius: 10, background: 'rgba(255,228,236,0.85)', backdropFilter: 'blur(6px)', border: '1px solid #FFB3C6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}>
                                    🗑️
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>

            <BottomNav active="home" navigate={navigate} onNewTrip={() => openModal()} />

            {deletingTrip && <ConfirmDeleteModal trip={deletingTrip} onCancel={cancelDelete} onConfirm={confirmDelete} deleting={deleting} deleteError={deleteError} />}

            {/* ═══ NEW TRIP MODAL ═══ */}
            {showModal && (
                <>
                    <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(74,68,88,0.45)', zIndex: 200 }} />
                    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201, background: 'white', borderRadius: '28px 28px 0 0', padding: '20px 20px 48px', maxHeight: '92vh', overflowY: 'auto' }}>
                        <div style={{ width: 40, height: 4, background: '#F2DCE8', borderRadius: 2, margin: '0 auto 20px' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#4A4458' }}>טיול חדש ✈️</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: '#FFF8FB', border: '1px solid #F2DCE8', borderRadius: '50%', width: 34, height: 34, fontSize: 16, cursor: 'pointer', color: '#8B7E96' }}>✕</button>
                        </div>
                        <form onSubmit={createTrip}>
                            {newTrip.coverImageUrl && (
                                <div style={{ width: '100%', height: 130, borderRadius: 18, overflow: 'hidden', marginBottom: 16 }}>
                                    <img src={newTrip.coverImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            )}
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>שם הטיול *</label>
                            <input value={newTrip.name} onChange={set('name')} placeholder="לדוגמה: ניו יורק 2026" required style={{ ...INPUT, marginBottom: 14 }} />
                            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>תאריך יציאה</label>
                                    <input type="date" value={newTrip.startDate} onChange={set('startDate')} style={INPUT} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>תאריך חזרה</label>
                                    <input type="date" value={newTrip.endDate} min={newTrip.startDate} onChange={set('endDate')} style={INPUT} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>סוג טיול</label>
                                    <select value={newTrip.tripType} onChange={set('tripType')} style={{ ...INPUT, cursor: 'pointer' }}>
                                        <option value="">בחרי (אופציונלי)</option>
                                        {TRIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>מטבע מקומי</label>
                                    <select value={newTrip.localCurrency} onChange={set('localCurrency')} style={{ ...INPUT, cursor: 'pointer' }}>
                                        <option value="">בחרי (אופציונלי)</option>
                                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>תמונת כיסוי (URL)</label>
                            <input value={newTrip.coverImageUrl} onChange={set('coverImageUrl')} placeholder="https://..." style={{ ...INPUT, marginBottom: 14 }} />
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 8 }}>או בחרי יעד מוכן</label>
                            <div className="scroll-x" style={{ gap: 10, marginBottom: 20, paddingBottom: 4 }}>
                                {DESTINATIONS.map(d => (
                                    <div key={d.id} onClick={() => setNewTrip(prev => ({ ...prev, coverImageUrl: d.img, coverEmoji: d.emoji ?? '', name: prev.name || d.name, destination: d.name }))} style={{ flexShrink: 0, textAlign: 'center', cursor: 'pointer' }}>
                                        <div style={{ width: 68, height: 68, borderRadius: 16, overflow: 'hidden', marginBottom: 4, border: newTrip.coverImageUrl === d.img ? '3px solid #FF8FAB' : '3px solid transparent' }}>
                                            {d.img
                                                ? <img src={d.img} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #FFE4EC, #F0E8FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{d.emoji ?? '🗺️'}</div>
                                            }
                                        </div>
                                        <p style={{ fontSize: 10, fontWeight: 600, color: '#8B7E96' }}>{d.name}</p>
                                    </div>
                                ))}
                            </div>
                            {createError && <p style={{ color: '#B45309', fontSize: 12, marginBottom: 12 }}>⚠️ {createError}</p>}
                            <button type="submit" disabled={creating || !newTrip.name.trim()} style={{
                                width: '100%', padding: '15px', borderRadius: 99, border: 'none',
                                background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)',
                                color: 'white', fontSize: 16, fontWeight: 800,
                                cursor: creating ? 'not-allowed' : 'pointer',
                                boxShadow: '0 6px 20px rgba(255,143,171,0.4)',
                                opacity: creating ? 0.7 : 1,
                            }}>
                                {creating ? 'יוצר טיול...' : 'צרי טיול ✈️'}
                            </button>
                        </form>
                    </div>
                </>
            )}

            {successMsg && (
                <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 400, background: 'linear-gradient(135deg, #276749, #38a169)', color: 'white', borderRadius: 99, padding: '12px 22px', fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(39,103,73,0.35)', whiteSpace: 'nowrap', direction: 'rtl', animation: 'fadeIn 0.2s ease' }}>
                    {successMsg}
                </div>
            )}
        </div>
    )
}
