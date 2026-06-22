import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getExchangeRate } from '../lib/exchangeRate'
import { CURRENCIES, EXPENSE_CATEGORIES } from '../data/currencies'
import '../globals.css'

const INPUT = {
    width: '100%', padding: '12px 14px',
    borderRadius: 12, border: '1px solid #F2DCE8',
    background: '#FFF8FB', fontSize: 14, color: '#4A4458',
    outline: 'none', direction: 'rtl', marginBottom: 12,
}

function todayStr() { return new Date().toISOString().slice(0, 10) }
function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

// ─────────────────────────────────────────────────────────────────
// DonutChart — SVG פשוט, בלי ספריה חיצונית
// ─────────────────────────────────────────────────────────────────
function DonutChart({ slices, total }) {
    if (total <= 0) return null
    const r = 46, circumference = 2 * Math.PI * r

    const dashes = slices.map(s => (s.total / total) * circumference)
    const arcs = slices.map((s, i) => ({
        key: s.key, color: s.color, dash: dashes[i],
        offset: dashes.slice(0, i).reduce((sum, d) => sum + d, 0),
    }))

    return (
        <svg width={120} height={120} viewBox="0 0 120 120">
            <circle cx={60} cy={60} r={r} fill="none" stroke="#F2DCE8" strokeWidth={18} />
            <g transform="rotate(-90 60 60)">
                {arcs.map(a => (
                    <circle key={a.key} cx={60} cy={60} r={r} fill="none"
                        stroke={a.color} strokeWidth={18}
                        strokeDasharray={`${a.dash} ${circumference - a.dash}`}
                        strokeDashoffset={-a.offset}
                        strokeLinecap="butt"
                    />
                ))}
            </g>
            <text x={60} y={64} textAnchor="middle" fontSize={13} fontWeight={800} fill="#4A4458">
                {Math.round(total)}
            </text>
        </svg>
    )
}

