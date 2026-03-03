const APP_VERSION = "v3";
const NS = "aiPulse_" + APP_VERSION + "_";
const PROFILES_KEY = NS + "profiles";
const CLOUD_KEY = NS + "cloud";
const DEFAULT_COVER = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1000&q=80";
const EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const BASE_TRACKS = [
  { id: "helix-1", title: "Neural Echo", artist: "SoundHelix", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1000&q=80", mood: "focus", bpm: 122, key: "A minor", likes: 0, dislikes: 0, playCount: 0, skipCount: 0, isLocal: false },
  { id: "helix-2", title: "Quantum Lights", artist: "SoundHelix", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", cover: "https://images.unsplash.com/photo-1461783436728-0a9217714694?auto=format&fit=crop&w=1000&q=80", mood: "hype", bpm: 128, key: "F minor", likes: 0, dislikes: 0, playCount: 0, skipCount: 0, isLocal: false },
  { id: "helix-3", title: "Cyber Horizon", artist: "SoundHelix", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", cover: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1000&q=80", mood: "calm", bpm: 110, key: "D minor", likes: 0, dislikes: 0, playCount: 0, skipCount: 0, isLocal: false }
];

const FALLBACK_LYRICS = {
  "helix-1": [{ t: 0, text: "Booting neural rhythm..." }, { t: 12, text: "Signal in the silence, crystal and clear." }, { t: 28, text: "Pulse through the circuits, future is near." }, { t: 45, text: "Ride the electric echo tonight." }],
  "helix-2": [{ t: 0, text: "Quantum lights in the skyline." }, { t: 16, text: "Algorithms dancing in neon rain." }, { t: 34, text: "Frequency rising beyond the frame." }, { t: 50, text: "Hold the spark and accelerate." }],
  "helix-3": [{ t: 0, text: "Night code flows like water." }, { t: 14, text: "Every heartbeat maps the stars." }, { t: 30, text: "Static turns to color and calm." }, { t: 48, text: "Horizon opens, no restart." }]
};

const el = {
  root: document.documentElement,
  profileSelect: document.querySelector("#profileSelect"), profileName: document.querySelector("#profileName"), createProfileBtn: document.querySelector("#createProfileBtn"),
  themeSelect: document.querySelector("#themeSelect"), syncPushBtn: document.querySelector("#syncPushBtn"), syncPullBtn: document.querySelector("#syncPullBtn"), voiceBtn: document.querySelector("#voiceBtn"),
  deckA: document.querySelector("#deckA"), deckB: document.querySelector("#deckB"), cover: document.querySelector("#coverImage"), title: document.querySelector("#songTitle"), artist: document.querySelector("#songArtist"), trackMeta: document.querySelector("#trackMeta"),
  progress: document.querySelector("#progressBar"), current: document.querySelector("#currentTime"), duration: document.querySelector("#duration"), waveform: document.querySelector("#waveform"), visualizer: document.querySelector("#visualizer"),
  play: document.querySelector("#playBtn"), prev: document.querySelector("#prevBtn"), next: document.querySelector("#nextBtn"), miniPlay: document.querySelector("#miniPlay"), miniPrev: document.querySelector("#miniPrev"), miniNext: document.querySelector("#miniNext"),
  volume: document.querySelector("#volumeBar"), eqPreset: document.querySelector("#eqPreset"), reverb: document.querySelector("#reverbBar"), width: document.querySelector("#widthBar"), eqBands: document.querySelector("#eqBands"),
  likeBtn: document.querySelector("#likeBtn"), dislikeBtn: document.querySelector("#dislikeBtn"),
  playlist: document.querySelector("#playlist"), playlistEmpty: document.querySelector("#playlistEmpty"), trackCount: document.querySelector("#trackCount"), moodBtns: Array.from(document.querySelectorAll(".mood-btn")),
  queue: document.querySelector("#queueList"), queueEmpty: document.querySelector("#queueEmpty"), clearQueue: document.querySelector("#clearQueueBtn"),
  lyrics: document.querySelector("#lyricsList"), lyricsEmpty: document.querySelector("#lyricsEmpty"),
  reco: document.querySelector("#recommendList"), recoEmpty: document.querySelector("#recommendEmpty"),
  metrics: document.querySelector("#metricsList"),
  dropZone: document.querySelector("#dropZone"), fileInput: document.querySelector("#fileInput"),
  miniCover: document.querySelector("#miniCover"), miniTitle: document.querySelector("#miniTitle"), miniArtist: document.querySelector("#miniArtist"), voiceStatus: document.querySelector("#voiceStatus"),
  ctx: document.querySelector("#contextMenu"), ctxPlayNow: document.querySelector("#ctxPlayNow"), ctxPlayNext: document.querySelector("#ctxPlayNext"), ctxAddQueue: document.querySelector("#ctxAddQueue"),
  toast: document.querySelector("#toast"), shortcutsBtn: document.querySelector("#shortcutsBtn"), shortcutsDialog: document.querySelector("#shortcutsDialog"), closeShortcuts: document.querySelector("#closeShortcuts")
};

const state = {
  profiles: [], profileId: "default", tracks: BASE_TRACKS.map((t) => ({ ...t })), currentTrackId: BASE_TRACKS[0].id, queue: [], moodFilter: "all",
  theme: "cyber-neon", eqPreset: "flat", volume: 0.8, reverb: 0.2, width: 0.5, position: 0, isPlaying: false,
  lyricsCache: {},
  metrics: { sessionStart: Date.now(), starts: 0, errors: 0, skips: 0, likes: 0, dislikes: 0, totalStartupMs: 0, startupSamples: 0 }
};

const runtime = { activeDeck: 0, fadeToken: 0, seeking: false, queueDragId: null, contextTrackId: null, voice: null, cloudChannel: null, wave: [], markers: [0.2, 0.45, 0.72], rafViz: null, rafWave: null, playStartTs: 0 };

let audioContext, analyser, reverbWet, reverbDry, reverbConv;
const decks = [
  { audio: el.deckA, source: null, input: null, eq: [], pan: null, gain: null },
  { audio: el.deckB, source: null, input: null, eq: [], pan: null, gain: null }
];

const kProfile = (id) => NS + "state_" + id;
const activeDeck = () => decks[runtime.activeDeck];
const inactiveDeck = () => decks[runtime.activeDeck === 0 ? 1 : 0];
const currentTrack = () => state.tracks.find((t) => t.id === state.currentTrackId) || state.tracks[0];

function h(s) { let x = 2166136261; for (let i = 0; i < s.length; i += 1) { x ^= s.charCodeAt(i); x += (x << 1) + (x << 4) + (x << 7) + (x << 8) + (x << 24); } return Math.abs(x >>> 0); }
function estimateMeta(seed) { const n = h(seed); return { bpm: 96 + (n % 56), key: KEY_NAMES[n % KEY_NAMES.length] + (n % 2 ? " minor" : " major") }; }
function fmtTime(v) { const s = Math.floor(Number.isFinite(v) ? v : 0); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
function setFill(input, value, max) { input.style.setProperty("--progress", (max > 0 ? (value / max) * 100 : 0) + "%"); }
function toast(msg) { el.toast.textContent = msg; el.toast.classList.remove("hidden"); clearTimeout(toast._t); toast._t = setTimeout(() => el.toast.classList.add("hidden"), 1600); }
function setPlayGlyph(playing) { const t = playing ? "??" : "?"; el.play.textContent = t; el.miniPlay.textContent = t; }

function ensureProfiles() {
  try { const raw = localStorage.getItem(PROFILES_KEY); if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) state.profiles = p; } } catch (e) {}
  if (!state.profiles.length) { state.profiles = [{ id: "default", name: "Default" }]; localStorage.setItem(PROFILES_KEY, JSON.stringify(state.profiles)); }
}

function saveState() {
  const payload = {
    tracks: state.tracks.map((t) => ({ ...t, src: t.isLocal ? "" : t.src })), currentTrackId: state.currentTrackId, queue: state.queue, moodFilter: state.moodFilter,
    theme: state.theme, eqPreset: state.eqPreset, volume: state.volume, reverb: state.reverb, width: state.width,
    position: activeDeck().audio.currentTime || 0, metrics: state.metrics
  };
  localStorage.setItem(kProfile(state.profileId), JSON.stringify(payload));
}

function loadState(profileId) {
  const raw = localStorage.getItem(kProfile(profileId));
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    if (Array.isArray(s.tracks) && s.tracks.length) state.tracks = s.tracks.map((t) => ({ ...t, src: t.src || "" }));
    if (typeof s.currentTrackId === "string") state.currentTrackId = s.currentTrackId;
    if (Array.isArray(s.queue)) state.queue = s.queue;
    if (typeof s.moodFilter === "string") state.moodFilter = s.moodFilter;
    if (typeof s.theme === "string") state.theme = s.theme;
    if (typeof s.eqPreset === "string") state.eqPreset = s.eqPreset;
    if (typeof s.volume === "number") state.volume = Math.max(0, Math.min(1, s.volume));
    if (typeof s.reverb === "number") state.reverb = Math.max(0, Math.min(1, s.reverb));
    if (typeof s.width === "number") state.width = Math.max(0, Math.min(1, s.width));
    if (typeof s.position === "number") state.position = Math.max(0, s.position);
    if (s.metrics && typeof s.metrics === "object") state.metrics = { ...state.metrics, ...s.metrics };
  } catch (e) {}
}

