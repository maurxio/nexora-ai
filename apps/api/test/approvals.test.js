import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import prisma from '../src/infrastructure/prisma.js';
import { approvalQueue, emailQueue, workflowQueue, workflowResumeQueue, webhookInboundQueue, webhookOutboundQueue } from '../src/infrastructure/queue.js';
import { createApproval, decideApproval, getApproval } from '../src/modules/approvals/service.js';
import { expireApprovals } from '../src/jobs/processors.js';

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
let company;
let otherCompany;
let requester;
let assignee;
let outsider;

before(async () => {
  requester = await prisma.user.create({ data: { email: `requester-${suffix}@test.local`, name: 'Requester', passwordHash: 'test' } });
  assignee = await prisma.user.create({ data: { email: `assignee-${suffix}@test.local`, name: 'Assignee', passwordHash: 'test' } });
  outsider = await prisma.user.create({ data: { email: `outsider-${suffix}@test.local`, name: 'Outsider', passwordHash: 'test' } });
  company = await prisma.organization.create({
    data: { name: `Approval ${suffix}`, slug: `approval-${suffix}`, memberships: { create: [{ userId: requester.id, role: 'ADMIN' }, { userId: assignee.id, role: 'OPERATOR' }] } },
  });
  otherCompany = await prisma.organization.create({
    data: { name: `Other ${suffix}`, slug: `other-${suffix}`, memberships: { create: { userId: outsider.id, role: 'ADMIN' } } },
  });
});

after(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [company.id, otherCompany.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [requester.id, assignee.id, outsider.id] } } });
  await Promise.all([approvalQueue.close(), emailQueue.close(), workflowQueue.close(), workflowResumeQueue.close(), webhookInboundQueue.close(), webhookOutboundQueue.close()]);
  await prisma.$disconnect();
});

test('creates an approval and notifications for each assignee', async () => {
  const approval = await createApproval(company.id, requester.id, {
    title: 'Review contract',
    payload: { contractId: 'c-1' },
    assigneeIds: [assignee.id],
  });
  assert.equal(approval.status, 'PENDING');
  assert.equal(await prisma.notification.count({ where: { approvalId: approval.id, type: 'APPROVAL_REQUESTED' } }), 1);
});

test('allows an assignee to approve once and rejects non-assignees', async () => {
  const approval = await createApproval(company.id, requester.id, { title: 'Approve invoice', payload: {}, assigneeIds: [assignee.id] });
  await assert.rejects(() => decideApproval(company.id, outsider.id, approval.id, 'APPROVED'), (error) => error.status === 403);
  const decided = await decideApproval(company.id, assignee.id, approval.id, 'APPROVED', 'Looks good');
  assert.equal(decided.status, 'APPROVED');
  await assert.rejects(() => decideApproval(company.id, assignee.id, approval.id, 'REJECTED'), (error) => error.status === 409);
});

test('isolates approvals by company and supports rejection', async () => {
  const approval = await createApproval(company.id, requester.id, { title: 'Rejectable', payload: {}, assigneeIds: [assignee.id] });
  await assert.rejects(() => getApproval(otherCompany.id, approval.id), (error) => error.status === 404);
  const rejected = await decideApproval(company.id, assignee.id, approval.id, 'REJECTED');
  assert.equal(rejected.status, 'REJECTED');
});

test('expires pending approvals', async () => {
  const approval = await prisma.approval.create({
    data: {
      companyId: company.id, requestedById: requester.id, title: 'Expired', payload: {},
      expiresAt: new Date(Date.now() - 1000), assignees: { create: { userId: assignee.id } },
    },
  });
  await expireApprovals();
  const expired = await prisma.approval.findUnique({ where: { id: approval.id } });
  assert.equal(expired.status, 'EXPIRED');
});
