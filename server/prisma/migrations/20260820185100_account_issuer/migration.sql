-- Better Auth 1.7 scopes account identity by (issuer, accountId).
-- Add the column nullable, backfill, then require it and unique-index it.

ALTER TABLE "account" ADD COLUMN "issuer" TEXT;

UPDATE "account"
SET "issuer" = 'https://accounts.google.com'
WHERE "providerId" = 'google' AND "issuer" IS NULL;

UPDATE "account"
SET "issuer" = 'local:oauth:' || "providerId"
WHERE "issuer" IS NULL;

ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;

CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");