function renderProfiles() {
  el.profileSelect.innerHTML = "";
  state.profiles.forEach((p) => { const o = document.createElement("option"); o.value = p.id; o.textContent = p.name; el.profileSelect.appendChild(o); });
  el.profileSelect.value = state.profileId;
}
function renderMetrics() {
  const m = state.metrics;
  const avg = m.startupSamples ? (m.totalStartupMs / m.startupSamples).toFixed(0) : "0";
  const mins = Math.floor((Date.now() - m.sessionStart) / 60000);
  const lines = ["Session: " + mins + " min", "Starts: " + m.starts, "Errors: " + m.errors, "Skips: " + m.skips, "Likes: " + m.likes, "Dislikes: " + m.dislikes, "Avg startup: " + avg + " ms"];
  el.metrics.innerHTML = "";
  lines.forEach((t) => { const li = document.createElement("li"); li.className = "metric-item"; li.textContent = t; el.metrics.appendChild(li); });
}

function score(track) {
  const c = currentTrack();
  return (track.likes || 0) * 3 - (track.dislikes || 0) * 4 - (track.skipCount || 0) * 2 + (track.playCount || 0) * 0.3 + (track.mood === c.mood ? 1.8 : 0);
}

function renderRecommendations() {
  const list = state.tracks.filter((t) => t.id !== state.currentTrackId && t.src).map((t) => ({ t, s: score(t) })).sort((a, b) => b.s - a.s).slice(0, 5);
  el.reco.innerHTML = "";
  list.forEach((row) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "reco-item";
    b.innerHTML = '<div class="name">' + row.t.title + '</div><div class="meta">Score: ' + row.s.toFixed(1) + " � " + row.t.mood + "</div>";
    b.addEventListener("click", () => transitionTo(row.t.id, true));
    li.appendChild(b);
    el.reco.appendChild(li);
  });
  el.recoEmpty.classList.toggle("hidden", list.length > 0);
}

