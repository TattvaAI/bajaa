/* BAJAA — room-led listening with two preloaded DJ decks. */
(() => {
  "use strict";

  const validSong = song =>
    song && Array.isArray(song.youtube_ids) && song.youtube_ids.length && Number.isFinite(song.duration_sec) && song.duration_sec > 30 &&
    Number.isFinite(song.entry_sec) && song.entry_sec >= 0 && song.entry_sec < song.duration_sec &&
    (song.exit_sec == null || (song.exit_sec > song.entry_sec && song.exit_sec <= song.duration_sec));
  const LIB=[];
  const app = document.getElementById("app");
  const SHOW_PLAYER_TILE = false;
  const REPLAY = "naux.replay";
  const PENDING = "naux.pendingSet";
  const FREE_KEY = "naux.freeSetsUsed";
  const LS = (k, d) => { try { const v = localStorage.getItem(k); const parsed = v === null ? d : JSON.parse(v); return Array.isArray(d) && !Array.isArray(parsed) ? d : parsed; } catch { return d; } };
  const LSSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { window.BAJAADesign?.notice("This browser could not save your changes. Check site storage permissions."); return false; } };
  const fmtTime = (s) => { const t = Math.max(0, Math.round(s || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

  function h(tag, props = {}, ...kids) {
    const SVG = ["svg", "path", "rect", "circle", "line", "polygon", "g"].includes(tag);
    const n = SVG ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") { if (SVG) n.setAttribute("class", v); else n.className = v; }
      else if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "dataset") Object.assign(n.dataset, v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(9)) {
      if (kid === null || kid === undefined || kid === false) continue;
      n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return n;
  }

  const LANGUAGES = [
    { id: "hindi", label: "Hindi", subtypes: [
      { id: "dance", label: "Dance" }, { id: "retro", label: "Retro" }, { id: "romantic", label: "Romantic" },
      { id: "sufi", label: "Sufi" }, { id: "hiphop", label: "Desi Hip-Hop" }] },
    { id: "punjabi", label: "Punjabi", subtypes: [
      { id: "party", label: "Party" }, { id: "wedding", label: "Wedding" }, { id: "sad", label: "Sad" }, { id: "gym", label: "Gym / Workout" }] },
    { id: "english", label: "English", subtypes: [
      { id: "hiphop", label: "Hip-Hop" }, { id: "pop", label: "Pop" }, { id: "love", label: "Love" }, { id: "edm", label: "EDM" }] },
    { id: "tamil-telugu", label: "Tamil / Telugu", subtypes: [
      { id: "kuthu", label: "Kuthu" }, { id: "melody", label: "Melody" }, { id: "mass", label: "Mass" }] },
    { id: "haryanvi-bhojpuri", label: "Haryanvi / Bhojpuri", subtypes: [
      { id: "party", label: "Party" }, { id: "desi-beats", label: "Desi Beats" }] },
    { id: "gujarati", label: "Garba / Gujarati", subtypes: [{ id: "garba", label: "Garba & Dandiya" }] }
  ];
  const MIN_LANGUAGE_SONGS = 10;
  const LANG_NAMES = "hindi|punjabi|english|tamil|telugu|gujarati|bhojpuri|haryanvi|marathi|bengali|kannada|malayalam";
  const SLOW = new Set(["romantic", "sad", "sufi", "love", "melody"]);
  const TITLE_NOISE = new RegExp(`^(?:feat\\.?|ft\\.?|featuring|from|official|video|audio|lyrics?|title (?:track|song)|official (?:music )?(?:video|audio|song)|(?:full |lyric(?:al)? |music |audio |video )(?:video|song|audio)(?: song)?|lyrical|full song|original motion picture(?: soundtrack)?)\\b`, "i");
  const LANG_ONLY = new RegExp(`^(?:${LANG_NAMES})(?:\\s*[+/&,]\\s*(?:${LANG_NAMES}))*(?:\\s+(?:version|ver\\.?))?$`, "i");

  const isSlow = (e) => [e.subtype, ...(e.tags || [])].some((x) => SLOW.has(x));
  const isUpbeat = (e) => !SLOW.has(e.subtype);
  function inLanguage(e, t) {
    return e.language === t || (t === "hindi" && !!e.crossover && !SLOW.has(e.subtype) && e.energy >= 7);
  }
  function fitsSubtype(e, t) {
    const [i, s] = t.split(":");
    if (i === "hindi" && s === "dance" && e.language !== "hindi") return inLanguage(e, "hindi");
    return e.language === i && (e.subtype === s || ((!SLOW.has(e.subtype) || SLOW.has(s)) && (e.tags || []).includes(s)));
  }
  const playedSeconds = (e) => e.play_full ? e.duration_sec : (e.exit_sec ?? e.duration_sec) - e.entry_sec;
  const songMap = new Map(LIB.map((s) => [s.song_id, s]));

  function hashSeed(seed) {
    let u = seed;
    return () => {
      u |= 0;
      let e = Math.imul((u = (u + 0x6d2b79f5) | 0) ^ (u >>> 15), 1 | u);
      return (((e = (e + Math.imul(e ^ (e >>> 7), 61 | e)) ^ e) ^ (e >>> 14)) >>> 0) / 0x100000000;
    };
  }

  function buildSetlist(lib, c, now = Date.now()) {
    const target = { warmup: { small: 4, medium: 5, large: 6 }, peak: { small: 6, medium: 7, large: 8.5 }, winddown: { small: 3, medium: 4, large: 4.5 }, bangers: { small: 8.5, medium: 8.5, large: 9 } }[c.time][c.crowd];
    const rnd = hashSeed(now);
    let ranked = lib.map((e) => {
      const langHits = c.languages.filter((t) => inLanguage(e, t));
      const inLang = langHits.length > 0;
      const subHit = c.subtypes.some((t) => fitsSubtype(e, t));
      const takeAny = langHits.some((l) => !c.subtypes.some((t) => t.startsWith(`${l}:`)));
      let score = 0;
      if (inLang) score += 10;
      if (subHit) score += 6; else if (inLang && takeAny) score += 3;
      score -= 1.5 * Math.abs(e.energy - target);
      score += 0.5 * rnd();
      const offMood = !subHit && SLOW.has(e.subtype) && c.time !== "winddown";
      const hiphopOut = !subHit && e.language === "hindi" && e.subtype === "hiphop";
      const fame = e.fame ?? 2;
      return { c: e, score: (score += 2 * fame), match: inLang && !(!subHit && fame === 1) && !hiphopOut && (subHit || (takeAny && !offMood)) };
    }).filter((x) => x.match).sort((a, b) => b.score - a.score);

    const famous = ranked.filter((x) => (x.c.fame ?? 2) > 1);
    if (famous.length >= 10) ranked = famous;
    if (c.subtypes.length) {
      if (c.time === "peak") { const f = ranked.filter((x) => x.c.energy >= target - 1); if (f.length >= 10) ranked = f; }
    } else {
      const w = c.time === "peak" ? 2 : 3;
      const f = ranked.filter((x) => Math.abs(x.c.energy - target) <= w);
      if (f.length >= 10) ranked = f;
    }
    let allBangers = false;
    if (c.time === "bangers") {
      const bang = (n) => ranked.filter((x) => !isSlow(x.c) && (x.c.banger ?? x.c.energy >= n));
      ranked = bang(8).length >= 10 ? bang(8) : bang(7).length ? bang(7) : [...ranked].sort((a, b) => b.c.energy - a.c.energy).slice(0, 15);
      allBangers = ranked.every((x) => !isSlow(x.c) && (x.c.banger ?? x.c.energy >= 7));
    }
    const foreign = (e) => !c.languages.includes(e.language);
    const maxForeign = Math.floor(ranked.filter((x) => !foreign(x.c)).length / 2);
    let addedForeign = 0;
    let picked = ranked.filter((x) => !foreign(x.c) || addedForeign++ < maxForeign).map((x) => x.c);
    const fillers = new Set();
    let note = null;
    if (picked.length < 10) {
      const have = new Set(picked.map((e) => e.song_id));
      const names = c.subtypes.map((s) => s.split(":")[1]);
      const wantsSlow = names.length ? names.some((x) => SLOW.has(x)) : c.time === "winddown";
      const wantsUp = names.length ? names.some((x) => !SLOW.has(x)) : c.time !== "winddown";
      const avg = picked.length ? picked.reduce((n, x) => n + x.energy, 0) / picked.length : target;
      const subSet = new Set(names);
      const extra = lib.filter((e) => !have.has(e.song_id))
        .filter((e) => (wantsSlow && isSlow(e)) || (wantsUp && isUpbeat(e)))
        .filter((e) => !(e.language === "hindi" && e.subtype === "hiphop" && !subSet.has("hiphop")))
        .filter((e) => (e.fame ?? 2) > 1)
        .filter((e) => Math.abs(e.energy - avg) <= 3)
        .map((e) => {
          let s = 0;
          if (c.languages.some((t) => inLanguage(e, t))) s += 10;
          if ([e.subtype, ...(e.tags || [])].some((x) => subSet.has(x))) s += 6;
          s -= 1.5 * Math.abs(e.energy - avg);
          return { c: e, score: (s += 0.5 * rnd()) };
        }).sort((a, b) => b.score - a.score).map((x) => x.c)
        .filter((e) => !allBangers || (!isSlow(e) && (e.banger ?? e.energy >= 7)))
        .slice(0, 10 - picked.length);
      for (const e of extra) fillers.add(e.song_id);
      if (extra.length) {
        const label = (id) => LANGUAGES.find((l) => l.id === id)?.label.split(" /")[0] ?? id;
        const subLabel = c.subtypes.map((s) => { const [i, x] = s.split(":"); const lab = LANGUAGES.find((l) => l.id === i)?.subtypes.find((q) => q.id === x)?.label ?? x; return `${label(i)} ${lab.toLowerCase()}`; });
        const what = subLabel.length ? subLabel.join(" + ") : c.languages.map(label).join(" + ");
        const mood = extra.every(isSlow) ? "slow " : extra.every(isUpbeat) ? "upbeat " : "";
        const from = [...new Set(extra.filter((e) => !c.languages.includes(e.language)).map((e) => label(e.language)))];
        const fromText = from.length && from.length === new Set(extra.map((e) => e.language)).size ? ` from ${from.join(" and ")}` : "";
        note = `Only ${picked.length} ${what} song${picked.length === 1 ? "" : "s"} so far. Added ${extra.length} ${mood}one${extra.length === 1 ? "" : "s"}${fromText} that fit the mood.`;
        picked = [...picked, ...extra];
      }
    }
    // Shape the energy curve and keep artists apart.
    const shape = (arr, time, target, rnd2) => {
      const shuffle = (list) => { const t = [...list]; for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rnd2() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } return t; };
      const sorted = [...arr].sort((a, b) => a.energy - b.energy);
      const n = Math.ceil(sorted.length / 3);
      const chunked = [sorted.slice(0, n), sorted.slice(n, 2 * n), sorted.slice(2 * n)].map(shuffle);
      if (time === "warmup") return chunked.flat();
      if (time === "bangers") return shuffle(arr);
      if (time === "winddown") return [...chunked].reverse().flat();
      const opener = shuffle(sorted.filter((e) => e.energy >= target - 2 && e.energy < target)).slice(0, 3);
      const rest = [...chunked].reverse().flat().filter((e) => !opener.includes(e));
      const mid = Math.ceil(rest.length / 2), a = rest.slice(0, mid), b = rest.slice(mid), out = [];
      for (let i = 0; i < mid; i++) { if (b[i]) out.push(b[i]); out.push(a[i]); }
      return [...opener, ...out];
    };
    const alt = (arr, foreignFn) => {
      const local = arr.filter((e) => !foreignFn(e)), away = arr.filter(foreignFn);
      if (!away.length || !local.length) return arr;
      const out = []; let run = 0;
      while (local.length || away.length) {
        if (away.length && out.length > 0 && run >= 2) { out.push(away.shift()); run = 0; }
        else if (local.length) { out.push(local.shift()); run++; }
        else out.push(away.shift());
      }
      return out;
    };
    const artistKey = (e) => e.artist.split(/,|&|\bft\.?|\bfeat\.?/i)[0].trim().toLowerCase();
    const cues = alt(shape(picked, c.time, target, rnd), (e) => !c.languages.includes(e.language));
    for (let i = 1; i < cues.length; i++) {
      if (artistKey(cues[i]) !== artistKey(cues[i - 1])) continue;
      const j = cues.findIndex((s, k) => k > i && artistKey(s) !== artistKey(cues[i - 1]));
      if (j > 0) [cues[i], cues[j]] = [cues[j], cues[i]];
    }
    // Keep the whole matching room mix so listening isn't cut short at 45 minutes.
    return { cues, fillers, note };
  }

  /* ---- local "server" ---- */
  const sessionId = () => {
    try { let s = localStorage.getItem("naux.session"); if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("naux.session", s); } return s; } catch { return "anon"; }
  };
  function reportEvent(e) {
    const log = LS("naux.events", []); log.push({ ...e, ts: new Date().toISOString(), session: sessionId() }); LSSet("naux.events", log.slice(-500));
  }
  function trafficSource() { return LS("naux.src", null); }
  function captureSource() {
    try {
      const q = new URLSearchParams(location.search);
      const src = [q.get("utm_source"), q.get("utm_campaign"), q.get("utm_content")].filter(Boolean).join("/").slice(0, 80) || (q.get("fbclid") ? "meta" : null);
      if (src) LSSet("naux.src", { src, at: Date.now() });
    } catch {}
  }
  const freeSetsUsed = () => Number(LS(FREE_KEY, 0)) || 0;
  const markFreeSetUsed = () => { try { localStorage.setItem(FREE_KEY, String(freeSetsUsed() + 1)); } catch {} };
  function getUser() { return window.BAJAAAccount?.user || null; }
  function setUser(u) { u ? LSSet("naux.user", u) : localStorage.removeItem("naux.user"); }
  function signIn(pending) {
    if (pending) LSSet(PENDING, pending);
    demoSignIn();
  }
  function signOut() { setUser(null); location.href = "/"; }
  const saveSet = (s) => { const all = LS("naux.sets", []); const item = { id: "s" + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)), created_at: new Date().toISOString(), ...s }; all.unshift(item); return LSSet("naux.sets", all) ? item.id : null; };
  function renameSet(id, name) { const all = LS("naux.sets", []); const x = all.find((s) => s.id === id); if (x) { x.name = name; LSSet("naux.sets", all); } return !!x; }
  function requestSong(text, source) { const all = LS("naux.requests", []); all.push({ text, source: source || null, ts: new Date().toISOString(), session: sessionId() }); return LSSet("naux.requests", all); }

  /* ---- player engine (ported) ---- */
  let ytPromise = null;
  function loadYouTubeIframeApi(timeout = 15000) {
    if (window.YT && typeof window.YT.Player === "function") return Promise.resolve(window.YT);
    return ytPromise || (ytPromise = new Promise((resolve, reject) => {
      const fail = (m) => { ytPromise = null; reject(Error(m)); };
      const timer = setTimeout(() => fail("YouTube IFrame API did not become ready. Check the network or an ad/script blocker."), timeout);
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); prev?.(); resolve(window.YT); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api"; s.async = true;
      s.onerror = () => { clearTimeout(timer); fail("Failed to download the YouTube IFrame API script."); };
      document.head.appendChild(s);
    }));
  }
  const deckState = (id) => ({ id, player: null, status: "empty", role: "preload", cue: null, idIndex: 0, playFull: false, timer: null, volumeFixed: false });

  class PlayerEngine {
    constructor(host, opts = {}) { this.host = host; this.opts = opts; this.decks = { A: deckState("A"), B: deckState("B") }; this.queue = []; this.nextIndex = 0; this.liveId = null; this.crossfading = false; this.paused = false; this.pauseAfterFade = false; this.endingSet = false; this.awaitingStart = null; this.pendingHandoff = null; this.ready = false; this.started = false; this.finished = false; this.destroyed = false; this.tickTimer = null; this.fadeTimer = null; this.initPromise = null; this.blocked = false; this.ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1; }
    init() { if(this.initPromise)return this.initPromise; return this.initPromise=this.initialize(); }
    async initialize() {
      const YT = await loadYouTubeIframeApi();
      if (this.destroyed) return;
      if (this.opts.styleHost !== false) Object.assign(this.host.style, { position: "fixed", left: "0", bottom: "0", width: "320px", height: "180px", opacity: "0", pointerEvents: "none", zIndex: "-1", overflow: "hidden" });
      await Promise.all([this.createPlayer(YT, this.decks.A), this.createPlayer(YT, this.decks.B)]);
      if (this.destroyed) return;
      this.ready = true; this.tickTimer = setInterval(() => this.tick(), 200); this.emit();
    }
    start(cues) {
      if (!this.ready) throw Error("start before init"); if (this.started) return;
      this.started = true; this.queue = cues.slice(); this.nextIndex = 0;
      const first = this.takeNextCue(); if (!first) return this.finish("Queue is empty, nothing to play.");
      const d = this.decks.A; this.liveId = "A"; this.assign(d, first); this.load(d, "live"); this.preloadNext(this.decks.B);
    }
    skip() { const d = this.liveDeck(); if (!this.started || this.finished || !d?.cue || this.crossfading || this.awaitingStart) return; if (this.paused) this.paused = false; const at = d.status === "live" ? (d.player?.getCurrentTime() ?? 0) : 0; this.event({ type: "skip", cue: d.cue, at }); this.requestHandoff("skip"); }
    seek(to) {
      const d = this.liveDeck(); if (!d?.player || !d.cue || d.status !== "live" || this.finished || this.crossfading || this.awaitingStart) return;
      const dur = d.player.getDuration(); const s = Math.max(0, Math.min(to, dur > 0 ? dur - 3 : to)); const from = d.player.getCurrentTime();
      const cut = this.cutPoint(d); if (Number.isFinite(cut) && s >= cut - 3) { d.playFull = true; if (this.pendingHandoff === "exit") this.pendingHandoff = null; }
      d.player.seekTo(s, true); this.event({ type: "seek", cue: d.cue, from, to: s, playFull: d.playFull }); this.emit();
    }
    playFullCurrent() { const d = this.liveDeck(); if (!d?.cue || this.finished || d.playFull) return; d.playFull = true; if (this.pendingHandoff === "exit" && !this.awaitingStart) this.pendingHandoff = null; this.event({ type: "playfull", cue: d.cue, at: d.player?.getCurrentTime?.() ?? 0 }); this.emit(); }
    pause() { const d = this.liveDeck(); if (!this.started || this.finished || this.paused || !d?.cue) return; if (this.crossfading || this.awaitingStart) { this.pauseAfterFade = true; this.emit(); return; } if (d.status !== "live" || !d.player) return; d.player.pauseVideo(); this.paused = true; this.event({ type: "paused", cue: d.cue, at: d.player.getCurrentTime() }); this.emit(); }
    resume() { this.pauseAfterFade = false; const d = this.liveDeck(); if (!this.paused || !d?.player || !d.cue) return; this.paused = false; d.player.playVideo(); this.event({ type: "resumed", cue: d.cue, at: d.player.getCurrentTime() }); this.emit(); if (this.pendingHandoff && !this.awaitingStart) this.requestHandoff(this.pendingHandoff); }
    requeue(cues) { if (!this.started || this.finished || this.endingSet) return; this.queue = cues; this.nextIndex = 0; const d = this.liveDeck(); if (!d || this.crossfading || this.awaitingStart) return; const other = this.otherDeck(d.id); if (other.cue && cues[0]?.song_id === other.cue.song_id) { this.nextIndex = 1; return; } this.clearTimer(other); other.player?.pauseVideo(); other.player?.mute(); this.preloadNext(other); }
    dropNext() { const d = this.liveDeck(); if (!d || this.finished || this.endingSet || this.crossfading || this.awaitingStart) return null; const o = this.otherDeck(d.id), cue = o.cue; if (!cue) return null; this.clearTimer(o); o.player?.pauseVideo(); o.player?.mute(); this.preloadNext(o); return cue; }
    playNext(cue) { const d = this.liveDeck(); if (!d || this.finished) return; const nxt = this.otherDeck(d.id).cue; const list = [cue, ...(nxt ? [nxt] : []), ...this.upcoming()].filter((e, i, a) => a.findIndex((t) => t.song_id === e.song_id) === i && e.song_id !== d.cue?.song_id); this.requeue(list); }
    upcoming() { return this.queue.slice(this.nextIndex); }
    togglePause() { this.paused || this.pauseAfterFade ? this.resume() : this.pause(); }
    getState() { const d = (x) => ({ id: x.id, status: x.status, cue: x.cue, videoId: x.cue ? (x.cue.youtube_ids[x.idIndex] ?? null) : null, playFull: x.playFull }); return { live: this.liveId, crossfading: this.crossfading, paused: this.paused || this.pauseAfterFade, finished: this.finished, blocked:this.blocked, decks: { A: d(this.decks.A), B: d(this.decks.B) } }; }
    getCutAt() { const d = this.liveDeck(); if (!d?.player || !d.cue || d.status !== "live") return null; const t = this.cutPoint(d); return Number.isFinite(t) ? t : null; }
    getPosition() { const d = this.liveDeck(); return d?.player && d.status === "live" ? { seconds: d.player.getCurrentTime(), duration: d.player.getDuration() } : null; }
    destroy() { this.destroyed = true; clearInterval(this.tickTimer); clearInterval(this.fadeTimer); for (const d of Object.values(this.decks)) { this.clearTimer(d); try { d.player?.destroy(); } catch {} d.player = null; } this.host.innerHTML = ""; }
    createPlayer(YT, d) {
      return new Promise((resolve, reject) => {
        const frame = h("div", { class: "video-deck", dataset: { deck: d.id } });
        const node = document.createElement("div"); node.id = `bajaa-deck-${d.id}`; frame.appendChild(node); this.host.appendChild(frame);
        const timer = setTimeout(() => reject(Error(`Player ${d.id} did not become ready.`)), 15000);
        d.player = new YT.Player(node, { width: "480", height: "270", playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, playsinline: 1, rel: 0, origin: location.origin }, events: { onReady: () => { clearTimeout(timer); d.player.getIframe?.()?.setAttribute("title", "YouTube music video"); resolve(); }, onStateChange: (e) => this.onStateChange(d, e.data), onError: (e) => this.onError(d, e.data), onAutoplayBlocked: () => { if(d.role === "live" || this.awaitingStart === d.id){this.blocked=true;this.event({type:"blocked",cue:d.cue});this.emit();} } } });
      });
    }
    onStateChange(d, s) {
      if (this.destroyed || !d.cue) return;
      if (s === 1) {
        if(d.player.getPlayerState?.() !== 1)return;
        if(this.liveId===d.id || this.awaitingStart===d.id)this.blocked=false;
        if (this.liveId === d.id && this.paused) { this.paused = false; this.event({ type: "resumed", cue: d.cue }); this.emit(); }
        if (this.awaitingStart === d.id) return this.startFade(d);
        if (d.status === "loading" && d.role === "preload") { this.clearTimer(d); d.player.pauseVideo(); d.player.seekTo(this.startSecondsOf(d.cue), true); d.status = "ready"; this.emit(); if (this.pendingHandoff) this.requestHandoff(this.pendingHandoff); return; }
        if (d.status === "loading" && d.role === "live") { this.clearTimer(d); d.status = "live"; this.event({ type: "live", deck: d.id, cue: d.cue }); this.emit(); }
      }
      if (s === 2 && d.id === this.liveId && d.status === "live" && !this.paused && !this.finished && !this.awaitingStart && !this.endingSet) { this.paused = true; this.event({ type: "paused", cue: d.cue }); this.emit(); }
      if (s === 0 && d.id === this.liveId && d.status === "live" && !this.crossfading) { if (this.pendingHandoff || this.awaitingStart) this.pendingHandoff = "ended"; else this.requestHandoff("ended"); }
    }
    onError(d, code) {
      if (this.destroyed || !d.cue) return;
      if (this.awaitingStart === d.id) this.failIncoming(d);
      else if (d.status === "loading") this.nextSource(d);
      else if (d.id === this.liveId && d.status === "live") this.requestHandoff("error");
      else if (d.status === "ready") this.nextSource(d);
    }
    assign(d, cue) { d.cue = cue; d.idIndex = 0; d.playFull = cue.play_full; d.volumeFixed = false; }
    load(d, role) {
      const cue=d.cue,p=d.player;this.clearTimer(d);d.role=role;d.status="loading";
      if(role==="preload"){p.mute();p.setVolume(0);}else{this.blocked=false;p.unMute();p.setVolume(100);}
      p.loadVideoById({videoId:cue.youtube_ids[d.idIndex],startSeconds:this.startSecondsOf(cue)});
      d.timer=setTimeout(()=>{if(d.role==="live"){this.blocked=true;this.event({type:"blocked",cue});this.emit();}else this.nextSource(d);},15000);
      this.emit();
    }
    retry() {
      const d=this.awaitingStart?this.decks[this.awaitingStart]:this.liveDeck();if(!d?.player || this.finished)return;
      this.blocked=false;this.paused=false;this.pauseAfterFade=false;d.player.unMute();d.player.setVolume(this.awaitingStart?0:100);d.player.playVideo();this.emit();this.clearTimer(d);d.timer=setTimeout(()=>{if(d.player.getPlayerState()!==1){this.blocked=true;this.emit();}},8000);
    }

    nextSource(d) {
      this.clearTimer(d); const cue = d.cue; if (!cue) return; d.idIndex++;
      if (d.idIndex < cue.youtube_ids.length) return this.load(d, d.role);
      this.event({ type: "unavailable", cue });
      if (d.role === "live") { d.status = "empty"; d.cue = null; this.emit(); this.requestHandoff("error"); } else this.preloadNext(d);
    }
    preloadNext(d) { const cue = this.takeNextCue(); if (!cue) { d.status = "empty"; d.cue = null; this.emit(); if (this.pendingHandoff === "ended" || this.pendingHandoff === "error") this.finish("End of queue."); this.pendingHandoff = null; return; } this.assign(d, cue); this.load(d, "preload"); }
    takeNextCue() { return this.nextIndex < this.queue.length ? this.queue[this.nextIndex++] : null; }
    startSecondsOf(cue) { return cue.play_full ? 0 : cue.entry_sec; }
    tick() {
      if (this.destroyed) return; this.keepLiveAudible();
      if (this.destroyed || this.finished || this.paused || this.endingSet || this.crossfading || this.awaitingStart || this.pendingHandoff) return;
      const d = this.liveDeck(); if (!d?.player || !d.cue || d.status !== "live") return;
      const t = d.player.getCurrentTime(), cut = this.cutPoint(d);
      if (t >= cut && this.otherDeck(d.id).status === "empty") return this.endSetWithFade(d);
      if (t >= cut) { this.event({ type: "cut", cue: d.cue, at: t }); this.requestHandoff("exit"); }
    }
    keepLiveAudible() { if (this.finished || this.paused || this.endingSet || this.crossfading || this.awaitingStart) return; const d = this.liveDeck(), p = d?.player; if (!d || !p || d.status !== "live" || typeof p.getVolume !== "function") return; if (p.isMuted() || !(p.getVolume() >= 100)) { d.volumeFixed = true; p.unMute(); p.setVolume(100); } }
    cutPoint(d) { const dur = d.player.getDuration(); const end = dur > 0 ? dur - 1.5 : Infinity; return d.playFull || d.cue.exit_sec == null ? end : Math.min(d.cue.exit_sec, end); }
    requestHandoff(kind) {
      if (this.finished || this.crossfading || this.awaitingStart) return;
      if (this.paused) { this.pendingHandoff = kind; return; }
      const nxt = this.liveId ? this.otherDeck(this.liveId) : this.decks.B;
      if (nxt.status === "ready") this.startIncoming(nxt, kind);
      else if (nxt.status === "loading") { this.pendingHandoff = kind; const d = this.liveDeck(); if (d?.cue && d.status === "live") this.event({ type: "holding", cue: d.cue }); }
      else if (kind !== "exit") { this.liveDeck()?.player?.pauseVideo(); this.finish("End of queue."); }
    }
    startIncoming(d, kind) {
      this.pendingHandoff=kind;this.awaitingStart=d.id;
      if(this.ios){const out=this.liveDeck();out?.player?.pauseVideo();out?.player?.mute();}
      d.player.setVolume(this.ios?100:0);d.player.unMute();d.player.playVideo();
      d.timer=setTimeout(()=>{this.blocked=true;this.emit();},6000);
    }
    failIncoming(d) { this.clearTimer(d); this.awaitingStart=null;d.player?.mute();this.nextSource(d); }
    startFade(d) {
      this.clearTimer(d);this.awaitingStart=null;this.pendingHandoff=null;this.blocked=false;
      const out=this.liveDeck();d.status="live";d.role="live";this.liveId=d.id;this.crossfading=!this.ios;
      this.event({type:"live",deck:d.id,cue:d.cue});this.emit();
      if(this.ios){this.endFade(out && out!==d?out:null);return;}
      const started=performance.now();clearInterval(this.fadeTimer);
      this.fadeTimer=setInterval(()=>{
        if(this.destroyed || this.finished){clearInterval(this.fadeTimer);return;}
        const progress=Math.min(1,(performance.now()-started)/1500);
        d.player?.setVolume(Math.round(100*Math.sin(progress*Math.PI/2)));
        if(out && out!==d)out.player?.setVolume(Math.round(100*Math.cos(progress*Math.PI/2)));
        if(progress>=1){clearInterval(this.fadeTimer);this.fadeTimer=null;this.endFade(out && out!==d?out:null);}
      },40);
    }

    endFade(out) { this.crossfading = false; const d = this.liveDeck(); d?.player?.unMute(); d?.player?.setVolume(100); if (this.pauseAfterFade) { this.pauseAfterFade = false; queueMicrotask(() => this.pause()); } if (out) { out.player?.pauseVideo(); out.player?.mute(); out.status = "empty"; out.cue = null; this.emit(); this.preloadNext(out); } else this.emit(); }
    endSetWithFade(d) { this.endingSet = true; d.player?.pauseVideo(); this.finish("End of set."); }
    finish(msg) {
      if (this.finished) return;
      this.finished = true; this.pendingHandoff = null; this.awaitingStart = null;
      clearInterval(this.tickTimer); clearInterval(this.fadeTimer);
      Object.values(this.decks).forEach(d => { this.clearTimer(d); d.player?.pauseVideo(); d.player?.mute(); });
      this.event({ type: "finished", msg }); this.emit();
    }
    liveDeck() { return this.liveId ? this.decks[this.liveId] : null; }
    otherDeck(id) { return this.decks[id === "A" ? "B" : "A"]; }
    clearTimer(d) { if (d.timer) clearTimeout(d.timer); d.timer = null; }
    emit() { if (this.destroyed) return; this.host.dataset.live = this.liveId ?? ""; this.opts.onDeckChange?.(this.getState()); }
    event(e) { if (!this.destroyed) this.opts.onEvent?.(e); }
  }

  /* ---------------- app ---------------- */
  const S = {
    mode: "splash", step: 0, langs: [], subs: [], time: null, crowd: null, result: null,
    events: [], transient: null, summarySongs: [], saved: null, name: "", tick: 0,
    engine: null, deck: null, ready: false, startedAt: 0, played: [], seen: 0, user: getUser(),
    requestOpen: false, requestText: "", requestState: "idle", gate: false
  };
  let playersHost = document.querySelector(".bajaa-players") || h("div", { class: "bajaa-players", "aria-hidden": "true", dataset: { visible: "false" } });
