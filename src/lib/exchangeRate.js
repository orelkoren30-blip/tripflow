// שערי חליפין חיים דרך frankfurter.app (חינמי, בלי מפתח, מבוסס נתוני ECB)
// עם cache ב-localStorage לשעה אחת כדי לא לפנות ל-API על כל הוצאה

const CACHE_PREFIX = 'tripflow_fx_'
const CACHE_TTL_MS = 60 * 60 * 1000 // שעה אחת

function readCache(key) {
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return null
        const { rate, ts } = JSON.parse(raw)
        if (Date.now() - ts > CACHE_TTL_MS) return null
        return rate
    } catch {
        return null
    }
}

function writeCache(key, rate) {
    try {
        localStorage.setItem(key, JSON.stringify({ rate, ts: Date.now() }))
    } catch {
        // localStorage לא זמין (מצב פרטי וכו') — לא קריטי, פשוט לא נשמר cache
    }
}

export async function getExchangeRate(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return 1

    const cacheKey = `${CACHE_PREFIX}${fromCurrency}_${toCurrency}`
    const cached = readCache(cacheKey)
    if (cached != null) return cached

    let res
    try {
        res = await fetch(`https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`)
    } catch {
        throw new Error('לא הצלחנו לקבל שער עדכני, נסי שוב')
    }
    if (!res.ok) throw new Error('לא הצלחנו לקבל שער עדכני, נסי שוב')

    const data = await res.json().catch(() => null)
    const rate = data?.rates?.[toCurrency]
    if (typeof rate !== 'number') throw new Error('לא הצלחנו לקבל שער עדכני, נסי שוב')

    writeCache(cacheKey, rate)
    return rate
}
