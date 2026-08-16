import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import './style.css';

const HORDE_DURATION = 30;
const BASE_ENEMY_SPAWN_INTERVAL = 7;
const HORDE_SPAWN_FREQUENCY_GROWTH = 1.1;
const MIN_ENEMY_SPAWN_INTERVAL = 0.9;
const ARENA_RADIUS = 26;
const PLAYER_BOUNDARY = ARENA_RADIUS - 2.4;
const PLAYER_SPEED = 7.5;
const TOUCH_AIM_DISTANCE = 10;
const FIRE_INTERVAL = 0.32;
const RAPID_FIRE_INTERVAL = 0.16;
const POWER_UP_DURATION = 10;
const POWER_UP_LIFETIME = 15;
const MAX_POWER_UPS = 2;
const PROJECTILE_SPEED = 24;
const PROJECTILE_LIFETIME = 2.3;
const ENEMY_ANIMATED_ASSET_URL = '/assets/enemies/crystal-brute-animated.glb';
const ENEMY_STATIC_ASSET_URL = '/assets/enemies/crystal-brute.glb';
const PLAYER_ANIMATED_ASSET_URL = '/assets/player/prism-ranger-animated.glb';

const POWER_UP_TYPES = {
  repair: { label: 'CRYSTAL REPAIR', shortLabel: '+25', color: 0x71ff9d },
  rapid: { label: 'RAPID FIRE', shortLabel: '>>', color: 0xffd66b },
  triple: { label: 'TRIPLE SHOT', shortLabel: 'x3', color: 0x74ddff },
};

function formatTime(seconds) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function createPowerUpVisual(type) {
  const config = POWER_UP_TYPES[type];
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: config.color,
    emissive: config.color,
    emissiveIntensity: 1.8,
    roughness: 0.28,
    metalness: 0.2,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), material);
  core.position.y = 0.88;
  core.castShadow = true;
  group.add(core);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.055, 8, 32),
    new THREE.MeshBasicMaterial({ color: config.color, transparent: true, opacity: 0.8 }),
  );
  ring.position.y = 0.45;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const glow = new THREE.PointLight(config.color, 2.8, 5, 2);
  glow.position.y = 1;
  group.add(glow);

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256;
  labelCanvas.height = 80;
  const context = labelCanvas.getContext('2d');
  context.fillStyle = 'rgba(7, 10, 24, 0.82)';
  context.roundRect(4, 4, 248, 72, 18);
  context.fill();
  context.strokeStyle = `#${config.color.toString(16).padStart(6, '0')}`;
  context.lineWidth = 4;
  context.stroke();
  context.fillStyle = '#ffffff';
  context.font = '700 26px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(config.label, 128, 42);

  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(labelCanvas), transparent: true, depthTest: false }),
  );
  label.position.y = 1.8;
  label.scale.set(3.4, 1.06, 1);
  group.add(label);
  group.userData.core = core;
  group.userData.ring = ring;
  return group;
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      material.map?.dispose();
      material.dispose();
    }
  });
}

class VirtualStick {
  constructor(element, onChange, preserveValueOnRelease = false) {
    this.element = element;
    this.base = element.querySelector('.touch-stick__base');
    this.knob = element.querySelector('.touch-stick__knob');
    this.onChange = onChange;
    this.preserveValueOnRelease = preserveValueOnRelease;
    this.pointerId = null;

    this.base.addEventListener('pointerdown', (event) => this.begin(event));
    this.base.addEventListener('pointermove', (event) => this.move(event));
    this.base.addEventListener('pointerup', (event) => this.end(event));
    this.base.addEventListener('pointercancel', (event) => this.end(event));
    this.base.addEventListener('lostpointercapture', (event) => this.end(event));
  }

  begin(event) {
    if (this.pointerId !== null) return;
    event.preventDefault();
    event.stopPropagation();
    this.pointerId = event.pointerId;
    this.base.setPointerCapture(event.pointerId);
    this.update(event);
  }

  move(event) {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    this.update(event);
  }

  update(event) {
    const bounds = this.base.getBoundingClientRect();
    const radius = bounds.width * 0.32;
    let x = event.clientX - (bounds.left + bounds.width / 2);
    let y = event.clientY - (bounds.top + bounds.height / 2);
    const distance = Math.hypot(x, y);
    if (distance > radius) {
      x *= radius / distance;
      y *= radius / distance;
    }

    const normalizedX = x / radius;
    const normalizedY = y / radius;
    const magnitude = Math.hypot(normalizedX, normalizedY);
    const deadZone = 0.14;
    const scale = magnitude <= deadZone ? 0 : (magnitude - deadZone) / (1 - deadZone) / magnitude;
    this.knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    this.onChange(normalizedX * scale, normalizedY * scale);
  }

