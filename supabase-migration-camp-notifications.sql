-- Track which camps have already had SMS notifications sent
-- camp_id is "camp name|start date" to uniquely identify a camp
CREATE TABLE IF NOT EXISTS camp_notifications (
  camp_id TEXT PRIMARY KEY,
  camp_name TEXT NOT NULL,
  notified_at TIMESTAMPTZ DEFAULT NOW(),
  texts_sent INTEGER DEFAULT 0
);
