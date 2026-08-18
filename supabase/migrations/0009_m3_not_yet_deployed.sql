-- m3 was seeded 'live' in 0001_platform_core.sql, matching oravio.co's marketing copy at the
-- time. But there is no apps/m3-visibility in this repo and no entry for it in
-- apps/shell/vercel.json's rewrites — unlike m5 (0005_m5_module_live.sql), m3 has no
-- deployment for a granted user's hub tile to actually open. Left as 'live', the
-- 'importer' plan (which grants m1/m3/m6) would produce a clickable tile that 404s.
--
-- Revert to 'planned' until apps/m3-visibility exists and is wired into vercel.json; flip
-- it back with the same one-line pattern 0005 used for m5 once it's real.
update platform.modules set status = 'planned' where id = 'm3';