function renderMood() { el.moodBtns.forEach((b) => b.classList.toggle("active", b.dataset.mood === state.moodFilter)); }

function renderPlaylist() {
  const list = state.tracks.filter((t) => state.moodFilter === "all" || t.mood === state.moodFilter);
  el.playlist.innerHTML = "";
  list.forEach((t) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "track-item" + (t.id === state.currentTrackId ? " active" : "");
    b.innerHTML = '<div class="name">' + t.title + '</div><div class="meta">' + t.artist + " � " + t.mood + " � " + t.bpm + " BPM � " + t.key + "</div>";
    b.addEventListener("click", () => transitionTo(t.id, true));
    b.addEventListener("contextmenu", (e) => { e.preventDefault(); runtime.contextTrackId = t.id; el.ctx.style.left = e.clientX + "px"; el.ctx.style.top = e.clientY + "px"; el.ctx.classList.remove("hidden"); });
    li.appendChild(b);
    el.playlist.appendChild(li);
  });
  el.playlistEmpty.classList.toggle("hidden", list.length > 0);
  el.trackCount.textContent = state.tracks.length + (state.tracks.length === 1 ? " track" : " tracks");
}

function renderQueue() {
  el.queue.innerHTML = "";
  state.queue.forEach((id) => {
    const t = state.tracks.find((x) => x.id === id);
    if (!t) return;
    const li = document.createElement("li");
    li.className = "queue-item";
    li.draggable = true;
    li.dataset.id = id;
    li.innerHTML = "<div>" + t.title + '</div><div class="meta">' + t.artist + "</div>";
    li.addEventListener("dragstart", () => { runtime.queueDragId = id; });
    li.addEventListener("dragover", (e) => { e.preventDefault(); li.classList.add("drag-over"); });
    li.addEventListener("dragleave", () => li.classList.remove("drag-over"));
    li.addEventListener("drop", (e) => {
      e.preventDefault(); li.classList.remove("drag-over");
      const from = state.queue.indexOf(runtime.queueDragId); const to = state.queue.indexOf(id);
      if (from >= 0 && to >= 0 && from !== to) { const [item] = state.queue.splice(from, 1); state.queue.splice(to, 0, item); renderQueue(); saveState(); }
    });
    el.queue.appendChild(li);
  });
  el.queueEmpty.classList.toggle("hidden", state.queue.length > 0);
}

function renderLyrics(lines) {
  el.lyrics.innerHTML = "";
  (lines || []).forEach((ln, i) => {
    const li = document.createElement("li");
    li.className = "lyric-line" + (i === 0 ? " active" : "");
    li.dataset.t = String(ln.t || 0);
    li.textContent = ln.text || "";
    el.lyrics.appendChild(li);
  });
  el.lyricsEmpty.classList.toggle("hidden", (lines || []).length > 0);
}

