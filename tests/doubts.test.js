const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('Creating doubts', () => {
  let ctx;
  beforeEach(() => { ctx = h.makeApp(); });

  test('a student must join the room before asking', async () => {
    const agent = await h.registerStudent(ctx.app);
    const res = await h.postDoubt(agent, 'CN');
    assert.equal(res.status, 403);
  });

  test('a doubt is saved with the author details from the session', async () => {
    const agent = await h.registerStudent(ctx.app, { fullName: 'Riya Kulkarni', className: 'TE', division: 'B' });
    await h.join(agent, 'CN');
    const res = await h.postDoubt(agent, 'CN', { title: 'What is a subnet mask?' });
    assert.equal(res.status, 201);
    assert.equal(res.body.doubt.title, 'What is a subnet mask?');
    assert.equal(res.body.doubt.status, 'unanswered');
    assert.equal(res.body.doubt.replyCount, 0);
    assert.equal(res.body.doubt.subject.code, 'CN');
    assert.deepEqual(
      { name: res.body.doubt.author.fullName, cls: res.body.doubt.author.className, div: res.body.doubt.author.division },
      { name: 'Riya Kulkarni', cls: 'TE', div: 'B' }
    );
  });

  test('a user cannot impersonate another author or change class/division/subject', async () => {
    const victim = await h.registerStudent(ctx.app, { fullName: 'Victim Student' });
    const attacker = await h.registerStudent(ctx.app, { fullName: 'Attacker Student', className: 'SE', division: 'D' });
    await h.join(attacker, 'CN');

    const res = await h.postDoubt(attacker, 'CN', {
      authorId: victim.user.id,
      author_id: victim.user.id,
      fullName: 'Victim Student',
      className: 'BE',
      division: 'A',
      subjectId: 1,
      status: 'resolved',
    });
    assert.equal(res.status, 201);
    const row = ctx.db.prepare('SELECT author_id, subject_id, status FROM doubts WHERE id = ?').get(res.body.doubt.id);
    assert.equal(row.author_id, attacker.user.id);
    assert.equal(row.status, 'unanswered');
    assert.equal(res.body.doubt.author.fullName, 'Attacker Student');
    assert.equal(res.body.doubt.author.className, 'SE');
    assert.equal(res.body.doubt.subject.code, 'CN');

    const answer = await h.send(attacker, 'post', `/api/doubts/${res.body.doubt.id}/answers`, { body: 'Hello', authorId: victim.user.id });
    assert.equal(answer.body.answer.author.id, attacker.user.id);
  });

  test('title and description are validated', async () => {
    const agent = await h.registerStudent(ctx.app);
    await h.join(agent, 'WT');
    const res = await h.postDoubt(agent, 'WT', { title: 'short', description: 'tiny' });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.title);
    assert.ok(res.body.details.description);
  });

  test('a doubt posted under CN does not appear in DAA or WT', async () => {
    const agent = await h.registerStudent(ctx.app);
    await h.join(agent, 'CN');
    await h.postDoubt(agent, 'CN', { title: 'Only for networks please' });

    assert.equal((await agent.get('/api/subjects/CN/doubts')).body.doubts.length, 1);
    assert.equal((await agent.get('/api/subjects/DAA/doubts')).body.doubts.length, 0);
    assert.equal((await agent.get('/api/subjects/WT/doubts')).body.doubts.length, 0);
  });

  test('HTML in a doubt is stored as plain text (the browser renders it with textContent)', async () => {
    const agent = await h.registerStudent(ctx.app);
    await h.join(agent, 'WT');
    const res = await h.postDoubt(agent, 'WT', { title: '<script>alert(1)</script> title' });
    assert.equal(res.body.doubt.title, '<script>alert(1)</script> title');
    assert.match(res.headers['content-type'], /application\/json/);
  });

  test('most recent doubts come first', async () => {
    const agent = await h.registerStudent(ctx.app);
    await h.join(agent, 'DAA');
    await h.postDoubt(agent, 'DAA', { title: 'First doubt asked here' });
    await h.postDoubt(agent, 'DAA', { title: 'Second doubt asked here' });
    const list = (await agent.get('/api/subjects/DAA/doubts')).body.doubts;
    assert.equal(list[0].title, 'Second doubt asked here');
  });
});

