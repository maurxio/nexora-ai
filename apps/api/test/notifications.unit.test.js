import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { createNotifier } from '../src/modules/notifications/notifier.js';
afterEach(() => mock.restoreAll());
test('notification fallback logs messages when SMTP is absent', async () => {
  const log = mock.method(console, 'log', () => {});
  await createNotifier({}).send({
    to: 'fixture@test.local',
    subject: 'Test',
    text: 'Mock message',
  });
  assert.equal(log.mock.callCount(), 1);
});
test('SMTP notifier uses configured sender, authentication and TLS on port 465', async () => {
  let transportOptions, delivered;
  mock.method(nodemailer, 'createTransport', (options) => {
    transportOptions = options;
    return {
      sendMail: async (message) => {
        delivered = message;
        return { messageId: 'mock' };
      },
    };
  });
  const notifier = createNotifier({
    SMTP_HOST: 'smtp.test.local',
    SMTP_PORT: '465',
    SMTP_USER: 'fixture',
    SMTP_PASS: 'fixture',
    MAIL_FROM: 'noreply@test.local',
  });
  assert.deepEqual(
    await notifier.send({ to: 'fixture@test.local', subject: 'Test', text: 'Mock message' }),
    { messageId: 'mock' },
  );
  assert.equal(transportOptions.secure, true);
  assert.equal(transportOptions.auth.user, 'fixture');
  assert.equal(delivered.from, 'noreply@test.local');
});