playersHost.setAttribute("aria-hidden","true");
  document.body.appendChild(playersHost);
  const hasUser = () => !!getUser();
  const nameOf = (u) => u?.name || u?.email || "guest";

  function reset() { S.mode = "funnel"; S.step = 0; S.langs = []; S.subs = []; S.time = null; S.crowd = null; S.result = null; S.played = []; S.events = []; S.transient = null; S.summarySongs = []; S.saved = null; S.name = ""; }

  function clear() {
    (S.cleanups || []).forEach(f => { try { f(); } catch {} }); S.cleanups = [];
    if (ui) { clearInterval(ui.iv); clearInterval(ui.hintIv); ui.keyCleanup?.(); closeModal(); ui = null; }
    if (S.escHandler) { window.removeEventListener("keydown", S.escHandler); S.escHandler = null; }
    app.replaceChildren();
  }
  function mount(node) {
    const previousView = app.dataset.view;
    const focusLabel = document.activeElement?.querySelector?.(".choice-label")?.textContent;
    clear(); app.append(node);
    const view = `${S.mode}:${S.step}`; app.dataset.view = view;
    if (focusLabel && previousView === view) {
      [...node.querySelectorAll(".choice-card")].find(x => x.querySelector(".choice-label")?.textContent === focusLabel)?.focus({ preventScroll: true });
    } else if (previousView && previousView !== view) {
      window.scrollTo(0, 0); const heading = node.querySelector("h1"); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
    const exit = node.querySelector('[aria-label="Exit to home"]');
    if (exit) { const key = e => { if (e.key === "Escape" && !S.modalKey) { e.preventDefault(); exit.click(); } }; window.addEventListener("keydown", key); S.cleanups.push(() => window.removeEventListener("keydown", key)); }
  }

  function home() {
    history.replaceState(null, "", "/");
    if (S.engine) { try { S.engine.destroy(); } catch {} S.engine = null; }
    S.ready = false; reset(); splash();
  }

  /* ---- splash ---- */
  function splash() {
    S.mode="splash";
    mount(h("main",{class:"signin-page"},window.BAJAADesign.nav(),h("section",{class:"opening-room"},h("p",{class:"eyebrow"},"BAJAA · your room"),h("h1",{},"Getting you in."),h("p",{role:"status"},"Opening your account and finding the music…"))));
    access().then(ok=>{if(ok){reset();S.mode="splash";afterSplash();}}).catch(()=>window.BAJAADesign.notice("Could not open your room. Check your connection and try again."));
  }

  async function access() {
    const returnTo=location.pathname+location.search;
    if(!await window.BAJAADesign.requireSignIn(returnTo,true))return false;
    if(!LIB.length){const rows=await window.BAJAAAccount.library();if(!rows)return false;LIB.push(...rows.filter(validSong));songMap.clear();LIB.forEach(song=>songMap.set(song.song_id,song));}
    const target=sessionStorage.getItem("bajaa.returnTo");sessionStorage.removeItem("bajaa.returnTo");
    if(target && target.startsWith('/?'))history.replaceState(null,'',target);
    return true;
  }

  function afterSplashFromHome() {
    S.mode = "splash";
    afterSplash();
  }

  function afterSplash() {
    if (S.mode !== "splash" || !window.BAJAAAccount?.verified) return;
    const q = new URLSearchParams(location.search);
    if(!S.engine)initEngine();
    const engine=S.engine;engine.init().then(()=>{if(S.engine===engine){S.ready=true;S.error=null;}},e=>{if(S.engine===engine)S.error=e.message;});
    if (q.has("welcome") || q.has("signedin") || q.has("signin")) history.replaceState(null, "", "/");

    // replay a saved set
    const rep = LS(REPLAY, null); if (rep) { localStorage.removeItem(REPLAY); if (rep.songs?.length) { const cues = rep.songs.map((id) => songMap.get(id)).filter(Boolean); if (cues.length) { S.langs = rep.answers?.languages || []; S.subs = rep.answers?.subtypes || []; S.time = rep.answers?.time || "peak"; S.crowd = rep.answers?.crowd || "medium"; S.result = { cues, fillers: new Set(), note: "Your saved set" }; return prepare(); } } }

    // deep link
    const set = q.get("set");
    const langs = (q.get("lang") || "").split(",").filter((x) => LANGUAGES.some((l) => l.id === x));
    if (set && langs.length) {
      const subs = (q.get("kind") || "").split(",").filter((x) => langs.includes(x.split(":")[0]));
      S.langs = langs; S.subs = subs; S.time = "peak"; S.crowd = "medium";
      S.result = buildSetlist(LIB, { languages: langs, subtypes: subs, time: "peak", crowd: "medium" });
      S.result.note = `${set.slice(0, 60)}, ready to play. Let it play`;
      return prepare();
    }
    funnel();
  }

  function showPlayerError(message) {
    S.mode = "error";
    mount(h("main",{class:"prepare-page"},window.BAJAADesign.nav(),h("section",{},h("p",{class:"eyebrow"},"Music connection"),h("h1",{},"Let’s try again."),h("p",{},message),h("button",{class:"bajaa-button primary",onclick:()=>location.reload()},"Try again ↗"))));
  }

  function initEngine() {
    if (!playersHost.isConnected) document.body.appendChild(playersHost);
    S.engine = new PlayerEngine(playersHost, {
      styleHost: false,
      onDeckChange: (st) => { S.deck = st; if (S.mode === "playing") updatePlayer(); },
      onEvent: (ev) => {
        const n = ++S.seen; S.events.push({ ...ev, n });
        if (ev.type === "live") S.played.push({ song_id: ev.cue.song_id, title: ev.cue.title, artist: ev.cue.artist });
        if (ev.type === "skip") { const x = [...S.played].reverse().find((s) => s.song_id === ev.cue.song_id); if (x) x.skipped = true; }
        if (["skip", "seek", "playfull"].includes(ev.type)) reportEvent({ type: ev.type, song_id: ev.cue.song_id, video_id: ev.cue.youtube_ids[0] ?? null, at_sec: ev.at ?? ev.to ?? 0 });
        playerEvent(ev);
        if (ev.type === "finished") summary();
      }
    });
  }

  /* ---- shared bits ---- */
  function exitButton(onExit, confirm = false) {
    const b = h("button", { "aria-label": "Exit to home", class: "h-14 min-w-14 flex items-center justify-center gap-3 rounded-full border-2 border-white/30 font-display leading-none tracking-wide text-white/70 transition-all duration-200 hover:border-white hover:text-white active:scale-95" },
      h("svg", { viewBox: "0 0 24 24", class: "h-[42%] w-[42%]", fill: "none", stroke: "currentColor", "stroke-width": "2.6", "stroke-linecap": "round", "aria-hidden": "true" }, h("path", { d: "M6 6l12 12M18 6L6 18" })));
    let armed = false, timer;
    const go = () => {
      if (!confirm || armed) { clearTimeout(timer); onExit(); return; }
      armed = true; b.className = "h-14 min-w-14 flex items-center justify-center gap-3 rounded-full border-2 border-lime bg-lime px-6 text-ink font-display leading-none tracking-wide transition-all duration-200 active:scale-95";
      b.replaceChildren("END PARTY? ", h("span", { class: "text-[0.7em] opacity-70" }, "TAP AGAIN"));
      timer = setTimeout(() => { armed = false; b.className = "h-14 min-w-14 flex items-center justify-center gap-3 rounded-full border-2 border-white/30 font-display leading-none tracking-wide text-white/70 transition-all duration-200 hover:border-white hover:text-white active:scale-95"; b.replaceChildren(h("svg", { viewBox: "0 0 24 24", class: "h-[42%] w-[42%]", fill: "none", stroke: "currentColor", "stroke-width": "2.6", "stroke-linecap": "round", "aria-hidden": "true" }, h("path", { d: "M6 6l12 12M18 6L6 18" }))); }, 2500);
    };
    b.addEventListener("click", go);
    return b;
  }

  function header(step) {
    const nav = window.BAJAADesign.nav("build");
    if (Number.isInteger(step)) nav.append(h("div", { class: "setup-progress", "aria-label": `Setup step ${step + 1} of 4` },
      ["Languages", "Your sound", "The mood", "The crowd"].map((label, i) => h("span", { class: i === step ? "current" : i < step ? "complete" : "", "aria-current": i === step ? "step" : null }, h("span", { class: "step-number", "aria-hidden": "true" }, i < step ? "✓" : i + 1), label))));
    return nav;
  }

  function requestButton() {
    const root = h("div", { class: "song-request" });
    const open = h("button", { class: "request-open", onclick: () => {
      const input = h("input", { id: "bajaa-request", name: "song-request", autocomplete: "off", maxlength: "200", placeholder: "e.g. Tauba Tauba, Karan Aujla…" });
      const form = h("form", { class: "request-form" }, h("label", { for: "bajaa-request" }, "Missing a song?"), h("div", { class: "request-fields" }, input, h("button", { type: "submit", class: "bajaa-button primary" }, "Save request")), h("p", { class: "request-help" }, "Requests stay on this device until the service is connected."));
      form.addEventListener("submit", e => {
        e.preventDefault(); if (input.value.trim().length < 2) { input.setCustomValidity("Enter a song or artist name."); input.reportValidity(); return; }
        if (!requestSong(input.value.trim())) return; root.replaceChildren(h("p", { class: "request-success", role: "status" }, "Request saved on this device."));
      }); input.addEventListener("input", () => input.setCustomValidity("")); root.replaceChildren(form); input.focus();
    } }, "+ Missing a song?");
    root.append(open); return root;
  }

  function langCount(id, sub) { return sub ? LIB.filter((e) => fitsSubtype(e, `${id}:${sub}`)).length : LIB.filter((e) => inLanguage(e, id)).length; }

  function card({ label, hint, selected, onclick, dim, compact, tall }) {
    return h("button", { onclick, "aria-pressed": selected ? "true" : "false", class: `choice-card ${selected ? "selected" : ""} ${compact ? "compact" : ""} ${tall ? "tall" : ""} ${dim && !selected ? "dim" : ""}` },
      h("span", { class: "choice-copy" },h("span", { class: "choice-label" }, label),
      hint ? h("span", { class: "choice-hint" }, hint) : null),
      h("span", { class: "choice-check", "aria-hidden": "true" }, selected ? "✓" : "+"));
  }

  function nextButton(onclick, disabled) {
    return h("button", { onclick, disabled, class: "bajaa-button primary setup-next" }, disabled?"Choose a language to continue":"Continue", h("span", { "aria-hidden": "true" }, "→"));
  }

  function shell(title, sub, { onBack, children, step }) {
    const titles = ["What are we playing?", "Find your sound.", "Set the mood.", "Who's in the room?"];
    return h("main", { class: `setup-page setup-step-${step}` },
      header(step),h("p",{class:"room-ticket"},"BAJAA / ROOM NO. 01",h("span",{},"You bring the people. We bring the songs.")),
      h("section", { class: "setup-content" },
        h("div", { class: "setup-heading" },
          onBack ? h("button", { onclick: onBack, class: "back-button" }, "← Back") : h("span", { class: "setup-lead" }, "Make yourself comfortable"),
          h("h1", { tabindex: "-1" }, titles[step] || title),
          sub ? h("p", null, sub) : null),
        h("div", { class: "setup-choices" }, children)));
  }

  function funnel() {
    if (S.mode === "playing" || !window.BAJAAAccount?.verified) return;
    S.mode = "funnel";
    const step = S.step;
    if (step === 0) {
      const langs = LANGUAGES.filter((l) => langCount(l.id) >= MIN_LANGUAGE_SONGS);
      const soon = LANGUAGES.filter((l) => langCount(l.id) < MIN_LANGUAGE_SONGS);
      const kids = h("div", { class: "grid gap-4 sm:grid-cols-2" }, langs.map((l) => card({ selected: S.langs.includes(l.id), onclick: () => { S.langs = S.langs.includes(l.id) ? S.langs.filter((x) => x !== l.id) : [...S.langs, l.id]; S.subs = S.subs.filter(x => S.langs.includes(x.split(":")[0])); funnel(); }, label: l.label, hint: `${langCount(l.id)} song${langCount(l.id) === 1 ? "" : "s"} ready`, dim: langCount(l.id) === 0 })));
      const node = shell("What are we playing?", "Pick every language the room wants.", { step, children: [

        kids,
        soon.length ? h("p", { class: "mt-6 text-lg text-white/45" }, "Coming soon: ", soon.map((l) => l.label).join(", "), ".") : null,
        h("div", { class: "mt-10 flex flex-wrap items-center justify-between gap-6" }, nextButton(() => { S.step = 1; funnel(); }, S.langs.length === 0)),
        h("p", { class: "mt-12 text-lg text-white/40" }, "Plays through YouTube · ", h("a", { href: "/songs", class: "underline hover:text-white" }, "Moods"), " · ", h("a", { href: "/privacy", class: "underline hover:text-white" }, "Privacy"), " · ", h("a", { href: "/terms", class: "underline hover:text-white" }, "Terms")),
      ] });
      mount(node); return;
    }
    if (step === 1) {
      const chosen = LANGUAGES.filter((l) => S.langs.includes(l.id));
      const node = shell("What kind?", "Optional. Leave these open and we’ll find the sound.", { step, onBack: () => { S.step = 0; funnel(); }, children: [
        h("div", { class: "flex flex-col gap-8" }, chosen.map((l) => h("div", null,
          h("h3", { class: "mb-3 font-display text-3xl uppercase tracking-wide text-white/60" }, l.label),
          h("div", { class: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4" }, l.subtypes.filter((x) => langCount(l.id, x.id) > 0).map((x) => {
            const id = `${l.id}:${x.id}`;
            return card({ selected: S.subs.includes(id), onclick: () => { S.subs = S.subs.includes(id) ? S.subs.filter((q) => q !== id) : [...S.subs, id]; funnel(); }, label: x.label, hint: `${langCount(l.id, x.id)} ready`, dim: langCount(l.id, x.id) === 0, compact: true });
          }))))),
      ] });
      node.append(nextButton(() => { S.step = 2; funnel(); }));
      mount(node); return;
    }
    if (step === 2) {
      const times = [{ id: "warmup", label: "Warming up", hint: "People arriving, building slowly" }, { id: "peak", label: "Peak", hint: "Full room, dancefloor energy" }, { id: "winddown", label: "Winding down", hint: "Late, easing off" }, { id: "bangers", label: "Only bangers", hint: "High energy only, no slow songs" }];
      mount(shell("Where in the night are we?", null, { step, onBack: () => { S.step = 1; funnel(); }, children: h("div", { class: "grid gap-4 md:grid-cols-2" }, times.map((t) => card({ selected: S.time === t.id, label: t.label, hint: t.hint, tall: true, onclick: () => { S.time = t.id; S.step = 3; funnel(); } }))) }));
      return;
    }
    const crowds = [{ id: "small", label: "4–6", hint: "Music you can talk over" }, { id: "medium", label: "10–20", hint: "A proper party" }, { id: "large", label: "20+", hint: "A dancefloor" }];
    mount(shell("How many people?", null, { step, onBack: () => { S.step = 2; funnel(); }, children: h("div", { class: "grid gap-4 md:grid-cols-3" }, crowds.map((c) => card({ selected: false, label: c.label, hint: c.hint, tall: true, onclick: () => { S.crowd = c.id; S.result = buildSetlist(LIB, { languages: S.langs, subtypes: S.subs, time: S.time ?? "peak", crowd: c.id }); prepare(); } }))) }));
  }

  function gate() { demoSignIn(); }
  function welcome() { reset(); afterSplashFromHome(); }
  function demoSignIn() { window.BAJAAAccount?.signIn(); }

  /* ---- automatic session preparation ---- */
  function prepare() {
    if(!window.BAJAAAccount?.verified)return;
    if(!S.result?.cues?.length){showPlayerError("There isn’t enough music for this mood. Try another combination.");return;}
    if(!S.engine)initEngine();
    const launch=()=>{if(!S.ready)return;S.played=[];S.saved=null;S.startedAt=Date.now();S.mode="playing";player();S.engine.start(S.result.cues);};
    if(S.ready && navigator.userActivation?.isActive){launch();return;}
    S.mode="preparing";
    const status=h("p",{class:"prepare-status",role:"status"},"Getting the music ready…");
    const play=h("button",{class:"bajaa-button primary",disabled:!S.ready,onclick:launch},"Let it play ↗");
    const retry=h("button",{class:"text-button",hidden:true,onclick:()=>{S.engine?.destroy();S.engine=null;S.ready=false;S.error=null;prepare();}},"Retry connection");
    mount(h("main",{class:"prepare-page"},window.BAJAADesign.nav(),h("section",{},h("p",{class:"eyebrow"},"Your room is ready"),h("h1",{},"You relax.",h("br"),"We’ll play."),h("p",{},answersChip()),status,play,retry,h("button",{class:"text-button",onclick:home},"Back to home"))));
    const engine=S.engine;engine.init().then(()=>{
      if(S.engine!==engine || S.mode!=="preparing")return;S.ready=true;play.disabled=false;status.textContent="Tap once. We’ll take it from here.";
    },e=>{if(S.engine!==engine || S.mode!=="preparing")return;status.textContent=e.message;retry.hidden=false;});
  }
  function energyMeter() { return null; }

  /* player below */
  window.BAJAA = { h, LIB, LANGUAGES, MIN_LANGUAGE_SONGS, inLanguage, fitsSubtype, buildSetlist, playedSeconds, PlayerEngine, fmtTime, SLOW,
    state: null, LS, LSSet, saveSet, renameSet, getUser, setUser, signIn, signOut, requestSong, reportEvent, sessionId, trafficSource,
    freeSetsUsed, markFreeSetUsed, songMap, REPLAY, app };
  window.BAJAA.ui = { splash, funnel, prepare, gate, welcome, demoSignIn, energyMeter, header, mount, home };
  window.BAJAA.S = S;

  setTimeout(() => { captureSource(); if (S.mode === "splash") { /* app boot */ } }, 0);
  /* ---- listening interface ---- */
  let ui = null;
  function answersChip() {
    return [...S.langs.map(id=>LANGUAGES.find(l=>l.id===id)?.label.split(" /")[0]),
      ({warmup:"Warming up",peak:"Party time",winddown:"Winding down",bangers:"Only bangers"})[S.time]].filter(Boolean).join(" · ");
  }
  function saveHistory() {
    if(!S.played.length) return;
    const all=LS("naux.sets",[]);
    const item={id:S.saved || "s"+crypto.randomUUID(),created_at:new Date(S.startedAt || Date.now()).toISOString(),name:answersChip().slice(0,100),answers:{languages:S.langs,subtypes:S.subs,time:S.time,crowd:S.crowd},songs:S.played.slice(-500)};
    S.saved=item.id;
    if(window.BAJAAAccount)window.BAJAAAccount.save(item);
    else LSSet("naux.sets",[item,...all.filter(x=>x.id!==item.id)].slice(0,100));
  }
  function player() {
    const title=h("h1",{},"Finding the first song…"),artist=h("p",{class:"now-artist"}),status=h("p",{class:"playback-status",role:"status","aria-live":"polite"},"Loading music…");
    const clock=h("span",{class:"playback-time"},"0:00");
    const pause=h("button",{class:"bajaa-button primary",onclick:()=>S.engine.togglePause()},"Pause");
    const skip=h("button",{class:"bajaa-button secondary",onclick:()=>S.engine.skip()},"Skip ↗");
    const full=h("button",{class:"text-button full-song-control",onclick:()=>S.engine.playFullCurrent()},"Let this song finish");
    const retry=h("button",{class:"bajaa-button primary",hidden:true,onclick:()=>S.engine.retry()},"Tap to play");
    const next=h("p",{class:"next-song"});
    const modals=h("div");
    const root=h("main",{class:"player-page"},
      h("header",{class:"player-header"},h("a",{href:"/",class:"brand",onclick:e=>{e.preventDefault();finishToSummary();}},"BAJAA"),h("button",{class:"text-button",onclick:finishToSummary},"End session ×")),
      h("div",{class:"listening-room"},h("div",{class:"room-toolbar"},h("p",{class:"room-description"},answersChip()),h("button",{class:"room-setting",onclick:openVibe},"Change mood ↗")),
        h("div",{class:"now-heading"},h("p",{class:"eyebrow"},"Now playing"),title,artist),
        h("div",{class:"dj-art","aria-hidden":"true"},h("div",{class:"dj-disc"},h("div",{class:"dj-disc-label"},"BAJAA"))),
        h("div",{class:"playback-info"},status,clock),retry,
        h("div",{class:"player-controls"},pause,skip),full,
        h("div",{class:"next-up"},h("span",{class:"eyebrow"},"We’ll play next"),next),
        h("p",{class:"player-footnote"},"Music through YouTube · Keep this tab open. iPhone and iPad use clean cuts.")),modals);
    mount(root); ui={root,title,artist,status,clock,pause,skip,full,retry,next,modals};
    updatePlayer();
    ui.iv=setInterval(updateClock,1000);
    const key=e=>{if(S.mode!=="playing" || S.modalKey || e.target.closest('button,a,input'))return;if(e.code==="Space"){e.preventDefault();S.engine.togglePause();}};
    window.addEventListener("keydown",key);ui.keyCleanup=()=>window.removeEventListener("keydown",key);
  }
  function updateClock() {if(!ui)return;const pos=S.engine?.getPosition();const text=pos?fmtTime(pos.seconds)+" / "+fmtTime(pos.duration):"0:00";if(ui.clock.textContent!==text)ui.clock.textContent=text;}
  function updatePlayer() {
    if(!ui || !S.engine || S.mode!=="playing")return;
    const st=S.engine.getState(),live=st.decks[st.live || "A"],next=st.decks[st.live==="B"?"A":"B"].cue;
    if(live.cue && ui.title.dataset.song!==live.cue.song_id){ui.title.dataset.song=live.cue.song_id;ui.title.textContent=live.cue.title;ui.artist.textContent=live.cue.artist;}
    ui.pause.textContent=st.paused?"Resume":"Pause";
    ui.pause.disabled=live.status!=="live" && !st.paused;
    ui.skip.disabled=!live.cue || st.crossfading || !!S.engine.awaitingStart; ui.full.disabled=live.playFull || st.crossfading;
    ui.full.textContent=live.playFull?"Playing to the end":"Let this song finish";
    ui.retry.hidden=!st.blocked;
    ui.status.textContent=st.paused?"Paused":st.blocked?"Music hasn’t started. Tap to play, or skip this song.":live.status==="live"?(st.crossfading?"Mixing into the next song":"The room is yours"):"Loading music…";
    const nextText=next?next.title+" · "+next.artist:"Letting the last song ride.";
    if(ui.next.textContent!==nextText)ui.next.textContent=nextText;
    updateClock();
  }
  function playerEvent(ev) {
    if(ev.type==="live")saveHistory();
    if(ev.type==="skip")saveHistory();
    if(ev.type==="unavailable")window.BAJAADesign.notice(`“${ev.cue.title}” is unavailable. Trying the next song.`);
  }
  function finishToSummary() {if(S.mode==="playing") S.engine.finish("Ended by listener");}
  function summary() {
    if(S.mode==="summary")return;S.mode="summary";saveHistory();
    mount(h("main",{class:"summary-page"},window.BAJAADesign.nav(),h("section",{},h("p",{class:"eyebrow"},"Until the next one"),h("h1",{},"Good music.",h("br"),"Good night."),h("p",{},S.played.length?`${S.played.length} songs. This session is saved in your history.`:"No songs played this time. Try another mood or check your connection."),
      h("div",{class:"summary-actions"},h("button",{class:"bajaa-button primary",onclick:()=>{S.engine?.destroy();S.engine=null;S.ready=false;reset();afterSplashFromHome();}},"Play another mood ↗"),h("a",{class:"text-button",href:"/sets/"},"Listening history")),
      h("ol",{class:"history-tracks"},S.played.map(song=>h("li",{},h("span",{},song.title),h("small",{},song.artist+(song.skipped?" · skipped":"")))))),window.BAJAADesign.footer()));
  }
  function modal(children) {
    if(!ui)return;closeModal();S.modalFocus=document.activeElement;S.modalResume=!S.engine.getState().paused;S.engine.pause();
    const card=h("section",{class:"bajaa-modal",role:"dialog","aria-modal":"true","aria-label":"Change the room",tabindex:"-1"},...children);
    const root=h("div",{class:"bajaa-modal-backdrop",onclick:e=>{if(e.target===root)closeModal();}},card);
    ui.modals.append(root); [...ui.root.children].filter(n=>n!==ui.modals).forEach(n=>n.inert=true);document.body.classList.add("modal-open");
    const key=e=>{if(e.key==="Escape"){e.preventDefault();closeModal();}if(e.key==="Tab"){const targets=[...card.querySelectorAll('button:not(:disabled),input,a[href]')];const first=targets[0],last=targets.at(-1);if(e.shiftKey && (document.activeElement===first || document.activeElement===card)){e.preventDefault();last?.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}}};
    S.modalKey=key;window.addEventListener("keydown",key);card.querySelector("button")?.focus();
  }
  function closeModal() {
    if(S.modalKey)window.removeEventListener("keydown",S.modalKey);S.modalKey=null;
    if(ui){ui.modals.replaceChildren();[...ui.root.children].forEach(n=>n.inert=false);}
    document.body.classList.remove("modal-open");S.modalFocus?.isConnected && S.modalFocus.focus();S.modalFocus=null;
    if(S.modalResume && S.mode==="playing")S.engine?.resume();S.modalResume=false;
  }
  function openVibe() {
    let mood=S.time || "peak";
    const choices=h("div",{class:"mood-options"});
    const render=()=>choices.replaceChildren(...[["warmup","Warming up"],["peak","Party time"],["winddown","Winding down"],["bangers","Only bangers"]].map(([id,label])=>h("button",{class:"mood-option","aria-pressed":String(mood===id),onclick:()=>{mood=id;render();}},label)));
    render();
    modal([h("div",{class:"modal-heading"},h("h2",{},"Room changed?"),h("button",{class:"text-button","aria-label":"Close",onclick:closeModal},"×")),h("p",{},"We’ll shift the music after this song."),choices,
      h("button",{class:"bajaa-button primary",onclick:()=>{S.time=mood;const played=new Set(S.played.map(x=>x.song_id));const res=buildSetlist(LIB.filter(x=>!played.has(x.song_id)),{languages:S.langs,subtypes:S.subs,time:mood,crowd:S.crowd});S.engine.requeue(res.cues);ui.root.querySelector('.room-description').textContent=answersChip();closeModal();}},"Set the mood ↗")]);
  }
  window.addEventListener("bajaa:account",()=>{if(window.BAJAAAccount && !window.BAJAAAccount.user && S.engine){S.engine.destroy();S.engine=null;S.ready=false;S.mode="signin";clear();window.BAJAADesign.requireSignIn();}});
  window.addEventListener("focus",async()=>{if(S.mode==="playing" && !await window.BAJAAAccount.authorize()){S.engine?.destroy();S.engine=null;S.ready=false;S.mode="signin";clear();window.BAJAADesign.requireSignIn();}});
  window.addEventListener("pagehide",()=>{S.engine?.destroy();ui?.keyCleanup?.();clearInterval(ui?.iv);});
  window.BAJAA.player={player,summary,updatePlayer};
  splash();
})();
