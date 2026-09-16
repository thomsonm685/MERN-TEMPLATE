/**
 * Email preflight.
 *
 *   npm run email:check                    # check the key and sending domain
 *   npm run email:check -- you@example.org # ...and send one real message
 *
 * Mail is deliberately quiet — a failed send is logged, never thrown, so the API stays up.
 * That means a broken key or unverified domain can sit undetected until someone needs a
 * password reset. This is the loud version: run it before launch, not after.
 */
import 'dotenv/config';

// This script checks email configuration only, but importing the app's env module validates
// the whole schema. Fill in throwaway values for the unrelated required vars so the check
// still runs on a machine where Mongo and JWT have not been configured yet. Real values from
// .env always win — `||=` fills only a blank or empty value.
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/email-check-placeholder';
process.env.JWT_SECRET ||= 'email-check-placeholder-secret-32-chars';

const { env, isEmailEnabled } = await import('../src/config/env.js');
const { sendEmail } = await import('../src/email/client.js');
const { notificationEmail } = await import('../src/email/templates/index.js');

const OK = '✔';
const BAD = '✖';
const INFO = '·';

function domainOf(from: string): string {
  const match = /<([^>]+)>/.exec(from);
  const address = match?.[1] ?? from;
  return address.split('@')[1] ?? '';
}

async function main(): Promise<void> {
  const recipient = process.argv.slice(2).find((arg) => arg.includes('@'));
  let failed = false;

  console.log(`\n${INFO} APP_NAME    ${env.APP_NAME}`);
  console.log(`${INFO} EMAIL_FROM  ${env.EMAIL_FROM}`);

  if (!env.RESEND_API_KEY) {
    console.log(`\n${BAD} RESEND_API_KEY is not set.`);
    console.log(
      `  Every send will be logged to the console instead. That is fine locally; set a key\n` +
        `  before deploying. Get one at https://resend.com/api-keys\n`,
    );
    process.exit(1);
  }
  console.log(`${OK} RESEND_API_KEY is set (${env.RESEND_API_KEY.slice(0, 6)}…)`);

  if (env.EMAIL_DRY_RUN) {
    console.log(`${INFO} EMAIL_DRY_RUN is on — sends are logged, not delivered.`);
  }

  // A send-only key cannot read /domains. That is correct scoping for a server, not a fault,
  // so treat restricted_api_key as a pass rather than reporting a healthy key as broken.
  const domain = domainOf(env.EMAIL_FROM);
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'user-agent': `${env.APP_NAME}/1.0`,
      },
      signal: AbortSignal.timeout(env.EMAIL_TIMEOUT_MS),
    });
    const body = await res.text();

    if (res.status === 401 && body.includes('restricted_api_key')) {
      console.log(`${OK} Key is send-only, so the domain list is not readable (expected).`);
    } else if (!res.ok) {
      console.log(`${BAD} Could not list domains: ${res.status} ${body.slice(0, 200)}`);
      failed = true;
    } else {
      const { data = [] } = JSON.parse(body) as {
        data?: { name: string; status: string }[];
      };
      const match = data.find((d) => d.name === domain);

      if (domain === 'resend.dev') {
        console.log(
          `${INFO} Using Resend's shared testing sender. It only delivers to the address on\n` +
            `  your own Resend account. Verify a domain before sending to real users.`,
        );
      } else if (!match) {
        console.log(`${BAD} Domain "${domain}" is not registered in Resend.`);
        console.log(`  Verified: ${data.map((d) => d.name).join(', ') || '(none)'}`);
        failed = true;
      } else if (match.status !== 'verified') {
        console.log(`${BAD} Domain "${domain}" is "${match.status}", not "verified".`);
        failed = true;
      } else {
        console.log(`${OK} Sending domain "${domain}" is verified.`);
      }
    }
  } catch (err) {
    console.log(`${BAD} Could not reach Resend: ${err instanceof Error ? err.message : err}`);
    failed = true;
  }

  if (recipient) {
    // Resend rejects example.com recipients with a 422, so a test send there always fails.
    if (/@example\.(com|net|org)$/i.test(recipient)) {
      console.log(
        `\n${BAD} Resend rejects ${recipient} — example.* addresses are not deliverable.`,
      );
      failed = true;
    } else {
      console.log(`\n${INFO} Sending a test message to ${recipient}...`);
      const result = await sendEmail(
        notificationEmail({
          subject: `${env.APP_NAME} email check`,
          heading: 'It works',
          paragraphs: [
            `This is a test message from your ${env.APP_NAME} backend.`,
            `If you are reading it, your Resend key, sending domain and templates are all wired up correctly.`,
          ],
        }),
        { to: recipient },
      );

      if (result.ok && result.delivered) console.log(`${OK} Sent. Resend id: ${result.id}`);
      else if (result.ok) console.log(`${INFO} Not delivered (${result.reason}).`);
      else {
        console.log(`${BAD} Send failed after ${result.attempts} attempt(s): ${result.error}`);
        failed = true;
      }
    }
  } else if (isEmailEnabled) {
    console.log(
      `\n${INFO} Pass an address to send a real test: npm run email:check -- you@you.com`,
    );
  }

  console.log('');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('Email check failed:', err);
  process.exit(1);
});
