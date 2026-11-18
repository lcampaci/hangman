/* Hangman (Symantec Game Pack, 1991, Charles Timmerman) — recriação para navegador.
   Geometria das letras, forca, boneco e papel extraída do HANGMAN.EXE (NE/Win16). */
(function () {
'use strict';
const W = 2400, H = 1750;
const GEO = window.GEO, CATS = window.CATS;
const WIN_MSGS = ['CONGRATS!','GOOD JOB!','WAY TO GO!','YOU WIN!','GOOD WORK!','OUTSTANDING!','EXCELLENT!','NICE ONE!','WELL DONE!','TAKE A BOW!'];
const LOSE_MSGS = ['YOU LOSE','TRY AGAIN','NICE TRY','GOTCHA','I WIN'];
const PEN = {2: 7, 3: 10};

/* ---------- configuração ---------- */
const DEF = { mode: 'single', cats: CATS.filter(c => !c.orig).map(c => c.id), palette: true, color: true };
let cfg = Object.assign({}, DEF);
try { Object.assign(cfg, JSON.parse(localStorage.getItem('hangman.cfg') || '{}')); } catch (e) {}
cfg.cats = (cfg.cats || []).filter(id => CATS.some(c => c.id === id));
if (!cfg.cats.length) cfg.cats = DEF.cats.slice();
const save = () => { try { localStorage.setItem('hangman.cfg', JSON.stringify(cfg)); } catch (e) {} };

/* ---------- estado ---------- */
let S = null, timer = null, recent = [];
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const bg = { color: new Image(), mono: new Image() };
bg.color.src = 'assets/page-color.png'; bg.mono.src = 'assets/page-mono.png';
bg.color.onload = bg.mono.onload = () => draw();

const maxMiss = () => cfg.mode === 'single' ? 6 : 10;
const PARTS_ORDER = { single: [0,1,2,3,4,5], multi: [0,1,2,3,4,5,8,9,6,7] };

function pickPuzzle() {
  const pool = [];
  CATS.forEach(c => { if (cfg.cats.includes(c.id)) c.words.forEach(w => pool.push(w)); });
  let w, tries = 0;
  do { w = pool[Math.floor(Math.random() * pool.length)]; tries++; }
  while (recent.includes(w.join('|')) && tries < 30 && pool.length > 40);
  recent.push(w.join('|')); if (recent.length > 40) recent.shift();
  return w;
}
function rowSlots(n) { return n === 1 ? [1] : n === 2 ? [1, 2] : [0, 1, 2]; }

function newPuzzle(keepGame) {
  clearTimeout(timer);
  const rows = pickPuzzle();
  const letters = new Set(rows.join('').replace(/[^A-Z]/g, ''));
  S.rows = rows; S.letters = letters; S.guessed = new Set(); S.over = false; S.won = false; S.msg = null; S.reveal = false;
  if (!keepGame) { S.misses = []; S.correct = 0; }
  draw();
}
function newGame() {
  S = { rows: [], letters: new Set(), guessed: new Set(), misses: [], correct: 0, over: false, won: false, msg: null, reveal: false };
  newPuzzle(false);
  syncMenu();
}

/* ---------- jogo ---------- */
function guess(ch) {
  if (!S || S.over || S.guessed.has(ch)) return;
  S.guessed.add(ch);
  if (S.letters.has(ch)) {
    if ([...S.letters].every(l => S.guessed.has(l))) {
      S.won = true;
      S.msg = WIN_MSGS[Math.floor(Math.random() * WIN_MSGS.length)];
      if (cfg.mode === 'multi') {
        S.correct++; S.over = true;
        draw();
        timer = setTimeout(() => newPuzzle(true), 1400);
        return;
      }
      S.over = true;
    }
  } else {
    S.misses.push(ch);
    if (S.misses.length >= maxMiss()) {
      S.over = true; S.reveal = true;
      S.msg = LOSE_MSGS[Math.floor(Math.random() * LOSE_MSGS.length)];
      if (cfg.mode === 'multi') setTimeout(() => dialog('Hangman', 'Fim de jogo!\n\nSua pontuação: ' + S.correct + (S.correct === 1 ? ' acerto.' : ' acertos.'), [{ label: 'OK', def: true }]), 700);
    }
  }
  draw();
}

/* ---------- desenho ---------- */
const BASE = (j, n) => [605 + 80 * j + 95 * n, 498 + 53 * j - 30 * n];
function glyph(ch, ax, ay, color, sc) {
  const g = GEO.glyphs[ch]; if (!g) return;
  sc = sc || 1;
  const ox = GEO.anchor[0], oy = GEO.anchor[1];
  ctx.strokeStyle = color || '#111'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  g.forEach(s => {
    ctx.lineWidth = PEN[s[0]] * (sc < 1 ? 0.8 : 1);
    ctx.beginPath(); ctx.moveTo(ax + sc * (s[1] - ox), ay + sc * (s[2] - oy)); ctx.lineTo(ax + sc * (s[3] - ox), ay + sc * (s[4] - oy)); ctx.stroke();
  });
}
function text(str, startSlot, j, color) {
  for (let i = 0; i < str.length; i++) { const c = str[i]; if (c === ' ') continue; const p = BASE(j, startSlot + i); glyph(c, p[0], p[1], color); }
}
function strokes(list, color) {
  ctx.strokeStyle = color || '#111'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  list.forEach(s => { ctx.lineWidth = PEN[s[0]]; ctx.beginPath(); ctx.moveTo(s[1], s[2]); ctx.lineTo(s[3], s[4]); ctx.stroke(); });
}
const PAL_SC = 0.65;
function paletteLayout() {
  const rows = ['ABCDEFGHIJKLM'.split(''), 'NOPQRSTUVWXYZ'.split('')];
  const js = [-2, -1], out = [];
  rows.forEach((r, ri) => {
    const j = js[ri], bx = 605 + 80 * j, by = 498 + 53 * j;
    r.forEach((ch, i) => { const ax = 200 + 60 * i, ay = by - (ax - bx) / 3; out.push({ ch, ax, ay }); });
  });
  return out;
}
const PAL = paletteLayout();

function draw() {
  if (!S) return;
  const k = cv.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const img = cfg.color ? bg.color : bg.mono;
  if (img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, W, H);

  // forca e boneco
  strokes(GEO.gallows);
  const order = PARTS_ORDER[cfg.mode === 'single' ? 'single' : 'multi'];
  const n = S.misses.length;
  for (let i = 0; i < n && i < order.length; i++) strokes(GEO.parts[order[i]]);
  if (S.reveal && cfg.mode === 'single') { strokes(GEO.parts[6]); strokes(GEO.parts[7]); }

  // puzzle: marcas em branco + letras
  const slots = rowSlots(S.rows.length);
  S.rows.forEach((row, r) => {
    const j = 2 + 2 * slots[r], n0 = -1 + Math.floor((11 - row.length) / 2);
    for (let i = 0; i < row.length; i++) {
      const c = row[i]; if (c === ' ') continue;
      const p = BASE(j, n0 + i);

      // Pequeno espaço extra entre as letras da palavra, para não parecerem coladas.
      // p[0] += i * 0;
      ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p[0] - 8, p[1] + 12); ctx.lineTo(p[0] + 78, p[1] - 16); ctx.stroke();
      if (S.guessed.has(c)) glyph(c, p[0], p[1], '#111');
      else if (S.reveal) glyph(c, p[0], p[1], '#a01010');
    }
  });

  // linha do topo: mensagem ou letras erradas
  if (S.msg) text(S.msg, -2 + Math.floor((12 - S.msg.length) / 2), 0, '#111');
  else S.misses.forEach((m, i) => { const p = BASE(0, i); glyph(m, p[0], p[1], '#111'); });

  // paleta
  if (cfg.palette) PAL.forEach(p => glyph(p.ch, p.ax, p.ay, S.guessed.has(p.ch) ? '#c4c4c4' : '#111', PAL_SC));

  // acertos (somente Puzzles Múltiplos)
  if (cfg.mode === 'multi') {
    const lab = 'CORRECT:';
    for (let i = 0; i < lab.length; i++) { glyph(lab[i], 1650 + 90 * i, 842 - 30 * i, '#111'); }
    const groups = [[1730,901],[1880,851],[2030,801],[2180,751],[1810,954],[1960,904],[2110,854],[2260,804]];
    const total = S.correct;
    ctx.strokeStyle = '#111'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (let g = 0; g < 8; g++) {
      const cnt = Math.min(5, Math.max(0, total - g * 5)); if (!cnt) continue;
      const [gx, gy] = groups[g];
      for (let m = 0; m < Math.min(4, cnt); m++) { const x = gx + 30 * m, y = gy - 10 * m; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12, y - 62); ctx.stroke(); }
      if (cnt === 5) { ctx.beginPath(); ctx.moveTo(gx - 14, gy - 10); ctx.lineTo(gx + 112, gy - 62); ctx.stroke(); }
    }
  }
}

