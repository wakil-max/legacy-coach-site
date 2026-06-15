/* ============================================================
   Legacy Foundry — app logic (PWA)
   Backend: Supabase (from /config.js). AI: Gemini (key in settings) or demo.
   ============================================================ */
(function () {
'use strict';

// ---------- Supabase ----------
var URL = window.LC_SUPABASE_URL || '', KEY = window.LC_SUPABASE_ANON_KEY || '';
var sb = (URL && KEY && window.supabase) ? window.supabase.createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

// ---------- state ----------
var S = { user: null, profile: null, goals: [], goal: null, moves: [], habits: [], tab: 'home' };
var GKEY = function(){ return localStorage.getItem('lf_gemini_key') || ''; };

// ---------- helpers ----------
var $ = function (id) { return document.getElementById(id); };
var root = $('root');
function esc(s){ s=(s==null?'':''+s); return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function el(html){ var d=document.createElement('div'); d.innerHTML=html; return d.firstElementChild; }
function toast(m){ var t=$('toast'); t.textContent=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('on');},2200); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function firstName(){ var n=(S.profile&&S.profile.full_name)||''; return n.split(/\s+/)[0]||'founder'; }
function initials(){ var n=(S.profile&&S.profile.full_name)||(S.user&&S.user.email)||'LF'; var p=n.trim().split(/\s+/); return ((p[0]?p[0][0]:'')+(p[1]?p[1][0]:'')||n.slice(0,2)).toUpperCase(); }

var ICON = {
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  sessions:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  coach:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.2A8 8 0 1 1 21 12Z"/></svg>',
  mentor:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"/></svg>',
  habit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>'
};

// ---------- AI (OpenAI via Edge Function or device key; demo fallback) ----------
// Maps an app mode to a key in prompts.js (window.LF_PROMPTS)
function modeKey(mode){
  return ({ morning:'daily', evening:'evening', weekly:'weekly', monthly:'monthly',
            instant:'coaching', quick:'quick', onboarding:'onboarding', goal:'goal_setting' })[mode] || 'coaching';
}
// Fills {placeholders} in a prompt with the founder's live context
function fillPrompt(t){
  var p=S.profile||{}, g=S.goal;
  var map={
    name:firstName(), company:p.company||'their company', role:p.role||'founder',
    stage:p.stage||'early stage', building:p.building||'their business',
    goal: g ? ('"'+g.title+'"'+(g.duration_months?(' ('+g.duration_months+'-month goal'+(g.target_month?', target '+g.target_month:'')+')'):'')) : 'no goal set yet',
    mentor: p.mentor_style||'Strategist',
    date: new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})
  };
  return (t||'').replace(/\{(\w+)\}/g,function(_,k){ return (k in map)?map[k]:('{'+k+'}'); });
}
function systemPrompt(mode){
  var PR = window.LF_PROMPTS || {};
  var base = fillPrompt(PR.base || "You are the Legacy Foundry coach for founders. Lead with one question at a time, keep replies short, stay on their business.");
  var modeText = fillPrompt(PR[modeKey(mode)] || '');
  return base + (modeText ? ("\n\n"+modeText) : "");
}

function demoReply(mode, history){
  var n=firstName();
  var goal = S.goal ? S.goal.title : null;
  var turns = (history||[]).filter(function(m){return m.role==='user';}).length;
  if(mode==='morning'){
    if(turns===0) return "Morning, "+n+". Before we plan the day — what's the one outcome that would make today a win for your business?";
    if(turns===1) return "Good. If you only finished one thing today, what should it be? Let's make that move #1.";
    return "Nice — that's a clear set of moves. Which one will you start with, and when?";
  }
  if(mode==='evening'){
    if(turns===0) return "Let's close the day, "+n+". What's one thing you got done today?";
    if(turns===1) return "Good. And what got in the way — something to watch tomorrow?";
    return "Noted. What's the first move you want to line up for tomorrow morning?";
  }
  if(mode==='weekly'){
    if(turns===0) return "Weekly check-in. Looking at "+(goal?('“'+goal+'”'):"your goal")+", what actually moved this week?";
    return "Got it. What's the single focus that would make next week count?";
  }
  if(mode==='monthly'){
    if(turns===0) return "Monthly review. Compared to a month ago, are you closer to "+(goal?('“'+goal+'”'):"your goal")+"? What changed?";
    return "Understood. If next month had one theme, what would it be?";
  }
  if(mode==='instant'){
    if(turns===0) return "I'm here, "+n+". What's the most pressing thing on your plate right now?";
    return "Okay. What feels like the real blocker underneath that?";
  }
  // quick chat
  if(turns<=1) return "Hey "+n+" — what's on your mind for the business today?";
  return "Got it. What outcome are you aiming for, and what's the next concrete step toward it?";
}

