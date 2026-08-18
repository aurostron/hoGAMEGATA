// === HOGAMEGATA THREE.JS CINEMATIC 3D ATMOSPHERE ENGINE ===

class ThreePromoAtmosphere {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId) || document.body;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particleSystem = null;
    this.haloMesh = null;
    this.pointLight = null;
    this.particlesData = [];
    this.targetCameraPos = { x: 0, y: 0, z: 180 };
    this.currentCameraPos = { x: 0, y: 0, z: 180 };
    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.particleSpeedMult = 1.0;
    this.targetSpeedMult = 1.0;
    this.clock = null;
    this.animationFrameId = null;
    this.isInitialized = false;

    this.init();
  }

  init() {
    if (typeof THREE === "undefined") {
      console.warn("Three.js not loaded yet. Retrying in 100ms...");
      setTimeout(() => this.init(), 100);
      return;
    }

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Scene & Clock
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030305, 0.0035);
    this.clock = new THREE.Clock();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 180);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = "0";
    this.renderer.domElement.style.left = "0";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.zIndex = "2";
    this.renderer.domElement.style.pointerEvents = "none";
    this.container.appendChild(this.renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0x1a0a0f, 1.2);
    this.scene.add(ambientLight);

    this.pointLight = new THREE.PointLight(0xe50914, 2.5, 300);
    this.pointLight.position.set(0, 0, 50);
    this.scene.add(this.pointLight);

    // 5. Build 3D Elements
    this.createVolumetricParticleCloud();
    this.createAtmosphericHalo();

    // 6. Listeners
    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("mousemove", (e) => this.onMouseMove(e));

    this.isInitialized = true;
    this.animate();
  }

  createVolumetricParticleCloud() {
    const particleCount = 900;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const color1 = new THREE.Color(0xe50914); // Crimson red
    const color2 = new THREE.Color(0xff3b30); // Bright ember
    const color3 = new THREE.Color(0x3a080c); // Deep blood
    const color4 = new THREE.Color(0x71717a); // Dark ash

    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 450;
      const y = (Math.random() - 0.5) * 350;
      const z = (Math.random() - 0.5) * 350;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color variation
      const r = Math.random();
      let c = color1;
      if (r < 0.3) c = color2;
      else if (r < 0.6) c = color3;
      else if (r < 0.85) c = color1;
      else c = color4;

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = Math.random() * 3.5 + 1.2;

      this.particlesData.push({
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.25,
          Math.random() * 0.45 + 0.15,
          (Math.random() - 0.5) * 0.25
        ),
        seed: Math.random() * 100,
        originalY: y
      });
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    // Procedural soft circle sprite
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.3, "rgba(255, 100, 100, 0.8)");
    gradient.addColorStop(0.7, "rgba(229, 9, 20, 0.2)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 4.5,
      map: texture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
  }

  createAtmosphericHalo() {
    // 3D Geometric wireframe aura
    const geo = new THREE.IcosahedronGeometry(75, 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xe50914,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending
    });
    this.haloMesh = new THREE.Mesh(geo, mat);
    this.haloMesh.position.set(0, 0, -20);
    this.scene.add(this.haloMesh);
  }

  onResize() {
    if (!this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  onMouseMove(e) {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.mouse.targetX = x * 15;
    this.mouse.targetY = y * 10;
  }

  // Called when active scene changes
  setSceneMood(sceneIndex) {
    switch (sceneIndex) {
      case 0: // Scene 1: Netflix 3D Wall
        this.targetCameraPos = { x: 0, y: 0, z: 180 };
        this.targetSpeedMult = 1.0;
        if (this.haloMesh) {
          this.haloMesh.scale.set(1, 1, 1);
          this.haloMesh.material.opacity = 0.07;
          this.haloMesh.material.color.setHex(0xe50914);
        }
        break;

      case 1: // Scene 2: Scale & Numbers Explosion
        this.targetCameraPos = { x: 0, y: 10, z: 140 };
        this.targetSpeedMult = 2.4; // Embers accelerate with data
        if (this.haloMesh) {
          this.haloMesh.scale.set(1.3, 1.3, 1.3);
          this.haloMesh.material.opacity = 0.12;
          this.haloMesh.material.color.setHex(0xff2a3b);
        }
        break;

      case 2: // Scene 3: Curation Spectrum
        this.targetCameraPos = { x: 0, y: -8, z: 165 };
        this.targetSpeedMult = 1.2;
        if (this.haloMesh) {
          this.haloMesh.scale.set(1.1, 1.1, 1.1);
          this.haloMesh.material.opacity = 0.09;
        }
        break;

      case 3: // Scene 4: Live Deals Engine
        this.targetCameraPos = { x: 12, y: 0, z: 155 };
        this.targetSpeedMult = 1.4;
        if (this.haloMesh) {
          this.haloMesh.scale.set(1.2, 1.2, 1.2);
          this.haloMesh.material.opacity = 0.14;
          this.haloMesh.material.color.setHex(0x10b981); // Emerald hint for deals
        }
        break;

      case 4: // Scene 5: Community Mission
        this.targetCameraPos = { x: 0, y: 0, z: 175 };
        this.targetSpeedMult = 0.75; // Calm ethereal motion
        if (this.haloMesh) {
          this.haloMesh.scale.set(1.0, 1.0, 1.0);
          this.haloMesh.material.opacity = 0.08;
          this.haloMesh.material.color.setHex(0xe50914);
        }
        break;

      case 5: // Scene 6: Outro ("Made with ❤️ aurostron.")
        this.targetCameraPos = { x: 0, y: 0, z: 120 }; // Push in close
        this.targetSpeedMult = 1.8;
        if (this.haloMesh) {
          this.haloMesh.scale.set(1.4, 1.4, 1.4);
          this.haloMesh.material.opacity = 0.16;
          this.haloMesh.material.color.setHex(0xffffff); // White glow for finale
        }
        break;
    }
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    const delta = this.clock ? this.clock.getDelta() : 0.016;
    const time = this.clock ? this.clock.getElapsedTime() : performance.now() * 0.001;

    // 1. Lerp Camera & Mouse Parallax
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

    this.currentCameraPos.x += (this.targetCameraPos.x + this.mouse.x - this.currentCameraPos.x) * 0.04;
    this.currentCameraPos.y += (this.targetCameraPos.y + this.mouse.y - this.currentCameraPos.y) * 0.04;
    this.currentCameraPos.z += (this.targetCameraPos.z - this.currentCameraPos.z) * 0.04;

    this.camera.position.set(this.currentCameraPos.x, this.currentCameraPos.y, this.currentCameraPos.z);
    this.camera.lookAt(0, 0, 0);

    // 2. Smooth Speed Multiplier
    this.particleSpeedMult += (this.targetSpeedMult - this.particleSpeedMult) * 0.05;

    // 3. Animate 3D Particles
    if (this.particleSystem) {
      const positions = this.particleSystem.geometry.attributes.position.array;
      const count = this.particlesData.length;

      for (let i = 0; i < count; i++) {
        const data = this.particlesData[i];
        
        // Upward floating with harmonic wave
        positions[i * 3 + 1] += data.velocity.y * this.particleSpeedMult;
        positions[i * 3] += Math.sin(time * 0.8 + data.seed) * 0.15;
        positions[i * 3 + 2] += Math.cos(time * 0.6 + data.seed) * 0.15;

        // Reset if drifted above top
        if (positions[i * 3 + 1] > 180) {
          positions[i * 3 + 1] = -180;
          positions[i * 3] = (Math.random() - 0.5) * 450;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 350;
        }
      }
      this.particleSystem.geometry.attributes.position.needsUpdate = true;
      this.particleSystem.rotation.y = time * 0.02;
    }

    // 4. Animate Halo Mesh
    if (this.haloMesh) {
      this.haloMesh.rotation.x = time * 0.05;
      this.haloMesh.rotation.y = time * 0.07;
      this.haloMesh.rotation.z = Math.sin(time * 0.04) * 0.1;
    }

    // 5. Pulse PointLight
    if (this.pointLight) {
      this.pointLight.intensity = 2.0 + Math.sin(time * 2.5) * 0.8;
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.renderer && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
  }
}

// Attach globally
window.ThreePromoAtmosphere = ThreePromoAtmosphere;
