// ===== 화면 (Store 데이터를 그리고 입력을 Store로 전달) =====
const store = new Store();
const $ = s => document.querySelector(s);
const won = n => Math.round(n).toLocaleString('ko-KR') + '원';
const signed = n => (n > 0 ? '+' : n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('ko-KR') + '원';
const short = n => n >= 10000 ? (Math.round(n / 1000) / 10).toLocaleString('ko-KR') + '만' : n.toLocaleString('ko-KR');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const md = s => { const d = toDate(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const parseWon = v => parseInt(String(v).replace(/\D/g, '').slice(0, 9), 10) || 0;
const fmtInput = el => { const n = parseWon(el.value); el.value = n ? n.toLocaleString('ko-KR') : ''; };

let tab = 'home';
const histMonth = new Date(); histMonth.setDate(1);
let histFilter = 'all';

// ===== 전체 다시 그리기 =====
function render() {
  if (tab === 'home') renderHome();
  if (tab === 'history') renderHistory();
  if (tab === 'savings') renderSavings();
}

// ----- 홈 -----
function renderHome() {
  const cpd = store.balance('cpd'), kks = store.balance('kks'), bonus = store.balance('bonus');
  $('#savedTotal').textContent = won(store.saved());
  $('#savedDetail').innerHTML = `신한 적금 <b>${won(cpd)}</b><br>카카오 적금 <b>${won(kks)}</b>` + (bonus ? `<br>보너스 예금 <b>${won(bonus)}</b>` : '');

  const em = store.emergency();
  $('#emergTotal').textContent = won(em.total);
  $('#emergDetail').innerHTML = `매달 비상금 <b>${won(em.monthly)}</b><br>현금 비상금 <b>${won(em.cash)}</b><br>카카오 <b>${won(em.kk)}</b>`;

  const kb = store.balance('kb');
  const pct = Math.max(0, Math.min(100, kb / LIVING_BUDGET * 100));
  $('#livingAmt').innerHTML = won(kb) + (kb < LIVING_FLOOR ? ' <span class="badge">생활비 다 씀</span>' : '');
  $('#livingBar').style.width = pct + '%';
  $('#living').classList.toggle('warn', kb < LIVING_FLOOR);
  const ns = nextSalaryDate(), dd = daysBetween(today(), ns);
  $('#dday').textContent = dd === 0 ? '오늘 월급날!' : `월급까지 D-${dd}`;

  const thisBudget = budgetOf(today());
  $('#paydaySub').textContent = store.salaryDone(thisBudget)
    ? `${Number(thisBudget.slice(5))}월 예산 월급은 기록했어요` : `다음 월급날 ${md(ns)} · 누르면 통장별로 나눠 넣어요`;

  // 통장 잔액
  let total = 0;
  $('#accList').innerHTML = ACCOUNTS.filter(a => !(a.hideIfZero && store.balance(a.id) === 0)).map(a => {
    const b = store.balance(a.id); total += b;
    const nx = store.nextAuto(a.id);
    const note = nx ? (nx.from === a.id ? `${md(nx.date)} ${ro(accOf(nx.to).name)} -${short(nx.amount)} 자동이체` : `${md(nx.date)} ${nx.round}회차 +${short(nx.amount)} 들어올 예정`) : '';
    const extra = a.saving && SAVINGS[a.id] ? ` · ${store.paidRounds(a.id)}/6회` : '';
    const split = accSplit(a.id, em);
    return `<button class="acc" data-acc="${a.id}">
      <div class="dot" style="background:${a.color}">${esc(a.dot || a.name.slice(0, 2))}</div>
      <div class="meta"><b>${esc(a.full)}${extra}</b><span>${esc(a.role)}</span>${note ? `<em>${esc(note)}</em>` : ''}</div>
      <div class="amt num">${won(b)}${split}</div></button>`;
  }).join('');
  $('#balTotal').textContent = '전체 ' + won(total);

  const recent = sortTx(store.s.tx).slice(0, 8);
  $('#recent').innerHTML = recent.length ? groupHtml(recent) : `<div class="empty">아직 기록이 없어요.<br>+ 버튼으로 쓴 돈을 적거나, 월급날에 위 버튼을 눌러주세요.</div>`;
}

// 통장 금액 아래 작은 구분 줄: 초록 = 비상금, 회색 = 곧 적금으로 넘어갈 돈 (날짜 되면 자동이체 후 사라짐)
function accSplit(id, em) {
  const wait = store.pending(id);
  const waitLine = wait ? `<span class="wait">적금 이체 대기 ${won(wait)}</span>` : '';
  if (id === 'sh') return `<small>매달 비상금 ${won(em.monthly)}<br>현금 비상금 ${won(em.cash)}${waitLine ? '<br>' + waitLine : ''}</small>`;
  if (id === 'kk' && wait) return `<small>비상금 ${won(em.kk)}<br>${waitLine}</small>`;
  return '';
}

// ----- 내역 -----
function renderHistory() {
  const mk = `${histMonth.getFullYear()}-${pad(histMonth.getMonth() + 1)}`;
  $('#month').textContent = `${histMonth.getFullYear()}년 ${histMonth.getMonth() + 1}월`;
  $('#filters').innerHTML = [['all', '전체'], ...ACCOUNTS.map(a => [a.id, a.name])]
    .map(([id, n]) => `<button class="chip ${histFilter === id ? 'on' : ''}" data-filter="${id}">${n}</button>`).join('');
  // 통장을 골랐으면 지금 잔액 + 맞추기 버튼
  $('#accBal').hidden = histFilter === 'all';
  if (histFilter !== 'all') {
    $('#accBalName').textContent = `${accOf(histFilter).full} 지금 잔액`;
    $('#accBalAmt').textContent = won(store.balance(histFilter));
  }
  const list = sortTx(store.s.tx.filter(t => t.date.startsWith(mk) && (histFilter === 'all' || t.acc === histFilter)));
  // 전체 보기에서는 통장 간 이체를 빼고 합산
  let inc = 0, out = 0;
  for (const t of list) {
    if ((histFilter === 'all' && t.transfer) || t.gift) continue;
    t.amt > 0 ? inc += t.amt : out -= t.amt;
  }
  $('#sumIn').textContent = '+' + won(inc);
  $('#sumOut').textContent = '-' + won(out);
  // 통장별 실제로 쓴 돈 (통장 이체·적금 자동이체·기프티콘 제외), 전체 보기에서만
  $('#sumsBy').hidden = histFilter !== 'all';
  const spent = acc => store.s.tx.reduce((s, t) =>
    t.date.startsWith(mk) && t.acc === acc && t.amt < 0 && !t.transfer && !t.gift ? s - t.amt : s, 0);
  const neg = v => (v ? '-' : '') + won(v);
  $('#outKb').textContent = neg(spent('kb'));
  $('#outNh').textContent = neg(spent('nh'));
  $('#outSh').textContent = neg(spent('sh'));
  $('#history').innerHTML = list.length ? groupHtml(list) : `<div class="empty">이 달 기록이 없어요.</div>`;
}

function sortTx(list) {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.order || 0) - (a.order || 0));
}
function groupHtml(list) {
  const groups = [];
  for (const t of list) {
    const g = groups[groups.length - 1];
    g && g.date === t.date ? g.items.push(t) : groups.push({ date: t.date, items: [t] });
  }
  return groups.map(g => {
    const d = toDate(g.date);
    return `<div class="day"><div class="day-head"><span>${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW[d.getDay()]}요일</span></div>
      <div class="rows">${g.items.map(t => `
        <button class="row" data-id="${t.id}">
          <div class="emoji">${emojiOf(t.cat)}</div>
          <div class="meta"><b>${esc(t.memo || catLabel(t))}</b><span>${t.gift ? '' : esc(accOf(t.acc).name) + ' · '}${esc(catLabel(t))}${t.kind === 'auto' ? ' · 자동이체' : t.kind === 'salary' ? ' · 월급날' : ''}</span></div>
          ${t.gift ? `<div class="amt num gift">🎁 ${won(-t.amt)}</div>` : `<div class="amt num ${t.amt > 0 ? 'in-c' : 'out-c'}">${signed(t.amt)}</div>`}
        </button>`).join('')}</div></div>`;
  }).join('');
}

// ----- 적금 -----
function renderSavings() {
  $('#savingCards').innerHTML = Object.keys(SAVINGS).map(id => {
    const a = accOf(id), sv = SAVINGS[id], f = store.forecast(id), paid = store.paidRounds(id);
    const nx = store.nextAuto(id);
    return `<div class="card saving" style="margin-bottom:12px">
      <h3>${esc(a.full)}</h3><div class="label">월 ${short(sv.amount)}원 × 6회 · 만기 ${f.maturity.replace(/-/g, '.')}</div>
      <div class="progress">${sv.dates.map((_, i) => `<i class="${i < paid ? 'on' : ''}"></i>`).join('')}</div>
      <div class="kv"><span>지금까지 넣은 돈 (${paid}/6회)</span><b class="num">${won(store.balance(id))}</b></div>
      <div class="kv"><span>다음 납입</span><b>${nx ? `${md(nx.date)} ${nx.round}회차` : '납입 끝!'}</b></div>
      <div class="kv"><span>적용 금리 (연)</span><label class="rate"><input class="num" inputmode="decimal" data-rate="${id}" value="${store.s.rates[id] ?? ''}" placeholder="0.0">%</label></div>
      <div class="kv"><span>만기 원금</span><b class="num">${won(f.principal)}</b></div>
      <div class="kv"><span>세전 이자</span><b class="num">${won(f.pre)}</b></div>
      <div class="kv"><span>이자소득세 15.4%</span><b class="num">-${won(f.tax)}</b></div>
      <div class="kv total"><span>만기 예상 수령액</span><b class="num">${won(f.total)}</b></div>
    </div>`;
  }).join('');

  const cpd = store.forecast('cpd'), kks = store.forecast('kks');
  const em = store.emergencyForecast();
  const bonus = store.balance('bonus') || store.s.bonusExpect || 0;
  const sum = cpd.total + kks.total + em + bonus;
  $('#forecast').innerHTML = `
    <div class="kv"><span>신한 적금 만기금 (${md(cpd.maturity)})</span><b class="num">${won(cpd.total)}</b></div>
    <div class="kv"><span>카카오 적금 만기금 (${md(kks.maturity)})</span><b class="num">${won(kks.total)}</b></div>
    <div class="kv"><span>비상금 (신한 + 카카오)</span><b class="num">${won(em)}</b></div>
    <div class="kv"><span>보너스 정기예금${store.balance('bonus') ? '' : ' (예상)'}</span><b class="num">${won(bonus)}</b></div>
    <div class="kv total"><span>합계</span><b class="num">${won(sum)}</b></div>
    <div class="kv"><span>청약 미납분 230만 넣은 뒤</span><b class="num">${won(sum - 2300000)}</b></div>`;
}

// ===== 시트 =====
function openSheet(el) { $('#dim').classList.add('on'); el.classList.add('on'); }
function closeSheets() {
  $('#dim').classList.remove('on');
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('on'));
  document.activeElement?.blur();
}

