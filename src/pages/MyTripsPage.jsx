import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { DESTINATIONS } from '../data/destinations'
import BottomNav from '../components/BottomNav'
import '../globals.css'

const INPUT = {
    width: '100%', padding: '13px 16px',
    borderRadius: 14, border: '1px solid #F2DCE8',
    background: '#FFF8FB', fontSize: 15, color: '#4A4458',
    outline: 'none', direction: 'rtl',
}

const CARD_COLORS = [
    { border: '#FFB3C6', badge: '#FFE4EC', num: '#FF8FAB' },
    { border: '#A8E6E6', badge: '#E0F7FA', num: '#7FD4D4' },
    { border: '#B8E8D4', badge: '#E8F8F0', num: '#8FD9B8' },
    { border: '#D4C2F0', badge: '#F0E8FA', num: '#9B7ED4' },
]

const STAT_COLORS = [
    { bg: '#FFE4EC', num: '#FF8FAB' },
    { bg: '#E0F7FA', num: '#7FD4D4' },
    { bg: '#E8F8F0', num: '#8FD9B8' },
]

function formatDateRange(start, end) {
    if (!start && !end) return ''
    const opts = { day: 'numeric', month: 'short' }
    const s = start ? new Date(start + 'T12:00').toLocaleDateString('he-IL', opts) : ''
    const e = end   ? new Date(end   + 'T12:00').toLocaleDateString('he-IL', opts) : ''
    if (s && e) return `${s} – ${e}`
    return s || e
}

