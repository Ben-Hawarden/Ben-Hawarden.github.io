// ── Site analytics extras ──
// feat: total read counter (Firestore increment on every page load)
// feat: visitor country map (ipapi.co + Firestore)
// feat: post heatmap data (blog page)
// feat: ambient sound toggle
(function () {
  'use strict';

  // ── feat: ambient keyboard click sound ──
  var soundOn = localStorage.getItem('bensec-sound') === '1';
  var AudioCtx = window.AudioContext || window.webkitAudioContext;

  function clickSound() {
    if (!soundOn || !AudioCtx) return;
    try {
      var ctx = new AudioCtx();
      var buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.35;
      }
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      src.stop(ctx.currentTime + 0.04);
    } catch (e) { /* silent */ }
  }

  // Attach to typing fields
  document.addEventListener('keydown', function (e) {
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/input|textarea/i.test(tag) && !e.ctrlKey && !e.metaKey && !e.altKey) clickSound();
  });

  function injectSoundToggle() {
    var footer = document.querySelector('footer .footer-links');
    if (!footer || footer.querySelector('.sound-toggle')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sound-toggle trail-toggle';
    b.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    b.title = 'Toggle keyboard click sound';
    b.textContent = soundOn ? '[♪] sound on' : '[♪] sound';
    b.addEventListener('click', function () {
      soundOn = !soundOn;
      localStorage.setItem('bensec-sound', soundOn ? '1' : '0');
      b.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      b.textContent = soundOn ? '[♪] sound on' : '[♪] sound';
      if (soundOn) clickSound();
    });
    footer.appendChild(b);
  }

  // ── feat: total read counter ──
  function recordPageRead() {
    if (!window.firebase || !firebase.apps || !firebase.apps.length) return;
    // Throttle: once per session per page
    var key = 'bensec-page-read-' + location.pathname;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    try {
      firebase.firestore().collection('analytics').doc('__sitewide__').set({
        totalReads: firebase.firestore.FieldValue.increment(1)
      }, { merge: true }).catch(function () {});
    } catch (e) {}
  }

  function showTotalReads() {
    var footer = document.querySelector('footer .footer-content p');
    if (!footer || footer.dataset.readsInit) return;
    footer.dataset.readsInit = '1';
    if (!window.firebase || !firebase.apps || !firebase.apps.length) return;
    firebase.firestore().collection('analytics').doc('__sitewide__').get().then(function (doc) {
      if (!doc.exists) return;
      var n = (doc.data() || {}).totalReads || 0;
      var span = document.createElement('span');
      span.className = 'footer-reads';
      span.textContent = ' · ' + Number(n).toLocaleString() + ' reads';
      footer.appendChild(span);
    }).catch(function () {});
  }

  // ── feat: visitor country tracking ──
  var COUNTRY_KEY = 'bensec-country-sent';
  function recordCountry() {
    if (sessionStorage.getItem(COUNTRY_KEY)) return;
    if (!window.firebase || !firebase.apps || !firebase.apps.length) return;
    sessionStorage.setItem(COUNTRY_KEY, '1');
    fetch('https://ipapi.co/json/')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var country = d.country_name || d.country || 'Unknown';
        var code = d.country_code || '??';
        firebase.firestore().collection('analytics').doc('__countries__').set({
          [code]: firebase.firestore.FieldValue.increment(1),
          _names: { [code]: country }
        }, { merge: true }).catch(function () {});
      }).catch(function () {});
  }

  // ── feat: post heatmap — disabled ──
  function renderHeatmap() { return;
    var container = document.getElementById('blog-heatmap');
    if (!container) return;
    var posts = (window.BensecDB && BensecDB.getPosts) ? BensecDB.getPosts() : [];
    posts = posts.filter(function (p) { return p.status !== 'draft' && p.date; });
    if (!posts.length) { container.style.display = 'none'; return; }

    // Build date → count map for last 52 weeks
    var dateCounts = {};
    posts.forEach(function (p) { dateCounts[p.date] = (dateCounts[p.date] || 0) + 1; });

    var now = new Date();
    var weeks = 52;
    var cells = [];
    // Start from (52 weeks ago) Sunday
    var start = new Date(now);
    start.setDate(start.getDate() - start.getDay() - weeks * 7);

    for (var w = 0; w <= weeks; w++) {
      for (var d = 0; d < 7; d++) {
        var date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        var key = date.toISOString().slice(0, 10);
        cells.push({ key: key, count: dateCounts[key] || 0, month: date.getMonth(), day: date.getDay() });
      }
    }

    var maxCount = Math.max.apply(null, cells.map(function (c) { return c.count; })) || 1;
    var html = '<div class="heatmap-wrap"><div class="heatmap-label">// post frequency (last year)</div>' +
      '<div class="heatmap-grid">';
    cells.forEach(function (c) {
      var level = c.count === 0 ? 0 : Math.ceil((c.count / maxCount) * 4);
      html += '<div class="heatmap-cell level-' + level + '" title="' + c.key + (c.count ? ' — ' + c.count + ' post(s)' : '') + '"></div>';
    });
    html += '</div></div>';
    container.innerHTML = html;
  }

  function waitForPosts(cb, t) {
    t = t || 0;
    if (window.BensecDB && BensecDB.getPosts && BensecDB.getPosts().length) return cb();
    if (t > 50) return cb();
    setTimeout(function () { waitForPosts(cb, t + 1); }, 200);
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectSoundToggle();
    recordPageRead();

    // Delay country + reads to not block page load
    setTimeout(function () {
      recordCountry();
      showTotalReads();
    }, 2000);

    // Heatmap on blog page
    if (/blog\.html/i.test(location.pathname) || document.getElementById('blog-heatmap')) {
      waitForPosts(renderHeatmap);
    }
  });

  setTimeout(injectSoundToggle, 800);
}());