// ----- 월급날 -----
function openPay() {
  $('#payDate').value = today();
  $('#payAmount').value = (2590000).toLocaleString('ko-KR');
  $('#payBonus').value = '';
  drawPay();
  openSheet($('#paySheet'));
}
function drawPay() {
  const salary = parseWon($('#payAmount').value), bonus = parseWon($('#payBonus').value);
  const outs = SALARY_SPLIT.reduce((s, x) => s + x.amount, 0);
  const left = salary - outs;
  $('#paySplit').innerHTML =
    `<div class="kv"><span>국민 월급</span><b class="in-c">+${won(salary)}</b></div>` +
    SALARY_SPLIT.map(x => `<div class="kv"><span>→ ${esc(x.label)}</span><b class="out-c">-${won(x.amount)}</b></div>`).join('') +
    (bonus ? `<div class="kv"><span>보너스 → 1년 정기예금</span><b>${won(bonus)}</b></div>` : '') +
    `<div class="kv total"><span>국민에 남는 생활비</span><b>${won(left)}</b></div>`;
}
function confirmPay() {
  const date = $('#payDate').value || today(), salary = parseWon($('#payAmount').value), bonus = parseWon($('#payBonus').value);
  if (salary <= 0) { toast('월급을 입력해 주세요'); return; }
  const b = budgetOf(date);
  if (store.salaryDone(b) && !confirm(`${Number(b.slice(5))}월 예산 월급은 이미 기록했어요. 한 번 더 넣을까요?`)) return;
  store.addSalary(date, salary, bonus);
  closeSheets(); render();
  toast('🎉 월급을 통장별로 나눠 넣었어요');
}

