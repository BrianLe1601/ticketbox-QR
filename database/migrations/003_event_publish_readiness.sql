-- Event capacity and scheduled-publish diagnostics.
USE ticketboxqr;

ALTER TABLE events
  ADD COLUMN venue_capacity INT UNSIGNED NULL AFTER city,
  ADD COLUMN last_publish_attempt_at DATETIME(3) NULL AFTER completed_at,
  ADD COLUMN publish_failure_reason VARCHAR(500) NULL AFTER last_publish_attempt_at,
  ADD CONSTRAINT chk_events_venue_capacity CHECK (
    venue_capacity IS NULL OR venue_capacity > 0
  );

CREATE INDEX idx_events_publish_retry
  ON events(status, scheduled_publish_at, last_publish_attempt_at);
