-- ═══════════════════════════════════════════════════════════════
-- TripFlow — מיגרציה לניהול תקציב (trip_expenses + local_currency)
-- הריצי ב-Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS trip_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  attraction_id uuid REFERENCES attractions(id) ON DELETE SET NULL,
  category text,                    -- 'food' | 'transport' | 'shopping' | 'accommodation' | 'tickets' | 'other'
  description text,
  amount_local numeric NOT NULL,
  currency_local text NOT NULL,
  amount_converted numeric,
  currency_converted text DEFAULT 'ILS',
  exchange_rate numeric,
  expense_date date DEFAULT CURRENT_DATE,
  created_at timestamp DEFAULT now()
);

ALTER TABLE trip_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own trip expenses" ON trip_expenses;
CREATE POLICY "Users manage own trip expenses" ON trip_expenses
  FOR ALL
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

ALTER TABLE trips ADD COLUMN IF NOT EXISTS local_currency text;

NOTIFY pgrst, 'reload schema';
