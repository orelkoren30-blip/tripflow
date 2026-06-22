import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import '../globals.css'

// הערה: סריקת OCR (tesseract.js) מנותקת זמנית — ראו src/lib/ocrParse.js
// לחיבור מחדש: ייבאי parseFlightOrHotelText והחזירי את runOCR + הכפתור "🔍 סרוק טקסט אוטומטית"

const CATEGORIES = [
    { key: 'flight',     label: 'טיסות',    icon: '✈️' },
    { key: 'hotel',      label: 'מלונות',   icon: '🏨' },
    { key: 'attraction', label: 'אטרקציות', icon: '🎫' },
    { key: 'insurance',  label: 'ביטוחים',  icon: '🛡️' },
]

const EMPTY_TEXT = {
    flight:     'עדיין אין מסמכי טיסה — הוסיפי את אישור ההזמנה כאן',
    hotel:      'עדיין אין מסמכי מלון — הוסיפי את אישור ההזמנה כאן',
    attraction: 'עדיין אין מסמכי אטרקציות — הוסיפי את אישור הכרטיס כאן',
    insurance:  'עדיין אין מסמכי ביטוח — הוסיפי את הפוליסה כאן',
}

const INPUT = {
    width: '100%', padding: '12px 14px',
    borderRadius: 12, border: '1px solid #F2DCE8',
    background: '#FFF8FB', fontSize: 14, color: '#4A4458',
    outline: 'none', direction: 'rtl', marginBottom: 12,
}

function isImageFile(name) { return /\.(jpg|jpeg|png|webp|gif)$/i.test(name ?? '') }
function isPdfFile(name)   { return /\.pdf$/i.test(name ?? '') }

