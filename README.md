# Mentalks_System
sample mentalks project system

## Supabase setup

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
Run the SQL migrations in `supabase/migrations` in order in the Supabase SQL Editor.
The signup trigger in `002_create_profile_on_signup.sql` creates each profile when
the corresponding auth user is created, including when email confirmation is enabled.
Migration `003_fix_profiles_rls_recursion.sql` fixes recursive profile read policies.
Migration `006_allow_format_validated_student_ids.sql` removes the registrar-table
foreign key so signup relies on the `YYYY-number-AB` format and unique profile IDs
instead of a registrar CSV. It does not independently verify school enrollment.
If migrations 001–005 have already been applied, run only migration 006; do not
rerun 001, because its policies are not safe to create twice.

## Email confirmation

Email confirmation is sent by Supabase Auth. Add the app's `/login` URL (for local development, `http://localhost:3001/login`) to Authentication > URL Configuration > Redirect URLs. For reliable delivery beyond Supabase's limited test email service, configure a production SMTP provider in Authentication > SMTP Settings. Unconfirmed users can request another confirmation email from the login screen.

Deleting a row from `public.profiles` does not delete the corresponding account in Supabase Authentication > Users. To register the same email again, delete the auth user there as well. Removing an auth user does not reset Supabase email-delivery rate limits; those are controlled by the configured email provider and Auth settings. Run migration 007 as well so new counselor accounts receive the correct profile role.

Enable email confirmation in Supabase Authentication > Sign In / Providers > Email. For an existing installation with migrations 001–005 already applied, apply migrations 006 and 007 (do not rerun 001).

## MenTalks identity, consent, and referrals

After the earlier migrations are applied, run `009_community_member_role.sql`
as a separate SQL Editor execution and let it commit before running
`010_consent_identity_referrals.sql`. This separation is required when the
`profiles.role` column uses a PostgreSQL enum. Migration 010 adds student pen
names and avatars, removes student real-name and nickname fields, retains
restricted registration fields, and adds consent history, the editable
MenTalks schedule, and counselor-to-student referrals with row-level security.
It also normalizes ID columns in earlier text-based referral drafts to UUIDs
before creating policies that compare them with authenticated user IDs, and
explicitly casts `auth.uid()` to UUID in migration policy/function expressions.
The current public signup flow is for students; Guidance Counselor accounts
must be provisioned by an administrator. After migration 010 completes, run
`011_dark_theme_default.sql` to make dark mode the default for new and existing
accounts while preserving explicit light or dark selections.
