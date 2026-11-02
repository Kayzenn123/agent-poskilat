/* ============================================================
 * compose.js — wizard tulis kartu pos + arsip + preview (vanilla JS)
 *
 * KONTRAK yang dipakai (harus disediakan file lain):
 *   window.Terminal = { say(msg), printReceipt(title, rows), onCommand(name, fn) }
 *     - say(msg): cetak 1 baris pesan Pak Pos ke terminal.
 *     - printReceipt(title, rows): cetak struk thermal.
 *         title = string, rows = array berisi [label, value] atau string
 *         (string dipakai untuk garis pemisah/judul bagian).
 *     - onCommand(name, handler): daftarkan perintah; handler dipanggil
 *         dengan string argumen (sisa baris setelah nama perintah).
 *   window.STAMPS.CITIES = [{id, kota, landmark, deskripsi, kodepos, tinta}]
 *     - landmark: markup <svg> ATAU data path (d="...") untuk viewBox 0 0 64 64.
 *   window.Store — lihat store.js.
 *
 * ID HTML yang dipakai (disediakan index.html):
 *   #wizard (wadah wizard), #preview (kartu), #flip (tombol balik kartu),
 *   #perangko (section dinding perangko), #arsip-list (daftar arsip).
 *
 * Semua input user di-escape via esc() sebelum masuk HTML.
 * ============================================================ */
