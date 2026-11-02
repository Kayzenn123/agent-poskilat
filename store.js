/* ============================================================
 * store.js — penyimpanan arsip kartu pos POSKILAT (vanilla JS)
 *
 * window.Store — localStorage key "kartupos-v1"
 * Skema dokumen: { version: 1, cards: [ Card ] }
 * Skema Card:
 *   {
 *     id:        "kp-<base36 timestamp>-<base36 acak>",   // URL-safe
 *     seri:      "KP-2026-XXXX",                          // no. seri struk, unik
 *     kepada:    string (min 2 huruf, sudah divalidasi),
 *     dari:      string (boleh kosong),
 *     kotaId:    string (id kota di STAMPS.CITIES),
 *     pesan:     string (1..280 char),
 *     perangkoId:string (id kota perangko di STAMPS.CITIES),
 *     createdAt: number (epoch ms)
 *   }
 *
 * Data rusak / skema nggak cocok → reset ke {version:1,cards:[]}
 * dan Pak Pos dikabari via Terminal.say kalau Terminal sudah ada.
 * localStorage nggak tersedia → fallback memory (sesi ini saja).
 * ============================================================ */
(function () {
  "use strict";

  var KEY = "kartupos-v1";
  var VERSION = 1;
  var SERI_PREFIX = "KP-2026-";

  /* ---------- util ---------- */
  function pakPos(msg) {
    try {
      if (window.Terminal && typeof window.Terminal.say === "function") {
        window.Terminal.say(msg);
      }
    } catch (e) { /* diam: terminal belum tentu sudah dimuat */ }
  }

  function rand4() {
    // 4 digit acak, boleh diawali 0
    var n = Math.floor(Math.random() * 10000);
    return ("0000" + n).slice(-4);
  }

  function newId() {
    return "kp-" + Date.now().toString(36) + "-" +
      Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, "x");
  }

  function isNonEmptyStr(v) {
    return typeof v === "string" && v.trim().length > 0;
  }

  function isValidCard(c) {
    if (!c || typeof c !== "object") return false;
    if (!isNonEmptyStr(c.id)) return false;
    if (!isNonEmptyStr(c.seri) || c.seri.indexOf(SERI_PREFIX) !== 0) return false;
    if (typeof c.kepada !== "string" || c.kepada.trim().length < 2) return false;
    if (typeof c.dari !== "string") return false;
    if (!isNonEmptyStr(c.kotaId)) return false;
    if (typeof c.pesan !== "string" || c.pesan.length === 0 || c.pesan.length > 280) return false;
    if (!isNonEmptyStr(c.perangkoId)) return false;
    if (typeof c.createdAt !== "number" || !(c.createdAt > 0)) return false;
    return true;
  }

  /* ---------- storage layer (localStorage + fallback memory) ---------- */
  var memFallback = { version: VERSION, cards: [] };
  var lsOK = (function () {
    try {
      var t = "__poskilat_test__";
      window.localStorage.setItem(t, "1");
      window.localStorage.removeItem(t);
      return true;
    } catch (e) {
      return false;
    }
  })();

  function readDoc() {
    if (!lsOK) return memFallback;
    var raw = null;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch (e) {
      return memFallback;
    }
    if (raw === null || raw === "") return { version: VERSION, cards: [] };

    var doc = null;
    try {
      doc = JSON.parse(raw);
    } catch (e) {
      doc = null;
    }
    // Skema nggak cocok → reset + kabari Pak Pos
    if (!doc || typeof doc !== "object" || doc.version !== VERSION || !Array.isArray(doc.cards)) {
      pakPos("Waduh, Dek — data arsipnya rusak. Pak Pos reset arsipnya biar aman, ya.");
      var fresh = { version: VERSION, cards: [] };
      writeDoc(fresh);
      return fresh;
    }
    // Saring entri yang cacat, pertahankan yang valid
    var valid = doc.cards.filter(isValidCard);
    if (valid.length !== doc.cards.length) {
      var cleaned = { version: VERSION, cards: valid };
      writeDoc(cleaned);
      return cleaned;
    }
    return doc;
  }

  function writeDoc(doc) {
    if (!lsOK) {
      memFallback = doc;
      return;
    }
    try {
      window.localStorage.setItem(KEY, JSON.stringify(doc));
    } catch (e) {
      // kuota penuh / mode privat: jatuh ke memory
      memFallback = doc;
    }
  }

  function newSeri(existing) {
    var taken = {};
    existing.forEach(function (c) { taken[c.seri] = true; });
    var s, guard = 0;
    do {
      s = SERI_PREFIX + rand4();
      guard++;
    } while (taken[s] && guard < 50);
    return s;
  }

  /* ---------- API publik ---------- */
  window.Store = {
    /** @returns {Array} kartu, terbaru dulu (salinan, bukan referensi) */
    list: function () {
      var cards = readDoc().cards.slice();
      cards.sort(function (a, b) { return b.createdAt - a.createdAt; });
      return cards.map(function (c) { return Object.assign({}, c); });
    },

    /** @param {string} id @returns {Object|null} salinan kartu */
    get: function (id) {
      if (!isNonEmptyStr(id)) return null;
      var found = null;
      readDoc().cards.forEach(function (c) {
        if (c.id === id) found = c;
      });
      return found ? Object.assign({}, found) : null;
    },

    /**
     * Simpan kartu baru.
     * @param {Object} card {kepada, dari, kotaId, pesan, perangkoId}
     * @returns {string} id kartu baru
     * @throws Error kalau validasi gagal
     */
    add: function (card) {
      card = card || {};
      var kepada = String(card.kepada == null ? "" : card.kepada).trim();
      var dari = String(card.dari == null ? "" : card.dari).trim();
      var pesan = String(card.pesan == null ? "" : card.pesan);

      if (kepada.length < 2) throw new Error("kepada: minimal 2 huruf");
      if (!isNonEmptyStr(card.kotaId)) throw new Error("kotaId: wajib diisi");
      if (pesan.length === 0) throw new Error("pesan: jangan kosong");
      if (pesan.length > 280) throw new Error("pesan: maksimal 280 karakter");
      if (!isNonEmptyStr(card.perangkoId)) throw new Error("perangkoId: wajib diisi");

      var doc = readDoc();
      var full = {
        id: newId(),
        seri: newSeri(doc.cards),
        kepada: kepada,
        dari: dari,
        kotaId: String(card.kotaId),
        pesan: pesan,
        perangkoId: String(card.perangkoId),
        createdAt: Date.now()
      };
      doc.cards.push(full);
      writeDoc(doc);
      return full.id;
    },

    /** @param {string} id @returns {boolean} true kalau ada yang dihapus */
    remove: function (id) {
      if (!isNonEmptyStr(id)) return false;
      var doc = readDoc();
      var before = doc.cards.length;
      doc.cards = doc.cards.filter(function (c) { return c.id !== id; });
      if (doc.cards.length === before) return false;
      writeDoc(doc);
      return true;
    },

    /** Kosongkan seluruh arsip. */
    clear: function () {
      writeDoc({ version: VERSION, cards: [] });
    },

    /** Info diagnostik (dipakai QA). */
    _info: function () {
      return { key: KEY, version: VERSION, lsOK: lsOK, count: readDoc().cards.length };
    }
  };
})();
