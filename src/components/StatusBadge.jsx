import { useState } from 'react'

const STATUS_CONFIG = {
    planned:     { label: 'מתוכנן', icon: '📋', bg: '#F2F1F5', text: '#6B6478', border: '#E2DEEA' },
    in_progress: { label: 'בטיפול', icon: '⏳', bg: '#E0F7FA', text: '#3A9E9E', border: '#A8E6E6' },
    done:        { label: 'הושלם',  icon: '✅', bg: '#E8F8F0', text: '#3A9E7A', border: '#B8E8D4' },
    urgent:      { label: 'דחוף',   icon: '🔥', bg: '#FFE4E0', text: '#D14545', border: '#FFB3A0' },
}

const ORDER = ['planned', 'in_progress', 'done', 'urgent']

export default function StatusBadge({ status, onChange }) {
    const [open, setOpen] = useState(false)
    const current = STATUS_CONFIG[status] ?? STATUS_CONFIG.planned

    function select(key) {
        setOpen(false)
        if (key !== status) onChange(key)
    }

    return (
        <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
                style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: current.bg, border: `1px solid ${current.border}`,
                    borderRadius: 99, padding: '3px 10px', cursor: 'pointer',
                    fontSize: 11, fontWeight: 700, color: current.text,
                    whiteSpace: 'nowrap',
                }}
            >
                <span>{current.icon}</span>
                <span>{current.label}</span>
            </button>

            {open && (
                <>
                    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                    <div style={{
                        position: 'absolute', top: '110%', left: 0, zIndex: 151,
                        background: 'white', borderRadius: 14, padding: 6,
                        boxShadow: '0 8px 24px rgba(255,143,171,0.25)', border: '1px solid #F2DCE8',
                        minWidth: 130, display: 'flex', flexDirection: 'column', gap: 3,
                    }}>
                        {ORDER.map(key => {
                            const cfg = STATUS_CONFIG[key]
                            const isCurrent = key === status
                            return (
                                <button
                                    key={key}
                                    onClick={(e) => { e.stopPropagation(); select(key) }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 7,
                                        background: isCurrent ? cfg.bg : 'transparent',
                                        border: 'none', borderRadius: 10, padding: '7px 10px',
                                        cursor: 'pointer', fontSize: 12, fontWeight: 700,
                                        color: cfg.text, textAlign: 'right',
                                    }}
                                >
                                    <span>{cfg.icon}</span>
                                    <span>{cfg.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}
