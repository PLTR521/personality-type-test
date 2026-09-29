/* 채점 · 응답 신뢰도 · 궁합 점수 (순수 함수, DOM 의존 없음) */
(function (root) {
  var AXES = [
    { id: 'energy', letters: ['O', 'R'] },
    { id: 'perception', letters: ['V', 'G'] },
    { id: 'judgment', letters: ['H', 'L'] },
    { id: 'lifestyle', letters: ['S', 'F'] },
    { id: 'emotion', letters: ['C', 'E'] }
  ];

  var FACETS = {
    energy: ['energy_social', 'energy_drive'],
    perception: ['perception_imagine', 'perception_novelty'],
    judgment: ['judgment_empathy', 'judgment_harmony'],
    lifestyle: ['lifestyle_order', 'lifestyle_diligence'],
    emotion: ['emotion_worry', 'emotion_mood']
  };

  function pct(sum, max) { return Math.round(((sum + max) / (2 * max)) * 1000) / 10; }

  function level(p) {
    var d = Math.abs(p - 50);
    if (d < 5) return 0;   // 경계
    if (d < 15) return 1;  // 약간
    if (d < 30) return 2;  // 뚜렷
    return 3;              // 매우 뚜렷
  }

  // 같은 하위 측면의 A 방향 문항과 B 방향 문항을 순서대로 짝짓는다(모순 응답 검사용).
  function buildPairs(questions) {
    var byFacet = {};
    questions.forEach(function (q, i) {
      var f = byFacet[q.facet] = byFacet[q.facet] || { a: [], b: [] };
      (q.key > 0 ? f.a : f.b).push(i);
    });
    var pairs = [];
    Object.keys(byFacet).forEach(function (k) {
      var f = byFacet[k];
      for (var i = 0; i < Math.min(f.a.length, f.b.length); i++) pairs.push([f.a[i], f.b[i]]);
    });
    return pairs;
  }

  function reliability(answers, questions, elapsedMs) {
    var n = answers.length, flags = [], penalty = 0;

    // 1) 모순 응답: 짝을 이룬 두 문항에 둘 다 강하게 동의하거나 둘 다 강하게 부정
    var pairs = buildPairs(questions), bad = 0;
    pairs.forEach(function (p) {
      var x = answers[p[0]], y = answers[p[1]];
      if ((x >= 2 && y >= 2) || (x <= -2 && y <= -2)) bad++;
    });
    var ratio = pairs.length ? bad / pairs.length : 0;
    penalty += Math.min(40, Math.max(0, (ratio - 0.15) * 100));
    if (ratio >= 0.35) flags.push('서로 반대되는 문항에 비슷하게 답한 경우가 많습니다(모순 응답).');

    // 2) 같은 번호를 12번 이상 연속 선택
    var run = 1, maxRun = 1;
    for (var i = 1; i < n; i++) {
      run = answers[i] === answers[i - 1] ? run + 1 : 1;
      if (run > maxRun) maxRun = run;
    }
    if (maxRun >= 12) { penalty += 40; flags.push('같은 번호를 ' + maxRun + '문항 연속으로 선택했습니다.'); }

    // 3) 중립(0) 응답이 40% 초과
    var zeros = answers.filter(function (a) { return a === 0; }).length;
    if (zeros / n > 0.4) { penalty += 30; flags.push('중립("보통") 응답이 ' + Math.round(zeros / n * 100) + '%로 많아 결과가 뚜렷하지 않을 수 있습니다.'); }

    // 4) 문항당 평균 1.5초 미만 (시간 정보가 있을 때만)
    var avgSec = null;
    if (typeof elapsedMs === 'number' && elapsedMs > 0) {
      avgSec = elapsedMs / 1000 / n;
      if (avgSec < 1.5) { penalty += 30; flags.push('문항당 평균 ' + avgSec.toFixed(1) + '초로 매우 빠르게 답했습니다.'); }
    }

    var score = Math.max(0, Math.round(100 - penalty));
    return { score: score, flags: flags, warn: score < 75, contradictionRatio: ratio, maxRun: maxRun, zeroShare: zeros / n, avgSec: avgSec };
  }

  function compute(answers, questions, opts) {
    opts = opts || {};
    var axes = AXES.map(function (ax) {
      var sum = 0, facetSums = {};
      FACETS[ax.id].forEach(function (f) { facetSums[f] = 0; });
      questions.forEach(function (q, i) {
        if (q.axis !== ax.id) return;
        var s = answers[i] * q.key;
        sum += s;
        facetSums[q.facet] += s;
      });
      var p = pct(sum, 36);
      // 축은 하위 측면 2개로 이뤄져 합이 0이면 두 측면의 치우침 크기가 같다. 정확히 50%일 때는 항상 B로 정한다(결과가 늘 같게 나오도록).
      var idx = sum > 0 ? 0 : 1;
      return {
        id: ax.id,
        letters: ax.letters,
        sum: sum,
        pctA: p,
        letter: ax.letters[idx],
        pctLetter: idx === 0 ? p : Math.round((100 - p) * 10) / 10,
        level: level(p),
        borderline: level(p) === 0,
        facets: FACETS[ax.id].map(function (f) { return { id: f, sum: facetSums[f], pctA: pct(facetSums[f], 18) }; })
      };
    });

    var code4 = axes.slice(0, 4).map(function (a) { return a.letter; }).join('');
    var suffix = axes[4].letter;

    var adjacent = [];
    for (var i = 0; i < 4; i++) {
      if (!axes[i].borderline) continue;
      var other = axes[i].letters[axes[i].letter === axes[i].letters[0] ? 1 : 0];
      adjacent.push({ axis: axes[i].id, code: code4.slice(0, i) + other + code4.slice(i + 1) });
    }

    return {
      axes: axes,
      code4: code4,
      suffix: suffix,
      code: code4 + '-' + suffix,
      adjacent: adjacent,
      suffixBorderline: axes[4].borderline,
      reliability: reliability(answers, questions, opts.elapsedMs)
    };
  }

  /* 궁합: 세계관(V/G)이 같으면 대화가 잘 통하고, 판단(H/L)이 같으면 갈등 방식이 비슷하고,
   * 생활(S/F)이 같으면 생활 리듬이 맞고, 에너지(O/R)는 다를수록 서로를 채워 준다는 규칙.
   * 점수 s는 0~7. */
  function pairScore(a, b) {
    var s = 0;
    if (a[1] === b[1]) s += 3;
    if (a[2] === b[2]) s += 2;
    if (a[3] === b[3]) s += 1;
    if (a[0] !== b[0]) s += 1;
    return s;
  }

  function compatibility(codeA, codeB) {
    var a = codeA.slice(0, 4), b = codeB.slice(0, 4);
    var sa = codeA.split('-')[1], sb = codeB.split('-')[1];
    var s = pairScore(a, b);
    var emo = 10;
    if (sa && sb) emo = sa === 'C' && sb === 'C' ? 15 : sa === 'E' && sb === 'E' ? 5 : 10;
    var percent = Math.round(40 + (s / 7) * 45 + emo);
    return { score: s, percent: percent, emo: emo };
  }

  function compatLabel(p) {
    if (p >= 85) return '찰떡 궁합';
    if (p >= 70) return '잘 맞는 편';
    if (p >= 55) return '노력하면 좋아지는 관계';
    return '서로를 배우는 도전형 관계';
  }

  /* 한 유형 기준으로 15개 상대를 세 무리로 나눈다: best(잘 맞는) 2 · complement(보완) 2 · clash(부딪히기 쉬운) 2 */
  function relations(code4, allCodes) {
    var others = allCodes.filter(function (c) { return c !== code4; }).sort();
    var withS = others.map(function (c) { return { code: c, s: pairScore(code4, c), diff: 0 }; });
    withS.forEach(function (o) {
      [0, 2, 3].forEach(function (i) { if (o.code[i] !== code4[i]) o.diff++; });
    });
    var byBest = withS.slice().sort(function (x, y) { return y.s - x.s || (x.code < y.code ? -1 : 1); });
    var best = byBest.slice(0, 2);
    var rest = withS.filter(function (o) { return best.indexOf(o) < 0; });
    var comp = rest.filter(function (o) { return o.code[1] === code4[1]; })
      .sort(function (x, y) { return y.diff - x.diff || y.s - x.s || (x.code < y.code ? -1 : 1); }).slice(0, 2);
    var rest2 = rest.filter(function (o) { return comp.indexOf(o) < 0; });
    var clash = rest2.filter(function (o) { return o.code[1] !== code4[1]; })
      .sort(function (x, y) { return x.s - y.s || (x.code < y.code ? -1 : 1); }).slice(0, 2);
    return {
      best: best.map(function (o) { return o.code; }),
      complement: comp.map(function (o) { return o.code; }),
      clash: clash.map(function (o) { return o.code; })
    };
  }

  function encode(answers) { return answers.map(function (a) { return a + 3; }).join(''); }
  function decode(str, n) {
    if (!str || str.length !== n || !/^[0-6]+$/.test(str)) return null;
    return str.split('').map(function (c) { return parseInt(c, 10) - 3; });
  }

  root.Scoring = {
    AXES: AXES, FACETS: FACETS, compute: compute, reliability: reliability,
    pairScore: pairScore, compatibility: compatibility, compatLabel: compatLabel,
    relations: relations, encode: encode, decode: decode, level: level
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Scoring;
})(typeof window !== 'undefined' ? window : globalThis);
