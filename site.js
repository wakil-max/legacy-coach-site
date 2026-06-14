/* Legacy Foundry — shared site script.
   Load order per page: supabase CDN, config.js, site.js */
(function () {
  /* ---------- global mobile nav polish (injected so every page benefits) ---------- */
  try {
    var mq = document.createElement('style');
    mq.textContent =
      '@media(max-width:840px){' +
      '.nav-right .btn-primary,.nav-right .nav-login{display:none!important}' +
      '.nav-right{gap:10px}' +
      '.nav-in .burger{display:flex!important;order:3}' +
      '.avatar-wrap{order:2}' +
      '}';
    document.head.appendChild(mq);
  } catch (e) {}

  /* ---------- marketing UI (runs on every page) ---------- */
  var nav = document.getElementById('nav');
  if (nav) addEventListener('scroll', function () { nav.classList.toggle('scrolled', scrollY > 16); });
  var burger = document.getElementById('burger'), mob = document.getElementById('mobile');
  if (burger && mob) {
    burger.addEventListener('click', function () { mob.classList.toggle('open'); });
    mob.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { mob.classList.remove('open'); }); });
  }
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .12 });
  document.querySelectorAll('.rv').forEach(function (el, i) { el.style.transitionDelay = (i % 4 * 60) + 'ms'; io.observe(el); });
  var barIO = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.querySelectorAll('i[data-w]').forEach(function (f, i) { setTimeout(function () { f.style.width = f.dataset.w + '%'; }, 120 + i * 130); }); barIO.unobserve(e.target); } }); }, { threshold: .35 });
  document.querySelectorAll('.app-panel,.arcs').forEach(function (el) { barIO.observe(el); });
  document.querySelectorAll('.fq').forEach(function (b) { b.addEventListener('click', function () { var it = b.parentElement, o = it.classList.contains('open'); document.querySelectorAll('.fitem').forEach(function (i) { i.classList.remove('open'); }); if (!o) it.classList.add('open'); }); });
  document.querySelectorAll('.app .task').forEach(function (t) { t.addEventListener('click', function () { t.classList.toggle('done'); t.querySelector('.box').textContent = t.classList.contains('done') ? '✓' : ''; }); });

  /* ---------- Supabase ---------- */
  var URL = window.LC_SUPABASE_URL || '', KEY = window.LC_SUPABASE_ANON_KEY || '';
  var configured = URL.indexOf('http') === 0 && KEY && KEY.indexOf('__') !== 0;
  var client = (configured && window.supabase && window.supabase.createClient) ? window.supabase.createClient(URL, KEY) : null;

  var LC = { client: client, configured: configured, notConfiguredMsg: 'Backend not connected yet.' };

  LC.joinBeta = function (btn) {
    var input = btn.previousElementSibling;
    var email = input && input.value ? input.value.trim() : '';
    if (!email || email.indexOf('@') < 1) { if (input) { input.focus(); input.style.borderColor = 'var(--brand-2)'; } return; }
    if (!LC.client) { btn.textContent = "You're on the list ✓"; btn.disabled = true; if (input) input.disabled = true; return; }
    btn.disabled = true; var original = btn.textContent; btn.textContent = 'Saving…';
    LC.client.from('signups').insert({ email: email, source: 'beta_page' }).then(function (res) {
      if (res.error && res.error.code !== '23505') { btn.disabled = false; btn.textContent = original; alert('Something went wrong. Please try again.'); return; }
      try { fetch('/api/beta-confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) }).catch(function(){}); } catch (e) {}
      btn.textContent = "You're on the list ✓"; if (input) input.disabled = true;
    });
  };
  window.joinBeta = LC.joinBeta;

  LC.submitContact = function (form) {
    var name = form.name.value.trim(), email = form.email.value.trim(), message = form.message.value.trim();
    var status = form.querySelector('.lc-status');
    if (!name || !email || email.indexOf('@') < 1 || !message) { if (status) { status.textContent = 'Please fill in every field with a valid email.'; status.style.color = '#c0392b'; } return false; }
    if (!LC.client) { if (status) { status.textContent = LC.notConfiguredMsg; status.style.color = '#c0392b'; } return false; }
    var btn = form.querySelector('button[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    LC.client.from('contacts').insert({ name: name, email: email, message: message }).then(function (res) {
      if (res.error) { if (status) { status.textContent = "Couldn't send. Please try again."; status.style.color = '#c0392b'; } if (btn) { btn.disabled = false; btn.textContent = 'Send message'; } return; }
      form.reset(); if (status) { status.textContent = "Thanks — your message has been sent. We'll be in touch."; status.style.color = 'var(--brand)'; } if (btn) { btn.textContent = 'Sent ✓'; }
    });
    return false;
  };

  LC.signUp = function (email, password, fullName) { return LC.client.auth.signUp({ email: email, password: password, options: { data: { full_name: fullName } } }); };
  LC.signIn = function (email, password) { return LC.client.auth.signInWithPassword({ email: email, password: password }); };
  LC.signOut = function () { return LC.client.auth.signOut(); };
  LC.getUser = function () { return LC.client.auth.getUser(); };
  LC.resetPassword = function (email) { return LC.client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/account' }); };

  /* ---------- login avatar in the nav ---------- */
  function initials(name, email) {
    var s = (name || '').trim();
    if (s) { var p = s.split(/\s+/); return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase(); }
    return (email || '?').slice(0, 2).toUpperCase();
  }
  LC.renderNav = function () {
    if (!LC.client) return;
    LC.client.auth.getSession().then(function (res) {
      var session = res.data ? res.data.session : null;
      var slot = document.querySelector('.nav-right');
      if (!slot) return;
      var loginLink = slot.querySelector('.nav-login');
      if (session && session.user) {
        if (slot.querySelector('.avatar-wrap')) return;
        if (loginLink) loginLink.remove();
        var u = session.user, meta = u.user_metadata || {};
        var name = meta.full_name || '', email = u.email || '', photo = meta.avatar_url || '';
        var avInner = photo ? '<img src="' + photo + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' : initials(name, email);
        var wrap = document.createElement('div');
        wrap.className = 'avatar-wrap';
        wrap.innerHTML =
          '<div class="avatar" title="Account" style="overflow:hidden">' + avInner + '</div>' +
          '<div class="avatar-menu">' +
          '<div class="who"><div class="nm">' + (name || 'Founder') + '</div><div class="em">' + email + '</div></div>' +
          '<a href="account.html">Your account</a>' +
          '<button type="button" data-signout>Sign out</button>' +
          '</div>';
        slot.insertBefore(wrap, slot.firstChild);
        var av = wrap.querySelector('.avatar'), menu = wrap.querySelector('.avatar-menu');
        av.addEventListener('click', function (e) { e.stopPropagation(); menu.classList.toggle('open'); });
        document.addEventListener('click', function () { menu.classList.remove('open'); });
        wrap.querySelector('[data-signout]').addEventListener('click', function () { LC.signOut().then(function () { location.href = 'index.html'; }); });
      } else if (loginLink) {
        loginLink.setAttribute('href', 'login.html');
      }
    });
  };

  window.LC = LC;
  document.addEventListener('DOMContentLoaded', LC.renderNav);
})();
