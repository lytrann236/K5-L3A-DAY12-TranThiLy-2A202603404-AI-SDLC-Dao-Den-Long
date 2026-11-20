import {
  AmbientLight,
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

export function createWorld(canvas: HTMLCanvasElement): World {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new Scene();
  const night = new Color(0x070b18);
  const dawnish = new Color(0x2a3868);
  scene.background = night.clone();
  scene.fog = new FogExp2(0x16204a, 0.008);
  const camera = new PerspectiveCamera(60, 1, 0.1, 1500);

  // Ánh sáng nền: tăng dần theo số đèn đã thắp.
  const ambient = new AmbientLight(0x9aaad8, 0.9);
  const moon = new DirectionalLight(0xb4c4f4, 0.8);
  moon.position.set(-30, 60, -20);
  scene.add(ambient, moon);

  // Đảo tròn 40 m, mặt trên ở Y = 0.
  const island = new Mesh(
    new CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS, 3, 72),
    new MeshStandardMaterial({ color: 0x4f7d5a, roughness: 1 }),
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

  // Đèn lồng (tạo theo state lúc cần, vì vị trí có thể bị scenario đổi).
  const lanternViews = new Map<string, LanternView>();
  const lanternRoot = new Group();
  scene.add(lanternRoot);
  const postGeo = new CylinderGeometry(0.12, 0.16, 3, 8);
  const bodyGeo = new SphereGeometry(0.7, 16, 12);
  const postMat = new MeshStandardMaterial({ color: 0x6b4a30, roughness: 1 });

  function lanternView(id: string): LanternView {
    let v = lanternViews.get(id);
    if (!v) {
      const post = new Mesh(postGeo, postMat);
      post.position.y = 1.5;
      const body = new Mesh(
        bodyGeo,
        new MeshStandardMaterial({ color: 0x6a4a36, emissive: 0x000000, roughness: 0.8 }),
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

  // Người chơi = Mây: thân + đầu, đội nón lá (nón dẹt màu rơm, rộng ≈ 2.5 lần đầu) đặt TRÊN đỉnh đầu,
  // có một đèn lồng nhỏ đỏ-cam phát sáng treo ở vành nón phía trước, kèm một PointLight vàng ấm.
  const HEAD_R = 0.3;
  const HEAD_Y = 1.3;
  const HAT_R = HEAD_R * 2 * 1.25; // đường kính nón = 2.5 × đường kính đầu
  const HAT_H = 0.5;
  const HAT_BASE_Y = HEAD_Y + HEAD_R; // đáy nón chạm đỉnh đầu, không lọt vào đầu
  const player = new Group(); // trục +Z cục bộ là hướng "phía trước"
  const cloudMat = new MeshStandardMaterial({ color: 0xf2f5ff, emissive: 0x4a5578, roughness: 0.9 });
  const pBody = new Mesh(new CylinderGeometry(0.35, 0.4, 1, 14), cloudMat);
  pBody.position.y = 0.5;
  const pHead = new Mesh(new SphereGeometry(HEAD_R, 16, 12), cloudMat);
  pHead.position.y = HEAD_Y;
  const hat = new Mesh(
    new ConeGeometry(HAT_R, HAT_H, 32),
    new MeshStandardMaterial({ color: 0xe2c46e, emissive: 0x5a4618, roughness: 1 }),
  );
  hat.position.y = HAT_BASE_Y + HAT_H / 2;
  // Đèn lồng treo ở vành nón, lệch về phía trước-phải (70° tính từ hướng trước): nhìn rõ cả
  // từ phía sau lưng (góc nhìn mặc định), không bị nón và thân che.
  const brimAngle = (70 * Math.PI) / 180;
  const lx = Math.sin(brimAngle) * HAT_R * 0.92;
  const lz = Math.cos(brimAngle) * HAT_R * 0.92;
  const STRING_H = 0.4;
  const string = new Mesh(
    new CylinderGeometry(0.02, 0.02, STRING_H, 6),
    new MeshBasicMaterial({ color: 0x6b4a30 }),
  );
  string.position.set(lx, HAT_BASE_Y - STRING_H / 2, lz);
  const LAMP_Y = HAT_BASE_Y - STRING_H - 0.16;
  const lamp = new Mesh(
    new SphereGeometry(0.17, 14, 10),
    new MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff4a10, emissiveIntensity: 2.5 }),
  );
  lamp.scale.y = 1.2;
  lamp.position.set(lx, LAMP_Y, lz);
  const lampLight = new PointLight(0xffa84a, 12, 14, 1.3);
  lampLight.position.set(lx, LAMP_Y, lz);
  player.add(pBody, pHead, hat, string, lamp, lampLight);
  scene.add(player);
  // Hướng mặt: quay theo hướng đi (chỉ ở hiển thị).
  let faceYaw = 0;
  let lastX = 0;
  let lastZ = 0;

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
      ambient.intensity = 0.9 + 0.6 * k;
      moon.intensity = 0.8 + 0.6 * k;
      (scene.background as Color).copy(night).lerp(dawnish, k);

      for (const l of state.lanterns) {
        const v = lanternView(l.id);
        v.group.position.set(l.pos[0], l.pos[1], l.pos[2]);
        const mat = v.body.material as MeshStandardMaterial;
        mat.color.setHex(l.lit ? LIT_COLOR : 0x6a4a36);
        mat.emissive.setHex(l.lit ? LIT_EMISSIVE : 0x000000);
        mat.emissiveIntensity = l.lit ? 1.6 : 0;
        v.light.intensity = l.lit ? 60 : 0;
      }

      const p = state.player;
      player.position.set(p.pos[0], p.pos[1], p.pos[2]);
      const mx = p.pos[0] - lastX;
      const mz = p.pos[2] - lastZ;
      if (Math.hypot(mx, mz) > 1e-4 && Math.hypot(mx, mz) < 2) faceYaw = Math.atan2(mx, mz);
      lastX = p.pos[0];
      lastZ = p.pos[2];
      player.rotation.y = faceYaw;
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
