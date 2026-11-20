import {
  AmbientLight,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  FogExp2,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three';
import { ISLAND_RADIUS, SHADE_Y } from '../sim/constants';
import { mulberry32 } from '../sim/rng';
import type { GameState } from '../sim/types';
import { placeCamera } from './camera';

/** Mây (nhân vật trang trí, chỉ có ở giao diện): góc đặt quanh mép đảo, tránh góc các đèn. */
const CLOUD_FOLK_ANGLES_DEG = [30, 200, 280];
const CLOUD_FOLK_RADIUS = 36;

const LIT_COLOR = 0xffb347;
const LIT_EMISSIVE = 0xff8a1f;

interface LanternView {
  group: Group;
  body: Mesh;
  light: PointLight;
}

export interface World {
  render(state: GameState, timeSec: number, yawDeg: number, pitchDeg: number): void;
  resize(): void;
}

function makeCloudFolk(angleDeg: number): Group {
  const g = new Group();
  const body = new Mesh(
    new BoxGeometry(1.6, 1.4, 1.6),
    new MeshStandardMaterial({ color: 0xf3f6ff, emissive: 0x303a55, roughness: 0.9 }),
  );
  body.position.y = 0.7;
  // Nón lá: hình nón dẹt.
  const hat = new Mesh(
    new ConeGeometry(1.5, 0.7, 20),
    new MeshStandardMaterial({ color: 0xd9b86c, roughness: 1 }),
  );
  hat.position.y = 1.4 + 0.35;
  // Đèn lồng nhỏ treo bên hông.
  const string = new Mesh(
    new CylinderGeometry(0.025, 0.025, 0.7, 6),
    new MeshBasicMaterial({ color: 0x5a3a1a }),
  );
  string.position.set(1.05, 1.0, 0);
  const lamp = new Mesh(new SphereGeometry(0.22, 12, 10), new MeshBasicMaterial({ color: LIT_COLOR }));
  lamp.position.set(1.05, 0.55, 0);
  g.add(body, hat, string, lamp);
  const a = (angleDeg * Math.PI) / 180;
  g.position.set(CLOUD_FOLK_RADIUS * Math.cos(a), 0, CLOUD_FOLK_RADIUS * Math.sin(a));
  g.lookAt(0, 0, 0);
  return g;
}

export function createWorld(canvas: HTMLCanvasElement): World {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new Scene();
  const night = new Color(0x070b18);
  const dawnish = new Color(0x1a2448);
  scene.background = night.clone();
  scene.fog = new FogExp2(0x0b1230, 0.011);
  const camera = new PerspectiveCamera(60, 1, 0.1, 1500);

  // Ánh sáng nền: tăng dần theo số đèn đã thắp.
  const ambient = new AmbientLight(0x8090c0, 0.3);
  const moon = new DirectionalLight(0x9fb0e8, 0.25);
  moon.position.set(-30, 60, -20);
  scene.add(ambient, moon);

  // Đảo tròn 40 m, mặt trên ở Y = 0.
  const island = new Mesh(
    new CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS, 3, 72),
    new MeshStandardMaterial({ color: 0x35553f, roughness: 1 }),
  );
  island.position.y = -1.5;
  const rock = new Mesh(
    new ConeGeometry(ISLAND_RADIUS, 20, 48),
    new MeshStandardMaterial({ color: 0x3d322d, roughness: 1 }),
  );
  rock.rotation.x = Math.PI; // đỉnh nón hướng xuống
  rock.position.y = -3 - 10;
  scene.add(island, rock);

  // Biển mây: mặt phẳng lớn + các cụm mây (vị trí cố định, sinh bằng RNG có seed).
  const sea = new Mesh(
    new PlaneGeometry(1600, 1600),
    new MeshStandardMaterial({ color: 0x6f82b4, emissive: 0x1a2340, roughness: 1 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -22;
  scene.add(sea);
  const puffCount = 70;
  const puffs = new InstancedMesh(
    new SphereGeometry(1, 14, 10),
    new MeshStandardMaterial({ color: 0xc9d4f0, emissive: 0x2a3558, roughness: 1 }),
    puffCount,
  );
  const rand = mulberry32(2024);
  const dummy = new Object3D();
  for (let i = 0; i < puffCount; i++) {
    const r = 48 + rand() * 320;
    const a = rand() * Math.PI * 2;
    const s = 8 + rand() * 18;
    dummy.position.set(r * Math.cos(a), -20 + rand() * 6, r * Math.sin(a));
    dummy.scale.set(s * 1.6, s * 0.55, s);
    dummy.updateMatrix();
    puffs.setMatrixAt(i, dummy.matrix);
  }
  scene.add(puffs);

  for (const a of CLOUD_FOLK_ANGLES_DEG) scene.add(makeCloudFolk(a));

  // Đèn lồng (tạo theo state lúc cần, vì vị trí có thể bị scenario đổi).
  const lanternViews = new Map<string, LanternView>();
  const lanternRoot = new Group();
  scene.add(lanternRoot);
  const postGeo = new CylinderGeometry(0.12, 0.16, 3, 8);
  const bodyGeo = new SphereGeometry(0.7, 16, 12);
  const postMat = new MeshStandardMaterial({ color: 0x4a3322, roughness: 1 });

  function lanternView(id: string): LanternView {
    let v = lanternViews.get(id);
    if (!v) {
      const post = new Mesh(postGeo, postMat);
      post.position.y = 1.5;
      const body = new Mesh(
        bodyGeo,
        new MeshStandardMaterial({ color: 0x2a1c14, emissive: 0x000000, roughness: 0.8 }),
      );
      body.scale.set(0.8, 1.1, 0.8);
      body.position.y = 3.4;
      const light = new PointLight(LIT_COLOR, 0, 42, 1);
      light.position.y = 3.4;
      const g = new Group();
      g.add(post, body, light);
      lanternRoot.add(g);
      v = { group: g, body, light };
      lanternViews.set(id, v);
    }
    return v;
  }

  // Người chơi.
  const player = new Group();
  const pBody = new Mesh(
    new CylinderGeometry(0.35, 0.4, 1, 14),
    new MeshStandardMaterial({ color: 0xf2e3c0, emissive: 0x3a3020, roughness: 0.8 }),
  );
  pBody.position.y = 0.5;
  const pHead = new Mesh(
    new SphereGeometry(0.3, 14, 10),
    new MeshStandardMaterial({ color: 0xffeccc, emissive: 0x3a3020, roughness: 0.8 }),
  );
  pHead.position.y = 1.3;
  player.add(pBody, pHead);
  scene.add(player);

  // Đom đóm và Bóng Mực: đồng bộ theo id trong state.
  const moteGeo = new SphereGeometry(0.18, 10, 8);
  const moteMat = new MeshBasicMaterial({ color: 0xffe066 });
  const moteViews = new Map<string, Mesh>();
  const shadeGeo = new SphereGeometry(0.8, 18, 14);
  const shadeViews = new Map<string, Mesh>();

  function sync<T extends Mesh>(
    views: Map<string, T>,
    ids: Set<string>,
    create: () => T,
    id: string,
  ): T {
    ids.add(id);
    let m = views.get(id);
    if (!m) {
      m = create();
      views.set(id, m);
      scene.add(m);
    }
    return m;
  }
  function prune(views: Map<string, Mesh>, keep: Set<string>): void {
    for (const [id, m] of views) {
      if (!keep.has(id)) {
        scene.remove(m);
        views.delete(id);
      }
    }
  }

  return {
    resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },

    render(state, t, yawDeg, pitchDeg) {
      const litCount = state.lanterns.filter((l) => l.lit).length;
      const k = litCount / Math.max(1, state.lanterns.length);
      ambient.intensity = 0.3 + 0.7 * k;
      moon.intensity = 0.25 + 0.6 * k;
      (scene.background as Color).copy(night).lerp(dawnish, k);

      for (const l of state.lanterns) {
        const v = lanternView(l.id);
        v.group.position.set(l.pos[0], l.pos[1], l.pos[2]);
        const mat = v.body.material as MeshStandardMaterial;
        mat.color.setHex(l.lit ? LIT_COLOR : 0x2a1c14);
        mat.emissive.setHex(l.lit ? LIT_EMISSIVE : 0x000000);
        mat.emissiveIntensity = l.lit ? 1.6 : 0;
        v.light.intensity = l.lit ? 60 : 0;
      }

      const p = state.player;
      player.position.set(p.pos[0], p.pos[1], p.pos[2]);
      player.visible = p.invuln === 0 || Math.floor(t * 12) % 2 === 0;

      const moteIds = new Set<string>();
      state.motes.forEach((m, i) => {
        const mesh = sync(moteViews, moteIds, () => new Mesh(moteGeo, moteMat), m.id);
        mesh.position.set(m.pos[0], 0.8 + Math.sin(t * 2 + i) * 0.15, m.pos[2]);
      });
      prune(moteViews, moteIds);

      const shadeIds = new Set<string>();
      for (const s of state.shades) {
        const mesh = sync(
          shadeViews,
          shadeIds,
          () =>
            new Mesh(
              shadeGeo,
              new MeshStandardMaterial({ color: 0x2a0a4a, emissive: 0x14002a, roughness: 0.6 }),
            ),
          s.id,
        );
        mesh.position.set(s.pos[0], s.pos[1] || SHADE_Y, s.pos[2]);
        const mat = mesh.material as MeshStandardMaterial;
        const stunned = s.state === 'stunned';
        mat.color.setHex(stunned ? 0xb9a4ff : 0x2a0a4a);
        mat.emissive.setHex(stunned ? 0x5a4a9a : 0x14002a);
      }
      prune(shadeViews, shadeIds);

      placeCamera(camera, p.pos, yawDeg, pitchDeg);
      renderer.render(scene, camera);
    },
  };
}