function coachUrl(){ return (window.LF_COACH_URL || localStorage.getItem('lf_coach_url') || '').trim(); }
function openaiKey(){ return (localStorage.getItem('lf_openai_key') || '').trim(); }
function aiConfigured(){ return !!(coachUrl() || openaiKey()); }
function aiReply(mode, history){
  var sys = systemPrompt(mode);
  var msgs = history.slice(-24).map(function(m){ return { role: m.role==='coach'?'assistant':'user', content:m.content }; });
  if(!msgs.length || msgs[msgs.length-1].role!=='user'){ msgs.push({ role:'user', content:'Begin the session.' }); }
  var url = coachUrl();
  // 1) Secure proxy (Supabase Edge Function) — recommended for the published app
  if(url){
    return fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ system:sys, messages:msgs, mode:mode }) })
      .then(function(r){ return r.json(); }).then(function(d){
        var t = d && (d.text || d.reply || (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content));
        if(t) return { text:t };
        return { text: "Couldn't get a reply from the coach service just now. What's the next concrete step for your business?", demo:true };
      }).catch(function(){ return { text:"Network issue reaching the coach. What's the most important move right now?", demo:true }; });
  }
  // 2) Direct OpenAI with a device key (for the owner to test now)
  var key = openaiKey();
  if(key){
    return fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
      body: JSON.stringify({ model:'gpt-4o-mini', temperature:0.7, max_tokens:500, messages:[{role:'system',content:sys}].concat(msgs) })
    }).then(function(r){ return r.json(); }).then(function(d){
      if(d && d.choices && d.choices[0] && d.choices[0].message){ return { text: d.choices[0].message.content }; }
      var err = (d && d.error && d.error.message) ? d.error.message : 'No response';
      return { text: "Couldn't reach the AI ("+err+"). Check your OpenAI key in Profile. Meanwhile — what's the next step for your business?", demo:true };
    }).catch(function(){ return { text:"Network issue reaching the AI. What's the most important move right now?", demo:true }; });
  }
  // 3) Demo (no key yet)
  return Promise.resolve({ text: demoReply(mode, history), demo:true });
}

// ---------- data ----------
function loadProfile(){
  return sb.from('profiles').select('*').eq('id', S.user.id).single().then(function(r){
    S.profile = (r&&r.data)?r.data:{};
    // fall back to auth metadata for any missing fields
    var m = S.user.user_metadata||{};
    ['full_name','role','company','stage','building','avatar_url','mentor_style'].forEach(function(k){ if(!S.profile[k] && m[k]) S.profile[k]=m[k]; });
    return S.profile;
  }, function(){ S.profile = S.user.user_metadata||{}; return S.profile; });
}
function loadGoals(){ return sb.from('goals').select('*').eq('status','active').order('created_at',{ascending:false}).then(function(r){ S.goals=(r&&r.data)||[]; S.goal=S.goals[0]||null; return S.goals; }, function(){S.goals=[];}); }
function loadMoves(){ return sb.from('moves').select('*').eq('day',todayStr()).order('created_at',{ascending:true}).then(function(r){ S.moves=(r&&r.data)||[]; }, function(){S.moves=[];}); }
function loadHabits(){ return sb.from('habits').select('*').order('created_at',{ascending:true}).then(function(r){ S.habits=(r&&r.data)||[]; }, function(){S.habits=[];}); }

// ============================================================
//  AUTH
// ============================================================
function authView(signup){
  document.body.style.background='#071d16';
  root.classList.remove('app'); root.innerHTML='';
  var v = el('<div class="auth"></div>');
  v.innerHTML =
    '<div class="logo"><span class="lf">LF</span> Legacy Foundry</div>'+
    '<h1>'+(signup?'Create your account':'Welcome back')+'</h1>'+
    '<p class="sub">'+(signup?'Your AI coach for the long game.':'Your coach is ready when you are.')+'</p>'+
    (signup?'<div class="field"><input class="inp" id="a_name" type="text" placeholder="Full name" autocomplete="name"></div>':'')+
    '<div class="field"><input class="inp" id="a_email" type="email" placeholder="Email" autocomplete="email"></div>'+
    '<div class="field"><input class="inp" id="a_pass" type="password" placeholder="Password" autocomplete="'+(signup?'new-password':'current-password')+'"></div>'+
    '<div class="status" id="a_status"></div>'+
    '<button class="btn" id="a_go">'+(signup?'Create account':'Log in')+'</button>'+
    '<div class="toggle">'+(signup?'Already have an account? <b id="a_t">Log in</b>':'New here? <b id="a_t">Create one</b>')+'</div>';
  root.classList.add('hidden'); document.body.appendChild(v); root._auth=v;
  // mount
  $('boot').classList.add('hidden');
  v.querySelector('#a_t').onclick=function(){ v.remove(); authView(!signup); };
  var go=v.querySelector('#a_go'); var st=v.querySelector('#a_status');
  go.onclick=function(){
    var email=(v.querySelector('#a_email').value||'').trim(), pass=v.querySelector('#a_pass').value;
    if(!email||email.indexOf('@')<1){ st.textContent='Enter a valid email.'; return; }
    if(!pass||pass.length<6){ st.textContent='Password must be at least 6 characters.'; return; }
    if(!sb){ st.textContent='Backend not connected.'; return; }
    go.disabled=true; go.textContent='Please wait…'; st.textContent='';
    if(signup){
      var name=(v.querySelector('#a_name').value||'').trim();
      sb.auth.signUp({ email:email, password:pass, options:{ data:{ full_name:name } } }).then(function(res){
        go.disabled=false; go.textContent='Create account';
        if(res.error){ st.textContent=res.error.message; return; }
        if(res.data.session){ v.remove(); boot(); }
        else { st.style.color='#9af0cf'; st.textContent='Check your email to confirm, then log in.'; }
      });
    } else {
      sb.auth.signInWithPassword({ email:email, password:pass }).then(function(res){
        go.disabled=false; go.textContent='Log in';
        if(res.error){ st.textContent=res.error.message; return; }
        v.remove(); boot();
      });
    }
  };
}

