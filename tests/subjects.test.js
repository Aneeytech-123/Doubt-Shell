const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('Subject dashboard and participation', () => {
  let ctx;
  beforeEach(() => { ctx = h.makeApp(); });

  test('dashboard lists DAA, CN and WT with counts from the database', async () => {
    const agent = await h.registerStudent(ctx.app);
    const res = await agent.get('/api/subjects');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.subjects.map((s) => s.code), ['DAA', 'CN', 'WT']);
    for (const s of res.body.subjects) {
      assert.equal(s.participantCount, 0);
      assert.equal(s.unansweredCount, 0);
      assert.equal(s.joined, false);
    }
  });

  test('joining and leaving updates the participant count accurately', async () => {
    const a = await h.registerStudent(ctx.app, { fullName: 'Student Alpha' });
    const b = await h.registerStudent(ctx.app, { fullName: 'Student Beta', className: 'SE', division: 'C' });
    const prof = await h.loginProfessor(ctx.app, ctx.db, 'Prof Gamma');

    assert.equal((await h.join(a, 'CN')).body.participantCount, 1);
    assert.equal((await h.join(a, 'CN')).body.participantCount, 1, 'joining twice does not double count');
    assert.equal((await h.join(b, 'CN')).body.participantCount, 2);
    assert.equal((await h.join(prof, 'CN')).body.participantCount, 3);

    const room = await a.get('/api/subjects/CN');
    assert.equal(room.body.participantCount, 3);
    assert.equal(room.body.joined, true);
    const names = room.body.participants.map((p) => p.fullName);
    assert.deepEqual(names, ['Prof Gamma', 'Student Alpha', 'Student Beta'], 'professors listed first');
    const beta = room.body.participants.find((p) => p.fullName === 'Student Beta');
    assert.equal(beta.className, 'SE');
    assert.equal(beta.division, 'C');
    assert.equal(room.body.participants[0].role, 'professor');
    assert.equal(room.body.participants[0].email, undefined, 'emails are not exposed in the participant list');

    const left = await h.send(b, 'delete', '/api/subjects/CN/join');
    assert.equal(left.body.participantCount, 2);

    // Other rooms are unaffected
    const dash = await a.get('/api/subjects');
    const counts = Object.fromEntries(dash.body.subjects.map((s) => [s.code, s.participantCount]));
    assert.deepEqual(counts, { DAA: 0, CN: 2, WT: 0 });
  });

  test('unknown subject returns 404', async () => {
    const agent = await h.registerStudent(ctx.app);
    assert.equal((await agent.get('/api/subjects/XYZ')).status, 404);
    assert.equal((await h.join(agent, 'XYZ')).status, 404);
  });

  test('a new subject added to the subjects table appears on the dashboard', async () => {
    ctx.db.prepare("INSERT INTO subjects (code, name, description) VALUES ('OS', 'Operating Systems', 'Processes and memory')").run();
    const agent = await h.registerStudent(ctx.app);
    const res = await agent.get('/api/subjects');
    assert.ok(res.body.subjects.some((s) => s.code === 'OS'));
  });
});
