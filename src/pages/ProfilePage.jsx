import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import BottomNav from '../components/BottomNav'
import '../globals.css'

const INPUT = {
    width: '100%', padding: '14px 16px',
    borderRadius: 14, border: '1px solid #F2DCE8',
    background: '#FFF8FB', fontSize: 15, color: '#4A4458',
    outline: 'none', direction: 'ltr', marginBottom: 14,
}

export default function ProfilePage({ navigate, user }) {
    const [mode,       setMode]       = useState('login')
    const [fullName,   setFullName]   = useState('')
    const [email,      setEmail]      = useState('')
    const [password,   setPassword]   = useState('')
    const [loading,    setLoading]    = useState(false)
    const [error,      setError]      = useState(null)
    const [success,    setSuccess]    = useState(null)
    const [tripsCount, setTripsCount] = useState(null)

    useEffect(() => { if (user) loadStats() }, [user])

    async function loadStats() {
        const { count } = await supabase
            .from('trips').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
        setTripsCount(count ?? 0)
    }

    function switchMode(m) { setMode(m); setFullName(''); setError(null); setSuccess(null) }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!email.trim() || !password.trim()) return
        setLoading(true); setError(null); setSuccess(null)
        if (mode === 'login') {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) setError(translateError(error.message))
        } else {
            if (!fullName.trim()) { setError('נא להזין שם מלא'); setLoading(false); return }
            const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName.trim() } } })
            if (error) setError(translateError(error.message))
            else setSuccess('נשלח אימייל אישור! בדקי את תיבת הדואר שלך ואשרי את החשבון.')
        }
        setLoading(false)
    }

    async function signOut() { await supabase.auth.signOut() }

    function translateError(msg) {
        if (msg.includes('Invalid login'))      return 'אימייל או סיסמה שגויים'
        if (msg.includes('Email not confirmed')) return 'האימייל עוד לא אושר. בדקי את הדואר שלך'
        if (msg.includes('already registered')) return 'כתובת האימייל כבר רשומה במערכת'
        if (msg.includes('Password should be')) return 'הסיסמה חייבת להכיל לפחות 6 תווים'
        if (msg.includes('rate limit'))         return 'יותר מדי ניסיונות. נסי שוב עוד כמה דקות'
        return msg
    }

    const userInitial = user?.email?.[0]?.toUpperCase() ?? '?'

    /* ─── LOGGED IN ─── */
    if (user) return (
        <div style={{ background: '#FFF8FB', minHeight: '100vh', direction: 'rtl' }}>
            <div style={{ background: 'linear-gradient(135deg, #FFE4EC, #F0E8FA, #E0F7FA)', padding: '60px 20px 40px', borderRadius: '0 0 40px 40px', textAlign: 'center' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 32, margin: '0 auto 14px', boxShadow: '0 6px 20px rgba(255,143,171,0.4)' }}>
                    {userInitial}
                </div>
                <p style={{ color: '#4A4458', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>שלום 👋</p>
                <p style={{ color: '#8B7E96', fontSize: 13, direction: 'ltr' }}>{user.email}</p>
            </div>

            <div style={{ padding: '24px 20px 120px' }}>
                <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
                    {[
                        { value: tripsCount ?? '–', label: 'הטיולים שלי', bg: '#FFE4EC', num: '#FF8FAB' },
                        { value: 12,               label: 'יעדים לגלות',  bg: '#E0F7FA', num: '#7FD4D4' },
                    ].map((s, i) => (
                        <div key={i} style={{ flex: 1, background: 'white', borderRadius: 20, padding: '18px 0', textAlign: 'center', boxShadow: '0 4px 20px rgba(255,179,198,0.15)', border: `1px solid ${s.bg}` }}>
                            <p style={{ fontSize: 28, fontWeight: 900, color: s.num }}>{s.value}</p>
                            <p style={{ color: '#B5A8C0', fontSize: 12, marginTop: 3 }}>{s.label}</p>
                        </div>
                    ))}
                </div>

                <div style={{ background: 'white', borderRadius: 20, padding: '18px 20px', boxShadow: '0 4px 20px rgba(255,179,198,0.12)', marginBottom: 16, border: '1px solid #F2DCE8' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#B5A8C0', marginBottom: 12 }}>פרטי חשבון</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid #F2DCE8' }}>
                        <span style={{ fontSize: 14, color: '#4A4458', fontWeight: 600 }}>אימייל</span>
                        <span style={{ fontSize: 13, color: '#8B7E96', direction: 'ltr' }}>{user.email}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
                        <span style={{ fontSize: 14, color: '#4A4458', fontWeight: 600 }}>חבר מאז</span>
                        <span style={{ fontSize: 13, color: '#8B7E96' }}>
                            {new Date(user.created_at).toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })}
                        </span>
                    </div>
                </div>

                <div style={{ background: 'white', borderRadius: 20, padding: '4px', boxShadow: '0 4px 20px rgba(255,179,198,0.12)', marginBottom: 20, border: '1px solid #F2DCE8' }}>
                    {[
                        { icon: '✈️', label: 'הטיולים שלי', action: () => navigate('trips')   },
                        { icon: '🌍', label: 'גלי יעדים',   action: () => navigate('discover') },
                    ].map((item, i) => (
                        <div key={i} onClick={item.action} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer', borderBottom: i === 0 ? '1px solid #F2DCE8' : 'none' }}>
                            <span style={{ fontSize: 22 }}>{item.icon}</span>
                            <span style={{ fontSize: 15, fontWeight: 600, color: '#4A4458', flex: 1 }}>{item.label}</span>
                            <span style={{ color: '#B5A8C0', fontSize: 14 }}>←</span>
                        </div>
                    ))}
                </div>

                <button onClick={signOut} style={{ width: '100%', padding: '15px', borderRadius: 99, border: '2px solid #FFB3C6', background: 'transparent', color: '#FF8FAB', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                    התנתקי מהחשבון
                </button>
            </div>

            <BottomNav active="profile" navigate={navigate} />
        </div>
    )

    /* ─── AUTH FORM ─── */
    return (
        <div style={{ background: '#FFF8FB', minHeight: '100vh', direction: 'rtl' }}>
            <div style={{ background: 'linear-gradient(135deg, #FFE4EC, #F0E8FA, #E0F7FA)', padding: '60px 20px 50px', borderRadius: '0 0 40px 40px', textAlign: 'center' }}>
                <div style={{ fontSize: 52, marginBottom: 10 }}>✈️</div>
                <h1 style={{ color: '#4A4458', fontSize: 28, fontWeight: 900, marginBottom: 6 }}>TripFlow</h1>
                <p style={{ color: '#8B7E96', fontSize: 14 }}>גלי, תכנני ונסעי לכל מקום</p>
            </div>

            <div style={{ padding: '32px 20px 120px' }}>
                <div style={{ display: 'flex', background: 'white', borderRadius: 20, padding: 4, boxShadow: '0 2px 12px rgba(255,143,171,0.1)', marginBottom: 24, border: '1px solid #F2DCE8' }}>
                    {[['login', 'התחברי'], ['signup', 'הרשמי']].map(([m, label]) => (
                        <button key={m} onClick={() => switchMode(m)} style={{
                            flex: 1, padding: '11px 0', borderRadius: 16, border: 'none', cursor: 'pointer',
                            fontSize: 14, fontWeight: 700,
                            background: mode === m ? 'linear-gradient(135deg, #FF8FAB, #D4C2F0)' : 'transparent',
                            color:      mode === m ? 'white' : '#8B7E96',
                            boxShadow:  mode === m ? '0 3px 10px rgba(255,143,171,0.35)' : 'none',
                            transition: 'all 0.2s',
                        }}>{label}</button>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    {mode === 'signup' && (
                        <>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>שם מלא</label>
                            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="לדוגמה: דנה כהן" required style={INPUT} />
                        </>
                    )}
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>כתובת אימייל</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required style={INPUT} />
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8B7E96', marginBottom: 6 }}>סיסמה</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'לפחות 6 תווים' : '••••••••'} required style={INPUT} />

                    {error && (
                        <div style={{ background: '#FFEFE0', border: '1px solid #FFD4B8', borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
                            <p style={{ color: '#B45309', fontSize: 13, fontWeight: 600 }}>⚠️ {error}</p>
                        </div>
                    )}
                    {success && (
                        <div style={{ background: '#E8F8F0', border: '1px solid #B8E8D4', borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
                            <p style={{ color: '#276749', fontSize: 13, fontWeight: 600 }}>✅ {success}</p>
                        </div>
                    )}

                    <button type="submit" disabled={loading} style={{
                        width: '100%', padding: '15px', borderRadius: 99, border: 'none',
                        background: loading ? '#F2DCE8' : 'linear-gradient(135deg, #FF8FAB, #D4C2F0)',
                        color: loading ? '#B5A8C0' : 'white', fontSize: 16, fontWeight: 800,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        boxShadow: loading ? 'none' : '0 6px 20px rgba(255,143,171,0.4)',
                        marginBottom: 16,
                    }}>
                        {loading ? 'אנחנו בודקים...' : mode === 'login' ? 'התחברי ✈️' : 'צרי חשבון ✈️'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', color: '#B5A8C0', fontSize: 12 }}>
                    {mode === 'login' ? 'עדיין אין לך חשבון? ' : 'כבר יש לך חשבון? '}
                    <span onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')} style={{ color: '#FF8FAB', fontWeight: 700, cursor: 'pointer' }}>
                        {mode === 'login' ? 'הרשמי כאן' : 'התחברי כאן'}
                    </span>
                </p>
            </div>

            <BottomNav active="profile" navigate={navigate} />
        </div>
    )
}