// ============================================================
//  ONBOARDING (saves every step -> resume)
// ============================================================
var ONB_STEPS = [
  { k:'full_name', q:"What's your name?", ph:'Jane Founder', type:'text',
    coach:function(d){ return "Hi — I'm your Legacy Foundry coach 👋 I'll be in your corner every day. Let's get to know each other in under a minute. First, what should I call you?"; } },
  { k:'company', q:"Your company or project", ph:'Acme Inc.', type:'text',
    coach:function(d){ return "Great to meet you, "+(d.full_name||'founder').split(/\s+/)[0]+". What's the company or project you're building?"; } },
  { k:'role', q:"Your role", ph:'Founder & CEO', type:'text',
    coach:function(d){ return "And what's your role at "+(d.company||'your company')+"?"; } },
  { k:'stage', q:"Pick your stage", type:'choice', opts:['Just an idea','Building MVP','Launched / early traction','Growing / scaling','Established'],
    coach:function(d){ return "Where are you in the journey right now?"; } },
  { k:'building', q:"In one line, what are you building?", ph:'An AI tutor for students', type:'text',
    coach:function(d){ return "Tell me in one line — what are you actually building?"; } },
  { k:'focus', q:"What matters most right now?", type:'choice', opts:['Shipping faster','Getting customers','Staying consistent','Beating overwhelm','Fundraising'],
    coach:function(d){ return "Last one, "+(d.full_name||'').split(/\s+/)[0]+". Right now, what matters most to you?"; } }
];
function onbDraft(){ try{ return JSON.parse(localStorage.getItem('lf_onb')||'{}'); }catch(e){ return {}; } }
function onbSave(d){ localStorage.setItem('lf_onb', JSON.stringify(d)); }

function onboarding(){
  document.body.style.background='#071d16';
  var d = onbDraft();
  // prefill from profile/metadata
  var pm = S.user.user_metadata||{};
  ['full_name','company','role','stage','building'].forEach(function(k){ if(!d[k] && pm[k]) d[k]=pm[k]; });
  var i = typeof d._step==='number'?d._step:0;
  if(i>=ONB_STEPS.length) i=ONB_STEPS.length-1;
  root.innerHTML=''; root.classList.add('hidden');
  var old=document.querySelector('.auth'); if(old) old.remove();
  var v = el('<div class="auth"></div>'); document.body.appendChild(v); $('boot').classList.add('hidden');
  function render(){
    var step=ONB_STEPS[i];
    var dots=ONB_STEPS.map(function(_,x){ return '<span style="width:'+(x===i?22:8)+'px;height:8px;border-radius:99px;background:'+(x<=i?'#10a876':'rgba(255,255,255,.25)')+';display:inline-block"></span>'; }).join(' ');
    var coachLine = (typeof step.coach==='function') ? step.coach(d) : step.q;
    v.innerHTML='<div class="logo"><span class="lf">LF</span> Legacy Foundry</div>'+
      '<div style="display:flex;gap:6px;margin-bottom:16px">'+dots+'</div>'+
      '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px">'+
        '<div style="width:34px;height:34px;border-radius:50%;background:#fff;color:#075c40;display:grid;place-items:center;font-weight:800;flex:none;font-size:13px">LF</div>'+
        '<div style="background:rgba(255,255,255,.12);color:#eafaf3;border:1px solid rgba(255,255,255,.14);border-radius:16px;border-top-left-radius:5px;padding:12px 14px;font-size:15.5px;line-height:1.5">'+esc(coachLine)+'</div>'+
      '</div>'+
      '<p class="sub" style="margin-bottom:10px">Step '+(i+1)+' of '+ONB_STEPS.length+' · saved as you go, so you can stop and come back any time.</p>'+
      (step.type==='text'
        ? '<div class="field"><input class="inp" id="o_in" type="text" placeholder="'+esc(step.ph||'')+'" value="'+esc(d[step.k]||'')+'"></div>'
        : '<div id="o_opts">'+step.opts.map(function(o){ return '<button class="btn sec" data-o="'+esc(o)+'" style="justify-content:flex-start;margin-bottom:8px;'+(d[step.k]===o?'border-color:#10a876;background:rgba(16,168,118,.18);color:#fff':'')+'">'+esc(o)+'</button>'; }).join('')+'</div>')+
      '<button class="btn" id="o_next" style="margin-top:8px">'+(i===ONB_STEPS.length-1?'Finish':'Continue')+'</button>'+
      (i>0?'<button class="btn sec" id="o_back" style="margin-top:10px;background:transparent;color:#cdeede;border-color:rgba(255,255,255,.2)">Back</button>':'');
    var input=v.querySelector('#o_in');
    if(input){ input.oninput=function(){ d[step.k]=input.value; d._step=i; onbSave(d); }; setTimeout(function(){input.focus();},60); }
    if(step.type==='choice'){ v.querySelectorAll('[data-o]').forEach(function(b){ b.onclick=function(){ d[step.k]=b.getAttribute('data-o'); d._step=i; onbSave(d); render(); }; }); }
    v.querySelector('#o_next').onclick=function(){
      if(step.type==='text'){ var val=(v.querySelector('#o_in').value||'').trim(); if(!val){ toast('Please fill this in'); return; } d[step.k]=val; }
      else if(!d[step.k]){ toast('Pick one'); return; }
      d._step=i+1; onbSave(d);
      if(i<ONB_STEPS.length-1){ i++; render(); } else finish();
    };
    var bk=v.querySelector('#o_back'); if(bk) bk.onclick=function(){ i--; d._step=i; onbSave(d); render(); };
  }
  function finish(){
    var btn=v.querySelector('#o_next'); btn.disabled=true; btn.textContent='Setting up…';
    var payload={ id:S.user.id, full_name:d.full_name, company:d.company, role:d.role, stage:d.stage, building:d.building, onboarded:true, onboarding:d, updated_at:new Date().toISOString() };
    function done(){ localStorage.removeItem('lf_onb'); localStorage.setItem('lf_onb_done_'+S.user.id,'1'); if(S.profile){S.profile.onboarded=true;} sb.auth.updateUser({ data:{ full_name:d.full_name, company:d.company, role:d.role, stage:d.stage, building:d.building } }); v.remove(); boot(); }
    sb.from('profiles').upsert(payload).then(function(res){ done(); }, function(){ done(); });
  }
  render();
}

