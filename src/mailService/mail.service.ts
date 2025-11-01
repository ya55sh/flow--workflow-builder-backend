import nodemailer from 'nodemailer';
import { Injectable } from '@nestjs/common';
import { Transporter } from 'nodemailer';

// Create a test account or replace with real credentials.
@Injectable()
export class MailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      secure: false,
      auth: {
        user: `${process.env.GMAIL_USER}@gmail.com`,
        pass: `${process.env.GMAIL_APP_PASSWORD}`,
      },
    });
    try {
      this.transporter.verify();
      console.log('Email connection verified');
    } catch (error) {
      console.error('Error verifying email connection:', error);
      throw new Error('Failed to verify email connection');
    }
  }
  async sendEmail(to: string, subject: string, text: string) {
    console.log('email sent');
    try {
      const mailOptions = {
        from: `${process.env.GMAIL_USER}@gmail.com`,
        to,
        subject,
        text,
      };
      await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully');
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }
}
