/**
 * Subject doubt room — the main page of DoubtBridge.
 *   Left:   participants of this room
 *   Middle: unresolved (open) doubts with a quick-answer box
 *   Right:  all doubts with search + status filters; click one to open its discussion
 */
(async () => {
  const { el, icon, api } = DB;
  const code = decodeURIComponent(location.pathname.split('/').pop());

  const state = {
    user: null,
    joined: false,
    filter: 'all',
    query: '',
    openDoubtId: null,
  };

  const $ = (id) => document.getElementById(id);
  const roomAlert = $('room-alert');

  state.user = await DB.renderNav(null);

  // ---------------------------------------------------------------
  // Small building blocks
  // ---------------------------------------------------------------
  function byline(author, createdAt) {
    return el('div', { class: 'byline' },
      DB.avatar(author, true),
      el('strong', { text: author.fullName }),
      DB.rolePill(author),
      el('span', { 'aria-hidden': 'true', text: '·' }),
      DB.timeEl(createdAt)
    );
  }

  const replies = (n) => `${n} ${n === 1 ? 'reply' : 'replies'}`;

  function emptyState(iconName, text) {
    return el('div', { class: 'empty' }, icon(iconName), el('p', { text }));
  }

  // ---------------------------------------------------------------
  // Room header + participants (left column)
  // ---------------------------------------------------------------
  async function loadRoom() {
    const data = await api(`/api/subjects/${encodeURIComponent(code)}`);
    state.joined = data.joined;
    const s = data.subject;

    document.title = `${s.code} Doubt Room — DoubtBridge`;
    $('room-code').textContent = s.code;
    $('crumb-code').textContent = s.code;
    $('room-name').textContent = s.name;
    $('room-desc').textContent = s.description;
    $('ask-subject').textContent = `${s.code} — ${s.name}`;
    const u = state.user;
    $('ask-author').textContent = u.role === 'student' ? `${u.fullName} (${u.className}-${u.division})` : u.fullName;

    // Join / leave controls
    const joinBtn = $('join-btn');
    joinBtn.disabled = false;
    joinBtn.replaceChildren(icon(state.joined ? 'door-closed' : 'door-open'), state.joined ? 'Leave room' : 'Join room');
    joinBtn.className = `btn ${state.joined ? 'btn-danger-outline' : 'btn-secondary'}`;
    $('ask-btn').disabled = false;
    $('join-banner').classList.toggle('hidden', state.joined);

    // Participants list
    $('participant-count').textContent = data.participantCount;
    $('tab-count-participants').textContent = data.participantCount;
    const body = $('participants-body');
    if (data.participants.length === 0) {
      body.replaceChildren(emptyState('users', 'No one has joined yet. Be the first!'));
    } else {
      const profs = data.participants.filter((p) => p.role === 'professor');
      const students = data.participants.filter((p) => p.role === 'student');
      const person = (p) =>
        el('li', { class: 'participant' },
          DB.avatar(p),
          el('div', {},
            el('div', { class: 'participant-name' }, p.fullName, p.isYou ? el('span', { class: 'you-tag', text: '(you)' }) : null),
            el('div', { class: 'participant-sub', text: p.role === 'professor' ? 'Professor' : `Student · ${p.className}-${p.division}` })
          )
        );
      const group = (title, list) =>
        list.length
          ? [el('h3', { class: 'participant-group-title', text: `${title} (${list.length})` }), el('ul', { class: 'participant-list' }, list.map(person))]
          : [];
      body.replaceChildren(...group('Professors', profs), ...group('Students', students));
    }
    DB.refreshIcons();
  }

  async function toggleJoin(button) {
    try {
      await DB.withBusy(button, state.joined ? 'Leaving…' : 'Joining…', () =>
        api(`/api/subjects/${encodeURIComponent(code)}/join`, { method: state.joined ? 'DELETE' : 'POST' })
      );
      DB.toast(state.joined ? 'You left the room.' : 'You joined the room!');
      await loadRoom();
      await refreshDoubts(); // answer buttons depend on membership
    } catch (err) {
      DB.toast(err.message, true);
    }
  }

  $('join-btn').addEventListener('click', (e) => toggleJoin(e.currentTarget));
  $('banner-join-btn').addEventListener('click', (e) => toggleJoin(e.currentTarget));

  // ---------------------------------------------------------------
  // Middle column: unresolved doubts
  // ---------------------------------------------------------------
  function doubtCard(d) {
    const answerArea = el('form', { class: 'quick-answer hidden', novalidate: true });
    const textarea = el('textarea', { name: 'body', rows: '3', maxlength: '5000', placeholder: 'Write a helpful answer…', 'aria-label': `Answer to: ${d.title}` });
    const submit = el('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, icon('send'), 'Post answer');
    answerArea.append(textarea, el('div', { class: 'row' },
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => answerArea.classList.add('hidden') }, 'Cancel'),
      submit));
    answerArea.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (textarea.value.trim().length < 2) return DB.toast('Answer must be at least 2 characters.', true);
      try {
        await DB.withBusy(submit, 'Posting…', () =>
          api(`/api/doubts/${d.id}/answers`, { method: 'POST', body: { body: textarea.value } })
        );
        DB.toast('Answer posted.');
        refreshDoubts();
      } catch (err) {
        DB.toast(err.message, true);
      }
    });

    const actions = el('div', { class: 'room-actions' });
    if (state.joined) {
      actions.append(el('button', {
        class: 'btn btn-secondary btn-sm', type: 'button',
        onclick: () => { answerArea.classList.toggle('hidden'); textarea.focus(); },
      }, icon('message-square'), 'Answer'));
    }
    actions.append(el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => openDiscussion(d.id) }, 'View discussion'));
    if (d.canResolve) {
      actions.append(el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: (e) => setResolved(d.id, true, e.currentTarget) }, icon('circle-check'), 'Mark resolved'));
    }

    return el('article', { class: `card doubt-card is-${d.status}` },
      el('div', { class: 'doubt-top' }, DB.statusPill(d.status), el('span', { class: 'small muted', text: d.subject.code })),
      el('h3', {}, el('button', { type: 'button', onclick: () => openDiscussion(d.id), text: d.title })),
      el('p', { class: 'doubt-desc', text: d.description }),
      byline(d.author, d.createdAt),
      el('div', { class: 'doubt-footer' },
        el('span', { class: 'meta' }, icon('message-square'), replies(d.replyCount)),
        actions),
      answerArea
    );
  }

  async function loadUnresolved() {
    const { doubts } = await api(`/api/subjects/${encodeURIComponent(code)}/doubts?status=unresolved`);
    // Doubts with no replies first, then the rest (each group newest first)
    doubts.sort((a, b) => (a.status === b.status ? 0 : a.status === 'unanswered' ? -1 : 1));
    $('unresolved-count').textContent = doubts.length;
    $('tab-count-unresolved').textContent = doubts.length;
    $('unresolved-body').replaceChildren(
      ...(doubts.length ? doubts.map(doubtCard) : [emptyState('circle-check', 'No open doubts here. Everything is resolved!')])
    );
    DB.refreshIcons();
  }

  // ---------------------------------------------------------------
  // Right column: all doubts with search and filters
  // ---------------------------------------------------------------
  async function loadAll() {
    const params = new URLSearchParams({ status: state.filter });
    if (state.query) params.set('q', state.query);
    const { doubts } = await api(`/api/subjects/${encodeURIComponent(code)}/doubts?${params}`);

    $('all-count').textContent = doubts.length;
    $('tab-count-all').textContent = doubts.length;
    const list = el('ul', { class: 'doubt-list' }, doubts.map((d) =>
      el('li', { class: 'doubt-item' },
        el('button', { type: 'button', onclick: () => openDiscussion(d.id) },
          DB.statusPill(d.status),
          el('span', { class: 'title', text: d.title }),
          el('span', { class: 'sub' },
            el('span', { text: d.author.fullName }),
            el('span', {}, icon('message-square'), replies(d.replyCount)),
            el('span', {}, icon('clock'), DB.timeAgo(d.createdAt)))
        ))
    ));
    const emptyText = state.query || state.filter !== 'all' ? 'No doubts match your search.' : 'No doubts yet. Ask the first one!';
    $('all-body').replaceChildren(doubts.length ? list : emptyState('inbox', emptyText));
    DB.refreshIcons();
  }

  document.querySelectorAll('.chip[data-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.filter = chip.dataset.filter;
      document.querySelectorAll('.chip[data-filter]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      loadAll().catch((err) => DB.toast(err.message, true));
    });
  });

  let searchTimer;
  $('search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = e.target.value.trim();
      loadAll().catch((err) => DB.toast(err.message, true));
    }, 250); // wait until the user stops typing
  });

  async function refreshDoubts() {
    await Promise.all([loadUnresolved(), loadAll()]);
    if (state.openDoubtId) await openDiscussion(state.openDoubtId, true);
  }

  async function setResolved(id, resolved, button) {
    try {
      await DB.withBusy(button, resolved ? 'Resolving…' : 'Reopening…', () =>
        api(`/api/doubts/${id}/resolve`, { method: 'PATCH', body: { resolved } })
      );
      DB.toast(resolved ? 'Doubt marked as resolved.' : 'Doubt reopened.');
      refreshDoubts();
    } catch (err) {
      DB.toast(err.message, true);
    }
  }

  // ---------------------------------------------------------------
  // Discussion dialog
  // ---------------------------------------------------------------
  const discussion = $('discussion-dialog');

  async function openDiscussion(id, keepScroll) {
    let data;
    try {
      data = await api(`/api/doubts/${id}`);
    } catch (err) {
      DB.toast(err.message, true);
      return;
    }
    const { doubt: d, answers } = data;
    if (d.subject.code.toUpperCase() !== code.toUpperCase()) {
      // The doubt belongs to another room: go there instead
      window.location.href = `/subjects/${encodeURIComponent(d.subject.code)}?doubt=${d.id}`;
      return;
    }
    state.openDoubtId = d.id;

    $('discussion-status').replaceChildren(DB.statusPill(d.status));

    const question = el('section', { class: 'discussion-question' },
      byline(d.author, d.createdAt),
      el('h3', { text: d.title }),
      el('p', { class: 'doubt-desc', text: d.description }),
      d.status === 'resolved'
        ? el('div', { class: 'alert alert-success' }, icon('circle-check'),
            el('span', { text: `Resolved${d.resolvedBy ? ` by ${d.resolvedBy}` : ''} on ${DB.formatDate(d.resolvedAt)}` }))
        : null
    );

    const answerNodes = answers.map((a) =>
      el('article', { class: `answer${a.author.role === 'professor' ? ' from-professor' : ''}` },
        DB.avatar(a.author),
        el('div', { class: 'answer-bubble' },
          el('div', { class: 'answer-meta' },
            el('strong', { text: a.author.fullName }),
            DB.rolePill(a.author),
            el('time', { datetime: a.createdAt, text: DB.formatDate(a.createdAt) })),
          el('div', { class: 'answer-body', text: a.body })
        ))
    );

    let replyArea;
    if (state.joined) {
      const textarea = el('textarea', { id: 'reply-input', name: 'body', rows: '4', maxlength: '5000', placeholder: 'Write your reply…' });
      const submit = el('button', { class: 'btn btn-primary', type: 'submit' }, icon('send'), 'Post reply');
      replyArea = el('form', { class: 'reply-box', novalidate: true },
        el('label', { for: 'reply-input', class: 'small', text: 'Your reply' }),
        textarea,
        el('div', { class: 'row' }, el('span', { class: 'small muted', text: `Replying as ${state.user.fullName}` }), submit));
      replyArea.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (textarea.value.trim().length < 2) return DB.toast('Reply must be at least 2 characters.', true);
        try {
          await DB.withBusy(submit, 'Posting…', () =>
            api(`/api/doubts/${d.id}/answers`, { method: 'POST', body: { body: textarea.value } })
          );
          DB.toast('Reply posted.');
          refreshDoubts();
        } catch (err) {
          DB.toast(err.message, true);
        }
      });
    } else {
      replyArea = el('div', { class: 'alert alert-info' }, icon('door-open'), el('span', { text: 'Join this room to reply to the discussion.' }));
    }

    const body = $('discussion-body');
    const scroll = body.scrollTop;
    body.replaceChildren(
      question,
      el('h4', { class: 'answers-title' }, icon('message-square'), `Answers (${answers.length})`),
      answers.length ? el('div', {}, answerNodes) : el('p', { class: 'muted small', text: 'No answers yet. Be the first to help!' }),
      replyArea
    );

    const foot = $('discussion-foot');
    foot.replaceChildren();
    if (d.canResolve) {
      const resolved = d.status === 'resolved';
      foot.append(el('button', {
        class: `btn ${resolved ? 'btn-secondary' : 'btn-success'}`, type: 'button',
        onclick: (e) => setResolved(d.id, !resolved, e.currentTarget),
      }, icon(resolved ? 'rotate-ccw' : 'circle-check'), resolved ? 'Reopen doubt' : 'Mark as resolved'));
    }
    foot.append(el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => discussion.close() }, 'Close'));
    foot.classList.toggle('hidden', false);

    DB.refreshIcons();
    if (!discussion.open) discussion.showModal();
    if (keepScroll) body.scrollTop = scroll;
  }

  discussion.addEventListener('close', () => {
    state.openDoubtId = null;
    const url = new URL(location.href);
    if (url.searchParams.has('doubt')) {
      url.searchParams.delete('doubt');
      history.replaceState(null, '', url);
    }
  });

  // ---------------------------------------------------------------
  // Ask a Doubt dialog
  // ---------------------------------------------------------------
  const askDialog = $('ask-dialog');
  const askForm = $('ask-form');

  $('ask-btn').addEventListener('click', () => {
    if (!state.joined) {
      DB.toast('Join this room first to ask a doubt.', true);
      $('join-banner').classList.remove('hidden');
      return;
    }
    $('ask-alert').classList.add('hidden');
    DB.clearFieldErrors(askForm);
    askDialog.showModal();
    askForm.elements.title.focus();
  });

  document.querySelectorAll('dialog [data-close]').forEach((btn) =>
    btn.addEventListener('click', () => btn.closest('dialog').close())
  );

  askForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    DB.clearFieldErrors(askForm);
    const values = { title: askForm.elements.title.value.trim(), description: askForm.elements.description.value.trim() };
    const errors = {};
    if (values.title.length < 8) errors.title = 'Title must be at least 8 characters.';
    if (values.description.length < 15) errors.description = 'Description must be at least 15 characters.';
    if (Object.keys(errors).length) return DB.showFieldErrors(askForm, errors);

    try {
      await DB.withBusy($('ask-submit'), 'Posting…', () =>
        api(`/api/subjects/${encodeURIComponent(code)}/doubts`, { method: 'POST', body: values })
      );
      askForm.reset();
      askDialog.close();
      DB.toast('Your doubt has been posted.');
      await refreshDoubts();
      selectTab('unresolved');
    } catch (err) {
      DB.showAlert($('ask-alert'), err.message);
      DB.showFieldErrors(askForm, err.details);
    }
  });

  // ---------------------------------------------------------------
  // Mobile / tablet tabs
  // ---------------------------------------------------------------
  function selectTab(name) {
    for (const key of ['participants', 'unresolved', 'all']) {
      $(`tab-${key}`).setAttribute('aria-selected', String(key === name));
      $(`panel-${key}`).classList.toggle('is-active', key === name);
    }
  }
  for (const key of ['participants', 'unresolved', 'all']) {
    $(`tab-${key}`).addEventListener('click', () => selectTab(key));
  }

  // ---------------------------------------------------------------
  // First load
  // ---------------------------------------------------------------
  try {
    await loadRoom();
    await Promise.all([loadUnresolved(), loadAll()]);
    const deepLink = Number(new URLSearchParams(location.search).get('doubt'));
    if (deepLink) openDiscussion(deepLink);
  } catch (err) {
    DB.showAlert(roomAlert, err.message);
  }
})();