// ============================================================
//  MAIN APP SHELL
// ============================================================
function shell(){
  document.body.style.background='var(--paper)';
  var old=document.querySelector('.auth'); if(old) old.remove();
  root.classList.remove('hidden'); root.classList.add('app');
  root.innerHTML =
    '<div id="screens"></div>'+
    '<nav class="nav" id="nav">'+
      tabBtn('home','Home')+tabBtn('sessions','Sessions')+tabBtn('coach','Coach')+tabBtn('mentor','Mentor')+tabBtn('habit','Habits')+
    '</nav>'+
    '<div class="sheet" id="sheet"><div class="sheetcard" id="sheetcard"></div></div>';
  $('boot').classList.add('hidden');
  $('nav').querySelectorAll('button').forEach(function(b){ b.onclick=function(){ go(b.getAttribute('data-t')); }; });
  $('sheet').onclick=function(e){ if(e.target===$('sheet')) closeSheet(); };
  go('home');
}
function tabBtn(t,label){ return '<button data-t="'+t+'">'+ICON[t]+'<span>'+label+'</span></button>'; }
function setActiveTab(t){ $('nav').querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-t')===t); }); }
function screen(html){ $('screens').innerHTML='<div class="screen on">'+html+'</div>'; }
function topbar(title){ return '<div class="top"><div class="ttl">'+esc(title)+'</div><button class="av" id="avBtn">'+(S.profile&&S.profile.avatar_url?'<img src="'+S.profile.avatar_url+'">':esc(initials()))+'</button></div>'; }
function wireTop(){ var a=$('avBtn'); if(a) a.onclick=profileSheet; }

function go(t){ S.tab=t; setActiveTab(t);
  if(t==='home') return homeView();
  if(t==='sessions') return sessionsView();
  if(t==='coach') return coachHome();
  if(t==='mentor') return mentorView();
  if(t==='habit') return habitView();
}

// ---------- HOME ----------
function homeView(){
  loadGoals().then(function(){
    var g=S.goal;
    var hh=new Date().getHours();
    var greet = hh<12?'Good morning':hh<17?'Good afternoon':'Good evening';
    var prog = g?goalProgress(g):0;
    var html = topbar('Legacy Foundry')+'<div class="screen on" style="padding-top:6px">';
    html += '<div class="hi">'+greet+', '+esc(firstName())+'.</div><div class="sub2">'+new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})+'</div>';
    if(!aiConfigured()) html += '<div class="banner" style="margin-top:12px">Add your OpenAI key in <a id="bk_set">Profile</a> to turn on full AI coaching.</div>';
    if(g){
      html += '<div class="card goalcard"><div class="lab">Active goal'+(g.duration_months?' · '+g.duration_months+' month'+(g.duration_months>1?'s':''):'')+'</div><h3>'+esc(g.title)+'</h3>'+
        '<div class="bar"><i style="width:'+prog+'%"></i></div>'+
        '<div class="stats"><div><b>'+prog+'%</b>on track</div><div><b>'+streakCount()+'</b>day streak</div><div><b>'+(g.target_month||'—')+'</b>target</div></div></div>';
    } else {
      html += '<div class="card" style="margin:14px 0;text-align:center"><h3 style="font-size:17px;margin-bottom:6px">Set your first goal</h3><p class="muted" style="font-size:13.5px;margin-bottom:12px">One clear goal your coach guides you toward every day.</p><button class="btn" id="newGoal">+ Create a goal</button></div>';
    }
    html += '<div class="sectt">Start a session</div><div class="sgrid">'+
      sCard('morning','🌅','Morning','Plan your focus','#fff3e0')+
      sCard('evening','🌙','Evening','Reflect & close the day','#ede7f6')+
      sCard('weekly','📈','Weekly','Zoom out & adjust','#e3f2fd')+
      sCard('monthly','🗓️','Monthly','The bigger picture','#e8f5e9')+'</div>';
    html += '<button class="btn ghost" id="quickBtn" style="margin-top:14px">💬 Quick chat with your coach</button>';
    html += '<div style="margin-top:18px"></div></div>';
    screen(''); $('screens').innerHTML=html; wireTop();
    var bk=$('bk_set'); if(bk) bk.onclick=profileSheet;
    var ng=$('newGoal'); if(ng) ng.onclick=goalSheet;
    var qb=$('quickBtn'); if(qb) qb.onclick=function(){ go('coach'); };
    $('screens').querySelectorAll('[data-sess]').forEach(function(c){ c.onclick=function(){ startSession(c.getAttribute('data-sess')); }; });
  });
}
function sCard(kind,ic,h,p,bg){ return '<button class="scard" data-sess="'+kind+'"><div class="ic" style="background:'+bg+'">'+ic+'</div><h4>'+h+'</h4><p>'+p+'</p></button>'; }
function goalProgress(g){ if(!g) return 0; var start=new Date(g.created_at).getTime(); var months=g.duration_months||3; var end=start+months*30*864e5; var now=Date.now(); var p=Math.round((now-start)/(end-start)*100); return Math.max(2,Math.min(99,p)); }
function streakCount(){ return parseInt(localStorage.getItem('lf_streak_'+(S.user&&S.user.id))||'1',10); }

