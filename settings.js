// ===== 적금 탭 · 설정하기의 고정지출/적금 목록 · 추가·수정 시트 =====
// form.js 다음에 로드됨: store, $, won, short, md, esc, render, toast, openSheet, closeSheets, persist, openSettings 사용

const kvRow = (k, v, cls = '') => `<div class="kv ${cls}"><span>${k}</span><b class="num">${v}</b></div>`;
const bankAccounts = () => ACCOUNTS.filter(a => !a.saving);

// ----- 적금 탭 -----
function renderSavings() {
  const list = store.s.savings.filter(sv => !sv.closed);
  $('#savingCards').innerHTML = list.length ? list.map(sv => {
    const f = store.forecast(sv.id), paid = store.paidRounds(sv.id), nx = store.nextAuto(sv.id);
    return `<div class="card saving" style="margin-bottom:12px">
      <h3>${esc(sv.name)}</h3><div class="label">${esc(accOf(sv.from).name)}에서 월 ${short(sv.amount)}원 × ${sv.count}회 · 만기 ${f.maturity.replace(/-/g, '.')}</div>
      <div class="progress">${savingDates(sv).map((_, i) => `<i class="${i < paid ? 'on' : ''}"></i>`).join('')}</div>
      ${kvRow(`지금까지 넣은 돈 (${paid}/${sv.count}회)`, won(store.balance(sv.id)))}
      ${kvRow('다음 납입', nx ? `${md(nx.date)} ${nx.round}회차` : '납입 끝!')}
      <div class="kv"><span>적용 금리 (연)</span><label class="rate"><input class="num" inputmode="decimal" data-rate="${esc(sv.id)}" value="${sv.rate ?? ''}" placeholder="0.0">%</label></div>
      ${kvRow('만기 원금', won(f.principal))}${kvRow('세전 이자', won(f.pre))}${kvRow('이자소득세 15.4%', '-' + won(f.tax))}
      ${kvRow('만기 예상 수령액', won(f.total), 'total')}
    </div>`;
  }).join('') : `<div class="empty">진행 중인 적금이 없어요.<br>⋯ → 설정하기에서 적금을 추가해 보세요.</div>`;

  const fs = list.map(sv => [sv, store.forecast(sv.id)]);
  const em = store.emergencyForecast(), bonus = store.balance('bonus') || store.s.bonusExpect || 0;
  const sum = fs.reduce((s, [, f]) => s + f.total, 0) + em + bonus;
  $('#forecast').innerHTML = fs.map(([sv, f]) => kvRow(`${esc(sv.name)} 만기금 (${md(f.maturity)})`, won(f.total))).join('') +
    kvRow('비상금 (신한 + 카카오)', won(em)) + kvRow(`보너스 정기예금${store.balance('bonus') ? '' : ' (예상)'}`, won(bonus)) +
    kvRow('합계', won(sum), 'total') + kvRow('청약 미납분 230만 넣은 뒤', won(sum - 2300000));
}

// ----- 설정하기 안의 목록 -----
function renderPlanLists() {
  const fx = [...store.s.fixed].sort((a, b) => a.day - b.day);
  $('#fixedList').innerHTML = fx.length ? `<div class="rows">${fx.map(f => `
    <button class="row" data-fixed="${esc(f.id)}"><div class="emoji">${emojiOf(f.cat)}</div>
      <div class="meta"><b>${esc(f.name)}</b><span>매달 ${f.day}일 · ${esc(accOf(f.acc).name)} · ${esc(f.sub ? `${f.cat}(${f.sub})` : f.cat)}</span></div>
      <div class="amt num out-c">-${won(f.amount)}</div></button>`).join('')}</div>`
    : '<div class="mini">아직 없어요. 월세·구독료처럼 매달 같은 날 같은 금액이 나가는 돈을 추가해 보세요.</div>';
  const sv = store.s.savings;
  $('#savingList').innerHTML = sv.length ? `<div class="rows">${sv.map(x => `
    <button class="row" data-saving="${esc(x.id)}"><div class="emoji">🐷</div>
      <div class="meta"><b>${esc(x.name)}${x.closed ? ' · 끝남' : ''}</b><span>${esc(accOf(x.from).name)}에서 매월 ${Number(x.start.slice(8))}일 · ${x.count}회</span></div>
      <div class="amt num">${won(x.amount)}</div></button>`).join('')}</div>`
    : '<div class="mini">아직 없어요.</div>';
}

