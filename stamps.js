/* POSKILAT — data 16 perangko kota (vanilla JS).
 * Landmark digambar sendiri sebagai SVG monoline satu garis menyambung
 * (stroke currentColor, fill none, stroke-width 1.5, viewBox 0 0 64 64).
 * Hover-theme: tiap kota membawa varian tinta oklch (hue 200-280 / pop 32).
 */
(function () {
  'use strict';

  var SVG_OPEN = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="';
  var SVG_CLOSE = '"/></svg>';

  function lm(d) { return SVG_OPEN + d + SVG_CLOSE; }

  var CITIES = [
    {
      id: 'jakarta',
      kota: 'Jakarta',
      landmark: lm('M8 56h48 M14 56v-4h36v4 M20 52v-5h24v5 M27 47l3-25h4l3 25 M32 22v-5 M28.5 13c0-2.6 2-3.2 3.5-6.2 1.5 3 3.5 3.6 3.5 6.2 0 2.4-7 2.4-7 0'),
      deskripsi: 'Monas 132 meter di Gambir, lidah apinya dilapisi 50 kg emas — titik nol kilometer Indonesia.',
      kodepos: 'CONTOH 10110',
      tinta: 'oklch(0.45 0.140 210)'
    },
    {
      id: 'bandung',
      kota: 'Bandung',
      landmark: lm('M8 56h48 M12 56V32h40v24 M12 32l6-8h28l6 8 M20 56V40h24v16 M26 56v-7h12v7 M32 24V12 M28.5 14a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0 M28.5 19a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0 M16 46v-4a2 2 0 0 1 4 0v4 M24 46v-4a2 2 0 0 1 4 0v4 M36 46v-4a2 2 0 0 1 4 0v4 M44 46v-4a2 2 0 0 1 4 0v4'),
      deskripsi: 'Gedung Sate di Diponegoro, tusuk satenya penanda biaya pembangunan sejuta gulden.',
      kodepos: 'CONTOH 40115',
      tinta: 'oklch(0.45 0.140 230)'
    },
    {
      id: 'yogyakarta',
      kota: 'Yogyakarta',
      landmark: lm('M8 56h48 M20 56l3-28h18l3 28 M25 56l2-20h10l2 20 M30 28v-5 M26 19a6 6 0 1 0 12 0 6 6 0 1 0-12 0 M32 13V8 M28 8h8'),
      deskripsi: 'Tugu Jogja di perempatan Mangkubumi, poros imajiner Kraton–Merapi–Laut Selatan.',
      kodepos: 'CONTOH 55165',
      tinta: 'oklch(0.45 0.140 250)'
    },
    {
      id: 'surabaya',
      kota: 'Surabaya',
      landmark: lm('M4 46h56 M20 46V22 M44 46V22 M20 22L8 46 M20 22l-5 24 M20 22l6 24 M20 22l12 24 M44 22l-12 24 M44 22l-6 24 M44 22l6 24 M44 22l12 24 M20 22h24 M14 22v-4 M50 22v-4'),
      deskripsi: 'Jembatan Suramadu 5,4 km, penghubung Jawa–Madura terpanjang di Indonesia.',
      kodepos: 'CONTOH 60271',
      tinta: 'oklch(0.45 0.140 270)'
    },
    {
      id: 'medan',
      kota: 'Medan',
      landmark: lm('M8 56h48 M12 56V34h40v22 M12 34c6-2 10-6 12-12h16c2 6 6 10 12 12 M27 22c0-5 2.2-7 5-7s5 2 5 7 M32 15v-4 M16 56v-9a2.5 2.5 0 0 1 5 0v9 M29.5 56v-9a2.5 2.5 0 0 1 5 0v9 M43 56v-9a2.5 2.5 0 0 1 5 0v9'),
      deskripsi: 'Istana Maimun di Brigjen Katamso, istana Kesultanan Deli dengan 30 ruangan kuning megah.',
      kodepos: 'CONTOH 20112',
      tinta: 'oklch(0.62 0.200 32)'
    },
    {
      id: 'makassar',
      kota: 'Makassar',
      landmark: lm('M10 42h44l-8 12H18l-8-12 M32 42V14 M32 14L18 36h14 M32 14l14 22H32 M32 42v8 M6 59c4 3 8 3 12 0s8-3 12 0 8 3 12 0 8-3 12 0'),
      deskripsi: 'Perahu phinisi khas Bugis, berlayar dari Pantai Losari sambil makan pisang epe.',
      kodepos: 'CONTOH 90111',
      tinta: 'oklch(0.45 0.140 205)'
    },
    {
      id: 'denpasar',
      kota: 'Denpasar',
      landmark: lm('M20 56h24 M32 56v-6 M32 50c-9-2-15-9-17-20 7 2 12 6 14 11 0-9 1-16 3-22 2 6 3 13 3 22 2-5 7-9 14-11-2 11-8 18-17 20 M28 26a4 4 0 1 0 8 0 4 4 0 1 0-8 0'),
      deskripsi: 'Patung GWK 121 meter di Ungasan, Wisnu menunggang Garuda — lebih tinggi dari Liberty.',
      kodepos: 'CONTOH 80114',
      tinta: 'oklch(0.45 0.140 225)'
    },
    {
      id: 'semarang',
      kota: 'Semarang',
      landmark: lm('M6 56h52 M10 56V32h44v24 M10 32l4-7h36l4 7 M27 25v-4h10v4 M14 56V41a2 2 0 0 1 4 0v15 M22 56V41a2 2 0 0 1 4 0v15 M30 56V41a2 2 0 0 1 4 0v15 M38 56V41a2 2 0 0 1 4 0v15 M46 56V41a2 2 0 0 1 4 0v15'),
      deskripsi: 'Lawang Sewu di Jalan Pemuda, eks kantor kereta api Belanda dengan seribu pintu.',
      kodepos: 'CONTOH 50134',
      tinta: 'oklch(0.45 0.140 245)'
    },
    {
      id: 'palembang',
      kota: 'Palembang',
      landmark: lm('M4 48h56 M12 48c0-13 9-21 20-21s20 8 20 21 M22 27V17 M42 27V17 M22 17h20 M24 48v-9 M32 48V27 M40 48v-9 M6 55c3 2 6 2 9 0s6-2 9 0 6 2 9 0 6-2 9 0 6 2 9 0'),
      deskripsi: 'Jembatan Ampera, dulu bagian tengahnya bisa terangkat agar kapal lewat Sungai Musi.',
      kodepos: 'CONTOH 30125',
      tinta: 'oklch(0.45 0.140 265)'
    },
    {
      id: 'pontianak',
      kota: 'Pontianak',
      landmark: lm('M8 56h48 M24 56l4-22h8l4 22 M29 56l1.8-14h6.4L39 56 M32 34v-3 M26 27a6 6 0 1 0 12 0 6 6 0 1 0-12 0 M20 27h-5 M44 27h5 M23 22l-5-4 M41 22l5-4 M32 21v-6 M28 15h8'),
      deskripsi: 'Tugu Khatulistiwa di Siantan, berdiri tepat di garis lintang nol derajat.',
      kodepos: 'CONTOH 78112',
      tinta: 'oklch(0.45 0.140 280)'
    },
    {
      id: 'banda-aceh',
      kota: 'Banda Aceh',
      landmark: lm('M8 56h48 M16 56V36h32v20 M16 36c4-8 10-12 16-12s12 4 16 12 M28 24a4 4 0 1 0 8 0 4 4 0 1 0-8 0 M32 20v-5 M10 56V30 M54 56V30 M10 30a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0 M51.5 30a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0 M20 56v-7a2 2 0 0 1 4 0v7 M40 56v-7a2 2 0 0 1 4 0v7'),
      deskripsi: 'Masjid Raya Baiturrahman, selamat dari tsunami 2004 dan jadi simbol kebangkitan Aceh.',
      kodepos: 'CONTOH 23116',
      tinta: 'oklch(0.62 0.200 32)'
    },
    {
      id: 'bukittinggi',
      kota: 'Bukittinggi',
      landmark: lm('M8 56h48 M24 56V28h16v28 M24 28l-7-10 15-9 15 9-7 10 M28 18v-5h8v5 M28 42a4 4 0 1 0 8 0 4 4 0 1 0-8 0 M32 42v-2.5 M32 39.5L33.5 38'),
      deskripsi: 'Jam Gadang, hadiah Ratu Wilhelmina — mesin jamnya cuma ada dua di dunia.',
      kodepos: 'CONTOH 26111',
      tinta: 'oklch(0.45 0.140 215)'
    },
    {
      id: 'balikpapan',
      kota: 'Balikpapan',
      landmark: lm('M8 54c8-4 16-4 24 0s16 4 24 0 M22 50V30 M22 30c-7-2-11-6-11-13 6 0 10 2 11 5 1-5 5-9 11-9-1 5-4 8-7 10 4 0 8 2 11 6-6 2-11 1-15 1 M45 12a5 5 0 1 0 10 0 5 5 0 1 0-10 0 M12 10l3 3 M58 22h4'),
      deskripsi: 'Pantai Melawai di tepi Teluk Balikpapan, spot sunset dengan deretan kapal tongkang.',
      kodepos: 'CONTOH 76111',
      tinta: 'oklch(0.45 0.140 235)'
    },
    {
      id: 'manado',
      kota: 'Manado',
      landmark: lm('M12 46c6-8 13-12 20-12s14 4 20 12 M24 42V28 M24 28c-5-2-8-5-8-10 5 0 7 2 8 4 1-4 4-6 8-6-1 4-3 6-5 7 3 0 6 2 8 5-4 1-7 0-11 0 M8 54c4 3 8 3 12 0s8-3 12 0 8 3 12 0 8-3 12 0 M42 50l4-4 4 4-4 4-4-4'),
      deskripsi: 'Pulau Bunaken, dinding karang vertikal dan penyu yang kelihatan dari perahu kaca.',
      kodepos: 'CONTOH 95111',
      tinta: 'oklch(0.45 0.140 255)'
    },
    {
      id: 'jayapura',
      kota: 'Jayapura',
      landmark: lm('M6 42c6-9 12-14 20-14s14 5 20 14 M34 42c4-7 9-11 15-10 M8 52c8 4 16 4 24 0s16-4 24 0 M10 56c8 3 15 3 22 0s14-3 22 0 M24 52l5-4h7l5 4 M30 44v-4 M27 40h6'),
      deskripsi: 'Danau Sentani, danau vulkanik dengan 22 pulau kecil dan festival budayanya tiap Juni.',
      kodepos: 'CONTOH 99111',
      tinta: 'oklch(0.45 0.140 275)'
    },
    {
      id: 'solo',
      kota: 'Solo',
      landmark: lm('M8 56h48 M14 56V40h36v16 M14 40L32 24l18 16 M20 35l12-9 12 9 M27 26v-5h10v5 M32 21v-4 M22 56v-8h20v8 M16 48h32'),
      deskripsi: 'Keraton Surakarta Hadiningrat, pusat budaya Jawa dengan alun-alun dan kebo bulenya.',
      kodepos: 'CONTOH 57111',
      tinta: 'oklch(0.45 0.140 200)'
    }
  ];

  /* Kartu perangko kecil: bingkai gerigi (rect dashed) + landmark + nama + kodepos. */
  function renderMini(city) {
    var inner = String(city.landmark)
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '');
    return '<svg viewBox="0 0 120 140" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Perangko ' + city.kota + '">'
      + '<rect x="5" y="5" width="110" height="130" stroke-width="2" stroke-dasharray="5 4"/>'
      + '<svg x="28" y="12" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'
      + '<text x="60" y="100" text-anchor="middle" font-size="11" stroke="none" fill="currentColor" font-family="monospace">' + city.kota.toUpperCase() + '</text>'
      + '<text x="60" y="116" text-anchor="middle" font-size="8" stroke="none" fill="currentColor" font-family="monospace">' + city.kodepos + '</text>'
      + '</svg>';
  }

  window.STAMPS = { CITIES: CITIES, renderMini: renderMini };
})();
