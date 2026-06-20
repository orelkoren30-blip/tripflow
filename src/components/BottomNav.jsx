export default function BottomNav({ active, navigate, onNewTrip }) {
    const tabs = [
        { id: 'home',     page: 'dashboard', icon: '🏠', label: 'ראשי'   },
        { id: 'discover', page: 'discover',  icon: '🔍', label: 'גלי'    },
        { id: 'new',      page: null,        icon: '+',  label: 'חדש'    },
        { id: 'trips',    page: 'trips',     icon: '🗺️', label: 'טיולים' },
        { id: 'profile',  page: 'profile',   icon: '👤', label: 'פרופיל' },
    ]

    return (
        <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderTop: '1px solid #F2DCE8',
            padding: '8px 0 20px',
            display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end',
            boxShadow: '0 -4px 20px rgba(255,143,171,0.1)',
            fontFamily: "'Heebo', sans-serif",
        }}>
            {tabs.map(tab => {
                const isActive = active === tab.id
                const isNew    = tab.id === 'new'
                return (
                    <div
                        key={tab.id}
                        onClick={() => isNew ? onNewTrip?.() : navigate(tab.page)}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', minWidth: 52 }}
                    >
                        {isNew ? (
                            <div style={{
                                width: 48, height: 48, borderRadius: '50%',
                                background: 'linear-gradient(135deg, #FF8FAB, #D4C2F0)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontSize: 26, fontWeight: 300,
                                boxShadow: '0 4px 16px rgba(255,143,171,0.45)',
                                marginTop: -18,
                            }}>+</div>
                        ) : (
                            <span style={{ fontSize: 22 }}>{tab.icon}</span>
                        )}
                        <span style={{
                            fontSize: 10, fontWeight: 700,
                            color: isActive ? '#FF8FAB' : '#B5A8C0',
                        }}>
                            {tab.label}
                        </span>
                        {isActive && !isNew && (
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#FF8FAB' }} />
                        )}
                    </div>
                )
            })}
        </div>
    )
}
