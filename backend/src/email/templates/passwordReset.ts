import { env } from '../../config/env.js';
import { renderEmail, type EmailMessage } from '../render.js';

export interface PasswordResetData {
  firstName: string;
  /** Complete reset URL. Better Auth supplies one; the legacy JWT flow builds it from a token. */
  url: string;
  /** How long the link stays valid, in human terms. */
  expiresIn?: string;
}

export function passwordResetEmail(data: PasswordResetData): EmailMessage {
  return renderEmail({
    subject: `Reset your ${env.APP_NAME} password`,
    heading: 'Reset your password',
    preheader: 'Use the link inside to choose a new password.',
    paragraphs: [
      `Hi ${data.firstName},`,
      `We received a request to reset your password. Choose a new one using the link below.`,
    ],
    button: { label: 'Reset password', url: data.url },
    footnote: `This link expires in ${data.expiresIn ?? '1 hour'}. If you did not request a reset, you can safely ignore this email — your password will not change.`,
  });
}
