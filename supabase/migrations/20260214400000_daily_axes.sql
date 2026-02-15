-- Daily AI-generated axis suggestions (one row per calendar day)
CREATE TABLE daily_axes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date        date        UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  axis_x_label_low  text  NOT NULL,
  axis_x_label_high text  NOT NULL,
  axis_y_label_low  text  NOT NULL,
  axis_y_label_high text  NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- RLS: anyone authenticated can read, inserts handled via service-role
ALTER TABLE daily_axes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read daily axes"
  ON daily_axes FOR SELECT
  TO authenticated
  USING (true);
