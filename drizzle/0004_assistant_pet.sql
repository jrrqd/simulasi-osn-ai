ALTER TABLE "user" ADD COLUMN IF NOT EXISTS assistant_pet text NOT NULL DEFAULT 'cat';
ALTER TABLE "user" ALTER COLUMN assistant_pet SET DEFAULT 'cat';
