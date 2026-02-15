-- =============================================
-- Clear entire database and all auth data
-- Run this only when you want to start from
-- ground zero (e.g. before a fresh deploy).
-- =============================================
-- Execute in Supabase SQL Editor or:
--   psql $DATABASE_URL -f supabase/scripts/clear-database.sql
--
-- Note: If you use Storage with user-owned objects, clear or
-- delete those objects first; deleting users who own objects can fail.
-- =============================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. Public schema: delete in dependency order (children first)
-- -------------------------------------------------------------------------

TRUNCATE guesses CASCADE;
TRUNCATE user_featured_tags CASCADE;
TRUNCATE game_players CASCADE;
TRUNCATE email_invites CASCADE;
TRUNCATE group_members CASCADE;
TRUNCATE games CASCADE;
TRUNCATE saved_groups CASCADE;
TRUNCATE daily_axes CASCADE;
TRUNCATE device_daily_usage CASCADE;

-- players references auth.users; truncate would fail, so delete instead
DELETE FROM players;

-- -------------------------------------------------------------------------
-- 2. Auth schema: clear sessions, refresh tokens, identities, then users
-- -------------------------------------------------------------------------

DELETE FROM auth.sessions;
DELETE FROM auth.refresh_tokens;
DELETE FROM auth.identities;
DELETE FROM auth.users;

COMMIT;
