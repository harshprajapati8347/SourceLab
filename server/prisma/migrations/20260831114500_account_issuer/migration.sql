-- Better Auth 1.7 keys accounts on (issuer, accountId). Add issuer as
-- nullable, backfill existing rows, then enforce NOT NULL + uniqueness.

-- AlterTable
ALTER TABLE "account" ADD COLUMN "issuer" TEXT;

-- Google OIDC
UPDATE "account"
SET "issuer" = 'https://accounts.google.com'
WHERE "providerId" = 'google';

-- Email/password credential accounts
UPDATE "account"
SET
    "issuer" = 'local:credential',
    "accountId" = "userId"
WHERE "providerId" = 'credential';

-- Any remaining OAuth-style providers without a known issuer
UPDATE "account"
SET "issuer" = 'local:oauth:' || "providerId"
WHERE "issuer" IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "account"
        GROUP BY "issuer", "accountId"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot add unique (issuer, accountId): duplicate account identities exist';
    END IF;
END $$;

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");