// ─────────────────────────────────────────────────────────────────
// DocCard
// ─────────────────────────────────────────────────────────────────
function DocCard({ doc, signedUrl, categoryIcon, onDelete }) {
    const hasImage = doc.file_url && isImageFile(doc.file_url) && signedUrl
    const hasPdf   = doc.file_url && isPdfFile(doc.file_url)

    return (
        <div style={{
            background: 'white', borderRadius: 18, padding: '14px 16px', marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 4px 16px rgba(255,143,171,0.1)', border: '1px solid #F2DCE8',
        }}>
            <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0, overflow: 'hidden',
                background: 'linear-gradient(135deg, #FFF8FB, #F2DCE8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>
                {hasImage ? <img src={signedUrl} alt={doc.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                 : hasPdf ? '📄' : categoryIcon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#4A4458' }}>{doc.title}</p>
                {doc.booking_number && <p style={{ color: '#8B7E96', fontSize: 11, marginTop: 2 }}>הזמנה: {doc.booking_number}</p>}
                {doc.notes && <p style={{ color: '#B5A8C0', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.notes}</p>}
            </div>

            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {signedUrl && (
                    <a href={signedUrl} target="_blank" rel="noreferrer" style={{
                        width: 32, height: 32, borderRadius: 10, background: '#E0F7FA', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, textDecoration: 'none',
                    }}>⬇️</a>
                )}
                <button onClick={() => onDelete(doc)} style={{
                    width: 32, height: 32, borderRadius: 10, background: '#fff5f5', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14,
                }}>🗑️</button>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// AddDocumentModal
// ─────────────────────────────────────────────────────────────────
function AddDocumentModal({ category, categoryLabel, tripId, userId, onClose, onSaved }) {
    const [title,         setTitle]         = useState('')
    const [bookingNumber, setBookingNumber] = useState('')
    const [notes,         setNotes]         = useState('')
    const [file,          setFile]          = useState(null)
    const [rawText,       setRawText]       = useState(null)
    const [saving,        setSaving]        = useState(false)
    const [error,         setError]         = useState(null)

    function handleFileChange(e) {
        const f = e.target.files?.[0] ?? null
        setFile(f)
        setRawText(null)
    }

    async function handleSave(e) {
        e.preventDefault()
        if (!title.trim()) return
        setSaving(true); setError(null)

        let filePath = null
        if (file) {
            filePath = `${userId}/${tripId}/${category}/${Date.now()}_${file.name}`
            const { error: upErr } = await supabase.storage.from('trip-documents').upload(filePath, file)
            if (upErr) { setError(`העלאת קובץ נכשלה: ${upErr.message}`); setSaving(false); return }
        }

        const { error: insErr } = await supabase.from('trip_documents').insert({
            trip_id: tripId, category, title: title.trim(),
            file_url: filePath,
            booking_number: bookingNumber.trim() || null,
            notes: notes.trim() || null,
            extracted_data: rawText ? { raw_text: rawText } : null,
        })
        if (insErr) { setError(insErr.message); setSaving(false); return }

        setSaving(false)
        onSaved()
    }

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(74,68,88,0.45)', zIndex: 200 }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201, background: 'white', borderRadius: '28px 28px 0 0', padding: '20px 20px 40px', maxHeight: '92vh', overflowY: 'auto', direction: 'rtl' }}>
                <div style={{ width: 40, height: 4, background: '#F2DCE8', borderRadius: 2, margin: '0 auto 20px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#4A4458' }}>הוסיפי מסמך — {categoryLabel}</h2>
                    <button onClick={onClose} style={{ background: '#FFF8FB', border: '1px solid #F2DCE8', borderRadius: '50%', width: 34, height: 34, fontSize: 16, cursor: 'pointer', color: '#8B7E96' }}>✕</button>
                </div>

                <form onSubmit={handleSave}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>קובץ (PDF / תמונה) — אופציונלי</label>
                    <input type="file" accept="application/pdf,image/*" onChange={handleFileChange} style={{ ...INPUT, padding: '10px 14px' }} />

                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>כותרת *</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="לדוגמה: טיסה LY001 / הילטון תל אביב" required style={INPUT} />

                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>מספר הזמנה / אישור</label>
                    <input value={bookingNumber} onChange={e => setBookingNumber(e.target.value)} placeholder="לדוגמה: ABC1234" style={INPUT} />

                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>הערות</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="פרטים נוספים..." style={{ ...INPUT, resize: 'vertical', lineHeight: 1.5 }} />

                    {error && <p style={{ color: '#c53030', fontSize: 12, marginBottom: 12 }}>⚠️ {error}</p>}

                    <button type="submit" disabled={saving || !title.trim()} style={{
                        width: '100%', padding: 14, borderRadius: 16, border: 'none',
                        background: saving ? '#F2DCE8' : 'linear-gradient(135deg, #FF8FAB, #D4C2F0)',
                        color: saving ? '#B5A8C0' : 'white', fontSize: 15, fontWeight: 700,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        boxShadow: saving ? 'none' : '0 4px 14px rgba(255,143,171,0.4)',
                    }}>
                        {saving ? 'שומרת...' : 'שמרי מסמך'}
                    </button>
                </form>
            </div>
        </>
    )
}

// ─────────────────────────────────────────────────────────────────
// DocumentsPage
// ─────────────────────────────────────────────────────────────────
export default function DocumentsPage({ tripId, navigate, user }) {
    const [trip,       setTrip]       = useState(null)
    const [docs,       setDocs]       = useState([])
    const [loading,    setLoading]    = useState(true)
    const [error,      setError]      = useState(null)
    const [activeCat,  setActiveCat]  = useState('flight')
    const [signedUrls, setSignedUrls] = useState({})
    const [showModal,  setShowModal]  = useState(false)

    useEffect(() => {
        if (!tripId) { navigate('dashboard'); return }
        loadAll()
    }, [tripId])

    async function loadAll() {
        setLoading(true)
        const [tripRes, docsRes] = await Promise.all([
            supabase.from('trips').select('*').eq('id', tripId).single(),
            supabase.from('trip_documents').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
        ])
        if (tripRes.error) { setError(tripRes.error.message); setLoading(false); return }
        setTrip(tripRes.data)
        const list = docsRes.data ?? []
        setDocs(list)
        await refreshSignedUrls(list)
        setLoading(false)
    }

    async function refreshSignedUrls(list) {
        const withFiles = list.filter(d => d.file_url)
        if (!withFiles.length) return
        const entries = await Promise.all(withFiles.map(async d => {
            const { data } = await supabase.storage.from('trip-documents').createSignedUrl(d.file_url, 3600)
            return [d.id, data?.signedUrl ?? null]
        }))
        setSignedUrls(prev => ({ ...prev, ...Object.fromEntries(entries) }))
    }

    async function deleteDoc(doc) {
        if (doc.file_url) await supabase.storage.from('trip-documents').remove([doc.file_url])
        await supabase.from('trip_documents').delete().eq('id', doc.id)
        setDocs(prev => prev.filter(d => d.id !== doc.id))
    }

    async function handleSaved() {
        setShowModal(false)
        await loadAll()
    }

    if (loading) return (
        <div style={CENTER_SCREEN}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📁</p>
            <p style={{ color: '#8B7E96', fontSize: 14 }}>טוענת את מרכז המסמכים...</p>
        </div>
    )

    if (error) return (
        <div style={CENTER_SCREEN}>
            <p style={{ fontSize: 36, marginBottom: 10 }}>⚠️</p>
            <p style={{ color: '#c53030', fontSize: 14 }}>שגיאה: {error}</p>
            <button onClick={() => navigate('flow', tripId)} style={BACK_BTN}>חזרה</button>
        </div>
    )

    const activeCategory = CATEGORIES.find(c => c.key === activeCat)
    const catDocs = docs.filter(d => d.category === activeCat)

    return (
        <div style={{ background: '#FFF8FB', minHeight: '100vh', direction: 'rtl', paddingBottom: 100 }}>

            {/* ═══ HEADER ═══ */}
            <div style={{ background: 'linear-gradient(135deg, #FFE4EC, #F0E8FA, #E0F7FA)', padding: '52px 20px 20px', borderRadius: '0 0 36px 36px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <button onClick={() => navigate('flow', tripId)} style={{ background: 'white', border: '1px solid #F2DCE8', borderRadius: 12, padding: '8px 14px', color: '#4A4458', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,143,171,0.1)' }}>
                        ← חזרה
                    </button>
                    <p style={{ color: '#4A4458', fontSize: 16, fontWeight: 800 }}>📁 מרכז המסמכים — {trip?.name}</p>
                </div>

                <div className="scroll-x" style={{ gap: 8 }}>
                    {CATEGORIES.map(cat => (
                        <button key={cat.key} onClick={() => setActiveCat(cat.key)} style={{
                            flexShrink: 0, padding: '8px 16px', borderRadius: 24, cursor: 'pointer',
                            fontSize: 12, fontWeight: 700,
                            background: activeCat === cat.key ? 'linear-gradient(135deg, #FF8FAB, #D4C2F0)' : 'white',
                            color:      activeCat === cat.key ? 'white' : '#8B7E96',
                            border:     activeCat === cat.key ? 'none' : '1px solid #F2DCE8',
                            boxShadow:  activeCat === cat.key ? '0 3px 10px rgba(255,143,171,0.35)' : 'none',
                        }}>
                            {cat.icon} {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ padding: '20px 20px 0' }}>
                {catDocs.length === 0 ? (
                    <div style={{ background: 'white', borderRadius: 22, padding: '36px 20px', textAlign: 'center', boxShadow: '0 4px 16px rgba(255,143,171,0.1)', border: '1px dashed #FFB3C6' }}>
                        <p style={{ fontSize: 38, marginBottom: 10 }}>{activeCategory.icon}</p>
                        <p style={{ color: '#8B7E96', fontSize: 14, marginBottom: 18, lineHeight: 1.5 }}>{EMPTY_TEXT[activeCat]}</p>
                        <button onClick={() => setShowModal(true)} style={{
                            background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)', border: 'none', borderRadius: 99,
                            padding: '11px 26px', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(255,143,171,0.4)',
                        }}>
                            + הוסיפי מסמך
                        </button>
                    </div>
                ) : (
                    <>
                        {catDocs.map(doc => (
                            <DocCard key={doc.id} doc={doc} signedUrl={signedUrls[doc.id]} categoryIcon={activeCategory.icon} onDelete={deleteDoc} />
                        ))}
                        <button onClick={() => setShowModal(true)} style={{
                            width: '100%', marginTop: 4, padding: '13px', borderRadius: 16,
                            border: '2px dashed #F2DCE8', background: 'transparent',
                            cursor: 'pointer', color: '#8B7E96', fontSize: 13, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}>
                            <span style={{ fontSize: 16 }}>+</span> הוסיפי מסמך
                        </button>
                    </>
                )}
            </div>

            {showModal && (
                <AddDocumentModal
                    category={activeCat}
                    categoryLabel={activeCategory.label}
                    tripId={tripId}
                    userId={user?.id}
                    onClose={() => setShowModal(false)}
                    onSaved={handleSaved}
                />
            )}
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
