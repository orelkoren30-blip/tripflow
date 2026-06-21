import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PACKING_LISTS_BY_TYPE, PACKING_CATEGORIES } from '../data/packingListsByType'
import '../globals.css'

const INPUT = {
    flex: 1, padding: '11px 14px',
    borderRadius: 12, border: '1px solid #F2DCE8',
    background: '#FFF8FB', fontSize: 13, color: '#4A4458',
    outline: 'none', direction: 'rtl',
}

export default function PackingListPage({ tripId, navigate }) {
    const [trip,       setTrip]       = useState(null)
    const [items,      setItems]      = useState([])
    const [loading,    setLoading]    = useState(true)
    const [error,      setError]      = useState(null)
    const [newName,    setNewName]    = useState('')
    const [newCategory, setNewCategory] = useState(PACKING_CATEGORIES[0])
    const [adding,     setAdding]     = useState(false)

    useEffect(() => {
        if (!tripId) { navigate('dashboard'); return }
        loadAll()
    }, [tripId])

    async function loadAll() {
        setLoading(true)
        const [tripRes, itemsRes] = await Promise.all([
            supabase.from('trips').select('*').eq('id', tripId).single(),
            supabase.from('packing_items').select('*').eq('trip_id', tripId).order('created_at'),
        ])
        if (tripRes.error) { setError(tripRes.error.message); setLoading(false); return }
        setTrip(tripRes.data)

        let currentItems = itemsRes.data ?? []

        // מילוי אוטומטי בכניסה הראשונה אם יש סוג טיול ועדיין אין פריטים
        if (currentItems.length === 0 && tripRes.data?.trip_type) {
            const defaults = PACKING_LISTS_BY_TYPE[tripRes.data.trip_type]
            if (defaults?.length) {
                const { data: inserted, error: insertError } = await supabase
                    .from('packing_items')
                    .insert(defaults.map(d => ({
                        trip_id: tripId, item_name: d.name, category: d.category,
                        is_packed: false, is_custom: false,
                    })))
                    .select()
                if (!insertError) currentItems = inserted ?? []
            }
        }

        setItems(currentItems)
        setLoading(false)
    }

    async function togglePacked(item) {
        const newVal = !item.is_packed
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_packed: newVal } : i))
        await supabase.from('packing_items').update({ is_packed: newVal }).eq('id', item.id)
    }

    async function deleteItem(item) {
        setItems(prev => prev.filter(i => i.id !== item.id))
        await supabase.from('packing_items').delete().eq('id', item.id)
    }

    async function addCustomItem(e) {
        e.preventDefault()
        if (!newName.trim()) return
        setAdding(true)
        const { data, error } = await supabase.from('packing_items').insert({
            trip_id: tripId, item_name: newName.trim(), category: newCategory,
            is_packed: false, is_custom: true,
        }).select().single()
        if (!error) {
            setItems(prev => [...prev, data])
            setNewName('')
        }
        setAdding(false)
    }

    if (loading) return (
        <div style={CENTER_SCREEN}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🎒</p>
            <p style={{ color: '#8B7E96', fontSize: 14 }}>טוען רשימת ציוד...</p>
        </div>
    )

    if (error) return (
        <div style={CENTER_SCREEN}>
            <p style={{ fontSize: 36, marginBottom: 10 }}>⚠️</p>
            <p style={{ color: '#c53030', fontSize: 14 }}>שגיאה: {error}</p>
            <button onClick={() => navigate('flow', tripId)} style={BACK_BTN}>חזרה</button>
        </div>
    )

    const packedCount = items.filter(i => i.is_packed).length
    const totalCount   = items.length
    const progressPct  = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0

    const grouped = PACKING_CATEGORIES
        .map(cat => ({ cat, list: items.filter(i => i.category === cat) }))
        .filter(g => g.list.length > 0)
    const uncategorized = items.filter(i => !PACKING_CATEGORIES.includes(i.category))
    if (uncategorized.length) grouped.push({ cat: 'אחר', list: uncategorized })

    return (
        <div style={{ background: '#FFF8FB', minHeight: '100vh', direction: 'rtl', paddingBottom: 60 }}>

            {/* ═══ HEADER ═══ */}
            <div style={{ background: 'linear-gradient(135deg, #FFE4EC, #F0E8FA, #E0F7FA)', padding: '52px 20px 24px', borderRadius: '0 0 36px 36px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <button onClick={() => navigate('flow', tripId)} style={{ background: 'white', border: '1px solid #F2DCE8', borderRadius: 12, padding: '8px 14px', color: '#4A4458', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,143,171,0.1)' }}>
                        ← חזרה
                    </button>
                    <p style={{ color: '#4A4458', fontSize: 16, fontWeight: 800 }}>🎒 רשימת ציוד — {trip?.name}</p>
                </div>

                {/* progress bar */}
                <div style={{ background: 'white', borderRadius: 16, padding: '12px 16px', border: '1px solid #F2DCE8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#4A4458' }}>
                            {packedCount}/{totalCount} פריטים נאספו
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#8FD9B8' }}>{progressPct}%</span>
                    </div>
                    <div style={{ height: 8, background: '#F2DCE8', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(135deg, #A8E6E6, #8FD9B8)', borderRadius: 99, transition: 'width 0.3s' }} />
                    </div>
                </div>
            </div>

            <div style={{ padding: '20px 20px 0' }}>

                {!trip?.trip_type && (
                    <div style={{ background: '#FFEFE0', border: '1px solid #FFD4B8', borderRadius: 14, padding: '12px 14px', marginBottom: 18, display: 'flex', gap: 8 }}>
                        <span>💡</span>
                        <p style={{ fontSize: 12, color: '#B45309', fontWeight: 600 }}>
                            לא הוגדר סוג טיול — לא נטענה רשימה אוטומטית. אפשר להוסיף פריטים ידנית למטה.
                        </p>
                    </div>
                )}

                {totalCount === 0 ? (
                    <div style={{ background: 'white', borderRadius: 18, padding: '30px 20px', textAlign: 'center', boxShadow: '0 4px 16px rgba(255,143,171,0.1)', border: '1px solid #F2DCE8', marginBottom: 20 }}>
                        <p style={{ fontSize: 32, marginBottom: 8 }}>🎒</p>
                        <p style={{ color: '#B5A8C0', fontSize: 14 }}>הרשימה ריקה — הוסיפי פריט ראשון</p>
                    </div>
                ) : (
                    grouped.map(({ cat, list }) => (
                        <div key={cat} style={{ marginBottom: 20 }}>
                            <p style={{ fontSize: 13, fontWeight: 800, color: '#8B7E96', marginBottom: 8 }}>{cat}</p>
                            {list.map(item => (
                                <div key={item.id} style={{
                                    background: 'white', borderRadius: 14, padding: '11px 14px', marginBottom: 8,
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    boxShadow: '0 3px 12px rgba(255,143,171,0.08)', border: '1px solid #F2DCE8',
                                    opacity: item.is_packed ? 0.6 : 1,
                                }}>
                                    <div onClick={() => togglePacked(item)} style={{
                                        width: 24, height: 24, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
                                        background: item.is_packed ? 'linear-gradient(135deg, #A8E6E6, #8FD9B8)' : 'white',
                                        border: item.is_packed ? 'none' : '2px solid #F2DCE8',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 13, color: 'white',
                                    }}>
                                        {item.is_packed && '✓'}
                                    </div>
                                    <p style={{
                                        flex: 1, fontSize: 14, fontWeight: 600, color: '#4A4458',
                                        textDecoration: item.is_packed ? 'line-through' : 'none',
                                    }}>
                                        {item.item_name}
                                        {item.is_custom && <span style={{ fontSize: 10, color: '#B5A8C0', marginRight: 6 }}>· מותאם</span>}
                                    </p>
                                    <button onClick={() => deleteItem(item)} style={{
                                        width: 28, height: 28, borderRadius: 9, background: '#fff5f5', border: 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', fontSize: 13, flexShrink: 0,
                                    }}>🗑️</button>
                                </div>
                            ))}
                        </div>
                    ))
                )}

                {/* ═══ הוסף פריט מותאם ═══ */}
                <div style={{ background: 'white', borderRadius: 18, padding: 16, boxShadow: '0 4px 16px rgba(255,143,171,0.1)', border: '1px solid #F2DCE8' }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#4A4458', marginBottom: 10 }}>הוסיפי פריט משלך</p>
                    <form onSubmit={addCustomItem} style={{ display: 'flex', gap: 8 }}>
                        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="שם הפריט" style={INPUT} />
                        <select value={newCategory} onChange={e => setNewCategory(e.target.value)} style={{ ...INPUT, flex: '0 0 110px', cursor: 'pointer' }}>
                            {PACKING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="submit" disabled={adding || !newName.trim()} style={{
                            flexShrink: 0, width: 42, height: 42, borderRadius: 12, border: 'none',
                            background: adding ? '#F2DCE8' : 'linear-gradient(135deg, #FF8FAB, #D4C2F0)',
                            color: 'white', fontSize: 20, fontWeight: 700, cursor: adding ? 'not-allowed' : 'pointer',
                        }}>+</button>
                    </form>
                </div>
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
