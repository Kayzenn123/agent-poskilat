/* =====================================================================
 * POSKILAT — motion.js : lapisan gerak "kertas keluar dari printer"
 * Vanilla JS + CSS, TANPA library (target Lighthouse tinggi).
 *
 * Kontrak DOM (dibaca defensif — semua query di-guard, aman no-op):
 *   #tulis, #perangko            section kamera (A)
 *   .mq-1/.mq-2/.mq-3 > .mq-track  band marquee (B)
 *   #jeda-marquee                tombol jeda marquee (B)
 *   h1, h2                       split flip 3D (C)
 *   .stamp-card                  kartu perangko (D); warna via
 *                                data-tinta="oklch(...)" ATAU dicocokkan ke
 *                                window.STAMPS[i].tinta via data-city
 *   #term-input                  prompt terminal (D: magnetic di-SKIP)
 *   section                      reveal blob (E) — overlay .ink-blob
 *                                dibuat otomatis bila belum ada
 *   #gerak-toggle                tombol "Gerak: Nyala/Mati"
 *   window.STAMPS                 array kota {nama|name, tinta}
 *
 * API: window.Motion = { init(), setMotion(on) }
 * localStorage: "kartupos-gerak" = "on" | "off"
 * ===================================================================== */
(function () {
  'use strict';

  var LS_KEY = 'kartupos-gerak';
  var CITIES_FALLBACK = ['Jakarta', 'Bandung', 'Yogyakarta', 'Surabaya',
    'Medan', 'Makassar', 'Denpasar', 'Semarang', 'Palembang', 'Pontianak',
    'Banda Aceh', 'Bukittinggi', 'Balikpapan', 'Manado', 'Jayapura', 'Solo'];

  /* Dua path blob dengan struktur perintah IDENTIK (C x3 + Z)
   * agar CSS `d: path()` bisa menginterpolasi di Chromium. */
  var BLOB_A = 'M50 6 C74 6 94 24 94 50 C94 76 74 94 50 94 C26 94 6 76 6 50 C6 24 26 6 50 6 Z';
  var BLOB_B = 'M50 14 C70 8 90 24 88 48 C86 72 70 90 48 88 C26 86 8 72 10 48 C12 24 30 20 50 14 Z';

  var state = {
    on: true, note: '', inited: false,
    raf: 0, camZones: [], bands: [], tracks: [],
    userPausedMarquee: false, autoPausedMarquee: false,
    splitDone: false, fps: { n: 0, t0: 0, checked: false },
    lastY: 0, skew: 0, camIO: null, revealIO: null, flipIO: null
  };

  /* ---------------- util ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function store(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function readStore(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }

  function prefersReduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function saveDataOn() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(c && (c.saveData === true || /^(2g|slow-2g)$/.test(c.effectiveType || '')));
  }
  function weakCpu() { return (navigator.hardwareConcurrency || 8) <= 4; }

  /* Urutan: reduced-motion selalu menang > pilihan user > mode ringan otomatis. */
  function resolveEnabled() {
    if (prefersReduced()) return { on: false, reason: 'reduced-motion' };
    var stored = readStore(LS_KEY);
    if (stored === 'off') return { on: false, reason: 'user-toggle' };
    if (stored === 'on') return { on: true, reason: 'user-toggle' };
    if (saveDataOn()) return { on: false, reason: 'save-data' };
    if (weakCpu()) return { on: false, reason: 'hardware' };
    return { on: true, reason: 'default' };
  }

  function status(msg) {
    var el = $('#motion-status');
    if (el) el.textContent = msg;
    if (window.console && console.info) console.info('[motion] ' + msg);
  }

  /* ---------------- CSS lapisan gerak (injeksi sendiri) ---------------- */
  var MOTION_CSS = [
    ':root{--mq-skew:0deg}',
    /* B: marquee */
    '.mq-1,.mq-2,.mq-3{overflow:hidden;transform:skewX(var(--mq-skew,0deg))}',
    '.mq-track{display:inline-flex;white-space:nowrap;will-change:transform;',
    ' animation:mq-scroll var(--mq-dur,40s) linear infinite}',
    '@keyframes mq-scroll{to{transform:translateX(-50%)}}',
    'html[data-motion="off"] .mq-track{animation:none;transform:none}',
    '@media (prefers-reduced-motion:reduce){.mq-track{animation:none!important}}',
    /* C: flip huruf */
    '.fx-split{display:inline-block;perspective:700px}',
    '.fx-char{display:inline-block;transform:rotateX(92deg);transform-origin:50% 100%;opacity:0;',
    ' transition:transform .55s cubic-bezier(.2,.7,.25,1.15),opacity .35s ease;',
    ' transition-delay:calc(var(--i,0)*26ms)}',
    '.fx-in .fx-char{transform:rotateX(0deg);opacity:1}',
    'html[data-motion="off"] .fx-char{transform:none;opacity:1;transition:none}',
    '@media (prefers-reduced-motion:reduce){.fx-char{transform:none!important;opacity:1!important;transition:none!important}}',
    /* E: ink blob */
    'section{position:relative}',
    '.ink-blob{position:absolute;top:0;left:0;right:0;height:220px;max-height:60%;',
    ' pointer-events:none;z-index:0;opacity:.55}',
    '.ink-blob svg{width:100%;height:100%;display:block}',
    '.ink-path{fill:var(--accent,#3b4bd8);opacity:.14;',
    ' d:path("' + BLOB_A + '");',
    ' transition:d 1.2s ease-in-out,opacity .8s ease}',
    'section.revealed .ink-path{d:path("' + BLOB_B + '");opacity:.26}',
    '@supports not (d:path("")){.ink-path{transition:opacity .8s ease}}',
    'html[data-motion="off"] .ink-blob{display:none}',
    '@media (prefers-reduced-motion:reduce){.ink-blob{display:none}}',
    /* util */
    '.sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;',
    ' overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
    '#tulis,#perangko{transform-origin:50% 40%}'
  ].join('\n');

  function injectCSS() {
    if ($('#motion-layer-css')) return;
    var s = document.createElement('style');
    s.id = 'motion-layer-css';
    s.textContent = MOTION_CSS;
    document.head.appendChild(s);
  }

  function ensureStatusNode() {
    if ($('#motion-status')) return;
    var p = document.createElement('p');
    p.id = 'motion-status';
    p.className = 'sr-only';
    p.setAttribute('role', 'status');
    document.body.appendChild(p);
  }

  /* ---------------- A. Kamera: zoom scrub + pan scrub ---------------- */
  /* p: 0 saat tepi atas section menyentuh bawah viewport, 1 saat mencapai atas. */
  function scrubProgress(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || 1;
    return clamp((vh - r.top) / vh, 0, 1);
  }

  function applyCamera() {
    state.camZones.forEach(function (z) {
      var r = z.el.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      if (r.top > vh * 1.25) { z.el.style.transform = ''; return; } // belum masuk: identitas
      var p = scrubProgress(z.el);
      if (z.kind === 'zoom') {
        var s = 1 + 0.06 * p;
        z.el.style.transform = 'scale(' + s.toFixed(4) + ')';
      } else { // pan kanan: translateX 0 -> -8vw
        var x = -0.08 * p * (window.innerWidth || 1);
        z.el.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
      }
    });
  }

  function resetCamera() {
    state.camZones.forEach(function (z) { z.el.style.transform = ''; });
  }

  function setupCamera() {
    var tulis = document.getElementById('tulis');
    var perangko = document.getElementById('perangko');
    if (tulis) state.camZones.push({ el: tulis, kind: 'zoom', inView: false });
    if (perangko) state.camZones.push({ el: perangko, kind: 'pan', inView: false });
    if (!state.camZones.length || !('IntersectionObserver' in window)) return;
    state.camIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        state.camZones.forEach(function (z) {
          if (z.el === e.target) {
            z.inView = e.isIntersecting;
            if (!e.isIntersecting) {
              var r = z.el.getBoundingClientRect();
              if (r.top > (window.innerHeight || 1)) z.el.style.transform = '';
            }
          }
        });
      });
      pumpLoop();
    }, { threshold: 0, rootMargin: '60px 0px' });
    state.camZones.forEach(function (z) { state.camIO.observe(z.el); });
  }

  /* ---------------- loop rAF tunggal: kamera + skew + fps ---------------- */
  function tick(t) {
    if (!state.on) { state.raf = 0; return; }
    // fps monitor 2 detik pertama
    var f = state.fps;
    if (!f.checked) {
      if (!f.t0) f.t0 = t || performance.now();
      f.n++;
      if ((t || performance.now()) - f.t0 >= 2000) {
        f.checked = true;
        var fps = f.n / (((t || performance.now()) - f.t0) / 1000);
        if (fps < 40 && state.on) {
          setMotion(false, 'low-fps');
          status('Gerak dimatikan otomatis: fps ' + Math.round(fps) + ' < 40 (mode ringan)');
          return;
        }
      }
    }
    // A: kamera
    if (state.camZones.some(function (z) { return z.inView; })) applyCamera();
    // B: skew mengikuti velocity scroll (maks 8deg)
    var y = window.scrollY || window.pageYOffset || 0;
    var v = y - state.lastY;
    state.lastY = y;
    var target = clamp(v * 0.6, -8, 8);
    state.skew += (target - state.skew) * 0.18;
    if (Math.abs(state.skew) > 0.05 && state.bands.length) {
      var sk = state.skew.toFixed(2) + 'deg';
      state.bands.forEach(function (b) { b.style.setProperty('--mq-skew', sk); });
    } else if (state.bands.length && state.bands[0].style.getPropertyValue('--mq-skew')) {
      state.bands.forEach(function (b) { b.style.removeProperty('--mq-skew'); });
    }
    state.raf = requestAnimationFrame(tick);
  }

  function pumpLoop() {
    var need = state.on && (state.camZones.some(function (z) { return z.inView; }) || state.bands.length > 0);
    if (need && !state.raf) { state.lastY = window.scrollY || 0; state.raf = requestAnimationFrame(tick); }
    if (!need && state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
  }

  /* ---------------- B. Marquee ---------------- */
  function stampList() {
    try {
      var S = window.STAMPS;
      if (S && S.length) return S; // array langsung
      if (S && S.CITIES && S.CITIES.length) return S.CITIES; // {CITIES:[...]}
    } catch (e) {}
    return [];
  }

  function stampNames() {
    var S = stampList();
    if (S.length) {
      var out = [];
      for (var i = 0; i < S.length; i++) {
        out.push(S[i].nama || S[i].name || S[i].kota || S[i].city || ('Kota ' + (i + 1)));
      }
      return out;
    }
    return CITIES_FALLBACK.slice();
  }

  function serials() {
    var s = [];
    for (var i = 0; i < 8; i++) {
      s.push('KP-2026-' + String(1000 + Math.floor(Math.random() * 9000)));
    }
    return s;
  }

  function fillBand(band, text) {
    var track = $('.mq-track', band);
    if (!track) return;
    var half = '<span>' + text + '</span>';
    track.innerHTML = half + half; // 2 salinan identik -> loop mulus translateX(-50%)
    track.setAttribute('aria-hidden', 'true');
    var sr = $('.mq-static', band);
    if (!sr) {
      sr = document.createElement('span');
      sr.className = 'mq-static sr-only';
      band.appendChild(sr);
    }
    sr.textContent = text; // teks penting tersedia statis utk screen reader
    state.tracks.push(track);
  }

  function setupMarquee() {
    var defs = [
      { sel: '.mq-1', dur: '28s', text: null }, // diisi di bawah
      { sel: '.mq-2', dur: '44s', text: null },
      { sel: '.mq-3', dur: '61s', text: null }
    ];
    defs[0].text = new Array(13).join("KETIK 'tulis' \u2605 KETIK 'kirim' \u2605 ");
    defs[1].text = stampNames().join(' \u2605 ') + ' \u2605 ';
    defs[2].text = serials().join(' \u2605 ') + ' \u2605 ';
    defs.forEach(function (d) {
      var band = $(d.sel);
      if (!band) return;
      var track = $('.mq-track', band);
      if (track) track.style.setProperty('--mq-dur', d.dur);
      fillBand(band, d.text);
      state.bands.push(band);
    });
    var jeda = document.getElementById('jeda-marquee');
    if (jeda) {
      jeda.addEventListener('click', function () {
        state.userPausedMarquee = !state.userPausedMarquee;
        applyMarqueePlayState();
        jeda.textContent = state.userPausedMarquee ? 'Lanjut marquee' : 'Jeda marquee';
        jeda.setAttribute('aria-pressed', state.userPausedMarquee ? 'true' : 'false');
      });
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        state.autoPausedMarquee = true;
        applyMarqueePlayState();
      } else {
        state.autoPausedMarquee = false;
        applyMarqueePlayState();
      }
    });
  }

  function applyMarqueePlayState() {
    var paused = !state.on || state.userPausedMarquee || state.autoPausedMarquee;
    state.tracks.forEach(function (t) {
      t.style.animationPlayState = paused ? 'paused' : 'running';
    });
  }

  /* ---------------- C. Split huruf flip 3D ---------------- */
  function splitHeadings() {
    if (state.splitDone) return;
    state.splitDone = true;
    var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    ready.then(function () {
      if (!state.on || prefersReduced()) return; // fallback aman: teks polos
      try {
        $$('h1,h2').forEach(function (h) {
          if (h.dataset.splitDone || h.classList.contains('no-split')) return;
          var text = h.textContent;
          if (!text || !text.trim()) return;
          h.setAttribute('aria-label', text);
          var wrap = document.createElement('span');
          wrap.className = 'fx-split';
          wrap.setAttribute('aria-hidden', 'true');
          var i = 0;
          Array.prototype.forEach.call(text, function (ch) {
            var c = document.createElement('span');
            c.className = 'fx-char';
            c.style.setProperty('--i', i++);
            c.textContent = ch === ' ' ? ' ' : ch;
            wrap.appendChild(c);
          });
          h.textContent = '';
          h.appendChild(wrap);
          h.dataset.splitDone = '1';
          if (state.flipIO) state.flipIO.observe(h);
          else h.classList.add('fx-in');
        });
      } catch (e) { /* fallback: biarkan teks polos */ }
    }, function () { /* fonts.ready gagal -> teks polos */ });
  }

  function setupFlipIO() {
    if (!('IntersectionObserver' in window)) return;
    state.flipIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('fx-in');
          state.flipIO.unobserve(e.target);
        }
      });
    }, { threshold: 0.35 });
    $$('h1[data-split-done],h2[data-split-done]').forEach(function (h) { state.flipIO.observe(h); });
  }

  /* ---------------- D. Hover kartu -> tema seluruh halaman ---------------- */
  function registerVarTransition() {
    try {
      if (!(window.CSS && CSS.registerProperty)) return;
      var cs = getComputedStyle(document.documentElement);
      // hanya daftarkan bila var memang dipakai (jangan timpa dgn initialValue)
      if (cs.getPropertyValue('--accent').trim()) {
        try { CSS.registerProperty({ name: '--accent', syntax: '<color>', inherits: true, initialValue: cs.getPropertyValue('--accent').trim() }); } catch (e) {}
      }
      if (cs.getPropertyValue('--accent-ink').trim()) {
        try { CSS.registerProperty({ name: '--accent-ink', syntax: '<color>', inherits: true, initialValue: cs.getPropertyValue('--accent-ink').trim() }); } catch (e) {}
      }
      // transisi 300ms utk perubahan var
      var st = $('#motion-layer-css');
      if (st) st.textContent += '\n:root{transition:--accent .3s ease,--accent-ink .3s ease}';
    } catch (e) {}
  }

  function tintaForCard(card, idx) {
    if (card.dataset.tinta) return card.dataset.tinta;
    var S = stampList();
    if (S.length) {
      var key = card.dataset.city;
      for (var i = 0; i < S.length; i++) {
        var nm = S[i].nama || S[i].name || S[i].kota || S[i].city;
        if ((key && nm === key) || (!key && i === idx)) return S[i].tinta || null;
      }
    }
    return null;
  }

  function setupThemeHover() {
    if (!(window.matchMedia && window.matchMedia('(pointer: fine)').matches)) return; // hanya pointer presisi
    var cards = $$('.stamp-card');
    if (!cards.length) return;
    registerVarTransition();
    var root = document.documentElement;
    cards.forEach(function (card, idx) {
      var tinta = tintaForCard(card, idx);
      if (!tinta) return;
      card.addEventListener('mouseenter', function () {
        if (!state.on) return;
        root.style.setProperty('--accent', tinta);
        root.style.setProperty('--accent-ink', tinta);
      });
      card.addEventListener('mouseleave', function () {
        root.style.removeProperty('--accent');
        root.style.removeProperty('--accent-ink');
      });
      card.addEventListener('focus', function () {
        if (!state.on) return;
        root.style.setProperty('--accent', tinta);
        root.style.setProperty('--accent-ink', tinta);
      });
      card.addEventListener('blur', function () {
        root.style.removeProperty('--accent');
        root.style.removeProperty('--accent-ink');
      });
    });
  }

  /* ---------------- E. Reveal: morph blob ---------------- */
  function ensureInkBlob(sec) {
    if ($('.ink-blob', sec)) return;
    var d = document.createElement('div');
    d.className = 'ink-blob';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">' +
      '<path class="ink-path" d="' + BLOB_A + '"/></svg>';
    sec.insertBefore(d, sec.firstChild);
  }

  function setupReveal() {
    var secs = $$('section');
    if (!secs.length) return;
    secs.forEach(ensureInkBlob);
    if (!('IntersectionObserver' in window)) {
      secs.forEach(function (s) { s.classList.add('revealed'); });
      return;
    }
    state.revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('revealed');
          state.revealIO.unobserve(e.target);
        }
      });
    }, { threshold: 0.18 });
    secs.forEach(function (s) { state.revealIO.observe(s); });
  }

  /* ---------------- toggle gerak ---------------- */
  function updateToggle() {
    var t = document.getElementById('gerak-toggle');
    if (!t) return;
    t.textContent = 'Gerak: ' + (state.on ? 'Nyala' : 'Mati');
    t.setAttribute('aria-pressed', state.on ? 'true' : 'false');
  }

  function setupToggle() {
    var t = document.getElementById('gerak-toggle');
    if (!t) return;
    t.addEventListener('click', function () {
      setMotion(!state.on, 'user-toggle');
      status('Gerak ' + (state.on ? 'dinyalakan' : 'dimatikan') + ' oleh pengguna');
    });
  }

  /* ---------------- API publik ---------------- */
  function setMotion(on, reason) {
    state.on = !!on;
    if (reason) state.note = reason;
    document.documentElement.dataset.motion = state.on ? 'on' : 'off';
    if (state.note) document.documentElement.dataset.motionNote = state.note;
    if (reason === 'user-toggle') store(LS_KEY, state.on ? 'on' : 'off');
    updateToggle();
    if (state.on) {
      applyMarqueePlayState();
      pumpLoop();
    } else {
      if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
      resetCamera();
      if (state.bands.length) state.bands.forEach(function (b) { b.style.removeProperty('--mq-skew'); });
      applyMarqueePlayState(); // paused
      // kembalikan tema halaman ke default
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-ink');
    }
  }

  function init() {
    if (state.inited) return;
    state.inited = true;
    injectCSS();
    ensureStatusNode();
    var r = resolveEnabled();
    state.note = r.reason;
    state.on = r.on;
    document.documentElement.dataset.motion = r.on ? 'on' : 'off';
    document.documentElement.dataset.motionNote = r.reason;
    setupToggle();
    updateToggle();
    if (r.on) {
      setupCamera();
      setupMarquee();
      setupFlipIO();
      splitHeadings();
      setupThemeHover();
      setupReveal();
      applyMarqueePlayState();
      pumpLoop();
      status('Gerak aktif (' + r.reason + ')');
    } else {
      // mode mati: marquee tetap terisi statis, blob disembunyikan via CSS
      setupMarquee();
      setupReveal();
      applyMarqueePlayState();
      status('Gerak nonaktif (' + r.reason + ')');
    }
  }

  window.Motion = {
    init: init,
    setMotion: function (on) { setMotion(on, 'user-toggle'); },
    /* test hook (bukan API publik utama) */
    _test: {
      clamp: clamp, scrubProgress: scrubProgress,
      resolveEnabled: resolveEnabled, stampNames: stampNames,
      get state() { return state; }
    }
  };

  /* auto-init aman idempoten (app.js boleh juga panggil Motion.init()) */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
