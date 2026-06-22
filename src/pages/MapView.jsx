import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getDayCount, persistSchedule } from '../lib/autoSchedule'
import '../globals.css'

// ─────────────────────────────────────────────────────────────────
// geo helpers (מקומי — עקבי עם buildNNRoute/haversine שכבר קיימים
// ב-BuilderPage.jsx, רק ממוקד על מרחק גיאוגרפי בלי שעות פעילות)
// ─────────────────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, toRad = x => x * Math.PI / 180
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.asin(Math.sqrt(a))
}

function buildNNRoute(atts) {
    if (atts.length <= 1) return atts
    const rem = [...atts]
    const result = [rem.splice(0, 1)[0]]
    while (rem.length) {
        const last = result[result.length - 1]
        let ni = 0, nd = Infinity
        for (let i = 0; i < rem.length; i++) {
            const d = haversine(last.latitude, last.longitude, rem[i].latitude, rem[i].longitude)
            if (d < nd) { nd = d; ni = i }
        }
        result.push(rem.splice(ni, 1)[0])
    }
    return result
}

function totalDistance(points) {
    let sum = 0
    for (let i = 0; i < points.length - 1; i++) {
        sum += haversine(points[i].latitude, points[i].longitude, points[i + 1].latitude, points[i + 1].longitude)
    }
    return sum
}

function hasCoords(att) {
    if (att.latitude == null || att.longitude == null) return false
    const lat = Number(att.latitude), lng = Number(att.longitude)
    return Number.isFinite(lat) && Number.isFinite(lng)
}

function buildGoogleMapsUrl(points, travelMode) {
    if (points.length < 2) return null
    const origin      = `${points[0].latitude},${points[0].longitude}`
    const destination  = `${points[points.length - 1].latitude},${points[points.length - 1].longitude}`
    const mid = points.slice(1, -1)
    const params = new URLSearchParams({ api: '1', origin, destination, travelmode: travelMode })
    let url = `https://www.google.com/maps/dir/?${params.toString()}`
    if (mid.length) url += `&waypoints=${encodeURIComponent(mid.map(p => `${p.latitude},${p.longitude}`).join('|'))}`
    return url
}

