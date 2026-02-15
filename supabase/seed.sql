-- =============================================
-- Seed fake groups and games for development/testing
-- =============================================
-- 1. Get your user UUID: Supabase Dashboard → Authentication → Users → copy your user id,
--    or in SQL Editor run: SELECT auth.uid(); (while logged in via your app).
-- 2. Replace the UUID below with your user id, then run this file in SQL Editor,
--    or run: supabase db reset (after editing this file with your id).
-- =============================================

SELECT seed_dev_data('00000000-0000-0000-0000-000000000000'::uuid);
-- ↑ Replace 00000000-0000-0000-0000-000000000000 with your auth user UUID