function syncLyrics(time) {
  const items = Array.from(el.lyrics.querySelectorAll(".lyric-line"));
  let idx = 0;
  items.forEach((it, i) => { if (time >= Number(it.dataset.t || 0)) idx = i; });
  items.forEach((it, i) => it.classList.toggle("active", i === idx));
}

async function loadLyrics(track) {
  if (!track) return;
  if (state.lyricsCache[track.id]) { renderLyrics(state.lyricsCache[track.id]); return; }
  try {
    const url = "https://api.lyrics.ovh/v1/" + encodeURIComponent(track.artist) + "/" + encodeURIComponent(track.title);
    const r = await fetch(url);
    if (r.ok) {
      const j = await r.json();
      if (j && typeof j.lyrics === "string" && j.lyrics.trim()) {
        const arr = j.lyrics.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 30).map((text, i) => ({ t: i * 4, text }));
        state.lyricsCache[track.id] = arr;
        renderLyrics(arr);
        return;
      }
    }
  } catch (e) {}
  const fb = FALLBACK_LYRICS[track.id] || [];
  state.lyricsCache[track.id] = fb;
  renderLyrics(fb);
}

function updateMeta(track) {
  el.title.textContent = track.title;
  el.artist.textContent = track.artist;
  el.cover.src = track.cover || DEFAULT_COVER;
  el.trackMeta.textContent = "BPM: " + track.bpm + " | Key: " + track.key;
  el.miniCover.src = track.cover || DEFAULT_COVER;
  el.miniTitle.textContent = track.title;
  el.miniArtist.textContent = track.artist;
}

function makeImpulse(ctx, duration, decay) {
  const len = ctx.sampleRate * duration;
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

function initAudio() {
  if (audioContext) return;
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  const master = audioContext.createGain();
  const comp = audioContext.createDynamicsCompressor();
  const lim = audioContext.createDynamicsCompressor();
  reverbConv = audioContext.createConvolver();
  reverbWet = audioContext.createGain();
  reverbDry = audioContext.createGain();
  reverbConv.buffer = makeImpulse(audioContext, 1.8, 2.5);
  comp.threshold.value = -24;
  lim.threshold.value = -6;
  lim.ratio.value = 20;

  decks.forEach((deck, i) => {
    deck.source = audioContext.createMediaElementSource(deck.audio);
    deck.input = audioContext.createGain();
    deck.pan = audioContext.createStereoPanner();
    deck.gain = audioContext.createGain();
    deck.eq = EQ_FREQS.map((f) => { const n = audioContext.createBiquadFilter(); n.type = "peaking"; n.frequency.value = f; n.Q.value = 1; n.gain.value = 0; return n; });

    deck.source.connect(deck.input);
    let chain = deck.input;
    deck.eq.forEach((n) => { chain.connect(n); chain = n; });
    chain.connect(deck.pan);
    deck.pan.connect(deck.gain);
    deck.gain.connect(reverbDry);
    deck.gain.connect(reverbConv);
    deck.gain.gain.value = i === runtime.activeDeck ? 1 : 0;
  });

  reverbConv.connect(reverbWet);
  reverbDry.connect(comp);
  reverbWet.connect(comp);
  comp.connect(lim);
  lim.connect(master);
  master.connect(analyser);
  analyser.connect(audioContext.destination);
}

function applyPreset(name) {
  state.eqPreset = name;
  const map = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bass: [6, 5, 4, 3, 2, 0, -1, -1, -1, 0],
    vocal: [-2, -1, 0, 2, 4, 5, 4, 2, 1, 0],
    chill: [2, 2, 1, 0, -1, -1, 0, 1, 2, 2]
  };
  const vals = map[name] || map.flat;
  decks.forEach((d) => d.eq.forEach((n, i) => (n.gain.value = vals[i])));
  const sliders = Array.from(el.eqBands.querySelectorAll("input"));
  sliders.forEach((s, i) => (s.value = String(vals[i])));
}

function setReverb(v) { state.reverb = Math.max(0, Math.min(1, v)); reverbWet.gain.value = state.reverb * 0.7; reverbDry.gain.value = 1 - state.reverb * 0.4; }
function setWidth(v) { state.width = Math.max(0, Math.min(1, v)); decks.forEach((d) => (d.pan.pan.value = (state.width - 0.5) * 0.9)); }

