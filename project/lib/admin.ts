// Admin allowlist — these Google accounts get access to the /admin panel
// (SHG Ranking). Extend at runtime with NEXT_PUBLIC_ADMIN_EMAILS="a@b.com,c@d.com".

const DEFAULT_ADMIN_EMAILS = ['prakranj@gmail.com', 'prakranj@1carehealth.co', 'gloryjain9@gmail.com'];

const envEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const ADMIN_EMAILS = new Set<string>([...DEFAULT_ADMIN_EMAILS, ...envEmails]);

export function isAdminEmail(email?: string | null): boolean {
  return Boolean(email) && ADMIN_EMAILS.has(String(email).trim().toLowerCase());
}
