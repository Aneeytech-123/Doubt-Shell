/**
 * Registration page (used by both the student and professor forms).
 * The form's data-role only decides which URL we POST to. The server creates
 * the account with the role of that URL, and validates every field again.
 */
(async () => {
  const form = document.getElementById('register-form');
  const role = form.dataset.role; // "student" or "professor"
  const alertBox = document.getElementById('form-alert');
  const button = document.getElementById('register-btn');

  await DB.renderNav(role);
  const info = await DB.loadSession();

  if (role === 'student') {
    // Fill the dropdowns with the values the server accepts
    for (const c of info.classOptions) form.elements.className.append(DB.el('option', { value: c, text: c }));
    for (const d of info.divisionOptions) form.division.append(DB.el('option', { value: d, text: d }));
  } else {
    const note = document.getElementById('policy-note');
    const messages = {
      approval: ['info', 'Professor accounts are reviewed. After registering, an administrator must approve your account before you can log in.'],
      open: ['warning', 'Professor accounts are activated immediately on this installation (testing mode).'],
      closed: ['warning', 'Professor self-registration is currently disabled. Please contact the administrator.'],
    };
    const [type, text] = messages[info.professorPolicy] || messages.approval;
    DB.showAlert(note, text, type);
    if (info.professorPolicy === 'closed') button.disabled = true;
  }

  /** Browser-side checks give instant feedback (the server checks again). */
  function validate(values) {
    const errors = {};
    if (values.fullName.length < 2) errors.fullName = 'Enter your full name.';
    if (!values.email) errors.email = 'Email is required.';
    else if (!form.email.checkValidity()) errors.email = 'Enter a valid email address.';
    if (role === 'student') {
      if (!values.className) errors.className = 'Select your class.';
      if (!values.division) errors.division = 'Select your division.';
    }
    const p = values.password;
    if (p.length < 8 || !/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p)) {
      errors.password = 'Use 8+ characters with uppercase, lowercase and a number.';
    }
    if (p !== values.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    return errors;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alertBox.classList.add('hidden');
    DB.clearFieldErrors(form);

    const values = {
      fullName: form.fullName.value.trim(),
      email: form.email.value.trim(),
      password: form.password.value,
      confirmPassword: form.confirmPassword.value,
    };
    if (role === 'student') {
      values.className = form.elements.className.value;
      values.division = form.division.value;
    }

    const errors = validate(values);
    if (Object.keys(errors).length) {
      DB.showFieldErrors(form, errors);
      form.querySelector('[aria-invalid="true"]').focus();
      return;
    }

    try {
      const result = await DB.withBusy(button, 'Creating account…', () =>
        DB.api(`/api/auth/register/${role}`, { method: 'POST', body: values })
      );
      if (result.status === 'pending') {
        form.reset();
        form.classList.add('hidden');
        DB.showAlert(alertBox, result.message, 'success');
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      DB.showAlert(alertBox, err.message);
      DB.showFieldErrors(form, err.details);
    }
  });
})();