describe('Answers, filtering and resolving', () => {
  let ctx, author, helper, prof, doubtId;

  beforeEach(async () => {
    ctx = h.makeApp();
    author = await h.registerStudent(ctx.app, { fullName: 'Author Student' });
    helper = await h.registerStudent(ctx.app, { fullName: 'Helper Student' });
    prof = await h.loginProfessor(ctx.app, ctx.db, 'Prof Rao');
    for (const a of [author, helper, prof]) await h.join(a, 'DAA');
    doubtId = (await h.postDoubt(author, 'DAA', { title: 'Why is quicksort fast?' })).body.doubt.id;
  });

  test('posting an answer updates reply count and status', async () => {
    const res = await h.send(helper, 'post', `/api/doubts/${doubtId}/answers`, { body: 'Because of good average-case partitioning.' });
    assert.equal(res.status, 201);
    assert.equal(res.body.doubt.replyCount, 1);
    assert.equal(res.body.doubt.status, 'answered');
    assert.equal(res.body.answer.author.fullName, 'Helper Student');

    await h.send(prof, 'post', `/api/doubts/${doubtId}/answers`, { body: 'Expected O(n log n) comparisons.' });
    const detail = await author.get(`/api/doubts/${doubtId}`);
    assert.equal(detail.body.doubt.replyCount, 2);
    assert.deepEqual(detail.body.answers.map((a) => a.author.role), ['student', 'professor']);
  });

  test('answers require joining the room and a non-empty body', async () => {
    const outsider = await h.registerStudent(ctx.app);
    assert.equal((await h.send(outsider, 'post', `/api/doubts/${doubtId}/answers`, { body: 'Hi there' })).status, 403);
    assert.equal((await h.send(helper, 'post', `/api/doubts/${doubtId}/answers`, { body: ' ' })).status, 400);
    assert.equal((await h.send(helper, 'post', '/api/doubts/99999/answers', { body: 'Hello' })).status, 404);
  });

  test('status filters return unanswered, answered and resolved doubts', async () => {
    const second = (await h.postDoubt(author, 'DAA', { title: 'What is dynamic programming?' })).body.doubt.id;
    const third = (await h.postDoubt(author, 'DAA', { title: 'Explain Kruskal algorithm' })).body.doubt.id;
    await h.send(helper, 'post', `/api/doubts/${second}/answers`, { body: 'Overlapping subproblems + memoisation.' });
    await h.send(author, 'patch', `/api/doubts/${third}/resolve`, { resolved: true });

    const ids = async (status) => (await author.get(`/api/subjects/DAA/doubts?status=${status}`)).body.doubts.map((d) => d.id);
    assert.deepEqual(await ids('unanswered'), [doubtId]);
    assert.deepEqual(await ids('answered'), [second]);
    assert.deepEqual(await ids('resolved'), [third]);
    assert.deepEqual((await ids('unresolved')).sort(), [doubtId, second].sort());
    assert.equal((await ids('all')).length, 3);
    assert.equal((await author.get('/api/subjects/DAA/doubts?status=bogus')).status, 400);

    const dash = (await author.get('/api/subjects')).body.subjects.find((s) => s.code === 'DAA');
    assert.equal(dash.unansweredCount, 1);
    assert.equal(dash.unresolvedCount, 2);
  });

  test('the unanswered list updates when a doubt is answered', async () => {
    const before = await author.get('/api/subjects/DAA/doubts?status=unanswered');
    assert.equal(before.body.doubts.length, 1);
    await h.send(helper, 'post', `/api/doubts/${doubtId}/answers`, { body: 'Partitioning is cache friendly.' });
    const after = await author.get('/api/subjects/DAA/doubts?status=unanswered');
    assert.equal(after.body.doubts.length, 0);
  });

  test('keyword search matches title and description and treats % literally', async () => {
    await h.postDoubt(author, 'DAA', { title: 'Binary search edge cases', description: 'What happens when the array has duplicates?' });
    const q = async (text) => (await author.get(`/api/subjects/DAA/doubts?q=${encodeURIComponent(text)}`)).body.doubts.length;
    assert.equal(await q('binary'), 1);
    assert.equal(await q('DUPLICATES'), 1);
    assert.equal(await q('quicksort'), 1);
    assert.equal(await q('%'), 0);
    assert.equal(await q("' OR 1=1 --"), 0, 'SQL injection attempt is just a search string');
  });

  test('author can resolve, it leaves the unresolved list but stays in all doubts, and can reopen', async () => {
    const res = await h.send(author, 'patch', `/api/doubts/${doubtId}/resolve`, { resolved: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.doubt.status, 'resolved');
    assert.equal(res.body.doubt.resolvedBy, 'Author Student');

    assert.equal((await author.get('/api/subjects/DAA/doubts?status=unresolved')).body.doubts.length, 0);
    assert.equal((await author.get('/api/subjects/DAA/doubts?status=all')).body.doubts.length, 1);

    const reopened = await h.send(author, 'patch', `/api/doubts/${doubtId}/resolve`, { resolved: false });
    assert.equal(reopened.body.doubt.status, 'unanswered');
  });

  test('another student cannot resolve the doubt, a professor can', async () => {
    assert.equal((await h.send(helper, 'patch', `/api/doubts/${doubtId}/resolve`, { resolved: true })).status, 403);
    const ok = await h.send(prof, 'patch', `/api/doubts/${doubtId}/resolve`, { resolved: true });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.doubt.resolvedBy, 'Prof Rao');
  });
});
