// === HOGAMEGATA CINEMATIC VIDEO REEL ENGINE ===

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Fetch live or fallback promo data
  let promoData = {
    stats: { totalGames: 107814, totalDevelopers: 68034, itchGames: 89157, totalLinks: 102276, totalSnapshots: 95418 },
    games: []
  };

  try {
    const res = await fetch("data.json");
    if (res.ok) {
      promoData = await res.json();
    }
  } catch (e) {
    console.warn("Using embedded fallback data");
  }

  // Fallback rich horror games list
  if (!promoData.games || promoData.games.length === 0) {
    promoData.games = [
      { title: "MADiSON", developerNames: "BLOODIOUS GAMES", coverUrl: "madison.jpg" },
      { title: "Silent Hill 2", developerNames: "Team Silent", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2vyg.jpg" },
      { title: "Resident Evil 4", developerNames: "Capcom", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co6b2k.jpg" },
      { title: "Visage", developerNames: "SadSquare Studio", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co20uv.jpg" },
      { title: "Signalis", developerNames: "rose-engine", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co52b1.jpg" },
      { title: "Iron Lung", developerNames: "David Szymanski", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4nla.jpg" },
      { title: "Darkwood", developerNames: "Acid Wizard Studio", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1x4n.jpg" },
      { title: "FAITH: The Unholy Trinity", developerNames: "Airdorf Games", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co5p1d.jpg" },
      { title: "Crow Country", developerNames: "SFB Games", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co7uxp.jpg" },
      { title: "Mouthwashing", developerNames: "Wrong Organ", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co8jdf.jpg" },
      { title: "Cry of Fear", developerNames: "Team Psykskallar", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2k34.jpg" },
      { title: "Alan Wake 2", developerNames: "Remedy Entertainment", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co6q0n.jpg" },
      { title: "Dead Space", developerNames: "Motive Studio", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co5k3i.jpg" },
      { title: "Alien: Isolation", developerNames: "Creative Assembly", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1tq9.jpg" },
      { title: "Outlast", developerNames: "Red Barrels", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1sps.jpg" },
      { title: "Lethal Company", developerNames: "Zeekerss", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co7i7l.jpg" }
    ];
  }

  // 2. Populate 6 Massive Marquee Rows for 3D Netflix Wall
  populateDense3DWall(promoData.games);

  // 3. Setup Three.js Cinematic 3D Atmosphere
  let threeAtmosphere = null;
  if (typeof ThreePromoAtmosphere !== "undefined") {
    threeAtmosphere = new ThreePromoAtmosphere();
  } else {
    initParticleCanvas();
  }

  // 4. Setup Web Audio Ambient Soundscape
  const audioManager = initWebAudioSynth();

  // 5. Setup Video Timeline & Scrub Bar
  initVideoTimeline(promoData.stats, audioManager, threeAtmosphere);

  // 6. Setup Mouse Parallax & Auto-Hide Inactive Cursor
  initCinemaParallax();
});

// ==========================================================================
// 1. POPULATE 6-ROW DENSE 3D NETFLIX WALL
// ==========================================================================
function populateDense3DWall(games) {
  const rowElements = [
    document.getElementById("marquee-row-1"),
    document.getElementById("marquee-row-2"),
    document.getElementById("marquee-row-3"),
    document.getElementById("marquee-row-4"),
    document.getElementById("marquee-row-5"),
    document.getElementById("marquee-row-6")
  ];

  if (!rowElements[0]) return;

  const totalRows = rowElements.length;
  const chunkSize = Math.max(8, Math.floor(games.length / totalRows));

  rowElements.forEach((rowEl, idx) => {
    if (!rowEl) return;
    const start = (idx * chunkSize) % games.length;
    const slice = games.slice(start, start + chunkSize);
    const pool = slice.length >= 6 ? slice : games.slice(0, 16);

    // Quadruple for continuous smooth scrolling marquee
    const repeated = [...pool, ...pool, ...pool, ...pool];

    rowEl.innerHTML = repeated.map(g => `
      <div class="game-poster-card" title="${escapeHtml(g.title)}">
        <img src="${g.coverUrl || 'https://images.igdb.com/igdb/image/upload/t_cover_big/co20uv.jpg'}" 
             alt="${escapeHtml(g.title)}" 
             loading="lazy" 
             onerror="this.src='https://images.igdb.com/igdb/image/upload/t_cover_big/co20uv.jpg'" />
        <div class="card-overlay-gradient"></div>
        <div class="card-info">
          <div class="card-title">${escapeHtml(g.title)}</div>
        </div>
      </div>
    `).join("");
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ==========================================================================
// 2. CANVAS EMBER PARTICLES
// ==========================================================================
function initParticleCanvas() {
  const canvas = document.getElementById("particle-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = [];
  const particleCount = 60;

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.8 + 0.6,
      speedX: (Math.random() - 0.5) * 0.35,
      speedY: -Math.random() * 0.7 - 0.25,
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
      ctx.shadowBlur = 12;
      ctx.shadowColor = `rgba(255, 42, 59, 0.8)`;
      ctx.fill();
    }

    requestAnimationFrame(render);
  }

  render();
}

// ==========================================================================
// 3. WEB AUDIO AMBIENT SYNTH (SUB-BASS & SCI-FI CHIMES)
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
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 2.5);
    masterGain.connect(audioCtx.destination);

    filterNode = audioCtx.createBiquadFilter();
    filterNode.type = "lowpass";
    filterNode.frequency.setValueAtTime(150, audioCtx.currentTime);
    filterNode.connect(masterGain);

    // Deep sub drone 1 (55Hz / A1)
    droneOsc1 = audioCtx.createOscillator();
    droneOsc1.type = "sawtooth";
    droneOsc1.frequency.setValueAtTime(55, audioCtx.currentTime);
    droneOsc1.connect(filterNode);
    droneOsc1.start();

    // Pulse wave 2 (54.6Hz for binaural warmth)
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
      masterGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6);
      setTimeout(() => {
        try {
          droneOsc1?.stop();
          droneOsc2?.stop();
        } catch {}
      }, 600);
    }
    isPlaying = false;
    toggleBtn?.classList.remove("audio-active");
    if (audioLabel) audioLabel.textContent = "Audio OFF";
  }

  function playSceneChime() {
    if (!audioCtx || !isPlaying) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      const freqs = [329.63, 440, 554.37, 659.25, 880];
      const freq = freqs[Math.floor(Math.random() * freqs.length)];
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 1.8);
    } catch {}
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (isPlaying) stopAudio();
      else startAudio();
    });
  }

  return {
    playChime: playSceneChime,
    toggle: () => {
      if (isPlaying) stopAudio();
      else startAudio();
    }
  };
}

// ==========================================================================
// 4. VIDEO TIMELINE & CONTINUOUS SMOOTH PROGRESS
// ==========================================================================
function initVideoTimeline(stats, audio, threeAtmosphere) {
  const scenes = Array.from(document.querySelectorAll(".scene"));
  const markers = Array.from(document.querySelectorAll(".scene-marker"));
  const scrubFill = document.getElementById("scrub-fill");

  let currentIdx = 0;
  let isPlaying = true;
  const SCENE_DURATION_MS = 6000; // 6 seconds per scene
  const TOTAL_DURATION_MS = SCENE_DURATION_MS * scenes.length; // 36s total video reel
  let startTime = performance.now();
  let animationFrameId = null;

  function showScene(idx) {
    if (idx < 0) idx = scenes.length - 1;
    if (idx >= scenes.length) idx = 0;

    currentIdx = idx;

    scenes.forEach((s, i) => {
      if (i === currentIdx) {
        s.classList.add("active");
      } else {
        s.classList.remove("active");
      }
    });

    markers.forEach((m, i) => {
      if (i === currentIdx) {
        m.classList.add("active");
      } else {
        m.classList.remove("active");
      }
    });

    if (currentIdx === 1) {
      animateStatsNumbers(stats);
    }

    if (threeAtmosphere && typeof threeAtmosphere.setSceneMood === "function") {
      threeAtmosphere.setSceneMood(currentIdx);
    }

    audio.playChime();
  }

  function tickTimeline(now) {
    if (!isPlaying) return;

    const elapsedTotal = (now - startTime) % TOTAL_DURATION_MS;
    const progressPercent = (elapsedTotal / TOTAL_DURATION_MS) * 100;

    if (scrubFill) {
      scrubFill.style.width = `${progressPercent}%`;
    }

    const calculatedScene = Math.floor(elapsedTotal / SCENE_DURATION_MS);
    if (calculatedScene !== currentIdx && calculatedScene < scenes.length) {
      showScene(calculatedScene);
    }

    animationFrameId = requestAnimationFrame(tickTimeline);
  }

  function startVideoReel() {
    isPlaying = true;
    startTime = performance.now() - (currentIdx * SCENE_DURATION_MS);
    animationFrameId = requestAnimationFrame(tickTimeline);
  }

  function pauseVideoReel() {
    isPlaying = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  }

  markers.forEach(m => {
    m.addEventListener("click", () => {
      const target = parseInt(m.getAttribute("data-scene"), 10);
      startTime = performance.now() - (target * SCENE_DURATION_MS);
      showScene(target);
    });
  });

  // Global Keyboard Controls (Zero UI buttons required on video)
  window.addEventListener("keydown", e => {
    if (e.code === "Space") {
      e.preventDefault();
      if (isPlaying) pauseVideoReel();
      else startVideoReel();
    } else if (e.code === "ArrowRight") {
      const next = (currentIdx + 1) % scenes.length;
      startTime = performance.now() - (next * SCENE_DURATION_MS);
      showScene(next);
    } else if (e.code === "ArrowLeft") {
      const prev = (currentIdx - 1 + scenes.length) % scenes.length;
      startTime = performance.now() - (prev * SCENE_DURATION_MS);
      showScene(prev);
    } else if (["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"].includes(e.code)) {
      const target = parseInt(e.code.replace("Digit", ""), 10) - 1;
      startTime = performance.now() - (target * SCENE_DURATION_MS);
      showScene(target);
    } else if (e.code === "KeyF") {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    } else if (e.code === "KeyM") {
      audio.toggle();
    }
  });

  showScene(0);
  startVideoReel();
}

// ==========================================================================
// 5. ANIMATED NUMERICAL COUNTERS
// ==========================================================================
function animateStatsNumbers(stats) {
  const totalGamesEl = document.getElementById("stat-total-games");
  const totalDevsEl = document.getElementById("stat-total-devs");
  const itchGamesEl = document.getElementById("stat-itch-games");

  if (totalGamesEl) animateCounter(totalGamesEl, stats.totalGames || 107814, 1600);
  if (totalDevsEl) animateCounter(totalDevsEl, stats.totalDevelopers || 68034, 1600);
  if (itchGamesEl) animateCounter(itchGamesEl, stats.itchGames || 89157, 1600);
}

function animateCounter(el, target, duration) {
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 4); // Quartic ease out
    const current = Math.floor(ease * target);
    el.textContent = current.toLocaleString("en-US");

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = target.toLocaleString("en-US");
    }
  }
  requestAnimationFrame(update);
}

// ==========================================================================
// 6. CINEMATIC 3D PARALLAX & CURSOR AUTO-HIDE
// ==========================================================================
function initCinemaParallax() {
  const wall = document.querySelector(".wall-3d-grid");
  let idleTimer = null;

  window.addEventListener("mousemove", e => {
    // Show cursor on movement
    document.body.classList.remove("hide-cursor");
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      document.body.classList.add("hide-cursor");
    }, 1500);

    // Subtle 3D perspective tilt
    if (wall) {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;

      const rotX = 22 - y * 4;
      const rotY = -16 + x * 5;
      const rotZ = -9 + x * 1.5;

      wall.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg) translateY(-20px) scale(1.3)`;
    }
  });
}
