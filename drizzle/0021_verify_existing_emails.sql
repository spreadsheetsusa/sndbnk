-- Existing accounts predate signup email verification. Mark them verified so
-- requireEmailVerification does not lock out current members on deploy.
UPDATE "user" SET email_verified = 1 WHERE email_verified = 0;
