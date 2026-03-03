const STORAGE_KEY = "auroraPlayerStateV1";
const DEFAULT_COVER = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1000&q=80";

const tracks = [
  {
    id: "helix-1",
    title: "Aurora Drift",
    artist: "SoundHelix",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1000&q=80",
    isLocal: false
  },
  {
    id: "helix-2",
    title: "Cloud Pop",
    artist: "SoundHelix",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    cover: "https://images.unsplash.com/photo-1461783436728-0a9217714694?auto=format&fit=crop&w=1000&q=80",
    isLocal: false
  },
  {
    id: "helix-3",
    title: "Soft Lights",
    artist: "SoundHelix",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    cover: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1000&q=80",
    isLocal: false
  }
];

const el = {
  root: document.documentElement,
  playerCard: document.querySelector("#playerCard"),
  audio: document.querySelector("#audio"),
  cover: document.querySelector("#coverImage"),
  title: document.querySelector("#songTitle"),
  artist: document.querySelector("#songArtist"),
  visualizer: document.querySelector("#visualizer"),
  progress: document.querySelector("#progressBar"),
  currentTime: document.querySelector("#currentTime"),
  duration: document.querySelector("#duration"),
  play: document.querySelector("#playBtn"),
  prev: document.querySelector("#prevBtn"),
  next: document.querySelector("#nextBtn"),
  volume: document.querySelector("#volumeBar"),
  playlist: document.querySelector("#playlist"),
  playlistEmpty: document.querySelector("#playlistEmpty"),
  trackCount: document.querySelector("#trackCount"),
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  themeToggle: document.querySelector("#themeToggle")
};

const state = {
  currentIndex: 0,
  isSeeking: false,
  theme: "light"
};

let audioContext;
let analyser;
let sourceNode;
let rafId;

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  const m = String(Math.floor(safe / 60)).padStart(2, "0");
  const s = String(safe % 60).padStart(2, "0");
  return m + ":" + s;
}

function setRangeFill(input, value, max) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  input.style.setProperty("--progress", percent + "%");
}

function setPlayIcon(isPlaying) {
  el.play.textContent = isPlaying ? "??" : "?";
}

function saveState() {
  const current = tracks[state.currentIndex];
  const payload = {
    currentId: current ? current.id : null,
    volume: Number(el.audio.volume || 0.8),
    theme: state.theme
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.volume === "number") {
      el.audio.volume = Math.max(0, Math.min(1, parsed.volume));
      el.volume.value = String(el.audio.volume);
    }
    if (typeof parsed.theme === "string") {
      state.theme = parsed.theme === "pastel" ? "pastel" : "light";
    }
    if (typeof parsed.currentId === "string") {
      const idx = tracks.findIndex((t) => t.id === parsed.currentId);
      if (idx >= 0) state.currentIndex = idx;
    }
  } catch (e) {
    // ignore invalid localStorage data
  }
}

function applyTheme(theme) {
  state.theme = theme === "pastel" ? "pastel" : "light";
  el.root.setAttribute("data-theme", state.theme);
  el.themeToggle.textContent = state.theme === "light" ? "Pastel Mode" : "Light Mode";
}

function renderPlaylist() {
  el.playlist.innerHTML = "";

  tracks.forEach((track, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "track-item" + (i === state.currentIndex ? " active" : "");
    btn.innerHTML = '<span class="name">' + track.title + '</span><span class="meta">' + track.artist + "</span>";

    btn.addEventListener("click", () => {
      state.currentIndex = i;
      loadTrack(false);
      playCurrent();
    });

    li.appendChild(btn);
    el.playlist.appendChild(li);
  });

  el.playlistEmpty.classList.toggle("hidden", tracks.length > 0);
  el.trackCount.textContent = tracks.length + (tracks.length === 1 ? " track" : " tracks");
}

function loadTrack(keepTime) {
  const track = tracks[state.currentIndex];
  if (!track) return;

  const oldTime = keepTime ? el.audio.currentTime : 0;

  el.audio.src = track.src;
  el.cover.src = track.cover || DEFAULT_COVER;
  el.title.textContent = track.title;
  el.artist.textContent = track.artist;

  renderPlaylist();
  saveState();

  if (keepTime) {
    el.audio.currentTime = oldTime;
  }
}

function nextTrack(autoplay) {
  state.currentIndex = (state.currentIndex + 1) % tracks.length;
  loadTrack(false);
  if (autoplay) playCurrent();
}

function prevTrack() {
  if (el.audio.currentTime > 3) {
    el.audio.currentTime = 0;
    return;
  }
  state.currentIndex = (state.currentIndex - 1 + tracks.length) % tracks.length;
  loadTrack(false);
  playCurrent();
}

function playCurrent() {
  el.audio.play().then(() => {
    setPlayIcon(true);
    ensureVisualizer();
  }).catch(() => {
    setPlayIcon(false);
  });
}

function togglePlay() {
  if (el.audio.paused) {
    playCurrent();
  } else {
    el.audio.pause();
    setPlayIcon(false);
  }
}

function initVisualizer() {
  if (audioContext || !el.visualizer) return;

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    sourceNode = audioContext.createMediaElementSource(el.audio);
    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
  } catch (e) {
    analyser = null;
  }
}