function ConfirmDeleteModal({ trip, onCancel, onConfirm, deleting, deleteError }) {
    return (
        <>
            <div onClick={!deleting ? onCancel : undefined}
                style={{ position: 'fixed', inset: 0, background: 'rgba(74,68,88,0.4)', zIndex: 300, backdropFilter: 'blur(4px)' }} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 301, background: 'white', borderRadius: 28, padding: '28px 24px', width: 'min(90vw, 360px)', boxShadow: '0 24px 60px rgba(255,143,171,0.25)', direction: 'rtl' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FFE4EC', border: '2px solid #FFB3C6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px' }}>🗑️</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#4A4458', textAlign: 'center', marginBottom: 10 }}>מחיקת טיול</h3>
                <p style={{ fontSize: 14, color: '#8B7E96', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
                    למחוק את הטיול <span style={{ fontWeight: 800, color: '#4A4458' }}>"{trip.name}"</span>?<br />
                    פעולה זו תמחק גם את כל האטרקציות שבו ולא ניתן לבטל אותה.
                </p>
                {deleteError && (
                    <div style={{ background: '#FFEFE0', border: '1px solid #FFD4B8', borderRadius: 12, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8 }}>
                        <span>⚠️</span>
                        <p style={{ fontSize: 12, color: '#B45309', fontWeight: 600 }}>{deleteError}</p>
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

export default function MyTripsPage({ navigate, user }) {
    const [trips,       setTrips]       = useState([])
    const [loading,     setLoading]     = useState(true)
    const [error,       setError]       = useState(null)
    const [showModal,   setShowModal]   = useState(false)
    const [newTrip,     setNewTrip]     = useState({ name: '', startDate: '', endDate: '', coverImageUrl: '', coverEmoji: '', destination: '' })
    const [creating,    setCreating]    = useState(false)
    const [createError, setCreateError] = useState(null)
    const [deletingTrip, setDeletingTrip] = useState(null)
    const [deleting,     setDeleting]     = useState(false)
    const [deleteError,  setDeleteError]  = useState(null)
    const [successMsg,   setSuccessMsg]   = useState(null)

    useEffect(() => { if (!user?.id) { setLoading(false); return } loadTrips() }, [user])

    async function loadTrips() {
        setLoading(true)
        const { data, error } = await supabase.from('trips').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        if (error) setError(error.message)
        else setTrips(data ?? [])
        setLoading(false)
    }

    function openModal() {
        setNewTrip({ name: '', startDate: '', endDate: '', coverImageUrl: '', coverEmoji: '', destination: '' })
        setCreateError(null); setShowModal(true)
    }

    function set(field) { return e => setNewTrip(prev => ({ ...prev, [field]: e.target.value })) }

    async function createTrip(e) {
        e.preventDefault()
        if (!newTrip.name.trim() || !user?.id) return
        setCreating(true); setCreateError(null)
        const { data, error } = await supabase.from('trips').insert({
            name: newTrip.name.trim(), start_date: newTrip.startDate || null, end_date: newTrip.endDate || null,
            cover_image_url: newTrip.coverImageUrl.trim() || null, cover_emoji: newTrip.coverEmoji || null,
            destination: newTrip.destination || null, stops: 0, user_id: user.id,
        }).select().single()
        if (error) { setCreateError(error.message); setCreating(false); return }
        setShowModal(false); navigate('flow', data.id)
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

    const futureCount = trips.filter(t => t.start_date && new Date(t.start_date) >= new Date()).length

    return (
        <div style={{ background: '#FFF8FB', minHeight: '100vh', direction: 'rtl' }}>

            {/* ═══ HEADER ═══ */}
            <div style={{ background: 'linear-gradient(135deg, #FFE4EC, #F0E8FA, #E0F7FA)', padding: '52px 20px 28px', borderRadius: '0 0 36px 36px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                        <p style={{ color: '#8B7E96', fontSize: 13, marginBottom: 4 }}>
                            {user ? `שלום ${user.email.split('@')[0]} 👋` : 'שלום 👋'}
                        </p>
                        <h1 style={{ color: '#4A4458', fontSize: 27, fontWeight: 900 }}>הטיולים שלי 🗺️</h1>
                    </div>
                    <button onClick={openModal} style={{ background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)', border: 'none', borderRadius: 99, padding: '10px 18px', color: 'white', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(255,143,171,0.4)' }}>
                        + טיול חדש
                    </button>
                </div>

                {!loading && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
                        {[
                            { label: 'טיולים',  value: trips.length,                                    color: STAT_COLORS[0] },
                            { label: 'עצירות',  value: trips.reduce((s, t) => s + (t.stops ?? 0), 0),  color: STAT_COLORS[1] },
                            { label: 'עתידיים', value: futureCount,                                     color: STAT_COLORS[2] },
                        ].map(s => (
                            <div key={s.label} style={{ flex: 1, background: 'white', borderRadius: 16, padding: '10px 0', textAlign: 'center', border: `1px solid ${s.color.bg}`, boxShadow: '0 2px 10px rgba(255,143,171,0.1)' }}>
                                <p style={{ color: s.color.num, fontSize: 22, fontWeight: 800 }}>{s.value}</p>
                                <p style={{ color: '#B5A8C0', fontSize: 11, marginTop: 1 }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ padding: '24px 20px 120px' }}>

                {!user && (
                    <div style={{ background: 'white', borderRadius: 24, padding: '40px 20px', textAlign: 'center', boxShadow: '0 4px 20px rgba(255,179,198,0.15)' }}>
                        <p style={{ fontSize: 40, marginBottom: 12 }}>🔐</p>
                        <p style={{ fontSize: 16, fontWeight: 800, color: '#4A4458', marginBottom: 8 }}>יש להתחבר כדי לראות את הטיולים</p>
                        <p style={{ color: '#B5A8C0', fontSize: 13, marginBottom: 20 }}>התחברי לחשבון שלך כדי לצפות ולנהל את הטיולים שיצרת</p>
                        <button onClick={() => navigate('profile')} style={{ background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)', border: 'none', borderRadius: 99, padding: '12px 28px', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(255,143,171,0.4)' }}>
                            התחברי / הרשמי
                        </button>
                    </div>
                )}

                {user && loading && (
                    <>
                        <div className="skeleton" style={{ height: 160, marginBottom: 14 }} />
                        <div className="skeleton" style={{ height: 160, marginBottom: 14 }} />
                        <div className="skeleton" style={{ height: 160 }} />
                    </>
                )}

                {user && !loading && error && (
                    <div style={{ background: '#FFEFE0', border: '1px solid #FFD4B8', borderRadius: 18, padding: 18, textAlign: 'center' }}>
                        <p style={{ color: '#B45309', fontSize: 13 }}>⚠️ שגיאה: {error}</p>
                        <button onClick={loadTrips} style={{ marginTop: 12, background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)', border: 'none', borderRadius: 99, padding: '8px 20px', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            נסי שוב
                        </button>
                    </div>
                )}

                {user && !loading && !error && trips.length === 0 && (
                    <div style={{ background: 'white', borderRadius: 24, padding: '44px 20px', textAlign: 'center', boxShadow: '0 4px 20px rgba(255,179,198,0.15)', border: '1px dashed #FFB3C6' }}>
                        <p style={{ fontSize: 48, marginBottom: 12 }}>✈️</p>
                        <p style={{ fontSize: 16, fontWeight: 800, color: '#4A4458', marginBottom: 8 }}>עדיין לא תכננת טיולים</p>
                        <p style={{ color: '#B5A8C0', fontSize: 13, marginBottom: 24 }}>צרי את הטיול הראשון שלך ותתחילי לתכנן!</p>
                        <button onClick={openModal} style={{ background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)', border: 'none', borderRadius: 99, padding: '13px 32px', color: 'white', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(255,143,171,0.4)' }}>
                            צרי טיול ראשון ✈️
                        </button>
                    </div>
                )}

                {user && !loading && !error && trips.map((trip, idx) => {
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
                                <p style={{ color: trip.cover_image_url ? 'rgba(255,255,255,0.7)' : '#8B7E96', fontSize: 11, marginTop: 5 }}>📍 {trip.stops ?? 0} עצירות</p>
                            </div>

                            <div style={{ position: 'absolute', top: '50%', left: 48, transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.4)' }}>
                                <span style={{ color: 'white', fontSize: 14 }}>←</span>
                            </div>

                            <button onClick={e => requestDelete(e, trip)}
                                style={{ position: 'absolute', top: 10, left: 10, width: 32, height: 32, borderRadius: 10, background: 'rgba(255,228,236,0.85)', backdropFilter: 'blur(6px)', border: '1px solid #FFB3C6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}>
                                🗑️
                            </button>
                        </div>
                    )
                })}
            </div>

            <BottomNav active="trips" navigate={navigate} onNewTrip={openModal} />

            {deletingTrip && <ConfirmDeleteModal trip={deletingTrip} onCancel={cancelDelete} onConfirm={confirmDelete} deleting={deleting} deleteError={deleteError} />}

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
                            <input value={newTrip.name} onChange={set('name')} placeholder="לדוגמה: טוקיו 2026" required style={{ ...INPUT, marginBottom: 14 }} />
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
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>תמונת כיסוי (URL)</label>
                            <input value={newTrip.coverImageUrl} onChange={set('coverImageUrl')} placeholder="https://..." style={{ ...INPUT, marginBottom: 14 }} />
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 8 }}>או בחרי יעד מוכן</label>
                            <div className="scroll-x" style={{ gap: 10, marginBottom: 20, paddingBottom: 4 }}>
                                {DESTINATIONS.map(d => (
                                    <div key={d.id} onClick={() => setNewTrip(prev => ({ ...prev, coverImageUrl: d.img, name: prev.name || d.name, destination: d.name }))} style={{ flexShrink: 0, textAlign: 'center', cursor: 'pointer' }}>
                                        <div style={{ width: 68, height: 68, borderRadius: 16, overflow: 'hidden', marginBottom: 4, border: newTrip.coverImageUrl === d.img ? '3px solid #FF8FAB' : '3px solid transparent' }}>
                                            <img src={d.img} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <p style={{ fontSize: 10, fontWeight: 600, color: '#8B7E96' }}>{d.name}</p>
                                    </div>
                                ))}
                            </div>
                            {createError && <p style={{ color: '#B45309', fontSize: 12, marginBottom: 12 }}>⚠️ {createError}</p>}
                            <button type="submit" disabled={creating || !newTrip.name.trim()} style={{ width: '100%', padding: '15px', borderRadius: 99, border: 'none', background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)', color: 'white', fontSize: 16, fontWeight: 800, cursor: creating ? 'not-allowed' : 'pointer', boxShadow: '0 6px 20px rgba(255,143,171,0.4)', opacity: creating ? 0.7 : 1 }}>
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
