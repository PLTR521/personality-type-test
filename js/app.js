/* 10문항 간단 버전: 한 화면에 한 문항, 고르면 바로 다음으로 */
(function () {
  var Q = window.QUESTIONS, S = window.Scoring, C = window.CONTENT, T = window.TYPES;
  var ALL = Object.keys(T);
  var CHOICES = [[2, '매우 그렇다'], [1, '그렇다'], [0, '보통이다'], [-1, '아니다'], [-2, '전혀 아니다']];
  var answers = [], cur = 0, lock = false, last = null;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function li(a) { return '<ul>' + a.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }
  function show(n) { $$('.screen').forEach(function (s) { s.hidden = s.id !== 'screen-' + n; }); window.scrollTo(0, 0); }
  function toast(m) { var t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 2000); }

  /* ---------- 검사 ---------- */
  function start() { answers = []; cur = 0; lock = false; if (location.hash) history.replaceState(null, '', location.pathname); renderQ(); show('quiz'); }

  function renderQ() {
    var q = Q[cur];
    $('#q-text').textContent = q.text;
    $('#progress-bar').style.width = (cur / Q.length * 100) + '%';
    $('#progress-text').textContent = (cur + 1) + ' / ' + Q.length;
    $('#btn-prev').disabled = cur === 0;
    $('#q-choices').innerHTML = CHOICES.map(function (c) {
      return '<button class="choice' + (answers[cur] === c[0] ? ' on' : '') + '" data-v="' + c[0] + '">' + c[1] + '</button>';
    }).join('');
  }

  function pick(v) {
    if (lock) return;
    lock = true;
    answers[cur] = v;
    $$('#q-choices .choice').forEach(function (b) { b.classList.toggle('on', +b.dataset.v === v); });
    setTimeout(function () {
      lock = false;
      if (cur < Q.length - 1) { cur++; renderQ(); }
      else finish();
    }, 220);
  }

  function finish() {
    history.pushState(null, '', '#r=' + S.encode(answers));
    showResult(S.compute(answers, Q));
  }

  /* ---------- 유형 카드 ---------- */
  function barsHtml(res) {
    var lv = ['반반', '약간', '뚜렷'];
    return res.axes.map(function (a) {
      var info = C.AXES[a.id], A = info[a.letters[0]].name, B = info[a.letters[1]].name, winA = a.letter === a.letters[0];
      return '<div class="axis"><span class="an">' + info.name + '</span><div class="bar">' +
        '<span class="a' + (winA ? ' win' : '') + '" style="width:' + Math.max(a.pctA, 30) + '%">' + a.letters[0] + ' ' + A + '</span>' +
        '<span class="b' + (winA ? '' : ' win') + '" style="width:' + Math.max(100 - a.pctA, 30) + '%">' + B + ' ' + a.letters[1] + '</span></div>' +
        '<span class="lv">' + lv[a.strength] + '</span></div>';
    }).join('');
  }

  function matchHtml(code, list, kind) {
    return list.map(function (c) {
      return '<div class="match' + (kind === 'clash' ? ' bad' : '') + '" data-type="' + c + '"><div><b>' + esc(T[c].name) + '<small>' + c + '</small></b><p>' +
        esc(C.relText(code, c, kind)) + '</p></div><span class="pct">' + S.matchPercent(code, c) + '%</span></div>';
    }).join('');
  }

  function typeHtml(code, res) {
    var t = T[code], g = C.GROUPS[code[1] + code[2]], rel = S.relations(code, ALL), h = '';
    h += '<div class="card result-head"><p class="eyebrow">' + (res ? '나의 성격유형' : '유형 상세') + '</p><p class="code">' + code + (res ? '<small>-' + res.suffix + '</small>' : '') + '</p>' +
      '<h2>' + esc(t.name) + '</h2><p class="tagline">' + esc(t.tagline) + '</p><div class="badges"><span class="badge">' + esc(g.name) + '</span>' +
      (res ? '<span class="badge">정서 ' + esc(C.SUFFIX[res.suffix].name) + '</span>' : '') + '</div></div>';
    if (res) h += '<div class="card"><h3>내 성향</h3>' + barsHtml(res) + '<p class="hint">' + esc(C.SUFFIX[res.suffix].text) + ' ' + esc(t.suffix[res.suffix]) + '</p></div>';
    h += '<div class="card"><h3>한눈에 보기</h3><p>' + esc(t.summary) + '</p>' + li(t.traits.slice(0, 4)) + '</div>';
    h += '<div class="card two"><div><h3>강점</h3>' + li(t.strengths.slice(0, 3)) + '</div><div><h3>주의할 점</h3>' + li(t.weaknesses.slice(0, 3)) + '</div></div>';
    h += '<div class="card"><h3>어울리는 직업</h3><div class="chips">' +
      t.careers.reduce(function (a, c) { return a.concat(c.jobs); }, []).map(function (j) { return '<span class="chip">' + esc(j) + '</span>'; }).join('') + '</div></div>';
    h += '<div class="card"><h3>잘 맞는 유형</h3>' + matchHtml(code, rel.best, 'best') +
      '<p class="sub">서로 채워 주는 유형</p>' + matchHtml(code, rel.complement, 'complement') +
      '<p class="sub">부딪히기 쉬운 유형</p>' + matchHtml(code, rel.clash, 'clash') + '</div>';
    h += '<div class="card"><h3>한 줄 조언</h3><p>' + esc(t.growth) + '</p>' +
      '<details class="more"><summary>더 자세히 보기</summary>' +
      '<h3>강점 전체</h3>' + li(t.strengths) + '<h3>약점 전체</h3>' + li(t.weaknesses) +
      '<h3>연애 스타일</h3><p>' + esc(t.love) + '</p><h3>친구 관계</h3><p>' + esc(t.friends) + '</p>' +
      '<h3>일하는 방식</h3><p>' + esc(t.work) + '</p><h3>스트레스를 받을 때</h3><p>' + esc(t.stress) + '</p>' +
      '<h3>직업별 이유</h3>' + li(t.careers.map(function (c) { return c.field + ' — ' + c.why; })) +
      '<h3>피하면 좋은 환경</h3>' + li(t.avoid) + '</details></div>';
    return h;
  }

  function bindType(el) { $$('.match', el).forEach(function (m) { m.addEventListener('click', function () { showType(m.dataset.type); }); }); }

  function showResult(res) {
    last = res;
    var el = $('#screen-result');
    el.innerHTML = typeHtml(res.code4, res) +
      '<div class="actions"><button class="btn primary" id="btn-copy">결과 링크 복사</button><button class="btn" id="btn-again">다시 하기</button><button class="btn" data-go="types">16유형 보기</button></div>';
    bindType(el);
    $('#btn-copy').addEventListener('click', copyLink);
    $('#btn-again').addEventListener('click', start);
    show('result');
  }

  function showType(code) {
    var el = $('#screen-typedetail');
    el.innerHTML = typeHtml(code, null) + '<div class="actions"><button class="btn" data-go="types">목록으로</button>' + (last ? '<button class="btn" id="btn-back">내 결과로</button>' : '') + '</div>';
    bindType(el);
    var b = $('#btn-back'); if (b) b.addEventListener('click', function () { show('result'); });
    show('typedetail');
  }

  function renderTypes() {
    var h = '';
    Object.keys(C.GROUPS).forEach(function (gk) {
      h += '<h3 class="group-title">' + esc(C.GROUPS[gk].name) + '<small>' + esc(C.GROUPS[gk].text) + '</small></h3>';
      ALL.filter(function (c) { return c[1] + c[2] === gk; }).forEach(function (c) {
        h += '<button class="type-card" data-type="' + c + '"><div class="tc">' + c + '</div><div class="tn">' + esc(T[c].name) + '</div><div class="tt">' + esc(T[c].tagline) + '</div></button>';
      });
    });
    var box = $('#types-grid'); box.innerHTML = h;
    $$('.type-card', box).forEach(function (b) { b.addEventListener('click', function () { showType(b.dataset.type); }); });
  }

  function copyLink() {
    var url = location.href;
    function fb() {
      var ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(ta); toast(ok ? '링크를 복사했어요' : '주소창의 링크를 복사해 주세요');
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(function () { toast('링크를 복사했어요'); }, fb); else fb();
  }

  /* ---------- 초기화 ---------- */
  function route() {
    var m = /[#&]r=([0-4]+)/.exec(location.hash), arr = m && S.decode(m[1], Q.length);
    if (arr) { showResult(S.compute(arr, Q)); return; }
    show('start');
  }

  function init() {
    $('#notice').textContent = C.NOTICE;
    $('#btn-start').addEventListener('click', start);
    $('#q-choices').addEventListener('click', function (e) { var b = e.target.closest('.choice'); if (b) pick(+b.dataset.v); });
    $('#btn-prev').addEventListener('click', function () { if (cur > 0) { cur--; renderQ(); } });
    document.addEventListener('keydown', function (e) {
      if ($('#screen-quiz').hidden) return;
      var i = '12345'.indexOf(e.key); if (i >= 0) pick(CHOICES[i][0]);
    });
    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-go]'); if (!g) return;
      e.preventDefault();
      if (g.dataset.go === 'types') { renderTypes(); show('types'); } else { if (location.hash) history.replaceState(null, '', location.pathname); show('start'); }
    });
    window.addEventListener('hashchange', function () { if (/[#&]r=/.test(location.hash)) route(); });
    route();
  }
  init();
})();
