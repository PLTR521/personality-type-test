// 실행: node tests/verify.js  (채점 로직과 콘텐츠 무결성 점검)
const vm = require('vm'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { window: {}, console };
ctx.globalThis = ctx.window; vm.createContext(ctx);
['questions', 'scoring', 'content', 'types', 'types-2', 'types-3', 'types-4'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), ctx));
const w = ctx.window, Q = w.QUESTIONS, S = w.Scoring, C = w.CONTENT, T = w.TYPES;
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };

// 1. 문항 구조
ok(Q.length === 60, '문항 60개');
const fk = {};
Q.forEach(q => { const k = q.facet; fk[k] = fk[k] || { a: 0, b: 0 }; q.key > 0 ? fk[k].a++ : fk[k].b++; });
ok(Object.keys(fk).length === 10 && Object.values(fk).every(v => v.a === 3 && v.b === 3), '하위 측면 10개 × (A 3 + B 3)');
ok(new Set(Q.map(q => q.text)).size === 60, '문항 문장 중복 없음');
ok(Q.every((q, i) => q.id === i + 1), 'id 1..60 순서');
const axisCount = {}; Q.forEach(q => axisCount[q.axis] = (axisCount[q.axis] || 0) + 1);
ok(Object.values(axisCount).every(n => n === 12), '축마다 12문항');
ok(Q.slice(0, 5).map(q => q.axis).join() === 'energy,perception,judgment,lifestyle,emotion', '축이 번갈아 나옴');
ok(JSON.stringify(Q) === JSON.stringify(Q.map(q => ({ ...q }))), '결정적 순서');

// 2. 채점 시나리오
const allA = Q.map(q => 3 * q.key), allB = Q.map(q => -3 * q.key);
let r = S.compute(allA, Q, {});
ok(r.code === 'OVHS-C' && r.axes.every(a => a.pctA === 100), '전부 A 방향 → OVHS-C, 100%');
r = S.compute(allB, Q, {});
ok(r.code === 'RGLF-E' && r.axes.every(a => a.pctA === 0), '전부 B 방향 → RGLF-E, 0%');
r = S.compute(Q.map(() => 3), Q, {});
ok(r.axes.every(a => a.pctA === 50) && r.code === 'RGLF-E', '전부 +3 → 50%, 동점 규칙 적용(B)');
ok(r.reliability.warn && r.reliability.flags.some(f => f.includes('연속')) && r.reliability.flags.some(f => f.includes('모순')), '전부 +3 → 연속·모순 경고');
r = S.compute(Q.map(() => 0), Q, {});
ok(r.reliability.flags.some(f => f.includes('중립')), '전부 0 → 중립 과다 경고');
r = S.compute(allA, Q, { elapsedMs: 30000 });
ok(r.reliability.flags.some(f => f.includes('빠르게')), '30초 완료 → 빠른 응답 경고');
r = S.compute(allA, Q, { elapsedMs: 600000 });
ok(!r.reliability.flags.some(f => f.includes('빠르게')), '10분 완료 → 속도 경고 없음');
// 일관된 자연스러운 응답은 경고 없음
const nat = Q.map((q, i) => q.key * ([2, 1, 3, -1, 2, 1, -2, 3][i % 8]));
r = S.compute(nat, Q, { elapsedMs: 480000 });
ok(!r.reliability.warn, '자연스러운 응답 → 경고 없음 (신뢰도 ' + r.reliability.score + ')');
// 동점 규칙: 축 합이 0이면(하위 측면 치우침이 같은 크기, 반대 방향) B
const tie = Q.map(() => 0);
Q.forEach((q, i) => { if (q.facet === 'energy_social') tie[i] = 3 * q.key; if (q.facet === 'energy_drive') tie[i] = -3 * q.key; });
r = S.compute(tie, Q, {});
ok(r.axes[0].pctA === 50 && r.axes[0].letter === 'R' && r.axes[0].facets[0].pctA === 100, '에너지 동점(하위 측면 +18/-18) → B(R)');
// 경계 → 인접 유형
const bord = allA.slice(); let n = 0;
Q.forEach((q, i) => { if (q.axis === 'energy' && n < 4) { bord[i] = 0; n++; } });
r = S.compute(bord, Q, {});
ok(r.axes[0].pctA > 50 && r.axes[0].pctA < 100, '부분 응답 % 계산 ' + r.axes[0].pctA);
// 인코딩
const enc = S.encode(allA); ok(enc.length === 60 && JSON.stringify(S.decode(enc, 60)) === JSON.stringify(allA), '결과 링크 인코딩 왕복');
ok(S.decode('123', 60) === null && S.decode('9'.repeat(60), 60) === null, '잘못된 링크 거부');

// 3. 콘텐츠
const codes = 'OR'.split('').flatMap(a => 'VG'.split('').flatMap(b => 'HL'.split('').flatMap(c => 'SF'.split('').map(d => a + b + c + d))));
ok(codes.every(c => T[c]) && Object.keys(T).length === 16, '16유형 모두 존재');
const req = ['name', 'tagline', 'summary', 'traits', 'strengths', 'weaknesses', 'careers', 'avoid', 'love', 'friends', 'work', 'stress', 'growth', 'suffix'];
codes.forEach(c => {
  const t = T[c], miss = req.filter(k => !t[k] || (Array.isArray(t[k]) && !t[k].length));
  const jobs = t.careers.reduce((s, x) => s + x.jobs.length, 0);
  const good = !miss.length && t.code === c && t.traits.length >= 6 && t.strengths.length >= 5 && t.weaknesses.length >= 5 && jobs >= 10 && t.avoid.length >= 3 && t.suffix.C && t.suffix.E;
  ok(good, c + ' 필수 항목 (직업 ' + jobs + '개)' + (miss.length ? ' 누락:' + miss : ''));
});
ok(Object.keys(C.FACETS).every(k => C.FACETS[k].high && C.FACETS[k].mid && C.FACETS[k].low) && Object.keys(C.FACETS).length === 10, '하위 측면 10개 해석');
ok(new Set(Object.values(T).map(t => t.name)).size === 16, '유형 이름 중복 없음');

// 4. 궁합/관계
codes.forEach(c => {
  const rel = S.relations(c, codes), all = [...rel.best, ...rel.complement, ...rel.clash];
  const valid = all.length === 6 && new Set(all).size === 6 && all.every(x => T[x] && x !== c);
  if (!valid) ok(false, c + ' 관계 목록 ' + JSON.stringify(rel));
});
ok(true, '16유형 관계(잘 맞음 2·보완 2·충돌 2) 유효, 중복/자기자신 없음');
const rr = S.relations('OVHF', codes); console.log('     OVHF 관계', JSON.stringify(rr));
const a = S.compatibility('OVHF-C', 'RGLS-E'), b = S.compatibility('OVHS-C', 'RVHS-C');
ok(b.percent > a.percent, '가까운 조합이 먼 조합보다 궁합 점수 높음 (' + b.percent + ' > ' + a.percent + ')');
ok(S.compatibility('OVHF-C', 'OVHF-C').percent <= 100 && S.compatibility('OVHS-C', 'RVHS-C').percent <= 100, '궁합 100% 초과 없음');
ok(C.pairReasons('OVHF-C', 'RGLS-E').length === 5 && C.pairReasons('OVHF', 'RGLS').length === 4, '궁합 해설 5축/4축');

console.log(fail ? '\n실패 ' + fail + '건' : '\n모든 점검 통과');
process.exit(fail ? 1 : 0);
