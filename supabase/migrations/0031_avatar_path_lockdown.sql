-- #59 (security review): avatar_url was client-writable (#39 grant), and the app signs that
-- path with the service role — a user could point it at another org's file and get a signed
-- URL for it. Only the server (PATCH /api/account, service role) may set avatar_url now.
revoke update (avatar_url) on public.profiles from authenticated;
