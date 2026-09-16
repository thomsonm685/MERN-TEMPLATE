import { env } from '../config/env.js';

export interface EmailMessage {
  subject: string;
  text: string;
  html: string;
}

export interface EmailContent {
  subject: string;
  /** Large text at the top of the body. Defaults to the subject. */
  heading?: string;
  /** Preview line shown by most clients next to the subject. */
  preheader?: string;
  /** Body paragraphs, in order. */
  paragraphs: string[];
  /** Optional call to action. The URL is also written out in the text version. */
  button?: { label: string; url: string };
  /** Small print under the divider. */
  footnote?: string;
}

/**
 * Escapes text for HTML. Applied to the subject too — it is interpolated into `<title>`,
 * and a user-supplied name containing `<` would otherwise break the document.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds the text and HTML versions from one description, so the two can never drift apart —
 * the usual failure mode when each message is written twice.
 *
 * All CSS is inline: many clients (Gmail's web client among them) discard `<style>` blocks.
 */
export function renderEmail(content: EmailContent): EmailMessage {
  const appName = env.APP_NAME;
  const heading = content.heading ?? content.subject;

  const textParts = [heading, '', ...content.paragraphs];
  if (content.button) textParts.push('', `${content.button.label}: ${content.button.url}`);
  if (content.footnote) textParts.push('', content.footnote);
  textParts.push('', `— ${appName}`);
  const text = textParts.join('\n');

  const paragraphsHtml = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46">${escapeHtml(p)}</p>`,
    )
    .join('');

  const buttonHtml = content.button
    ? `<p style="margin:28px 0"><a href="${escapeHtml(content.button.url)}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#fafafa;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600">${escapeHtml(content.button.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a">If the button does not work, copy this link into your browser:<br><span style="color:#3f3f46;word-break:break-all">${escapeHtml(content.button.url)}</span></p>`
    : '';

  const footnoteHtml = content.footnote
    ? `<hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0">
       <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a">${escapeHtml(content.footnote)}</p>`
    : '';

  const preheaderHtml = content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(content.preheader)}</div>`
    : '';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(content.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
    ${preheaderHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;border:1px solid #e4e4e7">
            <tr>
              <td style="padding:32px">
                <p style="margin:0 0 24px;font-size:14px;font-weight:600;letter-spacing:0.02em;color:#18181b">${escapeHtml(appName)}</p>
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#18181b">${escapeHtml(heading)}</h1>
                ${paragraphsHtml}
                ${buttonHtml}
                ${footnoteHtml}
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa">© ${new Date().getFullYear()} ${escapeHtml(appName)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: content.subject, text, html };
}
