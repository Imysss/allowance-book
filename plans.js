// ===== 적금 · 고정지출 (설정하기에서 추가·수정, 날짜가 되면 자동 반영) =====
// data.js 앞에 로드됨 (DEFAULT_SAVINGS를 data.js가 씀). 함수들은 실행 중에 data.js 값을 사용해요.

// 지금 쓰는 적금 (처음 상태 · 예전 저장본 변환용). 첫 회차는 시작 잔액에 이미 들어 있음(paidBefore)
const DEFAULT_SAVINGS = [
  { id: 'cpd', name: '신한 적금', from: 'sh', amount: 300000, start: '2026-10-20', count: 6, paidBefore: 1,
    maturity: '2027-04-20', rate: null, color: '#7c4dcc' },
  { id: 'kks', name: '카카오 적금', from: 'kk', amount: 720000, start: '2026-11-17', count: 6, paidBefore: 1,
    maturity: '2027-05-17', rate: null, color: '#8a6d00' },
];
const SAVING_COLORS = ['#7c4dcc', '#8a6d00', '#1f9bb5', '#d64d8a', '#3c7a5a', '#a0522d'];

// "2026-01-31" + 1달 → "2026-02-28" (말일 보정, 원래 날짜 기준)
function addMonths(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(y, m - 1 + n, 1);
  t.setDate(Math.min(d, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
  return ymd(t);
}
const savingDates = sv => Array.from({ length: sv.count }, (_, k) => addMonths(sv.start, k));
const savingOf = id => (store.s.savings || []).find(sv => sv.id === id);

// 통장 목록 = 고정 통장 + 적금 통장 (적금은 출금 통장 바로 뒤에)
function syncAccounts(s) {
  const list = [];
  for (const a of BASE_ACCOUNTS) {
    list.push(a);
    for (const sv of s.savings || []) {
      if (sv.from !== a.id) continue;
      const day = Number(sv.start.slice(8));
      list.push({ id: sv.id, dot: '적금', name: sv.name, full: sv.name, color: sv.color, saving: true,
        role: `매월 ${day}일 ${Math.round(sv.amount / 10000).toLocaleString('ko-KR')}만`, hideIfZero: !!sv.closed });
    }
  }
  // 보너스 예금은 맨 뒤로, 그다음 설정 → 통장에서 정한 순서 (순서에 없는 통장은 원래 자리 기준 뒤쪽)
  list.sort((a, b) => (a.id === 'bonus') - (b.id === 'bonus'));
  if (Array.isArray(s.accOrder)) {
    const rank = id => { const i = s.accOrder.indexOf(id); return i < 0 ? 1000 + list.findIndex(a => a.id === id) : i; };
    list.sort((a, b) => rank(a.id) - rank(b.id));
  }
  ACCOUNTS.length = 0;
  ACCOUNTS.push(...list);
  for (const a of ACCOUNTS) if (typeof s.base[a.id] !== 'number') s.base[a.id] = 0;
}

// 날짜가 되면 들어갈 적금 자동이체 (이미 낸 회차 제외). key 형식은 예전과 같음: "적금id-날짜"
function schedule(s) {
  return (s.savings || []).filter(sv => !sv.closed).flatMap(sv =>
    savingDates(sv).map((date, k) => ({ key: `${sv.id}-${date}`, date, from: sv.from, to: sv.id, amount: sv.amount, round: k + 1 }))
      .filter(it => it.round > sv.paidBefore))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 고정지출: 매달 day일 (말일 보정). since 이후 ~ upto 까지 아직 안 나간 것
function fixedDue(s, upto) {
  const out = [];
  for (const f of s.fixed || []) {
    for (let month = f.since.slice(0, 7) + '-01'; month.slice(0, 7) <= upto.slice(0, 7); month = addMonths(month, 1)) {
      const date = clampDay(month, f.day), key = `fx-${f.id}-${month.slice(0, 7)}`;
      if (date >= f.since && date <= upto && !s.applied[key]) out.push({ key, date, f });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
// "2026-02-01" 의 달에서 31일 → "2026-02-28"
function clampDay(monthStart, day) {
  const [y, m] = monthStart.split('-').map(Number);
  return `${y}-${pad(m)}-${pad(Math.min(day, new Date(y, m, 0).getDate()))}`;
}
// 통장의 다음 고정지출 (오늘 아직 안 나갔으면 오늘 포함)
function nextFixed(s, acc) {
  const t = today();
  return (s.fixed || []).filter(f => f.acc === acc).map(f => {
    let date = clampDay(t.slice(0, 7) + '-01', f.day);
    if (date < t || s.applied[`fx-${f.id}-${t.slice(0, 7)}`] || date < f.since) date = clampDay(addMonths(t.slice(0, 7) + '-01', 1), f.day);
    return { date, f };
  }).sort((a, b) => a.date.localeCompare(b.date))[0];
}

// 분류: 설정(s.cats / s.subcats)을 화면이 쓰는 CATS / SUBCATS에 채우기
function syncCats(s) {
  CATS.out = s.cats.out;
  CATS.in = s.cats.in;
  for (const k of Object.keys(SUBCATS)) delete SUBCATS[k];
  Object.assign(SUBCATS, s.subcats);
}
