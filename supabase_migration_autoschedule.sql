-- ═══════════════════════════════════════════════════════════════
-- TripFlow — מיגרציה לתזמון אוטומטי של Timeline
-- הריצי ב-Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE attractions ADD COLUMN IF NOT EXISTS scheduled_day integer DEFAULT 1;
ALTER TABLE attractions ADD COLUMN IF NOT EXISTS manually_placed boolean DEFAULT false;

NOTIFY pgrst, 'reload schema';
