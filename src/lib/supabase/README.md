# Supabase integration

The current dashboard uses the temporary local authentication adapter so the UI
can run immediately.

When Supabase is connected, replace the local adapter with:

- `client.ts` for browser-side Supabase;
- `server.ts` for server-side session checks;
- middleware/proxy protection for `/dashboard`;
- Supabase Auth for login/register/logout;
- RLS for all user-owned tables.

Suggested environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Suggested first tables:

- `profiles`
- `representative_follows`
- `notifications`
- `notification_preferences`

Never commit real keys or service-role credentials.
