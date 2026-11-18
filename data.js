// ===== 데이터·계산 (화면과 무관한 로직) =====
const KEY = 'allowance-v2';
const SALARY_DAY = 25;
const LIVING_BUDGET = 600000;   // 생활비 55만 + K-패스 교통비 5만
const LIVING_FLOOR = 50000;     // 이 아래면 생활비 다 씀
const TAX = 0.154;

// 고정 통장 (적금 통장은 설정의 적금 목록으로 만들어서 ACCOUNTS에 끼워 넣음 → plans.js syncAccounts)
const BASE_ACCOUNTS = [
  { id: 'kb',    name: '국민',       full: '국민 입출금',         role: '월급 · 생활비 · 교통비',     color: '#e0a800' },
  { id: 'cash',  name: '현금',       full: '현금 (지갑)',         role: '세탁비 · 헌금',              color: '#6b7a8f' },
  { id: 'nh',    name: '농협',       full: '농협 입출금',         role: '월세 · 관리비 · 구독료',      color: '#2e9e5b' },
  { id: 'sh',    name: '신한',       full: '신한 입출금',         role: '비상금 · 20일 적금 이체', color: '#2f5fd0' },
  { id: 'kk',    name: '카카오',     full: '카카오 입출금',       role: '매월 17일 적금 이체',     color: '#c9a400' },
  { id: 'bonus', dot: '예금', name: '보너스 예금', full: '보너스 1년 정기예금', role: '3월 보너스 전액',           color: '#c2553a', saving: true, hideIfZero: true },
];
const ACCOUNTS = []; // 실제 통장 목록 (Store가 만들 때 채움)
const accOf = id => ACCOUNTS.find(a => a.id === id);

// 월급날 국민에서 나가는 돈
const SALARY_SPLIT = [
  { to: 'nh', amount: 750000, cat: '이체', label: '농협 (월세 65만 + 공과금·OTT)' },
  { to: 'sh', amount: 500000, cat: '이체', label: '신한 (비상금 20만 + 신한 적금 30만)' },
  { to: 'kk', amount: 720000, cat: '이체', label: '카카오 (17일 카카오 적금)' },
  { to: null, amount: 20000,  cat: '곗돈', label: '곗돈' },
];

// 비상금 예상에 쓰는 남은 월급날 (4월 예산까지)
const SALARY_DATES = ['2026-11-25', '2026-12-25', '2027-01-25', '2027-02-25', '2027-03-25'];

// 기본 분류 ('기타'를 고르면 이름을 직접 쓸 수 있음 → 그 이름이 분류가 됨). 실제 분류는 설정 → 분류에서 고친 값(s.cats)
const DEFAULT_CATS = {
  out: [['월세', '🏠'], ['관리비', '🏢'], ['구독', '📺'], ['식사', '🍚'], ['카페', '☕'], ['간식', '🍪'], ['선물', '🎁'], ['모임·여행', '🧳'],
        ['교통비', '🚌'], ['책', '📚'], ['옷', '👕'], ['화장품', '💄'], ['생필품', '🧴'], ['병원비', '💊'], ['경조사비', '💐'],
        ['택배·소포', '📦'], ['취미', '🎨'], ['세탁비', '🧺'], ['헌금', '⛪'], ['곗돈', '🤝'], ['기타', '✏️']],
  in:  [['교통비 환급', '🔄'], ['월급', '💼'], ['이자', '✨'], ['용돈', '💰'], ['생일비', '🎂'], ['기타', '✏️']],
};
// 세부 항목이 있는 분류 (그래프에선 한 조각, 표에서 나눠 보여줌)
// 세부 항목을 안 골라도 저장되는 분류 (다시 누르면 선택 해제)
const OPTIONAL_SUBS = ['식사'];
const DEFAULT_SUBCATS = {
  '관리비': ['전기', '가스', '수도'],
  '교통비': ['교통', '기차', '택시'],
  '구독': ['배달의민족', '넷플릭스', '디즈니플러스', '유튜브', '클로드'],
  '식사': ['점심', '저녁', '장보기'],
  '모임·여행': ['모임', '여행'],
  '취미': ['포스타입', '인형', '게임'],
};
const CATS = { out: [], in: [] }; // 실제 분류 (Store가 만들 때 s.cats로 채움 → syncCats)
const SUBCATS = {};
// 두 번째 선택지 (구독 결제 주기 / 누구랑)
const WHO = { label: '누구랑', choices: ['혼자', '내가 사줌'] };
const OPTS = {
  '구독': { label: '결제 주기', choices: ['매달', '1년치'] },
  '식사': WHO, '카페': WHO,
};
const optOf = t => t.opt || (t.treat ? '내가 사줌' : null);
// 신한에서 꺼내 쓴 돈이 어느 비상금인지
const FUNDS = { monthly: '매달 비상금', cash: '현금 비상금' };
const catLabel = t => [t.sub ? `${t.cat}(${t.sub})` : t.cat, optOf(t), t.gift ? '🎁 기프티콘' : null, FUNDS[t.fund]].filter(Boolean).join(' · ');
const SYS_EMOJI = { '이체': '🔁', '곗돈': '🤝', '적금': '🐷', '보너스': '🎉', '월급': '💼' };
const emojiOf = cat => SYS_EMOJI[cat] || [...CATS.out, ...CATS.in].find(c => c[0] === cat)?.[1] || '✏️';
const isPreset = (cat, sign) => CATS[sign < 0 ? 'out' : 'in'].some(c => c[0] === cat);
// 받침에 따라 "로/으로"
function ro(word) {
  const code = word.charCodeAt(word.length - 1) - 0xAC00;
  if (code < 0 || code > 11171) return word + '로';
  const jong = code % 28;
  return word + (jong === 0 || jong === 8 ? '로' : '으로');
}

