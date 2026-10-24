/**
 * common.js — helpers shared by every page.
 *
 * SECURITY NOTE: user-written text (names, questions, answers) is always put
 * on the page with `textContent`, never `innerHTML`. textContent treats the
 * text as plain characters, so a "<script>" typed by a user is shown as text
 * and never runs (prevents Cross-Site Scripting / XSS).
 */
const DB = (() => {
  let csrfToken = null;
  let sessionInfo = null;

  /** Loads the current user and a CSRF token from the server. */
  async function loadSession() {
    const res = await fetch('/api/session', { credentials: 'same-origin' });
    sessionInfo = await res.json();
    csrfToken = sessionInfo.csrfToken;
    return sessionInfo;
  }

  /** fetch() wrapper: sends JSON + CSRF token, throws an Error with the server's message. */
  async function api(url, { method = 'GET', body } = {}) {
    const options = { method, credentials: 'same-origin', headers: {} };
    if (method !== 'GET') {
      if (!csrfToken) await loadSession();
      options.headers['X-CSRF-Token'] = csrfToken;
    }
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    let data = {};
    try { data = await res.json(); } catch { /* empty body */ }

    if (res.status === 401 && !url.startsWith('/api/auth/')) {
      window.location.href = '/?login=required';
      throw new Error('Please log in.');
    }
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      err.details = data.details || {};
      throw err;
    }
    if (data.csrfToken) csrfToken = data.csrfToken; // new token after login
    return data;
  }

  /**
   * Small helper to create elements without innerHTML.
   *   el('p', { class: 'muted' }, 'Hello')  ->  <p class="muted">Hello</p>
   */
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value === null || value === undefined) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  /** <i data-lucide="..."> placeholder, turned into an SVG by refreshIcons(). */
  const icon = (name) => el('i', { 'data-lucide': name, 'aria-hidden': 'true' });

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }

  function avatar(user, small) {
    return el('span', {
      class: `avatar${small ? ' avatar-sm' : ''}${user.role === 'professor' ? ' is-professor' : ''}`,
      'aria-hidden': 'true',
      text: initials(user.fullName),
    });
  }

  function rolePill(user) {
    if (user.role === 'professor') {
      return el('span', { class: 'pill pill-professor' }, icon('presentation'), 'Professor');
    }
    return el('span', { class: 'pill pill-student' }, icon('graduation-cap'), `${user.className}-${user.division}`);
  }

  const STATUS = {
    unanswered: { label: 'Unanswered', icon: 'circle-help' },
    answered: { label: 'Answered', icon: 'message-square' },
    resolved: { label: 'Resolved', icon: 'circle-check' },
  };
  function statusPill(status) {
    const s = STATUS[status];
    return el('span', { class: `pill pill-${status}` }, icon(s.icon), s.label);
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function timeAgo(iso) {
    const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return formatDate(iso);
  }

  /** <time> element showing "5 min ago" with the full date on hover. */
  function timeEl(iso) {
    return el('time', { datetime: iso, title: formatDate(iso), text: timeAgo(iso) });
  }

  function toast(message, isError) {
    let region = document.querySelector('.toast-region');
    if (!region) {
      region = el('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
      document.body.append(region);
    }
    const t = el('div', { class: `toast${isError ? ' is-error' : ''}`, text: message });
    region.append(t);
    setTimeout(() => t.remove(), 4000);
  }

  /** Shows server validation errors under the matching form fields. */
  function showFieldErrors(form, details = {}) {
    form.querySelectorAll('.field-error').forEach((n) => n.remove());
    form.querySelectorAll('.field.has-error').forEach((n) => n.classList.remove('has-error'));
    for (const [name, message] of Object.entries(details)) {
      const input = form.elements[name];
      if (!input) continue;
      const field = input.closest('.field');
      const id = `${input.id || name}-error`;
      field.classList.add('has-error');
      field.append(el('div', { class: 'field-error', id, text: message }));
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', id);
    }
  }

  function clearFieldErrors(form) {
    showFieldErrors(form, {});
    form.querySelectorAll('[aria-invalid]').forEach((n) => n.removeAttribute('aria-invalid'));
  }

  function showAlert(container, message, type = 'error') {
    const icons = { error: 'circle-alert', success: 'circle-check', info: 'bell', warning: 'circle-alert' };
    container.replaceChildren(el('div', { class: `alert alert-${type}`, role: 'alert' }, icon(icons[type]), el('span', { text: message })));
    container.classList.remove('hidden');
    refreshIcons();
  }

  /** Builds the navigation links depending on whether someone is logged in. */
  async function renderNav(active) {
    const nav = document.getElementById('nav-links');
    const toggle = document.querySelector('.nav-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }

    const info = sessionInfo || (await loadSession());
    const user = info.user;
    const link = (href, label, iconName, key) =>
      el('a', { href, 'aria-current': active === key ? 'page' : null }, icon(iconName), label);

    if (!user) {
      nav.replaceChildren(
        link('/', 'Home', 'house', 'home'),
        link('/login?role=student', 'Student Login', 'graduation-cap', 'student'),
        link('/login?role=professor', 'Professor Login', 'presentation', 'professor')
      );
    } else {
      const bell = link('/notifications', 'Notifications', 'bell', 'notifications');
      const badge = el('span', { class: 'count-badge hidden', id: 'nav-unread' });
      bell.append(badge);
      const logout = el('button', { class: 'linklike', type: 'button' }, icon('log-out'), 'Logout');
      logout.addEventListener('click', async () => {
        try {
          await api('/api/auth/logout', { method: 'POST' });
        } finally {
          window.location.href = '/';
        }
      });
      nav.replaceChildren(
        link('/dashboard', 'Dashboard', 'layout-dashboard', 'dashboard'),
        bell,
        logout,
        el('span', { class: 'nav-user' }, avatar(user, true), el('span', { text: user.fullName }))
      );
      updateUnreadBadge();
    }
    refreshIcons();
    return user;
  }

  async function updateUnreadBadge() {
    const badge = document.getElementById('nav-unread');
    if (!badge) return 0;
    try {
      const { unread } = await api('/api/notifications/unread-count');
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.classList.toggle('hidden', unread === 0);
      badge.setAttribute('aria-label', `${unread} unread`);
      return unread;
    } catch {
      return 0;
    }
  }

  /** Disables a button and changes its label while a request is running. */
  async function withBusy(button, busyText, task) {
    const original = Array.from(button.childNodes).map((n) => n.cloneNode(true));
    button.disabled = true;
    button.textContent = busyText;
    try {
      return await task();
    } finally {
      button.disabled = false;
      button.replaceChildren(...original);
      refreshIcons();
    }
  }

  return {
    loadSession, api, el, icon, refreshIcons, avatar, rolePill, statusPill,
    formatDate, timeAgo, timeEl, toast, showFieldErrors, clearFieldErrors, showAlert,
    renderNav, updateUnreadBadge, withBusy,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
});