function toggleMove(id){ var m=S.moves.find(function(x){return x.id===id;}); if(!m) return; m.done=!m.done; sb.from('moves').update({done:m.done}).eq('id',id).then(function(){}); homeView(); }
function addMoveSheet(){ openSheet('<h3>Add a move</h3><p class="muted" style="font-size:13px;margin-bottom:12px">A concrete action for today.</p><div class="field"><input class="inp" id="mv_t" placeholder="e.g. Ship the pricing page"></div><button class="btn" id="mv_go">Add move</button>');
  setTimeout(function(){var i=$('mv_t');if(i)i.focus();},80);
  $('mv_go').onclick=function(){ var t=($('mv_t').value||'').trim(); if(!t){toast('Type a move');return;} sb.from('moves').insert({ text:t, day:todayStr(), goal_id:S.goal?S.goal.id:null }).then(function(){ closeSheet(); homeView(); }); };
}

// ---------- GOAL SHEET ----------
function goalSheet(){
  var dur=3, tm='';
  var months=[]; var now=new Date();
  for(var i=0;i<7;i++){ var dd=new Date(now.getFullYear(),now.getMonth()+i,1); months.push({v:dd.toISOString().slice(0,7), l:dd.toLocaleDateString(undefined,{month:'short',year:'numeric'})}); }
  openSheet('<h3>Create a goal</h3><p class="muted" style="font-size:13px;margin-bottom:12px">One clear goal for the months ahead.</p>'+
    '<div class="field"><label>Goal</label><input class="inp" id="g_t" placeholder="e.g. Get to 100 paying users"></div>'+
    '<div class="field"><label>A little detail (optional)</label><input class="inp" id="g_d" placeholder="Why it matters / what success looks like"></div>'+
    '<div class="field"><label>How many months?</label><div class="dur" id="g_dur">'+[1,2,3,4,5,6].map(function(n){return '<button data-d="'+n+'" class="'+(n===3?'sel':'')+'">'+n+'</button>';}).join('')+'</div></div>'+
    '<div class="field"><label>Target month</label><select class="inp" id="g_m">'+months.map(function(m){return '<option value="'+m.v+'">'+m.l+'</option>';}).join('')+'</select></div>'+
    '<button class="btn" id="g_go">Set goal</button>');
  $('g_dur').querySelectorAll('button').forEach(function(b){ b.onclick=function(){ dur=+b.getAttribute('data-d'); $('g_dur').querySelectorAll('button').forEach(function(x){x.classList.remove('sel');}); b.classList.add('sel'); }; });
  $('g_go').onclick=function(){ var t=($('g_t').value||'').trim(); if(!t){toast('Name your goal');return;} tm=$('g_m').value;
    $('g_go').disabled=true; sb.from('goals').insert({ title:t, detail:($('g_d').value||'').trim(), duration_months:dur, target_month:tm, status:'active' }).then(function(res){ closeSheet(); toast('Goal set 🎯'); go('home'); }, function(){ toast('Could not save'); $('g_go').disabled=false; }); };
}

