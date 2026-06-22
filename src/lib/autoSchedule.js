import { supabase } from './supabaseClient'

// ─────────────────────────────────────────────────────────────────
// ברירות מחדל לשעות פעילות לפי סוג
// ─────────────────────────────────────────────────────────────────
const DEFAULT_HOURS_BY_TYPE = {
    'מוזיאון':      '09:00-17:00', 'גלריה':      '10:00-18:00',
    'שוק':          '08:00-22:00', 'שוק מקומי':  '08:00-22:00',
    'שוק לילה':     '18:00-02:00', 'פארק':       '06:00-20:00',
    'גן':           '07:00-19:00', 'מסעדה':      '12:00-23:00',
    'בר':           '17:00-02:00', 'קפה':        '07:00-22:00',
    'חוף':          '06:00-21:00', 'חוף ים':     '06:00-21:00',
    'מקדש':         '08:00-18:00', 'כנסייה':     '08:00-18:00',
    'מסגד':         '09:00-17:00', 'מצודה':      '09:00-17:00',
    'ארמון':        '09:00-17:00', 'אנדרטה':     '00:00-23:59',
    'גשר':          '00:00-23:59', 'טבע':        '06:00-20:00',
    'הר':           '06:00-20:00', 'נפלאות טבע': '06:00-20:00',
    'אטרקציה':      '09:00-18:00', 'קניון':      '10:00-22:00',
}
export function getDefaultHours(type) { return DEFAULT_HOURS_BY_TYPE[type] ?? null }

export function parseHours(str) {
    if (!str) return null
    const m = str.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/)
    return m ? { open: +m[1] * 60 + +m[2], close: +m[3] * 60 + +m[4] } : null
}

export function parseDuration(str) {
    if (!str) return 60
    const range = str.match(/(\d+)-(\d+)\s*שעות?/)
    if (range) return Math.round(((+range[1] + +range[2]) / 2) * 60)
    const hrs = str.match(/(\d+)\s*שעות?/)
    if (hrs) return +hrs[1] * 60
    const mins = str.match(/(\d+)\s*דקות/)
    if (mins) return +mins[1]
    if (str.includes('יום')) return 360
    return 60
}

export function fitsHours(att, arrivalMins) {
    const h = parseHours(att.opening_hours || getDefaultHours(att.type))
    return h ? arrivalMins >= h.open && arrivalMins < h.close : true
}

export function timeToMinutes(str) {
    if (!str) return null
    const [h, m] = str.split(':').map(Number)
    return h * 60 + m
}

export function minutesToTime(mins) {
    const safe = Math.round(mins)
    const h = Math.floor(safe / 60).toString().padStart(2, '0')
    const m = (safe % 60).toString().padStart(2, '0')
    return `${h}:${m}`
}

export function getDayCount(trip) {
    if (!trip?.start_date || !trip?.end_date) return 1
    const start = new Date(trip.start_date + 'T00:00')
    const end   = new Date(trip.end_date + 'T00:00')
    const diff  = Math.round((end - start) / 86400000) + 1
    return diff > 0 ? diff : 1
}

// ─────────────────────────────────────────────────────────────────
// autoScheduleTimeline — שיבוץ אוטומטי של יום+שעה לכל אטרקציה
// ─────────────────────────────────────────────────────────────────
export const SCHEDULE_DAY_START = 9 * 60   // 09:00
export const SCHEDULE_DAY_END   = 22 * 60  // 22:00 — יום מלא, עוברים ליום הבא
export const TRAVEL_MINS = 20
const UNSCHEDULED_REASON = 'שעות הפעילות לא מתאימות לזמן הפנוי בטיול'

// מחפש את היום/שעה הקרובים שמתאימים לשעות הפעילות, מתקדם יום-יום עד dayCount
function scheduleOne(att, day, clock, dayCount) {
    const hours = parseHours(att.opening_hours || getDefaultHours(att.type))
    let d = day, t = clock
    for (let guard = 0; guard <= dayCount + 1; guard++) {
        if (d > dayCount) return { unscheduled: true }
        if (t > SCHEDULE_DAY_END) { d += 1; t = SCHEDULE_DAY_START; continue }
        if (!hours) return { day: d, time: t }
        if (t < hours.open) { t = hours.open; continue }
        if (t >= hours.close) { d += 1; t = Math.max(SCHEDULE_DAY_START, hours.open); continue }
        return { day: d, time: t }
    }
    return { unscheduled: true }
}

/**
 * מקבל את כל האטרקציות של הטיול (לפי order_index) ומספר ימים,
 * ומחזיר תוכנית שיבוץ: { id, scheduled_day, estimated_arrival_time, unscheduled, manually_placed, reason }[]
 * אטרקציות עם manually_placed=true נשארות במקומן הקיים ולא מחושבות מחדש.
 */
export function autoScheduleTimeline(attractions, dayCount) {
    const safeDayCount = Math.max(1, dayCount)
    const sorted = [...attractions].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))

    let day = 1
    let clock = SCHEDULE_DAY_START
    let exhausted = false

    return sorted.map(att => {
        if (att.manually_placed) {
            const d = att.scheduled_day ?? 1
            const t = timeToMinutes(att.estimated_arrival_time) ?? SCHEDULE_DAY_START
            day = d
            clock = t + parseDuration(att.estimated_duration) + TRAVEL_MINS
            return { id: att.id, scheduled_day: d, estimated_arrival_time: minutesToTime(t), unscheduled: false, manually_placed: true, reason: null }
        }

        if (exhausted) {
            return { id: att.id, scheduled_day: null, estimated_arrival_time: null, unscheduled: true, manually_placed: false, reason: UNSCHEDULED_REASON }
        }

        const placement = scheduleOne(att, day, clock, safeDayCount)
        if (placement.unscheduled) {
            exhausted = true
            return { id: att.id, scheduled_day: null, estimated_arrival_time: null, unscheduled: true, manually_placed: false, reason: UNSCHEDULED_REASON }
        }

        day = placement.day
        clock = placement.time + parseDuration(att.estimated_duration) + TRAVEL_MINS
        return { id: att.id, scheduled_day: placement.day, estimated_arrival_time: minutesToTime(placement.time), unscheduled: false, manually_placed: false, reason: null }
    })
}

/**
 * מריץ autoScheduleTimeline ושומר את התוצאה ב-Supabase ב-batch אחד (Promise.all).
 * לא כותב לאטרקציות manually_placed (הן כבר שמורות נכון) ולא לאטרקציות unscheduled.
 * מחזיר את מערך האטרקציות לאחר מיזוג השדות המחושבים (לשימוש מיידי ב-state המקומי).
 */
export async function persistSchedule(attractions, dayCount) {
    const plan = autoScheduleTimeline(attractions, dayCount)
    const planById = new Map(plan.map(p => [p.id, p]))

    const merged = attractions.map(a => {
        const p = planById.get(a.id)
        if (!p) return a
        return p.unscheduled
            ? { ...a, unscheduled: true, unscheduled_reason: p.reason }
            : { ...a, scheduled_day: p.scheduled_day, estimated_arrival_time: p.estimated_arrival_time, unscheduled: false, unscheduled_reason: null }
    })

    const toWrite = merged.filter(a => {
        const p = planById.get(a.id)
        return p && !p.unscheduled && !p.manually_placed
    })

    await Promise.all(
        toWrite.map(a => supabase.from('attractions').update({
            scheduled_day: a.scheduled_day,
            estimated_arrival_time: a.estimated_arrival_time,
        }).eq('id', a.id))
    )

    return merged
}
