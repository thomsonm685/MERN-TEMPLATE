import { env } from '../../config/env.js';
import { renderEmail, type EmailMessage } from '../render.js';

export interface WelcomeData {
  firstName: string;
}

export function welcomeEmail(data: WelcomeData): EmailMessage {
  return renderEmail({
    subject: `Welcome to ${env.APP_NAME}`,
    heading: `Welcome, ${data.firstName}`,
    preheader: `Your ${env.APP_NAME} account is ready.`,
    paragraphs: [
      `Your account is ready. Thanks for signing up.`,
      `If you have any questions, just reply to this email.`,
    ],
    button: { label: 'Open the app', url: env.FRONTEND_URL },
  });
}