// ---------- SESSIONS ----------
function sessionsView(){
  var html=topbar('Sessions')+'<div class="screen on" style="padding-top:6px"><p class="muted" style="font-size:14px;margin-bottom:14px">Your daily rhythm. Each session is a short, guided chat with your coach — repeat them any time.</p><div class="sgrid">'+
    sCard('morning','🌅','Morning','Set today\'s 3 moves','#fff3e0')+
    sCard('evening','🌙','Evening','Reflect & close the day','#ede7f6')+
    sCard('weekly','📈','Weekly','Zoom out & adjust','#e3f2fd')+
    sCard('monthly','🗓️','Monthly','The bigger picture','#e8f5e9')+
    '</div><div style="margin-top:10px"></div>'+
    '<button class="btn ghost" id="instant" style="margin-top:8px">⚡ Start an instant session</button>'+
    '<div class="sectt">Recent sessions</div><div id="recent"><div class="empty">Loading…</div></div></div>';
  $('screens').innerHTML=html; wireTop();
  $('screens').querySelectorAll('[data-sess]').forEach(function(c){ c.onclick=function(){ startSession(c.getAttribute('data-sess')); }; });
  $('instant').onclick=function(){ startSession('instant'); };
  sb.from('sessions').select('*').order('created_at',{ascending:false}).limit(10).then(function(r){
    var rows=(r&&r.data)||[]; var c=$('recent'); if(!c) return;
    if(!rows.length){ c.innerHTML='<div class="empty">No sessions yet — start one above.</div>'; return; }
    c.innerHTML=rows.map(function(s){ return '<div class="listitem" data-open="'+s.id+'" data-kind="'+esc(s.kind)+'" style="cursor:pointer"><div class="h">'+cap(s.kind)+' session<span class="muted" style="font-weight:500">'+new Date(s.created_at).toLocaleDateString()+'</span></div>'+(s.summary?'<div class="d">'+esc(s.summary)+'</div>':'')+'</div>'; }).join('');
    c.querySelectorAll('[data-open]').forEach(function(it){ it.onclick=function(){ openChat(it.getAttribute('data-open'), it.getAttribute('data-kind')); }; });
  });
}
function cap(s){ return (s||'').charAt(0).toUpperCase()+(s||'').slice(1); }

function startSession(kind){
  if(!S.goal && (kind==='morning'||kind==='weekly'||kind==='monthly')){ toast('Set a goal first'); goalSheet(); return; }
  sb.from('sessions').insert({ kind:kind, title:cap(kind)+' session' }).select().single().then(function(r){
    if(r&&r.data){ openChat(r.data.id, kind, true); }
    else { toast('Could not start session'); }
  }, function(){ toast('Could not start session'); });
}

// ---------- CHAT ENGINE (sessions + quick) ----------
function openChat(threadId, mode, seed){
  // full-screen chat
  root.innerHTML='<div class="chatwrap">'+
    '<div class="chathead"><button class="bk" id="c_back">‹</button><div><div class="t">'+(mode==='quick'?'Coach — Quick chat':cap(mode)+' session')+'</div><div class="s">'+(mode==='quick'?'Ask about your business':'Legacy Foundry coach')+'</div></div></div>'+
    '<div class="msgs" id="c_msgs"></div>'+
    '<div class="composer"><textarea id="c_in" rows="1" placeholder="Message your coach…"></textarea><button class="send" id="c_send">➤</button></div>'+
    '</div>';
  $('c_back').onclick=function(){ shell(); go(mode==='quick'?'coach':'sessions'); };
  var box=$('c_msgs'); var input=$('c_in'); var send=$('c_send');
  input.oninput=function(){ input.style.height='auto'; input.style.height=Math.min(120,input.scrollHeight)+'px'; };
  function add(role,content){ var m=el('<div class="msg '+(role==='coach'?'coach':'user')+'">'+esc(content)+'</div>'); box.appendChild(m); box.scrollTop=box.scrollHeight; return m; }
  var history=[];
  function persist(role,content){ sb.from('messages').insert({ thread:String(threadId), session_id: mode==='quick'?null:threadId, role:role, content:content }).then(function(){}); }
  function pushHistory(role,content){ history.push({role:role,content:content}); }

  function coachTurn(){
    var typing=el('<div class="msg coach typing">coaching…</div>'); box.appendChild(typing); box.scrollTop=box.scrollHeight;
    aiReply(mode, history).then(function(res){ typing.remove(); add('coach',res.text); pushHistory('coach',res.text); persist('coach',res.text); maybeSummary(); });
  }
  function doSend(){ var t=(input.value||'').trim(); if(!t) return; input.value=''; input.style.height='auto';
    add('user',t); pushHistory('user',t); persist('user',t); coachTurn(); }
  send.onclick=doSend;
  input.onkeydown=function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); doSend(); } };

  function maybeSummary(){ if(mode!=='quick' && history.length===4){ var firstUser=(history.find(function(h){return h.role==='user';})||{}).content||''; sb.from('sessions').update({ summary: firstUser.slice(0,90) }).eq('id',threadId).then(function(){}); } }

  // load existing history (memory), else seed opener
  sb.from('messages').select('*').eq('thread',String(threadId)).order('created_at',{ascending:true}).then(function(r){
    var rows=(r&&r.data)||[];
    if(rows.length){ rows.forEach(function(m){ add(m.role,m.content); pushHistory(m.role,m.content); }); }
    else if(seed){ coachTurn(); } // coach opens the session
    else { var op=demoReply(mode,history); add('coach',op); pushHistory('coach',op); persist('coach',op); }
    setTimeout(function(){ input.focus(); },120);
  }, function(){ if(seed) coachTurn(); });
}

