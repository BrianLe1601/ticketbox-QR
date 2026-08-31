USE ticketboxqr;

ALTER TABLE events
  ADD COLUMN cover_image_public_id VARCHAR(255) NULL AFTER cover_image_url,
  ADD COLUMN cover_image_alt VARCHAR(255) NULL AFTER cover_image_public_id;
