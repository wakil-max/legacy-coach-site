/* Legacy Foundry — shared site script.
   Load order per page: supabase CDN, config.js, site.js */
(function () {
  /* ---------- global mobile nav polish (injected so every page benefits) ---------- */
  try {
    var mq = document.createElement('style');
    mq.textContent =
      'html,body{max-width:100%;overflow-x:hidden}' +
      'img,video,iframe{max-width:100%}' +
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

  /* ---------- consistent rich footer (site-wide) ---------- */
  function enhanceFooter() {
    var foot = document.querySelector('footer');
    if (!foot || foot.getAttribute('data-lc-foot')) return;
    foot.setAttribute('data-lc-foot', '1');

    var SOC = [
      ['Facebook', 'https://www.facebook.com/profile.php?id=61590857663977', '<path d="M14 8.5h2V5.7h-2.3C11 5.7 10 7 10 9v1.5H8V13h2v6h2.8v-6h2.1l.4-2.5h-2.5V9.2c0-.5.2-.7.8-.7z"/>'],
      ['X', 'https://x.com/LegacyFoundry_', '<path d="M13.6 10.7L19 5h-1.5l-4.6 4.9L9 5H5l5.7 8L5 19h1.5l4.9-5.2L15 19h4l-5.4-8.3zm-1.7 1.9l-.6-.8L7 6.1h1.8l3.6 5 .6.8 4.7 6.5h-1.8l-3.9-5.4z"/>'],
      ['LinkedIn', 'https://www.linkedin.com/company/131333988/', '<path d="M8.3 18H5.7V9.5h2.6V18zM7 8.3a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM18.3 18h-2.6v-4.4c0-1.1-.4-1.8-1.4-1.8-.8 0-1.2.5-1.4 1-.1.2-.1.5-.1.8V18H10.2s0-7.6 0-8.5h2.6v1.2c.3-.5 1-1.3 2.4-1.3 1.8 0 3.1 1.1 3.1 3.6V18z"/>'],
      ['YouTube', 'https://www.youtube.com/@LegacyFoundryAI', '<path d="M20.5 9s-.2-1.2-.7-1.7c-.7-.7-1.4-.7-1.7-.8C15.9 6.3 12 6.3 12 6.3s-3.9 0-6.1.2c-.3 0-1 0-1.7.8C3.7 7.8 3.5 9 3.5 9S3.3 10.4 3.3 11.8v1.3C3.3 14.6 3.5 16 3.5 16s.2 1.2.7 1.7c.7.7 1.6.7 2 .8 1.5.1 5.8.2 5.8.2s3.9 0 6.1-.2c.3 0 1 0 1.7-.8.5-.5.7-1.7.7-1.7s.2-1.4.2-2.8v-1.3C20.7 10.4 20.5 9 20.5 9zM10.4 14.6V9.9l4 2.4-4 2.3z"/>']
    ];
    var social = SOC.map(function (s) {
      return '<a href="' + s[1] + '" target="_blank" rel="noopener noreferrer" aria-label="' + s[0] + '" title="' + s[0] + '"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + s[2] + '</svg></a>';
    }).join('');

    function col(title, links) {
      return '<div class="lc-col"><h4>' + title + '</h4>' +
        links.map(function (l) { return '<a href="' + l[1] + '">' + l[0] + '</a>'; }).join('') + '</div>';
    }

    var st = document.createElement('style');
    st.textContent =
      'footer[data-lc-foot]{background:var(--ink,#0c0e0d);color:#9fb3ab;border-top:1px solid rgba(255,255,255,.08);padding:54px 0 30px;font-size:14px}' +
      '.lc-fwrap{max-width:1140px;margin:0 auto;padding:0 24px}' +
      '.lc-ftop{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:36px}' +
      '.lc-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:17px;color:#fff}' +
      '.lc-brand .lf{width:30px;height:30px;border-radius:8px;background:#fff;color:#075c40;display:grid;place-items:center;font-size:13px;font-weight:800}' +
      '.lc-tag{margin:14px 0 16px;max-width:330px;line-height:1.6;color:#9fb3ab}' +
      '.lc-social{display:flex;gap:10px}' +
      '.lc-social a{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(255,255,255,.18);color:#cfe0d8;opacity:.85;transition:.18s}' +
      '.lc-social a:hover{opacity:1;background:rgba(16,168,118,.22);border-color:#10a876;color:#fff}' +
      '.lc-col h4{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6f827b;margin-bottom:14px}' +
      '.lc-col a{display:block;color:#c2cfc9;margin-bottom:11px;transition:.15s}.lc-col a:hover{color:#fff}' +
      '.lc-fbot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:38px;padding-top:22px;border-top:1px solid rgba(255,255,255,.08);font-size:13px}' +
      '.lc-fbot a{color:inherit;text-decoration:underline;text-underline-offset:2px}.lc-fbot a:hover{color:#fff}' +
      '@media(max-width:760px){.lc-ftop{grid-template-columns:1fr 1fr;gap:28px}.lc-brand-col{grid-column:1/-1}}';
    document.head.appendChild(st);

    foot.innerHTML =
      '<div class="lc-fwrap">' +
        '<div class="lc-ftop">' +
          '<div class="lc-brand-col">' +
            '<a href="index.html" class="lc-brand"><span class="lf">LF</span> Legacy Foundry</a>' +
            '<p class="lc-tag">The AI coach for founders and entrepreneurs — a daily rhythm that turns ambition into shipped work. Built by Legacy Ventures &amp; Onnorokom Group.</p>' +
            '<div class="lc-social">' + social + '</div>' +
          '</div>' +
          col('Product', [['How it works', 'how-it-works.html'], ['Getting started', 'getting-started.html'], ['Features', 'features.html'], ['Blog', 'blog.html']]) +
          col('Company', [['About', 'about.html'], ['Contact', 'contact.html']]) +
          col('Get started', [['Join the beta', 'beta.html'], ['Log in', 'login.html']]) +
        '</div>' +
        '<div class="lc-fbot">' +
          '<span>© 2026 Legacy Foundry · Legacy Ventures · Onnorokom Group. All rights reserved.</span>' +
          '<span><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a></span>' +
        '</div>' +
      '</div>';
  }

  document.addEventListener('DOMContentLoaded', function () { LC.renderNav(); enhanceFooter(); });
})();
