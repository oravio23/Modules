-- platform.modules seeded m5 as 'planned' in 0001_platform_core.sql, matching oravio.co's
-- marketing page at the time — which was accurate before this repo had a real implementation.
-- apps/m5-documents is now a working, deployed module, so the hub should treat it as such:
-- HubPage's isOpenable check excludes any module with status = 'planned' from being a link,
-- regardless of grant.
update platform.modules set status = 'live' where id = 'm5';
