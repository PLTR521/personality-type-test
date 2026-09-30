/* 10문항 고정 (5개 축 × 2문항). 순서는 항상 같다.
 * key: +1 = A 방향(O/V/H/S/C), -1 = B 방향(R/G/L/F/E) */
window.QUESTIONS = [
  { id: 1, axis: 'energy', key: 1, text: '처음 보는 사람과도 금방 말을 튼다.' },
  { id: 2, axis: 'perception', key: -1, text: '이론보다 당장 쓸 수 있는 방법이 더 좋다.' },
  { id: 3, axis: 'judgment', key: 1, text: '친구가 힘들어하면 내 일처럼 마음이 쓰인다.' },
  { id: 4, axis: 'lifestyle', key: -1, text: '계획은 대충만 세우고 그때그때 움직이는 편이다.' },
  { id: 5, axis: 'emotion', key: 1, text: '실수를 해도 금방 털고 일어난다.' },
  { id: 6, axis: 'energy', key: -1, text: '사람들과 놀고 나면 혼자 쉬는 시간이 꼭 필요하다.' },
  { id: 7, axis: 'perception', key: 1, text: "'만약에…'를 상상하는 게 즐겁다." },
  { id: 8, axis: 'judgment', key: -1, text: '결정할 때는 감정보다 논리와 사실이 먼저다.' },
  { id: 9, axis: 'lifestyle', key: 1, text: '여행 일정은 미리 꼼꼼하게 짜 둔다.' },
  { id: 10, axis: 'emotion', key: -1, text: '사소한 일에도 기분이 크게 오르내린다.' }
];