function buildEqUI() {
  el.eqBands.innerHTML = "";
  EQ_FREQS.forEach((f, i) => {
    const w = document.createElement("div"); w.className = "band";
    const r = document.createElement("input");
    r.type = "range"; r.min = "-12"; r.max = "12"; r.step = "0.5"; r.value = "0";
    r.addEventListener("input", () => { state.eqPreset = "flat"; el.eqPreset.value = "flat"; const v = Number(r.value); decks.forEach((d) => (d.eq[i].gain.value = v)); saveState(); });
    const s = document.createElement("small"); s.textContent = f >= 1000 ? f / 1000 + "k" : String(f);
    w.appendChild(r); w.appendChild(s); el.eqBands.appendChild(w);
  });
}
function buildWave(trackId) {
  const seed = h(trackId);
  let x = seed % 9973;
  runtime.wave = [];
  for (let i = 0; i < 160; i += 1) { x = (x * 1664525 + 1013904223) % 4294967296; runtime.wave.push(0.15 + (x / 4294967296) * 0.85); }
}

function drawWave() {
  const ctx = el.waveform.getContext("2d");
  const w = el.waveform.width, hgt = el.waveform.height;
  ctx.clearRect(0, 0, w, hgt);
  ctx.fillStyle = "rgba(9,9,18,0.82)";
  ctx.fillRect(0, 0, w, hgt);
  if (!runtime.wave.length) return;
  const step = w / runtime.wave.length;
  ctx.fillStyle = "rgba(52,245,255,0.65)";
  runtime.wave.forEach((p, i) => { const bh = p * (hgt - 14); const x = i * step; ctx.fillRect(x, (hgt - bh) / 2, Math.max(1, step - 1), bh); });
  ctx.fillStyle = "rgba(178,70,255,0.5)";
  runtime.markers.forEach((m) => ctx.fillRect(m * w, 0, 2, hgt));
  const a = activeDeck().audio;
  const p = a.duration ? a.currentTime / a.duration : 0;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillRect(p * w, 0, 2, hgt);
  runtime.rafWave = requestAnimationFrame(drawWave);
}

function drawViz() {
  const ctx = el.visualizer.getContext("2d");
  const w = el.visualizer.width, hgt = el.visualizer.height;
  ctx.clearRect(0, 0, w, hgt);
  ctx.fillStyle = "rgba(10,10,18,0.76)";
  ctx.fillRect(0, 0, w, hgt);
  const bars = 56, gap = 3, bw = (w - gap * (bars - 1)) / bars;
  const g = ctx.createLinearGradient(0, hgt, w, 0);
  g.addColorStop(0, "#34f5ff"); g.addColorStop(1, "#b246ff");
  let vals = new Array(bars).fill(0.08);
  if (analyser) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const step = Math.max(1, Math.floor(data.length / bars));
    vals = vals.map((_, i) => data[i * step] / 255);
  }
  vals.forEach((v, i) => { const bh = Math.max(5, v * (hgt - 10)); const x = i * (bw + gap); ctx.fillStyle = g; ctx.fillRect(x, hgt - bh, bw, bh); });
  runtime.rafViz = requestAnimationFrame(drawViz);
}

function ensureLoops() {
  if (!runtime.rafViz) drawViz();
  if (!runtime.rafWave) drawWave();
}

function updateProgress() {
  const a = activeDeck().audio;
  const dur = a.duration || 0, cur = a.currentTime || 0;
  el.current.textContent = fmtTime(cur);
  el.duration.textContent = fmtTime(dur);
  if (!runtime.seeking && dur > 0) { const p = (cur / dur) * 100; el.progress.value = String(p); setFill(el.progress, p, 100); }
  syncLyrics(cur);
}

function nextId() {
  if (state.queue.length > 0) return state.queue.shift();
  const idx = state.tracks.findIndex((t) => t.id === state.currentTrackId);
  return state.tracks[(idx + 1) % state.tracks.length].id;
}
function prevId() { const idx = state.tracks.findIndex((t) => t.id === state.currentTrackId); return state.tracks[(idx - 1 + state.tracks.length) % state.tracks.length].id; }

function xFade(inDeck, outDeck, ms, token) {
  return new Promise((resolve) => {
    const steps = Math.max(12, Math.floor(ms / 24)); let i = 0;
    const timer = setInterval(() => {
      if (token !== runtime.fadeToken) { clearInterval(timer); resolve(false); return; }
      i += 1;
      const r = i / steps;
      inDeck.gain.gain.value = r;
      outDeck.gain.gain.value = 1 - r;
      if (i >= steps) { clearInterval(timer); resolve(true); }
    }, Math.max(14, Math.floor(ms / steps)));
  });
}

