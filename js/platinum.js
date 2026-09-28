/* PLATINUM template engine — renders shared chrome + data-driven sections. */
(function () {
  'use strict';

  var PT = window.PT = {};
  var cache = {};
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load(url) {
    if (!cache[url]) cache[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
    return cache[url];
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toDate(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function isoToday() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtLong(iso) { var d = toDate(iso); return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); }
  function fmtShort(iso) { var d = toDate(iso); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
  function cleanName(n) { return String(n || '').replace(/\s+(High School|HS|H\.S\.)$/i, '').replace(/^CANCELLED\s*-?\s*/i, '').trim(); }

  /* ---------- members index ---------- */
  var membersP = load('data/members.json').then(function (d) {
    var bySlug = {}, byNorm = {};
    d.members.forEach(function (m) { bySlug[m.slug] = m; byNorm[norm(m.name)] = m; byNorm[norm(m.short)] = m; });
    d.bySlug = bySlug;
    d.find = function (nameOrSlug) {
      if (!nameOrSlug) return null;
      var n = norm(nameOrSlug);
      if (bySlug[nameOrSlug] || byNorm[n]) return bySlug[nameOrSlug] || byNorm[n];
      // scores/feeds often use a bare nickname ("Mendham", "Central"); accept a unique suffix match
      if (n.length < 4) return null;
      var hits = d.members.filter(function (m) { var mn = norm(m.name); return mn.length > n.length && mn.slice(-n.length) === n; });
      return hits.length === 1 ? hits[0] : null;
    };
    return d;
  });
  function norm(s) { return String(s || '').toLowerCase().replace(/\b(high school|hs|school|academy|township|twp|of|the|regional|xxiii|county|technology|technical|tech|vocational)\b/g, '').replace(/[^a-z]/g, ''); }

  /* Every fixture between two member schools is reported twice, once by each school.
     Matching on the opponent name alone misses pairs where one side wrote an
     abbreviation we can't resolve ("MCVT"), so a pair is treated as one fixture only
     when the two records disagree about who is home AND at least one of them names the
     other's school. Records that agree on home/away are left alone, which keeps the
     several same-slot entries a cross-country meet legitimately produces. */
  function annotate(list, M) {
    return list.map(function (g) {
      var h = M.find(g.schoolLogo) || M.find(g.school);
      var o = M.bySlug[g.oppLogo] || M.find(g.opponent);
      return { g: g, h: h, o: o };
    });
  }
  function sameFixture(a, b) {
    if (!!a.g.home === !!b.g.home) return false;
    if (a.h && b.o && a.h.slug === b.o.slug) return true;
    if (b.h && a.o && b.h.slug === a.o.slug) return true;
    return false;
  }
  function dedupe(list, M) {
    var buckets = {}, order = [];
    annotate(list, M).forEach(function (a) {
      var k = [a.g.date, a.g.time || '', a.g.sport, a.g.level].join('#');
      if (!buckets[k]) { buckets[k] = []; order.push(k); }
      buckets[k].push(a);
    });
    var out = [];
    order.forEach(function (k) {
      var kept = [];
      // keep the record that resolved both crests, so the row renders complete
      buckets[k].slice().sort(function (x, y) { return ((y.h ? 1 : 0) + (y.o ? 1 : 0)) - ((x.h ? 1 : 0) + (x.o ? 1 : 0)); })
        .forEach(function (a) { if (!kept.some(function (b) { return sameFixture(a, b); })) kept.push(a); });
      out = out.concat(kept);
    });
    return out;
  }

  var NAV = [
    { label: 'Schools', href: 'schools.html', children: [
      ['schools.html', 'Member Schools', '39 schools · 3 counties'],
      ['schools.html#directory', 'Athletic Directors', 'Names, email and phone'],
      ['schedule.html', 'Schedules by School', 'Every team, every level']
    ] },
    { label: 'Schedule', href: 'schedule.html', children: [
      ['schedule.html', 'This Week', 'Seven-day conference slate'],
      ['calendar.html', 'Full Season', 'Search by sport, school or level'],
      ['feeds/all.ics', 'Subscribe (.ics)', 'Add to your calendar']
    ] },
    { label: 'Scores', href: 'scores.html', children: [
      ['scores.html', 'Scores & Standings', 'By sport and season'],
      ['index.html#standings', 'Standings', 'Filtered to the Olympic Conference'],
      ['https://highschoolsports.nj.com/scores', 'NJ.com Scoreboard', 'Statewide, all sports']
    ] },
    { label: 'Media', href: 'videos.html', children: [
      ['videos.html', 'Olympic Vision', 'Game broadcasts'],
      ['news.html', 'Olympic News', 'Around the conference'],
      ['feeds/rss.xml', 'RSS Feed', 'Schedules as a feed']
    ] },
    { label: 'Conference', href: 'about.html', children: [
      ['about.html', 'About the Olympic Conference', 'Mission & membership'],
      ['about.html#leadership', 'Leadership', 'Executive officers'],
      ['about.html#sports', 'Sports Offered', 'Fall · Winter · Spring']
    ] }
  ];

  /* ---------- shared chrome ---------- */
  PT.chrome = function (page) {
    var header = el(
      '<div>' +
      '<div class="utility"><div class="wrap">' +
        '<div class="counties"><span>Olympic Conference</span><span>Camden</span><span>Burlington</span></div>' +
        '<div class="u-links"><a href="about.html">Conference Info</a><a href="schools.html#directory">Athletic Directors</a><a href="about.html">External Links</a><a href="feeds/all.ics">Subscribe</a></div>' +
      '</div></div>' +
      '<header class="masthead"><div class="wrap">' +
        '<a class="brand" href="index.html" aria-label="Olympic Conference home"><img src="images/olympic-logo.png" alt="Olympic Conference crest" width="58" height="58"><span class="brand-text"><span class="brand-abbr chrome-text">Olympic</span><span class="brand-full">South Jersey Athletics</span></span></a>' +
        '<ul class="nav" id="nav"></ul>' +
        '<div class="mast-actions">' +
          '<a class="btn btn--chrome btn--sm" href="videos.html">Watch Olympic Vision <span class="arrow">→</span></a>' +
          '<button class="icon-btn burger" aria-label="Open menu" aria-expanded="false"><svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M0 1h20M0 7h20M0 13h20"/></svg></button>' +
        '</div>' +
      '</div></header>' +
      '<div class="drawer" id="drawer" aria-hidden="true"><div class="drawer-head"><span class="brand-abbr chrome-text" style="font-family:var(--f-display);font-size:34px">Olympic Conference</span><button class="icon-btn" id="drawer-close" aria-label="Close menu">✕</button></div><div id="drawer-body"></div></div>' +
      '</div>');

    var nav = q('#nav', header);
    NAV.forEach(function (item) {
      var li = document.createElement('li');
      var current = page && item.href.indexOf(page) === 0 ? ' aria-current="page"' : '';
      if (item.children) {
        li.innerHTML = '<a href="' + item.href + '"' + current + '>' + item.label + ' <span class="chev" aria-hidden="true"></span></a><div class="menu">' +
          item.children.map(function (c) { return '<a href="' + c[0] + '"' + (c[0].indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : '') + '><span>' + c[1] + '</span><small>' + c[2] + '</small></a>'; }).join('') + '</div>';
      } else {
        li.innerHTML = '<a href="' + item.href + '"' + current + '>' + item.label + '</a>';
      }
      nav.appendChild(li);
    });

    var drawerBody = q('#drawer-body', header);
    NAV.forEach(function (item) {
      var g = document.createElement('div'); g.className = 'group';
      g.innerHTML = '<h4>' + item.label + '</h4>' + (item.children ? item.children.map(function (c) { return '<a href="' + c[0] + '">' + c[1] + '</a>'; }).join('') : '<a href="' + item.href + '">' + item.label + '</a>');
      drawerBody.appendChild(g);
    });

    document.body.insertBefore(header, document.body.firstChild);
    while (header.firstChild) document.body.insertBefore(header.firstChild, header);
    header.remove();

    var mast = q('.masthead'), drawer = q('#drawer'), burger = q('.burger');
    window.addEventListener('scroll', function () { mast.classList.toggle('is-scrolled', window.scrollY > 10); }, { passive: true });
    burger.addEventListener('click', function () { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); burger.setAttribute('aria-expanded', 'true'); });
    q('#drawer-close').addEventListener('click', function () { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); burger.setAttribute('aria-expanded', 'false'); });
    qa('.nav > li > a').forEach(function (a) {
      a.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); a.parentNode.classList.add('open'); var f = q('.menu a', a.parentNode); if (f) f.focus(); } });
    });

    // footer
    var footer = el(
      '<footer class="footer"><div class="wrap">' +
        '<div class="footer-grid">' +
          '<div class="footer-brand"><img src="images/olympic-logo.png" alt="Olympic Conference crest"><p>Fifteen public and private high schools across Camden and Burlington counties, competing with a shared commitment to sportsmanship and education-based athletics.</p></div>' +
          '<div class="footer-counties-a"></div><div class="footer-counties-b"></div>' +
          '<div><h4>Conference</h4><ul><li><a href="about.html">About the Olympic Conference</a></li><li><a href="about.html#leadership">Leadership</a></li><li><a href="schools.html#directory">Athletic Directors</a></li><li><a href="about.html#sports">Sports Offered</a></li><li><a href="scores.html">Scores &amp; Standings</a></li><li><a href="about.html">External Links</a></li></ul></div>' +
          '<div><h4>Follow</h4><ul><li><a href="schedule.html">This Week\'s Schedule</a></li><li><a href="calendar.html">Full Season Calendar</a></li><li><a href="feeds/all.ics">Calendar Subscription (.ics)</a></li><li><a href="feeds/rss.xml">RSS Feed</a></li><li><a href="videos.html">Olympic Conference Vision</a></li><li><a href="news.html">Olympic Conference News</a></li></ul></div>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<span>© <span id="yr"></span> Olympic Conference</span>' +
          '<span class="plat"><i></i> Platinum Edition</span>' +
          '<span class="credit">Site by <img src="images/athlitiq-lockup.svg" alt="AthlitIQ"></span>' +
        '</div>' +
      '</div></footer>');
    document.body.appendChild(footer);
    q('#yr').textContent = new Date().getFullYear();
    membersP.then(function (d) {
      // The biggest county fills the first column in two sub-columns; every
      // other county stacks in the second, which is what the grid expects.
      var cl = countyList(d);
      function block(c, twoCol, first) {
        var ms = d.members.filter(function (m) { return m.county === c; });
        return '<h4' + (first ? '' : ' style="margin-top:22px"') + '>' + esc(c) + '</h4><ul' + (twoCol ? ' class="cols-2"' : '') + '>' +
          ms.map(function (m) { return '<li><a href="' + esc(m.website) + '" target="_blank" rel="noopener">' + esc(m.short) + '</a></li>'; }).join('') + '</ul>';
      }
      var a = q('.footer-counties-a'), b = q('.footer-counties-b');
      if (a) a.innerHTML = cl.length ? block(cl[0], d.members.filter(function (m) { return m.county === cl[0]; }).length > 6, true) : '';
      if (b) b.innerHTML = cl.slice(1).map(function (c, i) { return block(c, false, i === 0); }).join('');
    });
  };

  /* ---------- scoreboard ticker ---------- */
  PT.ticker = function () {
    var root = q('#scoreboard'); if (!root) return;
    Promise.all([load('data/scores.json'), membersP]).then(function (res) {
      var games = res[0].games || [], M = res[1];
      if (!games.length) { root.remove(); return; }
      var latest = games.reduce(function (a, g) { return g.date > a ? g.date : a; }, '');
      var day = games.filter(function (g) { return g.date === latest && g.teams && g.teams.length === 2; });
      if (day.length < 10) day = day.concat(games.filter(function (g) { return g.date !== latest; }).slice(0, 24 - day.length));
      day = day.slice(0, 40);
      q('.sb-date', root).textContent = 'Final · ' + fmtLong(latest);
      var rail = q('.sb-rail', root);
      var html = day.map(function (g) {
        var t = g.teams;
        function team(x) {
          var m = M.find(x.slug) || M.find(x.name);
          var crest = m ? '<img src="' + m.logo + '" alt="">' : '<span class="crest-blank"></span>';
          return '<div class="sb-team' + (x.winner ? ' win' : '') + '">' + crest + '<span>' + esc(m ? m.short : cleanName(x.name)) + '</span></div><div class="sb-score' + (x.winner ? ' win' : '') + '">' + (x.score == null ? '–' : esc(x.score)) + '</div>';
        }
        return '<a class="sb-card" href="schedule.html"><div class="sb-sport"><span>' + esc(g.sport) + '</span><em>Final</em></div>' + team(t[0]) + team(t[1]) + '</a>';
      }).join('');
      rail.innerHTML = html + html; // doubled for seamless loop
      var speed = Math.max(40, day.length * 4);
      rail.style.animationDuration = speed + 's';
      var track = q('.sb-track', root);
      q('.sb-prev', root).addEventListener('click', function () { nudge(-1); });
      q('.sb-next', root).addEventListener('click', function () { nudge(1); });
      var offset = 0;
      function nudge(dir) {
        rail.style.animationPlayState = 'paused';
        offset += dir * 480;
        var max = rail.scrollWidth / 2;
        if (offset < 0) offset = max - 480; if (offset > max) offset = 0;
        rail.style.transition = 'transform .5s var(--ease)';
        rail.style.animation = 'none';
        rail.style.transform = 'translateX(' + (-offset) + 'px)';
      }
      track.addEventListener('mouseleave', function () { if (rail.style.animation === 'none') return; rail.style.animationPlayState = 'running'; });
    }).catch(function () { root.remove(); });
  };

  /* ---------- hero ---------- */
  PT.hero = function () {
    var hero = q('.hero'); if (!hero) return;
    load('data/slides.json').then(function (d) {
      var slides = (d.slides || []).filter(function (s) { return s.image; });
      var box = q('.slides', hero), prog = q('.hero-progress', hero);
      var ms = d.intervalMs && d.intervalMs > 3000 ? d.intervalMs + 1500 : 6500;
      hero.style.setProperty('--slide-ms', ms + 'ms');
      slides.forEach(function (s, i) {
        box.appendChild(el('<div class="slide' + (i === 0 ? ' active' : '') + '"><img src="' + esc(s.image) + '" alt="' + esc(s.alt || '') + '"' + (i === 0 ? ' fetchpriority="high"' : ' loading="lazy"') + '></div>'));
        var b = el('<button type="button"' + (i === 0 ? ' class="active"' : '') + ' aria-label="Slide ' + (i + 1) + '"></button>');
        b.addEventListener('click', function () { go(i, true); });
        prog.appendChild(b);
      });
      var cur = 0, timer;
      function go(i, manual) {
        cur = (i + slides.length) % slides.length;
        qa('.slide', box).forEach(function (s, j) { s.classList.toggle('active', j === cur); });
        qa('button', prog).forEach(function (b, j) { b.classList.remove('active'); if (j === cur) { void b.offsetWidth; b.classList.add('active'); } });
        clearTimeout(timer);
        if (!reduced) timer = setTimeout(function () { go(cur + 1); }, ms);
      }
      if (!reduced && slides.length > 1) timer = setTimeout(function () { go(1); }, ms);
    });

    // Next Up panel
    var list = q('.nextup ul', hero); if (!list) return;
    Promise.all([load('data/schedule/upcoming.json'), membersP]).then(function (res) {
      var games = res[0].games || [], M = res[1], today = isoToday();
      var pool = games.filter(function (g) { return g.level === 'Varsity' && !g.status && g.opponent && g.date >= today && !/TBA/i.test(g.opponent); });
      if (pool.length < 4) pool = games.filter(function (g) { return g.level === 'Varsity' && !g.status && g.opponent && !/TBA/i.test(g.opponent); });
      pool.sort(function (a, b) { return (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')); });
      // prefer conference-vs-conference matchups with both crests, spread across sports
      var seen = {}, picks = [];
      pool.forEach(function (g) { if (picks.length < 4 && g.oppLogo && M.bySlug[g.oppLogo] && !seen[g.sport]) { seen[g.sport] = 1; picks.push(g); } });
      pool.forEach(function (g) { if (picks.length < 4 && picks.indexOf(g) < 0 && g.oppLogo && M.bySlug[g.oppLogo]) picks.push(g); });
      pool.forEach(function (g) { if (picks.length < 4 && picks.indexOf(g) < 0) picks.push(g); });
      picks.forEach(function (g) {
        var home = M.find(g.schoolLogo) || M.find(g.school), opp = M.bySlug[g.oppLogo] || M.find(g.opponent);
        var d = toDate(g.date);
        list.appendChild(el('<li><a class="game-mini" href="schedule.html#' + g.date + '">' +
          '<div class="when"><b>' + DAYS[d.getDay()] + '</b><span>' + esc(g.timeLabel || 'TBA') + '</span></div>' +
          '<div class="matchup">' + (home ? '<img src="' + home.logo + '" alt="">' : '') + '<span class="vs">' + (g.home ? 'vs' : '@') + '</span>' + (opp ? '<img src="' + opp.logo + '" alt="">' : '') +
          '<div class="names"><strong>' + esc(home ? home.short : cleanName(g.school)) + ' ' + (g.home ? 'vs' : 'at') + ' ' + esc(opp ? opp.short : cleanName(g.opponent)) + '</strong><small>' + esc(g.sport) + ' · ' + esc(g.level) + '</small></div></div></a></li>'));
      });
    }).catch(function () { q('.nextup', hero).remove(); });
  };

  /* ---------- stats count-up ---------- */
  PT.stats = function () {
    var root = q('.statband'); if (!root) return;
    Promise.all([membersP, load('data/schedule/index.json').catch(function () { return {}; })]).then(function (res) {
      var idx = res[1] || {};
      var games = idx.games || idx.deduped || (idx.counts && (idx.counts.deduped || idx.counts.games)) || (idx.totals && idx.totals.games) || 9800;
      var dates = idx.dates || (idx.counts && idx.counts.dates) || 220;
      // Counties and sports were hard-coded to the previous conference's numbers.
      // Schools and games were already read from the data; these two now are too:
      // counties from the member list, sports from the schedule index, minus the
      // CANCELLED pseudo-sport the splitter adds.
      var counties = (function () {
        var seen = {};
        (res[0].members || []).forEach(function (m) { if (m.county) seen[m.county] = 1; });
        return Object.keys(seen).length || 2;
      })();
      var sports = ((idx.sports || []).filter(function (x) { return !/^CANCELLED/i.test(x); }).length) || 20;
      var vals = { schools: res[0].members.length, counties: counties, sports: sports, games: games, dates: dates };
      qa('.stat .num', root).forEach(function (n) {
        var key = n.getAttribute('data-stat'), target = vals[key] || +n.getAttribute('data-target') || 0, suffix = n.getAttribute('data-suffix') || '';
        if (reduced) { n.textContent = target.toLocaleString() + suffix; return; }
        var start = null, dur = 1400;
        var io = new IntersectionObserver(function (entries) {
          if (!entries[0].isIntersecting) return; io.disconnect();
          requestAnimationFrame(function step(ts) {
            if (!start) start = ts; var p = Math.min(1, (ts - start) / dur); var e = 1 - Math.pow(1 - p, 3);
            n.textContent = Math.round(target * e).toLocaleString() + suffix;
            if (p < 1) requestAnimationFrame(step);
          });
        }, { threshold: .4 });
        n.textContent = '0' + suffix;
        io.observe(n);
      });
    });
  };

  /* ---------- crest marquee ---------- */
  var ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function spellCount(n) {
    n = Number(n) || 0;
    if (n < 20) return ONES[n] || String(n);
    if (n > 99) return String(n);
    var t = TENS[Math.floor(n / 10)], o = n % 10;
    return o ? t + '-' + ONES[o] : t;
  }

  // A static grid, not a marquee. The crests are links to each school's
  // schedule, and chasing a moving target to click one is no way to offer a
  // link - so every school sits still and visible, the way the standard
  // template does it. The tile itself keeps the platinum treatment.
  PT.marquee = function () {
    var root = q('.crest-marquee-wrap'); if (!root) return;
    membersP.then(function (d) {
      qa('.school-count').forEach(function (el) { el.textContent = spellCount(d.members.length); });
      var grid = el('<div class="crest-grid"></div>');
      grid.innerHTML = d.members.map(function (s, i) {
        // A crest goes to that school's SCHEDULE (ArbiterLive, DigitalSports,
        // or whatever it publishes), not its athletics homepage - this is a
        // schedule site, so the crest is a shortcut to that school's games.
        var href = s.schedule || s.website;
        // --i drives the ray's stagger; without it every tile flashes together.
        return '<a class="crest-tile" style="--i:' + i + '" href="' + esc(href) + '" target="_blank" rel="noopener" aria-label="' + esc(s.short) + ' schedule">' +
          '<img src="' + s.logo + '" alt="" loading="lazy">' +
          '<span class="crest-name">' + esc(s.short) + '</span></a>';
      }).join('');
      root.appendChild(grid);
    });
  };

  /* ---------- news ---------- */
  var SPORT_PHOTO = [[/field hockey/i, 'images/photos/field-hockey.jpg'], [/football/i, 'images/photos/football.jpg'], [/girls soccer/i, 'images/photos/girls-soccer.jpg'], [/soccer/i, 'images/photos/morris-knolls-soccer.jpg'], [/volleyball/i, 'images/photos/chatham-volleyball.jpg'], [/tennis/i, 'images/photos/girls-tennis.jpg'], [/cross country|xc/i, 'images/photos/boys-cross-country.jpg']];
  function fallbackPhoto(title, i) { for (var k = 0; k < SPORT_PHOTO.length; k++) if (SPORT_PHOTO[k][0].test(title)) return SPORT_PHOTO[k][1]; return ['images/photos/eastern-lenape-football.jpg', 'images/photos/bishop-eustace-camden-catholic-field-hockey.jpg', 'images/photos/shawnee-moorestown-boys-soccer.jpg'][i % 3]; }

  PT.news = function (opts) {
    opts = opts || {};
    var root = q(opts.root || '.news-grid'); if (!root) return;
    Promise.all([load('data/news.json'), membersP]).then(function (res) {
      var items = (res[0].news || []).slice(0, opts.limit || 50), M = res[1];
      if (!items.length) { root.innerHTML = '<div class="empty">No stories yet</div>'; return; }
      root.innerHTML = items.map(function (n, i) {
        var m = M.find(n.school), img = n.image || fallbackPhoto(n.title, i);
        return '<a class="story' + (i === 0 && opts.feature !== false ? ' story--feature' : '') + '" href="' + esc(n.url || '#') + '" target="_blank" rel="noopener">' +
          '<div class="bg"><img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + fallbackPhoto(n.title, i) + '\'"></div><div class="story-veil"></div><div class="shine"></div>' +
          '<div class="body"><div class="meta"><span class="badge">' + esc(n.outlet || 'News') + '</span><span>' + fmtShort(n.date) + '</span></div>' +
          '<h3>' + esc(n.title) + '</h3>' + (n.excerpt ? '<p class="excerpt">' + esc(n.excerpt) + '</p>' : '') +
          (m ? '<div class="school"><img src="' + m.logo + '" alt="">' + esc(m.short) + '</div>' : '') + '</div></a>';
      }).join('');
    }).catch(function () { root.innerHTML = '<div class="empty">News unavailable</div>'; });
  };

  /* ---------- schedule ---------- */
  PT.schedule = function (opts) {
    opts = opts || {};
    var root = q(opts.root || '#schedule'); if (!root) return;
    var daysEl = q('.sched-days', root), filtersEl = q('.sched-filters', root), listEl = q('.game-list', root);
    Promise.all([load('data/schedule/upcoming.json'), membersP]).then(function (res) {
      var all = (res[0].games || []).filter(function (g) { return g.opponent && !/^TBA/i.test(g.opponent); }), M = res[1];
      var dates = Object.keys(all.reduce(function (a, g) { a[g.date] = 1; return a; }, {})).sort();
      if (!dates.length) { listEl.innerHTML = '<div class="empty">No games in range</div>'; return; }
      var today = isoToday(), hash = location.hash.replace('#', '');
      function varsityCount(d) { return all.filter(function (g) { return g.date === d && g.level === 'Varsity' && !g.status; }).length; }
      // land on today unless it is a thin day; then jump to the next date with a real slate
      var start = dates.indexOf(today) >= 0 ? today : dates[0];
      if (varsityCount(start) < 6) { var busier = dates.filter(function (d) { return d >= start && varsityCount(d) >= 6; })[0]; if (busier) start = busier; }
      var state = { date: dates.indexOf(hash) >= 0 ? hash : start, sport: 'All', varsity: true, school: 'All' };

      // day tabs
      dates.forEach(function (d) {
        var dt = toDate(d), n = all.filter(function (g) { return g.date === d && (!state.varsity || g.level === 'Varsity'); }).length;
        var b = el('<button type="button" class="day-tab" data-date="' + d + '"><small>' + DAYS[dt.getDay()] + '</small><b>' + dt.getDate() + '</b><span>' + n + ' games</span></button>');
        b.addEventListener('click', function () { state.date = d; render(); });
        daysEl.appendChild(b);
      });

      // sport chips (top sports by count in range)
      var counts = {};
      all.forEach(function (g) { if (g.level === 'Varsity') counts[g.sport] = (counts[g.sport] || 0) + 1; });
      var sports = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, opts.sports || 8);
      var chipsHtml = ['All'].concat(sports).map(function (s) { return '<button type="button" class="chip' + (s === 'All' ? ' active' : '') + '" data-sport="' + esc(s) + '">' + esc(s) + '</button>'; }).join('');
      filtersEl.innerHTML = chipsHtml + '<span class="spacer"></span>' +
        (opts.schoolFilter ? '<select class="select" aria-label="Filter by school"><option value="All">All schools</option>' + M.members.map(function (m) { return '<option value="' + m.slug + '">' + esc(m.short) + '</option>'; }).join('') + '</select>' : '') +
        '<button type="button" class="chip chip--toggle active" data-toggle="varsity">Varsity only</button>';
      qa('.chip[data-sport]', filtersEl).forEach(function (c) { c.addEventListener('click', function () { state.sport = c.getAttribute('data-sport'); qa('.chip[data-sport]', filtersEl).forEach(function (x) { x.classList.toggle('active', x === c); }); render(); }); });
      var tog = q('[data-toggle="varsity"]', filtersEl);
      tog.addEventListener('click', function () { state.varsity = !state.varsity; tog.classList.toggle('active', state.varsity); tog.textContent = state.varsity ? 'Varsity only' : 'All levels'; refreshCounts(); render(); });
      var sel = q('select', filtersEl); if (sel) sel.addEventListener('change', function () { state.school = sel.value; render(); });

      function refreshCounts() {
        qa('.day-tab', daysEl).forEach(function (b) { var d = b.getAttribute('data-date'); q('span', b).textContent = all.filter(function (g) { return g.date === d && (!state.varsity || g.level === 'Varsity'); }).length + ' games'; });
      }
      function render() {
        qa('.day-tab', daysEl).forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-date') === state.date); });
        var rows = all.filter(function (g) {
          if (g.date !== state.date) return false;
          if (state.varsity && g.level !== 'Varsity') return false;
          if (state.sport !== 'All' && g.sport !== state.sport) return false;
          if (state.school !== 'All') { var h = M.find(g.schoolLogo) || M.find(g.school); if (!(h && h.slug === state.school) && g.oppLogo !== state.school) return false; }
          return true;
        }).sort(function (a, b) { return (a.time || '99').localeCompare(b.time || '99') || a.sport.localeCompare(b.sport); });
        var out = dedupe(rows, M);
        var limit = opts.limit || 999;
        listEl.innerHTML = out.length ? out.slice(0, limit).map(function (r) {
          var g = r.g, h = r.h, o = r.o;
          var homeTeam = g.home ? [h, g.school] : [o, g.opponent], awayTeam = g.home ? [o, g.opponent] : [h, g.school];
          function team(t) { var m = t[0]; return '<div class="team">' + (m ? '<img src="' + m.logo + '" alt="">' : '<span class="crest-blank"></span>') + '<span>' + esc(m ? m.short : cleanName(t[1])) + '</span></div>'; }
          var cancelled = !!g.status;
          return '<div class="game-row' + (cancelled ? ' cancelled' : '') + '">' +
            '<div class="time">' + esc((g.timeLabel || 'TBA').replace(/\s?(AM|PM)/, '')) + '<small>' + esc((g.timeLabel || '').match(/AM|PM/) ? g.timeLabel.match(/AM|PM/)[0] : '') + '</small></div>' +
            '<div class="sport"><b>' + esc(g.sport) + '</b><span>' + esc(g.level) + '</span></div>' +
            '<div class="teams">' + team(awayTeam) + '<span class="at">@</span>' + team(homeTeam) + '</div>' +
            '<div class="status">' + (cancelled ? esc(g.status) : '<span class="home-pill">' + (h && g.home ? 'Home' : 'Away') + '</span>') + '</div>' +
          '</div>';
        }).join('') + (out.length > limit ? '<div class="sched-more"><a class="btn btn--ghost" href="schedule.html#' + state.date + '">See all ' + out.length + ' games this day <span class="arrow">→</span></a></div>' : '')
        : '<div class="empty">No ' + (state.sport !== 'All' ? esc(state.sport) + ' ' : '') + 'games on ' + fmtLong(state.date) + '</div>';
        var lbl = q('.sched-daylabel', root); if (lbl) lbl.textContent = fmtLong(state.date);
      }
      render();
    }).catch(function (e) { listEl.innerHTML = '<div class="empty">Schedule unavailable</div>'; console.error(e); });
  };

  /* ---------- season gateway ----------
     The week view reads as the whole schedule, so this states the real scale and
     names every filter the calendar offers. Counts come from the data, not copy. */
  PT.seasonGate = function () {
    var root = q('.season-gate') || q('.page-hero'); if (!root || !q('[data-gate]', root)) return;
    Promise.all([load('data/schedule/index.json'), membersP]).then(function (res) {
      var idx = res[0], M = res[1];
      var games = (idx.counts && (idx.counts.deduped || idx.counts.games)) || idx.games || 0;
      var sports = (idx.sports || []).filter(function (s) { return !/^CANCELLED/i.test(s); }).length;
      var months = (idx.months || []).length;
      var set = { games: games, sports: sports, schools: M.members.length, months: months };
      qa('[data-gate]', root).forEach(function (n) {
        var v = set[n.getAttribute('data-gate')];
        if (v != null) n.textContent = v.toLocaleString();
      });
    }).catch(function () { root.remove(); });
  };

  /* ---------- full season calendar ---------- */
  PT.calendar = function () {
    var root = q('#calendar'); if (!root) return;
    var modesEl = q('.cal-modes', root), filtersEl = q('.cal-filters', root), bodyEl = q('.cal-body', root), countEl = q('.cal-count', root);
    var monthCache = {};
    function loadMonth(m) { if (!monthCache[m]) monthCache[m] = load('data/schedule/' + m + '.json').then(function (d) { return d.games || []; }).catch(function () { return []; }); return monthCache[m]; }

    Promise.all([load('data/schedule/index.json'), membersP]).then(function (res) {
      var idx = res[0], M = res[1];
      var months = (idx.months || []).map(function (m) { return typeof m === 'string' ? m : (m.month || m.name); }).filter(Boolean).sort();
      var today = isoToday();
      var thisMonth = months.indexOf(today.slice(0, 7)) >= 0 ? today.slice(0, 7) : months[0];
      var startMode = /season/i.test(location.hash) ? 'season' : 'upcoming';
      // 'All' = every month. thisMonth is kept so the month select can still
      // open on somewhere useful when the visitor narrows to one.
      var state = { mode: startMode, month: 'All', sport: 'All', school: 'All', level: 'Varsity', date: '', limit: 250 };

      modesEl.innerHTML =
        '<button type="button" class="cal-mode' + (startMode === 'upcoming' ? ' active' : '') + '" data-mode="upcoming"><b>Upcoming</b><span>The next games, day by day</span></button>' +
        '<button type="button" class="cal-mode' + (startMode === 'season' ? ' active' : '') + '" data-mode="season"><b>Full Season</b><span>All ' + months.length + ' months · filter by sport, school &amp; level</span></button>';
      qa('.cal-mode', modesEl).forEach(function (b) {
        b.addEventListener('click', function () {
          state.mode = b.getAttribute('data-mode'); state.limit = 250;
          qa('.cal-mode', modesEl).forEach(function (x) { x.classList.toggle('active', x === b); });
          q('.cal-month', filtersEl).hidden = state.mode !== 'season';
          render();
        });
      });

      var sports = (idx.sports || []).slice().filter(function (s) { return !/^CANCELLED/i.test(s); }).sort();
      var levels = ['Varsity', 'Junior Varsity', 'Freshman', 'Middle School'];
      filtersEl.innerHTML =
        '<select class="select cal-month" aria-label="Month"' + (state.mode === 'season' ? '' : ' hidden') + '>' +
          '<option value="All"' + (state.month === 'All' ? ' selected' : '') + '>All months</option>' + months.map(function (m) {
          var d = toDate(m + '-01'); return '<option value="' + m + '"' + (m === state.month ? ' selected' : '') + '>' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + '</option>';
        }).join('') + '</select>' +
        '<select class="select cal-sport" aria-label="Sport"><option value="All">All sports</option>' + sports.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select>' +
        '<select class="select cal-school" aria-label="School"><option value="All">All schools</option>' + M.members.map(function (m) { return '<option value="' + m.slug + '">' + esc(m.short) + '</option>'; }).join('') + '</select>' +
        '<select class="select cal-level" aria-label="Level"><option value="All">All levels</option>' + levels.map(function (l) { return '<option' + (l === state.level ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>' +
        '<input class="select cal-date" type="date" aria-label="Jump to date" min="' + months[0] + '-01" max="' + months[months.length - 1] + '-28">' +
        '<span class="spacer"></span>' +
        '<button type="button" class="btn btn--ghost btn--sm cal-print">Print</button>' +
        '<a class="btn btn--chrome btn--sm" href="feeds/all.ics">Add to calendar</a>';

      q('.cal-month', filtersEl).addEventListener('change', function (e) { state.month = e.target.value; state.limit = 250; render(); });
      q('.cal-sport', filtersEl).addEventListener('change', function (e) { state.sport = e.target.value; state.limit = 250; render(); });
      q('.cal-school', filtersEl).addEventListener('change', function (e) { state.school = e.target.value; state.limit = 250; render(); });
      q('.cal-level', filtersEl).addEventListener('change', function (e) { state.level = e.target.value; state.limit = 250; render(); });
      q('.cal-print', filtersEl).addEventListener('click', function () { window.print(); });
      q('.cal-date', filtersEl).addEventListener('change', function (e) {
        state.date = e.target.value; if (!state.date) return render();
        var m = state.date.slice(0, 7);
        if (months.indexOf(m) >= 0) { state.month = m; q('.cal-month', filtersEl).value = m; }
        state.mode = 'season'; state.limit = 250;
        qa('.cal-mode', modesEl).forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-mode') === 'season'); });
        q('.cal-month', filtersEl).hidden = false;
        render();
      });

      function monthLabel(m) { var d = toDate(m + '-01'); return MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
      function loadAllMonths() {
        return Promise.all(months.map(loadMonth)).then(function (lists) {
          return lists.reduce(function (a, b) { return a.concat(b); }, []);
        });
      }
      function source() {
        if (state.mode === 'upcoming') return load('data/schedule/upcoming.json').then(function (d) { return d.games || []; });
        return state.month === 'All' ? loadAllMonths() : loadMonth(state.month);
      }
      // What window the current answer covers — shown with every count, so a
      // small number is never mistaken for the whole season.
      function scopeLabel() {
        if (state.date) return fmtLong(state.date);
        if (state.mode === 'upcoming') return 'next 7 days';
        return state.month === 'All' ? 'full season' : monthLabel(state.month);
      }
      function filtered() { return state.sport !== 'All' || state.school !== 'All' || state.level !== 'All'; }

      function render() {
        bodyEl.innerHTML = '<div class="empty">Loading…</div>';
        source().then(function (games) {
          var rows = games.filter(function (g) {
            if (!g.opponent || /^TBA/i.test(g.opponent)) return false;
            if (state.level !== 'All' && g.level !== state.level) return false;
            if (state.sport !== 'All' && g.sport !== state.sport) return false;
            if (state.date && g.date !== state.date) return false;
            if (state.school !== 'All') { var h = M.find(g.schoolLogo) || M.find(g.school); if (!(h && h.slug === state.school) && g.oppLogo !== state.school) return false; }
            return true;
          });
          var out = dedupe(rows, M);
          out.sort(function (a, b) { return (a.g.date + (a.g.time || '99')).localeCompare(b.g.date + (b.g.time || '99')); });
          countEl.textContent = (out.length ? out.length.toLocaleString() + ' game' + (out.length === 1 ? '' : 's') : 'No games')
            + ' · ' + scopeLabel();
          // A filtered Upcoming view is the case that misleads: it looks like a
          // season search. Offer the season rather than leaving the visitor to
          // conclude the team only plays three times.
          var weekNote = (state.mode === 'upcoming' && filtered() && !state.date)
            ? '<div class="sched-more"><button type="button" class="btn btn--ghost cal-season">These are only the next 7 days — search the full season <span class="arrow">→</span></button></div>'
            : '';
          function wireSeason() {
            var b = q('.cal-season', bodyEl); if (!b) return;
            b.addEventListener('click', function () {
              state.mode = 'season'; state.month = 'All'; state.limit = 250;
              qa('.cal-mode', modesEl).forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-mode') === 'season'); });
              var ms = q('.cal-month', filtersEl); ms.hidden = false; ms.value = 'All';
              render();
            });
          }
          if (!out.length) { bodyEl.innerHTML = '<div class="empty">No games match those filters</div>' + weekNote; wireSeason(); return; }

          var shown = out.slice(0, state.limit), byDay = [], cur = null;
          shown.forEach(function (r) { if (!cur || cur.date !== r.g.date) { cur = { date: r.g.date, rows: [] }; byDay.push(cur); } cur.rows.push(r); });
          bodyEl.innerHTML = byDay.map(function (d) {
            return '<section class="day-group"><header class="day-head"><h3>' + fmtLong(d.date) + (d.date === today ? ' <span class="badge">Today</span>' : '') + '</h3><span>' + d.rows.length + ' game' + (d.rows.length === 1 ? '' : 's') + '</span></header><div class="game-list">' +
              d.rows.map(function (r) {
                var g = r.g, h = r.h, o = r.o;
                var homeT = g.home ? [h, g.school] : [o, g.opponent], awayT = g.home ? [o, g.opponent] : [h, g.school];
                function team(t) { var m = t[0]; return '<div class="team">' + (m ? '<img src="' + m.logo + '" alt="">' : '<span class="crest-blank"></span>') + '<span>' + esc(m ? m.short : cleanName(t[1])) + '</span></div>'; }
                var cancelled = !!g.status;
                return '<div class="game-row' + (cancelled ? ' cancelled' : '') + '">' +
                  '<div class="time">' + esc((g.timeLabel || 'TBA').replace(/\s?(AM|PM)/, '')) + '<small>' + esc((g.timeLabel || '').match(/AM|PM/) ? g.timeLabel.match(/AM|PM/)[0] : '') + '</small></div>' +
                  '<div class="sport"><b>' + esc(g.sport) + '</b><span>' + esc(g.level) + '</span></div>' +
                  '<div class="teams">' + team(awayT) + '<span class="at">@</span>' + team(homeT) + '</div>' +
                  '<div class="status">' + (cancelled ? esc(g.status) : '<span class="home-pill">' + (h && g.home ? 'Home' : 'Away') + '</span>') + '</div></div>';
              }).join('') + '</div></section>';
          }).join('') + (out.length > shown.length ? '<div class="sched-more"><button type="button" class="btn btn--ghost cal-more">Show more — ' + (out.length - shown.length).toLocaleString() + ' remaining <span class="arrow">→</span></button></div>' : '');
          bodyEl.insertAdjacentHTML('beforeend', weekNote);
          wireSeason();
          var more = q('.cal-more', bodyEl);
          if (more) more.addEventListener('click', function () { state.limit += 250; render(); });
        });
      }
      render();
    }).catch(function () { bodyEl.innerHTML = '<div class="empty">Calendar unavailable</div>'; });
  };

  /* ---------- videos ----------
     Two shapes: YouTube ({id}) embeds inline; NFHS Network ({url, source:'nfhs'})
     opens in a new tab because NFHS refuses to be iframed. */
  /* Counties, largest first — derived from the member list so the template
     carries no conference's geography of its own. */
  function countyList(d) {
    var n = {};
    (d.members || []).forEach(function (m) { if (m.county) n[m.county] = (n[m.county] || 0) + 1; });
    return Object.keys(n).sort(function (a, b) { return n[b] - n[a] || a.localeCompare(b); });
  }

  var SOURCE_NAME = { nfhs: 'NFHS Network', hudl: 'Hudl' };
  function sourceName(v) { return SOURCE_NAME[v.source] || 'NFHS Network'; }

  function nfhsThumb(url) { var m = String(url).match(/\/(gam[a-z0-9]+)(?:[/?]|$)/i); return m ? 'https://social.nfhsnetwork.com/thumbnails/' + m[1] + '_nfhs_net.jpg' : ''; }

  PT.videos = function (opts) {
    opts = opts || {};
    var root = q(opts.root || '.vision-grid'); if (!root) return;
    Promise.all([load('data/videos.json'), membersP]).then(function (res) {
      var vids = (res[0].videos || []).filter(function (v) { return v.id || v.url; }).slice(0, opts.limit || 50), M = res[1];
      if (!vids.length) { root.innerHTML = '<div class="empty">No broadcasts yet</div>'; return; }
      root.innerHTML = vids.map(function (v, i) {
        // Opt-in: with a short library every broadcast carries equal weight.
        var feature = i === 0 && opts.feature === true;
        var ext = !v.id && v.url;
        var thumb = v.thumb && /^https?:|^images\//.test(v.thumb) ? v.thumb
          : ext ? (v.source === 'hudl' ? '' : nfhsThumb(v.url))
          : 'https://i.ytimg.com/vi/' + v.id + '/' + (feature ? 'maxresdefault' : 'hqdefault') + '.jpg';
        var fb = ext ? fallbackPhoto((v.sport || '') + ' ' + (v.title || ''), i) : 'https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg';
        // titles read "Away vs. Home" — pull crests where both sides are member schools
        var crests = String(v.title || '').split(/\s+vs\.?\s+/i).map(function (s) { return M.find(s.trim()); }).filter(Boolean);
        return '<article class="vid' + (feature ? ' vid--feature' : '') + '"' + (ext ? ' data-url="' + esc(v.url) + '"' : ' data-id="' + esc(v.id) + '"') + '>' +
          '<img src="' + esc(thumb) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + esc(fb) + '\'"><div class="v-veil"></div>' +
          (crests.length === 2 ? '<div class="v-crests">' + crests.map(function (m) { return '<img src="' + m.logo + '" alt="' + esc(m.short) + '">'; }).join('') + '</div>' : '') +
          '<div class="v-meta"><div class="meta"><span class="badge' + (ext ? '' : ' badge--crimson') + '">' + (ext ? esc(sourceName(v)) : 'Olympic Vision') + '</span><span>' + esc(v.sport || '') + (v.date ? ' · ' + fmtShort(v.date) : '') + '</span></div>' +
          '<h3>' + esc(v.title) + '</h3>' + (ext ? '<p class="v-ext">Watch on ' + esc(sourceName(v)) + ' <span class="arrow">↗</span></p>' : '') + '</div>' +
          '<span class="play" aria-hidden="true"></span><button class="hit" type="button" aria-label="' + (ext ? 'Watch on ' + sourceName(v) + ': ' : 'Play: ') + esc(v.title) + '"></button></article>';
      }).join('');
      qa('.vid', root).forEach(function (card) {
        q('.hit', card).addEventListener('click', function () {
          var url = card.getAttribute('data-url');
          if (url) { window.open(url, '_blank', 'noopener,noreferrer'); return; }
          var f = document.createElement('iframe');
          f.src = 'https://www.youtube.com/embed/' + card.getAttribute('data-id') + '?autoplay=1&rel=0';
          f.title = q('h3', card).textContent; f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture'; f.allowFullscreen = true;
          card.innerHTML = ''; card.appendChild(f);
        });
      });
    }).catch(function () { root.innerHTML = '<div class="empty">Video unavailable</div>'; });
  };

  /* ---------- seasons / standings ---------- */
  PT.seasons = function () {
    var root = q('.seasons--standings'); if (!root) return;
    load('data/standings.json').then(function (d) {
      root.innerHTML = (d.seasons || []).map(function (s, i) {
        return '<div class="season-card"><div class="s-head"><h3 class="chrome-text">' + esc(s.name) + '</h3><span>' + esc(s.months || d.defaultSeason || '') + '</span></div>' +
          '<div class="sports">' + (s.sports || []).map(function (sp) {
            var href = sp.url || (sp.slug
              ? d.baseUrl + '/' + sp.slug + '/standings/season/' + (sp.season || d.defaultSeason) + '?conference=' + encodeURIComponent(sp.conference || d.defaultConference)
              : '');
            var tip = sp.note ? ' title="' + esc(sp.note) + '"' : '';
            // No source is not a broken link — say so plainly instead.
            if (!href) return '<span class="chip-off"' + (sp.note ? tip : ' title="No conference standings published"') + '>' + esc(sp.label) + '</span>';
            return '<a href="' + esc(href) + '" target="_blank" rel="noopener"' + tip + '>' + esc(sp.label) + '</a>';
          }).join('') + '</div><span class="ghost-num" aria-hidden="true">0' + (i + 1) + '</span></div>';
      }).join('');
    });
  };

  /* ---------- scores (outbound to NJ.com) ----------
     NJ.com scopes standings by conference server-side (?conference=Olympic Conference) but its
     scoreboard filter is client-side only, so a scores link can carry sport and date
     and nothing more — the visitor picks the Olympic Conference from the Conference control on arrival.
     Only head-to-head sports get a scoreboard link; meet sports have no final score. */
  var HEAD_TO_HEAD = ['football', 'boyssoccer', 'girlssoccer', 'fieldhockey', 'girlsvolleyball', 'girlstennis',
    'boysbasketball', 'girlsbasketball', 'icehockey', 'boysicehockey', 'wrestling', 'girlswrestling', 'boysbowling', 'girlsbowling',
    'baseball', 'softball', 'boyslacrosse', 'girlslacrosse', 'boysvolleyball', 'boystennis'];

  /* Homepage twin of PT.seasons: same season cards, but each chip opens NJ.com's
     scoreboard for that sport on today's date. Meet sports have no head-to-head
     final, so they stay in the grid as dimmed labels rather than dead links. */
  PT.scoreSeasons = function () {
    var root = q('.seasons--scores'); if (!root) return;
    load('data/standings.json').then(function (d) {
      var now = new Date(), dateSeg = now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate();
      root.innerHTML = (d.seasons || []).map(function (s, i) {
        var sports = (s.sports || []).filter(function (sp) { return sp.slug || sp.url; });
        return '<div class="season-card"><div class="s-head"><h3 class="chrome-text">' + esc(s.name) + '</h3><span>NJ.com scoreboard</span></div>' +
          '<div class="sports">' + sports.map(function (sp) {
            if (!sp.slug || sp.url || HEAD_TO_HEAD.indexOf(sp.slug) < 0)
              return '<span class="chip-off" title="Meet-based — no head-to-head score">' + esc(sp.label) + '</span>';
            return '<a href="https://highschoolsports.nj.com/' + esc(sp.slug) + '/schedule/' + dateSeg + '" target="_blank" rel="noopener">' + esc(sp.label) + '</a>';
          }).join('') + '</div><span class="ghost-num" aria-hidden="true">0' + (i + 1) + '</span></div>';
      }).join('');
    }).catch(function () { root.innerHTML = '<div class="empty">Unavailable</div>'; });
  };

  PT.scores = function () {
    var root = q('.score-seasons'); if (!root) return;
    load('data/standings.json').then(function (d) {
      var now = new Date(), y = now.getFullYear(), m = now.getMonth() + 1, day = now.getDate();
      var dateSeg = y + '/' + m + '/' + day;
      root.innerHTML = (d.seasons || []).map(function (s, i) {
        var sports = (s.sports || []).filter(function (sp) { return sp.slug || sp.url; });
        return '<div class="season-card"><div class="s-head"><h3 class="chrome-text">' + esc(s.name) + '</h3><span>' + sports.length + ' sports</span></div>' +
          '<div class="score-rows">' + sports.map(function (sp) {
            var hh = sp.slug && !sp.url && HEAD_TO_HEAD.indexOf(sp.slug) >= 0;
            var scoreUrl = 'https://highschoolsports.nj.com/' + sp.slug + '/schedule/' + dateSeg;
            var standUrl = sp.url || (d.baseUrl + '/' + sp.slug + '/standings/season/' + (sp.season || d.defaultSeason) + '?conference=' + encodeURIComponent(sp.conference || d.defaultConference));
            var standLabel = sp.url ? 'Results ↗' : 'Standings ↗';
            return '<div class="score-row"><span class="sname">' + esc(sp.label) + '</span><span class="slinks">' +
              (hh ? '<a href="' + esc(scoreUrl) + '" target="_blank" rel="noopener">Scores ↗</a>' : '<span class="na" title="Meet-based — no head-to-head score">Meet</span>') +
              '<a href="' + esc(standUrl) + '" target="_blank" rel="noopener"' + (sp.url ? '' : ' class="is-conf"') + '>' + standLabel + '</a></span></div>';
          }).join('') + '</div><span class="ghost-num" aria-hidden="true">0' + (i + 1) + '</span></div>';
      }).join('');
    }).catch(function () { root.innerHTML = '<div class="empty">Unavailable</div>'; });
  };

  /* ---------- leadership ---------- */
  PT.leaders = function () {
    var root = q('.leaders'); if (!root) return;
    Promise.all([load('data/leadership.json'), membersP]).then(function (res) {
      var list = res[0].leadership || res[0].leaders || [], M = res[1];
      root.innerHTML = list.map(function (l) {
        var m = M.find(l.school);
        return '<div class="leader"><span class="role">' + esc(l.role) + '</span><span class="name">' + esc(l.name) + '</span>' + (l.school ? '<span class="school">' + (m ? '<img src="' + m.logo + '" alt="">' : '') + esc(m ? m.short : l.school) + '</span>' : '<span class="school">Conference Office</span>') + '</div>';
      }).join('');
    });
  };

  /* ---------- schools page ---------- */
  PT.schools = function (opts) {
    opts = opts || {};
    var root = q(opts.root || '.school-grid'); if (!root) return;
    var tabs = q('.county-tabs');
    membersP.then(function (d) {
      qa('.school-count').forEach(function (el) { el.textContent = spellCount(d.members.length); });
      var state = { county: 'All', qs: '' };
      var counts = {};
      d.members.forEach(function (m) { if (m.county) counts[m.county] = (counts[m.county] || 0) + 1; });
      if (tabs) {
        tabs.innerHTML = ['All'].concat(countyList(d)).map(function (c) { return '<button type="button" class="chip' + (c === 'All' ? ' active' : '') + '" data-county="' + c + '">' + c + (c === 'All' ? ' · ' + d.members.length : ' · ' + counts[c]) + '</button>'; }).join('') +
          '<span class="spacer"></span><input class="search" type="search" placeholder="Search schools or ADs…" aria-label="Search schools">';
        qa('.chip', tabs).forEach(function (c) { c.addEventListener('click', function () { state.county = c.getAttribute('data-county'); qa('.chip', tabs).forEach(function (x) { x.classList.toggle('active', x === c); }); render(); }); });
        q('.search', tabs).addEventListener('input', function (e) { state.qs = e.target.value.toLowerCase(); render(); });
      }
      function render() {
        var rows = d.members.filter(function (m) { return (state.county === 'All' || m.county === state.county) && (!state.qs || (m.name + ' ' + m.ad).toLowerCase().indexOf(state.qs) >= 0); });
        if (opts.limit) rows = rows.slice(0, opts.limit);
        root.innerHTML = rows.length ? rows.map(function (m) {
          return '<article class="school-card"><div class="crest"><img src="' + m.logo + '" alt="" loading="lazy"></div><div><h3>' + esc(m.name) + '</h3><div class="county">' + m.county + ' County</div>' +
            (m.ad ? '<div class="ad"><span>Athletic Director</span><strong>' + esc(m.ad) + '</strong>' + (m.email ? '<a href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a>' : '') + (m.phone ? '<a href="tel:' + esc(m.phone.replace(/[^\d+]/g, '')) + '">' + esc(m.phone) + '</a>' : '') + '</div>' : '') + '</div>' +
            '<div class="links"><a class="btn btn--chrome btn--sm" href="' + esc(m.schedule || m.website) + '" target="_blank" rel="noopener">Schedule</a><a class="btn btn--ghost btn--sm" href="' + esc(m.website) + '" target="_blank" rel="noopener">Website</a></div></article>';
        }).join('') : '<div class="empty">No schools match</div>';
      }
      render();
    });
  };

  /* ---------- about page county cards ---------- */
  PT.counties = function () {
    var root = q('.county-cards'); if (!root) return;
    membersP.then(function (d) {
      root.innerHTML = countyList(d).map(function (c) {
        var ms = d.members.filter(function (m) { return m.county === c; });
        return '<div class="county-card"><div class="n chrome-text">' + ms.length + '</div><div><h4>' + c + ' County</h4><div class="crests">' + ms.map(function (m) { return '<img src="' + m.logo + '" alt="' + esc(m.short) + '" title="' + esc(m.short) + '" loading="lazy">'; }).join('') + '</div></div></div>';
      }).join('');
    });
  };

  PT.init = function (page, sections) {
    PT.chrome(page);
    (sections || []).forEach(function (fn) { fn(); });
  };
})();