// ---------- COACH (quick chat home) ----------
function coachHome(){
  // quick chat uses a single persistent 'quick' thread
  openChat('quick','quick',false);
  setActiveTab('coach');
}

// ---------- MENTOR ----------
function mentorView(){
  var styles=[ ['Strategist','Sharp & analytical — clarity, priorities, decisions'], ['Guide','Warm & reflective — gentle questions, confidence'], ['Challenger','Direct & provoking — challenges excuses, high bar'] ];
  var cur=(S.profile&&S.profile.mentor_style)||'Strategist';
  var html=topbar('Mentor')+'<div class="screen on" style="padding-top:6px"><p class="muted" style="font-size:14px;margin-bottom:14px">Choose how you want to be met. Your coach adapts its tone and questions to your style.</p>'+
    styles.map(function(s){ return '<button class="mentor '+(s[0]===cur?'sel':'')+'" data-m="'+s[0]+'"><div><h4>'+s[0]+'</h4><p>'+s[1]+'</p></div><div class="rd">'+(s[0]===cur?'✓':'')+'</div></button>'; }).join('')+
    '<button class="btn ghost" id="m_chat" style="margin-top:8px">Talk to your mentor now</button></div>';
  $('screens').innerHTML=html; wireTop();
  $('screens').querySelectorAll('[data-m]').forEach(function(b){ b.onclick=function(){ var v=b.getAttribute('data-m'); S.profile.mentor_style=v; sb.from('profiles').update({mentor_style:v}).eq('id',S.user.id).then(function(){}); sb.auth.updateUser({data:{mentor_style:v}}); mentorView(); toast(v+' selected'); }; });
  $('m_chat').onclick=function(){ startSession('instant'); };
}

// ---------- HABITS ----------
function habitView(){
  Promise.all([loadHabits(), sb.from('habit_logs').select('*').then(function(r){ return (r&&r.data)||[]; }, function(){return [];})]).then(function(res){
    var logs=res[1]; var today=todayStr();
    var byHabit={}; logs.forEach(function(l){ (byHabit[l.habit_id]=byHabit[l.habit_id]||[]).push(l.day); });
    function streak(id){ var days=(byHabit[id]||[]).slice().sort(); var set={}; days.forEach(function(d){set[d]=1;}); var c=0; var d=new Date(); for(;;){ var s=d.toISOString().slice(0,10); if(set[s]){c++; d.setDate(d.getDate()-1);} else if(s===today){ d.setDate(d.getDate()-1);} else break; } return c; }
    var html=topbar('Habits')+'<div class="screen on" style="padding-top:6px"><p class="muted" style="font-size:14px;margin-bottom:14px">Small things, done daily. Tap to check off today.</p><div id="hlist">';
    if(!S.habits.length) html+='<div class="empty">No habits yet. Add one below.</div>';
    else html+=S.habits.map(function(h){ var done=(byHabit[h.id]||[]).indexOf(today)>=0; return '<div class="habit '+(done?'done':'')+'" data-h="'+h.id+'"><div class="chk">'+(done?'✓':'')+'</div><div class="nm">'+esc(h.name)+'<div class="st">'+streak(h.id)+'-day streak</div></div></div>'; }).join('');
    html+='</div><button class="btn" id="addHabit" style="margin-top:10px">+ Add a habit</button></div>';
    $('screens').innerHTML=html; wireTop();
    $('addHabit').onclick=function(){ openSheet('<h3>New habit</h3><div class="field" style="margin-top:10px"><input class="inp" id="h_n" placeholder="e.g. Talk to one customer"></div><button class="btn" id="h_go">Add habit</button>'); setTimeout(function(){$('h_n').focus();},80); $('h_go').onclick=function(){ var n=($('h_n').value||'').trim(); if(!n){toast('Name it');return;} sb.from('habits').insert({name:n}).then(function(){ closeSheet(); habitView(); }); }; };
    $('screens').querySelectorAll('[data-h]').forEach(function(row){ row.onclick=function(){ var id=row.getAttribute('data-h'); var done=row.classList.contains('done'); if(done){ sb.from('habit_logs').delete().eq('habit_id',id).eq('day',today).then(function(){ habitView(); }); } else { sb.from('habit_logs').insert({habit_id:id,day:today}).then(function(){ habitView(); }); } }; });
  });
}