(function () {
  "use strict";

  /* ================= util ================= */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(id) { return document.getElementById(id); }

  function say(msg) {
    try {
      if (window.Terminal && typeof window.Terminal.say === "function") window.Terminal.say(msg);
    } catch (e) { /* terminal belum siap: diam */ }
  }

  function printReceipt(title, rows) {
    var T = window.Terminal;
    try {
      if (T && typeof T.printReceipt === "function") { T.printReceipt(title, rows); return; }
    } catch (e) { /* jatuh ke fallback */ }
    say("── " + title + " ──");
    rows.forEach(function (r) {
      say(Array.isArray(r) ? (r[0] + " : " + r[1]) : String(r));
    });
  }

  function cities() {
    return (window.STAMPS && Array.isArray(window.STAMPS.CITIES)) ? window.STAMPS.CITIES : [];
  }
  function cityById(id) {
    var list = cities(), i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function cityByName(name) {
    var n = String(name || "").trim().toLowerCase(), list = cities(), i;
    for (i = 0; i < list.length; i++) {
      if (list[i].kota.toLowerCase() === n || list[i].id.toLowerCase() === n) return list[i];
    }
    return null;
  }

  function tglID(ts) {
    try {
      return new Date(ts).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    } catch (e) { return String(ts); }
  }

  /** landmark: markup <svg> langsung, atau data path → dibungkus svg monoline. */
  function landmarkSVG(city, extraClass) {
    var lm = city && city.landmark;
    if (!lm) return "";
    var s = String(lm).trim();
    if (s.charAt(0) === "<") return s; // markup SVG tepercaya dari stamps.js
    return '<svg class="' + esc(extraClass || "") + '" viewBox="0 0 64 64" fill="none" ' +
      'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true"><path d="' + esc(s) + '"/></svg>';
  }

  function scrollTo(el) {
    if (!el || !el.scrollIntoView) return;
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    } catch (e) { el.scrollIntoView(); }
  }

  /* ================= wizard tulis ================= */
  // DRAFT: { kepada, dari, kotaId, pesan, perangkoId, step } | null
  var DRAFT = null;
  var WIZARD_STEPS = 4;

  function startWizard() {
    DRAFT = { kepada: "", dari: "", kotaId: "", pesan: "", perangkoId: "", step: 1 };
    renderStep();
    scrollTo($("wizard"));
    say("Siap, Dek! Kita tulis kartunya bareng-bareng — 4 langkah aja.");
  }

  function wErr(msg) {
    var box = $("w-error");
    if (box) { box.textContent = msg; box.hidden = false; }
    else say(msg);
  }
  function wClearErr() {
    var box = $("w-error");
    if (box) { box.textContent = ""; box.hidden = true; }
  }

  function navButtons(step) {
    var h = '<div class="w-nav">';
    if (step > 1) h += '<button type="button" class="btn w-btn" data-action="back" style="min-height:44px">← Kembali</button>';
    h += '<button type="button" class="btn w-btn w-next" data-action="next" style="min-height:44px">' +
      (step === WIZARD_STEPS ? "Selesai ✓" : "Lanjut →") + "</button></div>";
    return h;
  }

  function renderStep() {
    var w = $("wizard");
    if (!w) { say("Wadah wizard (#wizard) nggak ketemu, Dek."); return; }
    var d = DRAFT, step = d.step, list = cities();
    var h = '<div class="w-card" role="form" aria-label="Wizard tulis kartu pos">';

    if (step === 1) {
      h += '<p class="w-step">Langkah 1/4</p><h3 class="w-title">Kepada siapa kartunya, Dek?</h3>' +
        '<label class="w-label">Kepada <input id="w-kepada" class="w-input" maxlength="60" ' +
        'placeholder="cth: Naila" value="' + esc(d.kepada) + '" autocomplete="off"></label>' +
        '<label class="w-label">Dari <span class="w-hint">(boleh kosong)</span> ' +
        '<input id="w-dari" class="w-input" maxlength="60" placeholder="cth: Kay" value="' + esc(d.dari) + '" autocomplete="off"></label>' +
        navButtons(1);
    } else if (step === 2) {
      var opts = list.map(function (c) {
        return '<option value="' + esc(c.kota) + '" data-id="' + esc(c.id) + '">';
      }).join("");
      var curName = d.kotaId && cityById(d.kotaId) ? cityById(d.kotaId).kota : "";
      h += '<p class="w-step">Langkah 2/4</p><h3 class="w-title">Kartunya dikirim dari kota mana?</h3>' +
        '<label class="w-label">Kota <input id="w-kota" class="w-input" list="w-kota-list" ' +
        'placeholder="ketik nama kota…" value="' + esc(curName) + '" autocomplete="off">' +
        '<datalist id="w-kota-list">' + opts + "</datalist></label>" +
        (list.length ? "" : '<p class="w-warn">Data kota belum siap, Dek. Coba lagi sebentar.</p>') +
        navButtons(2);
    } else if (step === 3) {
      var n = d.pesan.length;
      h += '<p class="w-step">Langkah 3/4</p><h3 class="w-title">Tulis kabar baiknya, Dek.</h3>' +
        '<label class="w-label">Pesan ' +
        '<textarea id="w-pesan" class="w-input w-textarea" maxlength="280" rows="4" ' +
        'placeholder="cth: Halo dari kantor pos! Cuacanya cerah banget hari ini…">' + esc(d.pesan) + "</textarea></label>" +
        '<p class="w-counter"><span id="w-count">' + n + '</span>/280</p>' +
        navButtons(3);
    } else {
      var grid = list.map(function (c) {
        var on = d.perangkoId === c.id;
        return '<button type="button" class="w-stamp' + (on ? " dipilih" : "") + '" data-action="stamp" ' +
          'data-id="' + esc(c.id) + '" aria-pressed="' + on + '" style="min-height:44px" ' +
          'title="' + esc(c.kota) + '">' +
          '<span class="w-stamp-svg" style="color:' + esc(c.tinta || "currentColor") + '">' +
          landmarkSVG(c) + "</span>" +
          '<span class="w-stamp-name">' + esc(c.kota) + "</span></button>";
      }).join("");
      h += '<p class="w-step">Langkah 4/4</p><h3 class="w-title">Pilih perangkonya, Dek.</h3>' +
        '<div class="w-stamp-grid" role="group" aria-label="Pilih perangko">' + grid + "</div>" +
        navButtons(4);
    }

    h += '<p class="w-error" id="w-error" role="alert" hidden></p></div>';
    w.innerHTML = h;

    // counter live langkah 3
    var ta = $("w-pesan"), cnt = $("w-count");
    if (ta && cnt) {
      ta.addEventListener("input", function () { cnt.textContent = ta.value.length; });
      ta.focus();
    }
    var inp = $("w-kepada") || $("w-kota");
    if (inp && !ta) inp.focus();
  }

  function validStep(step) {
    var d = DRAFT;
    wClearErr();
    if (step === 1) {
      var k = $("w-kepada") ? $("w-kepada").value.trim() : "";
      if (k.length < 2) {
        wErr("Isi namanya dulu, Dek — minimal 2 huruf.");
        if ($("w-kepada")) $("w-kepada").focus();
        return false;
      }
      d.kepada = k;
      d.dari = $("w-dari") ? $("w-dari").value.trim() : "";
      return true;
    }
    if (step === 2) {
      var raw = $("w-kota") ? $("w-kota").value : "";
      var c = cityByName(raw);
      if (!c) {
        wErr("Kotanya belum ada di daftar Pak Pos, Dek. Pilih dari daftar ya.");
        if ($("w-kota")) $("w-kota").focus();
        return false;
      }
      d.kotaId = c.id;
      return true;
    }
    if (step === 3) {
      var p = $("w-pesan") ? $("w-pesan").value : "";
      if (p.trim().length === 0) {
        wErr("Pesan jangan kosong, Dek. Tulis kabar baiknya.");
        if ($("w-pesan")) $("w-pesan").focus();
        return false;
      }
      if (p.length > 280) { wErr("Kepanjangan, Dek — maksimal 280 huruf."); return false; }
      d.pesan = p;
      return true;
    }
    // step 4
    if (!d.perangkoId || !cityById(d.perangkoId)) {
      wErr("Pilih satu perangkonya dulu, Dek.");
      return false;
    }
    return true;
  }

  function draftLengkap() {
    return !!(DRAFT && DRAFT.kepada.trim().length >= 2 &&
      cityById(DRAFT.kotaId) && DRAFT.pesan.trim().length > 0 &&
      DRAFT.pesan.length <= 280 && cityById(DRAFT.perangkoId));
  }

  function wizardClick(ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest("[data-action]") : null;
    if (!t || !DRAFT) return;
    var act = t.getAttribute("data-action");
    if (act === "stamp") {
      DRAFT.perangkoId = t.getAttribute("data-id");
      renderStep();
      wClearErr();
      say("Perangko " + (cityById(DRAFT.perangkoId) || {}).kota + " dipilih. Mantap, Dek!");
      return;
    }
    if (act === "back") {
      if (DRAFT.step > 1) { DRAFT.step--; renderStep(); }
      return;
    }
    if (act === "next") {
      if (!validStep(DRAFT.step)) return;
      if (DRAFT.step < WIZARD_STEPS) { DRAFT.step++; renderStep(); return; }
      // selesai
      var w = $("wizard");
      wClearErr();
      renderPreview({
        kepada: DRAFT.kepada, dari: DRAFT.dari, kotaId: DRAFT.kotaId,
        pesan: DRAFT.pesan, perangkoId: DRAFT.perangkoId,
        seri: "KP-2026-····", createdAt: Date.now()
      });
      scrollTo($("preview"));
      say("Draf lengkap! Cek kartunya di preview, Dek. Kalau udah pas, ketik `kirim`.");
    }
  }

  /* ================= dinding perangko ================= */
  /* Render #stamp-wall: tombol .stamp.stamp-card (styles.css .stamp utk
     tampilan; .stamp-card + data-tinta/data-city utk motion.js hover-tema). */
  function renderStampWall() {
    var wall = $("stamp-wall");
    if (!wall) return;
    var list = cities();
    wall.innerHTML = "";
    list.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "stamp stamp-card";
      b.setAttribute("data-city", c.kota);
      if (c.tinta) b.setAttribute("data-tinta", c.tinta);
      b.setAttribute("aria-label", "Perangko " + c.kota);

      var svgWrap = document.createElement("span");
      svgWrap.className = "stamp-svg";
      svgWrap.setAttribute("aria-hidden", "true");
      svgWrap.innerHTML = landmarkSVG(c);

      var nm = document.createElement("span");
      nm.className = "stamp-name";
      nm.textContent = c.kota;

      var dn = document.createElement("span");
      dn.className = "stamp-denom";
      dn.textContent = "POSKILAT";

      b.appendChild(svgWrap);
      b.appendChild(nm);
      b.appendChild(dn);
      b.addEventListener("click", function () {
        say("Perangko " + c.kota + ": " + c.deskripsi +
          " Ketik `tulis` kalau mau pakai perangko ini, Dek.");
      });
      wall.appendChild(b);
    });
  }

  /* ================= perintah terminal ================= */
  function cmdTulis() { startWizard(); }

  function cmdPerangko() {
    var list = cities();
    scrollTo($("perangko"));
    if (!list.length) { say("Dinding perangkonya lagi kosong, Dek."); return; }
    say("Ini 16 perangko POSKILAT, Dek: " +
      list.map(function (c) { return c.kota; }).join(" · ") +
      ". Ketik `tulis` buat pakai salah satunya.");
  }

  function cmdKirim() {
    if (!draftLengkap()) {
      say("Belum ada draf lengkap, Dek. Ketik `tulis` dulu, isi 4 langkahnya, baru `kirim`.");
      return;
    }
    var d = DRAFT;
    // animasi cap: .is-hitting di .cap-stamp (styles.css: cap-hit 0.45s)
    capHit();
    setTimeout(function () {
      var cap = document.querySelector("#preview .cap-stamp");
      if (cap) cap.classList.remove("is-hitting");
    }, 600);
    var id;
    try {
      id = window.Store.add({
        kepada: d.kepada, dari: d.dari, kotaId: d.kotaId,
        pesan: d.pesan, perangkoId: d.perangkoId
      });
    } catch (e) {
      say("Aduh, gagal nyimpen, Dek: " + e.message);
      return;
    }
    var card = window.Store.get(id);
    var kota = cityById(card.kotaId);
    renderPreview(card);
    renderArsip();
    printReceipt("STRUK KIRIM — POSKILAT", [
      ["No. seri", card.seri],
      ["Kepada", card.kepada + (card.dari ? " (dari " + card.dari + ")" : "")],
      ["Kota", kota ? kota.kota : "-"],
      ["Tanggal", tglID(card.createdAt)],
      "--------------------------------",
      ["Status", "TERKIRIM ✓"]
    ]);
    say("Terkirim! Kartu buat " + card.kepada +
      " (" + (kota ? kota.kota : "-") + ") udah dicap dan masuk arsip. No. seri " + card.seri + ".");
    DRAFT = null;
    try { history.replaceState(null, "", "?kartu=" + encodeURIComponent(id)); } catch (e) {}
  }

  function ringkasanWA(card) {
    var kota = cityById(card.kotaId);
    return "KARTU POS — POSKILAT\n" +
      "No. seri: " + card.seri + "\n" +
      "Kepada: " + card.kepada + (card.dari ? " (dari " + card.dari + ")" : "") + "\n" +
      "Kota: " + (kota ? kota.kota : "-") + " · " + tglID(card.createdAt) + "\n" +
      "Pesan: " + card.pesan;
  }

  function salinWA(id) {
    var card = window.Store.get(id);
    if (!card) { say("Kartunya nggak ketemu, Dek."); return; }
    var teks = ringkasanWA(card);
    function ok() { say("Ringkasan udah disalin, Dek. Tinggal tempel ke WA."); }
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = teks;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var done = false;
        try { done = document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(ta);
        if (done) ok(); else say("Gagal nyalin otomatis, Dek. Salin manual ya.");
      } catch (e) { say("Gagal nyalin otomatis, Dek. Salin manual ya."); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(teks).then(ok, fallback);
    } else fallback();
  }

  function unduhJSON(id) {
    var card = window.Store.get(id);
    if (!card) { say("Kartunya nggak ketemu, Dek."); return; }
    try {
      var blob = new Blob([JSON.stringify(card, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "kartu-" + card.id + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      say("Kartunya diunduh sebagai JSON, Dek.");
    } catch (e) { say("Gagal ngunduh, Dek."); }
  }

  function renderArsip() {
    var box = $("arsip-list");
    if (!box) return;
    var cards = window.Store.list();
    if (!cards.length) {
      box.innerHTML = ""; // empty state tetap milik HTML
      return;
    }
    box.innerHTML = "";
    cards.forEach(function (card) {
      var kota = cityById(card.kotaId);
      var item = document.createElement("article");
      item.className = "arsip-item";
      item.setAttribute("data-id", card.id);

      var meta = document.createElement("div");
      meta.className = "arsip-meta";
      var h = document.createElement("h4");
      h.className = "arsip-kepada";
      h.textContent = card.kepada;
      var p = document.createElement("p");
      p.className = "arsip-sub";
      p.textContent = (kota ? kota.kota : "-") + " · " + tglID(card.createdAt) + " · " + card.seri;
      meta.appendChild(h); meta.appendChild(p);

      var acts = document.createElement("div");
      acts.className = "arsip-acts";
      [["baca", "Baca"], ["salin", "Salin"], ["unduh", "Unduh"], ["hapus", "Hapus"]].forEach(function (b) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn arsip-btn";
        btn.style.minHeight = "44px";
        btn.setAttribute("data-arsip-act", b[0]);
        btn.setAttribute("data-id", card.id);
        btn.textContent = b[1];
        acts.appendChild(btn);
      });

      item.appendChild(meta);
      item.appendChild(acts);
      box.appendChild(item);
    });
  }

  function cmdArsip() {
    renderArsip();
    scrollTo($("arsip-list"));
    var n = window.Store.list().length;
    if (!n) say("Arsip masih kosong melompong, Dek. Belum ada kartu yang dikirim.");
    else say("Ada " + n + " kartu di arsip, Dek. Ketik `baca <id>` buat lihat isinya.");
  }

  function bacaKartu(id) {
    if (!/^[A-Za-z0-9_-]+$/.test(id || "")) { say("ID kartunya aneh, Dek."); return; }
    var card = window.Store.get(id);
    if (!card) { say("Kartu itu nggak ketemu di arsip, Dek. Cek `arsip` dulu ya."); return; }
    renderPreview(card);
    scrollTo($("preview"));
    try { history.replaceState(null, "", "?kartu=" + encodeURIComponent(id)); } catch (e) {}
    say("Ini dia kartu buat " + card.kepada + ", Dek. Klik kartunya buat dibalik.");
  }
  function cmdBaca(args) {
    var id = String(args || "").trim().split(/\s+/)[0];
    if (!id) { say("Mau baca yang mana, Dek? Contoh: `baca kp-abc123`. Lihat daftarnya di `arsip`."); return; }
    bacaKartu(id);
  }

  var pendingHapus = null;
  function cmdHapus(args) {
    var parts = String(args || "").trim().split(/\s+/).filter(Boolean);
    var id = parts[0] || "";
    if (!id) { say("Mau hapus yang mana, Dek? Contoh: `hapus kp-abc123`."); return; }
    var konfirmasi = parts.slice(1).join(" ").toLowerCase() === "ya";
    var card = window.Store.get(id);
    if (!card) { say("Kartu itu nggak ketemu, Dek."); pendingHapus = null; return; }
    if (konfirmasi && pendingHapus === id) {
      window.Store.remove(id);
      pendingHapus = null;
      renderArsip();
      say("Dihapus. Kartu buat " + card.kepada + " udah dibuang, Dek.");
      try { history.replaceState(null, "", location.pathname); } catch (e) {}
      return;
    }
    pendingHapus = id;
    say("Yakin mau hapus kartu buat " + card.kepada + " (" + card.seri + ")? " +
      "Ketik `hapus " + id + " ya` buat konfirmasi, Dek.");
  }

  /* ================= preview kartu ================= */
  /* Markup mengikuti styles.css: .postcard > .card-face.card-front/.card-back + .cap-stamp.
     Flip: .is-flipped di #preview. Cap: .is-hitting di .cap-stamp. */
  function renderPreview(card) {
    var kartu = $("kartu");
    if (!kartu) { say("Wadah kartu (#kartu) nggak ketemu, Dek."); return; }
    var kota = cityById(card.kotaId) || { kota: "-", kodepos: "-", tinta: "currentColor" };
    var stamp = cityById(card.perangkoId) || kota;

    var front =
      '<div class="card-face card-front">' +
        '<div class="card-landmark">' + landmarkSVG(kota, "card-landmark-svg") +
          '<p class="card-city">' + esc(kota.kota) + "</p></div>" +
        '<div class="card-meta">' +
          '<span class="card-brand">KARTU POS</span>' +
          '<span class="card-stamp-mini" style="color:' + esc(stamp.tinta || "currentColor") + '">' +
            landmarkSVG(stamp) + "</span>" +
          '<span class="card-kodepos">' + esc(kota.kodepos || "-") + "</span>" +
          '<span class="card-poskilat">POSKILAT</span>' +
        "</div>" +
      "</div>";

    var back =
      '<div class="card-face card-back">' +
        '<div class="card-msg">' + esc(card.pesan) + "</div>" +
        '<div class="card-addr">' +
          '<div class="addr-line">Kepada: ' + esc(card.kepada) + "</div>" +
          (card.dari ? '<div class="addr-line">Dari: ' + esc(card.dari) + "</div>" : "") +
          '<div class="addr-line">&nbsp;</div>' +
          '<div class="addr-line">' + esc(card.seri || "") + "</div>" +
        "</div>" +
      "</div>";

    var prev = $("preview");
    if (prev) prev.classList.remove("is-flipped");
    kartu.innerHTML = front + back +
      '<div class="cap-stamp" aria-hidden="true"><span>POSKILAT<br>TERKIRIM</span></div>';
  }

  function flipPreview() {
    var prev = $("preview");
    if (prev) prev.classList.toggle("is-flipped");
  }

  function capHit() {
    var cap = document.querySelector("#preview .cap-stamp");
    if (!cap) return;
    cap.classList.remove("is-hitting");
    void cap.offsetWidth; /* restart animasi */
    cap.classList.add("is-hitting");
  }

  function arsipClick(ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest("[data-arsip-act]") : null;
    if (!t) return;
    var act = t.getAttribute("data-arsip-act");
    var id = t.getAttribute("data-id");
    if (act === "baca") bacaKartu(id);
    else if (act === "salin") salinWA(id);
    else if (act === "unduh") unduhJSON(id);
    else if (act === "hapus") cmdHapus(id);
  }

  /* ================= pendaftaran perintah + deep-link ================= */
  var COMMANDS = {
    tulis: function () { cmdTulis(); },
    perangko: function () { cmdPerangko(); },
    kirim: function () { cmdKirim(); },
    arsip: function () { cmdArsip(); },
    baca: function (a) { cmdBaca(Array.isArray(a) ? a.join(" ") : a); },
    hapus: function (a) { cmdHapus(Array.isArray(a) ? a.join(" ") : a); }
  };

  function registerCommands() {
    var T = window.Terminal;
    if (!T || typeof T.onCommand !== "function") return false;
    try {
      // Kontrak: onCommand(nama, handler) — handler menerima string argumen.
      Object.keys(COMMANDS).forEach(function (n) { T.onCommand(n, COMMANDS[n]); });
      return true;
    } catch (e) { return false; }
  }

  var inited = false;
  function init() {
    if (inited) return;
    inited = true;
    var tries = 0;
    (function attempt() {
      if (registerCommands()) return;
      if (++tries < 20) setTimeout(attempt, 300); // tunggu terminal.js bila dimuat belakangan
    })();

    var wz = $("wizard");
    if (wz) wz.addEventListener("click", wizardClick);
    var al = $("arsip-list");
    if (al) al.addEventListener("click", arsipClick);
    var flip = $("flip");
    if (flip) flip.addEventListener("click", flipPreview);
    var prev = $("preview");
    if (prev) prev.addEventListener("click", function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest("#flip")) return;
      flipPreview();
    });

    renderStampWall();
    renderArsip();

    // Deep-link: ?kartu=<id>
    try {
      var q = new URLSearchParams(location.search).get("kartu");
      if (q && /^[A-Za-z0-9_-]+$/.test(q)) {
        var card = window.Store.get(q);
        if (card) bacaKartu(q);
        else say("Link kartunya nggak ketemu di arsip, Dek.");
      }
    } catch (e) { /* abaikan */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* API internal (dipakai QA/debug) */
  window.Compose = {
    esc: esc,
    draftLengkap: draftLengkap,
    renderPreview: renderPreview,
    renderArsip: renderArsip,
    commands: COMMANDS
  };
})();
