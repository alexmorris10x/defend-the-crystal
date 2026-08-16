import * as THREE from 'three';
import './style.css';

const GAME_DURATION = 60;
const ARENA_RADIUS = 14;
const PLAYER_SPEED = 7.5;
const ATTACK_RANGE = 7;
const ATTACK_INTERVAL = 0.42;

class EnemyVisual extends THREE.Group {
  static HEIGHT = 1.8;
  static RADIUS = 0.55;

  constructor() {
    super();
    this.state = 'walk';
    this.stateTime = 0;

    const skin = new THREE.MeshStandardMaterial({
      color: 0x9d6bff,
      roughness: 0.62,
      metalness: 0.05,
      emissive: 0x1c0e3d,
      emissiveIntensity: 0.55,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x251f38, roughness: 0.8 });

    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.43, 0.64, 5, 9), skin);
    this.body.position.y = 1.02;
    this.body.castShadow = true;
    this.add(this.body);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 9), skin);
    this.head.scale.set(1.12, 0.9, 0.95);
    this.head.position.set(0, 1.65, 0.02);
    this.head.castShadow = true;
    this.add(this.head);

    const hornGeometry = new THREE.ConeGeometry(0.11, 0.42, 6);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(hornGeometry, dark);
      horn.position.set(side * 0.28, 1.98, 0);
      horn.rotation.z = side * -0.34;
      this.add(horn);
    }

    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffd66b });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMaterial);
      eye.position.set(side * 0.14, 1.7, 0.39);
      this.add(eye);
    }

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.58, 20),
      new THREE.MeshBasicMaterial({ color: 0x070812, transparent: true, opacity: 0.38 }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.015;
    this.add(this.shadow);
  }

  setState(state) {
    if (state === this.state) return;
    this.state = state;
    this.stateTime = 0;
  }

  update(delta, elapsed) {
    this.stateTime += delta;

    if (this.state === 'walk') {
      this.body.position.y = 1.02 + Math.sin(elapsed * 10) * 0.06;
      this.head.rotation.z = Math.sin(elapsed * 7) * 0.045;
      this.rotation.z = Math.sin(elapsed * 10) * 0.025;
    } else if (this.state === 'attack') {
      const strike = Math.sin(Math.min(1, this.stateTime / 0.48) * Math.PI);
      this.body.rotation.x = strike * 0.32;
      this.position.y = strike * 0.08;
    } else if (this.state === 'hit') {
      this.body.material.emissive.setHex(0xff355f);
      this.body.material.emissiveIntensity = 1.5;
      this.position.x = Math.sin(this.stateTime * 55) * 0.05;
      if (this.stateTime > 0.12) {
        this.body.material.emissive.setHex(0x1c0e3d);
        this.body.material.emissiveIntensity = 0.55;
        this.position.x = 0;
        this.setState('walk');
      }
    } else if (this.state === 'death') {
      this.rotation.z = Math.min(Math.PI / 2, this.stateTime * 5);
      this.scale.multiplyScalar(Math.max(0.94, 1 - delta * 2.3));
    }
  }
}

class Game {
  constructor() {
    this.canvas = document.querySelector('#game');
    this.overlay = document.querySelector('#overlay');
    this.startButton = document.querySelector('#start-button');
    this.healthBar = document.querySelector('#health-bar');
    this.healthValue = document.querySelector('#health-value');
    this.timerValue = document.querySelector('#timer');
    this.scoreValue = document.querySelector('#score');

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080b16);
    this.scene.fog = new THREE.FogExp2(0x080b16, 0.027);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    this.camera.position.set(0, 18, 19);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.clock = new THREE.Clock();
    this.keys = new Set();
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.attackTimer = 0;
    this.crystalHealth = 100;
    this.score = 0;
    this.running = false;