/* ---------- entrada ---------- */
function toLogical(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
cv.addEventListener('pointerdown', e => {
  closeMenus();
  if (!S) return;
  if (S.over && cfg.mode === 'single') { newGame(); return; }
  if (!cfg.palette || S.over) return;
  const [x, y] = toLogical(e);
  let best = null, bd = 1e9;
  PAL.forEach(p => { const d = Math.hypot(x - (p.ax + 13), y - (p.ay - 29)); if (d < bd) { bd = d; best = p; } });
  if (best && bd < 32) guess(best.ch);
});
document.addEventListener('keydown', e => {
  if (!document.getElementById('overlay').hidden) { if (e.key === 'Escape') hideDialog(); return; }
  if (e.key === 'Escape') { closeMenus(); return; }
  if (e.key === 'F2') { e.preventDefault(); newGame(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter' && S && S.over && cfg.mode === 'single') { newGame(); return; }
  if (e.key.length === 1) {
    const ch = e.key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (/^[A-Z]$/.test(ch)) { if (S && S.over && cfg.mode === 'single') return; guess(ch); }
  }
});

/* ---------- menus ---------- */
const menus = [...document.querySelectorAll('.menu')];
function closeMenus() { menus.forEach(m => m.classList.remove('open')); }
menus.forEach(m => {
  m.firstElementChild.addEventListener('click', e => { e.stopPropagation(); const was = m.classList.contains('open'); closeMenus(); if (!was) m.classList.add('open'); });
  m.firstElementChild.addEventListener('mouseenter', () => { if (menus.some(x => x.classList.contains('open'))) { closeMenus(); m.classList.add('open'); } });
});
document.addEventListener('click', e => { if (!e.target.closest('.menu')) closeMenus(); });
function syncMenu() {
  const set = (id, on) => document.getElementById(id).classList.toggle('on', !!on);
  set('mi-paleta', cfg.palette); set('mi-cor', cfg.color); set('mi-single', cfg.mode === 'single'); set('mi-multi', cfg.mode === 'multi');
  document.getElementById('title').textContent = cfg.mode === 'single' ? 'Hangman — Puzzle Único' : 'Hangman — Puzzles Múltiplos';
}
document.querySelectorAll('.drop button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); closeMenus(); command(b.dataset.cmd); }));

function command(c) {
  switch (c) {
    case 'novo': newGame(); break;
    case 'categorias': catDialog(); break;
    case 'paleta': cfg.palette = !cfg.palette; save(); syncMenu(); draw(); break;
    case 'cor': cfg.color = !cfg.color; save(); syncMenu(); draw(); break;
    case 'single': case 'multi': { const m = c; if (cfg.mode !== m) { cfg.mode = m; save(); newGame(); } break; }
    case 'ajuda1': dialog('Hangman — Puzzle Único', HELP1, [{ label: 'OK', def: true }]); break;
    case 'ajuda2': dialog('Hangman — Puzzles Múltiplos', HELP2, [{ label: 'OK', def: true }]); break;
    case 'quiz': quiz(); break;
    case 'sobre': dialog('Sobre o Hangman', ABOUT, [{ label: 'OK', def: true }]); break;
    case 'sair': dialog('Sair', 'Deseja sair do Hangman?', [{ label: 'Sim', fn: () => { window.close(); document.body.innerHTML = '<p style="color:#fff;font:16px Arial;padding:20px">Hangman encerrado. Recarregue a página para jogar de novo.</p>'; } }, { label: 'Não', def: true }]); break;
  }
}

/* ---------- diálogos ---------- */
const ov = document.getElementById('overlay');
function hideDialog() { ov.hidden = true; canvasFocus(); }
function canvasFocus() { try { cv.focus({ preventScroll: true }); } catch (e) {} }
function dialog(title, body, btns, html) {
  document.getElementById('dlg-title').textContent = title;
  const b = document.getElementById('dlg-body');
  if (html) b.innerHTML = body; else b.textContent = body;
  const bt = document.getElementById('dlg-btns'); bt.innerHTML = '';
  (btns || []).forEach(x => {
    const el = document.createElement('button'); el.textContent = x.label; if (x.def) el.className = 'def';
    el.onclick = () => { if (x.fn && x.fn() === false) return; hideDialog(); };
    bt.appendChild(el);
  });
  ov.hidden = false;
  const d = bt.querySelector('.def') || bt.querySelector('button'); if (d) d.focus();
}
function catDialog() {
  const pt = CATS.filter(c => !c.orig), en = CATS.filter(c => c.orig);
  const row = c => `<label><input type="checkbox" value="${c.id}" ${cfg.cats.includes(c.id) ? 'checked' : ''}> ${c.name} <small>(${c.words.length})</small></label>`;
  const html = `<div class="cats"><h4>Palavras em português (pt-BR)</h4>${pt.map(row).join('')}<h4>Palavras originais do jogo (em inglês)</h4>${en.map(row).join('')}</div>
  <div class="catbtns"><button type="button" id="cat-all">Marcar tudo</button><button type="button" id="cat-pt">Só pt-BR</button><button type="button" id="cat-none">Limpar</button></div>`;
  dialog('Categorias', html, [
    { label: 'OK', def: true, fn: () => {
      const ids = [...document.querySelectorAll('.cats input:checked')].map(i => i.value);
      if (!ids.length) { alert('Escolha pelo menos uma categoria.'); return false; }
      cfg.cats = ids; save(); newGame();
    } },
    { label: 'Cancelar' }
  ], true);
  const boxes = () => [...document.querySelectorAll('.cats input')];
  document.getElementById('cat-all').onclick = () => boxes().forEach(i => i.checked = true);
  document.getElementById('cat-none').onclick = () => boxes().forEach(i => i.checked = false);
  document.getElementById('cat-pt').onclick = () => boxes().forEach(i => i.checked = !CATS.find(c => c.id === i.value).orig);
}
function quiz() {
  const html = `<div class="quiz"><p><b>Entre no Sorteio do Symantec Game Pack hoje!</b></p>
  <p>Para participar, responda corretamente à pergunta abaixo no seu Formulário Oficial de Inscrição.</p>
  <p>Quantas letras você pode errar antes de o boneco ser enforcado no Hangman de Puzzles Múltiplos?</p>
  <div class="opts"><button class="opt" data-a="0">A) 10</button><button class="opt" data-a="1">B) 6</button><button class="opt" data-a="2">C) 26</button><button class="opt" data-a="3">D) 8</button></div>
  <p id="qres" style="margin-top:10px"><small>(Promoção de 1991 — hoje é só diversão.)</small></p></div>`;
  dialog('Quiz Pop-up', html, [{ label: 'Fechar', def: true }], true);
  document.querySelectorAll('.quiz .opt').forEach(o => o.onclick = () => {
    const ok = o.dataset.a === '0';
    o.classList.add(ok ? 'right' : 'wrong');
    document.getElementById('qres').textContent = ok ? 'Correto! São 10 letras erradas no Puzzles Múltiplos.' : 'Não foi dessa vez. Tente outra opção!';
  });
}

const HELP_COMMON = 'Digite as letras no teclado ou clique nelas na paleta de letras. As letras que combinam são escritas em todas as marcas em branco correspondentes. Se a letra não combinar com nenhuma marca, uma parte do boneco é desenhada e a letra é escrita no topo da página.';
const HELP1 = 'Bem-vindo ao Hangman de Puzzle Único!\n\nO objetivo é preencher corretamente todas as marcas em branco antes que o boneco seja enforcado.\n\n' + HELP_COMMON + '\n\nApós seis letras erradas, o boneco fica completo e é considerado enforcado. Você perde e as marcas em branco restantes são preenchidas.\n\nSe você preencher todas as marcas em branco antes de o boneco ficar completo, você ganha e o boneco é resgatado.\n\nAs palavras são sorteadas das categorias que você ativar.';
const HELP2 = 'Bem-vindo ao Hangman de Puzzles Múltiplos!\n\nO objetivo é acertar o maior número possível de palavras antes que o boneco seja enforcado.\n\n' + HELP_COMMON + '\n\nQuando você preenche todas as marcas em branco, ganha uma marca de acerto e uma nova palavra (ou grupo de palavras) é sorteada.\n\nApós um total de dez letras erradas, o boneco fica completo e é considerado enforcado. O jogo termina e sua pontuação é o número de marcas de acerto que você recebeu.\n\nAs palavras são sorteadas das categorias que você ativar.';
const ABOUT = '          SYMANTEC GAME PACK\n\n                       Hangman\n                     Versão 1.00\n\nCopyright © 1991 Charles Timmerman\n\nRecriação para navegador feita a partir do HANGMAN.EXE original (Windows 3.x).';

/* ---------- ajuste de tamanho ---------- */
function resize() {
  const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(320, Math.round(r.width * dpr));
  if (cv.width !== w) { cv.width = w; cv.height = Math.round(w * H / W); }
  draw();
}
window.addEventListener('resize', resize);

/* ---------- início ---------- */
syncMenu(); newGame(); resize(); canvasFocus();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
