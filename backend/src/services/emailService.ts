import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface OutgoingEmail {
  /** Defaults to the configured vendor notification address. */
  to?: string;
  subject: string;
  body: string;
}

export interface EmailResult {
  to: string;
  subject: string;
  body: string;
  delivered: boolean;
  mode: 'SMTP' | 'SIMULATED';
  error: string | null;
}

/**
 * Vendor-facing notifications (missing-detail requests, decline notices).
 * With SMTP credentials configured it delivers real mail; without them it
 * records the message and reports mode SIMULATED, so the demo runs on a
 * laptop with no email account, the same way the AWS adapters degrade.
 */
export class EmailService {
  private readonly transporter: Transporter | null;

  constructor() {
    this.transporter = config.features.email
      ? nodemailer.createTransport({
          host: config.email.host,
          port: config.email.port,
          secure: config.email.port === 465,
          auth: { user: config.email.user!, pass: config.email.pass! },
        })
      : null;
  }

  /** Never throws: a failed email must not lose the review action behind it. */
  async send(email: OutgoingEmail): Promise<EmailResult> {
    const to = email.to ?? config.email.vendorEmail;
    const base = { to, subject: email.subject, body: email.body };

    if (!this.transporter) {
      logger.info('Email simulated (SMTP not configured)', { to, subject: email.subject });
      return { ...base, delivered: false, mode: 'SIMULATED', error: null };
    }

    try {
      await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject: email.subject,
        text: email.body,
      });
      logger.info('Email sent', { to, subject: email.subject });
      return { ...base, delivered: true, mode: 'SMTP', error: null };
    } catch (error) {
      logger.error('Email send failed', { to, error: (error as Error).message });
      return { ...base, delivered: false, mode: 'SMTP', error: (error as Error).message };
    }
  }
}
