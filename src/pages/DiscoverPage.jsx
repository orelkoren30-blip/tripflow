import { useState } from 'react'
import { DESTINATIONS, CATEGORIES } from '../data/destinations'
import BottomNav from '../components/BottomNav'
import '../globals.css'

export default function DiscoverPage({ navigate }) {
    const [activeCategory, setActiveCategory] = useState('הכל')
    const [search,         setSearch]         = useState('')

    const filtered = DESTINATIONS.filter(d => {
        const matchCat    = activeCategory === 'הכל' || d.category === activeCategory
        const matchSearch = !search.trim() || d.name.includes(search) || d.country.includes(search)
        return matchCat && matchSearch
    })

    function planTrip(dest) {
        navigate('dashboard', null, { coverImageUrl: dest.img, name: dest.name, destination: dest.name })
    }

    return (
        <div style={{ background: '#FFF8FB', minHeight: '100vh', direction: 'rtl' }}>

            {/* ═══ HEADER ═══ */}
            <div style={{ background: 'linear-gradient(135deg, #FFE4EC, #F0E8FA, #E0F7FA)', padding: '52px 20px 24px', borderRadius: '0 0 36px 36px' }}>
                <h1 style={{ color: '#4A4458', fontSize: 27, fontWeight: 900, marginBottom: 4 }}>גלי יעדים 🌍</h1>
                <p style={{ color: '#8B7E96', fontSize: 13, marginBottom: 18 }}>בחרי יעד חלום ותתחילי לתכנן</p>

                <div style={{ background: 'white', borderRadius: 18, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #F2DCE8', boxShadow: '0 2px 10px rgba(255,143,171,0.1)' }}>
                    <span style={{ fontSize: 16, color: '#B5A8C0' }}>🔍</span>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="חפשי יעד או מדינה..."
                        style={{ background: 'transparent', border: 'none', outline: 'none', color: '#4A4458', fontSize: 14, flex: 1, direction: 'rtl' }}
                    />
                    {search && (
                        <span onClick={() => setSearch('')} style={{ color: '#B5A8C0', cursor: 'pointer', fontSize: 15 }}>✕</span>
                    )}
                </div>
            </div>

            <div style={{ padding: '0 16px 120px' }}>

                {/* ═══ CATEGORIES ═══ */}
                <div className="scroll-x" style={{ gap: 8, paddingTop: 20, paddingBottom: 4 }}>
                    {CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                            flexShrink: 0, padding: '8px 18px', borderRadius: 24, cursor: 'pointer',
                            fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
                            background: activeCategory === cat ? 'linear-gradient(135deg, #FF8FAB, #D4C2F0)' : 'white',
                            color:      activeCategory === cat ? 'white' : '#8B7E96',
                            boxShadow:  activeCategory === cat ? '0 4px 14px rgba(255,143,171,0.35)' : '0 2px 8px rgba(255,143,171,0.1)',
                            border:     activeCategory === cat ? 'none' : '1px solid #F2DCE8',
                        }}>{cat}</button>
                    ))}
                </div>

                <p style={{ color: '#B5A8C0', fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 14 }}>
                    {filtered.length} יעדים
                </p>

                {/* ═══ GRID ═══ */}
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <p style={{ fontSize: 40, marginBottom: 10 }}>🔍</p>
                        <p style={{ color: '#8B7E96', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>לא נמצאו יעדים</p>
                        <p style={{ color: '#B5A8C0', fontSize: 13 }}>נסי לחפש משהו אחר</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                        {filtered.map((dest, index) => (
                            <div
                                key={dest.id}
                                onClick={() => planTrip(dest)}
                                style={{
                                    width: 'calc(50% - 7px)',
                                    borderRadius: 22, overflow: 'hidden',
                                    position: 'relative', cursor: 'pointer',
                                    height: index % 5 === 0 ? 230 : 190,
                                    boxShadow: '0 8px 24px rgba(255,143,171,0.18)',
                                    border: '2px solid rgba(255,255,255,0.8)',
                                }}
                            >
                                <img src={dest.img} alt={dest.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(74,68,88,0.85) 40%, rgba(74,68,88,0.05) 75%)' }} />

                                {/* category badge */}
                                <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,228,236,0.85)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '3px 10px', border: '1px solid rgba(255,179,198,0.5)' }}>
                                    <span style={{ color: '#D4607A', fontSize: 9, fontWeight: 800 }}>{dest.category}</span>
                                </div>

                                {/* plan button */}
                                <div style={{ position: 'absolute', top: 10, left: 10, background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)', borderRadius: 20, padding: '4px 10px', boxShadow: '0 3px 10px rgba(255,143,171,0.5)' }}>
                                    <span style={{ color: 'white', fontSize: 10, fontWeight: 800 }}>+ תכנני</span>
                                </div>

                                {/* info */}
                                <div style={{ position: 'absolute', bottom: 10, right: 12, left: 12 }}>
                                    <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 9, marginBottom: 2 }}>{dest.country}</p>
                                    <p style={{ color: 'white', fontSize: 14, fontWeight: 800, marginBottom: 4, lineHeight: 1.2 }}>{dest.name}</p>
                                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, lineHeight: 1.4 }}>{dest.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <BottomNav active="discover" navigate={navigate} onNewTrip={() => navigate('dashboard', null, {})} />
        </div>
    )
}
