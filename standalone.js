/* Gym Arc – eigenständiger Betrieb (GitHub Pages + Supabase).
   Stellt dieselbe Schnittstelle bereit wie die Claude-Artifact-Umgebung (claude.use("db" | "user" | "sample")),
   damit index.html unverändert in beiden Umgebungen läuft. Wird nur auf github.io / localhost geladen. */
(function(){
  "use strict";
  var CFG = window.GYM_CFG || {};
  var BASE = String(CFG.supabaseUrl || "").replace(/\/+$/, "");
  var KEY = String(CFG.supabaseKey || "");
  var OWNER = "u_659ficsI1KAHAfHpOlFY1A";           // gleiche Besitzer-ID wie im Artifact → Besitzer-Modus
  var SK = "ga-sb-session";
  var CONFIGURED = /^https:\/\/.+/.test(BASE) && KEY.length > 20 && !/DEIN/i.test(BASE + KEY);

  /* ---------- Web-App: Manifest, Symbol, Offline ---------- */
  try{
    // Grundgerüst wie in der Artifact-Umgebung; Abstände zu Statusleiste/Home-Balken regelt die App selbst (sonst springt die Seite beim Tab-Wechsel)
    document.write('<style>:root{color-scheme:light;box-sizing:border-box}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}' +
      /* Home-App: Leiste unten näher an den Rand, mit Abstand zum Home-Balken */
      '.tabbar{padding-bottom:calc(max(env(safe-area-inset-bottom,0px) - 20px, 6px) + 4px)!important}' +
      /* Fenster als Blatt vom unteren Rand (wie iOS): kein schwarzer Streifen unten, weniger Abstand oben */
      ':root{--m-pb:0px}body .modal,body #bcScan{padding-left:0;padding-right:0;padding-top:8px}' +
      'body .modal-box,body #bcScan .bc-box{border-radius:26px 26px 0 0;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))}body .modal-box{max-height:calc(100dvh - var(--safe-t) - 8px)}' +
      '.gs-card{background:var(--tile);border-radius:14px;padding:0 14px}.gs-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;font-weight:600;font-size:16px}.gs-row+.gs-row{border-top:1px solid var(--line)}.gs-row.dis{color:var(--muted)}' +
      '.gs-sw{position:relative;width:51px;height:31px;border-radius:16px;background:color-mix(in srgb,var(--muted) 45%,transparent);flex-shrink:0;transition:background .2s}.gs-sw::after{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.25);transition:transform .2s}.gs-sw.on{background:var(--accent)}.gs-sw.on::after{transform:translateX(20px)}.gs-sw:disabled{opacity:.45}' +
      '.ga-acc{background:var(--tile);border-radius:16px;padding:14px;margin-bottom:10px}.ga-acc-h b{display:block;font-size:16px;word-break:break-all}.ga-acc-h span{font-size:13px;color:var(--muted)}' +
      '.ga-acc-n{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0 4px}.ga-acc-n div{background:var(--surface);border-radius:12px;padding:8px 10px}.ga-acc-n span,.ga-acc-n em{display:block;font-size:12px;color:var(--muted);font-style:normal}.ga-acc-n b{display:block;font-size:16px}' +
      '.ga-acc .gs-row{min-height:46px}.ga-lim{display:flex;align-items:center;gap:6px;font-size:14px;color:var(--muted)}.ga-lim span{flex:1}.ga-lim button{border:0;border-radius:10px;padding:7px 12px;font:inherit;font-weight:700;background:var(--surface);color:var(--muted)}.ga-lim button.on{background:var(--accent);color:#fff}' +
      '.ga-blk{display:block;width:100%;margin-top:10px;border:0;border-radius:12px;padding:10px;font:inherit;font-weight:700;background:var(--surface);color:#e5484d}.ga-blk.go{background:#e5484d;color:#fff}.ga-acc-off .ga-blk{color:var(--text,inherit)}' +
      '.ga-blkt{display:block;width:100%;text-align:left;border:0;background:none;padding:8px 2px;font:inherit;font-weight:700;color:var(--muted)}' +
      '.gs-test{background:none;padding:0 0 0 6px;color:var(--accent);font-weight:600;font-size:14px}' +
      '.ga-use{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;background:none;border:0;padding:0;font:inherit;color:var(--muted);font-size:14px;line-height:1.4}.ga-use i{font-style:normal;color:var(--accent);font-size:18px;flex-shrink:0}' +
      '.ga-ul{background:var(--tile);border-radius:14px;padding:0 14px}.ga-ur{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0}.ga-ur+.ga-ur{border-top:1px solid var(--line)}.ga-ur b{display:block;font-size:15px;font-weight:650;color:var(--ink)}.ga-ur span{font-size:12px;color:var(--muted)}.ga-ur em{font-style:normal;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.gs-tl{display:flex;align-items:center;gap:10px}.gs-time{font:inherit;font-size:16px;font-weight:600;color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent);border:0;border-radius:8px;padding:4px 8px;min-width:0;width:auto;-webkit-appearance:none;appearance:none}.gs-time:disabled{color:var(--muted);background:transparent}</style>');
    document.write('<link rel="manifest" href="manifest.webmanifest">' +
      '<meta name="apple-mobile-web-app-capable" content="yes">' +
      '<meta name="mobile-web-app-capable" content="yes">' +
      '<meta name="apple-mobile-web-app-title" content="Gym Arc">');
    // Statusleiste bewusst NICHT durchsichtig: sonst rutschen Training/Einkauf unter die Uhrzeit
  }catch(_){}
  if("serviceWorker" in navigator && location.protocol === "https:"){
    window.addEventListener("load", function(){ navigator.serviceWorker.register("sw.js").catch(function(){}); });
  }

  function E(code, message){ return {code: code, message: message || code}; }

  if(!CONFIGURED){
    // Ohne Zugangsdaten: App läuft nur lokal auf diesem Gerät (wie ohne Claude-Anmeldung).
    window.claude = { use: function(){ return Promise.resolve(null); } };
    return;
  }

  /* ---------- Anmeldung (E-Mail-Code, Supabase Auth) ---------- */
  var sess = null;
  try{ sess = JSON.parse(localStorage.getItem(SK) || "null"); }catch(_){ sess = null; }
  /* Mehrere Konten: Besitzer = dein Supabase-Konto, alle anderen bekommen einen eigenen, leeren Bereich */
  var OWNER_UID = "b489f427-ee44-495c-bdb4-858ae3c9773f";
  function subOf(s){ try{ var p = s.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(atob(p + "===".slice((p.length + 3) % 4))).sub || null; }catch(_){ return null; } }
  function isOwnerAcc(){ var u = sess && subOf(sess); return !!u && u === OWNER_UID; }
  function appUid(){ var u = sess && subOf(sess); return !u ? null : u === OWNER_UID ? OWNER : "u_" + u; }
  // Jedes Konto hat seine eigene lokale Ablage auf dem Gerät (Besitzer behält die bisherige)
  window.GA_LS_SUFFIX = (function(){ var u = sess && subOf(sess); return !u || u === OWNER_UID ? "" : "-" + u.slice(0, 8); })();
  window.GA_IS_OWNER = isOwnerAcc();
  function store(s){ sess = s; try{ if(s) localStorage.setItem(SK, JSON.stringify(s)); else localStorage.removeItem(SK); }catch(_){} }
  function keep(d, email){
    store({ access_token: d.access_token, refresh_token: d.refresh_token,
      expires_at: d.expires_at || (Math.floor(Date.now()/1000) + (d.expires_in || 3600)),
      email: (d.user && d.user.email) || email || (sess && sess.email) || "" });
  }
  async function authCall(path, body){
    var r;
    try{ r = await fetch(BASE + "/auth/v1/" + path, { method:"POST", headers:{ apikey: KEY, "Content-Type":"application/json" }, body: JSON.stringify(body) }); }
    catch(e){ throw E("unavailable", "Keine Verbindung"); }
    var d = {}; try{ d = await r.json(); }catch(_){}
    if(!r.ok) throw E(r.status === 429 ? "rate_limited" : "auth", d.msg || d.error_description || d.message || ("Fehler " + r.status));
    return d;
  }
  var refreshing = null;
  async function token(force){
    if(!sess) throw E("not_granted", "Nicht angemeldet");
    if(!force && sess.expires_at * 1000 > Date.now() + 60000) return sess.access_token;
    if(!refreshing) refreshing = (async function(){
      try{ var d = await authCall("token?grant_type=refresh_token", { refresh_token: sess.refresh_token }); keep(d); }
      catch(e){ if(e.code === "auth"){ store(null); loginNeeded(); throw E("not_granted", "Bitte neu anmelden"); } /* offline: alten Schlüssel weiter versuchen */ }
      finally{ refreshing = null; }
    })();
    await refreshing; if(!sess) throw E("not_granted"); return sess.access_token;
  }

  /* ---------- Datenbank (Tabelle public.docs, eine Zeile je Dokument) ---------- */
  async function rest(method, query, body, extra){
    for(var i = 0; i < 2; i++){
      var t = await token(i > 0);
      var r;
      try{
        r = await fetch(BASE + "/rest/v1/docs" + query, { method: method, cache: "no-store",
          headers: Object.assign({ apikey: KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" }, extra || {}),
          body: body ? JSON.stringify(body) : undefined });
      }catch(e){ throw E("unavailable", "Keine Verbindung"); }
      if((r.status === 401 || r.status === 403) && i === 0) continue;   // 403: evtl. gesperrt → Neuanmeldung prüft das
      if(!r.ok){ var txt = ""; try{ txt = await r.text(); }catch(_){}
        throw E(r.status === 429 ? "resource_exhausted" : r.status >= 500 ? "unavailable" : r.status === 401 || r.status === 403 ? "permission-denied" : "invalid-argument", txt.slice(0, 200)); }
      if(r.status === 204) return null;
      var s = await r.text(); return s ? JSON.parse(s) : null;
    }
    throw E("permission-denied", "Nicht angemeldet");
  }
  var enc = encodeURIComponent;
  function snapOf(id, row){ return { id: id, exists: !!row, hasPendingWrites: false, data: function(){ return row ? row.data : undefined; } }; }
  async function upsert(rows){
    var now = new Date().toISOString();
    await rest("POST", "?on_conflict=user_id,id", rows.map(function(x){ return { id: x.id, data: x.data, updated_at: now }; }),
      { Prefer: "resolution=merge-duplicates,return=minimal" });
  }
  function docRef(id){
    id = String(id);
    return {
      id: id,
      get: async function(){ var rows = await rest("GET", "?select=data&id=eq." + enc(id)); return snapOf(id, rows && rows[0]); },
      set: async function(data){ await upsert([{ id: id, data: data }]); },
      update: async function(patch){ var s = await this.get(); await upsert([{ id: id, data: Object.assign({}, s.data() || {}, patch) }]); },
      delete: async function(){ await rest("DELETE", "?id=eq." + enc(id), null, { Prefer: "return=minimal" }); },
      onSnapshot: function(cb, onErr){
        var stopped = false, last = null, busy = false;
        async function tick(){
          if(stopped || busy || document.hidden) return; busy = true;
          try{ var rows = await rest("GET", "?select=data,updated_at&id=eq." + enc(id)); var row = rows && rows[0];
            var u = row ? row.updated_at : "-"; if(u !== last){ last = u; cb(snapOf(id, row)); } }
          catch(e){ /* nächster Versuch beim nächsten Takt */ }
          finally{ busy = false; }
        }
        function vis(){ if(!document.hidden) tick(); }
        tick(); var iv = setInterval(tick, 20000);
        document.addEventListener("visibilitychange", vis); window.addEventListener("focus", vis); window.addEventListener("online", vis);
        return function(){ stopped = true; clearInterval(iv); document.removeEventListener("visibilitychange", vis); window.removeEventListener("focus", vis); window.removeEventListener("online", vis); };
      }
    };
  }
  async function allDocs(){
    var out = [], step = 500;
    for(var off = 0; ; off += step){
      var rows = await rest("GET", "?select=id,data&order=id&limit=" + step + "&offset=" + off);
      out = out.concat(rows || []); if(!rows || rows.length < step) break;
    }
    return out;
  }
  var DB = {
    collection: function(){ return {
      doc: function(id){ return docRef(id); },
      get: async function(){ var rows = await allDocs();
        return { size: rows.length, empty: !rows.length, docs: rows.map(function(r){ return { id: r.id, exists: true, data: function(){ return r.data; } }; }) }; }
    }; },
    doc: function(path){ return docRef(String(path).split("/").pop()); }
  };
  var USER = {
    id: async function(){ return appUid(); }, me: async function(){ return { id: appUid(), name: "" }; },
    isOwner: function(){ return isOwnerAcc(); }, canEdit: function(){ return true; }, can: function(){ return true; },
    profiles: async function(){ return {}; }, search: async function(){ return []; }
  };

  /* ---------- Claude über die eigene Server-Funktion (Schlüssel bleibt bei Supabase) ---------- */
  async function shrink(b){
    try{ var bmp = await createImageBitmap(b); var sc = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));   // 1024 px reichen für Mahlzeiten und Tabellen und sparen ca. 30–40 % Tokens
      var c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return await new Promise(function(res){ c.toBlob(function(x){ res(x || b); }, "image/jpeg", .85); });
    }catch(_){ return b; }
  }
  async function b64(blob){
    var b = blob;
    b = await shrink(b);   // immer auf max. 1024 px verkleinern
    var buf = new Uint8Array(await b.arrayBuffer()), s = "";
    for(var i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { media_type: /^image\/(jpeg|png|webp|gif)$/.test(b.type || "") ? b.type : "image/jpeg", data: btoa(s) };
  }
  function parseJSON(t){
    var s = String(t || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    try{ return JSON.parse(s); }catch(_){}
    var a = s.search(/[\[{]/); if(a >= 0){ var e = s.lastIndexOf(s[a] === "[" ? "]" : "}"); if(e > a){ try{ return JSON.parse(s.slice(a, e + 1)); }catch(_){} } }
    throw E("bad_response", "Antwort war kein gültiges JSON");
  }
  async function ask(input, opts, json){
    opts = opts || {};
    var body = { tier: opts.modelTier || "default", json: !!json };
    if(typeof input === "string") body.prompt = input; else body.messages = input;
    if(opts.images && opts.images.length) body.images = await Promise.all(opts.images.map(b64));
    for(var i = 0; i < 2; i++){
      var t = await token(i > 0), r;
      try{ r = await fetch(BASE + "/functions/v1/claude", { method: "POST", signal: opts.signal,
          headers: { apikey: KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
      catch(e){ if(opts.signal && opts.signal.aborted) throw E("aborted", "Abgebrochen"); throw E("unavailable", "Keine Verbindung"); }
      if(r.status === 401 && i === 0) continue;
      var d = {}; try{ d = await r.json(); }catch(_){}
      if(!r.ok) throw E(d.code || (r.status === 429 ? "rate_limited" : r.status === 403 ? "not_granted" : "unavailable"), d.message || ("Fehler " + r.status));
      return d;
    }
    throw E("not_granted", "Nicht angemeldet");
  }
  var SAMPLE = async function(input, opts){
    var d = await ask(input, opts, false);
    if(opts && typeof opts.onText === "function"){ try{ opts.onText({ text: d.text || "", delta: d.text || "" }); }catch(_){} }
    return { text: d.text || "", truncated: !!d.truncated };
  };
  SAMPLE.json = async function(input, opts){ return parseJSON((await ask(input, opts, true)).text); };
  SAMPLE.limits = async function(){ return { images: true }; };

  /* ---------- Anmelde- und Umzugsfenster ---------- */
  var readyResolve, READY = new Promise(function(r){ readyResolve = r; });
  var CSS = '#gaAuth{position:fixed;inset:0;z-index:99999;background:var(--bg,#EEF0F3);color:var(--ink,#15171C);display:flex;align-items:center;justify-content:center;padding:24px 16px calc(24px + env(safe-area-inset-bottom,0px));font-family:Archivo,-apple-system,system-ui,sans-serif}' +
    '#gaAuth .bx{width:100%;max-width:380px;background:var(--surface,#fff);border-radius:22px;padding:24px 20px}' +
    '#gaAuth h2{margin:0 0 6px;font-size:24px;font-weight:800;letter-spacing:-.01em}' +
    '#gaAuth p{margin:0 0 16px;color:var(--muted,#6A707D);font-size:15px;line-height:1.4}' +
    '#gaAuth input{width:100%;box-sizing:border-box;border:0;border-radius:14px;background:var(--tile,#F2F3F6);color:inherit;padding:14px;font:inherit;font-size:17px;margin:0 0 10px;outline:none}' +
    '#gaAuth input.code{letter-spacing:.3em;text-align:center;font-weight:700;font-size:22px}' +
    '#gaAuth button{width:100%;min-height:52px;border:0;border-radius:16px;font:inherit;font-size:16px;font-weight:700;margin:0 0 8px;cursor:pointer;background:var(--tile,#F2F3F6);color:inherit}' +
    '#gaAuth button.pri{background:var(--accent,#3346FF);color:#fff}' +
    '#gaAuth button:disabled{opacity:.5}' +
    '#gaAuth .msg{min-height:20px;font-size:14px;color:var(--bad,#D63A40);margin:2px 0 8px}' +
    '#gaAuth .ok{color:var(--good,#14853F)}';
  function box(html){
    var o = document.getElementById("gaAuth");
    if(!o){ var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
      o = document.createElement("div"); o.id = "gaAuth"; document.body.appendChild(o); }
    o.innerHTML = '<div class="bx">' + html + '</div>'; return o;
  }
  function close(){ var o = document.getElementById("gaAuth"); if(o) o.remove(); }
  function $(id){ return document.getElementById(id); }
  function msg(t, ok){ var m = $("gaMsg"); if(m){ m.textContent = t || ""; m.className = "msg" + (ok ? " ok" : ""); } }
  function onEnter(id, fn){ var el = $(id); if(el) el.addEventListener("keydown", function(ev){ if(ev.key === "Enter"){ ev.preventDefault(); fn(); } }); }

  function loginNeeded(){ if(document.body) showLogin(); else document.addEventListener("DOMContentLoaded", showLogin); }
  function showLogin(email){
    box('<h2>Anmelden</h2><p>Mit Passwort – oder ohne Passwort per Link aus einer E-Mail.</p>' +
      '<input id="gaMail" type="email" autocomplete="username" inputmode="email" data-native placeholder="E-Mail-Adresse" value="' + String(email || CFG.email || (sess && sess.email) || "").replace(/"/g, "") + '">' +
      '<input id="gaPw" type="password" autocomplete="current-password" data-native placeholder="Passwort">' +
      '<div class="msg" id="gaMsg"></div><button class="pri" id="gaPwGo">Anmelden</button><button id="gaSend">Ohne Passwort: Link per E-Mail</button>' +
      '<p style="margin:14px 0 8px;text-align:center">Neu hier?</p><button id="gaNewAcc">Konto erstellen</button>');
    $("gaNewAcc").onclick = function(){ showSignup($("gaMail").value.trim()); };
    async function pwLogin(){
      var em = $("gaMail").value.trim().toLowerCase(), pw = $("gaPw").value;
      if(!/^\S+@\S+\.\S+$/.test(em)){ msg("Bitte eine gültige E-Mail-Adresse eingeben."); return; }
      if(!pw){ msg("Bitte Passwort eingeben – oder den Link per E-Mail nutzen."); return; }
      $("gaPwGo").disabled = true; msg("");
      try{ var d = await authCall("token?grant_type=password", { email: em, password: pw }); keep(d, em); await afterLogin(); }
      catch(e){ $("gaPwGo").disabled = false; msg(e.code === "unavailable" ? "Keine Verbindung." : e.code === "rate_limited" ? "Zu viele Versuche – bitte kurz warten." : /banned/i.test(e.message || "") ? "Dieses Konto wurde gesperrt." : "E-Mail oder Passwort falsch. Noch kein Passwort? In der App am PC unter Zahnrad → Konto festlegen."); }
    }
    $("gaPwGo").onclick = pwLogin; onEnter("gaPw", pwLogin);
    async function send(){
      var em = $("gaMail").value.trim().toLowerCase(); if(!/^\S+@\S+\.\S+$/.test(em)){ msg("Bitte eine gültige E-Mail-Adresse eingeben."); return; }
      $("gaSend").disabled = true; msg("");
      try{ await authCall("otp?redirect_to=" + encodeURIComponent(location.origin + location.pathname), { email: em, create_user: true }); showCode(em); }
      catch(e){ $("gaSend").disabled = false; msg(e.code === "rate_limited" ? "Supabase verschickt nur wenige Mails pro Stunde – bitte später nochmal oder mit Passwort anmelden." : e.code === "unavailable" ? "Keine Verbindung." : "Senden fehlgeschlagen: " + e.message); }
    }
    $("gaSend").onclick = send;
  }
  function showSignup(email){
    box('<h2>Konto erstellen</h2><p>Mit E-Mail und Passwort. Deine Daten liegen in einem eigenen, privaten Bereich – niemand sonst sieht sie.</p>' +
      '<input id="gaMail" type="email" autocomplete="username" inputmode="email" data-native placeholder="E-Mail-Adresse" value="' + String(email || "").replace(/"/g, "") + '">' +
      '<input id="gaPw" type="password" autocomplete="new-password" data-native placeholder="Passwort (mind. 8 Zeichen)">' +
      '<input id="gaPw2" type="password" autocomplete="new-password" data-native placeholder="Passwort wiederholen">' +
      '<div class="msg" id="gaMsg"></div><button class="pri" id="gaSignGo">Konto erstellen</button><button id="gaBack">Zurück zur Anmeldung</button>');
    $("gaBack").onclick = function(){ showLogin($("gaMail").value.trim()); };
    async function go(){
      var em = $("gaMail").value.trim().toLowerCase(), pw = $("gaPw").value, pw2 = $("gaPw2").value;
      if(!/^\S+@\S+\.\S+$/.test(em)){ msg("Bitte eine gültige E-Mail-Adresse eingeben."); return; }
      if(pw.length < 8){ msg("Das Passwort braucht mindestens 8 Zeichen."); return; }
      if(pw !== pw2){ msg("Die Passwörter stimmen nicht überein."); return; }
      $("gaSignGo").disabled = true; msg("");
      try{
        var d = await authCall("signup?redirect_to=" + encodeURIComponent(location.origin + location.pathname), { email: em, password: pw });
        if(d && d.access_token){ keep(d, em); await afterLogin(); return; }
        // E-Mail-Bestätigung aktiv: Link/Code aus der Mail einfügen (wie beim Anmelden per Link)
        showCode(em, true);
      }catch(e){ $("gaSignGo").disabled = false;
        msg(e.code === "unavailable" ? "Keine Verbindung." : e.code === "rate_limited" ? "Zu viele Versuche – bitte kurz warten." :
          /registered|already|exists/i.test(e.message || "") ? "Für diese E-Mail gibt es schon ein Konto – bitte anmelden." : "Konto konnte nicht erstellt werden: " + e.message); }
    }
    $("gaSignGo").onclick = go; onEnter("gaPw2", go);
  }
  function showCode(em, fromSignup){
    box('<h2>E-Mail prüfen</h2><p>' + (fromSignup ? 'Fast geschafft – bestätige dein Konto. ' : '') + 'Wir haben dir eine E-Mail an <b>' + em.replace(/</g, "&lt;") + '</b> geschickt.</p>' +
      '<p><b>Am PC / in Safari:</b> einfach den Link in der Mail antippen.<br><b>In der App vom Home-Bildschirm:</b> Link in der Mail lange drücken → „Link kopieren“ → hier einfügen.</p>' +
      '<input id="gaCode" type="text" data-native autocomplete="one-time-code" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Link oder Code einfügen">' +
      '<div class="msg" id="gaMsg"></div><button class="pri" id="gaVerify">Anmelden</button><button id="gaBack">Andere E-Mail / neu senden</button>');
    async function verify(){
      var raw = $("gaCode").value.trim(), th = null, ty = null;
      var mm = raw.match(/[?&#]token=([^&#\s]+)/); if(mm){ th = decodeURIComponent(mm[1]); var mt = raw.match(/[?&#]type=([a-z_]+)/); ty = mt && mt[1]; }
      var c = raw.replace(/\D/g, "");
      if(!th && (c.length < 6 || c.length > 10)){ msg("Bitte den Link (oder Code) aus der E-Mail einfügen."); return; }
      $("gaVerify").disabled = true; msg("");
      try{
        var d = null, err = null;
        if(th){ var types = [ty, "email", "magiclink", "signup"].filter(function(x, i, a){ return x && a.indexOf(x) === i; });
          for(var i = 0; i < types.length && !d; i++){ try{ d = await authCall("verify", { type: types[i], token_hash: th }); }catch(e){ err = e; if(e.code === "unavailable") throw e; } }
          if(!d) throw err || E("auth"); }
        else d = await authCall("verify", { type: "email", email: em, token: c });
        keep(d, em); await afterLogin(); }
      catch(e){ $("gaVerify").disabled = false; msg(e.code === "unavailable" ? "Keine Verbindung." : /banned/i.test(e.message || "") ? "Dieses Konto wurde gesperrt." : "Code ungültig oder abgelaufen."); }
    }
    $("gaVerify").onclick = verify; onEnter("gaCode", verify); $("gaBack").onclick = function(){ showLogin(em); };
    setTimeout(function(){ try{ $("gaCode").focus(); }catch(_){} }, 50);
  }

  /* Erster Start mit leerer Datenbank: Sicherung aus der Artifact-App übernehmen */
  function backupToDocs(d){
    var out = [], del = {};
    (d.deleted || []).forEach(function(x){ del[x] = 1; });
    (d.history || []).forEach(function(h){ if(h && h.id != null && !del[h.id]) out.push({ id: "w" + h.id, data: h }); });
    if(Array.isArray(d.body) && d.body.length) out.push({ id: "body", data: { entries: d.body } });
    var s = d.settings || {};
    if(d.settings) out.push({ id: "settings", data: { rest: s.rest, order: s.order || {}, plan: s.plan || null, customEx: s.customEx || {}, workouts: s.workouts || null,
      days: s.days || null, planName: s.planName || null, profile: s.profile || null, resets: s.resets || null, steps: s.steps || null, stacks: s.stacks || null } });
    Object.keys(d.food || {}).forEach(function(k){ if(/^\d{4}-\d\d-\d\d$/.test(k) && d.food[k]) out.push({ id: "f" + k, data: d.food[k] }); });
    if(d.nutri) out.push({ id: "nutri", data: d.nutri });
    if(d.active) out.push({ id: "active", data: { session: d.active } });
    var seen = {}, uniq = [];   // doppelte IDs (z. B. ein Training zweimal in der Sicherung) nur einmal schreiben
    for(var i = out.length - 1; i >= 0; i--){ if(!seen[out[i].id]){ seen[out[i].id] = 1; uniq.unshift(out[i]); } }
    return JSON.parse(JSON.stringify(uniq));
  }
  function showMigrate(){
    return new Promise(function(done){
      box('<h2>Daten übernehmen</h2><p>Die Datenbank ist noch leer. Wähle die Sicherung aus der bisherigen App (Zahnrad → Daten → Export), damit alle Trainings, Gewichte, Rezepte und Mahlzeiten übernommen werden.</p>' +
        '<input id="gaFile" type="file" accept=".json,application/json,text/plain" style="padding:12px;font-size:15px">' +
        '<div class="msg" id="gaMsg"></div><button class="pri" id="gaImp">Übernehmen</button><button id="gaSkip">Ohne Daten starten</button>');
      $("gaSkip").onclick = function(){ done(); };
      $("gaImp").onclick = async function(){
        var f = $("gaFile").files && $("gaFile").files[0]; if(!f){ msg("Bitte zuerst die Sicherungsdatei wählen."); return; }
        var d; try{ d = JSON.parse(await f.text()); }catch(_){ msg("Das ist keine gültige Sicherung."); return; }
        if(!d || !Array.isArray(d.history)){ msg("Das ist keine gültige Sicherung."); return; }
        $("gaImp").disabled = true; $("gaSkip").disabled = true; msg("Wird übernommen …", true);
        try{
          var docs = backupToDocs(d);
          for(var i = 0; i < docs.length; i += 100) await upsert(docs.slice(i, i + 100));
          try{ if(d.theme && !localStorage.getItem("pp-theme")) localStorage.setItem("pp-theme", JSON.stringify(d.theme)); }catch(_){}
          msg(docs.length + " Einträge übernommen.", true); setTimeout(done, 600);
        }catch(e){ $("gaImp").disabled = false; $("gaSkip").disabled = false; msg("Fehler beim Übernehmen: " + (e.message || e.code)); }
      };
    });
  }
  async function afterLogin(){
    if(sess && !sess.email){ try{ var t = await token(); var ur = await fetch(BASE + "/auth/v1/user", { headers: { apikey: KEY, Authorization: "Bearer " + t } }); if(ur.ok){ var u = await ur.json(); if(u && u.email){ sess.email = u.email; store(sess); } } }catch(_){} }
    if(isOwnerAcc()){ try{ var any = await rest("GET", "?select=id&limit=1"); if(!any || !any.length) await showMigrate(); }catch(_){} }
    // Neu laden, damit die App mit der lokalen Ablage genau dieses Kontos startet
    close(); location.reload();
  }
  function boot(){
    // Rückkehr vom Anmelde-Link (Safari/PC): Zugang steht in der Adresse hinter #
    var h = location.hash || "";
    if(/access_token=/.test(h)){
      var p = {}; h.slice(1).split("&").forEach(function(kv){ var i = kv.indexOf("="); if(i > 0) p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
      try{ history.replaceState(null, "", location.pathname + location.search); }catch(_){}
      if(p.access_token && p.refresh_token){ keep({ access_token: p.access_token, refresh_token: p.refresh_token, expires_at: +p.expires_at || 0, expires_in: +p.expires_in || 3600 }); afterLogin(); return; }
    }
    if(sess){ readyResolve(); return; }
    showLogin();
    if(/error=/.test(h)){ try{ history.replaceState(null, "", location.pathname + location.search); }catch(_){} msg("Der Link ist abgelaufen – bitte neu senden."); }
  }
  if(document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);

  /* ---------- Mitteilung bei Pausenende (Web Push über Server-Funktion "push") ---------- */
  async function callFn(name, body, keep){
    for(var i = 0; i < 2; i++){
      var t = await token(i > 0), r;
      try{ r = await fetch(BASE + "/functions/v1/" + name, { method: "POST", keepalive: !!keep,
          headers: { apikey: KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
      catch(e){ throw E("unavailable", "Keine Verbindung"); }
      if(r.status === 401 && i === 0) continue;
      var d = {}; try{ d = await r.json(); }catch(_){}
      if(!r.ok) throw E(d.code || "unavailable", d.message || ("Fehler " + r.status));
      return d;
    }
    throw E("not_granted");
  }
  var PK = "ga-push";
  function pushOn(){ try{ return localStorage.getItem(PK) === "1"; }catch(_){ return false; } }
  function pushSupported(){ return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
  function installed(){ return navigator.standalone === true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches); }
  function u8(b){ b = String(b).replace(/-/g, "+").replace(/_/g, "/"); while(b.length % 4) b += "="; var s = atob(b), o = new Uint8Array(s.length); for(var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; }
  function toast2(t){ try{ if(typeof toast === "function") toast(t); }catch(_){} }
  function rerender(){ try{ if(document.querySelector("[data-gpush]") && typeof settingsModal === "function") settingsModal(); }catch(_){} }
  async function pushEnable(){
    if(!pushSupported() || !installed()){ toast2("Nur in der App vom Home-Bildschirm möglich"); return; }
    var perm = await Notification.requestPermission();      // muss direkt beim Tippen passieren
    if(perm !== "granted"){ toast2("Mitteilungen wurden nicht erlaubt"); rerender(); return; }
    try{
      var reg = await navigator.serviceWorker.ready;
      var k = await callFn("push", { action: "key" });
      var sub = await reg.pushManager.getSubscription();
      if(sub && sub.options && sub.options.applicationServerKey){
        var cur = new Uint8Array(sub.options.applicationServerKey), want = u8(k.pub);
        if(cur.length !== want.length || cur.some(function(v, i){ return v !== want[i]; })){ await sub.unsubscribe(); sub = null; }
      }
      if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(k.pub) });
      await callFn("push", { action: "subscribe", sub: sub.toJSON(), old: oldEp(sub.endpoint) });
      try{ localStorage.setItem(EPK, sub.endpoint); }catch(_){}
      localStorage.setItem(PK, "1"); toast2("Mitteilungen an"); lastEnd = undefined; weighSync();
    }catch(e){ toast2("Einschalten fehlgeschlagen: " + (e.message || e.code)); }
    rerender();
  }
  /* Pro Gerät nur eine Anmeldung: die vorherige Adresse dieses Geräts wird beim Server ersetzt */
  var EPK = "ga-push-ep";
  function oldEp(cur){ try{ var o = localStorage.getItem(EPK); return o && o !== cur ? o : ""; }catch(_){ return ""; } }
  async function pushResync(){ // beim Öffnen: Adresse kann sich ändern (iOS) → Server aktuell halten, alte Adresse entfernen
    try{
      if(!sess || !pushOn() || !pushSupported() || Notification.permission !== "granted") return;
      var reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
      if(!sub){ var k = await callFn("push", { action: "key" }); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(k.pub) }); }
      var last = ""; try{ last = localStorage.getItem(EPK) || ""; }catch(_){}
      var day = new Date().toISOString().slice(0, 10), done = ""; try{ done = localStorage.getItem(EPK + "-day") || ""; }catch(_){}
      if(last === sub.endpoint && done === day) return;   // höchstens 1× am Tag, außer die Adresse hat sich geändert
      await callFn("push", { action: "subscribe", sub: sub.toJSON(), old: oldEp(sub.endpoint) });
      try{ localStorage.setItem(EPK, sub.endpoint); localStorage.setItem(EPK + "-day", day); }catch(_){}
    }catch(_){}
  }
  setTimeout(pushResync, 6000);
  async function pushDisable(){
    try{ localStorage.removeItem(PK); }catch(_){}
    try{ var reg = await navigator.serviceWorker.ready; var sub = await reg.pushManager.getSubscription();
      if(sub){ await callFn("push", { action: "unsubscribe", endpoint: sub.endpoint }).catch(function(){}); await sub.unsubscribe(); } }catch(_){}
    try{ localStorage.removeItem(EPK); }catch(_){}
    callFn("push", { action: "cancel" }).catch(function(){});
    toast2("Mitteilungen aus"); rerender();
  }
  async function pushTest(){
    try{ await callFn("push", { action: "schedule", at: Date.now() + 10000, title: "Satzpause vorbei", body: "" });
      lastEnd = "test"; testUntil = Date.now() + 15000; toast2("Test kommt in 10 Sekunden – jetzt iPhone sperren"); }
    catch(e){ toast2("Test fehlgeschlagen: " + (e.message || e.code)); }
  }
  /* Text der Mitteilung bei Pausenende */
  function restMsg(){ return { title: "Satzpause vorbei", body: "" }; }
  var lastEnd, cancelledFor = null, testUntil = 0;
  setInterval(function(){
    if(!pushOn() || !sess) return;
    if(lastEnd === "test"){ if(Date.now() < testUntil) return; lastEnd = undefined; }
    var end = null; try{ end = (typeof S !== "undefined" && S.active && S.active.restEnd) || null; }catch(_){}
    if(end !== lastEnd){
      var first = lastEnd === undefined; lastEnd = end; cancelledFor = null;
      if(end && end > Date.now() + 4000){ var m = restMsg(); callFn("push", { action: "schedule", at: end, title: m.title, body: m.body }, true).catch(function(){}); }
      else if(!first || !end) callFn("push", { action: "cancel" }, true).catch(function(){});
      return;
    }
    // App ist offen, wenn die Pause endet → die App zeigt selbst den Hinweis, keine doppelte Mitteilung
    if(end && !document.hidden && end - Date.now() < 2500 && cancelledFor !== end){ cancelledFor = end; callFn("push", { action: "cancel" }, true).catch(function(){}); }
  }, 1000);
  document.addEventListener("click", function(ev){
    var b = ev.target.closest && ev.target.closest("[data-gpush]"); if(!b) return;
    ev.preventDefault(); ev.stopPropagation();
    var k = b.getAttribute("data-gpush");
    if(k === "pToggle"){ if(pushOn()) pushDisable(); else pushEnable(); }
    else if(k === "wToggle"){ if(!pushOn()) return; try{ localStorage.setItem(WK, weighOn() ? "0" : "1"); }catch(_){} weighSync(weighOn() ? "Erinnerung um " + tLabel(wTime()) + " an" : "Wiege-Erinnerung aus"); rerender(); }
    else if(k === "eToggle"){ if(!pushOn()) return; try{ localStorage.setItem(EK, protOn() ? "0" : "1"); }catch(_){} weighSync(protOn() ? "Eiweiß-Erinnerung um " + tLabel(eTime()) + " an" : "Eiweiß-Erinnerung aus"); rerender(); }
    else if(k === "on" && !pushOn()) pushEnable(); else if(k === "off" && pushOn()) pushDisable(); else if(k === "test") pushTest();
    else if(k === "wOn" || k === "wOff"){ try{ localStorage.setItem(WK, k === "wOn" ? "1" : "0"); }catch(_){} weighSync(false); rerender(); }
  }, true);
  /* Claude-Verbrauch im laufenden Monat (geschätzt aus den Tokens, die Anthropic bei jeder Antwort meldet) */
  var UK = "ga-usage";
  function usageCache(){ try{ return JSON.parse(localStorage.getItem(UK) || "null"); }catch(_){ return null; } }
  function usageText(u){
    var lim = isOwnerAcc() ? (+CFG.monthlyLimit || 5) : (u && u.lim) || 2;
    if(!u) return "Verbrauch wird geladen …";
    if(u.off) return "Verbrauch noch nicht eingerichtet.";
    if(!isOwnerAcc() && u.allowed === false) return "Claude-Funktionen sind für dein Konto noch nicht freigeschaltet.";
    var eur = function(v){ return v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    return "Diesen Monat: " + u.n + (u.n === 1 ? " Anfrage" : " Anfragen") + " · ca. " + eur(u.cost) + " $ von " + eur(lim) + " $";
  }
  async function usageLoad(){
    var el = document.getElementById("gaUse"); if(!el || !sess) return;
    try{
      var d = new Date(), start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      var t = await token(), r = await fetch(BASE + "/rest/v1/claude_usage?select=cost_usd&created_at=gte." + encodeURIComponent(start),
        { headers: { apikey: KEY, Authorization: "Bearer " + t }, cache: "no-store" });
      var u;
      if(r.status === 404 || r.status === 400){ u = { off: true }; }
      else if(!r.ok) return;
      else { var rows = await r.json(); u = { n: rows.length, cost: rows.reduce(function(a, x){ return a + (+x.cost_usd || 0); }, 0) }; }
      if(u && !u.off && !isOwnerAcc()){ try{ var ar = await fetch(BASE + "/rest/v1/app_access?select=allowed,monthly_limit_usd", { headers: { apikey: KEY, Authorization: "Bearer " + t }, cache: "no-store" });
        var al = ar.ok ? await ar.json() : []; u.allowed = !!(al[0] && al[0].allowed); u.lim = al[0] ? +al[0].monthly_limit_usd : 2; }catch(_){} }
      try{ localStorage.setItem(UK, JSON.stringify(u)); }catch(_){}
      el = document.getElementById("gaUse"); if(el) el.textContent = usageText(u);
    }catch(_){}
  }
  function showPwSet(){
    box('<h2>Passwort festlegen</h2><p>Damit meldest du dich auf weiteren Geräten ohne E-Mail an (' + String((sess && sess.email) || "").replace(/</g, "&lt;") + ').</p>' +
      '<input id="gaNew" type="password" autocomplete="new-password" data-native placeholder="Neues Passwort (mind. 8 Zeichen)">' +
      '<div class="msg" id="gaMsg"></div><button class="pri" id="gaPwSave">Speichern</button><button id="gaPwX">Abbrechen</button>');
    $("gaPwX").onclick = close;
    async function save(){
      var pw = $("gaNew").value; if(pw.length < 8){ msg("Mindestens 8 Zeichen."); return; }
      $("gaPwSave").disabled = true; msg("");
      try{
        for(var i = 0; i < 2; i++){
          var t = await token(i > 0), r;
          try{ r = await fetch(BASE + "/auth/v1/user", { method: "PUT", headers: { apikey: KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) }); }
          catch(e){ throw E("unavailable", "Keine Verbindung"); }
          if(r.status === 401 && i === 0) continue;
          var d = {}; try{ d = await r.json(); }catch(_){}
          if(!r.ok) throw E("auth", d.msg || d.message || d.error_description || ("Fehler " + r.status));
          break;
        }
        close(); toast2("Passwort gespeichert");
      }catch(e){ $("gaPwSave").disabled = false; msg(e.code === "unavailable" ? "Keine Verbindung." : "Nicht gespeichert: " + e.message); }
    }
    $("gaPwSave").onclick = save; onEnter("gaNew", save);
    setTimeout(function(){ try{ $("gaNew").focus(); }catch(_){} }, 50);
  }
  document.addEventListener("click", function(ev){
    var b = ev.target.closest && ev.target.closest("[data-gacc]"); if(!b) return;
    ev.preventDefault(); ev.stopPropagation();
    var k = b.getAttribute("data-gacc");
    if(k === "pw"){ try{ if(typeof closeModal === "function") closeModal(); }catch(_){} showPwSet(); }
    else if(k === "out"){ window.gymArcLogout(); }
    else if(k === "accs"){ accList(); }
    else if(k === "accAllow"){ accSet(b.getAttribute("data-u"), b.getAttribute("data-on") !== "1", +b.getAttribute("data-lim")); }
    else if(k === "accLim"){ accSet(b.getAttribute("data-u"), true, +b.getAttribute("data-lim"), true); }
    else if(k === "accBlock"){ b.textContent = "Wirklich sperren? Nochmal tippen"; b.setAttribute("data-gacc", "accBlockGo"); b.classList.add("go"); }
    else if(k === "accBlockGo"){ b.disabled = true; accBlock(b.getAttribute("data-u"), true); }
    else if(k === "accUnblock"){ b.disabled = true; accBlock(b.getAttribute("data-u"), false); }
    else if(k === "accShowBlocked"){ var el = document.getElementById("gaBlk"); if(el){ var o = el.hidden; el.hidden = !o; b.textContent = (o ? "▾ " : "▸ ") + b.getAttribute("data-t"); } }
  }, true);
  /* Besitzer: alle Konten mit Claude-Kosten je Monat und Freigabe */
  async function rpc(name, body){
    for(var i = 0; i < 2; i++){
      var t = await token(i > 0), r;
      try{ r = await fetch(BASE + "/rest/v1/rpc/" + name, { method: "POST", cache: "no-store", headers: { apikey: KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }); }
      catch(e){ throw E("unavailable", "Keine Verbindung"); }
      if(r.status === 401 && i === 0) continue;
      var tx = await r.text(); if(!r.ok) throw E("rpc", tx.slice(0, 160)); return tx ? JSON.parse(tx) : null;
    }
    throw E("not_granted");
  }
  var usd = function(v){ return (+v || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $"; };
  var dDE = function(s){ return s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–"; };
  var ACC = { all: null };
  function accCard(x, mon, prev){
    var own = !!x.is_owner, on = own || !!x.allowed, lim = +x.monthly_limit_usd || 2;
    return '<div class="ga-acc" data-uid="' + x.user_id + '"><div class="ga-acc-h"><b>' + esc2(x.email || "ohne E-Mail") + (own ? ' <span class="nx">Du</span>' : '') + '</b><span>Konto seit ' + dDE(x.created_at) + ' · zuletzt aktiv ' + dDE(x.last_sign_in_at) + '</span></div>' +
      '<div class="ga-acc-n"><div><span>' + mon + '</span><b>' + usd(x.cost_month) + '</b><em>' + (+x.n_month || 0) + ' Anfragen</em></div><div><span>' + prev + '</span><b>' + usd(x.cost_prev) + '</b><em>' + (+x.n_prev || 0) + ' Anfragen</em></div><div><span>Gesamt</span><b>' + usd(x.cost_total) + '</b><em>&nbsp;</em></div></div>' +
      (own ? '' : '<div class="gs-row"><span>Claude-Funktionen</span><button class="gs-sw' + (on ? ' on' : '') + '" data-gacc="accAllow" data-u="' + x.user_id + '" data-on="' + (on ? 1 : 0) + '" data-lim="' + lim + '" role="switch" aria-checked="' + on + '" aria-label="Claude freigeben"></button></div>' +
        (on ? '<div class="ga-lim"><span>Monatslimit</span>' + [1, 2, 5].map(function(v){ return '<button class="' + (lim === v ? 'on' : '') + '" data-gacc="accLim" data-u="' + x.user_id + '" data-lim="' + v + '">' + v + ' $</button>'; }).join("") + '</div>' : '') +
        '<button class="ga-blk" data-gacc="accBlock" data-u="' + x.user_id + '">Konto sperren</button>') +
      '</div>';
  }
  function accRender(){
    var all = ACC.all || [];
    var L = all.filter(function(x){ return !x.blocked; }), B = all.filter(function(x){ return !!x.blocked; });
    var mon = new Date().toLocaleDateString("de-DE", { month: "long" }), prev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString("de-DE", { month: "long" });
    var sum = L.reduce(function(a, x){ return a + (+x.cost_month || 0); }, 0), sumP = L.reduce(function(a, x){ return a + (+x.cost_prev || 0); }, 0);
    var box = document.getElementById("modalbox"), top = box ? box.scrollTop : 0, blkOpen = !!(document.getElementById("gaBlk") && !document.getElementById("gaBlk").hidden);
    var html = ('<h3>Konten & Kosten</h3><p class="pc-sub" style="margin:-4px 0 12px">Claude gesamt · ' + mon + ': ' + usd(sum) + ' · ' + prev + ': ' + usd(sumP) + '</p>' +
      L.map(function(x){ return accCard(x, mon, prev); }).join("") +
      (B.length ? '<button class="ga-blkt" data-gacc="accShowBlocked" data-t="Gesperrte Konten (' + B.length + ')">' + (blkOpen ? "▾ " : "▸ ") + 'Gesperrte Konten (' + B.length + ')</button><div id="gaBlk"' + (blkOpen ? '' : ' hidden') + '>' +
        B.map(function(x){ return '<div class="ga-acc ga-acc-off"><div class="ga-acc-h"><b>' + esc2(x.email || "ohne E-Mail") + '</b><span>Konto seit ' + dDE(x.created_at) + ' · gesperrt</span></div>' +
          '<button class="ga-blk" data-gacc="accUnblock" data-u="' + x.user_id + '">Entsperren</button></div>'; }).join("") + '</div>' : '') +
      '<p class="nu-hint" style="margin-top:10px">Gesperrte Konten verschwinden aus der Liste, werden sofort abgemeldet und kommen nicht mehr an die App. Ihre Daten bleiben gespeichert. Neue Konten können Claude erst nutzen, wenn du sie hier freigibst. Das Limit gilt pro Monat; dein Anthropic-Limit gilt zusätzlich für alle zusammen.</p>' +
      '<button class="m-btn" data-act="settings" style="margin-top:8px">Zurück</button>');
    // Liste schon offen → nur den Inhalt tauschen (ohne Animation und ohne nach oben zu springen)
    var mt = box && box.querySelector(".m-top");
    if(mt && box.querySelector(".ga-acc")){ box.innerHTML = mt.outerHTML + html; box.scrollTop = top; } else modal(html);
  }
  async function accList(){
    modal('<h3>Konten & Kosten</h3><p class="nu-hint">Wird geladen …</p>');
    try{ ACC.all = await rpc("ga_accounts") || []; accRender(); }
    catch(e){ modal('<h3>Konten & Kosten</h3><p>Konnte nicht geladen werden.</p><button class="m-btn" data-act="settings">Zurück</button>'); }
  }
  // Nur die eine Konto-Karte neu zeichnen – kein Neuladen der ganzen Liste
  function accPatch(uid){
    var x = (ACC.all || []).find(function(a){ return a.user_id === uid; }); var el = document.querySelector('.ga-acc[data-uid="' + uid + '"]'); if(!x || !el) return;
    var mon = new Date().toLocaleDateString("de-DE", { month: "long" }), prev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString("de-DE", { month: "long" });
    el.outerHTML = accCard(x, mon, prev);
  }
  async function accBlock(uid, block){
    try{ await rpc("ga_set_blocked", { target: uid, block: !!block }); toast2(block ? "Konto gesperrt" : "Konto entsperrt");
      var x = (ACC.all || []).find(function(a){ return a.user_id === uid; }); if(x){ x.blocked = !!block; accRender(); } else accList(); }
    catch(e){ toast2("Nicht gespeichert: " + (e.message || e.code)); accRender(); }
  }
  async function accSet(uid, allow, lim, isLim){
    var x = (ACC.all || []).find(function(a){ return a.user_id === uid; }); if(!x) return;
    var old = { allowed: x.allowed, lim: x.monthly_limit_usd };
    x.allowed = !!allow; x.monthly_limit_usd = lim || 2; accPatch(uid);          // sofort umschalten
    try{ await rpc("ga_set_access", { target: uid, allow: !!allow, lim: lim || 2 }); toast2(isLim ? "Monatslimit " + (lim || 2) + " $" : allow ? "Freigegeben" : "Claude für dieses Konto aus"); }
    catch(e){ x.allowed = old.allowed; x.monthly_limit_usd = old.lim; accPatch(uid); toast2("Nicht gespeichert: " + (e.message || e.code)); }
  }
  /* Liste der Claude-Anfragen dieses Monats (wofür, Modell, Kosten) */
  async function usageList(){
    if(!sess) return;
    modal('<h3>Claude-Anfragen</h3><p class="nu-hint">Wird geladen …</p>');
    try{
      var d = new Date(), start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      var t = await token(), r = await fetch(BASE + "/rest/v1/claude_usage?select=created_at,model,cost_usd,what,input_tokens,output_tokens&order=created_at.desc&created_at=gte." + encodeURIComponent(start),
        { headers: { apikey: KEY, Authorization: "Bearer " + t }, cache: "no-store" });
      var rows = r.ok ? await r.json() : [];
      var ct = function(v){ var c = (+v || 0) * 100; return (c < 0.1 ? "<0,1" : c.toLocaleString("de-DE", { maximumFractionDigits: 1 })) + " ct"; };
      var mdl = function(m){ return /haiku/.test(m) ? "Haiku" : /sonnet/.test(m) ? "Sonnet" : /opus/.test(m) ? "Opus" : m; };
      var day = function(s){ var x = new Date(s); return x.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + ", " + x.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); };
      var sum = rows.reduce(function(a, x){ return a + (+x.cost_usd || 0); }, 0);
      modal('<h3>Claude-Anfragen</h3><p class="pc-sub" style="margin:-4px 0 12px">Diesen Monat · ' + rows.length + ' · ca. ' + sum.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $</p>' +
        (rows.length ? '<div class="ga-ul">' + rows.map(function(x){ return '<div class="ga-ur"><div><b>' + esc2(x.what || "Ältere Anfrage") + '</b><span>' + day(x.created_at) + ' · ' + mdl(x.model) + '</span></div><em>' + ct(x.cost_usd) + '</em></div>'; }).join("") + '</div>'
          : '<p class="nu-hint">Diesen Monat noch keine Anfragen.</p>') +
        '<button class="m-btn" data-act="settings" style="margin-top:12px">Zurück</button>');
    }catch(e){ modal('<h3>Claude-Anfragen</h3><p>Konnte nicht geladen werden.</p><button class="m-btn" data-act="settings">Zurück</button>'); }
  }
  document.addEventListener("click", function(ev){ var b = ev.target.closest && ev.target.closest("[data-guse]"); if(!b) return; ev.preventDefault(); ev.stopPropagation(); usageList(); }, true);
  window.gymArcPush = { html: function(){
    var acc = '<div class="fv-l" style="margin-top:18px">Konto</div>' +
      (sess && sess.email ? '<p class="nu-hint" style="margin:-2px 0 8px">Angemeldet als ' + esc2(sess.email) + '</p>' : '') +
      '<div class="st-bk"><button class="m-btn" data-gacc="pw">Passwort</button><button class="m-btn" data-gacc="out">Abmelden</button></div>' +
      (isOwnerAcc() ? '<button class="m-btn" data-gacc="accs" style="margin-top:8px">Konten & Kosten</button>' : '') +
      '<div class="fv-l" style="margin-top:18px">Claude</div><button class="ga-use" data-guse="1"><span id="gaUse">' + usageText(usageCache()) + '</span><i aria-label="Anfragen anzeigen">ⓘ</i></button>';
    setTimeout(usageLoad, 0);
    return acc + healthHTML() + pushHTML();
  } };
  /* Wiege-Erinnerung um 6:55 (Server schickt sie nur, wenn heute noch kein Gewicht eingetragen ist) */
  var WK = "ga-weigh";
  function weighOn(){ try{ return localStorage.getItem(WK) !== "0"; }catch(_){ return true; } }
  var EK = "ga-eprot";
  function protOn(){ try{ return localStorage.getItem(EK) !== "0"; }catch(_){ return true; } }
  function pGoal(){ try{ var T = typeof nuTargets === "function" ? nuTargets() : null; return T && T.p > 0 ? Math.round(T.p) : 0; }catch(_){ return 0; } }
  function tGet(k, d){ try{ var v = localStorage.getItem(k); return /^([01]\d|2[0-3]):[0-5]\d$/.test(v || "") ? v : d; }catch(_){ return d; } }
  function wTime(){ return tGet(WK + "-time", "06:55"); }
  function eTime(){ return tGet(EK + "-time", "20:00"); }
  function tLabel(t){ return t.replace(/^0/, ""); }
  function weighSync(show){
    var g = pGoal();
    callFn("push", { action: "daily", weigh: weighOn(), protein: protOn(), pGoal: g, weighAt: wTime(), proteinAt: eTime() })
      .then(function(){ try{ localStorage.setItem(WK + "-sync", "3"); localStorage.setItem(EK + "-goal", String(g)); }catch(_){} if(show) toast2(show); })
      .catch(function(){ if(show) toast2("Nicht gespeichert – keine Verbindung?"); });
  }
  setTimeout(function(){ try{ if(sess && pushOn() && localStorage.getItem(WK + "-sync") !== "3") weighSync(false); }catch(_){} }, 4000);
  document.addEventListener("change", function(ev){ var t = ev.target; if(!t || !t.dataset || !t.dataset.gtime) return;
    var v = String(t.value || "").slice(0, 5); if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return;
    var isW = t.dataset.gtime === "w"; try{ localStorage.setItem((isW ? WK : EK) + "-time", v); }catch(_){}
    weighSync((isW ? "Wiegen" : "Eiweiß") + " jetzt um " + tLabel(v)); });
  // Eiweißziel geändert (Gewicht, Cut, Angaben) → Server kennt das neue Ziel für die Erinnerung um 20:00
  setInterval(function(){ try{ if(sess && pushOn() && protOn() && String(pGoal()) !== (localStorage.getItem(EK + "-goal") || "")) weighSync(false); }catch(_){} }, 60000);
  function pushHTML(){
    var h = '<div class="fv-l" style="margin-top:18px">Mitteilungen</div><div class="gs-card">';
    if(!pushSupported() || !installed()) return h + '<div class="gs-row dis"><span>Nur in der App vom Home-Bildschirm</span></div></div>';
    if(Notification.permission === "denied") return h + '<div class="gs-row dis"><span>In den iPhone-Einstellungen blockiert</span></div></div>';
    var on = pushOn(), w = on && weighOn(), e = on && protOn();
    return h + '<div class="gs-row"><span>Satzpause vorbei' + (on ? ' <button class="gs-test" data-gpush="test">Testen</button>' : '') + '</span><button class="gs-sw' + (on ? " on" : "") + '" data-gpush="pToggle" role="switch" aria-checked="' + on + '" aria-label="Satzpause vorbei"></button></div>' +
      '<div class="gs-row' + (on ? "" : " dis") + '"><span class="gs-tl">Wiegen<input type="time" class="gs-time" data-gtime="w" value="' + wTime() + '"' + (on ? "" : " disabled") + ' aria-label="Uhrzeit Wiege-Erinnerung"></span><button class="gs-sw' + (w ? " on" : "") + '" data-gpush="wToggle" role="switch" aria-checked="' + w + '" aria-label="Wiege-Erinnerung"' + (on ? "" : " disabled") + '></button></div>' +
      '<div class="gs-row' + (on ? "" : " dis") + '"><span class="gs-tl">Eiweiß<input type="time" class="gs-time" data-gtime="e" value="' + eTime() + '"' + (on ? "" : " disabled") + ' aria-label="Uhrzeit Eiweiß-Erinnerung"></span><button class="gs-sw' + (e ? " on" : "") + '" data-gpush="eToggle" role="switch" aria-checked="' + e + '" aria-label="Eiweiß-Erinnerung"' + (on ? "" : " disabled") + '></button></div></div>';
  }

  /* ---------- Fortschrittsfotos (privat in Supabase Storage) + Vergleich durch Claude ---------- */
  function uidOf(){ try{ var p = sess.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(atob(p + "===".slice((p.length + 3) % 4))).sub; }catch(_){ return null; } }
  async function stor(method, path, body, ctype){
    for(var i = 0; i < 2; i++){
      var t = await token(i > 0), r;
      try{ r = await fetch(BASE + "/storage/v1/" + path, { method: method, cache: "no-store",
          headers: Object.assign({ apikey: KEY, Authorization: "Bearer " + t }, ctype ? { "Content-Type": ctype } : {}), body: body }); }
      catch(e){ throw E("unavailable", "Keine Verbindung"); }
      if(r.status === 401 && i === 0) continue;
      if(!r.ok){ var tx = ""; try{ tx = await r.text(); }catch(_){} throw E(r.status === 404 ? "not_found" : "storage", tx.slice(0, 160) || ("Fehler " + r.status)); }
      return r;
    }
    throw E("not_granted");
  }
  var PH = { list: null, urls: {}, notes: null, busy: false, sel: null, open: false, kfaRun: false };
  var LOCK_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  /* ---------- PIN-Sperre: Fotos standardmäßig ausgeblendet, Anzeigen nur nach PIN (Sichtschutz, gilt bis die App in den Hintergrund geht) ---------- */
  async function pinHash(pin){ var d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("gym-arc-pin:" + (uidOf() || "") + ":" + pin));
    return Array.from(new Uint8Array(d)).map(function(x){ return x.toString(16).padStart(2, "0"); }).join(""); }
  document.addEventListener("visibilitychange", function(){ if(document.hidden && PH.open){ PH.open = false; try{ if(document.querySelector("#modal.open .gph-two, #modal.open [data-gph=del]")) closeModal(); }catch(_){} phRefresh(); } });
  function pinField(id, ph){ return '<input type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="8" id="' + id + '" placeholder="' + ph + '" style="width:100%;box-sizing:border-box;border:0;border-radius:14px;background:var(--tile);color:var(--ink);padding:14px;font:inherit;font-size:22px;letter-spacing:.3em;text-align:center;margin:0 0 10px;outline:none">'; }
  function pinFocus(id){ setTimeout(function(){ try{ document.getElementById(id).focus(); }catch(_){} }, 80); }
  async function pinDialog(){
    var n = await phNotes();
    if(!n.pin){
      modal('<h3>PIN für Fotos festlegen</h3><p>Deine Fortschrittsfotos sind ausgeblendet und werden nur nach Eingabe dieser PIN angezeigt (4–8 Ziffern).</p>' + pinField("gpinA", "Neue PIN") + pinField("gpinB", "PIN wiederholen") +
        '<p class="nu-hint warn" id="gpinMsg" style="display:none"></p><button class="m-btn pri" data-gph="pinset">PIN speichern & Fotos zeigen</button>');
      pinFocus("gpinA"); return; }
    modal('<h3>Fotos anzeigen</h3><p>PIN eingeben</p>' + pinField("gpinA", "PIN") + '<p class="nu-hint warn" id="gpinMsg" style="display:none"></p>' +
      '<button class="m-btn pri" data-gph="pinok">Anzeigen</button><button class="link sm" style="display:block;margin:10px auto 0" data-gph="pinforgot">PIN vergessen?</button>');
    pinFocus("gpinA");
  }
  function pinMsg(t){ var m = document.getElementById("gpinMsg"); if(m){ m.textContent = t; m.style.display = ""; } }
  async function pinSet(){
    var a = (document.getElementById("gpinA") || {}).value || "", b = (document.getElementById("gpinB") || {}).value || "";
    if(!/^\d{4,8}$/.test(a)) return pinMsg("Bitte 4–8 Ziffern."); if(a !== b) return pinMsg("Die PINs stimmen nicht überein.");
    var n = await phNotes(); n.pin = { h: await pinHash(a), t: Date.now() };
    try{ await phSaveNotes(); }catch(e){ return pinMsg("Nicht gespeichert – keine Verbindung?"); }
    PH.open = true; closeModal(); toast2("PIN gespeichert"); phRefresh();
  }
  async function pinOk(){
    var a = (document.getElementById("gpinA") || {}).value || ""; var n = await phNotes();
    if(n.pin && await pinHash(a) === n.pin.h){ PH.open = true; closeModal(); phRefresh(); }
    else { pinMsg("Falsche PIN."); var el = document.getElementById("gpinA"); if(el){ el.value = ""; el.focus(); } }
  }
  function pinForgot(){
    modal('<h3>PIN zurücksetzen</h3><p>Gib das Passwort deines Gym-Arc-Kontos ein, danach legst du eine neue PIN fest.</p>' +
      '<input type="password" id="gpinPw" autocomplete="current-password" placeholder="Passwort" style="width:100%;box-sizing:border-box;border:0;border-radius:14px;background:var(--tile);color:var(--ink);padding:14px;font:inherit;font-size:17px;margin:0 0 10px;outline:none">' +
      '<p class="nu-hint warn" id="gpinMsg" style="display:none"></p><button class="m-btn pri" data-gph="pinreset">Weiter</button>');
    pinFocus("gpinPw");
  }
  async function pinReset(){
    var pw = (document.getElementById("gpinPw") || {}).value || ""; if(!pw) return;
    try{ var d = await authCall("token?grant_type=password", { email: sess.email, password: pw }); keep(d, sess.email); }
    catch(e){ return pinMsg("Passwort falsch."); }
    var n = await phNotes(); delete n.pin; pinDialog();
  }
  async function phList(force){
    if(PH.list && !force) return PH.list;
    var uid = uidOf(); if(!uid) return [];
    var r = await stor("POST", "object/list/photos", JSON.stringify({ prefix: uid, limit: 300, offset: 0, sortBy: { column: "name", order: "desc" } }), "application/json");
    var a = await r.json();
    PH.list = (a || []).filter(function(o){ return /\.jpe?g$/i.test(o.name || ""); }).map(function(o){ return { name: o.name, path: uid + "/" + o.name, day: o.name.slice(0, 10) }; });
    return PH.list;
  }
  async function phUrl(p){
    if(PH.urls[p.path]) return PH.urls[p.path];
    var r = await stor("GET", "object/authenticated/photos/" + p.path.split("/").map(encodeURIComponent).join("/"));
    var u = URL.createObjectURL(await r.blob()); PH.urls[p.path] = u; return u;
  }
  async function phBlob(p){ var r = await fetch(await phUrl(p)); return r.blob(); }
  async function phNotes(){
    if(PH.notes) return PH.notes;
    try{ var rows = await rest("GET", "?select=data&id=eq.photonotes"); PH.notes = (rows && rows[0] && rows[0].data) || { notes: {} }; }catch(_){ PH.notes = { notes: {} }; }
    PH.notes.notes = PH.notes.notes || {}; return PH.notes;
  }
  async function phSaveNotes(){ await upsert([{ id: "photonotes", data: PH.notes }]); }
  function today(){ var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function deDate(day){ try{ return new Date(day + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" }); }catch(_){ return day; } }
  function esc2(t){ return String(t == null ? "" : t).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function phRefresh(){ try{ if(UI.tab === "progress" && typeof renderHome === "function") renderHome(); }catch(_){} }
  async function phFill(){ // Vorschaubilder nachladen
    var row = document.getElementById("gphRow"); if(!row) return;
    var L; try{ L = await phList(); }catch(e){ row.innerHTML = '<p class="pc-sub" style="margin:0">Fotos konnten nicht geladen werden.</p>'; return; }
    if(!L.length){ row.innerHTML = '<p class="pc-sub" style="margin:0">Noch keine Fotos. Am besten alle 2–3 Wochen, morgens, gleiches Licht, gleiche Pose. Zu jedem Foto schätzt Claude den Körperfettanteil.</p>'; return; }
    var nt0 = await phNotes(), KF = nt0.kfa || {};
    var lastK = L.map(function(p){ return { p: p, k: KF[p.name] }; }).find(function(x){ return x.k && x.k.kfa; });
    var kLine = lastK ? '<p class="pc-sub gph-k">Körperfett (KI-Schätzung, ' + deDate(lastK.p.day) + '): <b>' + kfaTxt(lastK.k) + '</b>' + (lastK.k.von && lastK.k.bis ? ' · Spanne ' + lastK.k.von + '–' + lastK.k.bis + ' %' : '') + '</p>' : '';
    // Fotos ohne Körperfett-Schätzung (z. B. vor dem Update hochgeladen) einmal nachträglich schätzen
    if(!PH.kfaRun){ PH.tried = PH.tried || {}; var miss = L.filter(function(p){ return !KF[p.name] && !PH.tried[p.name]; }).slice(0, 5); miss.forEach(function(p){ PH.tried[p.name] = 1; });
      if(miss.length){ PH.kfaRun = true; (async function(){ for(var i = 0; i < miss.length; i++){ try{ await phKfa(miss[i].name, miss[i].day, await phBlob(miss[i])); }catch(_){} } PH.kfaRun = false; })(); } }
    if(!PH.open){
      row.innerHTML = '<button class="gph-lock" data-gph="unlock">' + LOCK_IC + '<span>' + L.length + (L.length === 1 ? ' Foto' : ' Fotos') + ' ausgeblendet</span><em>Anzeigen</em></button>';
      var ok0 = document.getElementById("gphK"); if(ok0) ok0.remove(); if(kLine) row.insertAdjacentHTML("afterend", '<div id="gphK">' + kLine + '</div>');
      var cmp0 = document.getElementById("gphCmp"); if(cmp0) cmp0.style.display = "none"; var nt1 = document.getElementById("gphNote"); if(nt1) nt1.innerHTML = ""; return;
    }
    row.innerHTML = L.slice(0, 30).map(function(p){ var k = KF[p.name]; return '<button class="gph-th" data-gph="view" data-p="' + esc2(p.path) + '"><img alt="" data-src="' + esc2(p.path) + '"><span>' + deDate(p.day) + (k && k.kfa ? '<br><b>' + kfaTxt(k) + '</b> KFA' : '') + '</span></button>'; }).join("");
    var ok1 = document.getElementById("gphK"); if(ok1) ok1.remove();
    row.insertAdjacentHTML("afterend", '<div id="gphK">' + kLine + '<button class="link sm" data-gph="lock" style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;color:var(--muted)"><span style="width:15px;height:15px;display:inline-flex">' + LOCK_IC + '</span>Fotos ausblenden</button></div>');
    var cmp = document.getElementById("gphCmp"); if(cmp) cmp.style.display = L.length >= 2 ? "" : "none";
    L.slice(0, 30).forEach(function(p){ phUrl(p).then(function(u){ var im = row.querySelector('img[data-src="' + p.path + '"]'); if(im) im.src = u; }).catch(function(){}); });
    var n = await phNotes(); var last = L[0] && n.notes[L[0].name];
    var nt = document.getElementById("gphNote"); if(nt) nt.innerHTML = last ? "<b>Letzter Vergleich (" + deDate(L[0].day) + " vs. " + deDate(last.vs) + "):</b> " + esc2(last.kurz || last.text) : "";
  }
  function kgOn(day){ try{ var x = (S.body || []).filter(function(e){ return e.d <= day; }).sort(function(p, q){ return p.d < q.d ? 1 : -1; })[0]; return x ? x.kg : null; }catch(_){ return null; } }
  /* Zu jedem neuen Foto: Körperfett per Claude schätzen */
  async function phKfa(name, day, blob){
    var info = ""; try{ var nu = NU(); info = ((nu.sex === "f" || nu.sex === "w") ? "Frau" : nu.sex === "m" ? "Mann" : "Geschlecht unbekannt") + (nu.height ? ", " + nu.height + " cm" : "") + (nu.age ? ", " + nu.age + " Jahre" : ""); }catch(_){}
    var kg = kgOn(day);
    try{
      toast2("Körperfett wird geschätzt …");
      var r = await SAMPLE.json('Fortschrittsfoto einer Person (' + info + (kg ? ", " + kg + " kg" : "") + ', Krafttraining). Schätze den Körperfettanteil visuell anhand sichtbarer Definition (Bauch, Taille, Schultern, Arme, Venen). ' +
        'Licht, Pose und Pump können täuschen – gib eine realistische Spanne. Wenn auf dem Foto kein Oberkörper erkennbar ist, setze "auswertbar" auf false.\n' +
        'Antworte NUR mit JSON: {"kfa":Zahl,"von":Zahl,"bis":Zahl,"kurz":"ein Satz, woran du es festmachst","auswertbar":true/false}', { images: [blob], modelTier: "default" });
      var k = +r.kfa; var n = await phNotes(); n.kfa = n.kfa || {};
      if(r.auswertbar === false || !(k > 2 && k < 60)){ n.kfa[name] = { none: true, t: Date.now() }; try{ await phSaveNotes(); }catch(_){} toast2("Körperfett auf diesem Foto nicht schätzbar"); phRefresh(); return; }
      k = Math.round(k * 10) / 10;
      n.kfa[name] = { kfa: k, von: +r.von || null, bis: +r.bis || null, kurz: String(r.kurz || "").slice(0, 200), t: Date.now() };
      try{ await phSaveNotes(); }catch(_){}
      // neuestes Foto → Körperzusammensetzung aktualisieren
      var L = await phList(); if(L[0] && L[0].name === name){ try{ var nn = NU(); nn.kfa = k; nn.kfaSrc = "foto"; nn.kfaRange = (+r.von && +r.bis) ? [+r.von, +r.bis] : null; nn.kfaDate = new Date(day + "T12:00:00").getTime(); saveNutri(); }catch(_){} }
      toast2("Körperfett ca. " + String(k).replace(".", ",") + " % (KI-Schätzung)"); phRefresh();
    }catch(e){ toast2("Körperfett-Schätzung fehlgeschlagen"); }
  }
  function kfaTxt(x){ return x && x.kfa ? "~" + String(x.kfa).replace(".", ",") + " %" : ""; }
  async function phUpload(file, quiet, known){
    if(!file || PH.busy) return; PH.busy = true; var ok = false;
    try{
      toast2("Foto wird gespeichert …");
      var bmp = await createImageBitmap(file); var sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      var c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      var blob = await new Promise(function(res){ c.toBlob(function(x){ res(x); }, "image/jpeg", .85); });
      var uid = uidOf(); if(!uid) throw E("not_granted", "Nicht angemeldet");
      var day = today(), name = day + "_" + Date.now() + ".jpg";
      await stor("POST", "object/photos/" + uid + "/" + name, blob, "image/jpeg");
      PH.list = null; ok = true; if(!quiet) toast2("Foto gespeichert"); phRefresh();
    }catch(e){ toast2("Foto nicht gespeichert: " + (e.message || e.code)); }
    finally{ PH.busy = false; }
    if(ok && known && known.kfa){ try{ var NK = await phNotes(); NK.kfa = NK.kfa || {}; NK.kfa[name] = { kfa: Math.round(+known.kfa * 10) / 10, von: +known.von || null, bis: +known.bis || null, kurz: String(known.kurz || "").slice(0, 200), t: Date.now() }; await phSaveNotes(); phRefresh(); }catch(_){} }
    else if(ok){ await phKfa(name, day, blob); }
    if(ok && !quiet && PH.open){ try{ var L = await phList(); if(L.length >= 2) phCompareDialog(); }catch(_){} }
  }
  async function phView(path){
    if(!PH.open) return pinDialog();
    var L = await phList(); var p = L.find(function(x){ return x.path === path; }); if(!p) return;
    var u = await phUrl(p); var NT = await phNotes(), n = NT.notes[p.name], k = (NT.kfa || {})[p.name];
    modal('<h3>' + deDate(p.day) + '</h3><img src="' + u + '" alt="Fortschrittsfoto" style="width:100%;border-radius:16px;display:block;margin-bottom:12px">' +
      (k && k.kfa ? '<p><b>Körperfett ca. ' + String(k.kfa).replace(".", ",") + ' %</b>' + (k.von && k.bis ? ' (Spanne ' + k.von + '–' + k.bis + ' %)' : '') + (k.kurz ? ' – ' + esc2(k.kurz) : '') + '</p>' : k && k.none ? '<p class="nu-hint">Körperfett auf diesem Foto nicht schätzbar.</p>' : '') +
      (n ? '<p><b>Vergleich mit ' + deDate(n.vs) + ':</b> ' + esc2(n.text) + '</p>' : '') +
      '<button class="m-btn red" data-gph="del" data-p="' + esc2(p.path) + '">Foto löschen</button>');
  }
  async function phDelete(path){
    try{ await stor("DELETE", "object/photos", JSON.stringify({ prefixes: [path] }), "application/json"); PH.list = null;
      try{ var nm = path.split("/").pop(), NT = await phNotes(); if(NT.kfa && NT.kfa[nm]){ delete NT.kfa[nm]; await phSaveNotes(); } }catch(_){} try{ closeModal(); }catch(_){} toast2("Foto gelöscht"); phRefresh(); }
    catch(e){ toast2("Löschen fehlgeschlagen: " + (e.message || e.code)); }
  }
  async function phCompareDialog(){
    if(!PH.open) return pinDialog();
    var L = await phList(); if(L.length < 2) return;
    var a = L[0], older = L.slice(1);
    // Vorschlag: das Foto, das am nächsten an 3 Wochen vorher liegt
    var target = new Date(a.day + "T12:00:00").getTime() - 21 * 864e5; var best = older[0];
    older.forEach(function(p){ if(Math.abs(new Date(p.day + "T12:00:00") - target) < Math.abs(new Date(best.day + "T12:00:00") - target)) best = p; });
    PH.sel = best.path;
    var ua = await phUrl(a), ub = await phUrl(best);
    modal('<h3>Fotos vergleichen</h3>' +
      '<div class="gph-two"><figure><img src="' + ub + '" id="gphB" alt=""><figcaption id="gphBd">' + deDate(best.day) + '</figcaption></figure><figure><img src="' + ua + '" alt=""><figcaption>' + deDate(a.day) + '</figcaption></figure></div>' +
      '<div class="fv-l" style="margin-top:12px">Vergleichen mit</div><div class="gph-pick">' + older.slice(0, 20).map(function(p){ return '<button class="' + (p.path === best.path ? "on" : "") + '" data-gph="pick" data-p="' + esc2(p.path) + '">' + deDate(p.day) + '</button>'; }).join("") + '</div>' +
      '<button class="m-btn pri" data-gph="run">Mit Claude vergleichen</button><p class="nu-hint" style="margin-top:8px">Beide Fotos gehen zur Auswertung an Claude (ca. 1–2 Cent) und werden dort nicht gespeichert.</p>');
  }
  async function phPick(path){
    PH.sel = path; var L = await phList(); var p = L.find(function(x){ return x.path === path; }); if(!p) return;
    var im = document.getElementById("gphB"); if(im) im.src = await phUrl(p); var d = document.getElementById("gphBd"); if(d) d.textContent = deDate(p.day);
    document.querySelectorAll('[data-gph="pick"]').forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-p") === path); });
  }
  async function phRun(){
    var L = await phList(); var a = L[0], b = L.find(function(x){ return x.path === PH.sel; }); if(!a || !b) return;
    var info = ""; try{ var n = NU(); info = ((n.sex === "f" || n.sex === "w") ? "Frau" : n.sex === "m" ? "Mann" : "Geschlecht unbekannt") + (n.height ? ", " + n.height + " cm" : "") + (n.age ? ", " + n.age + " Jahre" : ""); }catch(_){}
    var kgA = null, kgB = null; try{ var bl = (S.body || []); var f = function(day){ var x = bl.filter(function(e){ return e.d <= day; }).sort(function(p, q){ return p.d < q.d ? 1 : -1; })[0]; return x ? x.kg : null; }; kgA = f(a.day); kgB = f(b.day); }catch(_){}
    modal('<h3>Claude vergleicht …</h3><p>' + deDate(b.day) + ' → ' + deDate(a.day) + '</p>');
    try{
      var res = await SAMPLE.json('Du bekommst zwei Fortschrittsfotos derselben Person (' + info + ') in einer Diät-/Cut-Phase mit Krafttraining. Bild 1 = früher (' + b.day + (kgB ? ", " + kgB + " kg" : "") + '), Bild 2 = jetzt (' + a.day + (kgA ? ", " + kgA + " kg" : "") + ').\n' +
        'Vergleiche sachlich und konkret, was sich sichtbar verändert hat (Bauch, Taille, Brust, Schultern, Arme, Rücken, Definition). Berücksichtige, dass Licht, Pose und Pump das Bild verfälschen können, und sag es, wenn die Fotos schlecht vergleichbar sind.\n' +
        'Antworte NUR mit JSON: {"kurz":"ein Satz Fazit","text":"3–5 Sätze Details","kfa_jetzt":Zahl oder null,"vergleichbar":true/false}',
        { images: [await phBlob(b), await phBlob(a)], modelTier: "default" });
      var n2 = await phNotes(); n2.notes[a.name] = { vs: b.day, kurz: String(res.kurz || "").slice(0, 200), text: String(res.text || res.kurz || "").slice(0, 1200), kfa: +res.kfa_jetzt || null, t: Date.now() };
      try{ await phSaveNotes(); }catch(_){}
      var kj = +res.kfa_jetzt;
      if(kj > 2 && kj < 60){ try{ var nn = NU(); nn.kfa = Math.round(kj * 10) / 10; nn.kfaSrc = "foto"; nn.kfaRange = null; nn.kfaDate = new Date(a.day + "T12:00:00").getTime(); saveNutri(); }catch(_){} }
      modal('<h3>' + deDate(b.day) + ' → ' + deDate(a.day) + '</h3><p><b>' + esc2(res.kurz || "") + '</b></p><p>' + esc2(res.text || "") + '</p>' +
        (kj > 2 && kj < 60 ? '<p class="nu-hint">Körperfett jetzt ca. ' + esc2(Math.round(kj * 10) / 10) + ' % (± 3–5 %) – in Körperzusammensetzung übernommen.</p>' : '') +
        (res.vergleichbar === false ? '<p class="nu-hint warn">Die Fotos sind nur eingeschränkt vergleichbar – nächstes Mal gleiches Licht und gleiche Pose.</p>' : '') +
        '<button class="m-btn pri" data-act="closeModal">Fertig</button>');
      phRefresh();
    }catch(e){ modal('<h3>Vergleich fehlgeschlagen</h3><p>' + esc2(e.message || e.code || "Unbekannter Fehler") + '</p><button class="m-btn" data-act="closeModal">Schließen</button>'); }
  }
  document.addEventListener("click", function(ev){
    var b = ev.target.closest && ev.target.closest("[data-gph]"); if(!b) return;
    var k = b.getAttribute("data-gph"); if(k === "add") return;   // Datei-Auswahl läuft über das Label
    ev.preventDefault(); ev.stopPropagation();
    var p = b.getAttribute("data-p");
    if(k === "unlock") pinDialog(); else if(k === "lock"){ PH.open = false; phRefresh(); } else if(k === "pinset") pinSet(); else if(k === "pinok") pinOk(); else if(k === "pinforgot") pinForgot(); else if(k === "pinreset") pinReset();
    else if(k === "view") phView(p); else if(k === "del") phDelete(p); else if(k === "cmp") phCompareDialog(); else if(k === "pick") phPick(p); else if(k === "run") phRun();
  }, true);
  // Eigene Zahlentastatur: PIN prüft sich beim Tippen selbst (kein extra Tippen auf „Anzeigen“ nötig)
  document.addEventListener("input", function(ev){ var t = ev.target; if(!t || (t.id !== "gpinA" && t.id !== "gpinB")) return;
    var isSet = !!document.querySelector('[data-gph="pinset"]'), A = document.getElementById("gpinA"), B = document.getElementById("gpinB");
    if(isSet){ if(t.id === "gpinB" && B.value.length >= 4 && B.value.length === A.value.length) pinSet(); return; }
    if(A.value.length >= 4){ var v = A.value; phNotes().then(function(n){ return n.pin ? pinHash(v).then(function(h){ if(h === n.pin.h && A.value === v){ PH.open = true; closeModal(); phRefresh(); } }) : null; }); } });
  document.addEventListener("keydown", function(ev){ if(ev.key !== "Enter" || !ev.target || !/^gpin/.test(ev.target.id || "")) return; ev.preventDefault();
    var id = ev.target.id; if(id === "gpinPw") pinReset(); else if(document.querySelector('[data-gph="pinset"]')){ if(id === "gpinA") document.getElementById("gpinB").focus(); else pinSet(); } else pinOk(); });
  document.addEventListener("change", function(ev){ if(ev.target && ev.target.id === "gphIn"){ var f = ev.target.files && ev.target.files[0]; ev.target.value = ""; phUpload(f); } });
  /* Tippen auf eine Mitteilung: direkt an die passende Stelle (Satzpause → aktiver Satz, Wiegen → Gewicht, Eiweiß → Tracking) */
  function gaOpen(kind){
    try{
      if(kind === "rest"){
        if(!S.active) return;
        try{ closeModal(); }catch(_){} try{ hideRestDone(); }catch(_){} try{ var l = restLeft(); if(l != null && l <= 0) stopRest(); }catch(_){}
        var sh = document.getElementById("exsheet");
        if(!(sh && sh.classList.contains("open"))) resumeWorkout();
        setTimeout(function(){ var r = document.querySelector("#exsheet .set-r.active") || document.querySelector("#exsheet .set-r:not(.done):not(.warm)"); if(r) r.scrollIntoView({ block: "center", behavior: "smooth" }); }, 250);
      } else if(kind === "weigh"){
        var b = document.createElement("button"); b.setAttribute("data-act", "goWeight"); b.style.display = "none"; document.body.appendChild(b); b.click(); b.remove();
      } else if(kind === "protein"){
        try{ closeModal(); }catch(_){}
        UI.tab = "nutrition"; UI.nuTab = "track"; renderHome(); scrollTo(0, 0);
      }
    }catch(_){}
  }
  try{ navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", function(ev){ var k = ev.data && ev.data.gaOpen; if(k) setTimeout(function(){ gaOpen(k); }, 150); }); }catch(_){}
  (function(){ try{ var q = new URLSearchParams(location.search), k = q.get("open"); if(!k) return; history.replaceState(null, "", location.pathname);
    var n = 0, t = setInterval(function(){ n++; if((typeof S !== "undefined" && S && (k !== "rest" || S.active) && document.getElementById("home") && document.getElementById("home").children.length) || n > 40){ clearInterval(t); gaOpen(k); } }, 250); }catch(_){} })();
  window.gymArcRecipe = { load: function(url){ return callFn("recipe", { url: url }); } };
  window.gymArcPhotos = { upload: phUpload, html: function(){
    if(!sess) return "";
    setTimeout(phFill, 0);
    return '<div class="pcard gph"><div class="pc-h"><h3>Fortschrittsfotos</h3><span>' + '<label class="pill-btn" data-gph="add">+ Foto<input type="file" id="gphIn" accept="image/*" style="display:none"></label></span></div>' +
      '<div class="gph-row" id="gphRow"><p class="pc-sub" style="margin:0">Fotos werden geladen …</p></div>' +
      '<p class="pc-sub" id="gphNote" style="margin:10px 0 0"></p>' +
      '<button class="m-btn" id="gphCmp" data-gph="cmp" style="display:none;margin-top:12px">Mit früherem Foto vergleichen</button></div>';
  } };

  /* ---------- Apple Health: Schritte + aktive Kalorien (kommen per Kurzbefehl an die Funktion "health") ---------- */
  var HL = { data: null, at: 0 };
  async function hlLoad(force){
    if(!sess) return null; if(HL.data && !force && Date.now() - HL.at < 60000) return HL.data;
    try{ var rows = await rest("GET", "?select=data&id=eq.health"); var d = rows && rows[0] && rows[0].data; var changed = JSON.stringify(d) !== JSON.stringify(HL.data); HL.data = d || null; HL.at = Date.now();
      if(changed){ try{ if(UI.tab === "nutrition" && typeof renderHome === "function" && !document.querySelector("#modal.open")) renderHome(); }catch(_){} } }catch(_){}
    return HL.data;
  }
  document.addEventListener("visibilitychange", function(){ if(!document.hidden) hlLoad(true); });
  setTimeout(function(){ hlLoad(true); }, 2500);
  window.gymArcHealth = {
    // Tagesziel an die Bewegung anpassen: 75 % der Abweichung vom eigenen 28-Tage-Schnitt, höchstens ± 250 kcal, erst ab 7 Tagen Daten
    day: function(k){
      var D = HL.data && HL.data.days; if(!D) { hlLoad(); return null; }
      var x = D[k]; if(!x) return null;
      var keys = Object.keys(D).filter(function(d){ return d < k && D[d] && D[d].active != null; }).sort().slice(-28);
      var bonus = 0;
      if(keys.length >= 7 && x.active != null){
        var avg = keys.reduce(function(s, d){ return s + D[d].active; }, 0) / keys.length;
        bonus = Math.max(-250, Math.min(250, Math.round((x.active - avg) * 0.75 / 10) * 10));
      }
      return { steps: x.steps, active: x.active, bonus: bonus, n: keys.length };
    }
  };
  async function hlToken(fresh){
    try{
      var d = await callFn("health", { action: fresh ? "newtoken" : "token" });
      var url = BASE + "/functions/v1/health";
      modal('<h3>Apple Health verbinden</h3><p>Lege in der Kurzbefehle-App einen Kurzbefehl an (Anleitung unten). Er braucht diese zwei Angaben:</p>' +
        '<div class="fv-l">Adresse</div><div class="gh-copy"><code id="ghUrl">' + url + '</code><button class="pill-btn" data-ghc="ghUrl">Kopieren</button></div>' +
        '<div class="fv-l" style="margin-top:10px">Dein Schlüssel</div><div class="gh-copy"><code id="ghTok">' + d.token + '</code><button class="pill-btn" data-ghc="ghTok">Kopieren</button></div>' +
        '' +
        '<div class="fv-l" style="margin-top:12px">Kurzbefehl</div><ol class="gh-steps">' +
        '<li><b>Health-Beispiele suchen</b> („Find Health Samples“): Typ <b>Schritte</b>, Startdatum <b>ist heute</b></li>' +
        '<li><b>Statistik berechnen</b> („Calculate Statistics“): <b>Summe</b> → umbenennen in <i>Schritte</i></li>' +
        '<li>Nochmal <b>Health-Beispiele suchen</b>: Typ <b>Aktive Energie</b>, Startdatum <b>ist heute</b> → <b>Statistik berechnen: Summe</b> → umbenennen in <i>Aktiv</i></li>' +
        '<li><b>Inhalte von URL abrufen</b> („Get Contents of URL“): Adresse von oben, Methode <b>POST</b>, Hauptteil <b>JSON</b> mit drei Feldern: <code>token</code> (Text: dein Schlüssel), <code>steps</code> (Zahl: <i>Schritte</i>), <code>active</code> (Zahl: <i>Aktiv</i>)</li>' +
        '<li>Unter <b>Automation</b> → <b>App</b> → eine App, die du mehrmals täglich öffnest (z. B. <b>Instagram</b>) → <b>Wird geöffnet</b> → <b>Sofort ausführen</b> → den Kurzbefehl auswählen</li></ol>' +
        '<p class="nu-hint" style="margin-top:8px">Warum nicht nach Uhrzeit? Bei gesperrtem iPhone gibt iOS keine Health-Daten heraus – eine Automation zur festen Uhrzeit läuft dann ins Leere. Beim Öffnen einer App ist das iPhone immer entsperrt.</p>' +
        '<button class="m-btn pri" data-act="closeModal">Fertig</button>' +
        (fresh ? '' : '<button class="m-btn" data-ghnew="1" style="margin-top:8px">Neuen Schlüssel erzeugen</button>'));
      if(fresh) toast2("Neuer Schlüssel – im Kurzbefehl ersetzen");
    }catch(e){ toast2("Nicht möglich: " + (e.message || e.code)); }
  }
  document.addEventListener("click", function(ev){
    var b = ev.target.closest && ev.target.closest("[data-ghc],[data-gh],[data-ghnew]"); if(!b) return;
    ev.preventDefault(); ev.stopPropagation();
    if(b.hasAttribute("data-ghnew")){ if(!b.dataset.sure){ b.dataset.sure = "1"; b.textContent = "Sicher? Alter Schlüssel wird ungültig"; b.classList.add("red"); return; } try{ closeModal(); }catch(_){} hlToken(true); return; }
    if(b.hasAttribute("data-gh")){ try{ closeModal(); }catch(_){} hlToken(); return; }
    var el = document.getElementById(b.getAttribute("data-ghc")); if(!el) return;
    try{ navigator.clipboard.writeText(el.textContent).then(function(){ toast2("Kopiert"); }); }catch(_){ toast2("Bitte lange drücken und kopieren"); }
  }, true);
  // Zustand merken, damit „Verbunden“ sofort angezeigt wird, auch bevor die Daten geladen sind
  function hlKnown(){ try{ return localStorage.getItem("ga-health-ok") === "1"; }catch(_){ return false; } }
  function hlLabel(ok){ if(ok === undefined){ var D = HL.data && HL.data.days; ok = D ? Object.keys(D).length > 0 : hlKnown(); }
    try{ if(HL.data) localStorage.setItem("ga-health-ok", ok ? "1" : "0"); }catch(_){}
    return ok ? "✓ Verbunden · neu einrichten" : "Schritte & aktive Kalorien verbinden"; }
  function healthHTML(){
    var D = HL.data && HL.data.days, ok = D ? Object.keys(D).length > 0 : hlKnown();
    if(!HL.data) hlLoad(true).then(function(){ var b = document.getElementById("gaHlBtn"); if(b) b.textContent = hlLabel(); });
    return '<div class="fv-l" style="margin-top:18px">Apple Health</div><button class="m-btn" id="gaHlBtn" data-gh="1" style="margin:0">' + hlLabel(ok) + '</button>';
  }

  window.claude = {
    use: async function(name){
      if(name === "db"){ await READY; return DB; }
      if(name === "user"){ await READY; return USER; }
      if(name === "sample") return SAMPLE;
      return null;   // downloads usw.: die App nutzt dann den normalen Browser-Download
    }
  };
  window.gymArcLogout = function(){ store(null); try{ localStorage.removeItem("ga-usage"); localStorage.removeItem("ga-health-ok"); }catch(_){} location.reload(); };
})();
