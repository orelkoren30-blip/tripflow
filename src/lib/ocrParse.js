// פרסור פשוט של טקסט שחולץ ב-OCR מאישורי טיסה/מלון — לא מדויק ב-100%,
// משמש כברירת מחדל מוצעת בטופס (המשתמש מאשר/מתקן לפני שמירה).
export function parseFlightOrHotelText(text) {
    if (!text) return {}
    const result = {}

    // מספר טיסה: 2 אותיות + 2-4 ספרות, לדוגמה "LY 001", "BA277"
    const flightMatch = text.match(/\b([A-Z]{2})\s?(\d{2,4})\b/)
    if (flightMatch) result.flightNumber = `${flightMatch[1]}${flightMatch[2]}`

    // תאריך: DD/MM/YYYY או DD.MM.YYYY (גם שנה דו-ספרתית)
    const dateMatch = text.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/)
    if (dateMatch) result.date = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`

    // שם מלון: טקסט אחרי "Hotel" או "מלון"
    const hotelMatch = text.match(/(?:Hotel|מלון)\s*[:-]?\s*([^\n\r]{2,40})/i)
    if (hotelMatch) result.hotelName = hotelMatch[1].trim()

    // מספר הזמנה/אישור: אחרי Booking/Confirmation/אישור הזמנה
    const bookingMatch = text.match(/(?:Booking|Confirmation|אישור\s*הזמנה)\s*(?:number|no\.?|#)?\s*[:-]?\s*([A-Za-z0-9]{4,15})/i)
    if (bookingMatch) result.bookingNumber = bookingMatch[1].trim()

    return result
}