// ----- 설정 -----
function openSettings() {
  closeSheets();
  $('#baseLabel').textContent = '시작 잔액 (10월 첫 기록 이전 금액 · 지금 잔액을 맞출 땐 내역의 "실제 잔액으로 맞추기"가 편해요)';
  $('#baseInputs').innerHTML = ACCOUNTS.filter(a => a.id !== 'bonus').map(a =>
    `<div><label>${a.full}</label><input class="input num" inputmode="numeric" data-base="${a.id}" value="${store.s.base[a.id].toLocaleString('ko-KR')}"></div>`).join('');
  $('#kksMaturity').value = store.s.kksMaturity;
  $('#bonusExpect').value = store.s.bonusExpect ? store.s.bonusExpect.toLocaleString('ko-KR') : '';
  $('#baseEmergency').value = store.s.baseEmergency.toLocaleString('ko-KR');
  openSheet($('#settingsSheet'));
}
function saveSettings() {
  document.querySelectorAll('[data-base]').forEach(el => { store.s.base[el.dataset.base] = parseWon(el.value); });
  store.s.kksMaturity = $('#kksMaturity').value || store.s.kksMaturity;
  store.s.bonusExpect = parseWon($('#bonusExpect').value) || null;
  store.s.baseEmergency = parseWon($('#baseEmergency').value);
  persist(); closeSheets(); render(); toast('저장했어요');
}

