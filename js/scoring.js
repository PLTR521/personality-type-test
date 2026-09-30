/* 채점 · 궁합 (순수 함수, DOM 의존 없음) — 10문항 간단 버전 */
(function (root) {
  var AXES = [
    { id: 'energy', letters: ['O', 'R'] },
    { id: 'perception', letters: ['V', 'G'] },
    { id: 'judgment', letters: ['H', 'L'] },
    { id: 'lifestyle', letters: ['S', 'F'] },
    { id: 'emotion', letters: ['C', 'E'] }
  ];
  var MAX = 4; // 축마다 2문항 × 최대 ±2점

  /* answers: 문항별 -2..+2 (전혀 아니다 … 매우 그렇다)
   * 축 점수 = Σ(응답 × 방향), 0보다 크면 A, 작으면 B.
   * 0점(동점)이면 그 축의 첫 문항 응답이 기우는 쪽, 그것도 0이면 B. */
  function compute(answers, questions) {
    var axes = AXES.map(function (ax) {
      var sum = 0, first = null;
      questions.forEach(function (q, i) {
        if (q.axis !== ax.id) return;
        var s = answers[i] * q.key;
        sum += s;
        if (first === null) first = s;
      });
      var idx = sum > 0 ? 0 : sum < 0 ? 1 : (first > 0 ? 0 : 1);
      var pctA = Math.round((sum + MAX) / (2 * MAX) * 100);
      return {
        id: ax.id, letters: ax.letters, sum: sum, pctA: pctA,
        letter: ax.letters[idx],
        pct: idx === 0 ? pctA : 100 - pctA,
        strength: Math.abs(sum) >= 3 ? 2 : Math.abs(sum) >= 1 ? 1 : 0  // 2 뚜렷, 1 약간, 0 반반
      };
    });
    var code4 = axes.slice(0, 4).map(function (a) { return a.letter; }).join('');
    var suffix = axes[4].letter;
    return { axes: axes, code4: code4, suffix: suffix, code: code4 + '-' + suffix };
  }

  /* 궁합: 세계관(V/G)·판단(H/L)이 같으면 말이 잘 통하고, 에너지(O/R)는 다를수록 서로를 채워 준다. s는 0~7. */
  function pairScore(a, b) {
    var s = 0;
    if (a[1] === b[1]) s += 3;
    if (a[2] === b[2]) s += 2;
    if (a[3] === b[3]) s += 1;
    if (a[0] !== b[0]) s += 1;
    return s;
  }
  function matchPercent(a, b) { return Math.round(40 + pairScore(a, b) / 7 * 55); }

  /* 한 유형 기준으로 잘 맞는 2 · 보완 2 · 부딪히기 쉬운 2 */
  function relations(code4, allCodes) {
    var withS = allCodes.filter(function (c) { return c !== code4; }).sort().map(function (c) {
      var d = 0; [0, 2, 3].forEach(function (i) { if (c[i] !== code4[i]) d++; });
      return { code: c, s: pairScore(code4, c), diff: d };
    });
    var best = withS.slice().sort(function (x, y) { return y.s - x.s || (x.code < y.code ? -1 : 1); }).slice(0, 2);
    var rest = withS.filter(function (o) { return best.indexOf(o) < 0; });
    var comp = rest.filter(function (o) { return o.code[1] === code4[1]; })
      .sort(function (x, y) { return y.diff - x.diff || y.s - x.s || (x.code < y.code ? -1 : 1); }).slice(0, 2);
    var clash = rest.filter(function (o) { return comp.indexOf(o) < 0 && o.code[1] !== code4[1]; })
      .sort(function (x, y) { return x.s - y.s || (x.code < y.code ? -1 : 1); }).slice(0, 2);
    var pick = function (l) { return l.map(function (o) { return o.code; }); };
    return { best: pick(best), complement: pick(comp), clash: pick(clash) };
  }

  function encode(answers) { return answers.map(function (a) { return a + 2; }).join(''); }
  function decode(str, n) {
    if (!str || str.length !== n || !/^[0-4]+$/.test(str)) return null;
    return str.split('').map(function (c) { return parseInt(c, 10) - 2; });
  }

  root.Scoring = { AXES: AXES, compute: compute, pairScore: pairScore, matchPercent: matchPercent, relations: relations, encode: encode, decode: decode };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Scoring;
})(typeof window !== 'undefined' ? window : globalThis);
