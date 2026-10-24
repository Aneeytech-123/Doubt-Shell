/**
 * Login page. The role in the URL (?role=student or ?role=professor) only
 * picks which login flow to show. The SERVER checks that the account's real
 * role matches, so changing this value in the browser gives no extra access.
 */
(async () => {
  const role = new URLSearchParams(location.search).get('role');
  const activeNav = role === 'professor' ? 'professor' : role === 'student' ? 'student' : null;
  await DB.renderNav(activeNav);

  if (role !== 'student' && role !== 'professor') {
    document.getElementById('choose-role').classList.remove('hidden');
    DB.refreshIcons();
    return;
  }

  const isProf = role === 'professor';
  document.getElementById('login-section').classList.remove('hidden');
  document.getElementById(`tab-${role}`).setAttribute('aria-current', 'page');
  document.getElementById('auth-head').classList.add(isProf ? 'is-professor' : 'is-student');
  document.querySelector('#auth-head .role-icon').replaceChildren(DB.icon(isProf ? 'presentation' : 'graduation-cap'));
  document.getElementById('login-title').textContent = isProf ? 'Professor Login' : 'Student Login';
  document.getElementById('login-subtitle').textContent = isProf
    ? 'Log in to guide discussions and respond to doubts.'
    : 'Welcome back! Log in to ask and answer doubts.';
  const reg = document.getElementById('register-link');
  reg.href = `/register/${role}`;
  reg.textContent = isProf ? 'Register as a professor' : 'Register as a student';
  document.title = `${isProf ? 'Professor' : 'Student'} Login — DoubtBridge`;
  DB.refreshIcons();

  const form = document.getElementById('login-form');
  const alertBox = document.getElementById('form-alert');
  const button = document.getElementById('login-btn');

  form.addEventListener('submit', async (event) => {
    event.preventDefault(); // stop the normal page reload; we send the data with fetch()
    alertBox.classList.add('hidden');
    DB.clearFieldErrors(form);

    const email = form.email.value.trim();
    const password = form.password.value;
    const errors = {};
    if (!email) errors.email = 'Email is required.';
    else if (!form.email.checkValidity()) errors.email = 'Enter a valid email address.';
    if (!password) errors.password = 'Password is required.';
    if (Object.keys(errors).length) return DB.showFieldErrors(form, errors);

    try {
      await DB.withBusy(button, 'Logging in…', () =>
        DB.api('/api/auth/login', { method: 'POST', body: { email, password, role } })
      );
      window.location.href = '/dashboard';
    } catch (err) {
      DB.showAlert(alertBox, err.message);
      form.password.value = '';
    }
  });
})();
