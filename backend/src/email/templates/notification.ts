import { renderEmail, type EmailMessage } from '../render.js';

export interface NotificationData {
  subject: string;
  heading?: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  footnote?: string;
}

/** Generic one-off notice — reach for a dedicated template once a message repeats. */
export function notificationEmail(data: NotificationData): EmailMessage {
  return renderEmail(data);
}
