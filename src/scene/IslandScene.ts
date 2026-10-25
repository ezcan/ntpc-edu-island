import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/addons/renderers/CSS2DRenderer.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import gsap from "gsap";
import { bindPicking } from "./picking";
import {
  assetPath,
  selectExhibitors,
  activeServices,
  type Dataset,
  type Filter,
  type ZoneId,
} from "../lib/data";

const C = {
  cream: "#fcf4df",
  wood: "#b78d64",
  glass: "#4d8896",
  ink: "#335e5e",
  blue: "#86c6d8",
  coral: "#df9271",
  purple: "#b9abd6",
  green: "#9eb78d",
};
const sphere = new T.SphereGeometry(1, 12, 8);
const unitBox = new T.BoxGeometry(1, 1, 1);
const tmp = new T.Object3D();
export class IslandScene {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(38, 1, 0.1, 180);
  renderer: T.WebGLRenderer;
  labels = new CSS2DRenderer();
  controls: OrbitControls;
  island = new T.Group();
  groups = new Map<ZoneId, T.Group>();
  labelElements = new Map<ZoneId, HTMLButtonElement>();
  private animations: ((t: number, dt: number) => void)[] = [];
  private materials = new Map<string, T.MeshStandardMaterial>();
  private frame = 0;
  private disposed = false;
  private observer: ResizeObserver;
  private cleanupPicking: () => void;
  private selected: ZoneId | null = null;
  private hovered: ZoneId | null = null;
  private start = performance.now();
  private last = 0;
  private reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  private textures: T.Texture[] = [];
  private pending = 0;
  private screenMaterials: T.MeshStandardMaterial[] = [];
  modelFailures: string[] = [];
  loadedModels = 0;
  fps = 0;
  constructor(
    private container: HTMLElement,
    private data: Dataset,
    onSelect: (zone: ZoneId) => void,
    private onIssue: (message: string) => void,
  ) {
    this.renderer = new T.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, window.innerWidth < 768 ? 1.25 : 1.75),
    );
    this.renderer.shadowMap.enabled = window.innerWidth >= 768;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "可旋轉的新北教育科技浮島，亦可使用展區導覽按鈕操作",
    );
    this.renderer.domElement.tabIndex = 0;
    container.append(this.renderer.domElement);
    this.labels.domElement.className = "scene-label-layer";
    container.append(this.labels.domElement);
    this.camera.position.set(18, 19, 24);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.2, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 52;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = Math.PI / 2.45;
    this.controls.maxTargetRadius = 8;
    this.controls.cursor.set(0, 0, 0);
    this.controls.panSpeed = 0.65;
    this.controls.screenSpacePanning = false;
    this.controls.addEventListener("start", () => {
      gsap.killTweensOf(this.camera.position);
      gsap.killTweensOf(this.controls.target);
    });
    this.scene.fog = new T.Fog("#eaf1ea", 52, 105);
    this.scene.add(this.island);
    this.scene.add(new T.HemisphereLight("#ffffff", "#b7a68d", 2.2));
    const sun = new T.DirectionalLight("#fff1dc", 3.4);
    sun.position.set(-14, 26, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -16;
    sun.shadow.normalBias = 0.04;
    sun.shadow.bias = -0.00015;
    this.scene.add(sun);
    const fill = new T.DirectionalLight("#c0e1ed", 1.5);
    fill.position.set(12, 8, -10);
    this.scene.add(fill);
    this.ground();
    this.landscape();
    this.buildZones(onSelect);
    this.equipment();
    this.clouds();
    this.batchStatic(this.island);
    void this.loadModels();
    this.cleanupPicking = bindPicking(
      this.renderer.domElement,
      this.camera,
      [...this.groups.values()],
      (id) => onSelect(id as ZoneId),
      (id) => {
        this.hovered = id as ZoneId | null;
        this.highlight();
      },
    );
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.renderer.domElement.addEventListener("keydown", this.onKey);
    this.renderer.domElement.addEventListener(
      "webglcontextlost",
      this.onContextLost,
    );
    this.tick();
  }
  private mat(
    color: string,
    extra: Partial<T.MeshStandardMaterialParameters> = {},
  ) {
    const key = color + JSON.stringify(extra);
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new T.MeshStandardMaterial({
          color,
          roughness: 0.78,
          metalness: 0,
          ...extra,
        }),
      );
    return this.materials.get(key)!;
  }
  private mesh(
    geo: T.BufferGeometry,
    color: string,
    parent: T.Object3D,
    pos: [number, number, number] = [0, 0, 0],
    extra: Partial<T.MeshStandardMaterialParameters> = {},
  ) {
    const m = new T.Mesh(geo, this.mat(color, extra));
    m.position.set(...pos);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  private box(
    parent: T.Object3D,
    size: [number, number, number],
    pos: [number, number, number],
    color: string,
    r = 0.07,
  ) {
    return this.mesh(
      r > 0
        ? new RoundedBoxGeometry(...size, 2, r)
        : new T.BoxGeometry(...size),
      color,
      parent,
      pos,
    );
  }
  private ball(
    parent: T.Object3D,
    pos: [number, number, number],
    scale: [number, number, number],
    color: string,
  ) {
    const m = this.mesh(sphere, color, parent, pos);
    m.scale.set(...scale);
    return m;
  }
  private cylinder(
    parent: T.Object3D,
    top: number,
    bottom: number,
    h: number,
    pos: [number, number, number],
    color: string,
    n = 32,
  ) {
    return this.mesh(
      new T.CylinderGeometry(top, bottom, h, n),
      color,
      parent,
      pos,
    );
  }
  private ring(
    parent: T.Object3D,
    radius: number,
    tube: number,
    pos: [number, number, number],
    color: string,
  ) {
    const m = this.mesh(
      new T.TorusGeometry(radius, tube, 8, 48),
      color,
      parent,
      pos,
    );
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  private ground() {
    const { radius: r, depth, grassColor, earthColor } = this.data.scene.island;
    const body = this.cylinder(
      this.island,
      r,
      r * 0.8,
      depth,
      [0, -depth / 2 - 0.15, 0],
      earthColor,
      9,
    );
    body.rotation.y = 0.17;
    body.scale.z = 0.89;
    const grass = this.cylinder(
      this.island,
      r + 0.06,
      r + 0.08,
      0.38,
      [0, -0.12, 0],
      grassColor,
      9,
    );
    grass.rotation.y = 0.17;
    grass.scale.z = 0.89;
    const seam = this.cylinder(
      this.island,
      r * 0.98,
      r * 0.98,
      0.17,
      [0, -0.42, 0],
      "#9fb687",
      9,
    );
    seam.rotation.y = 0.17;
    seam.scale.z = 0.89;
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI * 2) / 9;
      const rock = this.mesh(
        new T.DodecahedronGeometry(1.8, 0),
        i % 2 ? "#d4b893" : "#d9c3a5",
        this.island,
        [Math.cos(a) * 6.1, -2.3, Math.sin(a) * 5.2],
      );
      rock.scale.set(1.5, 0.8 + (i % 3) * 0.2, 1.2);
      rock.rotation.set(i, 0, i * 0.6);
    }
    const tip = this.mesh(
      new T.ConeGeometry(5.5, 3.1, 7),
      "#ccb594",
      this.island,
      [0, -3, 0],
    );
    tip.rotation.x = Math.PI;
    tip.scale.z = 0.8;
    // Continuous paths connect the four pavilions, keeping the island a single place.
    this.box(this.island, [14, 0.08, 1.05], [0, 0.12, 0.1], C.cream, 0.04);
    this.box(this.island, [1.2, 0.08, 12.6], [0, 0.13, 0], C.cream, 0.04);
    this.cylinder(this.island, 2, 2, 0.1, [0, 0.15, 0], C.cream, 48);
    this.ring(this.island, 1.58, 0.035, [0, 0.22, 0], "#c3b99d");
    for (let i = 0; i < 6; i++)
      this.box(
        this.island,
        [0.35, 0.04, 0.9],
        [-1.4 + i * 0.55, 0.21, 6.4],
        "#f9f5e9",
        0.02,
      );
    // Landmark: four intertwined learning rings; all procedural artwork is original.
    const sculpture = new T.Group();
    sculpture.userData.animated = true;
    sculpture.position.set(0, 1.2, 0);
    this.island.add(sculpture);
    [C.blue, C.coral, C.purple, C.green].forEach((color, i) => {
      const ring = this.mesh(
        new T.TorusGeometry(0.67, 0.12, 10, 40),
        color,
        sculpture,
      );
      ring.rotation.set(0.4, (Math.PI * i) / 4, 0.3);
    });
    this.cylinder(this.island, 0.6, 0.8, 0.5, [0, 0.42, 0], "#e4dcc7");
    this.animations.push(
      (t) => (sculpture.rotation.y = this.reduced ? 0 : t * 0.13),
    );
    // Ground shadow floats beneath the island, without a visible floor plane.
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 64);
    gradient.addColorStop(0, "rgba(42,76,59,.18)");
    gradient.addColorStop(1, "rgba(42,76,59,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new T.CanvasTexture(canvas);
    this.textures.push(texture);
    const shadow = new T.Mesh(
      new T.PlaneGeometry(31, 25),
      new T.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -6.6;
    this.scene.add(shadow);
  }
  private landscape() {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r = 7.9 + Math.sin(i * 7) * 0.35;
      if (Math.abs(Math.sin(a)) < 0.1 || Math.abs(Math.cos(a)) < 0.08) continue;
      positions.push([Math.cos(a) * r, 0, Math.sin(a) * r * 0.84]);
    }
    const trunks = new T.InstancedMesh(
      new T.CylinderGeometry(0.08, 0.13, 0.8, 7),
      this.mat("#b09269"),
      positions.length,
    );
    const crowns = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.66, 1),
      this.mat("#7caa78"),
      positions.length,
    );
    const crowns2 = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.5, 1),
      this.mat("#98ba83"),
      positions.length,
    );
    positions.forEach((p, i) => {
      tmp.position.set(p[0], 0.4, p[2]);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      trunks.setMatrixAt(i, tmp.matrix);
      tmp.position.y = 1.12;
      tmp.scale.set(0.8, 1.25 + (i % 3) * 0.2, 0.8);
      tmp.updateMatrix();
      crowns.setMatrixAt(i, tmp.matrix);
      tmp.position.set(p[0] + 0.2, 0.94, p[2] + 0.2);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      crowns2.setMatrixAt(i, tmp.matrix);
    });
    [trunks, crowns, crowns2].forEach((m) => {
      m.castShadow = true;
      m.receiveShadow = true;
      this.island.add(m);
    });
    this.animations.push((t) => {
      if (!this.reduced) {
        crowns.rotation.z = Math.sin(t * 0.8) * 0.003;
        crowns2.rotation.z = Math.sin(t * 0.8 + 0.7) * 0.002;
      }
    });
    // Instanced garden shrubs and flowers: hundreds of repeated elements, six draw calls.
    ["#e8c88b", "#f7ecbd", "#b39bc9"].forEach((color, k) => {
      const flowers = new T.InstancedMesh(
        new T.IcosahedronGeometry(0.065, 0),
        this.mat(color),
        28,
      );
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const r = 6.5 + Math.sin(i * 12.4 + k) * 0.8;
        tmp.position.set(Math.cos(a) * r, 0.18, Math.sin(a) * r * 0.86);
        tmp.scale.set(1, 1.4, 1);
        tmp.updateMatrix();
        flowers.setMatrixAt(i, tmp.matrix);
      }
      this.island.add(flowers);
    });
    const lamps = new T.InstancedMesh(
      new T.CylinderGeometry(0.025, 0.04, 0.8, 6),
      this.mat("#577269"),
      12,
    );
    const lights = new T.InstancedMesh(
      sphere,
      this.mat("#fff2c3", { emissive: "#ffe9a8", emissiveIntensity: 0.2 }),
      12,
    );
    for (let i = 0; i < 12; i++) {
      const x = ((i % 6) - 2.5) * 2.1,
        z = i < 6 ? 0.85 : -0.85;
      tmp.position.set(x, 0.5, z);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      lamps.setMatrixAt(i, tmp.matrix);
      tmp.position.y = 0.95;
      tmp.scale.setScalar(0.12);
      tmp.updateMatrix();
      lights.setMatrixAt(i, tmp.matrix);
    }
    this.island.add(lamps, lights);
    // Small neutral visitors; not official 小通 characters.
    for (let i = 0; i < 10; i++) {
      const g = new T.Group();
      g.userData.animated = true;
      this.island.add(g);
      this.ball(g, [0, 0.54, 0], [0.13, 0.14, 0.13], "#eed5ba");
      this.cylinder(
        g,
        0.11,
        0.14,
        0.29,
        [0, 0.3, 0],
        [C.blue, C.coral, C.purple, C.green][i % 4],
        8,
      );
      this.box(g, [0.08, 0.18, 0.08], [-0.06, 0.08, 0], C.ink, 0.02);
      this.box(g, [0.08, 0.18, 0.08], [0.06, 0.08, 0], C.ink, 0.02);
      const offset = i * 1.27;
      this.animations.push((t) => {
        const a = offset + (this.reduced ? 0 : t * 0.025);
        g.position.set(Math.sin(a) * 1.2, 0.12, Math.cos(a) * 5.6);
        g.rotation.y = a + Math.PI / 2;
      });
    }
  }
  private buildZones(onSelect: (id: ZoneId) => void) {
    for (const zone of this.data.zones) {
      const g = new T.Group();
      g.position.set(...this.data.scene.zones[zone.id].position);
      g.rotation.y = this.data.scene.zones[zone.id].rotation;
      g.userData.zoneId = zone.id;
      this.island.add(g);
      this.groups.set(zone.id, g);
      this.box(g, [5.4, 0.15, 4.8], [0, 0.16, 0], zone.lightColor, 0.25);
      const halo = this.ring(g, 2.7, 0.045, [0, 0.25, 0], zone.color);
      halo.scale.z = 0.86;
      halo.name = "halo";
      if (zone.id === "future") this.future(g);
      if (zone.id === "maker") this.maker(g);
      if (zone.id === "research") this.research(g);
      if (zone.id === "service") this.service(g);
      this.batchStatic(g);
      const button = document.createElement("button");
      button.className = "zone-label";
      button.style.setProperty("--zone", zone.color);
      button.setAttribute("aria-label", `探索${zone.name}`);
      button.dataset.zone = zone.id;
      const title = document.createElement("span");
      title.className = "label-title";
      title.textContent = zone.name;
      const names = document.createElement("span");
      names.className = "label-names";
      button.append(title, names);
      button.addEventListener("click", () => onSelect(zone.id));
      this.labelElements.set(zone.id, button);
      const label = new CSS2DObject(button);
      label.position.set(0, 3.9, 0);
      g.add(label);
      // Generous invisible hit volume makes the entire pavilion selectable by touch.
      const hit = new T.Mesh(
        new T.BoxGeometry(5.2, 3.8, 4.6),
        new T.MeshBasicMaterial({ visible: false }),
      );
      hit.position.y = 1.9;
      g.add(hit);
      const slot = this.data.scene.mascotSlots.find(
        (s) => s.zoneId === zone.id,
      )!;
      if (!slot.modelUrl) {
        const neutral = new T.Group();
        neutral.userData.animated = true;
        neutral.position.set(...slot.position);
        this.ball(neutral, [0, 0.64, 0], [0.24, 0.24, 0.24], "#f0ede1");
        this.cylinder(neutral, 0.19, 0.24, 0.44, [0, 0.25, 0], "#e5e4da", 12);
        this.box(neutral, [0.18, 0.07, 0.05], [0, 0.65, 0.23], "#8d9b90", 0.02);
        const arm = this.box(
          neutral,
          [0.12, 0.32, 0.12],
          [0.25, 0.44, 0],
          "#e5e4da",
          0.04,
        );
        arm.geometry.translate(0, 0.1, 0);
        g.add(neutral);
        this.animations.push((t) => {
          arm.rotation.z = 0.5 + Math.sin(t * 1.6) * 0.28;
          neutral.rotation.y = Math.sin(t * 0.7) * 0.25;
          neutral.position.y =
            slot.position[1] + (this.reduced ? 0 : Math.sin(t * 1.4) * 0.035);
        });
      }
    }
  }
  private future(g: T.Group) {
    this.box(g, [3.5, 1.6, 2.55], [-0.25, 1.1, -0.35], C.cream, 0.18);
    this.box(g, [3.75, 0.24, 2.8], [-0.25, 2.0, -0.35], C.blue, 0.12);
    this.box(g, [2.35, 0.95, 1.8], [-0.65, 2.6, -0.65], "#e3f1ed", 0.2);
    this.box(g, [2.6, 0.15, 2], [-0.65, 3.12, -0.65], "#72b5ca", 0.1);
    this.box(g, [3.12, 0.87, 0.05], [-0.25, 1.18, 0.96], C.glass, 0.02);
    for (let i = 0; i < 5; i++)
      this.box(g, [0.055, 0.9, 0.12], [-1.5 + i * 0.62, 1.2, 1], C.cream, 0.01);
    this.box(g, [1.9, 0.55, 0.06], [-0.65, 2.63, 0.28], "#6dabbc", 0.02);
    for (let i = 0; i < 3; i++)
      this.box(
        g,
        [0.055, 0.56, 0.1],
        [-1.2 + i * 0.6, 2.63, 0.31],
        C.cream,
        0.01,
      );
    // Rooftop AI beacon and a tiny satellite dish.
    const dish = this.mesh(
      new T.SphereGeometry(0.38, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      "#e3eee8",
      g,
      [0.1, 3.31, -0.65],
    );
    dish.rotation.x = -0.4;
    this.cylinder(g, 0.035, 0.05, 0.55, [0.1, 3.26, -0.65], C.ink, 8);
    this.box(g, [1.1, 0.65, 0.08], [1.18, 1.28, 1.05], C.ink, 0.06);
    this.screen(g, [1.18, 1.3, 1.1], 0.9, 0.45, "#b4e3e7");
    const pond = this.cylinder(
      g,
      1.1,
      1.05,
      0.08,
      [1.15, 0.28, 1.35],
      "#8dc4ce",
      24,
    );
    pond.scale.z = 0.6;
    for (let i = 0; i < 3; i++)
      this.ring(
        g,
        0.3 + i * 0.2,
        0.012,
        [1.15, 0.33 + i * 0.001, 1.35],
        "#d9eff0",
      ).scale.z = 0.6;
    // Robot is an exhibit object, not a 小通 redesign.
    this.box(g, [0.45, 0.4, 0.32], [-1.7, 0.9, 1.65], "#e4eee6", 0.12);
    this.box(g, [0.36, 0.17, 0.04], [-1.7, 0.95, 1.82], C.ink, 0.03);
    this.box(g, [0.32, 0.35, 0.3], [-1.7, 0.53, 1.65], C.blue, 0.08);
    this.ball(g, [-1.78, 0.96, 1.86], [0.04, 0.04, 0.02], "#b3e8ed");
    this.ball(g, [-1.61, 0.96, 1.86], [0.04, 0.04, 0.02], "#b3e8ed");
    const particles = new T.InstancedMesh(
      new T.OctahedronGeometry(0.055),
      this.mat("#d8f7ff", { emissive: "#a4e4f2", emissiveIntensity: 0.5 }),
      24,
    );
    g.add(particles);
    this.animations.push((t) => {
      for (let i = 0; i < 24; i++) {
        const a = i * 2.4 + t * 0.25;
        tmp.position.set(
          Math.sin(a) * 2.2,
          0.6 + (((i / 24) * 2.9 + t * 0.16) % 2.9),
          Math.cos(a) * 1.8,
        );
        tmp.scale.setScalar(1);
        tmp.updateMatrix();
        particles.setMatrixAt(i, tmp.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;
    });
  }
  private maker(g: T.Group) {
    this.box(g, [3.8, 1.6, 2.4], [0, 1.1, -0.45], "#f4d5aa", 0.09);
    // Three sawtooth roof bays give the workshop its own silhouette.
    for (let i = 0; i < 3; i++) {
      const roof = this.mesh(
        new T.CylinderGeometry(0.9, 0.9, 2.65, 3),
        i % 2 ? "#d98b67" : "#e6a07d",
        g,
        [-1.24 + i * 1.24, 2.07, -0.45],
      );
      roof.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      roof.scale.x = 0.86;
    }
    this.box(g, [3.25, 0.65, 0.08], [0, 1.3, 0.78], C.ink, 0.03);
    for (let i = 0; i < 5; i++)
      this.box(
        g,
        [0.08, 0.67, 0.15],
        [-1.25 + i * 0.62, 1.3, 0.81],
        "#f5d5a6",
        0.01,
      );
    this.box(g, [0.45, 0.6, 0.6], [1.5, 2.6, -1.05], "#be7354", 0.07);
    this.box(g, [0.65, 0.12, 0.8], [1.5, 2.95, -1.05], "#f4d3aa", 0.04);
    for (let i = 0; i < 2; i++) {
      const table = new T.Group();
      table.position.set(-0.8 + i * 1.6, 0, 1.5);
      g.add(table);
      this.box(table, [1.2, 0.12, 0.65], [0, 0.8, 0], "#e8b886", 0.04);
      [-0.45, 0.45].forEach((x) =>
        this.box(table, [0.1, 0.65, 0.5], [x, 0.45, 0], C.ink, 0.02),
      );
      this.box(
        table,
        [0.32, 0.28, 0.3],
        [0, 1.02, 0],
        i ? C.blue : C.coral,
        0.03,
      );
    }
    const gear = new T.Group();
    gear.userData.animated = true;
    gear.position.set(-1.95, 1.55, 0.95);
    g.add(gear);
    const center = this.mesh(
      new T.TorusGeometry(0.48, 0.16, 8, 20),
      "#e7b75f",
      gear,
    );
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      const tooth = this.box(
        gear,
        [0.19, 0.27, 0.24],
        [Math.sin(a) * 0.58, Math.cos(a) * 0.58, 0],
        "#e7b75f",
        0.02,
      );
      tooth.rotation.z = -a;
    }
    this.animations.push(
      (t) => (gear.rotation.z = this.reduced ? 0 : t * 0.23),
    );
    center.castShadow = true;
    this.box(g, [0.6, 0.75, 0.55], [2, 0.67, -0.8], C.coral, 0.05);
    for (let i = 0; i < 3; i++)
      this.box(
        g,
        [0.5, 0.025, 0.06],
        [2, 0.49 + i * 0.22, -0.51],
        C.cream,
        0.01,
      );
  }
  private research(g: T.Group) {
    this.cylinder(g, 1.65, 1.85, 0.22, [0, 0.35, -0.15], "#d9d1e7", 48);
    this.cylinder(g, 1.4, 1.4, 1.6, [0, 1.2, -0.25], C.cream, 32);
    const dome = this.mesh(
      new T.SphereGeometry(1.48, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      C.purple,
      g,
      [0, 1.98, -0.25],
    );
    dome.scale.y = 0.75;
    this.ring(g, 1.49, 0.08, [0, 2.01, -0.25], "#d7cbe5");
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI) / 4;
      const window = this.box(
        g,
        [0.42, 0.75, 0.08],
        [Math.cos(a) * 1.38, 1.2, Math.sin(a) * 1.38 - 0.25],
        C.glass,
        0.09,
      );
      window.rotation.y = -a + Math.PI / 2;
    }
    const telescope = new T.Group();
    telescope.position.set(0.4, 2.65, -0.25);
    telescope.rotation.z = -0.65;
    g.add(telescope);
    this.cylinder(telescope, 0.18, 0.24, 1, [0, 0.2, 0], C.cream, 16);
    this.cylinder(telescope, 0.22, 0.22, 0.12, [0, 0.74, 0], C.ink, 16);
    this.cylinder(g, 0.85, 0.85, 0.12, [0.6, 0.8, 1.6], "#c0d4bf", 24);
    this.cylinder(g, 0.07, 0.16, 0.6, [0.6, 0.5, 1.6], C.wood, 8);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      this.cylinder(
        g,
        0.22,
        0.2,
        0.4,
        [0.6 + Math.cos(a) * 1.05, 0.5, 1.6 + Math.sin(a) * 0.8],
        C.purple,
        10,
      );
    }
    const turbine = new T.Group();
    turbine.userData.animated = true;
    turbine.position.set(-1.95, 2.8, -1);
    g.add(turbine);
    this.cylinder(g, 0.05, 0.1, 2.5, [-1.95, 1.5, -1], C.cream, 8);
    for (let i = 0; i < 3; i++) {
      const blade = this.box(
        turbine,
        [0.12, 1.15, 0.05],
        [0, 0, 0],
        "#c7d7cd",
        0.04,
      );
      blade.geometry.translate(0, 0.53, 0);
      blade.rotation.z = (i * Math.PI * 2) / 3;
    }
    this.ball(turbine, [0, 0, 0.06], [0.14, 0.14, 0.14], C.purple);
    this.animations.push(
      (t) => (turbine.rotation.z = this.reduced ? 0 : t * 0.45),
    );
    this.box(g, [0.9, 0.65, 0.08], [-1.6, 1.05, 1.1], C.wood, 0.04);
    this.screen(g, [-1.6, 1.05, 1.16], 0.78, 0.52, "#c6c4e6");
  }
  private service(g: T.Group) {
    this.box(g, [3.75, 1.55, 2.2], [0, 1.1, -0.35], C.cream, 0.18);
    this.box(g, [4.05, 0.25, 2.5], [0, 1.95, -0.35], C.green, 0.12);
    this.box(g, [1.3, 0.4, 1.6], [0, 2.24, -0.45], "#c4d6ad", 0.12);
    this.box(g, [1.55, 0.15, 1.75], [0, 2.52, -0.45], C.green, 0.06);
    for (let i = 0; i < 3; i++) {
      this.box(
        g,
        [0.85, 1.05, 0.06],
        [-1.2 + i * 1.2, 1.05, 0.79],
        C.glass,
        0.2,
      );
      this.box(
        g,
        [0.1, 1.1, 0.15],
        [-1.8 + i * 1.2, 1.05, 0.85],
        C.cream,
        0.03,
      );
    }
    this.box(g, [3.5, 0.15, 1.25], [0, 1.7, 1.2], "#adc390", 0.08);
    [-1.5, 1.5].forEach((x) =>
      this.cylinder(g, 0.055, 0.055, 1.45, [x, 0.95, 1.65], C.wood, 8),
    );
    this.box(g, [1.4, 0.3, 0.08], [0, 2.2, 0.39], "#4e755f", 0.04);
    this.box(g, [1.6, 0.6, 0.7], [-0.4, 0.6, 1.55], "#d8c2a0", 0.07);
    this.box(g, [1.75, 0.1, 0.8], [-0.4, 0.95, 1.55], C.cream, 0.04);
    const symbol = this.mesh(
      new T.TorusGeometry(0.24, 0.05, 8, 24),
      "#f6f0d6",
      g,
      [0, 2.22, 0.45],
    );
    symbol.rotation.z = Math.PI / 3;
  }
  private screen(
    parent: T.Object3D,
    pos: [number, number, number],
    w: number,
    h: number,
    color: string,
  ) {
    const mat = new T.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.12,
      roughness: 0.6,
    });
    this.screenMaterials.push(mat);
    const m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
    m.position.set(...pos);
    parent.add(m);
    for (let i = 0; i < 3; i++)
      this.box(
        parent,
        [w * (0.3 + i * 0.14), 0.035, 0.012],
        [pos[0] - w * 0.1, pos[1] + h * 0.22 - i * h * 0.2, pos[2] + 0.01],
        "#e8f7ed",
        0.005,
      );
  }
  private equipment() {
    // North and east presentation walls; south and west remain open entrances.
    const north = this.box(
      this.island,
      [9.5, 0.7, 0.16],
      [-0.5, 0.6, -7.1],
      "#d9dfc5",
      0.05,
    );
    north.rotation.y = 0.04;
    const east = this.box(
      this.island,
      [0.16, 0.7, 5.6],
      [7.7, 0.6, -1.9],
      "#d9dfc5",
      0.05,
    );
    east.rotation.y = -0.1;
    for (const device of this.data.scene.equipment) {
      const g = new T.Group();
      g.position.set(...device.position);
      this.island.add(g);
      if (g.position.x > 7) g.rotation.y = -Math.PI / 2;
      if (device.type === "screen") {
        this.box(g, [1.1, 0.72, 0.1], [0, 1.6, 0], C.ink, 0.06);
        this.screen(g, [0, 1.6, 0.06], 0.96, 0.58, "#8cbbb0");
        this.cylinder(g, 0.035, 0.06, 1.15, [0, 0.6, 0], C.ink, 8);
        if (device.mount === "mobile")
          this.box(g, [0.8, 0.08, 0.4], [0, 0.1, 0], C.ink, 0.03);
      }
      if (device.type === "photo-booth") {
        this.box(g, [0.85, 1.8, 1.2], [0, 1, 0], "#f0c1aa", 0.12);
        this.box(g, [0.6, 1.1, 0.05], [0, 1.15, 0.62], C.cream, 0.06);
        this.box(g, [0.45, 0.5, 0.06], [0, 1.3, 0.66], C.ink, 0.03);
        this.ball(g, [0, 1.7, 0.67], [0.07, 0.07, 0.04], C.ink);
      }
      if (device.type === "desk") {
        this.box(g, [1.4, 0.7, 0.65], [0, 0.5, 0], "#d9c39f", 0.06);
        this.box(g, [1.6, 0.1, 0.8], [0, 0.9, 0], C.cream, 0.05);
      }
      if (device.type === "stamp") {
        this.cylinder(g, 0.35, 0.25, 0.8, [0, 0.5, 0], C.wood, 12);
        this.cylinder(g, 0.4, 0.4, 0.1, [0, 0.95, 0], C.cream, 16);
        this.cylinder(g, 0.07, 0.1, 0.15, [0, 1.1, 0], C.coral, 10);
      }
    }
  }
  private clouds() {
    for (let i = 0; i < 9; i++) {
      const cloud = new T.Group();
      cloud.userData.animated = true;
      const baseX = Math.cos(i * 2.3) * (12 + (i % 3)),
        baseZ = Math.sin(i * 2.3) * (10 + (i % 4));
      cloud.position.set(baseX, -1 + (i % 3) * 2.6, baseZ);
      this.scene.add(cloud);
      for (let j = 0; j < 4; j++)
        this.ball(
          cloud,
          [(j - 1.5) * 0.6, Math.sin(j * 1.5) * 0.18, 0],
          [0.68, 0.35 + (j % 2) * 0.18, 0.55],
          "#ffffff",
        );
      cloud.scale.setScalar(0.7 + (i % 3) * 0.3);
      this.animations.push((t) => {
        cloud.position.x = baseX + Math.sin(t * 0.03 + i) * 0.6;
        cloud.position.y += 0;
      });
    }
    // Thin orbital trail, tiny distant satellite islands.
    const points = Array.from(
      { length: 100 },
      (_, i) =>
        new T.Vector3(
          Math.cos((i / 99) * Math.PI * 2) * 13,
          -3.5,
          Math.sin((i / 99) * Math.PI * 2) * 11,
        ),
    );
    this.scene.add(
      new T.Line(
        new T.BufferGeometry().setFromPoints(points),
        new T.LineDashedMaterial({
          color: "#bdcfc0",
          dashSize: 0.12,
          gapSize: 0.23,
          transparent: true,
          opacity: 0.65,
        }),
      ).computeLineDistances(),
    );
    for (let i = 0; i < 3; i++) {
      const g = new T.Group();
      g.position.set(i === 0 ? -12 : 12 + i, -1.8 + i, i === 1 ? -7 : 5 + i);
      this.scene.add(g);
      this.cylinder(g, 0.9, 0.55, 0.45, [0, 0, 0], "#d8c5a3", 7);
      this.cylinder(g, 0.93, 0.93, 0.15, [0, 0.3, 0], "#b5c999", 7);
      this.cylinder(g, 0.04, 0.06, 0.5, [0, 0.6, 0], C.wood, 7);
      this.ball(g, [0, 1, 0], [0.35, 0.45, 0.35], "#8fb684");
    }
  }
  /** Merge static geometry by material; moving mechanisms and instancing stay separate. */
  private batchStatic(parent: T.Group) {
    parent.updateWorldMatrix(true, true);
    const inverse = parent.matrixWorld.clone().invert();
    const batches = new Map<T.Material, T.Mesh[]>();
    const collect = (obj: T.Object3D) => {
      if (obj !== parent && (obj.userData.animated || obj.userData.zoneId))
        return;
      if (
        obj instanceof T.Mesh &&
        !(obj instanceof T.InstancedMesh) &&
        obj.material instanceof T.MeshStandardMaterial
      ) {
        const list = batches.get(obj.material) || [];
        list.push(obj);
        batches.set(obj.material, list);
      } else if (!(obj instanceof T.Mesh)) obj.children.forEach(collect);
    };
    collect(parent);
    for (const [material, meshes] of batches) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map((m) => {
        const copy = m.geometry.clone();
        const geo = copy.index ? copy.toNonIndexed() : copy;
        if (geo !== copy) copy.dispose();
        geo.applyMatrix4(inverse.clone().multiply(m.matrixWorld));
        return geo;
      });
      const merged = mergeGeometries(geometries);
      geometries.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new T.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      meshes.forEach((m) => m.parent?.remove(m));
    }
  }

  private async loadModels() {
    const loader = new GLTFLoader();
    const entries = this.data.scene.models.map((m) => ({
      ...m,
      url: m.url ? assetPath(m.url) : assetPath("/models/kenney/" + m.file),
      parent: this.island,
    }));
    const mascots = this.data.scene.mascotSlots
      .filter((s) => s.modelUrl)
      .map((s) => ({
        file: "mascot-" + s.zoneId,
        url: assetPath(s.modelUrl!),
        parent: this.groups.get(s.zoneId)!,
        position: s.position,
        height: 0.9,
        rotation: 0,
        animated: false,
      }));
    this.pending = entries.length + mascots.length;
    await Promise.all(
      [...entries, ...mascots].map(async (m) => {
        try {
          const gltf = await loader.loadAsync(m.url);
          if (this.disposed) {
            this.disposeObject(gltf.scene);
            return;
          }
          const model = gltf.scene;
          const bbox = new T.Box3().setFromObject(model);
          const scale = m.height / (bbox.max.y - bbox.min.y || 1);
          const center = bbox.getCenter(new T.Vector3());
          model.position.set(-center.x, -bbox.min.y, -center.z);
          const wrapper = new T.Group();
          wrapper.userData.animated = Boolean(m.animated);
          wrapper.add(model);
          wrapper.scale.setScalar(scale);
          wrapper.position.set(...m.position);
          wrapper.position.y += 0.24;
          wrapper.rotation.y = m.rotation;
          wrapper.traverse((obj) => {
            if (obj instanceof T.Mesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
            }
          });
          m.parent.add(wrapper);
          this.loadedModels++;
          if (m.animated)
            this.animations.push((t) => {
              wrapper.position.x =
                m.position[0] + Math.sin(t * 0.25 + m.position[2]) * 0.6;
              wrapper.rotation.y = m.rotation + Math.cos(t * 0.25) * 0.3;
            });
        } catch {
          this.modelFailures.push(m.file);
          if (!this.disposed) {
            this.onIssue("部分模型載入失敗，已顯示替代物件。");
            this.ball(
              m.parent,
              [m.position[0], m.position[1] + 0.6, m.position[2]],
              [0.3, 0.4, 0.3],
              "#b8c4ae",
            );
          }
        } finally {
          this.pending--;
        }
      }),
    );
    if (!this.disposed) {
      this.batchStatic(this.island);
      this.groups.forEach((g) => this.batchStatic(g));
      this.highlight();
    }
  }
  updateLabels(filter: Filter, selectedId?: string) {
    for (const zone of this.data.zones) {
      const el = this.labelElements.get(zone.id)!;
      const names =
        zone.id === "service"
          ? activeServices(this.data, filter).map((s) => s.name)
          : selectExhibitors(this.data, zone.id, filter).map((e) => e.name);
      const selected = this.data.exhibitors.find(
        (e) => e.id === selectedId && e.zoneId === zone.id,
      );
      el.querySelector(".label-names")!.textContent =
        selected?.name ||
        (filter.date
          ? names.join("・") || "此時段資料待確認"
          : `${zone.theme}`);
      el.dataset.selected = String(this.selected === zone.id);
    }
  }
  focus(zone: ZoneId | null, boothPosition?: [number, number, number]) {
    this.selected = zone;
    this.highlight();
    const target = zone
      ? boothPosition || this.data.scene.zones[zone].position
      : [0, 0.2, 0];
    const mobile = innerWidth < 768;
    const offset = zone ? (mobile ? [12, 12, 15] : [11, 10, 13]) : [18, 19, 24];
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);
    const duration = this.reduced ? 0 : 1.5;
    gsap.to(this.controls.target, {
      x: target[0],
      y: target[1] + 0.5,
      z: target[2],
      duration,
      ease: "power2.inOut",
    });
    gsap.to(this.camera.position, {
      x: target[0] + offset[0],
      y: target[1] + offset[1],
      z: target[2] + offset[2],
      duration,
      ease: "power2.inOut",
    });
    this.labelElements.forEach(
      (el, id) => (el.dataset.selected = String(id === zone)),
    );
  }
  private highlight() {
    for (const [id, g] of this.groups) {
      const active = id === this.selected || id === this.hovered;
      g.traverse((obj) => {
        if (
          obj instanceof T.Mesh &&
          obj.material instanceof T.MeshStandardMaterial
        ) {
          if (!obj.userData.independentMaterial) {
            obj.material = obj.material.clone();
            obj.userData.baseColor = obj.material.color.clone();
            obj.userData.baseEmissive = obj.material.emissive.clone();
            obj.userData.baseIntensity = obj.material.emissiveIntensity;
            obj.userData.independentMaterial = true;
          }
          const mat = obj.material as T.MeshStandardMaterial;
          mat.color.copy(obj.userData.baseColor);
          if (this.selected && id !== this.selected)
            mat.color.lerp(new T.Color("#a8b8a2"), 0.32);
          mat.emissive.copy(
            active
              ? new T.Color(this.data.zones.find((z) => z.id === id)!.color)
              : obj.userData.baseEmissive,
          );
          mat.emissiveIntensity = active ? 0.12 : obj.userData.baseIntensity;
        }
      });
    }
  }
  setQuality(low: boolean) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.75));
    this.renderer.shadowMap.enabled = !low;
    this.renderer.shadowMap.needsUpdate = true;
  }
  rotate(direction: number) {
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);
    const delta = new T.Vector3().subVectors(
      this.camera.position,
      this.controls.target,
    );
    delta.applyAxisAngle(new T.Vector3(0, 1, 0), direction * 0.2);
    this.camera.position.copy(this.controls.target).add(delta);
    this.controls.update();
  }
  zoom(direction: number) {
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);
    const delta = new T.Vector3().subVectors(
      this.camera.position,
      this.controls.target,
    );
    delta.multiplyScalar(direction > 0 ? 0.85 : 1.18);
    delta.clampLength(12, 52);
    this.camera.position.copy(this.controls.target).add(delta);
    this.controls.update();
  }
  private onKey = (e: KeyboardEvent) => {
    if (["ArrowLeft", "ArrowRight", "+", "-", "Home"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "Home") this.focus(null);
      else if (e.key === "+" || e.key === "-")
        this.zoom(e.key === "+" ? 1 : -1);
      else this.rotate(e.key === "ArrowLeft" ? -1 : 1);
    }
  };
  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.onIssue(
      "3D 顯示已中斷，仍可使用展區導覽與學校清單。重新整理可嘗試恢復。",
    );
  };
  private resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.labels.setSize(width, height);
  }
  private tick = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    const t = (performance.now() - this.start) / 1000,
      dt = Math.min(0.1, t - this.last);
    this.last = t;
    this.fps = dt ? 1 / dt : 0;
    if (document.hidden) return;
    if (!this.reduced) {
      this.island.position.y = Math.sin(t * 0.5) * 0.065;
      this.animations.forEach((fn) => fn(t, dt));
      this.screenMaterials.forEach(
        (m, i) => (m.emissiveIntensity = 0.14 + Math.sin(t * 1.5 + i) * 0.07),
      );
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  };
  get diagnostics() {
    return {
      loadedModels: this.loadedModels,
      pendingModels: this.pending,
      modelFailures: this.modelFailures,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      camera: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      fps: Math.round(this.fps),
      cameraAnimating:
        gsap.isTweening(this.camera.position) ||
        gsap.isTweening(this.controls.target),
      zoneScreenPositions: this.data.zones.map((z) => {
        const point = this.groups
          .get(z.id)!
          .localToWorld(new T.Vector3(0, 1.5, 0))
          .project(this.camera);
        const rect = this.container.getBoundingClientRect();
        return {
          id: z.id,
          x: rect.left + ((point.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - point.y) / 2) * rect.height,
        };
      }),
    };
  }
  private disposeObject(root: T.Object3D) {
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>(),
      textures = new Set<T.Texture>();
    root.traverse((obj) => {
      if (obj instanceof T.Mesh) {
        geometries.add(obj.geometry);
        const mats = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        mats.forEach((m: T.Material) => {
          materials.add(m);
          for (const value of Object.values(m))
            if (value instanceof T.Texture) textures.add(value);
        });
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);
    this.cleanupPicking();
    this.observer.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener("keydown", this.onKey);
    this.renderer.domElement.removeEventListener(
      "webglcontextlost",
      this.onContextLost,
    );
    this.disposeObject(this.scene);
    this.textures.forEach((t) => t.dispose());
    this.materials.forEach((m) => m.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}