async function transitionTo(trackId, autoplay) {
  const track = state.tracks.find((t) => t.id === trackId);
  if (!track || !track.src) return;
  initAudio();
  if (audioContext.state === "suspended") await audioContext.resume();

  runtime.fadeToken += 1;
  const token = runtime.fadeToken;
  const out = activeDeck();
  const inc = inactiveDeck();

  state.currentTrackId = track.id;
  updateMeta(track);
  renderPlaylist(); renderQueue(); renderRecommendations(); loadLyrics(track); buildWave(track.id);

  inc.audio.src = track.src;
  inc.audio.currentTime = 0;
  inc.audio.load();
  await new Promise((res) => {
    const done = () => { inc.audio.removeEventListener("loadedmetadata", done); res(); };
    inc.audio.addEventListener("loadedmetadata", done);
    setTimeout(res, 600);
  });

  if (autoplay) {
    inc.gain.gain.value = 0;
    try {
      runtime.playStartTs = performance.now();
      await inc.audio.play();
      state.metrics.starts += 1;
      state.isPlaying = true;
      setPlayGlyph(true);
      ensureLoops();
      await xFade(inc, out, 520, token);
      out.audio.pause(); out.audio.currentTime = 0;
    } catch (e) {
      state.isPlaying = false;
      setPlayGlyph(false);
    }
  } else {
    inc.gain.gain.value = 1;
    out.gain.gain.value = 0;
    out.audio.pause();
    state.isPlaying = false;
    setPlayGlyph(false);
  }

  runtime.activeDeck = runtime.activeDeck === 0 ? 1 : 0;
  track.playCount = (track.playCount || 0) + 1;
  saveState();
}

function bindDeck(deck) {
  deck.audio.addEventListener("playing", () => {
    if (deck !== activeDeck()) return;
    if (runtime.playStartTs) {
      state.metrics.totalStartupMs += performance.now() - runtime.playStartTs;
      state.metrics.startupSamples += 1;
      runtime.playStartTs = 0;
      renderMetrics();
    }
  });
  deck.audio.addEventListener("timeupdate", () => { if (deck === activeDeck()) updateProgress(); });
  deck.audio.addEventListener("ended", () => { if (deck !== activeDeck()) return; const n = nextId(); renderQueue(); transitionTo(n, true); });
  deck.audio.addEventListener("error", () => { if (deck !== activeDeck()) return; state.metrics.errors += 1; renderMetrics(); const n = nextId(); renderQueue(); transitionTo(n, true); });
}

