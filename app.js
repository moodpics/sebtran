/* ==========================================================================
   Seb Trân — portfolio interactions
   ========================================================================== */
(() => {
  "use strict";

  /* a reload always lands on the clean header film (no restored scroll position) */
  try { history.scrollRestoration = "manual"; } catch (e) {}
  /* on touch screens we land 1px down: mobile Safari tends to keep its bars hidden when the page is not at scrollY 0 */
  const landY = matchMedia("(pointer: coarse)").matches ? 1 : 0;
  scrollTo(0, landY);
  addEventListener("pageshow", () => { scrollTo(0, landY); });
  addEventListener("load", () => { scrollTo(0, landY); setTimeout(() => scrollTo(0, landY), 60); });

  /* ---------- Config: edit these ---------- */
  const CONFIG = {
    email: "sebastientrandop@gmail.com",
    defaultMode: "cinematography",
    clients: ["Cartier", "Yves Saint Laurent", "Prada", "Miu Miu", "Lancôme", "Chanel", "Balmain", "L'Oréal Paris",
      "Armani Beauty", "Maison Margiela", "Off-White", "Chaumet", "Kérastase", "AMI Paris", "Salomon",
      "Clarins", "Helena Rubinstein", "Paco Rabanne", "KITH", "Nowness", "La Roche-Posay", "Biotherm"],
    modes: {
      selection: {
        role: "Your selection",
        workTitle: "Selected Films",
        hud: "SELECT · ♥ · 25 FPS",
        about: "A personal *selection* of films by Seb Trân — cinematography and direction. Use Share to send it, or come back to it later."
      },
      cinematography: {
        role: "Cinematographer",
        workTitle: "Selected Cinematography",
        hud: "ISO 800 · 3200K · T1.4 · 25 FPS",
        about: "More than ten years behind the camera, lighting *luxury*, *beauty* and *fashion* for houses like Cartier, Yves Saint Laurent, Chanel and Lancôme — and music videos and short films when the story calls for it. Based in Paris, I work closely with directors to build images where light feels like *skin* and every frame holds a breath longer than expected."
      },
      direction: {
        role: "Director / DP",
        workTitle: "Directed Films",
        hud: "SC 01 · TK 03 · REC · 25 FPS",
        about: "As a director / DP I start from the *light* and build outward — fragrance, beauty and fashion films for Prada, Miu Miu, Armani Beauty and L'Oréal Paris, shot with the eye of a cinematographer and cut with an obsession for *texture*, *rhythm* and *intimacy*. Small crews, precise images, faces that stay with you."
      }
    }
  };

  /* ---------- Helpers ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const thumb = (f, size = "1280x720") => f.thumb ? `${f.thumb}_${size}` : `https://vumbnail.com/${f.id}.jpg`;
  // Real picture ratio of a film (width / height). Only films that are NOT 16:9 carry a "ratio" in films.js.
  const ratioOf = f => f.ratio || 16 / 9;
  // Ratio of its card in the feed: the real one, kept within sensible limits (very tall verticals are cropped a little)
  const frameRatio = f => clamp(ratioOf(f), 0.5, 2.6);
  // Films without a stored thumbnail get one from Vimeo's oEmbed (fast, cached by the browser)
  const resolveThumbs = () => Promise.all(Object.values(window.FILMS).flat().filter(f => !f.thumb).map(f =>
    fetch(`https://vimeo.com/api/oembed.json?width=1920&url=${encodeURIComponent(`https://vimeo.com/${f.id}${f.h ? "/" + f.h : ""}`)}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && j.thumbnail_url) f.thumb = j.thumbnail_url.split("?")[0].replace(/_\d+(x\d+)?(\.\w+)?$/, ""); })
      .catch(() => {})));
  const vimeo = (f, extra = {}) => {
    const p = new URLSearchParams({ dnt: 1, ...extra });
    if (f.h) p.set("h", f.h);
    return `https://player.vimeo.com/video/${f.id}?${p}`;
  };
  const bgParams = q => ({ background: 1, autoplay: 1, muted: 1, loop: 1, autopause: 0, ...(q ? { quality: q } : {}) });
  const makeIframe = (src, title = "") => {
    const i = document.createElement("iframe");
    i.src = src; i.title = title; i.allow = "autoplay; fullscreen; picture-in-picture";
    i.setAttribute("frameborder", "0");
    return i;
  };
  const onPlay = (iframe, cb) => {
    if (window.Vimeo && Vimeo.Player) {
      try { const p = new Vimeo.Player(iframe); p.on("play", cb); return p; } catch (e) { /* fall through */ }
    }
    iframe.addEventListener("load", () => setTimeout(cb, 600));
  };
  // Films with a "loopEnd" (seconds) loop before their end card / packshot in silent previews
  const trimLoop = (iframe, f) => {
    if (!f.loopEnd || !(window.Vimeo && Vimeo.Player)) return;
    try {
      const p = new Vimeo.Player(iframe);
      p.on("timeupdate", d => { if (d.seconds >= f.loopEnd) p.setCurrentTime(f.loopStart || 0).catch(() => {}); });
    } catch (e) { /* ignore */ }
  };
  const fmtDur = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  const credits = f => [f.director && `Dir. ${f.director}`, f.production && `Prod. ${f.production}`].filter(Boolean).join(" — ");

  /* ---------- Selections (several, stored in this browser) ---------- */
  const STORE_KEY = "sebtran-selections";
  let lastMode = null;
  let sels = [], activeSel = null; // [{ id, name, ids[], shared, key }]
  const uid = () => Math.random().toString(36).slice(2, 9);
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (raw && Array.isArray(raw.items)) {
      sels = raw.items.filter(x => x && Array.isArray(x.ids)).map(x => ({ id: String(x.id || uid()), name: String(x.name || ""), ids: x.ids.filter(i => typeof i === "string"), shared: !!x.shared, key: x.key || "", url: x.url || "" }));
      activeSel = raw.active;
    } else { // migrate the old single selection
      const old = JSON.parse(localStorage.getItem("sebtran-selection") || "[]").filter(i => typeof i === "string");
      if (old.length) sels = [{ id: uid(), name: localStorage.getItem("sebtran-selection-name") || "My films", ids: old, shared: false, key: "" }];
    }
  } catch (e) { sels = []; }
  if (!sels.some(x => x.id === activeSel)) activeSel = sels.length ? sels[sels.length - 1].id : null;
  const saveSels = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 2, active: activeSel, items: sels })); } catch (e) { /* storage off */ } };
  const cur = () => sels.find(x => x.id === activeSel) || null;
  const own = () => sels.filter(x => !x.shared);
  const favCount = () => new Set(own().flatMap(x => x.ids)).size;
  const isFav = id => own().some(x => x.ids.includes(id));
  const parseSel = str => { const [ids = "", nm = ""] = str.split("~"); let name = ""; try { name = decodeURIComponent(nm); } catch (e) { name = nm; } return { ids: ids.split(".").filter(Boolean), name }; };

  /* ---------- State ---------- */
  const FILMS = window.FILMS || { cinematography: [], direction: [] };
  const state = { mode: null, filter: "All", view: "grid", list: [] };

  /* ==========================================================================
     Cursor
     ========================================================================== */
  const cursor = $(".cursor"), ring = $(".cursor__ring"), dot = $(".cursor__dot"), label = $(".cursor__label");
  const mouse = { x: innerWidth / 2, y: innerHeight / 2 }, ringPos = { ...mouse };
  addEventListener("mousemove", e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  function setCursor(type, text = "") {
    cursor.classList.toggle("is-play", type === "play");
    cursor.classList.toggle("is-link", type === "link");
    label.textContent = text;
  }
  document.addEventListener("mouseover", e => {
    const t = e.target.closest("[data-cursor], a, button");
    if (!t) return setCursor(null);
    if (t.dataset.cursor === "play") setCursor("play", t.dataset.cursorLabel || "Play");
    else setCursor("link");
  });
  document.addEventListener("mouseleave", () => cursor.classList.add("is-hidden"));
  document.addEventListener("mouseenter", () => cursor.classList.remove("is-hidden"));

  /* ==========================================================================
     Timecode HUD
     ========================================================================== */
  const tcEl = $(".hud__tc"), t0 = performance.now();
  function tickTC(now) {
    const fr = Math.floor((now - t0) / 40);
    const f = fr % 25, s = Math.floor(fr / 25) % 60, m = Math.floor(fr / 1500) % 60, h = Math.floor(fr / 90000);
    tcEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
  }

  /* ==========================================================================
     Letterbox — 2.39:1 frame on the hero, opens up as you scroll
     ========================================================================== */
  const root = document.documentElement;
  function letterbox() {
    const full = innerWidth < innerHeight ? 0 : Math.max(0, (innerHeight - innerWidth / 2.39) / 2);
    const p = clamp(scrollY / (innerHeight * .6), 0, 1);
    root.style.setProperty("--lb", `${(full * (1 - p)).toFixed(1)}px`);
  }

  /* ==========================================================================
     Scramble text
     ========================================================================== */
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+/<>";
  function scramble(el, text) {
    if (reduced) { el.textContent = text; return; }
    const from = el.textContent, len = Math.max(from.length, text.length);
    const q = [...Array(len)].map((_, i) => ({ from: from[i] || "", to: text[i] || "", start: Math.floor(Math.random() * 14), end: 14 + Math.floor(Math.random() * 22) }));
    let frame = 0; cancelAnimationFrame(el._raf);
    const run = () => {
      let out = "", done = 0;
      for (const c of q) {
        if (frame >= c.end) { done++; out += c.to; }
        else if (frame >= c.start) out += `<span class="ch">${glyphs[Math.floor(Math.random() * glyphs.length)]}</span>`;
        else out += c.from;
      }
      el.innerHTML = out;
      if (done < q.length) { frame++; el._raf = requestAnimationFrame(run); }
    };
    run();
  }

  /* ==========================================================================
     Hero
     ========================================================================== */
  const heroPoster = $(".hero__poster"), heroVideo = $(".hero__video"), heroTitle = $("[data-hero-title]");
  let heroFilm = null, bufT;
  function setHero(f) {
    heroFilm = f;
    const playBtn = $("[data-hero-play]"), pico = playBtn.querySelector(".hero__play-ico");
    const hg = n => { hp = Math.max(hp, n); pico.style.setProperty("--hp", hp); };
    let hp = 0; pico.style.transition = "none"; pico.style.setProperty("--hp", 0); void pico.offsetWidth; pico.style.transition = "";
    const myFilm = f, done = () => { hg(100); clearTimeout(bufT); setTimeout(() => { if (heroFilm === myFilm) playBtn.classList.remove("is-buffering"); }, 380); };
    playBtn.classList.add("is-buffering"); setTimeout(() => hg(8), 30);
    clearTimeout(bufT); bufT = setTimeout(() => playBtn.classList.remove("is-buffering"), 15000);
    heroPoster.src = thumb(f, "1920x1080");
    heroTitle.textContent = `${f.client} — ${f.title}`;
    heroVideo.classList.remove("is-on");
    const old = heroVideo.querySelector("iframe");
    setTimeout(() => old && old.remove(), 1400);
    if (reduced) { playBtn.classList.remove("is-buffering"); return; }
    const ifr = makeIframe(vimeo(f, bgParams()), `${f.client} — ${f.title}`);
    ifr.addEventListener("load", () => hg(30));
    heroVideo.appendChild(ifr);
    if (window.Vimeo && Vimeo.Player) {
      try {
        const vp = new Vimeo.Player(ifr);
        vp.ready().then(() => hg(50)).catch(() => {});
        vp.on("loaded", () => {
          hg(65);
          const t0 = performance.now(), creep = () => { if (hp >= 100 || heroFilm !== myFilm) return; hg(65 + 27 * (1 - Math.exp(-(performance.now() - t0) / 1800))); requestAnimationFrame(creep); };
          requestAnimationFrame(creep);
        });
        vp.on("progress", d => hg(65 + Math.min(1, (d.percent || 0) * 5) * 30));
      } catch (e) { /* ignore */ }
    }
    onPlay(ifr, () => { heroVideo.classList.add("is-on"); done(); });
    trimLoop(ifr, f);
  }
  $("[data-hero-play]").addEventListener("click", () => heroFilm && openLightbox(state.list.indexOf(heroFilm) >= 0 ? state.list : [heroFilm], Math.max(0, state.list.indexOf(heroFilm)), heroPoster));
  $("[data-hero-play]").dataset.cursor = "play";

  /* ==========================================================================
     Work — grid + index
     ========================================================================== */
  const grid = $("[data-grid]"), index = $("[data-index]"), filtersEl = $("[data-filters]");
  const PATTERN = [7, 5, 4, 4, 4, 5, 7, 12, 6, 6, 4, 4, 4, 8, 4];
  const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.6-9.2C1 8 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2C21 4.5 23 8 21.6 11.3 19.5 15.9 12 20.5 12 20.5z"/></svg>`;
  const dirIds = new Set(FILMS.direction.map(f => f.id));
  // On the selection page, a film from the director list keeps the red heart, a DoP film keeps the yellow one
  const heartSrc = id => (state.mode === "selection" && dirIds.has(id)) ? ' data-src="dir"' : "";
  const allFilms = () => { const m = new Map(); [...FILMS.direction, ...FILMS.cinematography].forEach(f => { if (!m.has(f.id)) m.set(f.id, f); }); return m; };
  const buildSelection = () => { const m = allFilms(), c = cur(); FILMS.selection = c ? c.ids.map(id => m.get(id)).filter(Boolean) : []; };
  const selHash = (ids, name) => `selection=${ids.join(".")}${name ? "~" + encodeURIComponent(name) : ""}`;
  const shareURL = () => { const c = cur(); if (c && c.shared && c.url) return c.url; return `${location.origin}${location.pathname}#${selHash(c ? c.ids : [], c ? c.name : "")}`; };
  const HEART_SM = `<svg class="top__heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.6-9.2C1 8 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2C21 4.5 23 8 21.6 11.3 19.5 15.9 12 20.5 12 20.5z"/></svg>`;
  function renderSelTabs() {
    const box = $("[data-seltabs]"), link = $("[data-sel-all]"); if (!box || !link) return;
    const inSel = state.mode === "selection", c = cur();
    const nm = $("[data-sel-name]"); if (nm) nm.textContent = !inSel && c && c.name ? c.name : "";
    box.hidden = !inSel || !sels.length;
    link.hidden = inSel && sels.length > 0;
    const act = cur(), others = sels.filter(x => x !== act), tabHtml = x => `<a class="top__sel top__seltab${x.id === activeSel ? " is-active" : ""}" href="#selection" ${x.id === activeSel ? "data-sel-toggle" : `data-sel-pick="${x.id}"`}><span class="top__heartwrap">${HEART_SM}<b>${x.ids.length}</b></span><span class="top__seltxt">${x.shared ? "Selection" : "Your selection"}</span><span class="top__selname">${esc(x.name || "My films")}</span>${x.id === activeSel && sels.length > 1 ? `<span class="selpick__caret" title="Switch selection" aria-hidden="true">▾</span>` : ""}</a>`;
    box.innerHTML = act ? `<div class="selpick">${tabHtml(act)}${others.length ? `<div class="selpick__menu"><div class="selpick__list">${others.map(tabHtml).join("")}</div></div>` : ""}</div>` : "";
  }
  const clearText = () => { const c = cur(); return !c || c.shared || !c.ids.length ? "Delete" : "Clear"; };
  function updateFavUI() {
    $$("[data-fav-count]").forEach(e => e.textContent = favCount());
    $$("[data-fav]").forEach(e => e.classList.toggle("is-on", isFav(e.dataset.fav)));
    const lbFav = $('[data-lb="fav"]'); if (lbFav && lbList[lbIdx]) lbFav.classList.toggle("is-on", isFav(lbList[lbIdx].id));
    const bar = $("[data-selbar]"), c = cur();
    if (bar) {
      bar.hidden = state.mode !== "selection";
      $("[data-sel-rename]").hidden = !c;
      $("[data-sharemenu]").hidden = !c || !c.ids.length;
      $("[data-sel-clear]").hidden = !c;
      $("[data-titletools]").hidden = state.mode !== "selection";
      if (!$("[data-sel-clear]").classList.contains("is-confirm")) $("[data-clear-label]").textContent = clearText();
    }
    $$("[data-fav-name]").forEach(e => e.textContent = c ? c.name : "Selection");
    renderSelTabs();
    updateHint();
  }
  /* ---- "Like any film" invitation: shown whenever nothing is liked, never on the selection page ---- */
  function updateHint() { /* the "Like & create a Selection" label is permanent now */ }
  /* ---- Name-your-selection dialog + toast ---- */
  const dlg = $("[data-sel-dlg]"), dlgIn = $("[data-sel-dlg-input]");
  let dlgCb = null;
  function askName(cb, current = "") {
    dlgCb = cb; dlgIn.value = current; dlg.hidden = false;
    requestAnimationFrame(() => { dlg.classList.add("is-on"); dlgIn.focus(); dlgIn.select(); });
  }
  function closeDlg() { dlg.classList.remove("is-on"); setTimeout(() => dlg.hidden = true, 300); dlgCb = null; }
  $("[data-sel-dlg-form]").addEventListener("submit", e => {
    e.preventDefault(); const v = dlgIn.value.trim().slice(0, 60); if (!v) { dlgIn.focus(); return; }
    const cb = dlgCb; closeDlg(); cb && cb(v);
  });
  $("[data-sel-dlg-cancel]").addEventListener("click", closeDlg);
  dlg.addEventListener("click", e => { if (e.target === dlg) closeDlg(); });
  let toastT; function toast(html) { const t = $("[data-toast]"); t.innerHTML = html; t.classList.add("is-on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-on"), 2600); }
  /* the address bar: a received selection keeps its long link while it is shown, everything else is a plain #page */
  const hashFor = mode => { const c = cur(); return mode === "selection" && c && c.shared && c.url ? c.url.slice(c.url.indexOf("#")) : `#${mode}`; };
  const syncURL = () => history.replaceState(null, "", hashFor(state.mode));
  const refreshSelView = () => { syncURL(); if (state.mode === "selection") { buildSelection(); renderFilters(); renderWork(); setWorkTitle(); } };
  /* editing a received selection never changes it: it spawns "Name 2", "Name 3"… (or the given name) as the visitor's own */
  function forkShared(c, name) {
    const base = c.name || "Selection"; let n = 2;
    while (sels.some(s => s.name === `${base} ${n}`)) n++;
    const x = { id: uid(), name: name || `${base} ${n}`, ids: [...c.ids], shared: false, key: "" };
    sels.push(x); activeSel = x.id; saveSels(); return x;
  }
  const newSel = name => { const x = { id: uid(), name, ids: [], shared: false, key: "" }; sels.push(x); if (state.mode !== "selection") activeSel = x.id; return x; };
  function addTo(x, id) {
    if (!x.ids.includes(id)) x.ids.push(id);
    if (state.mode !== "selection") activeSel = x.id;
    saveSels(); updateFavUI();
    const f = allFilms().get(id);
    toast(`Added to <em>${esc(x.name)}</em>${f ? " — " + esc(f.client) : ""} <button data-sel-open-toast>View</button>`);
    refreshSelView();
  }
  function removeFrom(x, id) {
    x.ids = x.ids.filter(i => i !== id); saveSels(); updateFavUI();
    const f = allFilms().get(id);
    toast(`Removed from <em>${esc(x.name)}</em>${f ? " — " + esc(f.client) : ""}`);
    refreshSelView();
  }
  /* small chooser that appears next to the pointer: which selection should this film go to? */
  const likePop = document.createElement("div");
  likePop.className = "likepop"; likePop.hidden = true; likePop.setAttribute("role", "menu"); document.body.append(likePop);
  let likePopFilm = null, likePopAt = 0, likePopY = 0;
  const closeLikePop = () => { likePop.hidden = true; likePopFilm = null; };
  function openLikePop(id, ev, anchor) {
    likePopFilm = id; likePopAt = ev ? ev.timeStamp : 0; likePopY = scrollY;
    likePop.innerHTML = `<p class="likepop__t">Add to…</p>` + own().map(x => { const on = x.ids.includes(id); return `<button type="button" role="menuitem" data-lp="${x.id}" class="${on ? "is-in" : ""}"><i>${on ? "✓" : ""}</i><span>${esc(x.name || "My films")}</span></button>`; }).join("") +
      `<button type="button" role="menuitem" data-lp="new" class="likepop__new"><i>+</i><span>New selection</span></button>`;
    likePop.hidden = false;
    let x = ev && ev.clientX ? ev.clientX : (anchor ? anchor.getBoundingClientRect().left : mouse.x);
    let y = ev && ev.clientY ? ev.clientY : (anchor ? anchor.getBoundingClientRect().bottom : mouse.y);
    const w = likePop.offsetWidth, h = likePop.offsetHeight;
    likePop.style.left = Math.max(8, Math.min(x + 14, innerWidth - w - 8)) + "px";
    likePop.style.top = Math.max(8, Math.min(y + 14, innerHeight - h - 8)) + "px";
    const first = likePop.querySelector("button"); first && first.focus({ preventScroll: true });
  }
  likePop.addEventListener("click", e => {
    const b = e.target.closest("[data-lp]"); if (!b) return;
    const id = likePopFilm; closeLikePop(); if (!id) return;
    if (b.dataset.lp === "new") { askName(name => addTo(newSel(name), id)); return; }
    const x = sels.find(s => s.id === b.dataset.lp); if (!x) return;
    x.ids.includes(id) ? removeFrom(x, id) : addTo(x, id);
  });
  document.addEventListener("click", e => { if (!likePop.hidden && e.timeStamp !== likePopAt && !e.composedPath().includes(likePop)) closeLikePop(); });
  addEventListener("keydown", e => { if (e.key === "Escape" && !likePop.hidden) { e.stopPropagation(); closeLikePop(); } }, true);
  addEventListener("scroll", () => { if (!likePop.hidden && Math.abs(scrollY - likePopY) > 60) closeLikePop(); }, { passive: true });
  function toggleFav(id, ev, anchor) {
    const c = cur();
    // viewing one of my own selections: the heart just takes the film out of it
    if (state.mode === "selection" && c && !c.shared && c.ids.includes(id)) { removeFrom(c, id); return; }
    if (state.mode === "selection" && c && c.shared && c.ids.includes(id)) { const x = forkShared(c); removeFrom(x, id); return; }
    if (!own().length) { askName(name => addTo(newSel(name), id)); return; }
    openLikePop(id, ev, anchor);
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-fav]"); if (!b) return;
    e.preventDefault(); e.stopPropagation(); toggleFav(b.dataset.fav, e, b);
  }, true);
  document.addEventListener("keydown", e => {
    const b = e.target.closest && e.target.closest("[data-fav]");
    if (b && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); toggleFav(b.dataset.fav, null, b); }
  }, true);

  function renderFilters() {
    const all = FILMS[state.mode];
    const cats = ["All", ...new Set(all.map(f => f.category))];
    const chip = (c, extra = "") => {
      const n = c === "All" ? all.length : all.filter(f => f.category === c).length;
      return `<button class="chip${c === state.filter ? " is-active" : ""}${extra}" data-filter="${esc(c)}">${esc(c)}<sup>${n}</sup></button>`;
    };
    // every category is always visible, in a fixed order, on the same line as "All"
    filtersEl.innerHTML = cats.map(c => chip(c)).join("");
  }
  function sizeFlyout() {
    // the category flyout opens sideways in the header band; cap its width to what is left on screen
    const r = filtersEl.getBoundingClientRect();
    filtersEl.style.setProperty("--avail", Math.max(220, innerWidth - 24 - r.right) + "px");
  }
  filtersEl.addEventListener("pointerenter", sizeFlyout);
  let foldUntil = 0;
  filtersEl.addEventListener("pointerover", e => { const b = e.target.closest("[data-filter]"); if (b && b.dataset.filter === "All" && performance.now() > foldUntil) filtersEl.classList.remove("is-folded"); });
  filtersEl.addEventListener("pointerleave", () => filtersEl.classList.remove("is-folded"));
  addEventListener("resize", sizeFlyout);
  filtersEl.addEventListener("click", e => {
    const b = e.target.closest("[data-filter]"); if (!b) return;
    state.filter = b.dataset.filter; renderFilters(); renderWork();
    /* new category: go back up to the header film first */
    if (scrollY > 2) scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    armCatTimer();
  });
  /* opened by a click and left alone for 3 s -> the categories fold away again */
  let catT;
  function armCatTimer() { clearTimeout(catT); if (filtersEl.classList.contains("is-open")) catT = setTimeout(() => filtersEl.classList.remove("is-open"), 3000); }
  ["pointermove", "pointerdown", "touchstart", "keydown"].forEach(ev => filtersEl.addEventListener(ev, armCatTimer, { passive: true }));
  document.addEventListener("click", e => { if (!e.composedPath().includes(filtersEl)) filtersEl.classList.remove("is-open"); });

  $$("[data-view]").forEach(b => b.addEventListener("click", () => {
    state.view = b.dataset.view;
    $$("[data-view]").forEach(x => x.classList.toggle("is-active", x === b));
    grid.hidden = state.view !== "grid"; index.hidden = state.view !== "index";
    stopAllPreviews();
  }));

  /* publisher badge — shown on the card and in the player window for films flagged `badge: "nowness"` in films.js */
  const BADGES = {
    nowness: { label: "Selected by NOWNESS Picks", img: "nowness-picks.svg" },
    nikon: { label: "Finalist — Nikon Film Festival", img: "award-nikon.svg", laurel: 1 },
    frejus: { label: "Fréjus Festival Court Métrage", img: "award-frejus.svg", laurel: 1 },
    prix: { label: "2024 — Best Actor Award (Léo Angel), Fiction Selection", img: "award-prix.svg", laurel: 1 },
    sens: { label: "Finalist — SensCritique", img: "award-sens.svg", laurel: 1 }
  };
  const badgeHtml = f => {
    const list = [].concat((f && f.badge) || []).map(k => BADGES[k] && { k, ...BADGES[k] }).filter(Boolean);
    return list.length ? `<span class="badges">${list.map(b => `<span class="badge badge--${b.k}${b.laurel ? " badge--laurel" : ""}" title="${b.label}"><img src="${b.img}?v=1" alt="${b.label}" width="${b.laurel ? 100 : 174}" height="${b.laurel ? 100 : 79}"></span>`).join("")}</span>` : "";
  };

  function renderWork() {
    stopAllPreviews();
    const all = FILMS[state.mode];
    state.list = state.filter === "All" ? all : all.filter(f => f.category === state.filter);
    /* the header film also sits in the feed, 6th among the videos below (director / cinematographer pages) */
    let dup = -1;
    if (state.mode !== "selection" && state.list.length > 1) {
      const rest = state.list.slice(1); dup = Math.min(6, state.list.length);
      rest.splice(dup - 1, 0, state.list[0]); state.list = [state.list[0], ...rest];
    }
    const numOf = i => dup < 0 ? i + 1 : i === dup ? 1 : i > dup ? i : i + 1;
    $("[data-count]").textContent = pad(dup < 0 ? state.list.length : state.list.length - 1);
    $("[data-sel-empty]").hidden = !(state.mode === "selection" && !state.list.length);
    // the header film follows the category; it is not repeated below (but stays in the numbering / counts)
    const heroF = state.list[0];
    if (heroF && (!heroFilm || heroFilm.id !== heroF.id)) setHero(heroF);
    const skipHero = state.mode !== "selection" ? 1 : 0;

    let col = 0; // columns already used in the current grid row
    // masonry packing only where some film is not 16:9 (all-16:9 grids keep their classic rows)
    grid.classList.toggle("is-masonry", state.list.some(f => f.ratio));
    grid.innerHTML = state.list.map((f, i) => {
      if (i < skipHero) return "";
      const j = i - skipHero;
      let span = state.filter === "All" ? (f.size || PATTERN[j % PATTERN.length]) : [6, 6, 4, 4, 4][j % 5];
      // a film that is not 16:9 keeps its own proportions: verticals stay in a narrow card, the others never take the full width
      if (f.ratio && f.ratio < 1) span = 4; else if (f.ratio && span === 12) span = 8;
      // never leave a hole: a card that does not fit in the rest of the row shrinks to fill it
      if (span > 12 - col) span = 12 - col;
      const rest = 12 - col - span; if (rest > 0 && rest < 4) span += rest; // a leftover of 1–3 columns is absorbed too
      col = (col + span) % 12;
      const tw = span >= 7 ? 1280 : 960;
      const words = esc(f.client).split(" ").map(w => `<span class="w">${w}</span>`).join(" ");
      return `<button class="card s-${span}" data-i="${i}" data-cursor="play" aria-label="Play ${esc(f.client)} — ${esc(f.title)}">
        <div class="card__frame"${f.ratio ? ` style="--r:${f.ratio};aspect-ratio:${frameRatio(f)}${f.ratio < 1 ? ";width:min(100%,max(17vw,220px));margin-inline:auto" : ""}"` : ""}>
          <img src="${thumb(f, `${tw}x${Math.round(tw / frameRatio(f))}`)}" alt="" loading="lazy">
          <div class="cover"></div>
          <span class="card__num mono">${pad(numOf(i))}</span>
          <span class="card__fav${isFav(f.id) ? " is-on" : ""}" data-fav="${f.id}"${heartSrc(f.id)} role="button" tabindex="0" aria-label="Add to selection" title="Add to my selection">${HEART}</span>
          <span class="card__dur mono">${fmtDur(f.duration)}</span>
          ${badgeHtml(f)}
          <span class="card__live mono">Preview</span>
          <div class="card__meta">
            <div>
              <span class="card__client">${words}</span>
              <span class="card__title"><span>${esc(f.title)}</span></span>
            </div>
            <span class="card__credit mono">${esc(f.director ? "Dir. " + f.director : f.category)}</span>
          </div>
        </div>
      </button>`;
    }).join("");

    index.innerHTML = state.list.map((f, i) => i < skipHero ? "" : `
      <li class="row" data-i="${i}" data-cursor="play" tabindex="0">
        <span class="row__num">${pad(numOf(i))}</span>
        <span class="row__fav card__fav${isFav(f.id) ? " is-on" : ""}" data-fav="${f.id}"${heartSrc(f.id)} role="button" tabindex="0" aria-label="Add to selection">${HEART}</span>
        <img class="row__thumb" src="${thumb(f, "320x180")}" alt="" loading="lazy" width="96" height="54">
        <span class="row__client">${esc(f.client)}</span>
        <span class="row__title">${esc(f.title)}</span>
        <span class="row__dir">${esc(f.director ? "Dir. " + f.director : "—")}</span>
        <span class="row__cat">${esc(f.category)}</span>
        <span class="row__yr">${esc(f.year || "")}</span>
      </li>`).join("");

    bindCards(); bindRows(); revealCards(); layoutMasonry();
  }

  /* ---- Masonry: each card spans as many 4px grid rows as it is tall, and the grid packs them (dense) ---- */
  function layoutMasonry() {
    const cards = $$(".card", grid);
    cards.forEach(c => (c.style.gridRowEnd = ""));
    if (!grid.classList.contains("is-masonry")) return;
    const rowH = 4, gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    const spans = cards.map(c => Math.ceil((c.offsetHeight + gap) / rowH));
    cards.forEach((c, k) => (c.style.gridRowEnd = `span ${spans[k]}`));
  }
  let masonryW = 0;
  new ResizeObserver(() => { const w = grid.clientWidth; if (w && w !== masonryW) { masonryW = w; layoutMasonry(); } }).observe(grid);

  /* ---- Card reveal on scroll ---- */
  let revealIO;
  function revealCards() {
    revealIO && revealIO.disconnect();
    revealIO = new IntersectionObserver(entries => {
      let k = 0;
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target; setTimeout(() => el.classList.add("is-in"), (k++) * 90);
        revealIO.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    $$(".card", grid).forEach(c => revealIO.observe(c));
  }

  /* ---- Hover previews (one at a time) ---- */
  let activeCard = null, hoverTimer = null;
  function startPreview(card) {
    if (reduced) return;
    const f = state.list[+card.dataset.i], cover = $(".cover", card);
    if (!f || !cover || !card.isConnected || cover.firstChild) return; // card was re-rendered (e.g. a like removed it)
    const ifr = makeIframe(vimeo(f, bgParams("360p")), f.client);
    const tag = $(".card__live", card); tag.textContent = "Loading";
    card.classList.add("is-loading");
    // Loading gauge around the cursor, driven by the real player stages
    let gp = 0; const gauge = v => { if (activeCard !== card || v <= gp) return; gp = v; cursor.style.setProperty("--p", v); };
    cursor.style.transition = "none"; cursor.style.setProperty("--p", 0); void cursor.offsetWidth; cursor.style.transition = "";
    cursor.classList.add("is-loading"); setTimeout(() => gauge(8), 30);
    ifr.addEventListener("load", () => gauge(30));
    cover.appendChild(ifr);
    if (window.Vimeo && Vimeo.Player) {
      try {
        const vp = new Vimeo.Player(ifr);
        vp.ready().then(() => gauge(50)).catch(() => {});
        vp.on("loaded", () => {
          gauge(65);
          // Vimeo gives no byte progress before the first frame: creep slowly toward 92 until playback starts
          const t0 = performance.now(), creep = () => { if (gp >= 100 || activeCard !== card) return; gauge(65 + 27 * (1 - Math.exp(-(performance.now() - t0) / 1800))); requestAnimationFrame(creep); };
          requestAnimationFrame(creep);
        });
        vp.on("progress", d => gauge(65 + Math.min(1, (d.percent || 0) * 5) * 30));
        vp.on("bufferend", () => gauge(95));
      } catch (e) { /* ignore */ }
    }
    onPlay(ifr, () => {
      gauge(100);
      setTimeout(() => { if (activeCard === card) cursor.classList.remove("is-loading"); }, 380);
      card.classList.remove("is-loading"); card.classList.add("is-playing"); tag.textContent = "Preview";
    });
    trimLoop(ifr, f);
  }
  function stopPreview(card) {
    if (!card) return;
    card.classList.remove("is-playing", "is-loading"); cursor.classList.remove("is-loading");
    const cover = $(".cover", card);
    setTimeout(() => { if (!card.classList.contains("is-hover") && !card.classList.contains("is-auto")) cover.innerHTML = ""; }, 600);
  }
  function stopAllPreviews() {
    $$(".card").forEach(c => { c.classList.remove("is-playing", "is-loading", "is-hover", "is-auto"); cursor.classList.remove("is-loading"); const cv = $(".cover", c); if (cv) cv.innerHTML = ""; });
    grid.classList.remove("has-hover"); activeCard = null;
    hideFloat();
  }

  function bindCards() {
    $$(".card", grid).forEach(card => {
      const frame = $(".card__frame", card);
      card.addEventListener("click", () => openLightbox(state.list, +card.dataset.i, frame));
      if (isTouch) return;
      card.addEventListener("mouseenter", () => {
        if (activeCard && activeCard !== card) { activeCard.classList.remove("is-hover"); stopPreview(activeCard); }
        activeCard = card; card.classList.add("is-hover"); grid.classList.add("has-hover");
        clearTimeout(hoverTimer); hoverTimer = setTimeout(() => startPreview(card), 40);
      });
      card.addEventListener("mousemove", e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        frame.style.transform = `perspective(1100px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) scale(1.035)`;
        $("img", frame).style.transform = `scale(1.04) translate(${-x * 12}px, ${-y * 12}px)`;
      });
      card.addEventListener("mouseleave", () => {
        clearTimeout(hoverTimer);
        card.classList.remove("is-hover"); frame.style.transform = ""; $("img", frame).style.transform = "";
        stopPreview(card);
        if (activeCard === card) activeCard = null;
        requestAnimationFrame(() => { if (!activeCard) grid.classList.remove("has-hover"); });
      });
    });
    if (isTouch) autoPreviewTouch();
  }

  /* ---- Touch: autoplay the card in the middle of the screen ---- */
  let touchIO;
  function autoPreviewTouch() {
    touchIO && touchIO.disconnect();
    if (reduced) return;
    let current = null;
    touchIO = new IntersectionObserver(entries => {
      entries.forEach(en => {
        const c = en.target;
        if (en.isIntersecting && c !== current) {
          if (current) { current.classList.remove("is-auto"); stopPreview(current); }
          current = c; c.classList.add("is-auto"); startPreview(c);
        } else if (!en.isIntersecting && c === current) {
          c.classList.remove("is-auto"); stopPreview(c); current = null;
        }
      });
    }, { rootMargin: "-42% 0px -42% 0px" });
    $$(".card", grid).forEach(c => touchIO.observe(c));
  }

  /* ---- Index rows + floating preview ---- */
  const float = $(".float"), floatImg = $(".float img"), floatVid = $(".float__video");
  const fpos = { x: mouse.x, y: mouse.y, r: 0 };
  let floatTimer = null, floatOn = false;
  function showFloat(f) {
    floatOn = true; float.classList.add("is-on");
    floatImg.src = thumb(f, "960x540");
    clearTimeout(floatTimer);
    const old = floatVid.querySelector("iframe"); if (old) old.remove();
    if (reduced) return;
    floatTimer = setTimeout(() => {
      const ifr = makeIframe(vimeo(f, bgParams("360p")), f.client);
      floatVid.appendChild(ifr);
      onPlay(ifr, () => ifr.classList.add("is-on"));
      trimLoop(ifr, f);
    }, 220);
  }
  function hideFloat() {
    floatOn = false; float.classList.remove("is-on"); clearTimeout(floatTimer);
    setTimeout(() => { if (!floatOn) floatVid.innerHTML = ""; }, 400);
  }
  function bindRows() {
    $$(".row", index).forEach(row => {
      const i = +row.dataset.i;
      row.addEventListener("click", () => openLightbox(state.list, i, float.classList.contains("is-on") ? float : row));
      row.addEventListener("keydown", e => { if (e.key === "Enter") openLightbox(state.list, i, row); });
      if (isTouch) return;
      row.addEventListener("mouseenter", () => {
        $$(".row", index).forEach(r => r.classList.toggle("is-hover", r === row));
        index.classList.add("has-hover"); showFloat(state.list[i]);
      });
    });
    index.onmouseleave = () => { $$(".row", index).forEach(r => r.classList.remove("is-hover")); index.classList.remove("has-hover"); hideFloat(); };
  }

  /* ==========================================================================
     Lightbox
     ========================================================================== */
  const lb = $(".lightbox"), ghost = $(".lightbox__ghost"), lbPlayer = $(".lightbox__player");
  let lbList = [], lbIdx = 0;

  function fillInfo(f) {
    const lbFav = $('[data-lb="fav"]'); if (lbFav) { lbFav.classList.toggle("is-on", isFav(f.id)); lbFav.dataset.src = (state.mode === "selection" && dirIds.has(f.id)) ? "dir" : ""; }
    $(".lightbox__cat", lb).textContent = `${pad(lbIdx + 1)} / ${pad(lbList.length)} — ${f.category}${f.year ? " — " + f.year : ""}`;
    $(".lightbox__title", lb).innerHTML = `${esc(f.client)} <em>${esc(f.title)}</em>`;
    $(".lightbox__sp", lb).innerHTML = badgeHtml(f);
    const role = state.mode === "direction" ? "Directed & photographed by Seb Trân" : "Cinematography by Seb Trân";
    $(".lightbox__credits", lb).textContent = [role, credits(f)].filter(Boolean).join(" — ");
  }
  function loadPlayer(f) {
    lbPlayer.innerHTML = "";
    lbPlayer.style.setProperty("--r", ratioOf(f)); // the player box takes the film's real proportions (no bars)
    const accent = getComputedStyle(document.body).getPropertyValue("--accent").trim().replace("#", "");
    /* Safari / iPhone never allow sound in an auto-started iframe (Vimeo then shows "restore sound"): there the film starts by itself, muted, and the code below tries to unmute it right away */
    const noSoundAutoplay = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) || /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
    const ifr = makeIframe(vimeo(f, { autoplay: 1, muted: noSoundAutoplay ? 1 : 0, loop: 1, title: 0, byline: 0, portrait: 0, color: accent }), `${f.client} — ${f.title}`);
    lbPlayer.appendChild(ifr);
    /* sound on by default: the iframe is created inside the user's tap/click, and we make sure it isn't left muted */
    if (window.Vimeo && Vimeo.Player) {
      try {
        const p = new Vimeo.Player(ifr);
        p.on("play", () => { p.getMuted().then(m => { if (m) p.setMuted(false); }).catch(() => {}); p.setVolume(1).catch(() => {}); });
      } catch (e) { /* ignore */ }
    }
  }
  async function openLightbox(list, i, fromEl) {
    lbList = list; lbIdx = i;
    const f = list[i];
    stopAllPreviews();
    heroVideo.querySelector("iframe")?.setAttribute("data-paused", "1");
    lb.hidden = false; document.body.style.overflow = "hidden"; cursor.classList.add("is-hidden");
    fillInfo(f);
    loadPlayer(f); // created right now, inside the tap/click → browsers allow sound; it stays hidden until the zoom animation ends
    // FLIP ghost from the clicked frame to the player box
    const from = (fromEl || lbPlayer).getBoundingClientRect();
    Object.assign(ghost.style, { transition: "none", left: from.left + "px", top: from.top + "px", width: from.width + "px", height: from.height + "px", opacity: 1, backgroundImage: `url("${thumb(f, `1280x${Math.round(1280 / ratioOf(f))}`)}")` });
    requestAnimationFrame(() => {
      lb.classList.add("is-open");
      const to = lbPlayer.getBoundingClientRect();
      requestAnimationFrame(() => {
        Object.assign(ghost.style, { transition: "", left: to.left + "px", top: to.top + "px", width: to.width + "px", height: to.height + "px" });
      });
    });
    await wait(reduced ? 0 : 820);
    lb.classList.add("is-ready");
    await wait(900); ghost.style.opacity = 0;
  }
  function closeLightbox() {
    lb.classList.remove("is-ready", "is-open");
    ghost.style.opacity = 0;
    setTimeout(() => { lb.hidden = true; lbPlayer.innerHTML = ""; }, 500);
    document.body.style.overflow = ""; cursor.classList.remove("is-hidden");
  }
  function stepLightbox(d) {
    lbIdx = (lbIdx + d + lbList.length) % lbList.length;
    const f = lbList[lbIdx]; fillInfo(f); loadPlayer(f);
  }
  lb.addEventListener("click", e => {
    const b = e.target.closest("[data-lb]");
    if (b) {
      if (b.dataset.lb === "fav") { const f = lbList[lbIdx]; if (f) toggleFav(f.id, e, b); return; }
      b.dataset.lb === "close" ? closeLightbox() : stepLightbox(b.dataset.lb === "next" ? 1 : -1); return;
    }
    if (e.target === lb || e.target.classList.contains("lightbox__stage")) closeLightbox();
  });
  addEventListener("keydown", e => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") stepLightbox(1);
    if (e.key === "ArrowLeft") stepLightbox(-1);
  });

  /* ==========================================================================
     About — words light up while scrolling
     ========================================================================== */
  const aboutEl = $("[data-about]");
  function renderAbout(text) {
    aboutEl.innerHTML = text.split(" ").map(w => {
      const em = /^\*.*\*[.,;:—]?$/.test(w);
      const clean = esc(w.replace(/\*/g, ""));
      return `<span class="w">${em ? `<em>${clean}</em>` : clean}</span>`;
    }).join(" ");
    litAbout();
  }
  function litAbout() {
    const words = $$(".w", aboutEl); if (!words.length) return;
    const r = aboutEl.getBoundingClientRect();
    const p = clamp((innerHeight * .85 - r.top) / (r.height + innerHeight * .35), 0, 1);
    const n = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle("is-lit", i < n));
  }

  /* ==========================================================================
     Mode switch (Cinematography ⟷ Direction)
     ========================================================================== */
  const shutter = $(".shutter"), pill = $(".switch__pill");
  function placePill() {
    const a = $(`.switch__btn[data-mode="${state.mode}"]`); if (!a) { pill.style.width = "0px"; return; }
    pill.style.width = a.offsetWidth + "px";
    pill.style.transform = `translateX(${a.offsetLeft}px)`;
    placeHint();
  }
  /* hint arrow: leaves the text horizontally, then turns up (right angle) to the word "Selection" */
  function placeHint() {
    const hint = $(".switchwrap .top__selpre"), sv = hint && hint.querySelector(".hint__arrow"), sb = $('.switch__btn[data-mode="selection"]');
    if (!hint || !sv || !sb) return;
    const sw = sb.parentElement;
    if (!hint.offsetWidth || !sb.offsetWidth) return;
    // offset* values ignore the switch's call-to-action animation (transforms)
    const gap = 4, cx = sw.offsetLeft + sb.offsetLeft + sb.offsetWidth / 2;
    // the text stops ~24px left of the word "Selection": the arrow runs right, then turns up
    hint.style.right = Math.max(0, hint.parentElement.offsetWidth - (cx - 24 - gap)) + "px";
    const hr = { top: hint.offsetTop, right: hint.offsetLeft + hint.offsetWidth, height: hint.offsetHeight }, midY = hr.top + hr.height / 2;
    const ty = sw.offsetTop + sb.offsetTop + sb.offsetHeight / 2 + parseFloat(getComputedStyle(sb).fontSize) * .5 + 4;
    const dx = Math.max(10, cx - hr.right - gap), dy = Math.max(10, midY - ty);
    sv.setAttribute("viewBox", `0 0 ${dx + 4} ${dy + 2}`); sv.setAttribute("width", dx + 4); sv.setAttribute("height", dy + 2);
    sv.querySelector("path").setAttribute("d", `M0 ${dy + 1} H${dx} V2 M${dx - 3.5} 5.5 L${dx} 1.5 L${dx + 3.5} 5.5`);
    sv.style.cssText = `position:absolute;left:calc(100% + ${gap}px);top:${(ty - hr.top) - 1}px;overflow:visible;width:${dx + 4}px;height:${dy + 2}px`;
  }
  const selRole = () => { const c = cur(); return c && c.shared ? "Shared selection" : "Your selection"; };
  const updateSelName = () => renderSelTabs();
  /* hero line under "Seb Trân" on the selection page: "<Your selection | Selection…> · <name>", coloured by the kind of films inside */
  const cineIds = new Set(FILMS.cinematography.map(f => f.id));
  const heroSelText = () => { const c = cur(); return c && c.name ? `${selRole()} · ${c.name}` : selRole(); };
  const roleColor = () => {
    const ids = (cur() || { ids: [] }).ids;
    const dir = ids.some(i => dirIds.has(i) && !cineIds.has(i)), cine = ids.some(i => cineIds.has(i) && !dirIds.has(i));
    return dir && cine ? "var(--fg)" : dir ? "#e5483a" : cine ? "#e0a35c" : "var(--fg)";
  };
  const selTitle = () => { const c = cur(); return c ? (c.name || "My films") : "Empty"; };
  const setWorkTitle = () => {
    $("[data-work-title]").textContent = state.mode === "selection" ? selTitle() : CONFIG.modes[state.mode].workTitle;
    updateSelName();
    $$(".top").forEach(t => t.classList.toggle("in-sel", state.mode === "selection"));
    const role = $("[data-role]"); role.style.color = state.mode === "selection" ? roleColor() : "";
    if (state.mode === "selection") role.textContent = heroSelText();
  };
  function applyMode(mode) {
    const M = CONFIG.modes[mode];
    if (mode === "selection") buildSelection(); else lastMode = mode;
    state.mode = mode; state.filter = "All";
    document.body.classList.toggle("mode-direction", mode === "direction");
    $$(".switch__btn").forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle("is-active", on); b.setAttribute("aria-selected", on); });
    placePill();
    setWorkTitle();
    $(".hud__meta").textContent = M.hud;
    document.title = `Seb Trân — ${M.role}`;
    scramble($("[data-role]"), mode === "selection" ? heroSelText() : M.role);
    renderAbout(M.about);
    renderFilters(); renderWork();
    updateFavUI();
    hideTopOnArrival();
  }
  async function setMode(mode, animate = true) {
    if (!CONFIG.modes[mode] || (mode === state.mode && mode !== "selection")) return;
    history.replaceState(null, "", hashFor(mode));
    if (!animate || reduced) { applyMode(mode); scrollTo({ top: 0, behavior: "auto" }); hideTopOnArrival(); return; }
    shutter.classList.add("is-closed");
    await wait(560);
    applyMode(mode);
    scrollTo({ top: 0, behavior: "auto" });
    hideTopOnArrival();
    await wait(250);
    shutter.classList.remove("is-closed");
  }
  $$(".switch__btn").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  addEventListener("hashchange", () => {
    const h = location.hash.slice(1), m = h.split("=")[0], rest = h.slice(m.length + 1);
    if (m === "selection" && rest) { importShared(rest); setMode("selection"); }
    else if (CONFIG.modes[m]) setMode(m);
  });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-sel-open], [data-sel-open-toast]"); if (!b) return;
    e.preventDefault();
    if (!lb.hidden) closeLightbox();
    setMode("selection");
  });
  $("[data-sel-close]").addEventListener("click", () => setMode(lastMode || CONFIG.defaultMode));
  /* a selection opened from a shared link is kept in the visitor's own selections */
  function importShared(rest) {
    const p = parseSel(rest); if (!p.ids.length) return;
    const key = p.ids.join(".") + "~" + p.name;
    let x = sels.find(s => s.key === key) || sels.find(s => !s.shared && s.name === p.name && s.ids.join(".") === p.ids.join("."));
    if (!x) { x = { id: uid(), name: p.name || "Shared selection", ids: p.ids, shared: true, key, url: `${location.origin}${location.pathname}#selection=${rest}` }; sels.push(x); }
    activeSel = x.id; saveSels();
  }
  /* switch to another selection without the shutter animation */
  function showSel(id) {
    activeSel = id; saveSels();
    if (state.mode !== "selection") { setMode("selection"); return; }
    syncURL();
    buildSelection(); state.filter = "All"; setWorkTitle(); renderFilters(); renderWork();
    scramble($("[data-role]"), heroSelText()); updateFavUI(); scrollTo({ top: 0, behavior: "auto" });
  }
  document.addEventListener("click", e => {
    const tg = e.target.closest("[data-sel-toggle]");
    if (tg) { e.preventDefault(); const w = tg.closest(".selpick"); w && w.classList.toggle("is-open"); return; }
    $$(".selpick.is-open").forEach(w => { if (!e.composedPath().includes(w)) w.classList.remove("is-open"); });
  });
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-sel-pick]"); if (!t) return;
    e.preventDefault(); showSel(t.dataset.selPick);
  });
  $("[data-sel-rename]").addEventListener("click", () => { const c = cur(); if (!c) return;
    if (c.shared) askName(n => { const x = forkShared(c, n); showSel(x.id); }, c.name);
    else askName(n => { c.name = n; saveSels(); updateFavUI(); setWorkTitle(); }, c.name);
  });
  /* ---- Share your selection: copy the link, or send it via the system share sheet / WhatsApp / Email / SMS ---- */
  const shareMenu = $("[data-sharemenu]"), sharePop = $("[data-share-pop]"), shareTgl = $("[data-share-toggle]"), shareApps = $("[data-share-apps]");
  const shareName = () => { const c = cur(); return c ? c.name : ""; };
  const shareText = () => `Seb Trân — ${shareName() || "a selection of films"}`;
  const closeShare = () => { sharePop.hidden = true; shareApps.hidden = true; shareTgl.setAttribute("aria-expanded", "false"); };
  shareTgl.addEventListener("click", () => {
    const open = sharePop.hidden; closeShare();
    if (open) { sharePop.hidden = false; shareTgl.setAttribute("aria-expanded", "true"); }
  });
  document.addEventListener("click", e => { if (!e.composedPath().includes(shareMenu)) closeShare(); });
  $("[data-sel-copy]").addEventListener("click", async () => {
    const url = shareURL(), msg = $("[data-sel-msg]");
    try { await navigator.clipboard.writeText(url); msg.textContent = "Link copied ✓"; toast("Link copied — ready to share"); }
    catch (e) { prompt("Copy this link:", url); msg.textContent = ""; }
    closeShare(); setTimeout(() => msg.textContent = "", 2500);
  });
  $("[data-share-native]").addEventListener("click", async () => {
    if (navigator.share) {
      try { await navigator.share({ title: shareText(), text: shareText(), url: shareURL() }); closeShare(); } catch (e) { /* cancelled */ }
      return;
    }
    const u = encodeURIComponent(shareURL()), t = encodeURIComponent(shareText());
    $('[data-share="wa"]').href = `https://wa.me/?text=${t}%20${u}`;
    $('[data-share="mail"]').href = `mailto:?subject=${t}&body=${t}%0A${u}`;
    $('[data-share="sms"]').href = `sms:?&body=${t}%20${u}`;
    shareApps.hidden = !shareApps.hidden;
  });
  $$("[data-sel-rename], [data-sel-save], [data-sel-close]").forEach(b => b.addEventListener("click", closeShare));
  $$("[data-share]").forEach(l => l.addEventListener("click", () => setTimeout(closeShare, 200)));
  /* ---- Clear (empties the selection) / Delete (removes an empty or shared one) — two taps, to avoid accidents ---- */
  const clearBtn = $("[data-sel-clear]"), clearLbl = $("[data-clear-label]"); let clearT;
  clearBtn.addEventListener("click", () => {
    if (!clearBtn.classList.contains("is-confirm")) {
      clearBtn.classList.add("is-confirm"); clearLbl.textContent = "Sure? Tap again";
      clearT = setTimeout(() => { clearBtn.classList.remove("is-confirm"); clearLbl.textContent = clearText(); }, 3000); return;
    }
    clearTimeout(clearT); clearBtn.classList.remove("is-confirm");
    const c = cur(); if (!c) return;
    if (clearText() === "Delete") {
      sels = sels.filter(x => x.id !== c.id); activeSel = sels.length ? sels[sels.length - 1].id : null; saveSels();
      toast("Selection deleted");
      if (activeSel) { showSel(activeSel); return; }
    } else { c.ids = []; saveSels(); toast("Selection cleared"); }
    buildSelection(); renderFilters(); renderWork(); setWorkTitle(); updateFavUI();
  });

  /* ==========================================================================
     Misc: nav scroll, marquee, contact, footer
     ========================================================================== */
  $$("[data-scroll]").forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    const t = document.getElementById(a.dataset.scroll);
    t && scrollTo({ top: a.dataset.scroll === "hero" ? 0 : t.offsetTop - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pin")) || $(".top").offsetHeight) - ($("[data-catbar]").offsetHeight || 0) - 12, behavior: reduced ? "auto" : "smooth" });
  }));
  $$("[data-to-bottom]").forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    scrollTo({ top: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) });
  }));
  $(".top__name").addEventListener("click", e => {
    if (state.mode !== "selection") return;
    e.stopImmediatePropagation(); e.preventDefault();
    setMode(lastMode || CONFIG.defaultMode);
  }, true);
  /* header band height -> CSS var (hero offset, scroll offsets) */
  const topEl = $(".top"), setTopH = () => document.documentElement.style.setProperty("--topH", topEl.offsetHeight + "px");
  /* the header film pins under the band from the big "Seb Trân" down: --pin = band + that strip */
  const pinEl = $(".hero"), pinTitle = $(".hero__title"), pinBox = $(".hero__content");
  const setPin = () => {
    setTopH();
    const r = document.documentElement.style, topH = topEl.offsetHeight, H = pinEl.offsetHeight, lb = matchMedia("(min-width: 900px)").matches ? 0 : (parseFloat(r.getPropertyValue("--lb")) || 0); /* desktop: no letterbox bars any more */
    /* measured as if the letterbox were fully open (--lb = 0): that is the state once the film is pinned */
    const titleTop = pinBox.offsetTop + pinTitle.offsetTop + lb, boxBottom = pinBox.offsetTop + pinBox.offsetHeight + lb;
    let pin, heroTop, clipB = 0;
    pin = topH; heroTop = topH - H; /* every screen: the header film scrolls away completely, nothing stays pinned */
    r.setProperty("--catH", ($("[data-catbar]").offsetHeight || 0) + "px");
    r.setProperty("--pin", pin + "px"); r.setProperty("--heroTop", heroTop + "px"); r.setProperty("--clipB", clipB + "px");
    r.setProperty("--pinStart", (-heroTop) + "px");
  };
  setPin(); addEventListener("resize", setPin); addEventListener("scroll", () => { if (scrollY < innerHeight) setPin(); }, { passive: true }); addEventListener("load", setPin);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setPin);
  if (window.ResizeObserver) { const ro = new ResizeObserver(setPin); ro.observe(topEl); ro.observe(pinEl); ro.observe(pinBox); ro.observe($("[data-catbar]")); }
  /* top band: hidden on arrival, fades in (0.5 s) on any touch / mouse move, fades out (1 s) after 3 s of calm;
     once the header film has scrolled away it stays put */
  const heroEl = $(".hero"); let lastAct = performance.now();
  const pastHero = () => scrollY > (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pinStart")) || heroEl.offsetHeight - topEl.offsetHeight) - 24;
  const keepTop = () => topEl.matches(":hover") || topEl.contains(document.activeElement) || filtersEl.classList.contains("is-open") ||
    !!$(".selpick.is-open") || !$("[data-share-pop]").hidden || !likePop.hidden || !$("[data-sel-dlg]").hidden;
  let arriveUntil = 0;
  const showTop = () => { if (performance.now() < arriveUntil) return; lastAct = performance.now(); document.body.classList.remove("top-idle"); };
  ["pointermove", "pointerdown", "keydown"].forEach(ev => addEventListener(ev, e => { if (e.pointerType === "touch" && !pastHero()) return; showTop(); }, { passive: true }));
  let autoHide = false; // set when the visitor comes back up from the videos to the header film
  const syncHeroMode = () => {
    const was = document.body.classList.contains("at-hero"), now = !pastHero();
    document.body.classList.toggle("at-hero", now);
    if (now && !was) { autoHide = true; lastAct = performance.now(); document.body.classList.remove("top-idle"); }
    if (!now) autoHide = false;
  };
  /* once shown, the band stays; it only goes away when the visitor scrolls up and reaches the very top */
  let lastY = scrollY, atTop = scrollY <= 2, bounceAt = 0;
  /* the page bounces against the top (scrolling up reaches the very top): the band goes away; a touch on the image brings it back */
  const bounceTop = () => {
    const t = performance.now(); if (t - bounceAt < 700) return; bounceAt = t;
    arriveUntil = t + 400; document.body.classList.add("top-idle");
  };
  addEventListener("scroll", () => {
    lastAct = performance.now();
    syncHeroMode();
    const goingUp = scrollY < lastY; lastY = scrollY;
    if (scrollY <= 2) { if (goingUp && !atTop) bounceTop(); atTop = true; }
    else {
      atTop = false;
      if (pastHero()) document.body.classList.remove("top-idle");
      else if (goingUp) showTop(); /* over the header film: scrolling up brings the band back (until the page hits the very top) */
    }
  }, { passive: true });
  /* already at the very top: another scroll-up (wheel / pull) is a bounce too */
  addEventListener("wheel", e => { if (scrollY <= 2 && e.deltaY < 0) bounceTop(); }, { passive: true });
  let ty0 = 0;
  addEventListener("touchstart", e => { ty0 = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchmove", e => { if (scrollY <= 2 && e.touches[0].clientY - ty0 > 40) { ty0 = e.touches[0].clientY; bounceTop(); } }, { passive: true });
  /* a simple touch (a tap, not a swipe) on the header film toggles the band: shown, then hidden, then shown… */
  let tap = null;
  addEventListener("touchstart", e => { tap = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now(), el: e.target } : null; }, { passive: true });
  addEventListener("touchend", e => {
    const p = tap; tap = null; if (!p || !e.changedTouches.length || pastHero() || !lb.hidden) return;
    if (p.el.closest && p.el.closest("button, a, .top, .catbar, [data-catbar]")) return; /* buttons and links keep their own job */
    const c = e.changedTouches[0];
    if (Math.hypot(c.clientX - p.x, c.clientY - p.y) >= 10 || performance.now() - p.t >= 600) return;
    if (document.body.classList.contains("top-idle")) showTop();
    else { document.body.classList.add("top-idle"); autoHide = false; arriveUntil = performance.now() + 400; }
  }, { passive: true });
  addEventListener("resize", syncHeroMode);
  setInterval(() => {
    if (document.body.classList.contains("is-loading")) return;
    if (pastHero() || keepTop()) { if (keepTop()) lastAct = performance.now(); return; }
    /* coming back up to the header: the band stays, then fades away after 1.5 s without any touch */
    if (autoHide && performance.now() - lastAct > 1500) { autoHide = false; document.body.classList.add("top-idle"); }
  }, 250);
  const hideTopOnArrival = () => { syncHeroMode(); arriveUntil = performance.now() + 700; lastAct = performance.now() - 5000; if (!pastHero()) document.body.classList.add("top-idle"); };
  const mq = $("[data-marquee]");
  mq.innerHTML = [...CONFIG.clients, ...CONFIG.clients].map(c => `<span>${esc(c)}</span>`).join("");
  const mail = $("[data-mail]");
  mail.href = `mailto:${CONFIG.email}`; $("[data-mail-txt]").textContent = CONFIG.email;
  $("[data-year]").textContent = new Date().getFullYear();

  /* ==========================================================================
     Main loop
     ========================================================================== */
  function loop(now) {
    tickTC(now);
    // cursor
    ringPos.x = lerp(ringPos.x, mouse.x, .18); ringPos.y = lerp(ringPos.y, mouse.y, .18);
    dot.style.transform = `translate(${mouse.x}px, ${mouse.y}px) translate(-50%, -50%)`;
    ring.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px) translate(-50%, -50%)`;
    // floating preview
    if (floatOn || float.classList.contains("is-on")) {
      const px = fpos.x;
      fpos.x = lerp(fpos.x, mouse.x + 40, .12); fpos.y = lerp(fpos.y, mouse.y, .12);
      fpos.r = lerp(fpos.r, clamp((fpos.x - px) * .6, -9, 9), .1);
      float.style.transform = `translate(${fpos.x}px, ${fpos.y}px) translate(0, -50%) rotate(${fpos.r}deg) scale(${floatOn ? 1 : .6})`;
    }
    requestAnimationFrame(loop);
  }

  addEventListener("scroll", () => { letterbox(); litAbout(); }, { passive: true });
  addEventListener("resize", () => { letterbox(); placePill(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placePill);
  addEventListener("load", placePill);

  /* ==========================================================================
     Boot
     ========================================================================== */
  const hashFull = location.hash.slice(1), hashMode = hashFull.split("=")[0], hashRest = hashFull.slice(hashMode.length + 1);
  if (hashMode === "selection" && hashRest) { importShared(hashRest); }
  Promise.race([resolveThumbs(), wait(2500)]).then(() => {
    applyMode(CONFIG.modes[hashMode] ? hashMode : CONFIG.defaultMode);
  });
  if (!CONFIG.modes[hashMode]) history.replaceState(null, "", location.pathname);
  requestAnimationFrame(loop);
  letterbox();

  // Intro counter
  (async () => {
    const c = $(".intro__count"), dur = reduced ? 0 : 1400, start = performance.now();
    await new Promise(res => {
      const step = n => {
        const p = clamp((n - start) / dur, 0, 1);
        c.textContent = pad(Math.round(p * 100), 3);
        p < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    });
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
    placePill();
    setTimeout(() => document.body.classList.add("is-settled"), 1500);
  })();
})();
