/* 축 · 기질 그룹 · 정서 접미사 · 궁합 한 줄 문장 */
(function (root) {
  var AXES = {
    energy: { name: '에너지', O: { name: '외향' }, R: { name: '내향' } },
    perception: { name: '인식', V: { name: '탐구' }, G: { name: '현실' } },
    judgment: { name: '판단', H: { name: '공감' }, L: { name: '원칙' } },
    lifestyle: { name: '생활', S: { name: '계획' }, F: { name: '유연' } },
    emotion: { name: '정서', C: { name: '안정' }, E: { name: '민감' } }
  };

  var GROUPS = {
    VL: { name: '전략가군', text: '가능성을 보고 논리로 판단하는 유형' },
    VH: { name: '이상가군', text: '가능성을 보고 마음으로 판단하는 유형' },
    GL: { name: '실무가군', text: '현실을 보고 논리로 판단하는 유형' },
    GH: { name: '조화가군', text: '현실을 보고 마음으로 판단하는 유형' }
  };

  var SUFFIX = {
    C: { name: '안정형', text: '스트레스에도 비교적 침착하고 회복이 빠른 편이에요.' },
    E: { name: '민감형', text: '감정과 분위기를 예민하게 느끼는 섬세한 편이에요.' }
  };

  // 잘 맞는/부딪히는 이유를 한 줄로
  function relText(a, b, kind) {
    var p = [];
    if (kind === 'clash') {
      if (a[1] !== b[1]) p.push('세상을 보는 방식이 달라 같은 말도 다르게 들릴 수 있어요.');
      if (a[2] !== b[2]) p.push('결정 기준이 달라 의견이 자주 갈려요.');
      if (a[3] !== b[3]) p.push('생활 리듬도 달라요.');
    } else if (kind === 'complement') {
      if (a[0] !== b[0]) p.push('에너지 방향이 달라 서로의 빈틈을 채워 줘요.');
      if (a[3] !== b[3]) p.push('계획과 즉흥이 만나 균형이 잡혀요.');
      if (a[2] !== b[2]) p.push('마음과 원칙을 서로 배울 수 있어요.');
    } else {
      if (a[1] === b[1]) p.push('세상을 보는 방식이 같아 말이 잘 통해요.');
      if (a[2] === b[2]) p.push('결정 기준도 비슷해요.');
      if (a[0] !== b[0]) p.push('에너지는 달라서 서로 재미있어요.');
    }
    if (!p.length) p.push('비슷한 듯 다른 매력이 있어요.');
    return p.slice(0, 2).join(' ');
  }

  var NOTICE = '재미로 보는 가벼운 성격 테스트예요. 진단이나 전문 검사가 아니니 가볍게 즐겨 주세요.';

  root.CONTENT = { AXES: AXES, GROUPS: GROUPS, SUFFIX: SUFFIX, relText: relText, NOTICE: NOTICE };
})(typeof window !== 'undefined' ? window : globalThis);
