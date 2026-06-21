-- ═══════════════════════════════════════════════════════════════
-- TripFlow — מיגרציה ל-3 תכונות חדשות (Timeline / Packing / Status)
-- הריצי את כל הבלוק הזה ב-Supabase SQL Editor בבת אחת
-- ═══════════════════════════════════════════════════════════════

-- ── תכונה 1: Timeline View — יום בטיול לכל אטרקציה ──
ALTER TABLE attractions ADD COLUMN IF NOT EXISTS day_index integer DEFAULT 0;

-- ── תכונה 2: Smart Packing List ──
ALTER TABLE trips ADD COLUMN IF NOT EXISTS trip_type text;

CREATE TABLE IF NOT EXISTS packing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  category text,
  is_packed boolean DEFAULT false,
  is_custom boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

ALTER TABLE packing_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own trip packing items" ON packing_items;
CREATE POLICY "Users manage own trip packing items" ON packing_items
  FOR ALL
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

-- ── תכונה 3: סטטוס משימות דינמי ──
ALTER TABLE attractions ADD COLUMN IF NOT EXISTS status text DEFAULT 'planned';

-- ── רענון מיידי של schema cache כדי שהשינויים יוכרו בלי המתנה ──
NOTIFY pgrst, 'reload schema';