  end(event) {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    this.pointerId = null;
    this.knob.style.transform = 'translate(-50%, -50%)';
    if (!this.preserveValueOnRelease) this.onChange(0, 0);
  }

  reset() {
    this.pointerId = null;
    this.knob.style.transform = 'translate(-50%, -50%)';
    if (!this.preserveValueOnRelease) this.onChange(0, 0);
  }
}

class EnemyVisual extends THREE.Group {
  static HEIGHT = 1.8;
  static RADIUS = 0.55;

  constructor(modelTemplate = null, animations = []) {
    super();
    this.state = 'walk';
    this.stateTime = 0;
    this.usesGeneratedModel = false;
    this.usesSkeletalAnimation = false;
    this.instanceMaterials = [];
    this.content = new THREE.Group();
    this.placeholder = new THREE.Group();
    this.content.add(this.placeholder);
    this.add(this.content);

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
    this.placeholder.add(this.body);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 9), skin);
    this.head.scale.set(1.12, 0.9, 0.95);
    this.head.position.set(0, 1.65, 0.02);
    this.head.castShadow = true;
    this.placeholder.add(this.head);

    const hornGeometry = new THREE.ConeGeometry(0.11, 0.42, 6);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(hornGeometry, dark);
      horn.position.set(side * 0.28, 1.98, 0);
      horn.rotation.z = side * -0.34;
      this.placeholder.add(horn);
    }

    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffd66b });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMaterial);
      eye.position.set(side * 0.14, 1.7, 0.39);
      this.placeholder.add(eye);
    }

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.58, 20),
      new THREE.MeshBasicMaterial({ color: 0x070812, transparent: true, opacity: 0.38 }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.015;
    this.add(this.shadow);

    if (modelTemplate) this.applyModel(modelTemplate, animations);
  }

  applyModel(modelTemplate, animations = []) {
    if (this.usesGeneratedModel) return;

    const model = cloneSkeleton(modelTemplate);
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
      const materials = sourceMaterials.map((material) => {
        const instanceMaterial = material.clone();
        if (instanceMaterial.emissive) {
          instanceMaterial.emissive.setHex(0x2a0d3f);
          instanceMaterial.emissiveIntensity = 0.85;
          instanceMaterial.userData.enemyBaseEmissive = instanceMaterial.emissive.clone();
          instanceMaterial.userData.enemyBaseEmissiveIntensity = instanceMaterial.emissiveIntensity;
        }
        this.instanceMaterials.push(instanceMaterial);
        return instanceMaterial;
      });
      child.material = Array.isArray(child.material) ? materials : materials[0];
    });

    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = EnemyVisual.HEIGHT / size.y;
    model.scale.multiplyScalar(scale);
    bounds.setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -bounds.min.y, -center.z);

    this.model = model;
    this.content.add(model);
    this.placeholder.visible = false;
    this.usesGeneratedModel = true;

    const walkClip = THREE.AnimationClip.findByName(animations, 'Walking');
    if (walkClip) {
      this.mixer = new THREE.AnimationMixer(model);
      this.walkAction = this.mixer.clipAction(walkClip);
      this.walkAction.play();
      this.usesSkeletalAnimation = true;
    }
  }

  setHitHighlight(active) {
    for (const material of this.instanceMaterials) {
      if (!material.emissive) continue;
      if (active) {
        material.emissive.setHex(0xff174f);
        material.emissiveIntensity = 1.35;
      } else {
        material.emissive.copy(material.userData.enemyBaseEmissive);
        material.emissiveIntensity = material.userData.enemyBaseEmissiveIntensity;
      }
    }
  }

  setState(state) {
    if (state === this.state) return;
    if (this.state === 'hit') this.setHitHighlight(false);
    this.state = state;
    this.stateTime = 0;
    this.content.position.set(0, 0, 0);
    this.content.rotation.set(0, 0, 0);
    this.body.rotation.x = 0;
    if (this.walkAction) this.walkAction.paused = state !== 'walk';
  }

  update(delta, elapsed) {
    this.stateTime += delta;
    this.mixer?.update(delta);

    if (this.state === 'walk') {
      if (!this.usesSkeletalAnimation) {
        this.content.position.y = Math.sin(elapsed * 10) * 0.045;
        this.head.rotation.z = Math.sin(elapsed * 7) * 0.045;
        this.content.rotation.z = Math.sin(elapsed * 10) * 0.025;
      }
    } else if (this.state === 'attack') {
      const strike = Math.sin(Math.min(1, this.stateTime / 0.48) * Math.PI);
      this.content.rotation.x = strike * 0.32;
      this.content.position.y = strike * 0.08;
    } else if (this.state === 'hit') {
      this.body.material.emissive.setHex(0xff355f);
      this.body.material.emissiveIntensity = 1.5;
      this.setHitHighlight(true);
      this.content.position.x = Math.sin(this.stateTime * 55) * 0.05;
      if (this.stateTime > 0.12) {
        this.body.material.emissive.setHex(0x1c0e3d);
        this.body.material.emissiveIntensity = 0.55;
        this.setHitHighlight(false);
        this.content.position.x = 0;
        this.setState('walk');
      }
    } else if (this.state === 'death') {
      this.rotation.z = Math.min(Math.PI / 2, this.stateTime * 5);
      this.scale.multiplyScalar(Math.max(0.94, 1 - delta * 2.3));
    }
  }

  dispose() {
    this.mixer?.stopAllAction();
    if (this.mixer && this.model) this.mixer.uncacheRoot(this.model);
    this.placeholder.traverse((child) => {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
      else child.material?.dispose();
    });
    this.instanceMaterials.forEach((material) => material.dispose());
  }
}

