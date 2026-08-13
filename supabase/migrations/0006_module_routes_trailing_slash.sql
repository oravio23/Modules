-- Module routes were seeded without a trailing slash ('/m5'), which is what the hub's
-- <a href> uses verbatim. Each module app is a separate Vite build with base: '/m<N>/'
-- (trailing slash) — landing on the bare path without it is still handled by this app's
-- own router, but any code that resolves a root-absolute URL (e.g. pdfjs-setup.ts before
-- this fix) does so against the origin, not the app's base, regardless of this trailing
-- slash. Fixing it anyway so the hub always links to each module's actual mount point.
update platform.modules set route = route || '/' where route not like '%/';
