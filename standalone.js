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
    document.write('<link rel="manifest" href="manifest.webmanifest">' +
      '<link rel="apple-touch-icon" href="icon-180.png">' +
      '<meta name="apple-mobile-web-app-capable" content="yes">' +
      '<meta name="mobile-web-app-capable" content="yes">' +
      '<meta name="apple-mobile-web-app-title" content="Gym Arc">' +
      '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">');
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
      if(r.status === 401 && i === 0) continue;
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
    id: async function(){ return OWNER; }, me: async function(){ return { id: OWNER, name: "" }; },
    isOwner: function(){ return true; }, canEdit: function(){ return true; }, can: function(){ return true; },
    profiles: async function(){ return {}; }, search: async function(){ return []; }
  };

  /* ---------- Claude über die eigene Server-Funktion (Schlüssel bleibt bei Supabase) ---------- */
  async function shrink(b){
    try{ var bmp = await createImageBitmap(b); var sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      var c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return await new Promise(function(res){ c.toBlob(function(x){ res(x || b); }, "image/jpeg", .85); });
    }catch(_){ return b; }
  }
  async function b64(blob){
    var b = blob;
    if(b.size > 1200000 || !/^image\/(jpeg|png|webp|gif)$/.test(b.type || "")) b = await shrink(b);
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
    box('<h2>Anmelden</h2><p>Gib deine E-Mail-Adresse ein. Du bekommst einen Link zum Anmelden.</p>' +
      '<input id="gaMail" type="email" autocomplete="email" inputmode="email" data-native placeholder="E-Mail-Adresse" value="' + String(email || CFG.email || "").replace(/"/g, "") + '">' +
      '<div class="msg" id="gaMsg"></div><button class="pri" id="gaSend">Anmelde-Link senden</button>');
    async function send(){
      var em = $("gaMail").value.trim().toLowerCase(); if(!/^\S+@\S+\.\S+$/.test(em)){ msg("Bitte eine gültige E-Mail-Adresse eingeben."); return; }
      $("gaSend").disabled = true; msg("");
      try{ await authCall("otp?redirect_to=" + encodeURIComponent(location.origin + location.pathname), { email: em, create_user: true }); showCode(em); }
      catch(e){ $("gaSend").disabled = false; msg(e.code === "rate_limited" ? "Zu viele Versuche – bitte kurz warten." : e.code === "unavailable" ? "Keine Verbindung." : "Senden fehlgeschlagen: " + e.message); }
    }
    $("gaSend").onclick = send; onEnter("gaMail", send);
  }
  function showCode(em){
    box('<h2>E-Mail prüfen</h2><p>Wir haben dir eine E-Mail an <b>' + em.replace(/</g, "&lt;") + '</b> geschickt.</p>' +
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
      catch(e){ $("gaVerify").disabled = false; msg(e.code === "unavailable" ? "Keine Verbindung." : "Code ungültig oder abgelaufen."); }
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
      days: s.days || null, planName: s.planName || null, profile: s.profile || null, resets: s.resets || null } });
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
    try{ var any = await rest("GET", "?select=id&limit=1"); if(!any || !any.length) await showMigrate(); }catch(_){}
    close(); readyResolve();
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
      await callFn("push", { action: "subscribe", sub: sub.toJSON() });
      localStorage.setItem(PK, "1"); toast2("Mitteilungen an"); lastEnd = undefined;
    }catch(e){ toast2("Einschalten fehlgeschlagen: " + (e.message || e.code)); }
    rerender();
  }
  async function pushDisable(){
    try{ localStorage.removeItem(PK); }catch(_){}
    try{ var reg = await navigator.serviceWorker.ready; var sub = await reg.pushManager.getSubscription();
      if(sub){ await callFn("push", { action: "unsubscribe", endpoint: sub.endpoint }).catch(function(){}); await sub.unsubscribe(); } }catch(_){}
    callFn("push", { action: "cancel" }).catch(function(){});
    toast2("Mitteilungen aus"); rerender();
  }
  async function pushTest(){
    try{ await callFn("push", { action: "schedule", at: Date.now() + 10000, title: "Schräge Brustpresse", body: "50 kg · 8 Wdh · Satz 2 – Pause vorbei" });
      lastEnd = "test"; testUntil = Date.now() + 15000; toast2("Test kommt in 10 Sekunden – jetzt iPhone sperren"); }
    catch(e){ toast2("Test fehlgeschlagen: " + (e.message || e.code)); }
  }
  /* Text wie im Hinweis „Pause vorbei“ der App: nächste Übung, Gewicht, Wiederholungen, Satz */
  function restMsg(){
    try{
      var a = S.active, w = W(a.workoutId), id = UI.ex || UI.lastEx, x = id && a.ex[id], e = id && w.exercises.find(function(o){ return o.id === id; });
      var kg = function(s){ var v = num(s.kg); return fmtNum(v == null ? 0 : v); };
      if(x && e){
        var i = x.sets.findIndex(function(s){ return !s.done; });
        if(i >= 0){ var s = x.sets[i]; return { title: e.name, body: kg(s) + " kg · " + (s.reps != null ? s.reps : e.reps) + " Wdh · Satz " + (i + 1) + " – Pause vorbei" }; }
        var n = nextOpen(w, id);
        if(n){ var s2 = a.ex[n.id].sets[0]; return { title: n.name, body: kg(s2) + " kg · " + (s2.reps != null ? s2.reps : n.reps) + " Wdh · nächste Übung – Pause vorbei" }; }
      }
    }catch(_){}
    return { title: "Pause vorbei", body: "Weiter geht's mit dem nächsten Satz" };
  }
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
    if(k === "on" && !pushOn()) pushEnable(); else if(k === "off" && pushOn()) pushDisable(); else if(k === "test") pushTest();
  }, true);
  window.gymArcPush = { html: function(){
    var h = '<div class="fv-l" style="margin-top:18px">Mitteilungen</div>';
    if(!pushSupported() || !installed()) return h + '<p class="st-hint">Meldung bei Pausenende gibt es nur in der App vom Home-Bildschirm (Safari → Teilen → Zum Home-Bildschirm).</p>';
    if(Notification.permission === "denied") return h + '<p class="st-hint">Mitteilungen sind blockiert. Erlauben unter iPhone-Einstellungen → Mitteilungen → Gym Arc.</p>';
    var on = pushOn();
    return h + '<div class="st-seg"><button class="' + (on ? "on" : "") + '" data-gpush="on">An</button><button class="' + (on ? "" : "on") + '" data-gpush="off">Aus</button></div>' +
      '<p class="st-hint" style="margin-top:-10px">Meldet sich bei gesperrtem iPhone, wenn die Satzpause vorbei ist.' + (on ? ' <a href="#" data-gpush="test" style="color:var(--accent);font-weight:600;text-decoration:none">Testen</a>' : '') + '</p>';
  } };

  window.claude = {
    use: async function(name){
      if(name === "db"){ await READY; return DB; }
      if(name === "user"){ await READY; return USER; }
      if(name === "sample") return SAMPLE;
      return null;   // downloads usw.: die App nutzt dann den normalen Browser-Download
    }
  };
  window.gymArcLogout = function(){ store(null); location.reload(); };
})();
