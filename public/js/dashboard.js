/** Dashboard: subject cards with live counts read from the database. */
(async () => {
  const { el, icon } = DB;
  const user = await DB.renderNav('dashboard');

  document.getElementById('welcome').textContent = `Welcome, ${user.fullName.split(' ')[0]}`;
  document.getElementById('profile-strip').append(
    DB.rolePill(user),
    el('span', { class: 'pill pill-neutral' }, icon('mail'), user.email)
  );

  const grid = document.getElementById('subject-grid');

  function subjectCard(s) {
    const unansweredText = `${s.unansweredCount} unanswered`;
    return el('article', { class: 'card subject-card' },
      el('div', { class: 'subject-top' },
        el('div', { class: 'subject-code', 'aria-hidden': 'true', text: s.code }),
        el('div', {},
          el('h3', { text: s.name }),
          el('span', { class: 'muted small', text: s.code })
        )
      ),
      el('p', { class: 'desc', text: s.description }),
      el('div', { class: 'subject-meta' },
        el('span', {}, icon('users'), `${s.participantCount} participant${s.participantCount === 1 ? '' : 's'}`),
        el('span', { class: s.unansweredCount > 0 ? 'warn' : '' }, icon('circle-help'), unansweredText),
        el('span', {}, icon('message-square'), `${s.doubtCount} total`)
      ),
      el('div', { class: 'subject-foot' },
        s.joined
          ? el('span', { class: 'pill pill-resolved' }, icon('circle-check'), 'Joined')
          : el('span', { class: 'pill pill-neutral', text: 'Not joined' }),
        el('a', { class: 'btn btn-primary btn-sm', href: `/subjects/${encodeURIComponent(s.code)}`, 'aria-label': `Enter ${s.name} room` },
          'Enter room', icon('arrow-right'))
      )
    );
  }

  try {
    const [{ subjects }, unread] = await Promise.all([DB.api('/api/subjects'), DB.updateUnreadBadge()]);
    grid.replaceChildren(...subjects.map(subjectCard));
    if (subjects.length === 0) grid.replaceChildren(el('p', { class: 'muted', text: 'No subjects yet.' }));

    document.getElementById('stat-joined').textContent = subjects.filter((s) => s.joined).length;
    document.getElementById('stat-unanswered').textContent = subjects.reduce((n, s) => n + s.unansweredCount, 0);
    document.getElementById('stat-unread').textContent = unread;
  } catch (err) {
    grid.replaceChildren();
    DB.showAlert(document.getElementById('subject-alert'), err.message);
  }
  DB.refreshIcons();
})();
