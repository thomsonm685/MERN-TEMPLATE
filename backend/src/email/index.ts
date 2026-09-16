/**
 * Email subsystem.
 *
 *   emailTriggers.userRegistered(user)   ← fire an app event (never throws)
 *   sendEmail(message, { to })           ← send a one-off message
 *   renderEmail({ subject, paragraphs }) ← build text + HTML from one description
 *
 * With no RESEND_API_KEY every message is logged instead of sent.
 */
export { emailTriggers, type EmailTrigger } from './triggers.js';
export {
  sendEmail,
  isRetryableStatus,
  describeError,
  idempotencyKeyFor,
  MAX_RECIPIENTS,
  type SendOptions,
  type SendResult,
} from './client.js';
export { renderEmail, escapeHtml, type EmailMessage, type EmailContent } from './render.js';
export * from './templates/index.js';
