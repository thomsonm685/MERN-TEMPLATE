import { env } from '../../config/env.js';
import { renderEmail, type EmailMessage } from '../render.js';

export interface EmailVerificationData {
  firstName: string;
  /** Complete verification URL. */
  url: string;
}

export function emailVerificationEmail(data: EmailVerificationData): EmailMessage {
  return renderEmail({
    subject: `Confirm your email address`,
    heading: 'Confirm your email',
    preheader: `One click to finish setting up your ${env.APP_NAME} account.`,
    paragraphs: [
      `Hi ${data.firstName},`,
      `Confirm this email address to finish setting up your account.`,
    ],
    button: { label: 'Confirm email', url: data.url },
    footnote: 'If you did not create an account, you can ignore this email.',
  });
}