// ----- 백업 -----
async function exportData() {
  const name = `용돈기입장_${today()}.json`;
  const file = new File([JSON.stringify(store.s, null, 2)], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (data.version !== 2 || !Array.isArray(data.tx)) throw new SyntaxError('형식 오류');
      if (!confirm(`기록 ${data.tx.length}개를 불러올까요? 지금 기록은 백업 내용으로 바뀌어요.`)) return;
      store.s = { ...JSON.parse(JSON.stringify(DEFAULT_STATE)), ...data };
      persist(); closeSheets(); render(); toast('불러왔어요');
    } catch (e) { toast('백업 파일을 읽지 못했어요'); }
  };
  r.readAsText(file);
}

function persist() { if (!store.save()) toast('저장에 실패했어요'); }
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2000);
}
function switchTab(name) {
  tab = name;
  ['home', 'history', 'savings'].forEach(n => { $('#tab-' + n).hidden = n !== name; });
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $('#title').textContent = { home: '내 통장', history: '내역', savings: '적금' }[name];
  $('#addBtn').hidden = name === 'savings';
  window.scrollTo(0, 0);
  render();
}
// 앱을 열거나 다시 볼 때 날짜 지난 자동이체 반영
function refreshAuto() {
  const n = store.applyAuto();
  render();
  if (n) toast(`자동이체 ${n}건이 반영됐어요`);
}

// ===== 이벤트 연결 =====
document.querySelector('nav').onclick = e => { const b = e.target.closest('button'); if (b) switchTab(b.dataset.tab); };
$('#moreBtn').onclick = () => switchTab('history');
$('#addBtn').onclick = () => openForm(null, tab === 'history' && histFilter !== 'all' ? histFilter : 'kb');
$('#paydayBtn').onclick = openPay;
$('#menuBtn').onclick = () => openSheet($('#menuSheet'));
$('#settingsBtn').onclick = openSettings;
$('#dim').onclick = closeSheets;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheets(); });
document.body.addEventListener('click', e => {
  const row = e.target.closest('.row'); if (row) return onTx(row.dataset.id);
  const acc = e.target.closest('.acc');
  if (acc) { histFilter = acc.dataset.acc; switchTab('history'); }
});
$('#prev').onclick = () => { histMonth.setMonth(histMonth.getMonth() - 1); render(); };
$('#next').onclick = () => { histMonth.setMonth(histMonth.getMonth() + 1); render(); };