function initDrop() {
  ["dragenter", "dragover"].forEach((ev) => el.dropZone.addEventListener(ev, (e) => { e.preventDefault(); el.dropZone.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((ev) => el.dropZone.addEventListener(ev, (e) => { e.preventDefault(); el.dropZone.classList.remove("dragging"); }));
  const addFiles = (files) => {
    const arr = Array.from(files || []).filter((f) => f.type === "audio/mpeg" || f.name.toLowerCase().endsWith(".mp3"));
    arr.forEach((f, i) => {
      const m = estimateMeta(f.name + i);
      state.tracks.push({ id: "local-" + Date.now() + "-" + i, title: f.name.replace(/\.[^/.]+$/, ""), artist: "Local Upload", src: URL.createObjectURL(f), cover: DEFAULT_COVER, mood: "focus", bpm: m.bpm, key: m.key, likes: 0, dislikes: 0, playCount: 0, skipCount: 0, isLocal: true });
    });
    renderPlaylist(); renderRecommendations(); saveState();
    if (arr.length) toast(arr.length + " track(s) uploaded");
  };
  el.dropZone.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
  el.fileInput.addEventListener("change", () => { addFiles(el.fileInput.files); el.fileInput.value = ""; });
}

function initVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { el.voiceStatus.textContent = "Voice: unsupported"; return; }
  const rec = new SR(); rec.continuous = false; rec.lang = "en-US"; rec.interimResults = false;
  rec.onstart = () => (el.voiceStatus.textContent = "Voice: listening...");
  rec.onend = () => (el.voiceStatus.textContent = "Voice: idle");
  rec.onerror = () => (el.voiceStatus.textContent = "Voice: error");
  rec.onresult = (ev) => {
    const text = ev?.results?.[0]?.[0]?.transcript?.toLowerCase?.() || "";
    if (text.includes("next")) el.next.click();
    if (text.includes("previous")) el.prev.click();
    if (text.includes("play") || text.includes("pause")) el.play.click();
    if (text.includes("like")) el.likeBtn.click();
    if (text.includes("dislike")) el.dislikeBtn.click();
    const m = text.match(/volume\s+(\d{1,3})/);
    if (m) { const n = Math.min(100, Math.max(0, Number(m[1]))); const v = n / 100; state.volume = v; el.volume.value = String(v); setFill(el.volume, v, 1); decks.forEach((d) => (d.audio.volume = v)); saveState(); }
  };
  runtime.voice = rec;
}

function bindUI() {
  el.play.addEventListener("click", async () => {
    initAudio();
    if (audioContext.state === "suspended") await audioContext.resume();
    const a = activeDeck().audio;
    if (a.paused) { runtime.playStartTs = performance.now(); await a.play().catch(() => {}); state.isPlaying = true; setPlayGlyph(true); ensureLoops(); }
    else { a.pause(); state.isPlaying = false; setPlayGlyph(false); }
    saveState();
  });
  el.prev.addEventListener("click", () => { const a = activeDeck().audio; if (a.currentTime > 3) { a.currentTime = 0; return; } if ((a.currentTime || 0) < 15) { currentTrack().skipCount += 1; state.metrics.skips += 1; renderMetrics(); } transitionTo(prevId(), true); });
  el.next.addEventListener("click", () => { const a = activeDeck().audio; if ((a.currentTime || 0) < 15) { currentTrack().skipCount += 1; state.metrics.skips += 1; renderMetrics(); } const n = nextId(); renderQueue(); transitionTo(n, true); });
  el.miniPlay.addEventListener("click", () => el.play.click()); el.miniPrev.addEventListener("click", () => el.prev.click()); el.miniNext.addEventListener("click", () => el.next.click());

  el.progress.addEventListener("input", () => { runtime.seeking = true; const a = activeDeck().audio; const p = Number(el.progress.value); setFill(el.progress, p, 100); if (a.duration) a.currentTime = (p / 100) * a.duration; });
  el.progress.addEventListener("change", () => { runtime.seeking = false; saveState(); });
  el.waveform.addEventListener("click", (e) => { const r = el.waveform.getBoundingClientRect(); const k = (e.clientX - r.left) / r.width; const a = activeDeck().audio; if (a.duration) a.currentTime = Math.max(0, Math.min(1, k)) * a.duration; });

  el.volume.addEventListener("input", () => { const v = Number(el.volume.value); state.volume = v; setFill(el.volume, v, 1); decks.forEach((d) => (d.audio.volume = v)); saveState(); });
  el.reverb.addEventListener("input", () => { const v = Number(el.reverb.value); setFill(el.reverb, v, 1); setReverb(v); saveState(); });
  el.width.addEventListener("input", () => { const v = Number(el.width.value); setFill(el.width, v, 1); setWidth(v); saveState(); });
  el.eqPreset.addEventListener("change", () => { applyPreset(el.eqPreset.value); saveState(); });

  el.likeBtn.addEventListener("click", () => { const t = currentTrack(); t.likes += 1; state.metrics.likes += 1; renderRecommendations(); renderMetrics(); saveState(); toast("Liked: " + t.title); });
  el.dislikeBtn.addEventListener("click", () => { const t = currentTrack(); t.dislikes += 1; state.metrics.dislikes += 1; renderRecommendations(); renderMetrics(); saveState(); toast("Disliked: " + t.title); });

  el.moodBtns.forEach((b) => b.addEventListener("click", () => { state.moodFilter = b.dataset.mood; renderMood(); renderPlaylist(); saveState(); }));
  el.clearQueue.addEventListener("click", () => { state.queue = []; renderQueue(); saveState(); });
  el.themeSelect.addEventListener("change", () => { state.theme = el.themeSelect.value; el.root.setAttribute("data-theme", state.theme); saveState(); });
  el.createProfileBtn.addEventListener("click", () => { const n = (el.profileName.value || "").trim(); if (!n) return; const id = "p-" + h(n + Date.now()); state.profiles.push({ id, name: n }); localStorage.setItem(PROFILES_KEY, JSON.stringify(state.profiles)); renderProfiles(); switchProfile(id); el.profileName.value = ""; });
  el.profileSelect.addEventListener("change", () => switchProfile(el.profileSelect.value));

  el.syncPushBtn.addEventListener("click", () => { localStorage.setItem(CLOUD_KEY, JSON.stringify({ profileId: state.profileId, state: localStorage.getItem(kProfile(state.profileId)) || "" })); if (runtime.cloudChannel) runtime.cloudChannel.postMessage({ type: "push", profileId: state.profileId }); toast("Cloud push complete"); });
  el.syncPullBtn.addEventListener("click", () => { const raw = localStorage.getItem(CLOUD_KEY); if (!raw) { toast("No cloud snapshot"); return; } try { const s = JSON.parse(raw); if (s.profileId !== state.profileId) { toast("Cloud snapshot belongs to another profile"); return; } localStorage.setItem(kProfile(state.profileId), s.state || ""); loadState(state.profileId); bootstrap(); toast("Cloud pull complete"); } catch (e) { toast("Cloud pull failed"); } });

  el.voiceBtn.addEventListener("click", () => { if (!runtime.voice) { toast("Voice recognition unavailable"); return; } try { runtime.voice.start(); } catch (e) {} });

  document.addEventListener("click", (e) => { if (!el.ctx.contains(e.target)) el.ctx.classList.add("hidden"); });
  el.ctxPlayNow.addEventListener("click", () => { if (runtime.contextTrackId) transitionTo(runtime.contextTrackId, true); el.ctx.classList.add("hidden"); });
  el.ctxPlayNext.addEventListener("click", () => { if (runtime.contextTrackId) { state.queue = [runtime.contextTrackId, ...state.queue.filter((id) => id !== runtime.contextTrackId)]; renderQueue(); saveState(); } el.ctx.classList.add("hidden"); });
  el.ctxAddQueue.addEventListener("click", () => { if (runtime.contextTrackId) { state.queue.push(runtime.contextTrackId); renderQueue(); saveState(); } el.ctx.classList.add("hidden"); });

  el.shortcutsBtn.addEventListener("click", () => { if (typeof el.shortcutsDialog.showModal === "function") el.shortcutsDialog.showModal(); else el.shortcutsDialog.setAttribute("open", ""); });
  el.closeShortcuts.addEventListener("click", () => { if (typeof el.shortcutsDialog.close === "function") el.shortcutsDialog.close(); else el.shortcutsDialog.removeAttribute("open"); });

  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName ? e.target.tagName : "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (e.code === "Space") { e.preventDefault(); el.play.click(); }
    if (e.key === "ArrowRight") activeDeck().audio.currentTime += 5;
    if (e.key === "ArrowLeft") activeDeck().audio.currentTime = Math.max(0, activeDeck().audio.currentTime - 5);
    if (e.key.toLowerCase() === "n") el.next.click();
    if (e.key.toLowerCase() === "p") el.prev.click();
    if (e.key.toLowerCase() === "l") el.likeBtn.click();
    if (e.key.toLowerCase() === "d") el.dislikeBtn.click();
    if (e.key.toLowerCase() === "q") el.queue.focus();
    if (e.key === "Escape") { el.ctx.classList.add("hidden"); if (el.shortcutsDialog.open && typeof el.shortcutsDialog.close === "function") el.shortcutsDialog.close(); }
  });
}

