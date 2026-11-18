// ===== 설정하기: 탭 전환 · 통장 순서(드래그) · 분류 편집 =====
// settings.js 다음에 로드됨: store, $, esc, toast, persist, render, openSheet, closeSheets, openSettings 사용

// ----- 탭 -----
let setTab = 'saving';
function showSetTab(name) {
  setTab = name;
  document.querySelectorAll('#setTabs [data-set]').forEach(b => b.classList.toggle('on', b.dataset.set === name));
  document.querySelectorAll('#settingsSheet .set-pane').forEach(p => { p.hidden = p.dataset.pane !== name; });
}
// openSettings(app.js)에서 부름: 목록을 다시 그리고 마지막으로 보던 탭 열기
function renderPrefs() {
  renderAccOrder();
  renderCats();
  showSetTab(setTab);
}

// ----- 끌어서 순서 바꾸기 (아이폰 터치 포함: ☰ 손잡이를 잡고 위아래로) -----
function makeSortable(box, onDone) {
  box.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.drag');
    if (!handle) return;
    const item = handle.closest('[data-sort]');
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    item.classList.add('dragging');
    const move = ev => {
      const others = [...box.querySelectorAll('[data-sort]')].filter(x => x !== item);
      const after = others.find(x => { const r = x.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
      box.insertBefore(item, after || null);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      item.classList.remove('dragging');
      onDone([...box.querySelectorAll('[data-sort]')].map(x => x.dataset.sort));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}

// ----- 통장 순서 -----
function renderAccOrder() {
  $('#accOrderList').innerHTML = ACCOUNTS.map(a => `
    <div class="row" data-sort="${esc(a.id)}">
      <div class="dot" style="background:${a.color}">${esc(a.dot || a.name.slice(0, 2))}</div>
      <div class="meta"><b>${esc(a.full)}</b><span>${esc(a.role)}</span></div>
      <span class="drag" aria-label="끌어서 순서 바꾸기">☰</span>
    </div>`).join('');
}
makeSortable($('#accOrderList'), ids => {
  store.s.accOrder = ids;
  syncAccounts(store.s); persist(); render();
  toast('홈 화면 통장 순서를 바꿨어요');
});

// ----- 분류 목록 -----
let catSign = -1;
const catKey = () => (catSign < 0 ? 'out' : 'in');
function renderCats() {
  document.querySelectorAll('#catSeg button').forEach(b => b.classList.toggle('on', +b.dataset.catsign === catSign));
  $('#catList').innerHTML = store.s.cats[catKey()].map(([name, emoji]) => {
    const subs = store.s.subcats[name];
    return `<div class="row" data-sort="${esc(name)}" data-cat="${esc(name)}">
      <div class="emoji">${esc(emoji)}</div>
      <div class="meta"><b>${esc(name)}</b><span>${subs && subs.length ? esc(subs.join(' · ')) : '세부 항목 없음'}</span></div>
      <span class="drag" aria-label="끌어서 순서 바꾸기">☰</span>
    </div>`;
  }).join('');
}
makeSortable($('#catList'), names => {
  const list = store.s.cats[catKey()];
  store.s.cats[catKey()] = names.map(n => list.find(c => c[0] === n));
  syncCats(store.s); persist();
  toast('분류 순서를 바꿨어요');
});

// ----- 분류 추가·수정 -----
let catEditing = null; // [이름, 이모지] 또는 null(새 분류)
function openCat(name) {
  catEditing = name ? store.s.cats[catKey()].find(c => c[0] === name) : null;
  $('#catTitle').textContent = catEditing ? '🏷️ 분류 고치기' : `🏷️ ${catSign < 0 ? '나간 돈' : '들어온 돈'} 분류 추가`;
  $('#catName').value = catEditing ? catEditing[0] : '';
  $('#catEmoji').value = catEditing ? catEditing[1] : '';
  $('#catSubs').value = catEditing ? (store.s.subcats[catEditing[0]] || []).join(', ') : '';
  // '기타'는 이름을 직접 쓰는 칸이라 지우거나 이름을 바꿀 수 없음
  const locked = catEditing && catEditing[0] === '기타';
  $('#catDel').hidden = !catEditing || locked;
  $('#catName').disabled = locked;
  $('#catHint').textContent = locked ? '"기타"는 기록할 때 이름을 직접 쓰는 칸이라 이름을 바꾸거나 지울 수 없어요.'
    : catEditing ? '이름을 바꾸면 이미 적은 기록과 고정지출의 분류 이름도 함께 바뀌어요.' : '';
  closeSheets(); openSheet($('#catSheet'));
}
function saveCat() {
  const name = $('#catName').value.trim(), emoji = $('#catEmoji').value.trim() || '🏷️';
  const subs = $('#catSubs').value.split(',').map(x => x.trim()).filter(Boolean);
  if (!name) return toast('이름을 적어주세요');
  const list = store.s.cats[catKey()];
  if (list.some(c => c[0] === name && c !== catEditing)) return toast('같은 이름의 분류가 이미 있어요');
  if (catEditing) {
    const old = catEditing[0];
    if (old !== name) renameCat(old, name);
    catEditing[0] = name; catEditing[1] = emoji;
  } else {
    // 새 분류는 '기타' 바로 앞에
    const at = list.findIndex(c => c[0] === '기타');
    list.splice(at < 0 ? list.length : at, 0, [name, emoji]);
  }
  if (subs.length) store.s.subcats[name] = subs; else delete store.s.subcats[name];
  syncCats(store.s); persist();
  toast(catEditing ? '고쳤어요' : `${emoji} ${name} 분류를 추가했어요`);
  openSettings();
}
// 이름 바꾸기: 기록 · 고정지출 · 세부 항목 키까지 함께
function renameCat(old, name) {
  for (const t of store.s.tx) if (t.cat === old) t.cat = name;
  for (const f of store.s.fixed) if (f.cat === old) f.cat = name;
  if (store.s.subcats[old]) { store.s.subcats[name] = store.s.subcats[old]; delete store.s.subcats[old]; }
}
function deleteCat() {
  const name = catEditing[0];
  if (!confirm(`"${name}" 분류를 지울까요? 이미 적은 기록은 이름 그대로 남아요.`)) return;
  store.s.cats[catKey()] = store.s.cats[catKey()].filter(c => c !== catEditing);
  delete store.s.subcats[name];
  syncCats(store.s); persist(); toast('지웠어요'); openSettings();
}

// ----- 이벤트 -----
$('#setTabs').onclick = e => { const b = e.target.closest('[data-set]'); if (b) showSetTab(b.dataset.set); };
$('#catSeg').onclick = e => { const b = e.target.closest('[data-catsign]'); if (b) { catSign = +b.dataset.catsign; renderCats(); } };
$('#catList').addEventListener('click', e => {
  if (e.target.closest('.drag')) return;
  const r = e.target.closest('[data-cat]'); if (r) openCat(r.dataset.cat);
});
$('#catAddBtn').onclick = () => openCat(null);
$('#catSave').onclick = saveCat;
$('#catDel').onclick = deleteCat;
