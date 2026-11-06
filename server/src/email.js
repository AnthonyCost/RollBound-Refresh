// Sends email through Resend's HTTP API (setup: docs/password-reset-email-setup.md).
// Needs RESEND_API_KEY and EMAIL_FROM in server/.env. Without a key (local development),
// the email is printed to the server log instead, so the reset link can still be used.

const API = 'https://api.resend.com/emails';

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/** Sends { to, subject, text, html }. Throws if Resend refuses it. */
export async function sendEmail({ to, subject, text, html }) {
  if (!emailConfigured()) {
    console.log(`[email not configured] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`Resend refused the email (${res.status}): ${await res.text()}`);
}