    this.buildWorld();
    this.bindEvents();
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  buildWorld() {
    const hemi = new THREE.HemisphereLight(0xadb7ff, 0x15101f, 1.35);
    this.scene.add(hemi);

    const moon = new THREE.DirectionalLight(0x879cff, 2.3);
    moon.position.set(-8, 14, 7);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -18;
    moon.shadow.camera.right = 18;
    moon.shadow.camera.top = 18;
    moon.shadow.camera.bottom = -18;
    this.scene.add(moon);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA_RADIUS + 2, 64),
      new THREE.MeshStandardMaterial({ color: 0x171a2b, roughness: 0.93, metalness: 0.04 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const rings = new THREE.Group();
    for (const radius of [4, 8, 12, 15.2]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.025, radius + 0.025, 96),
        new THREE.MeshBasicMaterial({ color: radius === 15.2 ? 0x493d70 : 0x292946, transparent: true, opacity: 0.85 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.012;
      rings.add(ring);
    }
    this.scene.add(rings);

    this.addArenaProps();
    this.buildCrystal();
    this.buildPlayer();
  }

  addArenaProps() {
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x282b43, roughness: 0.92 });
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2 + (i % 2) * 0.08;
      const radius = 15.4 + (i % 3) * 0.65;
      const height = 0.7 + (i % 4) * 0.24;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 + (i % 3) * 0.12, 0), stoneMaterial);
      rock.position.set(Math.cos(angle) * radius, height * 0.38, Math.sin(angle) * radius);
      rock.scale.set(1, height, 1);
      rock.rotation.set(i * 0.3, i * 0.47, i * 0.2);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    }
  }

  buildCrystal() {
    this.crystal = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.55, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x25283d, roughness: 0.72, metalness: 0.18 }),
    );
    base.position.y = 0.28;
    base.castShadow = true;
    base.receiveShadow = true;
    this.crystal.add(base);

    this.crystalMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.86, 0),
      new THREE.MeshStandardMaterial({
        color: 0xff69ab,
        emissive: 0xff246f,
        emissiveIntensity: 2.5,
        roughness: 0.2,
        metalness: 0.18,
      }),
    );
    this.crystalMesh.scale.y = 1.65;
    this.crystalMesh.position.y = 1.65;
    this.crystalMesh.castShadow = true;
    this.crystal.add(this.crystalMesh);

    const glow = new THREE.PointLight(0xff4c9b, 4.5, 10, 2);
    glow.position.y = 1.7;
    this.crystal.add(glow);
    this.scene.add(this.crystal);
  }

  buildPlayer() {
    this.player = new THREE.Group();
    const armor = new THREE.MeshStandardMaterial({
      color: 0x56d8ff,
      emissive: 0x0a6b94,
      emissiveIntensity: 0.7,
      roughness: 0.42,
      metalness: 0.48,
    });
    const core = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7fdfff, emissiveIntensity: 2 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.56, 0.95, 8), armor);
    body.position.y = 0.66;
    body.castShadow = true;
    this.player.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), armor);
    head.position.y = 1.34;
    head.castShadow = true;
    this.player.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.08), core);
    visor.position.set(0, 1.38, 0.3);
    this.player.add(visor);

    const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.45, 6), armor);
    pointer.rotation.x = Math.PI / 2;
    pointer.position.set(0, 0.72, 0.61);
    this.player.add(pointer);

    this.player.position.set(0, 0, 4.2);
    this.scene.add(this.player);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (event) => this.keys.add(event.code));
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.startButton.addEventListener('click', () => this.start());
  }

  start() {
    this.clearActors();
    this.elapsed = 0;
    this.spawnTimer = 0.45;
    this.attackTimer = 0;
    this.crystalHealth = 100;
    this.score = 0;
    this.player.position.set(0, 0, 4.2);
    this.running = true;
    this.overlay.classList.add('hidden');
    this.updateHud();
  }

  clearActors() {
    for (const enemy of this.enemies) this.scene.remove(enemy.visual);
    for (const projectile of this.projectiles) this.scene.remove(projectile.mesh);
    for (const particle of this.particles) this.scene.remove(particle.mesh);
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.particles.length = 0;
  }

  spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const visual = new EnemyVisual();
    visual.position.set(Math.cos(angle) * ARENA_RADIUS, 0, Math.sin(angle) * ARENA_RADIUS);
    visual.rotation.y = Math.atan2(-visual.position.x, -visual.position.z);
    this.scene.add(visual);

    this.enemies.push({
      visual,
      health: 2,
      speed: 1.45 + Math.random() * 0.5 + this.elapsed * 0.006,
      attackCooldown: Math.random() * 0.5,
      dying: false,
      deathTime: 0,
    });
  }

  updatePlayer(delta) {
    const movement = new THREE.Vector3(
      Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')),
      0,
      Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')),
    );

    if (movement.lengthSq() > 0) {
      movement.normalize();
      this.player.position.addScaledVector(movement, PLAYER_SPEED * delta);
      this.player.rotation.y = Math.atan2(movement.x, movement.z);
      this.player.position.y = Math.abs(Math.sin(this.elapsed * 11)) * 0.05;
    } else {
      this.player.position.y = 0;
    }

    const distance = Math.hypot(this.player.position.x, this.player.position.z);
    if (distance > 11.9) {
      this.player.position.x *= 11.9 / distance;
      this.player.position.z *= 11.9 / distance;
    }

    this.attackTimer -= delta;
    if (this.attackTimer <= 0) {
      const target = this.findNearestEnemy();
      if (target) {
        this.fire(target);
        this.attackTimer = ATTACK_INTERVAL;
      }
    }
  }

  findNearestEnemy() {
    let nearest = null;
    let nearestDistance = ATTACK_RANGE;
    for (const enemy of this.enemies) {
      if (enemy.dying) continue;
      const distance = enemy.visual.position.distanceTo(this.player.position);
      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  fire(target) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xb9f3ff }),
    );
    mesh.position.copy(this.player.position).add(new THREE.Vector3(0, 1.05, 0));
    this.scene.add(mesh);
    this.projectiles.push({ mesh, target, speed: 18, life: 1.2 });

    const direction = target.visual.position.clone().sub(this.player.position);
    this.player.rotation.y = Math.atan2(direction.x, direction.z);
  }

  updateProjectiles(delta) {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      projectile.life -= delta;

      if (projectile.life <= 0 || projectile.target.dying || !this.enemies.includes(projectile.target)) {
        this.scene.remove(projectile.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      const targetPosition = projectile.target.visual.position.clone().add(new THREE.Vector3(0, 1, 0));
      const direction = targetPosition.sub(projectile.mesh.position);
      if (direction.length() < 0.38) {
        this.hitEnemy(projectile.target);
        this.scene.remove(projectile.mesh);
        this.projectiles.splice(i, 1);
      } else {
        projectile.mesh.position.addScaledVector(direction.normalize(), projectile.speed * delta);
      }
    }
  }

  hitEnemy(enemy) {
    enemy.health -= 1;
    this.burst(enemy.visual.position, 0x9feeff, 5);
    if (enemy.health <= 0) {
      enemy.dying = true;
      enemy.visual.setState('death');
      this.score += 1;
      this.scoreValue.textContent = String(this.score);
    } else {
      enemy.visual.setState('hit');
    }
  }

  updateEnemies(delta) {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      enemy.visual.update(delta, this.elapsed + i * 0.4);

      if (enemy.dying) {
        enemy.deathTime += delta;
        if (enemy.deathTime > 0.52) {
          this.burst(enemy.visual.position, 0x9d6bff, 7);
          this.scene.remove(enemy.visual);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      const distance = enemy.visual.position.length();
      if (distance > 1.75) {
        const direction = enemy.visual.position.clone().multiplyScalar(-1).normalize();
        enemy.visual.position.addScaledVector(direction, enemy.speed * delta);
        enemy.visual.rotation.y = Math.atan2(direction.x, direction.z);
        if (enemy.visual.state !== 'hit') enemy.visual.setState('walk');
      } else {
        enemy.attackCooldown -= delta;
        if (enemy.attackCooldown <= 0) {
          enemy.visual.setState('attack');
          enemy.attackCooldown = 0.78;
          this.damageCrystal(4);
        }
      }
    }
  }

  damageCrystal(amount) {
    this.crystalHealth = Math.max(0, this.crystalHealth - amount);
    this.crystalMesh.material.emissive.setHex(0xffffff);
    window.setTimeout(() => this.crystalMesh.material.emissive.setHex(0xff246f), 75);
    this.updateHud();
    if (this.crystalHealth <= 0) this.end(false);
  }

  burst(position, color, count) {
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.07 + Math.random() * 0.08),
        new THREE.MeshBasicMaterial({ color }),
      );
      mesh.position.copy(position).add(new THREE.Vector3(0, 0.8, 0));
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4),
        life: 0.55,
      });
    }
  }

  updateParticles(delta) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.life -= delta;
      particle.velocity.y -= 8 * delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.mesh.scale.setScalar(Math.max(0, particle.life * 1.7));
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  updateHud() {
    this.healthBar.style.width = `${this.crystalHealth}%`;
    this.healthValue.textContent = String(Math.ceil(this.crystalHealth));
    const remaining = Math.max(0, Math.ceil(GAME_DURATION - this.elapsed));
    this.timerValue.textContent = `0:${String(remaining).padStart(2, '0')}`;
  }

  end(won) {
    this.running = false;
    const kicker = this.overlay.querySelector('.kicker');
    const title = this.overlay.querySelector('h1');
    const copy = this.overlay.querySelector('p');
    kicker.textContent = won ? 'DAWN HAS ARRIVED' : 'THE CRYSTAL HAS FALLEN';
    title.innerHTML = won ? 'Night<br /><em>Survived</em>' : 'Try<br /><em>Again</em>';
    copy.textContent = won
      ? `You held the line and cleared ${this.score} creatures.`
      : `You cleared ${this.score} creatures before the crystal broke.`;
    this.startButton.textContent = 'PLAY AGAIN';
    this.overlay.classList.remove('hidden');
  }

  frame() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const ambientTime = performance.now() * 0.001;

    this.crystalMesh.rotation.y += delta * 0.75;
    this.crystalMesh.position.y = 1.65 + Math.sin(ambientTime * 2) * 0.08;

    if (this.running) {
      this.elapsed += delta;
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.spawnTimer = Math.max(0.58, 1.35 - this.elapsed * 0.009);
      }

      this.updatePlayer(delta);
      this.updateEnemies(delta);
      this.updateProjectiles(delta);
      this.updateParticles(delta);
      this.updateHud();

      if (this.elapsed >= GAME_DURATION) this.end(true);
    } else {
      this.updateParticles(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }
}

new Game();

