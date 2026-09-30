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

// 1. 문항
ok(Q.length === 10, '문항 10개');
const ax = {}; Q.forEach(q => { ax[q.axis] = ax[q.axis] || { a: 0, b: 0 }; q.key > 0 ? ax[q.axis].a++ : ax[q.axis].b++; });
ok(Object.keys(ax).length === 5 && Object.values(ax).every(v => v.a === 1 && v.b === 1), '5개 축 × (정방향 1 + 역방향 1)');
ok(Q.every((q, i) => q.id === i + 1) && new Set(Q.map(q => q.text)).size === 10, 'id 1..10, 문장 중복 없음');

// 2. 채점
const allA = Q.map(q => 2 * q.key), allB = Q.map(q => -2 * q.key), zero = Q.map(() => 0);
let r = S.compute(allA, Q);
ok(r.code === 'OVHS-C' && r.axes.every(a => a.pctA === 100 && a.strength === 2), '전부 A 방향 → OVHS-C, 100%');
r = S.compute(allB, Q);
ok(r.code === 'RGLF-E' && r.axes.every(a => a.pctA === 0), '전부 B 방향 → RGLF-E, 0%');
r = S.compute(zero, Q);
ok(r.code === 'RGLF-E' && r.axes.every(a => a.pctA === 50 && a.strength === 0), '전부 보통 → 50%, 동점은 B');
r = S.compute(Q.map(() => 2), Q);
ok(r.axes.every(a => a.pctA === 50 && a.sum === 0), '전부 "매우 그렇다" → 정방향/역방향이 상쇄되어 50%');
// 동점 규칙: 축의 첫 문항이 A 쪽으로 기울면 A
const tie = Q.map(() => 0); tie[0] = 2; tie[5] = 2; // key -1 × +2 = -2 → energy 합 0
r = S.compute(tie, Q);
ok(r.axes[0].sum === 0 && r.axes[0].letter === 'O', '동점 시 첫 문항이 A로 기울면 A(O)');
const mid = S.compute(Q.map(q => q.key * 1), Q);
ok(mid.code === 'OVHS-C' && mid.axes.every(a => a.strength === 1 && a.pctA === 75), '조금 그렇다 → 75%, 약간');
// 인코딩
const enc = S.encode(allA); ok(enc.length === 10 && JSON.stringify(S.decode(enc, 10)) === JSON.stringify(allA), '결과 링크 인코딩 왕복');
ok(S.decode('123', 10) === null && S.decode('9'.repeat(10), 10) === null && S.decode('1'.repeat(60), 10) === null, '잘못된 링크 거부');
// 모든 응답 조합(5^10 대신 축별)에서 항상 유효 코드
let bad = 0, n = 0;
for (let k = 0; k < 20000; k++) {
  const a = Q.map(() => Math.floor(Math.random() * 5) - 2);
  const c = S.compute(a, Q).code4; n++; if (!T[c]) bad++;
}
ok(bad === 0, '무작위 응답 ' + n + '건 모두 실제 존재하는 유형으로 결과가 나옴');

// 3. 콘텐츠
const codes = 'OR'.split('').flatMap(a => 'VG'.split('').flatMap(b => 'HL'.split('').flatMap(c => 'SF'.split('').map(d => a + b + c + d))));
ok(codes.every(c => T[c]) && Object.keys(T).length === 16, '16유형 모두 존재');
const req = ['name', 'tagline', 'summary', 'traits', 'strengths', 'weaknesses', 'careers', 'avoid', 'love', 'friends', 'work', 'stress', 'growth', 'suffix'];
codes.forEach(c => {
  const t = T[c], miss = req.filter(k => !t[k] || (Array.isArray(t[k]) && !t[k].length));
  const jobs = t.careers.reduce((s, x) => s + x.jobs.length, 0);
  ok(!miss.length && t.code === c && t.traits.length >= 4 && t.strengths.length >= 3 && t.weaknesses.length >= 3 && jobs >= 6 && t.suffix.C && t.suffix.E, c + ' 필수 항목 (직업 ' + jobs + '개)' + (miss.length ? ' 누락:' + miss : ''));
});
ok(new Set(Object.values(T).map(t => t.name)).size === 16, '유형 이름 중복 없음');

// 4. 관계
let relBad = 0;
codes.forEach(c => {
  const rel = S.relations(c, codes), all = [...rel.best, ...rel.complement, ...rel.clash];
  if (!(all.length === 6 && new Set(all).size === 6 && all.every(x => T[x] && x !== c))) relBad++;
  all.forEach(x => { if (!C.relText(c, x, 'best')) relBad++; });
});
ok(relBad === 0, '16유형 관계(잘 맞음 2·보완 2·충돌 2) 유효, 문장 생성');
const p1 = S.matchPercent('OVHS', 'RVHS'), p2 = S.matchPercent('OVHS', 'RGLF');
ok(p1 > p2 && p1 <= 100 && p2 >= 40, '가까운 조합이 먼 조합보다 궁합 점수 높음 (' + p1 + ' > ' + p2 + ')');

console.log(fail ? '\n실패 ' + fail + '건' : '\n모든 점검 통과');
process.exit(fail ? 1 : 0);