// ----- 고정지출 추가·수정 -----
let fxEditing = null, fxAcc = 'nh', fxCat = '월세', fxSub = null;
function openFixed(id) {
  const f = store.s.fixed.find(x => x.id === id) || null;
  fxEditing = f;
  fxAcc = f ? f.acc : 'nh';
  fxCat = f ? f.cat : '월세';
  fxSub = f ? f.sub || null : null;
  $('#fixedTitle').textContent = f ? '📌 고정지출 고치기' : '📌 고정지출 추가';
  $('#fxName').value = f ? f.name : '';
  $('#fxDay').value = f ? f.day : '';
  $('#fxAmount').value = f ? f.amount.toLocaleString('ko-KR') : '';
  $('#fxDel').hidden = !f;
  closeSheets(); drawFixed(); openSheet($('#fixedSheet'));
}
function drawFixed() {
  $('#fxAccChips').innerHTML = bankAccounts().filter(a => a.id !== 'bonus').map(a => chip(a.id, a.name, fxAcc, 'fxacc')).join('');
  $('#fxCatChips').innerHTML = CATS.out.filter(c => c[0] !== '기타').map(([c, e]) => chip(c, `${e} ${c}`, fxCat, 'fxcat')).join('');
  const subs = SUBCATS[fxCat];
  if (subs && !subs.includes(fxSub)) fxSub = OPTIONAL_SUBS.includes(fxCat) ? null : subs[0];
  if (!subs) fxSub = null;
  $('#fxSubField').hidden = !subs;
  $('#fxSubChips').innerHTML = subs ? subs.map(s => chip(s, s, fxSub, 'fxsub')).join('') : '';
  // 새로 추가할 때: 이번 달 날짜가 지났으면 다음 달부터
  const day = parseInt($('#fxDay').value, 10), t = today();
  $('#fxHint').textContent = fxEditing ? '바꾼 금액·날짜는 다음 출금부터 적용돼요. 이미 나간 기록은 내역에서 고칠 수 있어요.'
    : day >= 1 && day <= 31 ? (clampDay(t.slice(0, 7) + '-01', day) >= t ? `이번 달 ${day}일부터` : `다음 달 ${day}일부터`) + ' 매달 자동으로 빠져나가요.' : '';
}
const chip = (v, label, on, attr) => `<button class="chip ${v === on ? 'on' : ''}" data-${attr}="${esc(v)}">${esc(label)}</button>`;
function saveFixed() {
  const name = $('#fxName').value.trim(), day = parseInt($('#fxDay').value, 10), amount = parseWon($('#fxAmount').value);
  if (!name) return toast('이름을 적어주세요');
  if (!(day >= 1 && day <= 31)) return toast('날짜는 1~31 사이로 적어주세요');
  if (!(amount > 0)) return toast('금액을 적어주세요');
  const data = { name, day, amount, acc: fxAcc, cat: fxCat, sub: fxSub };
  if (fxEditing) Object.assign(fxEditing, data);
  else store.s.fixed.push({ id: newId(), since: today(), ...data });
  const n = store.applyAuto(); persist();
  toast(fxEditing ? '고쳤어요' : `매달 ${day}일 ${won(amount)} 추가했어요${n ? ' (오늘 출금 반영)' : ''}`);
  openSettings();
}
function deleteFixed() {
  if (!confirm(`"${fxEditing.name}" 고정지출을 지울까요? 이미 나간 기록은 내역에 남아요.`)) return;
  store.s.fixed = store.s.fixed.filter(f => f !== fxEditing);
  persist(); toast('지웠어요'); openSettings();
}