// ─────────────────────────────────────────────────────────────────
// RouteList — רשימה ממוספרת (תחליף זמני לסיכות על מפה)
// ─────────────────────────────────────────────────────────────────
function RouteList({ points, accent }) {
    return (
        <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 16, bottom: 16, right: 15, width: 2, background: accent, opacity: 0.15, borderRadius: 1 }} />
            {points.map((att, i) => (
                <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, position: 'relative', zIndex: 1 }}>
                    <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: `linear-gradient(135deg, ${accent}, #D4C2F0)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 800, fontSize: 12,
                        boxShadow: `0 3px 10px ${accent}55`,
                    }}>
                        {i + 1}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#4A4458' }}>{att.name}</p>
                </div>
            ))}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// MapView
// ─────────────────────────────────────────────────────────────────
export default function MapView({ tripId, navigate }) {
    const [trip,             setTrip]             = useState(null)
    const [attractions,      setAttractions]      = useState([])
    const [loading,          setLoading]          = useState(true)
    const [error,            setError]            = useState(null)
    const [activeDay,        setActiveDay]        = useState(1)
    const [recommendedRoute, setRecommendedRoute] = useState(null)
    const [travelMode,       setTravelMode]       = useState('walking')
    const [adopting,         setAdopting]         = useState(false)
    const [toast,            setToast]            = useState(null)

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

    useEffect(() => {
        if (!tripId) { navigate('dashboard'); return }
        loadAll()
    }, [tripId])

    function showToast(message) {
        setToast(message)
        setTimeout(() => setToast(null), 3000)
    }

    function findEfficientRoute() {
        if (dayWithCoords.length < 2) return
        setRecommendedRoute(buildNNRoute(dayWithCoords))
    }

    async function adoptRoute() {
        if (!recommendedRoute) return
        setAdopting(true)
        const dayCount = getDayCount(trip)
        const newDayOrder = [...recommendedRoute, ...dayWithoutCoords]

        const merged = []
        for (let d = 1; d <= dayCount; d++) {
            if (d === activeDay) merged.push(...newDayOrder)
            else merged.push(...attractions.filter(a => (a.scheduled_day ?? 1) === d).sort((a, b) => a.order_index - b.order_index))
        }
        const renumbered = merged.map((a, i) => ({ ...a, order_index: i }))

        await Promise.all(renumbered.map(a => supabase.from('attractions').update({ order_index: a.order_index }).eq('id', a.id)))
        const finalList = await persistSchedule(renumbered, dayCount)

        setAttractions(finalList)
        setRecommendedRoute(null)
        setAdopting(false)
        showToast('✓ המסלול אומץ — Flow וציר הזמן יציגו את הסדר החדש בכניסה הבאה')
    }

    function openGoogleMaps() {
        const points = recommendedRoute ?? dayWithCoords
        const url = buildGoogleMapsUrl(points, travelMode)
        if (url) window.open(url, '_blank')
    }

    if (loading) return (
        <div style={CENTER_SCREEN}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🗺️</p>
            <p style={{ color: '#8B7E96', fontSize: 14 }}>טוענת מפה...</p>
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
    const dayAttractions  = attractions.filter(a => (a.scheduled_day ?? 1) === activeDay).sort((a, b) => a.order_index - b.order_index)
    const dayWithCoords    = dayAttractions.filter(hasCoords)
    const dayWithoutCoords = dayAttractions.filter(a => !hasCoords(a))

    const currentDistance     = totalDistance(dayWithCoords)
    const recommendedDistance = recommendedRoute ? totalDistance(recommendedRoute) : null

    return (
        <div style={{ background: '#FFF8FB', minHeight: '100vh', direction: 'rtl', paddingBottom: 60 }}>

            {/* ═══ HEADER ═══ */}
            <div style={{ background: 'linear-gradient(135deg, #FFE4EC, #F0E8FA, #E0F7FA)', padding: '52px 20px 20px', borderRadius: '0 0 36px 36px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <button onClick={() => navigate('flow', tripId)} style={{ background: 'white', border: '1px solid #F2DCE8', borderRadius: 12, padding: '8px 14px', color: '#4A4458', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,143,171,0.1)' }}>
                        ← חזרה
                    </button>
                    <p style={{ color: '#4A4458', fontSize: 16, fontWeight: 800 }}>🗺️ מפה — {trip?.name}</p>
                </div>

                {dayCount > 1 && (
                    <div className="scroll-x" style={{ gap: 8 }}>
                        {Array.from({ length: dayCount }, (_, i) => i + 1).map(d => (
                            <button key={d} onClick={() => { setActiveDay(d); setRecommendedRoute(null) }} style={{
                                flexShrink: 0, padding: '7px 16px', borderRadius: 24, cursor: 'pointer',
                                fontSize: 12, fontWeight: 700,
                                background: activeDay === d ? 'linear-gradient(135deg, #FF8FAB, #D4C2F0)' : 'white',
                                color:      activeDay === d ? 'white' : '#8B7E96',
                                border:     activeDay === d ? 'none' : '1px solid #F2DCE8',
                                boxShadow:  activeDay === d ? '0 3px 10px rgba(255,143,171,0.35)' : 'none',
                            }}>יום {d}</button>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ padding: '20px 20px 0' }}>

                {/* הערה — אין עדיין מפה חזותית */}
                <div style={{ background: '#F0E8FA', border: '1px solid #D4C2F0', borderRadius: 12, padding: '8px 14px', marginBottom: 16 }}>
                    <p style={{ fontSize: 11, color: '#7A5AAB', fontWeight: 600 }}>
                        🗺️ תצוגת מפה חזותית (סיכות + קו) תתווסף בהמשך — בינתיים הסדר מוצג כרשימה ממוספרת
                    </p>
                </div>

                {dayWithCoords.length === 0 ? (
                    <div style={{ background: 'white', borderRadius: 22, padding: '36px 20px', textAlign: 'center', boxShadow: '0 4px 16px rgba(255,143,171,0.1)', border: '1px solid #F2DCE8', marginBottom: 16 }}>
                        <p style={{ fontSize: 36, marginBottom: 8 }}>📍</p>
                        <p style={{ color: '#8B7E96', fontSize: 14 }}>אין עצירות עם מיקום מדויק ביום הזה</p>
                    </div>
                ) : (
                    <>
                        {/* מסלול נוכחי */}
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#4A4458', marginBottom: 10 }}>מסלול נוכחי</p>
                        <div style={{ background: 'white', borderRadius: 18, padding: '16px', marginBottom: 14, boxShadow: '0 4px 16px rgba(255,143,171,0.1)', border: '1px solid #F2DCE8' }}>
                            <RouteList points={dayWithCoords} accent="#FF8FAB" />
                        </div>

                        {/* השוואת מרחק */}
                        <div style={{ background: 'white', borderRadius: 18, padding: '16px', marginBottom: 14, boxShadow: '0 4px 16px rgba(255,143,171,0.1)', border: '1px solid #F2DCE8' }}>
                            <p style={{ fontSize: 13, color: '#4A4458', marginBottom: recommendedDistance != null ? 4 : 0 }}>
                                המסלול הנוכחי: כ-<b>{currentDistance.toFixed(1)}</b> ק"מ הליכה משוערת
                            </p>
                            {recommendedDistance != null && (
                                <p style={{ fontSize: 13, color: '#2D6E6E', fontWeight: 700 }}>
                                    המסלול המומלץ: כ-<b>{recommendedDistance.toFixed(1)}</b> ק"מ
                                    {recommendedDistance < currentDistance && (
                                        <span style={{ color: '#3A9E7A' }}> (חיסכון של {(currentDistance - recommendedDistance).toFixed(1)} ק"מ ✨)</span>
                                    )}
                                </p>
                            )}
                        </div>

                        {dayWithCoords.length >= 2 && !recommendedRoute && (
                            <button onClick={findEfficientRoute} style={{
                                width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', marginBottom: 14,
                                background: 'linear-gradient(135deg, #A8E6E6, #B8E8D4)', color: '#2D6E6E',
                                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(168,230,230,0.4)',
                            }}>
                                ⚡ מצא מסלול יעיל
                            </button>
                        )}

                        {/* מסלול מומלץ */}
                        {recommendedRoute && (
                            <>
                                <p style={{ fontSize: 13, fontWeight: 800, color: '#2D6E6E', marginBottom: 10 }}>מסלול מומלץ</p>
                                <div style={{ background: '#E8F8F0', borderRadius: 18, padding: '16px', marginBottom: 14, boxShadow: '0 4px 16px rgba(184,232,212,0.3)', border: '1px solid #B8E8D4' }}>
                                    <RouteList points={recommendedRoute} accent="#3A9E7A" />
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                                    <button onClick={() => setRecommendedRoute(null)} disabled={adopting} style={{
                                        flex: 1, padding: '12px 0', borderRadius: 14, border: '1px solid #F2DCE8', background: 'white',
                                        color: '#8B7E96', fontSize: 13, fontWeight: 700, cursor: adopting ? 'not-allowed' : 'pointer',
                                    }}>
                                        בטלי
                                    </button>
                                    <button onClick={adoptRoute} disabled={adopting} style={{
                                        flex: 2, padding: '12px 0', borderRadius: 14, border: 'none',
                                        background: adopting ? '#F2DCE8' : 'linear-gradient(135deg, #FF8FAB, #D4C2F0)',
                                        color: adopting ? '#B5A8C0' : 'white', fontSize: 13, fontWeight: 700,
                                        cursor: adopting ? 'not-allowed' : 'pointer',
                                        boxShadow: adopting ? 'none' : '0 4px 14px rgba(255,143,171,0.4)',
                                    }}>
                                        {adopting ? 'מאמצת...' : '✓ אמץ מסלול זה'}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Google Maps export */}
                        <div style={{ background: 'white', borderRadius: 18, padding: '16px', marginBottom: 14, boxShadow: '0 4px 16px rgba(255,143,171,0.1)', border: '1px solid #F2DCE8' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <p style={{ fontSize: 13, fontWeight: 700, color: '#4A4458' }}>אופן הגעה</p>
                                <div style={{ display: 'flex', background: '#FFF8FB', borderRadius: 99, padding: 3, border: '1px solid #F2DCE8' }}>
                                    {[['walking', '🚶 הליכה'], ['driving', '🚗 נסיעה']].map(([mode, label]) => (
                                        <button key={mode} onClick={() => setTravelMode(mode)} style={{
                                            padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
                                            fontSize: 11, fontWeight: 700,
                                            background: travelMode === mode ? 'linear-gradient(135deg, #FF8FAB, #D4C2F0)' : 'transparent',
                                            color:      travelMode === mode ? 'white' : '#8B7E96',
                                        }}>{label}</button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={openGoogleMaps} style={{
                                width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
                                background: 'linear-gradient(135deg, #4285F4, #34A853)', color: 'white',
                                fontSize: 14, fontWeight: 800, cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(66,133,244,0.4)',
                            }}>
                                🗺️ פתח ב-Google Maps
                            </button>
                        </div>
                    </>
                )}

                {/* אטרקציות בלי מיקום */}
                {dayWithoutCoords.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                        {dayWithoutCoords.map(att => (
                            <p key={att.id} style={{ fontSize: 12, color: '#c53030', marginBottom: 6 }}>
                                ⚠️ {att.name} לא יכולה להיכלל — אין לה מיקום מדויק
                            </p>
                        ))}
                    </div>
                )}
            </div>

            {toast && (
                <div style={{
                    position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 400,
                    background: 'linear-gradient(135deg, #276749, #38a169)', color: 'white', borderRadius: 99,
                    padding: '12px 22px', fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
                    whiteSpace: 'nowrap', direction: 'rtl', animation: 'fadeIn 0.2s ease',
                }}>
                    {toast}
                </div>
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
