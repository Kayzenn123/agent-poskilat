/* ============================================================
   terminal.js — POSKILAT: terminal loket kantor pos 1987
   Vanilla JS, tanpa dependency, tanpa console.* tersisa.
   ------------------------------------------------------------
   Elemen yang diharapkan di index.html:
     #term        — wadah terminal (scroll container)
     #term-out    — keluaran (role=log, aria-live=polite)
     #term-form   — form pembungkus input
     #term-input  — input perintah
   Jika elemen belum ada saat script dimuat, app.js bisa
   memanggil Terminal.init() ulang setelah DOM siap.
   ------------------------------------------------------------
   API publik:
     window.Terminal = { say, printReceipt, onCommand, run, init }
   ============================================================ */
(function () {
  'use strict';

  /* ---------- konstanta ---------- */

  var BOOT_LINES = [
    'POSKILAT v2.0 — loket kartu pos',
    'Printer struk: SIAP',
    "Ketik 'bantuan' lalu ENTER, Dek."
  ];

  var PROMPT = 'pos@kantor:~$';

  var UNKNOWN_MSG = "Wah, perintahnya nggak dikenal, Dek. Ketik 'bantuan' biar Pak Pos tunjukin jalannya.";

  // Perintah yang handler-nya didaftarkan modul lain (compose.js).
  var DELEGATED = ['tulis', 'perangko', 'kirim', 'arsip', 'baca', 'hapus'];

  /* ---------- state ---------- */

  var registry = {};      // nama (lowercase) -> { fn, desc }
  var history = [];       // riwayat perintah
  var histIdx = -1;       // posisi jelajah riwayat
  var bootSkipped = false;
  var booted = false;
  var listenersBound = false;

  var el = { term: null, out: null, form: null, input: null };

  /* ---------- util ---------- */

  function $(id) { return document.getElementById(id); }

  function bind() {
    el.term = $('term');
    el.out = $('term-out');
    el.form = $('term-form');
    el.input = $('term-input');
  }

  function ensureOut() {
    if (!el.out) bind();
    return el.out;
  }

  function reducedMotion() {
    return !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function scrollDown() {
    var scroller = el.term || el.out;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    if (el.input) el.input.focus({ preventScroll: true });
  }

  function serial() {
    return 'PK-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function tanggal() {
    return new Date().toLocaleDateString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  /* ---------- render dasar ---------- */

  // Baris teks biasa (semua teks via textContent — aman dari injeksi).
  function printLine(teks, cls) {
    var out = ensureOut();
    if (!out) return null;
    var div = document.createElement('div');
    div.className = cls || 'term-line';
    var span = document.createElement('span');
    span.textContent = String(teks);
    div.appendChild(span);
    out.appendChild(div);
    scrollDown();
    return div;
  }

  // Gema perintah yang diketik: "pos@kantor:~$ <perintah>"
  function echo(line) {
    var out = ensureOut();
    if (!out) return;
    var div = document.createElement('div');
    div.className = 'term-line term-echo';
    var p = document.createElement('span');
    p.className = 'term-prompt';
    p.textContent = PROMPT + ' ';
    var c = document.createElement('span');
    c.className = 'term-cmd';
    c.textContent = String(line);
    div.appendChild(p);
    div.appendChild(c);
    out.appendChild(div);
    scrollDown();
  }

  // Pak Pos ngomong. Dukung multi-baris.
  function say(teks) {
    String(teks).split('\n').forEach(function (baris) {
      printLine(baris, 'term-line term-say');
    });
  }

  /* ---------- struk thermal ---------- */

  // judul: string. baris: array [label, nilai] atau {label, value}.
  function printReceipt(judul, baris) {
    var out = ensureOut();
    if (!out) return null;

    var r = document.createElement('div');
    r.className = 'receipt';

    var head = document.createElement('div');
    head.className = 'receipt-head';
    var t = document.createElement('div');
    t.className = 'receipt-title';
    t.textContent = String(judul);
    var meta = document.createElement('div');
    meta.className = 'receipt-meta';
    meta.textContent = serial() + ' · ' + tanggal();
    head.appendChild(t);
    head.appendChild(meta);
    r.appendChild(head);

    var d1 = document.createElement('div');
    d1.className = 'receipt-dash';
    d1.setAttribute('aria-hidden', 'true');
    r.appendChild(d1);

    (baris || []).forEach(function (b) {
      var row = document.createElement('div');
      row.className = 'receipt-row';
      var l = document.createElement('span');
      l.className = 'receipt-label';
      var v = document.createElement('span');
      v.className = 'receipt-value';
      if (Array.isArray(b)) {
        l.textContent = String(b[0] == null ? '' : b[0]);
        v.textContent = String(b[1] == null ? '' : b[1]);
      } else if (b && typeof b === 'object') {
        l.textContent = String(b.label == null ? '' : b.label);
        v.textContent = String(b.value == null ? '' : b.value);
      } else {
        l.textContent = String(b);
        v.textContent = '';
      }
      row.appendChild(l);
      row.appendChild(v);
      r.appendChild(row);
    });

    var d2 = document.createElement('div');
    d2.className = 'receipt-dash';
    d2.setAttribute('aria-hidden', 'true');
    r.appendChild(d2);

    var foot = document.createElement('div');
    foot.className = 'receipt-foot';
    foot.textContent = 'TERIMA KASIH, DEK';
    r.appendChild(foot);

    var edge = document.createElement('div');
    edge.className = 'receipt-edge';
    edge.setAttribute('aria-hidden', 'true');
    r.appendChild(edge);

    out.appendChild(r);
    scrollDown();
    return r;
  }

  /* ---------- boot sequence ---------- */

  function typeText(div, text, done) {
    var span = document.createElement('span');
    span.textContent = '';
    div.appendChild(span);
    var i = 0;
    var speed = 14; // cepat — ini printer, bukan novel

    function finishInstant() {
      span.textContent = text;
      if (done) done();
    }

    function tick() {
      if (bootSkipped) { finishInstant(); return; }
      i += 1;
      span.textContent = text.slice(0, i);
      if (i < text.length) {
        setTimeout(tick, speed);
      } else if (done) {
        done();
      }
    }

    if (bootSkipped) finishInstant();
    else tick();
  }

  function boot(done) {
    if (booted) { if (done) done(); return; }
    var out = ensureOut();
    if (!out) { booted = true; if (done) done(); return; }

    if (reducedMotion()) {
      BOOT_LINES.forEach(function (l) { printLine(l, 'term-line term-boot'); });
      booted = true;
      scrollDown();
      if (done) done();
      return;
    }

    var i = 0;
    function next() {
      if (bootSkipped || i >= BOOT_LINES.length) {
        booted = true;
        scrollDown();
        if (done) done();
        return;
      }
      var div = document.createElement('div');
      div.className = 'term-line term-boot';
      out.appendChild(div);
      scrollDown();
      typeText(div, BOOT_LINES[i], function () { i += 1; next(); });
    }
    next();
  }

  /* ---------- perintah bawaan ---------- */

  function allCommands() {
    var names = Object.keys(builtins).concat(Object.keys(registry));
    names.sort();
    return names;
  }

  function cmdBantuan() {
    var rows = allCommands().map(function (n) {
      var desc = builtins[n] ? builtins[n].desc : (registry[n] ? registry[n].desc : '');
      return [n, desc || '—'];
    });
    printReceipt('BANTUAN — PERINTAH LOKET', rows);
    say("Tips Dek: tekan TAB buat lengkapi perintah, panah atas/bawah buat riwayat, Ctrl+L buat bersih-bersih.");
  }

  function cmdTentang() {
    say('POSKILAT v2.0 — loket kartu pos digital.\n' +
        'Nulis kartu pos, cap perangko, kirim, lalu arsipkan — semuanya lewat perintah, tanpa tombol.\n' +
        'Dijaga Pak Pos. Kertas boleh digital, sopan santun tetap analog.');
  }

  function cmdGerak() {
    /* Delegasi ke motion.js (sumber tunggal kebenaran: html[data-motion]). */
    try {
      if (window.Motion && typeof window.Motion.setMotion === 'function') {
        var nowOff = document.documentElement.getAttribute('data-motion') === 'off';
        window.Motion.setMotion(nowOff);
        say(nowOff ? 'Gerak dinyalakan lagi. Kertasnya goyang dikit, gapapa.'
                   : 'Gerak dimatikan, Dek — mode ringan aktif.');
        return;
      }
    } catch (e) { /* jatuh ke fallback */ }
    var body = document.body;
    var off = body.classList.toggle('motion-off');
    say(off ? 'Gerak dimatikan, Dek — mode ringan aktif.'
            : 'Gerak dinyalakan lagi. Kertasnya goyang dikit, gapapa.');
  }

  function cmdJeda() {
    /* Delegasi ke tombol #jeda-marquee yang di-wire motion.js. */
    try {
      var btn = document.getElementById('jeda-marquee');
      if (btn) { btn.click(); return; }
    } catch (e) { /* jatuh ke fallback */ }
    var root = document.documentElement;
    var paused = root.classList.toggle('marquee-jeda');
    say(paused ? 'Marquee dijeda. Printer-nya istirahat dulu.'
               : 'Marquee jalan lagi. Kring-kring!');
  }

  function cmdWesel() {
    printReceipt('WESEL POS', [
      ['Nomor', serial()],
      ['Nominal', 'Rp 0 (CONTOH)'],
      ['Status', 'SIAP CAIR'],
      ['Loket', 'Ambil di loket 3, Dek']
    ]);
    say('Eits, ini cuma wesel mainan, Dek. Yang asli antre di kantor pos beneran ya.');
  }

  function cmdPosIndonesia() {
    var out = ensureOut();
    if (out) {
      var div = document.createElement('div');
      div.className = 'stamp-cap';
      div.setAttribute('aria-label', 'Cap pos: KILAT KHUSUS');
      var s = document.createElement('span');
      s.textContent = 'KILAT KHUSUS';
      div.appendChild(s);
      out.appendChild(div);
      scrollDown();
    }
    say('DUK! Cap KILAT KHUSUS menghantam kertas.\nPrioritas tertinggi. Surat ini duluan, Dek.');
  }

  var builtins = {
    bantuan:      { desc: 'daftar semua perintah loket', fn: cmdBantuan },
    tentang:      { desc: 'tentang POSKILAT', fn: cmdTentang },
    gerak:        { desc: 'nyala/matikan gerak (mode ringan)', fn: cmdGerak },
    jeda:         { desc: 'jeda/lanjutkan marquee', fn: cmdJeda },
    wesel:        { desc: 'easter egg: wesel pos', fn: cmdWesel },
    posindonesia: { desc: 'easter egg: cap KILAT KHUSUS', fn: cmdPosIndonesia }
  };

  /* ---------- parser & eksekusi ---------- */

  function parse(line) {
    var parts = String(line).trim().split(/\s+/);
    return {
      cmd: (parts[0] || '').toLowerCase(),
      args: parts.slice(1)
    };
  }

  function pushHistory(line) {
    if (line !== history[history.length - 1]) history.push(line);
    if (history.length > 100) history.shift();
    histIdx = history.length; // posisi "di bawah" entri terakhir
  }

  function run(line) {
    line = String(line == null ? '' : line);
    if (!line.trim()) return;
    echo(line);
    pushHistory(line);
    var p = parse(line);
    if (!p.cmd) return;

    var b = builtins[p.cmd];
    if (b) { b.fn(p.args, line); return; }

    var reg = registry[p.cmd];
    if (reg && typeof reg.fn === 'function') { reg.fn(p.args, line); return; }

    if (DELEGATED.indexOf(p.cmd) !== -1) {
      say("Modul compose belum terpasang, Dek — perintah '" + p.cmd +
          "' belum bisa jalan. Coba lagi sebentar ya.");
      return;
    }

    say(UNKNOWN_MSG);
  }

  /* ---------- pendaftaran perintah (untuk compose.js) ---------- */

  function onCommand(nama, fn, desc) {
    if (typeof nama !== 'string' || typeof fn !== 'function') return false;
    var key = nama.trim().toLowerCase();
    if (!key || builtins[key]) return false; // bawaan tidak boleh ditimpa
    registry[key] = { fn: fn, desc: typeof desc === 'string' ? desc : '' };
    return true;
  }

  /* ---------- input: riwayat, tab, ctrl+l ---------- */

  function commonPrefix(cands) {
    if (!cands.length) return '';
    var pre = cands[0];
    for (var i = 1; i < cands.length; i += 1) {
      var j = 0;
      while (j < pre.length && pre[j] === cands[i][j]) j += 1;
      pre = pre.slice(0, j);
    }
    return pre;
  }

  function handleTab() {
    var input = el.input;
    if (!input) return;
    var val = input.value;
    if (/\s/.test(val)) return; // hanya lengkapi token perintah pertama
    var cands = allCommands().filter(function (n) {
      return n.indexOf(val.toLowerCase()) === 0;
    });
    if (cands.length === 1) {
      input.value = cands[0] + ' ';
    } else if (cands.length > 1) {
      var pre = commonPrefix(cands);
      if (pre.length > val.length) {
        input.value = pre;
      } else {
        printLine('Pilihan: ' + cands.join('  '), 'term-line term-hint');
      }
    }
  }

  function handleHistory(dir) {
    var input = el.input;
    if (!input || !history.length) return;
    histIdx += dir;
    if (histIdx < 0) histIdx = 0;
    if (histIdx > history.length) histIdx = history.length;
    input.value = histIdx < history.length ? history[histIdx] : '';
  }

  function clear() {
    var out = ensureOut();
    if (out) {
      while (out.firstChild) out.removeChild(out.firstChild);
    }
    if (el.input) el.input.focus({ preventScroll: true });
  }

  function bindListeners() {
    if (listenersBound) return;
    listenersBound = true;

    if (el.form && el.input) {
      el.form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = el.input.value;
        el.input.value = '';
        histIdx = history.length;
        run(v);
      });

      el.input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleHistory(-1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleHistory(1);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          handleTab();
        } else if (e.key === 'l' && e.ctrlKey) {
          e.preventDefault();
          clear();
        }
      });
    }

    // Klik area terminal = fokus ke input (biar "selalu bisa difokus").
    // Klik saat boot = skip efek mesin tik.
    if (el.term) {
      el.term.addEventListener('click', function () {
        if (!booted) bootSkipped = true;
        if (el.input) el.input.focus({ preventScroll: true });
      });
    } else if (el.out) {
      el.out.addEventListener('click', function () {
        if (!booted) bootSkipped = true;
        if (el.input) el.input.focus({ preventScroll: true });
      });
    }
  }

  /* ---------- init ---------- */

  function init() {
    bind();
    var out = ensureOut();
    if (!out) return false;

    if (!out.hasAttribute('role')) out.setAttribute('role', 'log');
    if (!out.hasAttribute('aria-live')) out.setAttribute('aria-live', 'polite');

    bindListeners();
    boot(function () {
      if (el.input) el.input.focus({ preventScroll: true });
    });
    return true;
  }

  /* ---------- API publik ---------- */

  window.Terminal = {
    say: say,
    printReceipt: printReceipt,
    onCommand: onCommand,
    run: run,
    init: init,
    clear: clear
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
