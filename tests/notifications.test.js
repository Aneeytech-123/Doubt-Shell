const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('Notifications', () => {
  let ctx, author, helper, prof, doubtId;

  beforeEach(async () => {
    ctx = h.makeApp({ mailer: h.fakeMailer() });
    author = await h.registerStudent(ctx.app, { fullName: 'Author Student' });
    helper = await h.registerStudent(ctx.app, { fullName: 'Helper Student' });
    prof = await h.loginProfessor(ctx.app, ctx.db, 'Prof Shah');
    for (const a of [author, helper, prof]) await h.join(a, 'WT');
    doubtId = (await h.postDoubt(author, 'WT', { title: 'What is middleware in Express?' })).body.doubt.id;
  });

  test('the author is notified when a student answers', async () => {
    await h.send(helper, 'post', `/api/doubts/${doubtId}/answers`, { body: 'A function that runs between request and response.' });
    const { body } = await author.get('/api/notifications');
    assert.equal(body.notifications.length, 1);
    assert.equal(body.notifications[0].type, 'answer');
    assert.match(body.notifications[0].message, /Helper Student answered/);
    assert.equal(body.notifications[0].link, `/subjects/WT?doubt=${doubtId}`);
    assert.equal((await author.get('/api/notifications/unread-count')).body.unread, 1);
  });

  test('a professor response creates a professor_answer notification', async () => {
    await h.send(prof, 'post', `/api/doubts/${doubtId}/answers`, { body: 'Think of it as a pipeline.' });
    const { body } = await author.get('/api/notifications');
    assert.equal(body.notifications[0].type, 'professor_answer');
    assert.match(body.notifications[0].message, /Professor Prof Shah responded/);
  });

  test('answering your own doubt does not notify you', async () => {
    await h.send(author, 'post', `/api/doubts/${doubtId}/answers`, { body: 'Update: I found part of it.' });
    assert.equal((await author.get('/api/notifications')).body.notifications.length, 0);
  });

  test('notifications are stored in the database and emailed when SMTP is configured', async () => {
    await h.send(helper, 'post', `/api/doubts/${doubtId}/answers`, { body: 'Middleware calls next().' });
    const rows = ctx.db.prepare('SELECT * FROM notifications WHERE user_id = ?').all(author.user.id);
    assert.equal(rows.length, 1);
    assert.equal(ctx.mailer.sent.length, 1);
    assert.equal(ctx.mailer.sent[0].to, author.user.email);
  });

  test('mark as read works only for your own notifications', async () => {
    await h.send(helper, 'post', `/api/doubts/${doubtId}/answers`, { body: 'Answer text here.' });
    const id = (await author.get('/api/notifications')).body.notifications[0].id;

    assert.equal((await h.send(helper, 'patch', `/api/notifications/${id}/read`)).status, 404);
    assert.equal((await h.send(author, 'patch', `/api/notifications/${id}/read`)).status, 200);
    assert.equal((await author.get('/api/notifications/unread-count')).body.unread, 0);

    await h.send(prof, 'post', `/api/doubts/${doubtId}/answers`, { body: 'Another answer.' });
    assert.equal((await author.get('/api/notifications/unread-count')).body.unread, 1);
    await h.send(author, 'post', '/api/notifications/read-all');
    assert.equal((await author.get('/api/notifications/unread-count')).body.unread, 0);
  });

  test('a professor resolving the doubt notifies the author', async () => {
    await h.send(prof, 'patch', `/api/doubts/${doubtId}/resolve`, { resolved: true });
    const types = (await author.get('/api/notifications')).body.notifications.map((n) => n.type);
    assert.deepEqual(types, ['resolved']);
  });
});

describe('Without SMTP credentials', () => {
  test('in-app notifications still work', async () => {
    const ctx = h.makeApp(); // mailer disabled
    const author = await h.registerStudent(ctx.app);
    const helper = await h.registerStudent(ctx.app);
    await h.join(author, 'CN');
    await h.join(helper, 'CN');
    const id = (await h.postDoubt(author, 'CN')).body.doubt.id;
    const res = await h.send(helper, 'post', `/api/doubts/${id}/answers`, { body: 'Here is the answer.' });
    assert.equal(res.status, 201);
    assert.equal((await author.get('/api/notifications/unread-count')).body.unread, 1);
  });
});