function switchProfile(id) {
  if (!state.profiles.some((p) => p.id === id)) return;
  saveState();
  state.profileId = id;
  state.tracks = BASE_TRACKS.map((t) => ({ ...t }));
  state.currentTrackId = state.tracks[0].id;
  state.queue = [];
  state.moodFilter = "all";
  state.position = 0;
  loadState(id);
  bootstrap();
  toast("Profile: " + (state.profiles.find((p) => p.id === id)?.name || id));
}

function bootstrap() {
  el.root.setAttribute("data-theme", state.theme);
  el.themeSelect.value = state.theme;
  el.eqPreset.value = state.eqPreset;
  el.volume.value = String(state.volume); setFill(el.volume, state.volume, 1);
  el.reverb.value = String(state.reverb); setFill(el.reverb, state.reverb, 1);
  el.width.value = String(state.width); setFill(el.width, state.width, 1);
  setFill(el.progress, 0, 100);

  renderMood(); renderPlaylist(); renderQueue(); renderRecommendations(); renderMetrics();
  const t = currentTrack(); updateMeta(t); loadLyrics(t); buildWave(t.id);
  activeDeck().audio.src = t.src; activeDeck().audio.currentTime = state.position || 0; decks.forEach((d) => (d.audio.volume = state.volume));
  applyPreset(state.eqPreset); setReverb(state.reverb); setWidth(state.width);
}

function initCloudChannel() {
  if (typeof BroadcastChannel === "undefined") return;
  runtime.cloudChannel = new BroadcastChannel("ai-pulse-sync");
  runtime.cloudChannel.onmessage = (msg) => { if (msg?.data?.type === "push" && msg.data.profileId === state.profileId) toast("Cloud mirror updated in another tab"); };
}

function initPWA() { if ("serviceWorker" in navigator && window.isSecureContext) navigator.serviceWorker.register("./sw.js").catch(() => {}); }

function init() {
  ensureProfiles();
  state.profileId = state.profiles[0].id;
  loadState(state.profileId);
  renderProfiles();

  buildEqUI();
  initAudio();
  bindDeck(decks[0]); bindDeck(decks[1]);
  bootstrap();
  initDrop();
  initVoice();
  initCloudChannel();
  bindUI();
  initPWA();

  setPlayGlyph(false);
}

window.addEventListener("beforeunload", () => {
  state.tracks.forEach((t) => { if (t.isLocal && t.src && t.src.startsWith("blob:")) URL.revokeObjectURL(t.src); });
  if (runtime.rafViz) cancelAnimationFrame(runtime.rafViz);
  if (runtime.rafWave) cancelAnimationFrame(runtime.rafWave);
  saveState();
});

init();