class PlayerVisual extends THREE.Group {
  static HEIGHT = 1.8;

  constructor() {
    super();
    this.usesGeneratedModel = false;
    this.usesSkeletalAnimation = false;
    this.content = new THREE.Group();
    this.placeholder = new THREE.Group();
    this.content.add(this.placeholder);
    this.add(this.content);

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
    this.placeholder.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), armor);
    head.position.y = 1.34;
    head.castShadow = true;
    this.placeholder.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.08), core);
    visor.position.set(0, 1.38, 0.3);
    this.placeholder.add(visor);

    const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.45, 6), armor);
    pointer.rotation.x = Math.PI / 2;
    pointer.position.set(0, 0.72, 0.61);
    this.placeholder.add(pointer);
  }

  applyModel(modelTemplate, animations = []) {
    if (this.usesGeneratedModel) return;

    const model = cloneSkeleton(modelTemplate);
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
      const materials = sourceMaterials.map((material) => material.clone());
      child.material = Array.isArray(child.material) ? materials : materials[0];
    });

    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = PlayerVisual.HEIGHT / size.y;
    model.scale.multiplyScalar(scale);
    bounds.setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -bounds.min.y, -center.z);

    this.model = model;
    this.content.add(model);
    this.placeholder.visible = false;
    this.usesGeneratedModel = true;

    const walkClip = THREE.AnimationClip.findByName(animations, 'Walking');
    if (walkClip) {
      this.mixer = new THREE.AnimationMixer(model);
      this.walkAction = this.mixer.clipAction(walkClip);
      this.walkAction.play();
      this.walkAction.paused = true;
      this.usesSkeletalAnimation = true;
    }
  }

  setMoving(moving) {
    if (this.walkAction) this.walkAction.paused = !moving;
  }

  update(delta, moving, elapsed) {
    this.setMoving(moving);
    this.mixer?.update(delta);
    if (!this.usesSkeletalAnimation) {
      this.content.position.y = moving ? Math.abs(Math.sin(elapsed * 11)) * 0.05 : 0;
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
    this.hordeValue = document.querySelector('#horde');
    this.scoreValue = document.querySelector('#score');
    this.crosshair = document.querySelector('.crosshair');
    this.hordeBanner = document.querySelector('#horde-banner');
    this.hordeBannerValue = this.hordeBanner.querySelector('strong');
    this.pickupNotice = document.querySelector('#pickup-notice');
    this.effectStatus = document.querySelector('#effect-status');
    this.touchControls = document.querySelector('#touch-controls');

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x718397);
    this.scene.fog = new THREE.FogExp2(0x718397, 0.008);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    this.camera.position.set(0, 29, 31);
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
    this.touchMovement = new THREE.Vector2();
    this.touchAimDirection = new THREE.Vector2(0, -1);
    this.usingTouchAim = false;
    this.touchEnabled = window.matchMedia('(hover: none) and (pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.aimPoint = new THREE.Vector3(0, 0, 0);
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.powerUps = [];
    this.elapsed = 0;
    this.currentHorde = 1;
    this.hordeAnnouncementTimer = 0;
    this.spawnTimer = 0;
    this.powerUpSpawnTimer = 0;
    this.attackTimer = 0;
    this.rapidFireTimer = 0;
    this.tripleShotTimer = 0;
    this.pickupNoticeTimer = 0;
    this.powerUpBag = [];
    this.crystalHealth = 100;
    this.score = 0;
    this.running = false;
    this.enemyModelTemplate = null;
    this.enemyAnimations = [];
    this.enemyAssetStatus = 'loading';
    this.enemyAssetError = null;
    this.enemyAssetUrl = ENEMY_ANIMATED_ASSET_URL;
    this.playerModelTemplate = null;
    this.playerAnimations = [];
    this.playerAssetStatus = 'loading';
    this.playerAssetError = null;

    this.buildWorld();
    this.installDiagnostics();
    this.loadEnemyAsset();
    this.loadPlayerAsset();
    this.setupTouchControls();
    this.bindEvents();
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  installDiagnostics() {
    window.__THREE_GAME_DIAGNOSTICS__ = {
      snapshot: () => ({
        gameState: this.running ? 'playing' : 'ready',
        enemyAsset: {
          url: this.enemyAssetUrl,
          status: this.enemyAssetStatus,
          error: this.enemyAssetError,
          generatedInstances: this.enemies.filter((enemy) => enemy.visual.usesGeneratedModel).length,
          animatedInstances: this.enemies.filter((enemy) => enemy.visual.usesSkeletalAnimation).length,
          fallbackInstances: this.enemies.filter((enemy) => !enemy.visual.usesGeneratedModel).length,
          clips: this.enemyAnimations.map((clip) => clip.name),
        },
        playerAsset: {
          url: PLAYER_ANIMATED_ASSET_URL,
          status: this.playerAssetStatus,
          error: this.playerAssetError,
          generated: this.player.usesGeneratedModel,
          animated: this.player.usesSkeletalAnimation,
          clips: this.playerAnimations.map((clip) => clip.name),
        },
        playerPosition: { x: this.player.position.x, z: this.player.position.z },
        input: {
          touchEnabled: this.touchEnabled,
          touchMovement: { x: this.touchMovement.x, y: this.touchMovement.y },
          touchAim: { x: this.touchAimDirection.x, y: this.touchAimDirection.y },
          usingTouchAim: this.usingTouchAim,
        },
        activeEnemies: this.enemies.length,
        activeProjectiles: this.projectiles.length,
        elapsed: this.elapsed,
        horde: this.currentHorde,
        spawnInterval: this.getSpawnInterval(),
        crystalHealth: this.crystalHealth,
        score: this.score,
        powerUps: this.powerUps.map((powerUp) => ({
          type: powerUp.type,
          life: powerUp.life,
          position: { x: powerUp.visual.position.x, z: powerUp.visual.position.z },
        })),
        effects: {
          rapidFire: this.rapidFireTimer,
          tripleShot: this.tripleShotTimer,
        },
        renderer: {
          calls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles,
          geometries: this.renderer.info.memory.geometries,
          textures: this.renderer.info.memory.textures,
        },
      }),
    };
  }

  loadEnemyAsset() {
    const loader = new GLTFLoader();
    const applyAsset = (gltf, status, url) => {
      this.enemyModelTemplate = gltf.scene;
      this.enemyAnimations = gltf.animations || [];
      this.enemyAssetStatus = status;
      this.enemyAssetError = null;
      this.enemyAssetUrl = url;
      for (const enemy of this.enemies) {
        enemy.visual.applyModel(this.enemyModelTemplate, this.enemyAnimations);
      }
    };

    const loadStaticFallback = (animatedError) => {
      loader.load(
        ENEMY_STATIC_ASSET_URL,
        (gltf) => {
          if (!gltf.scene) throw new Error('The static enemy GLB contained no scene.');
          applyAsset(gltf, 'loaded-static-fallback', ENEMY_STATIC_ASSET_URL);
          this.enemyAssetError = animatedError;
          console.warn(`Animated enemy unavailable; using the static GLB. ${animatedError}`);
        },
        undefined,
        (error) => {
          this.enemyAssetStatus = 'procedural-fallback';
          this.enemyAssetError = error?.message || animatedError || 'Enemy GLBs could not be loaded.';
          console.warn(`Enemy assets unavailable; using the procedural fallback. ${this.enemyAssetError}`);
        },
      );
    };

    loader.load(
      ENEMY_ANIMATED_ASSET_URL,
      (gltf) => {
        const walkClip = THREE.AnimationClip.findByName(gltf.animations, 'Walking');
        if (!gltf.scene || !walkClip) {
          loadStaticFallback('The animated GLB did not contain a scene and Walking clip.');
          return;
        }
        applyAsset(gltf, 'loaded-animated', ENEMY_ANIMATED_ASSET_URL);
      },
      undefined,
      (error) => loadStaticFallback(error?.message || 'The animated enemy GLB could not be loaded.'),
    );
  }

  loadPlayerAsset() {
    const loader = new GLTFLoader();
    loader.load(
      PLAYER_ANIMATED_ASSET_URL,
      (gltf) => {
        const walkClip = THREE.AnimationClip.findByName(gltf.animations, 'Walking');
        if (!gltf.scene || !walkClip) {
          this.playerAssetStatus = 'procedural-fallback';
          this.playerAssetError = 'The player GLB did not contain a scene and Walking clip.';
          console.warn(`Player asset unavailable; using the procedural fallback. ${this.playerAssetError}`);
          return;
        }
        this.playerModelTemplate = gltf.scene;
        this.playerAnimations = gltf.animations || [];
        this.player.applyModel(this.playerModelTemplate, this.playerAnimations);
        this.playerAssetStatus = 'loaded-animated';
        this.playerAssetError = null;
      },
      undefined,
      (error) => {
        this.playerAssetStatus = 'procedural-fallback';
        this.playerAssetError = error?.message || 'The animated player GLB could not be loaded.';
        console.warn(`Player asset unavailable; using the procedural fallback. ${this.playerAssetError}`);
      },
    );
  }

  buildWorld() {
    const hemi = new THREE.HemisphereLight(0xe3edff, 0x4c5565, 1.85);
    this.scene.add(hemi);

    const moon = new THREE.DirectionalLight(0xffe4cf, 3.1);
    moon.position.set(-8, 14, 7);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -32;
    moon.shadow.camera.right = 32;
    moon.shadow.camera.top = 32;
    moon.shadow.camera.bottom = -32;
    this.scene.add(moon);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA_RADIUS + 2, 64),
      new THREE.MeshStandardMaterial({ color: 0x4d5b6d, roughness: 0.93, metalness: 0.04 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const rings = new THREE.Group();
    for (const radius of [6, 12, 18, 24, ARENA_RADIUS + 1.2]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.025, radius + 0.025, 96),
        new THREE.MeshBasicMaterial({
          color: radius === ARENA_RADIUS + 1.2 ? 0xb0bac8 : 0x748198,
          transparent: true,
          opacity: 0.85,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.012;
      rings.add(ring);
    }
    this.scene.add(rings);

    this.addArenaProps();
    this.buildCrystal();
    this.buildPlayer();
    this.buildAimMarker();
  }

  addArenaProps() {
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x647184, roughness: 0.92 });
    for (let i = 0; i < 28; i += 1) {
      const angle = (i / 28) * Math.PI * 2 + (i % 2) * 0.08;
      const radius = ARENA_RADIUS + 1.4 + (i % 3) * 0.65;
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
    this.player = new PlayerVisual();
    this.player.position.set(0, 0, 4.2);
    this.scene.add(this.player);
  }

  buildAimMarker() {
    this.aimMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.34, 28),
      new THREE.MeshBasicMaterial({ color: 0x9feeff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    this.aimMarker.rotation.x = -Math.PI / 2;
    this.aimMarker.position.y = 0.035;
    this.aimMarker.visible = false;
    this.scene.add(this.aimMarker);
  }

  setupTouchControls() {
    document.documentElement.classList.toggle('touch-enabled', this.touchEnabled);
    this.moveStick = new VirtualStick(
      document.querySelector('#move-stick'),
      (x, y) => this.touchMovement.set(x, y),
    );
    this.aimStick = new VirtualStick(
      document.querySelector('#aim-stick'),
      (x, y) => {
        if (Math.hypot(x, y) <= 0.01) return;
        this.touchAimDirection.set(x, y).normalize();
        this.usingTouchAim = true;
      },
      true,
    );
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (event) => this.keys.add(event.code));
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.moveStick.reset();
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      this.usingTouchAim = false;
      this.updateAimFromPointer(event);
    });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.startButton.addEventListener('click', () => this.start());
  }

  updateAimFromPointer(event) {
    const bounds = this.canvas.getBoundingClientRect();
    this.crosshair.style.left = `${event.clientX}px`;
    this.crosshair.style.top = `${event.clientY}px`;
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.aimPlane, this.aimPoint)) return;

    const distance = Math.hypot(this.aimPoint.x, this.aimPoint.z);
    if (distance > ARENA_RADIUS) {
      this.aimPoint.x *= ARENA_RADIUS / distance;
      this.aimPoint.z *= ARENA_RADIUS / distance;
    }
    this.aimMarker.position.set(this.aimPoint.x, 0.035, this.aimPoint.z);
    this.aimMarker.visible = this.running;
  }

  start() {
    this.clearActors();
    this.keys.clear();
    this.moveStick.reset();
    this.aimStick.reset();
    this.touchMovement.set(0, 0);
    this.touchAimDirection.set(0, -1);
    this.usingTouchAim = false;
    this.elapsed = 0;
    this.currentHorde = 1;
    this.hordeAnnouncementTimer = 2.4;
    this.spawnTimer = 0.45;
    this.powerUpSpawnTimer = 7 + Math.random() * 4;
    this.attackTimer = 0;
    this.rapidFireTimer = 0;
    this.tripleShotTimer = 0;
    this.pickupNoticeTimer = 0;
    this.powerUpBag = shuffle(Object.keys(POWER_UP_TYPES));
    this.crystalHealth = 100;
    this.score = 0;
    this.scoreValue.textContent = '0';
    this.hordeValue.textContent = '1';
    this.hordeBannerValue.textContent = '1';
    this.hordeBanner.classList.add('visible');
    this.pickupNotice.classList.remove('visible');
    this.effectStatus.classList.remove('visible');
    this.player.position.set(0, 0, 4.2);
    this.player.setMoving(false);
    this.aimPoint.set(0, 0, 0);
    this.aimMarker.position.set(0, 0.035, 0);
    this.aimMarker.visible = true;
    this.running = true;
    this.overlay.classList.add('hidden');
    this.updateHud();
  }

  clearActors() {
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.visual);
      enemy.visual.dispose();
    }
    for (const projectile of this.projectiles) this.scene.remove(projectile.mesh);
    for (const particle of this.particles) this.scene.remove(particle.mesh);
    for (const powerUp of this.powerUps) {
      this.scene.remove(powerUp.visual);
      disposeObject(powerUp.visual);
    }
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.particles.length = 0;
    this.powerUps.length = 0;
  }

  spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const visual = new EnemyVisual(this.enemyModelTemplate, this.enemyAnimations);
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
      Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.touchMovement.x,
      0,
      Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) + this.touchMovement.y,
    );

    const moving = movement.lengthSq() > 0;
    if (moving) {
      const movementAmount = Math.min(1, movement.length());
      movement.normalize();
      this.player.position.addScaledVector(movement, PLAYER_SPEED * delta * movementAmount);
    }
    this.player.position.y = 0;
    this.player.update(delta, moving, this.elapsed);

    const distance = Math.hypot(this.player.position.x, this.player.position.z);
    if (distance > PLAYER_BOUNDARY) {
      this.player.position.x *= PLAYER_BOUNDARY / distance;
      this.player.position.z *= PLAYER_BOUNDARY / distance;
    }

    if (this.usingTouchAim) {
      this.aimPoint.set(
        this.player.position.x + this.touchAimDirection.x * TOUCH_AIM_DISTANCE,
        0,
        this.player.position.z + this.touchAimDirection.y * TOUCH_AIM_DISTANCE,
      );
      this.aimMarker.position.set(this.aimPoint.x, 0.035, this.aimPoint.z);
      this.aimMarker.visible = this.running;
    }

    const aimDirection = this.aimPoint.clone().sub(this.player.position);
    aimDirection.y = 0;
    if (aimDirection.lengthSq() > 0.01) this.player.rotation.y = Math.atan2(aimDirection.x, aimDirection.z);

    this.attackTimer -= delta;
    if (this.attackTimer <= 0) {
      this.fire();
      this.attackTimer = this.rapidFireTimer > 0 ? RAPID_FIRE_INTERVAL : FIRE_INTERVAL;
    }
  }

  fire() {
    const direction = this.aimPoint.clone().sub(this.player.position);
    direction.y = 0;
    if (direction.lengthSq() < 0.01) return;
    direction.normalize();

    const shotAngles = this.tripleShotTimer > 0 ? [-0.16, 0, 0.16] : [0];
    for (const angle of shotAngles) {
      const shotDirection = direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xb9f3ff }),
      );
      mesh.position.copy(this.player.position).addScaledVector(shotDirection, 0.7);
      mesh.position.y = 1.05;
      this.scene.add(mesh);
      this.projectiles.push({
        mesh,
        velocity: shotDirection.multiplyScalar(PROJECTILE_SPEED),
        life: PROJECTILE_LIFETIME,
      });
    }

    this.player.rotation.y = Math.atan2(direction.x, direction.z);
  }

  updateProjectiles(delta) {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      projectile.life -= delta;

      if (projectile.life <= 0) {
        this.scene.remove(projectile.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      const previousPosition = projectile.mesh.position.clone();
      projectile.mesh.position.addScaledVector(projectile.velocity, delta);
      const path = new THREE.Line3(previousPosition, projectile.mesh.position);
      let hit = null;
      for (const enemy of this.enemies) {
        if (enemy.dying) continue;
        const targetPosition = enemy.visual.position.clone();
        targetPosition.y = 1;
        const nearestPoint = path.closestPointToPoint(targetPosition, true, new THREE.Vector3());
        if (nearestPoint.distanceTo(targetPosition) < EnemyVisual.RADIUS + 0.16) {
          hit = enemy;
          break;
        }
      }

      if (hit) {
        this.hitEnemy(hit);
        this.scene.remove(projectile.mesh);
        this.projectiles.splice(i, 1);
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
          enemy.visual.dispose();
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
    if (this.crystalHealth <= 0) this.end();
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

  updateHorde(delta) {
    const nextHorde = Math.floor(this.elapsed / HORDE_DURATION) + 1;
    if (nextHorde !== this.currentHorde) {
      this.currentHorde = nextHorde;
      this.hordeValue.textContent = String(nextHorde);
      this.hordeBannerValue.textContent = String(nextHorde);
      this.hordeAnnouncementTimer = 2.4;
      this.hordeBanner.classList.add('visible');
    }

    this.hordeAnnouncementTimer = Math.max(0, this.hordeAnnouncementTimer - delta);
    if (this.hordeAnnouncementTimer <= 0) this.hordeBanner.classList.remove('visible');
  }

  getSpawnInterval() {
    const hordeFrequencyMultiplier = HORDE_SPAWN_FREQUENCY_GROWTH ** (this.currentHorde - 1);
    return Math.max(MIN_ENEMY_SPAWN_INTERVAL, BASE_ENEMY_SPAWN_INTERVAL / hordeFrequencyMultiplier);
  }

  getNextPowerUpType() {
    if (this.powerUpBag.length === 0) this.powerUpBag = shuffle(Object.keys(POWER_UP_TYPES));
    return this.powerUpBag.pop();
  }

  spawnPowerUp() {
    if (this.powerUps.length >= MAX_POWER_UPS) return;

    const type = this.getNextPowerUpType();
    const visual = createPowerUpVisual(type);
    let position = new THREE.Vector3();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 7 + Math.random() * (PLAYER_BOUNDARY - 9);
      position = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      if (position.distanceTo(this.player.position) > 4) break;
    }
    visual.position.copy(position);
    this.scene.add(visual);
    this.powerUps.push({ type, visual, life: POWER_UP_LIFETIME, age: 0 });
  }

  collectPowerUp(powerUp) {
    const config = POWER_UP_TYPES[powerUp.type];
    if (powerUp.type === 'repair') this.crystalHealth = Math.min(100, this.crystalHealth + 25);
    if (powerUp.type === 'rapid') this.rapidFireTimer = POWER_UP_DURATION;
    if (powerUp.type === 'triple') this.tripleShotTimer = POWER_UP_DURATION;

    this.pickupNotice.textContent = config.label;
    this.pickupNotice.style.setProperty('--pickup-color', `#${config.color.toString(16).padStart(6, '0')}`);
    this.pickupNotice.classList.add('visible');
    this.pickupNoticeTimer = 1.8;
    this.burst(powerUp.visual.position, config.color, 10);
    this.updateHud();
  }

  removePowerUp(index, collected = false) {
    const powerUp = this.powerUps[index];
    if (collected) this.collectPowerUp(powerUp);
    this.scene.remove(powerUp.visual);
    disposeObject(powerUp.visual);
    this.powerUps.splice(index, 1);
  }

  updatePowerUps(delta, ambientTime) {
    this.powerUpSpawnTimer -= delta;
    if (this.powerUpSpawnTimer <= 0) {
      this.spawnPowerUp();
      this.powerUpSpawnTimer = 9 + Math.random() * 5;
    }

    for (let i = this.powerUps.length - 1; i >= 0; i -= 1) {
      const powerUp = this.powerUps[i];
      powerUp.life -= delta;
      powerUp.age += delta;
      powerUp.visual.rotation.y += delta * 1.4;
      powerUp.visual.userData.core.position.y = 0.88 + Math.sin(ambientTime * 4 + i) * 0.12;
      powerUp.visual.userData.ring.rotation.z += delta * 0.9;

      const dx = powerUp.visual.position.x - this.player.position.x;
      const dz = powerUp.visual.position.z - this.player.position.z;
      if (Math.hypot(dx, dz) < 1.2) {
        this.removePowerUp(i, true);
      } else if (powerUp.life <= 0) {
        this.removePowerUp(i);
      }
    }
  }

  updateEffects(delta) {
    this.rapidFireTimer = Math.max(0, this.rapidFireTimer - delta);
    this.tripleShotTimer = Math.max(0, this.tripleShotTimer - delta);
    this.pickupNoticeTimer = Math.max(0, this.pickupNoticeTimer - delta);
    if (this.pickupNoticeTimer <= 0) this.pickupNotice.classList.remove('visible');

    const effects = [];
    if (this.rapidFireTimer > 0) effects.push(`RAPID FIRE ${this.rapidFireTimer.toFixed(1)}s`);
    if (this.tripleShotTimer > 0) effects.push(`TRIPLE SHOT ${this.tripleShotTimer.toFixed(1)}s`);
    this.effectStatus.textContent = effects.join('  •  ');
    this.effectStatus.classList.toggle('visible', effects.length > 0);
  }

  updateHud() {
    this.healthBar.style.width = `${this.crystalHealth}%`;
    this.healthValue.textContent = String(Math.ceil(this.crystalHealth));
    this.timerValue.textContent = formatTime(this.elapsed);
    this.hordeValue.textContent = String(this.currentHorde);
  }

  end() {
    this.running = false;
    this.keys.clear();
    this.moveStick.reset();
    this.aimStick.reset();
    this.touchMovement.set(0, 0);
    this.aimMarker.visible = false;
    this.hordeBanner.classList.remove('visible');
    this.pickupNotice.classList.remove('visible');
    this.effectStatus.classList.remove('visible');
    const kicker = this.overlay.querySelector('.kicker');
    const title = this.overlay.querySelector('h1');
    const copy = this.overlay.querySelector('p');
    kicker.textContent = 'THE CRYSTAL HAS FALLEN';
    title.innerHTML = 'Try<br /><em>Again</em>';
    copy.textContent = `Survived ${formatTime(this.elapsed)} • Reached Horde ${this.currentHorde} • Defeated ${this.score} creatures.`;
    this.startButton.textContent = 'PLAY AGAIN';
    this.overlay.classList.remove('hidden');
  }

  frame() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const ambientTime = performance.now() * 0.001;

    this.crystalMesh.rotation.y += delta * 0.75;
    this.crystalMesh.position.y = 1.65 + Math.sin(ambientTime * 2) * 0.08;
    if (this.aimMarker.visible) {
      const pulse = 1 + Math.sin(ambientTime * 7) * 0.12;
      this.aimMarker.scale.setScalar(pulse);
    }

    if (this.running) {
      this.elapsed += delta;
      this.updateHorde(delta);
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.spawnTimer = this.getSpawnInterval();
      }

      this.updatePlayer(delta);
      this.updateEnemies(delta);
      this.updateProjectiles(delta);
      this.updatePowerUps(delta, ambientTime);
      this.updateEffects(delta);
      this.updateParticles(delta);
      this.updateHud();
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
