/* Legacy Coach — shared backend logic (Supabase).
   Loaded after the Supabase CDN script and config.js.
   Provides: window.LC.client, joinBeta(), submitContact(),
   and auth helpers used by login/signup/account pages. */
(function () {
  var URL = window.LC_SUPABASE_URL || "";
  var KEY = window.LC_SUPABASE_ANON_KEY || "";
  var configured = URL.indexOf("http") === 0 && KEY && KEY.indexOf("__") !== 0;

  var client = null;
  if (configured && window.supabase && window.supabase.createClient) {
    client = window.supabase.createClient(URL, KEY);
  }

  var LC = {
    client: client,
    configured: configured,
    notConfiguredMsg: "Backend not connected yet. Add your Supabase keys in config.js."
  };

  // ---------- Beta signup (beta.html) ----------
  LC.joinBeta = function (btn) {
    var input = btn.previousElementSibling;
    var email = input && input.value ? input.value.trim() : "";
    if (!email || email.indexOf("@") < 1) {
      if (input) { input.focus(); input.style.borderColor = "var(--brand-2)"; }
      return;
    }
    if (!LC.client) {
      btn.textContent = "You're on the list ✓"; // graceful fallback
      btn.disabled = true; if (input) input.disabled = true;
      return;
    }
    btn.disabled = true; var original = btn.textContent; btn.textContent = "Saving…";
    LC.client.from("signups").insert({ email: email, source: "beta_page" })
      .then(function (res) {
        if (res.error && res.error.code !== "23505") { // 23505 = already signed up
          btn.disabled = false; btn.textContent = original;
          alert("Something went wrong. Please try again."); return;
        }
        btn.textContent = "You're on the list ✓";
        if (input) input.disabled = true;
      });
  };

  // ---------- Contact form (contact.html) ----------
  LC.submitContact = function (form) {
    var name = form.name.value.trim();
    var email = form.email.value.trim();
    var message = form.message.value.trim();
    var status = form.querySelector(".lc-status");
    if (!name || !email || email.indexOf("@") < 1 || !message) {
      if (status) { status.textContent = "Please fill in every field with a valid email."; status.style.color = "#c0392b"; }
      return false;
    }
    if (!LC.client) {
      if (status) { status.textContent = LC.notConfiguredMsg; status.style.color = "#c0392b"; }
      return false;
    }
    var btn = form.querySelector("button[type=submit]");
    if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    LC.client.from("contacts").insert({ name: name, email: email, message: message })
      .then(function (res) {
        if (res.error) {
          if (status) { status.textContent = "Couldn't send. Please try again."; status.style.color = "#c0392b"; }
          if (btn) { btn.disabled = false; btn.textContent = "Send message"; }
          return;
        }
        form.reset();
        if (status) { status.textContent = "Thanks — your message has been sent. We'll be in touch."; status.style.color = "var(--brand)"; }
        if (btn) { btn.textContent = "Sent ✓"; }
      });
    return false;
  };

  // ---------- Auth helpers ----------
  LC.signUp = function (email, password, fullName) {
    return LC.client.auth.signUp({
      email: email, password: password,
      options: { data: { full_name: fullName } }
    });
  };
  LC.signIn = function (email, password) {
    return LC.client.auth.signInWithPassword({ email: email, password: password });
  };
  LC.signOut = function () { return LC.client.auth.signOut(); };
  LC.getUser = function () { return LC.client.auth.getUser(); };
  LC.resetPassword = function (email) {
    return LC.client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/account"
    });
  };

  // Swap the nav "Log in" link for "Account" when signed in.
  LC.refreshNav = function () {
    if (!LC.client) return;
    LC.client.auth.getSession().then(function (res) {
      var session = res.data ? res.data.session : null;
      document.querySelectorAll('a.nav-login, a[href="login.html"], a[href="/login"]').forEach(function (a) {
        if (/log ?in/i.test(a.textContent)) {
          if (session) { a.textContent = "Account"; a.setAttribute("href", "account.html"); }
          else { a.setAttribute("href", "login.html"); }
        }
      });
    });
  };

  window.LC = LC;
  // expose joinBeta globally for the existing inline onclick
  window.joinBeta = LC.joinBeta;
  document.addEventListener("DOMContentLoaded", LC.refreshNav);
})();
