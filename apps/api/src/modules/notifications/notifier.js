import nodemailer from 'nodemailer';

export function createNotifier(env = process.env) {
  const smtpConfigured = env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM;
  if (!smtpConfigured) {
    return {
      async send(message) {
        console.log('[notification:console]', message);
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: Number(env.SMTP_PORT) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return {
    send(message) {
      return transport.sendMail({ from: env.MAIL_FROM, ...message });
    },
  };
}

export const notifier = createNotifier();