function drawVisualizer() {
  const ctx = el.visualizer.getContext("2d");
  const width = el.visualizer.width;
  const height = el.visualizer.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(0, 0, width, height);

  const bars = 52;
  const gap = 4;
  const barWidth = (width - gap * (bars - 1)) / bars;

  let values = new Array(bars).fill(0.1);
  if (analyser) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const step = Math.max(1, Math.floor(data.length / bars));
    values = values.map((_, i) => data[i * step] / 255);
  }

  const gradient = ctx.createLinearGradient(0, height, width, 0);
  gradient.addColorStop(0, "#72d5ff");
  gradient.addColorStop(0.5, "#9188ff");
  gradient.addColorStop(1, "#ff8fd3");

  values.forEach((v, i) => {
    const barHeight = Math.max(6, v * (height - 10));
    const x = i * (barWidth + gap);
    const y = height - barHeight;
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);
  });

  rafId = requestAnimationFrame(drawVisualizer);
}

function ensureVisualizer() {
  initVisualizer();
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume();
  }
  if (!rafId) {
    drawVisualizer();
  }
}

function addFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type === "audio/mpeg" || file.name.toLowerCase().endsWith(".mp3"));
  if (!files.length) return;

  files.forEach((file, i) => {
    tracks.push({
      id: "local-" + Date.now() + "-" + i,
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Local Upload",
      src: URL.createObjectURL(file),
      cover: DEFAULT_COVER,
      isLocal: true
    });
  });

  renderPlaylist();
  saveState();
}

function initDropZone() {
  ["dragenter", "dragover"].forEach((eventName) => {
    el.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      el.dropZone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    el.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      el.dropZone.classList.remove("dragging");
    });
  });

  el.dropZone.addEventListener("drop", (event) => {
    addFiles(event.dataTransfer.files);
  });

  el.fileInput.addEventListener("change", () => {
    addFiles(el.fileInput.files);
    el.fileInput.value = "";
  });
}

function initCardTilt() {
  const card = el.playerCard;
  if (!card) return;

  card.addEventListener("mousemove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    const rotateY = (x - 0.5) * 7;
    const rotateX = (0.5 - y) * 6;

    card.style.transform = "perspective(1000px) rotateX(" + rotateX + "deg) rotateY(" + rotateY + "deg)";
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
  });
}

function bindEvents() {
  el.play.addEventListener("click", togglePlay);
  el.prev.addEventListener("click", prevTrack);
  el.next.addEventListener("click", () => nextTrack(true));

  el.audio.addEventListener("loadedmetadata", () => {
    el.duration.textContent = formatTime(el.audio.duration);
    setRangeFill(el.progress, 0, 100);
  });

  el.audio.addEventListener("timeupdate", () => {
    if (!state.isSeeking && el.audio.duration) {
      const percent = (el.audio.currentTime / el.audio.duration) * 100;
      el.progress.value = String(percent);
      setRangeFill(el.progress, percent, 100);
    }
    el.currentTime.textContent = formatTime(el.audio.currentTime);
  });

  el.audio.addEventListener("play", () => setPlayIcon(true));
  el.audio.addEventListener("pause", () => setPlayIcon(false));

  el.audio.addEventListener("ended", () => {
    nextTrack(true);
  });

  el.audio.addEventListener("error", () => {
    nextTrack(true);
  });

  el.progress.addEventListener("input", () => {
    state.isSeeking = true;
    const percent = Number(el.progress.value);
    setRangeFill(el.progress, percent, 100);
    if (el.audio.duration) {
      el.audio.currentTime = (percent / 100) * el.audio.duration;
    }
  });

  el.progress.addEventListener("change", () => {
    state.isSeeking = false;
  });

  el.volume.addEventListener("input", () => {
    const v = Number(el.volume.value);
    el.audio.volume = v;
    setRangeFill(el.volume, v, 1);
    saveState();
  });

  el.themeToggle.addEventListener("click", () => {
    applyTheme(state.theme === "light" ? "pastel" : "light");
    saveState();
  });

  document.addEventListener("keydown", (event) => {
    const tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea") return;

    if (event.code === "Space") {
      event.preventDefault();
      togglePlay();
    }

    if (event.key === "ArrowRight") {
      el.audio.currentTime = Math.min(el.audio.currentTime + 5, el.audio.duration || el.audio.currentTime + 5);
    }

    if (event.key === "ArrowLeft") {
      el.audio.currentTime = Math.max(el.audio.currentTime - 5, 0);
    }
  });
}

function init() {
  restoreState();
  applyTheme(state.theme);

  if (!el.audio.volume) {
    el.audio.volume = 0.8;
  }
  el.volume.value = String(el.audio.volume);
  setRangeFill(el.volume, el.audio.volume, 1);

  renderPlaylist();
  loadTrack(false);
  setPlayIcon(false);

  bindEvents();
  initDropZone();
  initCardTilt();
}

window.addEventListener("beforeunload", () => {
  tracks.forEach((track) => {
    if (track.isLocal && track.src.startsWith("blob:")) {
      URL.revokeObjectURL(track.src);
    }
  });

  if (rafId) {
    cancelAnimationFrame(rafId);
  }

  saveState();
});

init();