// ----- 분석 (⋯ 메뉴 → 분석하기) -----
const anMonth = new Date(); anMonth.setDate(1);
function drawAnalysis() {
  const mk = `${anMonth.getFullYear()}-${pad(anMonth.getMonth() + 1)}`;
  $('#anMonth').textContent = `${anMonth.getFullYear()}년 ${anMonth.getMonth() + 1}월`;
  renderChart(store.s.tx.filter(t => t.date.startsWith(mk)));
  $('#anEmpty').hidden = !$('#chart').hidden;
}
$('#analysisBtn').onclick = () => {
  anMonth.setTime(histMonth.getTime()); // 내역에서 보던 달부터
  closeSheets(); drawAnalysis(); openSheet($('#analysisSheet'));
};
$('#anPrev').onclick = () => { anMonth.setMonth(anMonth.getMonth() - 1); drawAnalysis(); };
$('#anNext').onclick = () => { anMonth.setMonth(anMonth.getMonth() + 1); drawAnalysis(); };
$('#filters').onclick = e => { const b = e.target.closest('[data-filter]'); if (b) { histFilter = b.dataset.filter; render(); } };
$('#savingCards').addEventListener('change', e => {
  const id = e.target.dataset.rate; if (!id) return;
  const v = parseFloat(e.target.value.replace(',', '.'));
  store.s.rates[id] = isNaN(v) ? null : v;
  persist(); render();
});
['#payAmount', '#payBonus'].forEach(s => { $(s).oninput = e => { fmtInput(e.target); drawPay(); }; });
$('#payConfirm').onclick = confirmPay;
$('#settingsSheet').addEventListener('input', e => { if (e.target.dataset.base !== undefined || e.target.id === 'bonusExpect' || e.target.id === 'baseEmergency') fmtInput(e.target); });
$('#settingsSave').onclick = saveSettings;
// ----- 실제 잔액으로 맞추기 -----
const commaVal = n => (n > 0 ? n.toLocaleString('ko-KR') : '');
$('#adjustBtn').onclick = () => {
  const b = store.balance(histFilter), isSh = histFilter === 'sh';
  $('#adjustTitle').textContent = `${accOf(histFilter).full} 잔액 맞추기`;
  $('#adjustNow').textContent = `앱에 적힌 잔액 ${won(b)}`;
  $('#adjustOne').hidden = isSh;
  $('#adjustSh').hidden = !isSh;
  if (isSh) {
    // 신한은 매달 / 현금 비상금을 따로 맞춤. 적금 이체 대기분은 앱이 더함
    const em = store.emergency(), p = store.pendingRaw('sh');
    $('#adjMonthly').value = commaVal(em.monthly);
    $('#adjCash').value = commaVal(em.cash);
    $('#adjustPending').textContent = p ? `곧 적금으로 나갈 ${won(p)}은 앱이 알아서 더해요. 통장 잔액에서 이 금액을 뺀 나머지를 나눠 적어주세요.` : '';
  } else {
    $('#adjustAmount').value = commaVal(b);
  }
  openSheet($('#adjustSheet'));
  if (!isSh) setTimeout(() => $('#adjustAmount').select(), 260);
};
['#adjustAmount', '#adjMonthly', '#adjCash'].forEach(s => { $(s).oninput = e => fmtInput(e.target); });
$('#adjustSave').onclick = () => {
  const name = accOf(histFilter).name;
  if (histFilter === 'sh') {
    const monthly = parseWon($('#adjMonthly').value), cash = parseWon($('#adjCash').value);
    const diff = store.adjustEmergency(monthly, cash);
    closeSheets(); render();
    toast(`매달 비상금 ${won(monthly)} · 현금 비상금 ${won(cash)}으로 맞췄어요${diff ? ` (${signed(diff)})` : ''}`);
    return;
  }
  const actual = parseWon($('#adjustAmount').value);
  const diff = store.adjustTo(histFilter, actual);
  closeSheets(); render();
  toast(diff ? `${name} 잔액을 ${won(actual)}으로 맞췄어요 (${signed(diff)})` : '이미 같은 금액이에요');
};
$('#exportBtn').onclick = exportData;
$('#importBtn').onclick = () => $('#fileInput').click();
$('#fileInput').onchange = e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; };
$('#resetBtn').onclick = () => {
  if (!confirm('직접 적은 기록을 모두 지우고 처음 상태(10~11월 기록 포함)로 돌아갈까요? 되돌릴 수 없어요.')) return;
  store.reset(); closeSheets(); refreshAuto(); toast('처음 상태로 돌아갔어요');
};
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAuto(); });

refreshAuto();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js');
}