// ----- 적금 추가·수정 -----
let svEditing = null, svFrom = 'kb', svMaturityTouched = false;
function openSaving(id) {
  const sv = store.s.savings.find(x => x.id === id) || null;
  svEditing = sv;
  svFrom = sv ? sv.from : 'kb';
  svMaturityTouched = !!sv;
  $('#svTitle').textContent = sv ? '🐷 적금 고치기' : '🐷 적금 추가';
  $('#svName').value = sv ? sv.name : '';
  $('#svAmount').value = sv ? sv.amount.toLocaleString('ko-KR') : '';
  $('#svCount').value = sv ? sv.count : 12;
  $('#svStart').value = sv ? sv.start : today();
  $('#svMaturity').value = sv ? sv.maturity || addMonths(sv.start, sv.count) : addMonths(today(), 12);
  $('#svPaid').value = sv ? sv.paidBefore : 0;
  $('#svRate').value = sv ? sv.rate ?? '' : '';
  // 이미 진행 중인 적금은 출금 통장·첫 납입일·이미 낸 회차를 고정 (바꾸면 지난 자동이체가 다시 생길 수 있음)
  $('#svStart').disabled = !!sv; $('#svPaid').disabled = !!sv;
  $('#svClose').hidden = !sv || sv.closed;
  closeSheets(); drawSaving(); openSheet($('#savingSheet'));
}
function drawSaving() {
  $('#svFromChips').innerHTML = bankAccounts().filter(a => !['cash', 'bonus'].includes(a.id)).map(a => chip(a.id, a.name, svFrom, 'svfrom')).join('');
  $('#svHint').textContent = svEditing ? '출금 통장·첫 납입일·이미 낸 회차는 바꿀 수 없어요. 금액을 바꾸면 다음 자동이체부터 적용돼요.'
    : '이미 낸 회차만큼은 지금 적금 잔액에 넣고, 나머지 회차는 날짜가 되면 출금 통장에서 자동이체돼요.';
}
function saveSaving() {
  const name = $('#svName').value.trim(), amount = parseWon($('#svAmount').value), count = parseInt($('#svCount').value, 10);
  const start = $('#svStart').value, maturity = $('#svMaturity').value || addMonths(start, count);
  const paid = parseInt($('#svPaid').value, 10) || 0, rate = parseFloat(String($('#svRate').value).replace(',', '.'));
  if (!name) return toast('이름을 적어주세요');
  if (!(amount > 0)) return toast('매달 금액을 적어주세요');
  if (!(count >= 1 && count <= 120)) return toast('회차는 1~120 사이로 적어주세요');
  if (!start) return toast('첫 납입일을 골라주세요');
  if (paid < 0 || paid > count) return toast('이미 낸 회차를 확인해 주세요');
  const data = { name, amount, count, maturity, rate: isNaN(rate) ? null : rate };
  if (svEditing) Object.assign(svEditing, data);
  else {
    const id = 'sv' + newId();
    store.s.savings.push({ id, from: svFrom, start, paidBefore: paid, color: SAVING_COLORS[store.s.savings.length % SAVING_COLORS.length], ...data });
    store.s.base[id] = paid * amount; // 이미 낸 회차는 적금 잔액에 들어 있는 상태
  }
  syncAccounts(store.s);
  const n = store.applyAuto(); persist();
  toast(svEditing ? '고쳤어요' : `${name} 추가했어요${n ? ` (지난 회차 ${n}건 자동이체 반영)` : ''}`);
  openSettings();
}
function closeSaving() {
  if (!confirm(`"${svEditing.name}"을(를) 끝낼까요? 앞으로 자동이체가 멈추고, 잔액이 0원이 되면 통장 목록에서 숨겨져요.`)) return;
  svEditing.closed = true;
  syncAccounts(store.s); persist(); toast('적금을 끝냈어요'); openSettings();
}

// ----- 이벤트 -----
const onPick = (sel, attr, fn, redraw) => { $(sel).onclick = e => { const b = e.target.closest(`[data-${attr}]`); if (b) { fn(b.dataset[attr]); redraw(); } }; };
$('#fixedList').onclick = e => { const b = e.target.closest('[data-fixed]'); if (b) openFixed(b.dataset.fixed); };
$('#savingList').onclick = e => { const b = e.target.closest('[data-saving]'); if (b) openSaving(b.dataset.saving); };
$('#fixedAddBtn').onclick = () => openFixed(null);
$('#savingAddBtn').onclick = () => openSaving(null);
onPick('#fxAccChips', 'fxacc', v => { fxAcc = v; }, drawFixed);
onPick('#fxCatChips', 'fxcat', v => { fxCat = v; }, drawFixed);
onPick('#fxSubChips', 'fxsub', v => { fxSub = fxSub === v && OPTIONAL_SUBS.includes(fxCat) ? null : v; }, drawFixed);
onPick('#svFromChips', 'svfrom', v => { if (!svEditing) svFrom = v; }, drawSaving);
$('#fxAmount').oninput = e => fmtInput(e.target);
$('#fxDay').oninput = drawFixed;
$('#fxSave').onclick = saveFixed;
$('#fxDel').onclick = deleteFixed;
$('#svAmount').oninput = e => fmtInput(e.target);
['#svStart', '#svCount'].forEach(s => { $(s).oninput = () => {
  const start = $('#svStart').value, count = parseInt($('#svCount').value, 10);
  if (!svMaturityTouched && start && count > 0) $('#svMaturity').value = addMonths(start, count);
}; });
$('#svMaturity').oninput = () => { svMaturityTouched = true; };
$('#svSave').onclick = saveSaving;
$('#svClose').onclick = closeSaving;
$('#savingCards').addEventListener('change', e => {
  const id = e.target.dataset.rate; if (!id) return;
  const v = parseFloat(e.target.value.replace(',', '.'));
  savingOf(id).rate = isNaN(v) ? null : v;
  persist(); render();
});
