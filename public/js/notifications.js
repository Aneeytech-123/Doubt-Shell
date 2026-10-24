/** Notifications page: lists the user's notifications and marks them read. */
(async () => {
  const { el, icon, api } = DB;
  await DB.renderNav('notifications');

  const list = document.getElementById('notif-list');
  const summary = document.getElementById('notif-summary');
  const icons = { answer: 'message-square', professor_answer: 'presentation', resolved: 'circle-check' };

  async function markRead(id) {
    await api(`/api/notifications/${id}/read`, { method: 'PATCH' });
  }

  async function load() {
    const { notifications } = await api('/api/notifications');
    const unread = notifications.filter((n) => !n.isRead).length;
    summary.textContent = notifications.length
      ? `${unread} unread of ${notifications.length}.`
      : 'Replies and updates on your doubts will appear here.';

    if (notifications.length === 0) {
      list.replaceChildren(el('li', { class: 'empty' }, icon('inbox'), el('p', { text: "You're all caught up." })));
    } else {
      list.replaceChildren(...notifications.map((n) => {
        const open = el('a', { class: 'btn btn-secondary btn-sm', href: n.link || '#' }, 'Open discussion', icon('arrow-right'));
        open.addEventListener('click', async (event) => {
          if (!n.isRead) {
            event.preventDefault();
            try { await markRead(n.id); } finally { window.location.href = n.link || '/notifications'; }
          }
        });

        const actions = el('div', { class: 'room-actions' });
        if (n.link) actions.append(open);
        if (!n.isRead) {
          actions.append(el('button', {
            class: 'btn btn-ghost btn-sm', type: 'button',
            onclick: async () => { await markRead(n.id); load(); DB.updateUnreadBadge(); },
          }, 'Mark read'));
        }

        return el('li', { class: `notif type-${n.type}${n.isRead ? '' : ' is-unread'}` },
          el('div', { class: 'notif-icon' }, icon(icons[n.type] || 'bell')),
          el('div', { class: 'notif-body' },
            el('p', { text: n.message }),
            el('div', { class: 'notif-time' }, DB.timeEl(n.createdAt), n.isRead ? '' : ' · New'),
            actions),
          n.isRead ? null : el('span', { class: 'unread-dot', 'aria-label': 'Unread' })
        );
      }));
    }
    document.getElementById('read-all-btn').disabled = unread === 0;
    DB.refreshIcons();
  }

  document.getElementById('read-all-btn').addEventListener('click', async (e) => {
    await DB.withBusy(e.currentTarget, 'Marking…', () => api('/api/notifications/read-all', { method: 'POST' }));
    await load();
    DB.updateUnreadBadge();
  });

  try {
    await load();
  } catch (err) {
    DB.showAlert(document.getElementById('notif-alert'), err.message);
  }
})();
