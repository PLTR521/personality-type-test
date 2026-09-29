/* 화면 전환 · 응답 입력 · 결과 렌더링 */
(function () {
  var Q = window.QUESTIONS, S = window.Scoring, C = window.CONTENT, T = window.TYPES;
  var PER_PAGE = 6, PAGES = Q.length / PER_PAGE;
  var STORE = 'gyeol-test-v1';
  var ALL = Object.keys(T);

  var answers = new Array(Q.length).fill(null);
  var page = 0, elapsed = 0, pageStart = 0;
  var lastResult = null;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function li(arr) { return '<ul>' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }

  function store(fn) { try { return fn(window.localStorage); } catch (e) { return null; } }
  function save() { store(function (s) { s.setItem(STORE, JSON.stringify({ a: answers, p: page, e: elapsed })); }); }
  function clearSave() { store(function (s) { s.removeItem(STORE); }); }
  function load() {
    var raw = store(function (s) { return s.getItem(STORE); });
    if (!raw) return null;
    try {
      var d = JSON.parse(raw);
      if (Array.isArray(d.a) && d.a.length === Q.length) return d;
    } catch (e) { /* ignore */ }
    return null;
  }

  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* ---------- 화면 전환 ---------- */
  function show(name) {
    $$('.screen').forEach(function (s) { s.hidden = s.id !== 'screen-' + name; });
    window.scrollTo(0, 0);
  }

  function go(name) {
    if (name === 'start') { if (location.hash) history.replaceState(null, '', location.pathname + location.search); refreshStart(); show('start'); }
    else if (name === 'types') { renderTypes(); show('types'); }
    else if (name === 'compat') { renderCompatForm(); show('compat'); }
  }

  /* ---------- 시작 ---------- */
  function refreshStart() {
    var d = load(), any = d && d.a.some(function (x) { return x !== null; });
    $('#btn-resume').hidden = !any;
  }

  function startQuiz(fresh) {
    if (fresh) { answers = new Array(Q.length).fill(null); page = 0; elapsed = 0; clearSave(); }
    renderPage();
    show('quiz');
  }

  function resumeQuiz() {
    var d = load();
    if (d) { answers = d.a; page = Math.min(Math.max(d.p | 0, 0), PAGES - 1); elapsed = d.e || 0; }
    startQuiz(false);
  }

  /* ---------- 검사 ---------- */
  var LABELS = { '-3': '매우 그렇지 않다', '-2': '그렇지 않다', '-1': '약간 그렇지 않다', '0': '보통', '1': '약간 그렇다', '2': '그렇다', '3': '매우 그렇다' };

  function renderPage() {
    var box = $('#questions'), html = '';
    for (var i = page * PER_PAGE; i < (page + 1) * PER_PAGE; i++) {
      var q = Q[i], dots = '';
      for (var v = -3; v <= 3; v++) {
        dots += '<button type="button" class="dot s' + Math.abs(v) + ' ' + (v < 0 ? 'neg' : v > 0 ? 'pos' : '') + (answers[i] === v ? ' on' : '') +
          '" data-i="' + i + '" data-v="' + v + '" aria-label="' + LABELS[v] + '" aria-pressed="' + (answers[i] === v) + '"></button>';
      }
      html += '<div class="card q" id="q' + i + '"><div class="q-text"><span class="q-num">' + q.id + ' / ' + Q.length + '</span>' + esc(q.text) +
        '</div><div class="scale"><span class="lab l">그렇지 않다</span>' + dots + '<span class="lab r">그렇다</span></div></div>';
    }
    box.innerHTML = html;
    $('#quiz-msg').hidden = true;
    $('#btn-prev').disabled = page === 0;
    $('#btn-next').textContent = page === PAGES - 1 ? '결과 보기' : '다음';
    updateProgress();
    pageStart = Date.now();
    window.scrollTo(0, 0);
  }

  function updateProgress() {
    var n = answers.filter(function (a) { return a !== null; }).length;
    $('#progress-bar').style.width = (n / Q.length * 100) + '%';
    $('#progress-count').textContent = n + ' / ' + Q.length + ' 문항';
    $('#page-count').textContent = (page + 1) + ' / ' + PAGES + ' 페이지';
  }

  function leavePage() { elapsed += Math.min(Date.now() - pageStart, 120000); pageStart = Date.now(); }

  function onDot(e) {
    var b = e.target.closest('.dot'); if (!b) return;
    var i = +b.dataset.i, v = +b.dataset.v;
    answers[i] = v;
    $$('#q' + i + ' .dot').forEach(function (d) { var on = +d.dataset.v === v; d.classList.toggle('on', on); d.setAttribute('aria-pressed', on); });
    $('#q' + i).classList.remove('missing');
    updateProgress(); save();
  }

  function onNext() {
    var missing = -1;
    for (var i = page * PER_PAGE; i < (page + 1) * PER_PAGE; i++) if (answers[i] === null) { missing = i; break; }
    if (missing >= 0) {
      for (var j = page * PER_PAGE; j < (page + 1) * PER_PAGE; j++) if (answers[j] === null) $('#q' + j).classList.add('missing');
      var m = $('#quiz-msg'); m.textContent = '아직 답하지 않은 문항이 있어요. 표시된 문항에 답해 주세요.'; m.hidden = false;
      $('#q' + missing).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    leavePage();
    if (page < PAGES - 1) { page++; save(); renderPage(); return; }
    finish();
  }

  function onPrev() { if (page > 0) { leavePage(); page--; save(); renderPage(); } }

  function finish() {
    var res = S.compute(answers, Q, { elapsedMs: elapsed });
    var code = S.encode(answers);
    clearSave();
    history.pushState(null, '', '#r=' + code);
    renderResult(res, true);
  }

  /* ---------- 결과 ---------- */
  function levelText(a) {
    var lv = a.level, l = C.AXES[a.id][a.letter];
    if (lv === 0) return '경계에 가까워요 · ' + l.name + '과 ' + C.AXES[a.id][a.letters[a.letter === a.letters[0] ? 1 : 0]].name + '을 비슷하게 씁니다';
    return l.name + ' 성향이 ' + C.RATING[lv] + '한 편이에요';
  }

  function facetLevel(p) { return p >= 62 ? 'high' : p <= 38 ? 'low' : 'mid'; }

  function axisHtml(a) {
    var info = C.AXES[a.id], A = info[a.letters[0]], B = info[a.letters[1]];
    var pa = a.pctA, pb = Math.round((100 - a.pctA) * 10) / 10;
    var winA = a.letter === a.letters[0];
    var facets = a.facets.map(function (f) {
      var d = C.FACETS[f.id], lv = facetLevel(f.pctA);
      return '<div class="facet"><div class="fname"><span>' + esc(d.name) + '</span><span>' + esc(d.a) + ' ' + Math.round(f.pctA) + '%</span></div>' +
        '<div class="mini-bar" title="' + esc(d.b) + ' ← → ' + esc(d.a) + '"><i style="width:' + f.pctA + '%"></i></div>' +
        '<p>' + esc(d[lv]) + '</p></div>';
    }).join('');
    return '<div class="axis"><div class="axis-top"><b>' + esc(info.name) + '</b><small>' + esc(info.ask) + '</small></div>' +
      '<div class="bar"><div class="a' + (winA ? ' win' : '') + '" style="width:' + Math.max(pa, 14) + '%">' + a.letters[0] + ' ' + esc(A.name) + ' ' + Math.round(pa) + '%</div>' +
      '<div class="b' + (winA ? '' : ' win') + '" style="width:' + Math.max(pb, 14) + '%">' + Math.round(pb) + '% ' + esc(B.name) + ' ' + a.letters[1] + '</div></div>' +
      '<div class="axis-note">' + esc(levelText(a)) + '</div>' +
      '<details class="facets"><summary>세부 측면 보기</summary>' + facets + '</details></div>';
  }

  function relCards(code, list) {
    return list.map(function (c) {
      var t = T[c], p = S.compatibility(code, c).percent, rs = C.pairReasons(code, c);
      return '<div class="rel-card" data-type="' + c + '"><div class="rtop"><span class="rname">' + esc(t.name) + '<small>' + c + '</small></span>' +
        '<span class="pct">' + p + '%</span></div><p>' + esc(rs[1].reason) + '</p><p>' + esc(rs[2].reason) + '</p></div>';
    }).join('');
  }

  function careerHtml(t) {
    return t.careers.map(function (c) {
      return '<div class="career"><b>' + esc(c.field) + '</b><div class="jobs">' + c.jobs.map(function (j) { return '<span>' + esc(j) + '</span>'; }).join('') +
        '</div><p>' + esc(c.why) + '</p></div>';
    }).join('');
  }

  function tabsHtml(code, suffix) {
    var t = T[code], rel = S.relations(code, ALL), g = C.GROUPS[code[1] + code[2]];
    var suf = suffix
      ? '<p><b>' + suffix + ' · ' + C.SUFFIX[suffix].name + '</b> — ' + esc(t.suffix[suffix]) + '</p>'
      : '<p><b>-C 안정형</b> — ' + esc(t.suffix.C) + '</p><p><b>-E 민감형</b> — ' + esc(t.suffix.E) + '</p>';
    var panels = [
      ['개요', '<h3>한눈에 보기</h3><p>' + esc(t.summary) + '</p><h3>핵심 특징</h3>' + li(t.traits) +
        '<h3>기질 그룹 · ' + esc(g.name) + '</h3><p>' + esc(g.text) + '</p><h3>정서 프로필</h3>' + suf],
      ['강점·약점', '<div class="two"><div><h3>강점</h3>' + li(t.strengths) + '</div><div><h3>약점과 주의점</h3>' + li(t.weaknesses) + '</div></div>'],
      ['추천 직업', '<h3>잘 어울리는 직업</h3>' + careerHtml(t) + '<h3>피하면 좋은 업무 환경</h3>' + li(t.avoid)],
      ['관계·궁합', '<h3>연애 스타일</h3><p>' + esc(t.love) + '</p><h3>친구 관계</h3><p>' + esc(t.friends) + '</p>' +
        '<h3>잘 맞는 유형</h3>' + relCards(code, rel.best) +
        '<h3>서로 보완되는 유형</h3>' + relCards(code, rel.complement) +
        '<h3>부딪히기 쉬운 유형</h3>' + relCards(code, rel.clash) +
        '<p class="hint">퍼센트는 정서 접미사를 제외하고 4글자 조합만으로 계산한 참고 지수입니다. 카드를 누르면 상대 유형을 볼 수 있어요.</p>'],
      ['일·스트레스·성장', '<h3>일하는 방식과 리더십</h3><p>' + esc(t.work) + '</p><h3>스트레스를 받을 때</h3><p>' + esc(t.stress) + '</p><h3>성장을 위한 조언</h3><p>' + esc(t.growth) + '</p>']
    ];
    return '<div class="tabs" role="tablist">' + panels.map(function (p, i) {
      return '<button type="button" class="tab' + (i === 0 ? ' on' : '') + '" role="tab" data-tab="' + i + '">' + p[0] + '</button>';
    }).join('') + '</div>' + panels.map(function (p, i) {
      return '<div class="card panel" data-panel="' + i + '"' + (i === 0 ? '' : ' hidden') + '>' + p[1] + '</div>';
    }).join('');
  }

  function bindTabs(root) {
    $$('.tab', root).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.tab', root).forEach(function (x) { x.classList.toggle('on', x === b); });
        $$('.panel', root).forEach(function (p) { p.hidden = p.dataset.panel !== b.dataset.tab; });
      });
    });
    $$('.rel-card', root).forEach(function (c) { c.addEventListener('click', function () { showType(c.dataset.type); }); });
  }

  function renderResult(res, fresh) {
    lastResult = res;
    var t = T[res.code4], g = C.GROUPS[res.code4[1] + res.code4[2]], el = $('#screen-result');
    var warn = '';
    if (res.reliability.warn) {
      warn = '<div class="notice-box"><b>응답 신뢰도 ' + res.reliability.score + '점 · 다시 검사를 권장합니다</b><ul>' +
        res.reliability.flags.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></div>';
    } else {
      warn = '<p class="hint"><span class="rel-ok">응답 신뢰도 ' + res.reliability.score + '점</span>' +
        (res.reliability.flags.length ? ' · ' + esc(res.reliability.flags.join(' ')) : ' · 일관되게 답해 주셨어요.') + '</p>';
    }
    var border = '';
    if (res.adjacent.length || res.suffixBorderline) {
      var parts = res.adjacent.map(function (a) {
        return '<b>' + esc(C.AXES[a.axis].name) + '</b> 축이 경계선이에요. 반대로 나오면 <a href="#" data-type="' + a.code + '">' + a.code + ' · ' + esc(T[a.code].name) + '</a>';
      });
      if (res.suffixBorderline) parts.push('<b>정서</b> 축이 경계선이라 -C와 -E 중 어느 쪽 설명도 참고해 보세요');
      border = '<div class="notice-box"><b>경계에 걸친 축이 있어요</b><ul>' + parts.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul></div>';
    }
    el.innerHTML =
      '<div class="card result-head"><p class="eyebrow">나의 성격유형</p><p class="code">' + res.code4 + '<small>-' + res.suffix + '</small></p>' +
      '<h2>' + esc(t.name) + '</h2><p class="tagline">' + esc(t.tagline) + '</p>' +
      '<div class="badges"><span class="badge">' + esc(g.name) + '</span><span class="badge">정서 ' + esc(C.SUFFIX[res.suffix].name) + '</span></div></div>' +
      warn + border +
      '<div class="card"><h2>5개 축 결과</h2>' + res.axes.map(axisHtml).join('') + '</div>' +
      tabsHtml(res.code4, res.suffix) +
      '<div class="result-actions"><button class="btn primary" id="btn-copy">결과 링크 복사</button><button class="btn" id="btn-print">인쇄 / PDF 저장</button>' +
      '<button class="btn" data-go="compat">궁합 계산기</button><button class="btn" data-go="types">16유형 보기</button><button class="btn" id="btn-retake">다시 검사하기</button></div>';
    bindTabs(el);
    $$('a[data-type]', el).forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); showType(a.dataset.type); }); });
    $('#btn-copy').addEventListener('click', copyLink);
    $('#btn-print').addEventListener('click', function () { window.print(); });
    $('#btn-retake').addEventListener('click', function () { history.replaceState(null, '', location.pathname + location.search); startQuiz(true); });
    show('result');
  }

  function copyLink() {
    var url = location.href;
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
      toast(ok ? '링크를 복사했어요' : '주소창의 링크를 직접 복사해 주세요');
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(function () { toast('링크를 복사했어요'); }, fallback);
    else fallback();
  }

  /* ---------- 유형 목록 / 상세 ---------- */
  function renderTypes() {
    var box = $('#types-grid'), html = '';
    Object.keys(C.GROUPS).forEach(function (gk) {
      html += '<h3 class="group-title">' + esc(C.GROUPS[gk].name) + '<small>' + esc(C.GROUPS[gk].text) + '</small></h3>';
      ALL.filter(function (c) { return c[1] + c[2] === gk; }).forEach(function (c) {
        html += '<button class="type-card" data-type="' + c + '"><div class="tc">' + c + '</div><div class="tn">' + esc(T[c].name) + '</div><div class="tt">' + esc(T[c].tagline) + '</div></button>';
      });
    });
    box.innerHTML = html;
    $$('.type-card', box).forEach(function (b) { b.addEventListener('click', function () { showType(b.dataset.type); }); });
  }

  function showType(code) {
    var t = T[code], g = C.GROUPS[code[1] + code[2]], el = $('#screen-typedetail');
    el.innerHTML = '<div class="card result-head"><p class="eyebrow">유형 상세</p><p class="code">' + code + '</p><h2>' + esc(t.name) + '</h2><p class="tagline">' + esc(t.tagline) + '</p>' +
      '<div class="badges"><span class="badge">' + esc(g.name) + '</span></div></div>' + tabsHtml(code, null) +
      '<div class="result-actions"><button class="btn" data-go="types">목록으로</button><button class="btn" id="btn-cmp-this">이 유형으로 궁합 보기</button>' +
      (lastResult ? '<button class="btn" id="btn-back-result">내 결과로 돌아가기</button>' : '') + '</div>';
    bindTabs(el);
    $('#btn-cmp-this').addEventListener('click', function () { renderCompatForm(null, code); show('compat'); });
    var b = $('#btn-back-result'); if (b) b.addEventListener('click', function () { show('result'); });
    show('typedetail');
  }

  /* ---------- 궁합 ---------- */
  function fillSelect(sel, val) {
    if (!sel.options.length) {
      sel.innerHTML = ALL.map(function (c) { return '<option value="' + c + '">' + c + ' · ' + esc(T[c].name) + '</option>'; }).join('');
      sel.addEventListener('change', renderCompat);
    }
    if (val) sel.value = val;
  }

  function renderCompatForm(a, b) {
    fillSelect($('#cmp-a-type'), a || (lastResult && lastResult.code4) || null);
    fillSelect($('#cmp-b-type'), b || null);
    if (lastResult && !a) $('#cmp-a-emo').value = lastResult.suffix;
    ['#cmp-a-emo', '#cmp-b-emo'].forEach(function (id) { var e = $(id); if (!e.dataset.bound) { e.addEventListener('change', renderCompat); e.dataset.bound = 1; } });
    renderCompat();
  }

  function renderCompat() {
    var a = $('#cmp-a-type').value + '-' + $('#cmp-a-emo').value, b = $('#cmp-b-type').value + '-' + $('#cmp-b-emo').value;
    var r = S.compatibility(a, b), rs = C.pairReasons(a, b);
    var names = ['에너지', '인식', '판단', '생활', '정서'];
    $('#compat-result').innerHTML =
      '<div class="card compat-score"><p class="hint">' + a + ' × ' + b + '</p><div class="big">' + r.percent + '%</div><div class="lbl">' + S.compatLabel(r.percent) + '</div>' +
      '<p class="hint">세계관(인식)과 판단 방식이 같을수록, 에너지 방향이 다를수록 점수가 올라가고, 정서 안정형끼리는 가산점이 있습니다. 어디까지나 참고 지수예요.</p></div>' +
      '<div class="card">' + rs.map(function (x, i) {
        return '<div class="compat-row"><h4>' + names[i] + ' <span class="tag">' + (x.same ? '같음' : '다름') + '</span></h4><p>' + esc(x.reason) + '</p><p class="tipline">💡 ' + esc(x.tip) + '</p></div>';
      }).join('') + '</div>';
  }

  /* ---------- 초기화 ---------- */
  function route() {
    var m = /[#&]r=([0-6]+)/.exec(location.hash);
    if (m) {
      var arr = S.decode(m[1], Q.length);
      if (arr) { renderResult(S.compute(arr, Q, {}), false); return; }
    }
    refreshStart(); show('start');
  }

  function init() {
    $('#notice').textContent = C.NOTICE;
    $('#btn-start').addEventListener('click', function () {
      var d = load();
      if (d && d.a.some(function (x) { return x !== null; }) && !confirm('저장된 진행 상황이 지워지고 처음부터 시작합니다. 계속할까요?')) return;
      startQuiz(true);
    });
    $('#btn-resume').addEventListener('click', resumeQuiz);
    $('#questions').addEventListener('click', onDot);
    $('#btn-next').addEventListener('click', onNext);
    $('#btn-prev').addEventListener('click', onPrev);
    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-go]');
      if (g) { e.preventDefault(); go(g.dataset.go); }
    });
    window.addEventListener('hashchange', function () { if (/[#&]r=/.test(location.hash)) route(); });
    window.addEventListener('beforeprint', function () { $$('details').forEach(function (d) { d.open = true; }); $$('.panel').forEach(function (p) { p.hidden = false; }); });
    route();
  }

  init();
})();
