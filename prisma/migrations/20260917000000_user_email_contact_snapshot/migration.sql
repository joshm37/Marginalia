-- Supabase is the authentication authority. An email can be reused after an
-- auth account is deleted/recreated or changed. Never merge application users
-- by email: their IDs and all owned research must remain separate.
-- This removes only the uniqueness index; no rows or relationships change.
DROP INDEX "public"."User_email_key";
