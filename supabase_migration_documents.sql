-- ═══════════════════════════════════════════════════════════════
-- TripFlow — מיגרציה למרכז המסמכים (trip_documents + Storage)
-- הריצי ב-Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── טבלה ──
CREATE TABLE IF NOT EXISTS trip_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  category text NOT NULL,           -- 'flight' | 'hotel' | 'attraction' | 'insurance' | 'other'
  title text NOT NULL,
  file_url text,                    -- נתיב בתוך bucket "trip-documents" (לא URL ציבורי — ה-bucket פרטי)
  booking_number text,
  notes text,
  extracted_data jsonb,             -- { raw_text, parsed: { flightNumber, date, hotelName, bookingNumber } }
  created_at timestamp DEFAULT now()
);

ALTER TABLE trip_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own trip documents" ON trip_documents;
CREATE POLICY "Users manage own trip documents" ON trip_documents
  FOR ALL
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

-- ── Storage bucket (פרטי — גישה רק דרך signed URLs) ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-documents', 'trip-documents', false)
ON CONFLICT (id) DO NOTHING;

-- מבנה נתיב קבצים: <user_id>/<trip_id>/<category>/<filename>
-- כל פוליסה בודקת שהתיקייה הראשונה בנתיב = ה-uid של המשתמש המחובר

DROP POLICY IF EXISTS "Users upload own trip documents" ON storage.objects;
CREATE POLICY "Users upload own trip documents" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'trip-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users view own trip documents" ON storage.objects;
CREATE POLICY "Users view own trip documents" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'trip-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own trip documents" ON storage.objects;
CREATE POLICY "Users delete own trip documents" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'trip-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

NOTIFY pgrst, 'reload schema';