// 시작 잔액 기준 (공개용: 0원). 내 잔액·기록은 "백업 불러오기"나 "실제 잔액으로 맞추기"로 넣어요
const NOW_BALANCES = { kb: 0, cash: 0, nh: 0, sh: 0, cpd: 0, kk: 0, kks: 0, bonus: 0 };
const INITIAL_TX = [...HISTORY_TX];
function baseFromNow() {
  const b = { ...NOW_BALANCES };
  for (const t of INITIAL_TX) if (!t.gift) b[t.acc] -= t.amt;
  return b;
}
const DEFAULT_STATE = {
  version: 2,
  baseDate: '2026-11-17',
  base: baseFromNow(),
  savings: DEFAULT_SAVINGS, // 적금 목록 (설정하기에서 추가·수정)
  fixed: [],               // 고정지출 { id, name, amount, day, acc, cat, sub, since }
  cats: DEFAULT_CATS,      // 분류 (설정 → 분류에서 추가·수정·순서)
  subcats: DEFAULT_SUBCATS,
  accOrder: null,          // 홈 화면 통장 순서 (설정 → 통장에서 드래그)
  bonusExpect: null,
  baseEmergency: 0, // 신한 입출금 중 "현금 비상금" (매달 20만과 구분, 설정하기에서 입력)
  applied: {},  // 반영된 자동이체 key
  tx: INITIAL_TX, // { id, date, acc, amt(부호 포함), cat, memo, kind: manual|salary|auto, group, transfer, budget }
};

