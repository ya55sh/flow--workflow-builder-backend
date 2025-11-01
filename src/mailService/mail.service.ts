import { Injectable } from '@nestjs/common';

import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
// Create a test account or replace with real credentials.
@Injectable()
export class MailService {
  async sendEmail(to: string, subject: string, text: string) {
    try {
      await resend.emails.send({
        from: `${process.env.SEND_EMAIL_USER}`,
        to: `${to}`,
        subject: `${subject}`,
        html: `${text}`,
      });
      console.log('Email sent successfully', to);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }
}