// ---------- PROFILE / SETTINGS sheet ----------
function profileSheet(){
  var p=S.profile||{};
  openSheet('<h3>'+esc(p.full_name||'Your account')+'</h3><p class="muted" style="font-size:13px;margin-bottom:14px">'+esc(S.user.email||'')+'</p>'+
    '<div class="field"><label>OpenAI API key</label><input class="inp" id="s_key" type="password" placeholder="sk-..." value="'+esc(openaiKey())+'"><div class="muted" style="font-size:12px;margin-top:6px">For testing on your own device. Get it at platform.openai.com → API keys. Stored only on this device.</div></div>'+
    '<div class="field"><label>Coach service URL (optional, for launch)</label><input class="inp" id="s_url" type="text" placeholder="https://...supabase.co/functions/v1/coach" value="'+esc(coachUrl())+'"><div class="muted" style="font-size:12px;margin-top:6px">Use this instead of a key once the secure Supabase function is deployed — then the key never lives on devices.</div></div>'+
    '<button class="btn" id="s_savekey">Save</button>'+
    '<div style="height:10px"></div>'+
    '<button class="btn sec" id="s_history">View past sessions</button>'+
    '<div style="height:8px"></div>'+
    '<button class="btn sec" id="s_goals">My goals</button>'+
    '<div style="height:8px"></div>'+
    '<button class="btn sec" id="s_out" style="color:var(--danger);border-color:#f3c4bd">Sign out</button>');
  $('s_savekey').onclick=function(){ localStorage.setItem('lf_openai_key',($('s_key').value||'').trim()); localStorage.setItem('lf_coach_url',($('s_url').value||'').trim()); closeSheet(); toast(aiConfigured()?'Saved ✓ AI coaching on':'Saved'); go(S.tab); };
  $('s_history').onclick=function(){ closeSheet(); historyView(); };
  $('s_goals').onclick=function(){ closeSheet(); goalsView(); };
  $('s_out').onclick=function(){ sb.auth.signOut().then(function(){ location.reload(); }); };
}
function historyView(){
  setActiveTab('');
  sb.from('sessions').select('*').order('created_at',{ascending:false}).limit(50).then(function(r){
    var rows=(r&&r.data)||[];
    var html=topbar('History')+'<div class="screen on" style="padding-top:6px">'+(rows.length?rows.map(function(s){return '<div class="listitem"><div class="h">'+cap(s.kind)+' session<span class="muted" style="font-weight:500">'+new Date(s.created_at).toLocaleDateString()+'</span></div>'+(s.summary?'<div class="d">'+esc(s.summary)+'</div>':'')+'</div>';}).join(''):'<div class="empty">No sessions yet.</div>')+'</div>';
    $('screens').innerHTML=html; wireTop();
  });
}
function goalsView(){
  loadGoals().then(function(){
    var html=topbar('My goals')+'<div class="screen on" style="padding-top:6px"><button class="btn" id="ng" style="margin-bottom:14px">+ New goal</button>'+
      (S.goals.length?S.goals.map(function(g){return '<div class="listitem"><div class="h">'+esc(g.title)+'<span class="muted" style="font-weight:500">'+(g.duration_months||'')+'mo</span></div>'+(g.detail?'<div class="d">'+esc(g.detail)+'</div>':'')+'<div class="d">Target: '+esc(g.target_month||'—')+' · '+goalProgress(g)+'% on track</div></div>';}).join(''):'<div class="empty">No goals yet.</div>')+'</div>';
    $('screens').innerHTML=html; wireTop(); $('ng').onclick=goalSheet;
  });
}

// ---------- sheet helpers ----------
function openSheet(html){ var s=$('sheet'); if(!s){ return; } $('sheetcard').innerHTML=html; s.classList.add('on'); }
function closeSheet(){ var s=$('sheet'); if(s) s.classList.remove('on'); }

// ============================================================
//  BOOT
// ============================================================
function boot(){
  if(!sb){ $('boot').innerHTML='<div style="padding:30px;text-align:center">Backend not connected. Please try again later.</div>'; return; }
  sb.auth.getSession().then(function(r){
    var sess=r&&r.data?r.data.session:null;
    if(!sess){ authView(false); return; }
    S.user=sess.user;
    loadProfile().then(function(){
      var doneLocal = localStorage.getItem('lf_onb_done_'+S.user.id)==='1';
      if(!S.profile || (!S.profile.onboarded && !doneLocal)){ onboarding(); }
      else { shell(); }
    });
  });
}
if('serviceWorker' in navigator){ navigator.serviceWorker.register('/app/sw.js',{scope:'/app/'}).catch(function(){}); }
boot();

})();
