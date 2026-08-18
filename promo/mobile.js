// === HOGAMEGATA 9:16 VERTICAL MOBILE & SHORTS ENGINE ===

document.addEventListener("DOMContentLoaded", async () => {
  let promoData = {
    stats: { totalGames: 107814, totalDevelopers: 68034, itchGames: 89157 },
    games: []
  };

  try {
    const res = await fetch("data.json");
    if (res.ok) promoData = await res.json();
  } catch (e) {
    console.warn("Using fallback data");
  }

  if (!promoData.games || promoData.games.length === 0) {
    promoData.games = [
      { title: "MADiSON", coverUrl: "madison.jpg" },
      { title: "Silent Hill 2", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2vyg.jpg" },
      { title: "Resident Evil 4", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co6b2k.jpg" },
      { title: "Visage", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co20uv.jpg" },
      { title: "Signalis", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co52b1.jpg" },
      { title: "Iron Lung", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4nla.jpg" },
      { title: "Darkwood", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1x4n.jpg" },
      { title: "FAITH", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co5p1d.jpg" },
      { title: "Crow Country", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co7uxp.jpg" },
      { title: "Mouthwashing", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co8jdf.jpg" }
    ];
  }

  populateVerticalWall(promoData.games);

  let threeAtmosphere = null;
  if (typeof ThreePromoAtmosphere !== "undefined") {
    threeAtmosphere = new ThreePromoAtmosphere();
  } else {
    initParticleCanvas();
  }

  const audioManager = initWebAudioSynth();
  initMobileTimeline(promoData.stats, audioManager, threeAtmosphere);
});

// ==========================================================================
// 1. POPULATE VERTICAL 3D WALL
// ==========================================================================
function populateVerticalWall(games) {
  const rowElements = [
    document.getElementById("marquee-row-1"),
    document.getElementById("marquee-row-2"),
    document.getElementById("marquee-row-3"),
    document.getElementById("marquee-row-4")
  ];

  if (!rowElements[0]) return;
  const totalRows = rowElements.length;
  const chunkSize = Math.max(6, Math.floor(games.length / totalRows));

  rowElements.forEach((rowEl, idx) => {
    if (!rowEl) return;
    const start = (idx * chunkSize) % games.length;
    const slice = games.slice(start, start + chunkSize);
    const pool = slice.length >= 4 ? slice : games.slice(0, 10);
    const repeated = [...pool, ...pool, ...pool, ...pool];

    rowEl.innerHTML = repeated.map(g => `
      <div class="game-poster-card">
        <img src="${g.coverUrl || 'https://images.igdb.com/igdb/image/upload/t_cover_big/co20uv.jpg'}" 
             alt="${escapeHtml(g.title)}" 
             loading="lazy" />
        <div class="card-overlay-gradient"></div>
      </div>
    `).join("");
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ==========================================================================
// 2. CANVAS EMBER PARTICLES
// ==========================================================================
function initParticleCanvas() {
  const canvas = document.getElementById("particle-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let width = (canvas.width = canvas.parentElement.clientWidth);
  let height = (canvas.height = canvas.parentElement.clientHeight);

  window.addEventListener("resize", () => {
    width = canvas.width = canvas.parentElement.clientWidth;
    height = canvas.height = canvas.parentElement.clientHeight;
  });

  const particles = [];
  const particleCount = 40;

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.2 + 0.6,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: -Math.random() * 0.6 - 0.2,
      opacity: Math.random() * 0.7 + 0.2
    });
  }

  function render() {
    ctx.clearRect(0, 0, width, height);
    for (let p of particles) {
      p.x += p.speedX;
      p.y += p.speedY;

      if (p.y < -10) {
        p.y = height + 10;
        p.x = Math.random() * width;
      }
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(229, 9, 20, ${p.opacity})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = `rgba(255, 42, 59, 0.8)`;
      ctx.fill();
    }
    requestAnimationFrame(render);
  }
  render();
}

// ==========================================================================
// 3. WEB AUDIO SYNTH
// ==========================================================================
function initWebAudioSynth() {
  let audioCtx = null;
  let isPlaying = false;
  let droneOsc1 = null;
  let droneOsc2 = null;
  let filterNode = null;
  let masterGain = null;

  const toggleBtn = document.getElementById("audio-toggle-btn");
  const audioLabel = document.getElementById("audio-label");

  function startAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 2.0);
    masterGain.connect(audioCtx.destination);

    filterNode = audioCtx.createBiquadFilter();
    filterNode.type = "lowpass";
    filterNode.frequency.setValueAtTime(140, audioCtx.currentTime);
    filterNode.connect(masterGain);

    droneOsc1 = audioCtx.createOscillator();
    droneOsc1.type = "sawtooth";
    droneOsc1.frequency.setValueAtTime(55, audioCtx.currentTime);
    droneOsc1.connect(filterNode);
    droneOsc1.start();

    droneOsc2 = audioCtx.createOscillator();
    droneOsc2.type = "sine";
    droneOsc2.frequency.setValueAtTime(54.6, audioCtx.currentTime);
    droneOsc2.connect(filterNode);
    droneOsc2.start();

    isPlaying = true;
    toggleBtn?.classList.add("audio-active");
    if (audioLabel) audioLabel.textContent = "Audio ON";
  }

  function stopAudio() {
    if (masterGain && audioCtx) {
      masterGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
      setTimeout(() => {
        try {
          droneOsc1?.stop();
          droneOsc2?.stop();
        } catch {}
      }, 500);
    }
    isPlaying = false;
    toggleBtn?.classList.remove("audio-active");
    if (audioLabel) audioLabel.textContent = "Sound";
  }

  function playSceneChime() {
    if (!audioCtx || !isPlaying) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      const freqs = [329.63, 440, 554.37, 659.25];
      osc.frequency.setValueAtTime(freqs[Math.floor(Math.random() * freqs.length)], now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 1.5);
    } catch {}
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (isPlaying) stopAudio();
      else startAudio();
    });
  }

  return { playChime: playSceneChime };
}

// ==========================================================================
// 4. TIMELINE & TOUCH CONTROLS (SHORTS / STORIES TAP)
// ==========================================================================
function initMobileTimeline(stats, audio, threeAtmosphere) {
  const scenes = Array.from(document.querySelectorAll(".scene"));
  const segments = Array.from(document.querySelectorAll(".story-segment"));
  const segmentFills = Array.from(document.querySelectorAll(".story-segment-fill"));

  let currentIdx = 0;
  let isPaused = false;
  const SCENE_DURATION_MS = 5000; // 5s per scene
  let sceneStartTime = performance.now();
  let animationFrameId = null;

  function showScene(idx) {
    if (idx < 0) idx = scenes.length - 1;
    if (idx >= scenes.length) idx = 0;

    currentIdx = idx;
    sceneStartTime = performance.now();

    scenes.forEach((s, i) => {
      if (i === currentIdx) s.classList.add("active");
      else s.classList.remove("active");
    });

    segments.forEach((seg, i) => {
      if (i < currentIdx) {
        seg.classList.add("completed");
        if (segmentFills[i]) segmentFills[i].style.width = "100%";
      } else if (i === currentIdx) {
        seg.classList.remove("completed");
        if (segmentFills[i]) segmentFills[i].style.width = "0%";
      } else {
        seg.classList.remove("completed");
        if (segmentFills[i]) segmentFills[i].style.width = "0%";
      }
    });

    if (currentIdx === 1) {
      animateMobileCounters(stats);
    }

    if (threeAtmosphere && typeof threeAtmosphere.setSceneMood === "function") {
      threeAtmosphere.setSceneMood(currentIdx);
    }

    audio.playChime();
  }

  function tick(now) {
    if (!isPaused) {
      const elapsed = now - sceneStartTime;
      const progress = Math.min(elapsed / SCENE_DURATION_MS, 1);

      if (segmentFills[currentIdx]) {
        segmentFills[currentIdx].style.width = `${progress * 100}%`;
      }

      if (progress >= 1) {
        showScene((currentIdx + 1) % scenes.length);
      }
    }
    animationFrameId = requestAnimationFrame(tick);
  }

  // Touch zones: Tap Right = Next, Tap Left = Prev, Hold = Pause
  const touchLeft = document.getElementById("touch-zone-left");
  const touchRight = document.getElementById("touch-zone-right");

  let pressTimer = null;

  function handleTouchStart() {
    pressTimer = setTimeout(() => {
      isPaused = true;
    }, 200);
  }

  function handleTouchEnd(callback) {
    clearTimeout(pressTimer);
    if (isPaused) {
      isPaused = false;
      sceneStartTime = performance.now();
    } else {
      callback();
    }
  }

  touchRight?.addEventListener("pointerdown", handleTouchStart);
  touchRight?.addEventListener("pointerup", () => handleTouchEnd(() => showScene(currentIdx + 1)));

  touchLeft?.addEventListener("pointerdown", handleTouchStart);
  touchLeft?.addEventListener("pointerup", () => handleTouchEnd(() => showScene(currentIdx - 1)));

  // Keyboard navigation support
  window.addEventListener("keydown", e => {
    if (e.code === "Space") {
      isPaused = !isPaused;
    } else if (e.code === "ArrowRight") {
      showScene(currentIdx + 1);
    } else if (e.code === "ArrowLeft") {
      showScene(currentIdx - 1);
    } else if (["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"].includes(e.code)) {
      showScene(parseInt(e.code.replace("Digit", ""), 10) - 1);
    }
  });

  showScene(0);
  animationFrameId = requestAnimationFrame(tick);
}

// ==========================================================================
// 5. ANIMATED NUMERICAL COUNTERS
// ==========================================================================
function animateMobileCounters(stats) {
  const totalGamesEl = document.getElementById("mobile-stat-games");
  const itchGamesEl = document.getElementById("mobile-stat-itch");
  const devsEl = document.getElementById("mobile-stat-devs");

  if (totalGamesEl) animateNum(totalGamesEl, stats.totalGames || 107814, 1400);
  if (itchGamesEl) animateNum(itchGamesEl, stats.itchGames || 89157, 1400);
  if (devsEl) animateNum(devsEl, stats.totalDevelopers || 68034, 1400);
}

function animateNum(el, target, duration) {
  const start = performance.now();
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(ease * target).toLocaleString("en-US");
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target.toLocaleString("en-US");
  }
  requestAnimationFrame(step);
}
