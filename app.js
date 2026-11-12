/* ==========================================================================
   Seb Trân — portfolio interactions
   ========================================================================== */
(() => {
  "use strict";

  /* ---------- Config: edit these ---------- */
  const CONFIG = {
    email: "sebastientrandop@gmail.com",
    defaultMode: "cinematography",
    clients: ["Cartier", "Yves Saint Laurent", "Miu Miu", "Lancôme", "Chanel", "Balmain", "L'Oréal Paris",
      "Armani Beauty", "Maison Margiela", "Off-White", "Chaumet", "Kérastase", "AMI Paris", "Salomon",
      "Clarins", "Helena Rubinstein", "Paco Rabanne", "KITH", "Nowness", "La Roche-Posay"],
    modes: {
      cinematography: {
        role: "Cinematographer",
        workTitle: "Selected Cinematography",
        hud: "ISO 800 · 3200K · T1.4 · 25 FPS",
        about: "Twenty years behind the camera, lighting *luxury*, *beauty* and *fashion* for houses like Cartier, Yves Saint Laurent, Chanel and Lancôme — and music videos and short films when the story calls for it. Based in Paris, I work closely with directors to build images where light feels like *skin* and every frame holds a breath longer than expected."
      },
      direction: {
        role: "Director",
        workTitle: "Directed Films",
        hud: "SC 01 · TK 03 · REC · 25 FPS",
        about: "As a director I start from the *light* and build outward — beauty and fashion films for Miu Miu, Armani Beauty and L'Oréal Paris, shot with the eye of a cinematographer and cut with an obsession for *texture*, *rhythm* and *intimacy*. Small crews, precise images, faces that stay with you."
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

  const thumb = (f, size = "1280x720") => `${f.thumb}_${size}`;
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
  const fmtDur = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  const credits = f => [f.director && `Dir. ${f.director}`, f.production && `Prod. ${f.production}`].filter(Boolean).join(" — ");

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
  let heroFilm = null;
  function setHero(f) {
    heroFilm = f;
    heroPoster.src = thumb(f, "1920x1080");
    heroTitle.textContent = `${f.client} — ${f.title}`;
    heroVideo.classList.remove("is-on");
    const old = heroVideo.querySelector("iframe");
    setTimeout(() => old && old.remove(), 1400);
    if (reduced) return;
    const ifr = makeIframe(vimeo(f, bgParams()), `${f.client} — ${f.title}`);
    heroVideo.appendChild(ifr);
    onPlay(ifr, () => heroVideo.classList.add("is-on"));
  }
  $("[data-hero-play]").addEventListener("click", () => heroFilm && openLightbox(state.list.indexOf(heroFilm) >= 0 ? state.list : [heroFilm], Math.max(0, state.list.indexOf(heroFilm)), heroPoster));
  $("[data-hero-play]").dataset.cursor = "play";

  /* ==========================================================================
     Work — grid + index
     ========================================================================== */
  const grid = $("[data-grid]"), index = $("[data-index]"), filtersEl = $("[data-filters]");
  const PATTERN = [7, 5, 4, 4, 4, 5, 7, 12, 6, 6, 4, 4, 4, 8, 4];

  function renderFilters() {
    const all = FILMS[state.mode];
    const cats = ["All", ...new Set(all.map(f => f.category))];
    filtersEl.innerHTML = cats.map(c => {
      const n = c === "All" ? all.length : all.filter(f => f.category === c).length;
      return `<button class="chip${c === state.filter ? " is-active" : ""}" data-filter="${esc(c)}">${esc(c)}<sup>${n}</sup></button>`;
    }).join("");
  }
  filtersEl.addEventListener("click", e => {
    const b = e.target.closest("[data-filter]"); if (!b) return;
    state.filter = b.dataset.filter; renderFilters(); renderWork();
  });

  $$("[data-view]").forEach(b => b.addEventListener("click", () => {
    state.view = b.dataset.view;
    $$("[data-view]").forEach(x => x.classList.toggle("is-active", x === b));
    grid.hidden = state.view !== "grid"; index.hidden = state.view !== "index";
    stopAllPreviews();
  }));

  function renderWork() {
    stopAllPreviews();
    const all = FILMS[state.mode];
    state.list = state.filter === "All" ? all : all.filter(f => f.category === state.filter);
    $("[data-count]").textContent = pad(state.list.length);

    grid.innerHTML = state.list.map((f, i) => {
      const span = state.filter === "All" ? PATTERN[i % PATTERN.length] : [6, 6, 4, 4, 4][i % 5];
      const words = esc(f.client).split(" ").map(w => `<span class="w">${w}</span>`).join(" ");
      return `<button class="card s-${span}" data-i="${i}" data-cursor="play" aria-label="Play ${esc(f.client)} — ${esc(f.title)}">
        <div class="card__frame">
          <img src="${thumb(f, span >= 7 ? "1280x720" : "960x540")}" alt="" loading="lazy">
          <div class="cover"></div>
          <span class="card__num mono">${pad(i + 1)}</span>
          <span class="card__dur mono">${fmtDur(f.duration)}</span>
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

    index.innerHTML = state.list.map((f, i) => `
      <li class="row" data-i="${i}" data-cursor="play" tabindex="0">
        <span class="row__num">${pad(i + 1)}</span>
        <span class="row__client">${esc(f.client)}</span>
        <span class="row__title">${esc(f.title)}</span>
        <span class="row__dir">${esc(f.director ? "Dir. " + f.director : "—")}</span>
        <span class="row__cat">${esc(f.category)}</span>
        <span class="row__yr">${esc(f.year || "")}</span>
      </li>`).join("");

    bindCards(); bindRows(); revealCards();
  }

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
    if (cover.firstChild) return;
    const ifr = makeIframe(vimeo(f, bgParams("540p")), f.client);
    cover.appendChild(ifr);
    onPlay(ifr, () => card.classList.add("is-playing"));
  }
  function stopPreview(card) {
    if (!card) return;
    card.classList.remove("is-playing");
    const cover = $(".cover", card);
    setTimeout(() => { if (!card.classList.contains("is-hover") && !card.classList.contains("is-auto")) cover.innerHTML = ""; }, 600);
  }
  function stopAllPreviews() {
    $$(".card").forEach(c => { c.classList.remove("is-playing", "is-hover", "is-auto"); const cv = $(".cover", c); if (cv) cv.innerHTML = ""; });
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
        clearTimeout(hoverTimer); hoverTimer = setTimeout(() => startPreview(card), 140);
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
    $(".lightbox__cat", lb).textContent = `${pad(lbIdx + 1)} / ${pad(lbList.length)} — ${f.category}${f.year ? " — " + f.year : ""}`;
    $(".lightbox__title", lb).innerHTML = `${esc(f.client)} <em>${esc(f.title)}</em>`;
    const role = state.mode === "direction" ? "Directed & photographed by Seb Trân" : "Cinematography by Seb Trân";
    $(".lightbox__credits", lb).textContent = [role, credits(f)].filter(Boolean).join(" — ");
  }
  function loadPlayer(f) {
    lbPlayer.innerHTML = "";
    const accent = getComputedStyle(document.body).getPropertyValue("--accent").trim().replace("#", "");
    lbPlayer.appendChild(makeIframe(vimeo(f, { autoplay: 1, title: 0, byline: 0, portrait: 0, color: accent }), `${f.client} — ${f.title}`));
  }
  async function openLightbox(list, i, fromEl) {
    lbList = list; lbIdx = i;
    const f = list[i];
    stopAllPreviews();
    heroVideo.querySelector("iframe")?.setAttribute("data-paused", "1");
    lb.hidden = false; document.body.style.overflow = "hidden"; cursor.classList.add("is-hidden");
    fillInfo(f);
    // FLIP ghost from the clicked frame to the player box
    const from = (fromEl || lbPlayer).getBoundingClientRect();
    Object.assign(ghost.style, { transition: "none", left: from.left + "px", top: from.top + "px", width: from.width + "px", height: from.height + "px", opacity: 1, backgroundImage: `url("${thumb(f)}")` });
    requestAnimationFrame(() => {
      lb.classList.add("is-open");
      const to = lbPlayer.getBoundingClientRect();
      requestAnimationFrame(() => {
        Object.assign(ghost.style, { transition: "", left: to.left + "px", top: to.top + "px", width: to.width + "px", height: to.height + "px" });
      });
    });
    await wait(reduced ? 0 : 820);
    loadPlayer(f);
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
    if (b) { b.dataset.lb === "close" ? closeLightbox() : stepLightbox(b.dataset.lb === "next" ? 1 : -1); return; }
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
    const a = $(`.switch__btn[data-mode="${state.mode}"]`); if (!a) return;
    pill.style.width = a.offsetWidth + "px";
    pill.style.transform = `translateX(${a.offsetLeft}px)`;
  }
  function applyMode(mode) {
    const M = CONFIG.modes[mode];
    state.mode = mode; state.filter = "All";
    document.body.classList.toggle("mode-direction", mode === "direction");
    $$(".switch__btn").forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle("is-active", on); b.setAttribute("aria-selected", on); });
    placePill();
    $("[data-work-title]").textContent = M.workTitle;
    $(".hud__meta").textContent = M.hud;
    document.title = `Seb Trân — ${M.role}`;
    scramble($("[data-role]"), M.role);
    renderAbout(M.about);
    renderFilters(); renderWork();
    if (FILMS[mode][0]) setHero(FILMS[mode][0]);
  }
  async function setMode(mode, animate = true) {
    if (!CONFIG.modes[mode] || mode === state.mode) return;
    history.replaceState(null, "", `#${mode}`);
    if (!animate || reduced) return applyMode(mode);
    shutter.classList.add("is-closed");
    await wait(560);
    applyMode(mode);
    await wait(250);
    shutter.classList.remove("is-closed");
  }
  $$(".switch__btn").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  addEventListener("hashchange", () => { const m = location.hash.slice(1); if (CONFIG.modes[m]) setMode(m); });

  /* ==========================================================================
     Misc: nav scroll, marquee, contact, footer
     ========================================================================== */
  $$("[data-scroll]").forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    const t = document.getElementById(a.dataset.scroll);
    t && scrollTo({ top: a.dataset.scroll === "hero" ? 0 : t.offsetTop - 20, behavior: reduced ? "auto" : "smooth" });
  }));
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

  /* ==========================================================================
     Boot
     ========================================================================== */
  const hashMode = location.hash.slice(1);
  applyMode(CONFIG.modes[hashMode] ? hashMode : CONFIG.defaultMode);
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