// ===== 날짜 유틸 =====
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const toDate = s => new Date(s + 'T00:00:00');
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
// 예산월: 25일부터는 다음 달 예산
function budgetOf(dateStr) {
  const d = toDate(dateStr);
  if (d.getDate() >= SALARY_DAY) d.setMonth(d.getMonth() + 1, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function nextSalaryDate() {
  const d = new Date();
  if (d.getDate() >= SALARY_DAY) d.setMonth(d.getMonth() + 1, 1);
  d.setDate(SALARY_DAY);
  return ymd(d);
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ===== 상태 저장소 =====
class Store {
  constructor() { this.s = this.load(); syncAccounts(this.s); syncCats(this.s); }

  load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.version === 2) return this.migrate({ ...JSON.parse(JSON.stringify(DEFAULT_STATE)), ...s });
    } catch (e) { /* 손상된 값이면 기본값 */ }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  migrate(s) {
    // 적금이 코드에 고정돼 있던 저장본: 금리·카카오 만기일 설정을 적금 목록으로 옮김
    if (!Array.isArray(s.savings)) s.savings = JSON.parse(JSON.stringify(DEFAULT_SAVINGS));
    for (const sv of s.savings) {
      if (s.rates && sv.rate == null && s.rates[sv.id] != null) sv.rate = s.rates[sv.id];
      if (s.kksMaturity && sv.id === 'kks') sv.maturity = s.kksMaturity;
    }
    delete s.rates; delete s.kksMaturity;
    if (!Array.isArray(s.fixed)) s.fixed = [];
    if (!s.cats) s.cats = JSON.parse(JSON.stringify(DEFAULT_CATS));
    if (!s.subcats) s.subcats = JSON.parse(JSON.stringify(DEFAULT_SUBCATS));
    syncAccounts(s); // 통장 목록 만들기 + 없는 시작 잔액은 0원으로
    syncCats(s);
    // 처음 기록(history.js) 중 저장본에 없는 것만 넣고, 그만큼 시작 잔액을 거꾸로 조정 (지금 잔액은 그대로)
    const have = new Set(s.tx.map(t => t.id));
    for (const t of INITIAL_TX) {
      if (!t.id.startsWith('h-') || have.has(t.id)) continue;
      s.tx.push({ ...t });
      s.base[t.acc] -= t.amt;
    }
    // 이름 바뀐 분류: 커피 → 카페, 관리비(난방) → 관리비(가스), 택시비 → 교통비(택시)
    for (const t of s.tx) {
      if (t.cat === '커피') t.cat = '카페';
      if (t.cat === '관리비' && t.sub === '난방') t.sub = '가스';
      if (t.cat === '택시비') { t.cat = '교통비'; t.sub = '택시'; }
    }
    return s;
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.s)); return true; } catch (e) { return false; }
  }
  reset() { this.s = JSON.parse(JSON.stringify(DEFAULT_STATE)); syncAccounts(this.s); syncCats(this.s); this.save(); }

  // 잔액 = 시작 잔액 + 모든 기록 합
  balance(acc) {
    // 기프티콘 소비(gift)는 돈이 안 나갔으니 잔액에서 제외
    return (this.s.base[acc] || 0) + this.s.tx.reduce((sum, t) => t.acc === acc && !t.gift ? sum + t.amt : sum, 0);
  }

  // 날짜가 지난 적금 자동이체 · 고정지출 반영. 반영된 개수 반환
  applyAuto() {
    const t = today();
    let n = 0;
    for (const { key, date, f } of fixedDue(this.s, t)) {
      this.s.tx.push({ id: newId(), date, acc: f.acc, amt: -f.amount, cat: f.cat, sub: f.sub || null, memo: f.name, kind: 'fixed', fixedId: f.id, order: 0 });
      this.s.applied[key] = true;
      n++;
    }
    for (const it of schedule(this.s)) {
      if (it.date > t || this.s.applied[it.key]) continue;
      const group = newId(), name = accOf(it.to).full;
      this.s.tx.push(
        { id: newId(), date: it.date, acc: it.from, amt: -it.amount, cat: '적금', memo: `${name} ${it.round}회차 자동이체`, kind: 'auto', group, transfer: true },
        { id: newId(), date: it.date, acc: it.to, amt: it.amount, cat: '적금', memo: `${it.round}회차 납입`, kind: 'auto', group, transfer: true });
      this.s.applied[it.key] = true;
      n++;
    }
    if (n) this.save();
    return n;
  }

  salaryDone(budget) { return this.s.tx.some(t => t.kind === 'salary' && t.budget === budget); }

  // 월급날 버튼: 국민 입금 + 각 통장으로 나눠 넣기
  addSalary(date, salary, bonus) {
    const group = newId(), budget = budgetOf(date);
    const base = { date, kind: 'salary', group, budget };
    const m = Number(budget.slice(5));
    const push = (acc, amt, cat, memo, transfer) => this.s.tx.push({ id: newId(), ...base, acc, amt, cat, memo, transfer });
    push('kb', salary, '월급', `${m}월 예산 월급`, false);
    for (const sp of SALARY_SPLIT) {
      push('kb', -sp.amount, sp.cat, sp.to ? `${ro(accOf(sp.to).name)} 이체` : '곗돈 송금', !!sp.to);
      if (sp.to) push(sp.to, sp.amount, '이체', '국민에서 월급 이체', true);
    }
    if (bonus > 0) {
      push('kb', bonus, '보너스', '3월 보너스', false);
      push('kb', -bonus, '이체', '보너스 정기예금으로', true);
      push('bonus', bonus, '보너스', '1년 정기예금 가입', true);
    }
    this.save();
  }

  // 자동이체가 예정돼 있고 그 돈이 이미 통장에 들어와 있는 금액 (비상금에서 제외)
  pendingRaw(acc) {
    const t = today(), baseBudget = budgetOf(this.s.baseDate);
    return schedule(this.s).filter(it => it.from === acc && !this.s.applied[it.key] && it.date > t)
      .filter(it => { const b = it.date.slice(0, 7); return b <= baseBudget || this.salaryDone(b); })
      .reduce((s, it) => s + it.amount, 0);
  }
  // 통장에 실제로 있는 돈보다 많이 잡지 않음 (잔액 0원인데 대기 30만이면 비상금이 마이너스가 되는 문제)
  pending(acc) {
    return Math.min(this.pendingRaw(acc), Math.max(0, this.balance(acc)));
  }
  nextAuto(acc) {
    return schedule(this.s).find(it => (it.from === acc || it.to === acc) && !this.s.applied[it.key]);
  }

  // 실제 잔액으로 맞추기: 기록을 남기지 않고 시작 잔액을 차이만큼 조정. 조정액 반환
  adjustTo(acc, actual) {
    const diff = actual - this.balance(acc);
    this.s.base[acc] = (this.s.base[acc] || 0) + diff;
    this.save();
    return diff;
  }

  saved() { return ACCOUNTS.filter(a => a.saving).reduce((s, a) => s + this.balance(a.id), 0); }
  emergency() {
    const sh = this.balance('sh') - this.pending('sh');
    const kk = this.balance('kk') - this.pending('kk');
    // 신한 비상금 = 현금 비상금(설정액 - 현금 비상금에서 쓴 돈) + 나머지는 매달 쌓인 비상금
    const cashLeft = Math.max(0, this.s.baseEmergency - this.cashFundSpent());
    const cash = Math.min(cashLeft, Math.max(0, sh));
    return { sh, kk, cash, monthly: sh - cash, total: sh + kk };
  }
  // 신한에서 "현금 비상금"으로 표시하고 꺼낸 돈 합계
  cashFundSpent() {
    return this.s.tx.reduce((sum, t) => t.acc === 'sh' && t.fund === 'cash' && t.amt < 0 ? sum - t.amt : sum, 0);
  }
  // 신한 실제 잔액 맞추기: 매달·현금 비상금을 각각 입력 (적금 이체 대기분은 앱이 더함)
  adjustEmergency(monthly, cash) {
    this.s.baseEmergency = cash + this.cashFundSpent();
    return this.adjustTo('sh', monthly + cash + this.pendingRaw('sh'));
  }
  paidRounds(id) {
    const sv = this.s.savings.find(x => x.id === id);
    return sv.paidBefore + schedule(this.s).filter(it => it.to === id && this.s.applied[it.key]).length;
  }

  // 적금 만기 예상 (단리 · 회차별 예치 일수)
  forecast(id) {
    const sv = this.s.savings.find(x => x.id === id), rate = (sv.rate || 0) / 100;
    const maturity = sv.maturity || addMonths(sv.start, sv.count), dates = savingDates(sv);
    const principal = sv.amount * dates.length;
    const pre = dates.reduce((s, d) => s + Math.round(sv.amount * rate * Math.max(0, daysBetween(d, maturity)) / 365), 0);
    const tax = Math.floor(pre * TAX / 10) * 10;
    return { principal, pre, tax, post: pre - tax, total: principal + pre - tax, maturity };
  }

  // 4월 말 비상금 예상: 지금 비상금 + 아직 안 받은 월급의 신한 몫 - 그 달 신한에서 나갈 적금
  emergencyForecast() {
    const shIn = SALARY_SPLIT.find(x => x.to === 'sh').amount, plan = schedule(this.s);
    const add = SALARY_DATES.filter(d => !this.salaryDone(budgetOf(d))).reduce((sum, d) => {
      const b = budgetOf(d);
      return sum + shIn - plan.filter(it => it.from === 'sh' && it.date.slice(0, 7) === b).reduce((x, it) => x + it.amount, 0);
    }, 0);
    return this.emergency().total + add;
  }
}
