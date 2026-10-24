/** Landing page: adjusts the hero when the visitor is already logged in. */
(async () => {
  const user = await DB.renderNav('home');

  if (user) {
    document.getElementById('logged-in-box').classList.remove('hidden');
  }

  // Redirected here after trying to open a private page without logging in
  if (!user && new URLSearchParams(location.search).get('login') === 'required') {
    DB.showAlert(document.getElementById('login-required'), 'Please choose Student Login or Professor Login to continue.', 'info');
  }
  DB.refreshIcons();
})();