// ─────────────────────────────────────────────────────────────────
// AddExpenseModal
// ─────────────────────────────────────────────────────────────────
function AddExpenseModal({ tripId, defaultCurrency, onClose, onSaved }) {
    const [amount,      setAmount]      = useState('')
    const [currency,    setCurrency]    = useState(defaultCurrency || 'USD')
    const [category,    setCategory]    = useState('food')
    const [description, setDescription] = useState('')
    const [date,         setDate]        = useState(todayStr())
    const [saving,       setSaving]      = useState(false)
    const [error,        setError]       = useState(null)

    async function handleSave(e) {
        e.preventDefault()
        const amountLocal = Number(amount)
        if (!amountLocal || amountLocal <= 0) return
        setSaving(true); setError(null)

        let rate
        try {
            rate = await getExchangeRate(currency, 'ILS')
        } catch (err) {
            setError(err.message); setSaving(false); return
        }

        const { error: insErr } = await supabase.from('trip_expenses').insert({
            trip_id: tripId, category, description: description.trim() || null,
            amount_local: amountLocal, currency_local: currency,
            amount_converted: amountLocal * rate, currency_converted: 'ILS',
            exchange_rate: rate, expense_date: date,
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
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#4A4458' }}>הוסיפי הוצאה</h2>
                    <button onClick={onClose} style={{ background: '#FFF8FB', border: '1px solid #F2DCE8', borderRadius: '50%', width: 34, height: 34, fontSize: 16, cursor: 'pointer', color: '#8B7E96' }}>✕</button>
                </div>

                <form onSubmit={handleSave}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 0 }}>
                        <div style={{ flex: 2 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>סכום *</label>
                            <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required style={INPUT} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>מטבע</label>
                            <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...INPUT, cursor: 'pointer' }}>
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>קטגוריה</label>
                    <div className="scroll-x" style={{ gap: 8, marginBottom: 14 }}>
                        {EXPENSE_CATEGORIES.map(cat => (
                            <button key={cat.key} type="button" onClick={() => setCategory(cat.key)} style={{
                                flexShrink: 0, padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
                                fontSize: 12, fontWeight: 700,
                                background: category === cat.key ? cat.color : 'white',
                                color:      category === cat.key ? 'white' : '#8B7E96',
                                border:     category === cat.key ? 'none' : '1px solid #F2DCE8',
                            }}>
                                {cat.icon} {cat.label}
                            </button>
                        ))}
                    </div>

                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>תיאור (אופציונלי)</label>
                    <input value={description} onChange={e => setDescription(e.target.value)} placeholder="לדוגמה: ארוחת ערב" style={INPUT} />

                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>תאריך</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={INPUT} />

                    {error && (
                        <div style={{ background: '#FFEFE0', border: '1px solid #FFD4B8', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
                            <p style={{ fontSize: 12, color: '#B45309', fontWeight: 600 }}>⚠️ {error}</p>
                        </div>
                    )}

                    <button type="submit" disabled={saving || !amount} style={{
                        width: '100%', padding: 14, borderRadius: 16, border: 'none',
                        background: saving ? '#F2DCE8' : 'linear-gradient(135deg, #8FD9B8, #A8E6E6)',
                        color: saving ? '#B5A8C0' : 'white', fontSize: 15, fontWeight: 700,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        boxShadow: saving ? 'none' : '0 4px 14px rgba(143,217,184,0.4)',
                    }}>
                        {saving ? 'שומרת...' : 'שמרי הוצאה'}
                    </button>
                </form>
            </div>
        </>
    )
}

// ─────────────────────────────────────────────────────────────────
// ExpensesPage
// ─────────────────────────────────────────────────────────────────
export default function ExpensesPage({ tripId, navigate }) {
    const [trip,             setTrip]             = useState(null)
    const [expenses,         setExpenses]         = useState([])
    const [loading,          setLoading]          = useState(true)
    const [error,            setError]            = useState(null)
    const [showModal,        setShowModal]        = useState(false)
    const [displayCurrency,  setDisplayCurrency]  = useState('ILS')
    const [ilsToUsdRate,     setIlsToUsdRate]     = useState(null)
    const [rateError,        setRateError]        = useState(null)
    const [rateLoading,      setRateLoading]      = useState(false)

    async function loadAll() {
        setLoading(true)
        const [tripRes, expRes] = await Promise.all([
            supabase.from('trips').select('*').eq('id', tripId).single(),
            supabase.from('trip_expenses').select('*').eq('trip_id', tripId).order('expense_date', { ascending: false }),
        ])
        if (tripRes.error) { setError(tripRes.error.message); setLoading(false); return }
        setTrip(tripRes.data)
        setExpenses(expRes.data ?? [])
        setLoading(false)
    }

    useEffect(() => {
        if (!tripId) { navigate('dashboard'); return }
        loadAll()
    }, [tripId])

    async function toggleDisplay(currency) {
        setDisplayCurrency(currency)
        setRateError(null)
        if (currency === 'USD' && ilsToUsdRate == null) {
            setRateLoading(true)
            try {
                const rate = await getExchangeRate('ILS', 'USD')
                setIlsToUsdRate(rate)
            } catch (err) {
                setRateError(err.message)
            }
            setRateLoading(false)
        }
    }

    async function deleteExpense(exp) {
        await supabase.from('trip_expenses').delete().eq('id', exp.id)
        setExpenses(prev => prev.filter(e => e.id !== exp.id))
    }

    function convert(ilsAmount) {
        if (ilsAmount == null) return null
        if (displayCurrency === 'ILS') return ilsAmount
        if (ilsToUsdRate == null) return null
        return ilsAmount * ilsToUsdRate
    }

    if (loading) return (
        <div style={CENTER_SCREEN}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>💰</p>
            <p style={{ color: '#8B7E96', fontSize: 14 }}>טוענת תקציב...</p>
        </div>
    )

    if (error) return (
        <div style={CENTER_SCREEN}>
            <p style={{ fontSize: 36, marginBottom: 10 }}>⚠️</p>
            <p style={{ color: '#c53030', fontSize: 14 }}>שגיאה: {error}</p>
            <button onClick={() => navigate('flow', tripId)} style={BACK_BTN}>חזרה</button>
        </div>
    )

    const totalILS = expenses.reduce((s, e) => s + (e.amount_converted ?? 0), 0)
    const slices = EXPENSE_CATEGORIES
        .map(cat => ({ ...cat, total: expenses.filter(e => e.category === cat.key).reduce((s, e) => s + (e.amount_converted ?? 0), 0) }))
        .filter(c => c.total > 0)

    const symbol = displayCurrency === 'ILS' ? '₪' : '$'
    const displayTotal = convert(totalILS)

    return (
        <div style={{ background: '#FFF8FB', minHeight: '100vh', direction: 'rtl', paddingBottom: 100 }}>

            {/* ═══ HEADER ═══ */}
            <div style={{ background: 'linear-gradient(135deg, #E0F7FA, #E8F8F0, #FFE4EC)', padding: '52px 20px 24px', borderRadius: '0 0 36px 36px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <button onClick={() => navigate('flow', tripId)} style={{ background: 'white', border: '1px solid #F2DCE8', borderRadius: 12, padding: '8px 14px', color: '#4A4458', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,143,171,0.1)' }}>
                        ← חזרה
                    </button>
                    <p style={{ color: '#4A4458', fontSize: 16, fontWeight: 800 }}>💰 תקציב הטיול — {trip?.name}</p>
                </div>

                {/* toggle תצוגה */}
                <div style={{ display: 'inline-flex', background: 'white', borderRadius: 99, padding: 3, border: '1px solid #F2DCE8', marginBottom: 16 }}>
                    {[['ILS', '₪ שקלים'], ['USD', '$ דולרים']].map(([cur, label]) => (
                        <button key={cur} onClick={() => toggleDisplay(cur)} style={{
                            padding: '7px 16px', borderRadius: 99, border: 'none', cursor: 'pointer',
                            fontSize: 12, fontWeight: 700,
                            background: displayCurrency === cur ? 'linear-gradient(135deg, #8FD9B8, #A8E6E6)' : 'transparent',
                            color:      displayCurrency === cur ? 'white' : '#8B7E96',
                        }}>{label}</button>
                    ))}
                </div>

                {rateLoading && <p style={{ fontSize: 11, color: '#8B7E96', marginBottom: 8 }}>טוענת שער המרה...</p>}
                {rateError && <p style={{ fontSize: 11, color: '#c53030', marginBottom: 8 }}>⚠️ {rateError}</p>}

                {/* סיכום + עוגה */}
                <div style={{ background: 'white', borderRadius: 20, padding: '16px', display: 'flex', alignItems: 'center', gap: 16, border: '1px solid #F2DCE8' }}>
                    <DonutChart slices={slices} total={totalILS} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, color: '#8B7E96', marginBottom: 2 }}>סה"כ הוצאות</p>
                        <p style={{ fontSize: 22, fontWeight: 900, color: '#3A9E7A', marginBottom: 10 }}>
                            {displayTotal != null ? `${symbol}${fmt(displayTotal)}` : '—'}
                        </p>
                        {slices.map(s => (
                            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: '#4A4458', flex: 1 }}>{s.icon} {s.label}</span>
                                <span style={{ fontSize: 11, color: '#8B7E96', fontWeight: 700 }}>{Math.round(s.total / totalILS * 100)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ padding: '20px 20px 0' }}>
                {expenses.length === 0 ? (
                    <div style={{ background: 'white', borderRadius: 22, padding: '36px 20px', textAlign: 'center', boxShadow: '0 4px 16px rgba(255,143,171,0.1)', border: '1px dashed #8FD9B8' }}>
                        <p style={{ fontSize: 38, marginBottom: 10 }}>💸</p>
                        <p style={{ color: '#8B7E96', fontSize: 14, marginBottom: 18 }}>עדיין אין הוצאות בטיול הזה</p>
                        <button onClick={() => setShowModal(true)} style={{
                            background: 'linear-gradient(135deg, #8FD9B8, #A8E6E6)', border: 'none', borderRadius: 99,
                            padding: '11px 26px', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(143,217,184,0.4)',
                        }}>
                            + הוסיפי הוצאה ראשונה
                        </button>
                    </div>
                ) : (
                    <>
                        {EXPENSE_CATEGORIES.map(cat => {
                            const catExpenses = expenses.filter(e => e.category === cat.key)
                            if (!catExpenses.length) return null
                            return (
                                <div key={cat.key} style={{ marginBottom: 18 }}>
                                    <p style={{ fontSize: 13, fontWeight: 800, color: '#4A4458', marginBottom: 8 }}>{cat.icon} {cat.label}</p>
                                    {catExpenses.map(exp => {
                                        const converted = convert(exp.amount_converted)
                                        return (
                                            <div key={exp.id} style={{
                                                background: 'white', borderRadius: 14, padding: '12px 14px', marginBottom: 8,
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                boxShadow: '0 3px 12px rgba(255,143,171,0.08)', border: '1px solid #F2DCE8',
                                            }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#4A4458' }}>{exp.description || cat.label}</p>
                                                    <p style={{ fontSize: 11, color: '#B5A8C0', marginTop: 2 }}>
                                                        {Number(exp.amount_local).toLocaleString('he-IL')} {exp.currency_local} · {exp.expense_date}
                                                    </p>
                                                </div>
                                                <p style={{ fontSize: 14, fontWeight: 800, color: '#3A9E7A', flexShrink: 0 }}>
                                                    {converted != null ? `≈ ${symbol}${fmt(converted)}` : '—'}
                                                </p>
                                                <button onClick={() => deleteExpense(exp)} style={{
                                                    width: 28, height: 28, borderRadius: 9, background: '#fff5f5', border: 'none',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    cursor: 'pointer', fontSize: 13, flexShrink: 0,
                                                }}>🗑️</button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        })}
                        <button onClick={() => setShowModal(true)} style={{
                            width: '100%', marginTop: 4, padding: '13px', borderRadius: 16,
                            border: '2px dashed #8FD9B8', background: 'transparent',
                            cursor: 'pointer', color: '#3A9E7A', fontSize: 13, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}>
                            <span style={{ fontSize: 16 }}>+</span> הוסיפי הוצאה
                        </button>
                    </>
                )}
            </div>

            {showModal && (
                <AddExpenseModal
                    tripId={tripId}
                    defaultCurrency={trip?.local_currency}
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); loadAll() }}
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
    marginTop: 16, background: 'linear-gradient(135deg, #8FD9B8, #A8E6E6)', border: 'none', borderRadius: 14,
    padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
}
