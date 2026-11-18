// story.js: "In this town, every time you sneeze, something from your house disappears."
// James vs the bridge monster. Sets, cast, then one shot() per picture.
import * as THREE from 'three';
import { start, shot, frame } from './core.js';
import { makeAvatar } from './avatar.js';
import { SETS, room, TEX, floor, sofa, bed, chair, door, windowPane, bookshelf, rug, tree, bush, sky, plant } from './sets.js';
import { makeSparkles, makeBulb, makePuff } from './fx.js';
import { remap, E, lerp, box, at, grp, sign, mat, glow, rng, PRE } from './util.js';

// ───────────────────────── cast (same look in every set) ─────────────────────────
const OPTS = {
  james: { seed: 11, skin: 'light', hair: 'swoop', hairColor: '#5a3820', top: 'hoodie', topColor: '#22b04a', bottom: 'jeans', bottomColor: '#4f79a7' },
  owen: { seed: 12, skin: 'brown', hair: 'dreads', hairColor: '#1a120e', top: 'zip', topColor: '#940c1b', sleeves: 'long', inner: '#15151a', bottom: 'joggers', bottomColor: '#1d1d22', shoe: '#ffffff' },
  monster: { seed: 13, skin: '#79b84f', height: 1.6, hair: 'spiky', hairColor: '#355e2a', top: 'vest', topColor: '#7a5534', inner: '#4a6b33', sleeves: 'none', bottom: 'shorts', bottomColor: '#5a4a3a', shoe: '#6a5644', sole: '#3a2e24' },
  mom: { seed: 14, skin: 'light', hair: 'bob', hairColor: '#7a4a2e', top: 'cardigan', topColor: '#f2f2f2', inner: '#e86a8a', sleeves: 'long', bottom: 'slacks', bottomColor: '#4f79a7', shoe: '#d8d8d8' },
  dad: { seed: 15, skin: 'light', hair: 'short', hairColor: '#2b1b14', top: 'shirt', topColor: '#8fc6ff', bottom: 'slacks', bottomColor: '#3b3d44', shoe: '#2a2a2a', sole: '#111', glasses: true },
  clerk: { seed: 16, skin: 'tan', hair: 'ponytail', hairColor: '#1b1210', top: 'tee', topColor: '#ffd23f', bottom: 'jeans', bottomColor: '#274b8f' },
};
function mk(set, name) {
  const a = makeAvatar(OPTS[name]);
  if (name === 'monster') for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.6, 10), mat('#f4e6c8')); h.position.set(s * 0.4, 1.42, 0.05); h.rotation.z = -s * 0.4; h.castShadow = true; a.head.add(h); }
  set.group.add(a.root); return a;
}
// objects that change between shots: restored to their default every frame, then the shot moves them
function tog(set, obj, def = true) {
  obj.userData.p = obj.position.clone(); obj.userData.r = obj.rotation.clone(); obj.userData.s = obj.scale.x;
  (set.toggles ||= []).push([obj, def]); set.group.add(obj);
  set.reset = () => { for (const [o, d] of set.toggles) { o.visible = d; o.position.copy(o.userData.p); o.rotation.copy(o.userData.r); o.scale.setScalar(o.userData.s); } };
  return obj;
}
// item vanishes (out) or pops in (in) at dt = 0
function poof(o, dt, out = true) {
  const s0 = o.userData.s;
  if (out) { const k = remap(dt, 0, 0.2); o.visible = k < 1; o.scale.setScalar(s0 * Math.max(0.001, (1 + 0.15 * Math.sin(k * Math.PI)) * (1 - E.in(k)))); }
  else { o.visible = dt >= 0; o.scale.setScalar(s0 * Math.max(0.001, E.back(remap(dt, 0, 0.35)))); }
}
// item drops out of the sky and lands at t1
function drop(o, lt, t0, t1, from = 18) {
  const p = o.userData.p, k = E.in(remap(lt, t0, t1)); o.visible = lt >= t0; o.position.set(p.x, p.y + from * (1 - k), p.z); o.rotation.z = o.userData.r.z + (1 - k) * 0.7; return lt >= t1;
}
// the sneeze: head goes back with a 'wow' face for 0.45 s, then snaps forward on t0 with the scream face
function sneeze(av, lt, t0) {
  const dt = lt - t0;
  if (dt < -0.45 || dt > 0.5) return false;
  if (dt < 0) { const k = E.out(remap(dt, -0.45, -0.05)); av.head.rotation.x -= 0.5 * k; av.hip.rotation.x -= 0.12 * k; av.setFace('wow'); }
  else { const k = 1 - remap(dt, 0, 0.4); av.head.rotation.x += 0.4 * k; av.hip.rotation.x += 0.16 * k; av.setFace('scream'); av.pose({ aL: [20, 70], aR: [20, 70] }, Math.sin(remap(dt, 0, 0.5) * Math.PI)); }
  return true;
}
const nose = av => { const p = av.root.position, s = av.root.scale.x; return [p.x + Math.sin(av.root.rotation.y) * 0.9 * s, p.y + 2.6 * s, p.z + Math.cos(av.root.rotation.y) * 0.9 * s]; };
const held = (av, mesh, hand = 'R', off = [0, -0.35, 0.1]) => { mesh.position.set(...off); (hand === 'R' ? av.handR : av.handL).add(mesh); PRE.push(() => { mesh.visible = false; }); return mesh; };

// ───────────────────────── props ─────────────────────────
const tissueBox = () => grp(at(box(1.1, 0.7, 0.8, '#6cc7ef', 0.08), 0, 0, 0), at(box(0.5, 0.45, 0.3, '#ffffff', 0.12), 0, 0.45, 0));
const pepper = () => grp(at(box(0.5, 0.85, 0.5, '#2b2b30', 0.12), 0, 0, 0), at(box(0.52, 0.22, 0.52, '#c8c8d0', 0.06), 0, 0.52, 0), at(sign('P', 0.4, 0.4, { bg: '#ffffff', fg: '#e8413c' }), 0, 0, 0.26));
const soup = () => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.38, 0.5, 18), mat('#ff6b4a')); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 18), mat('#f5c242')); s.position.y = 0.24; return grp(b, s); };
const socks = () => grp(...[-0.3, 0.3].map(x => grp(at(box(0.4, 1, 0.3, '#e8413c', 0.06), x, 0, 0), at(box(0.42, 0.18, 0.32, '#ffffff'), x, 0.3, 0), at(box(0.4, 0.35, 0.7, '#e8413c', 0.06), x, -0.4, 0.2))));
const tvBox = c => grp(at(box(3.4, 2.2, 0.5, '#17181c', 0.06), 0, 1.1, 0), at(box(3.0, 1.8, 0.06, glow(c, 1.1)), 0, 1.1, 0.27), at(box(1.2, 0.2, 0.8, '#17181c'), 0, 0.05, 0));
function fridge() {
  return grp(at(box(3, 6.4, 2.6, '#eef2f5', 0.15), 0, 3.2, 0), at(box(3.02, 0.08, 2.62, '#c9d0d6'), 0, 4.4, 0), at(box(0.18, 1.2, 0.2, '#9aa3ab'), 1.1, 5.3, 1.35), at(box(0.18, 1.6, 0.2, '#9aa3ab'), 1.1, 3.1, 1.35),
    at(sign("GRANDMA'S", 2.4, 0.7, { bg: '#ff5fa8', fg: '#fff' }), -0.1, 3.5, 1.32), at(box(0.3, 0.3, 0.1, '#ffd23f'), -0.8, 5.6, 1.33), at(box(0.3, 0.3, 0.1, '#2f7de1'), -0.2, 5.8, 1.33));
}
function spoonPile(seed = 3) {
  const g = grp(), r = rng(seed), m = mat('#d5dae0'), dome = new THREE.Mesh(new THREE.SphereGeometry(2.8, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#aeb5bf')); dome.scale.y = 0.75; dome.castShadow = dome.receiveShadow = true; g.add(dome);
  for (let i = 0; i < 90; i++) {
    const a = r() * 6.28, e = r() * 1.35, d = new THREE.Vector3(Math.sin(e) * Math.cos(a), Math.cos(e) * 0.75, Math.sin(e) * Math.sin(a)).multiplyScalar(2.85);
    const s = grp(box(0.14, 0.05, 1.3, m), (() => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), m); b.scale.set(1, 0.35, 1.4); b.position.z = 0.8; return b; })());
    s.position.copy(d); s.rotation.set(r() * 6.28, r() * 6.28, r() * 6.28); g.add(s);
  }
  return g;
}
function couchStack(seed, n = 4) {
  const g = grp(), r = rng(seed), cs = ['#e8734f', '#7b3fc4', '#2f9e55', '#f2b01e', '#2f7de1', '#ff5fa8'];
  for (let i = 0; i < n; i++) { const s = sofa(cs[(i + seed) % cs.length]); s.scale.setScalar(0.72); s.position.set((r() - 0.5) * 1.2, i * 2.15, (r() - 0.5) * 0.8); s.rotation.set(0, (r() - 0.5) * 0.6, (r() - 0.5) * 0.12); g.add(s); }
  return g;
}

start(() => {
  // ───────────────────────── sets ─────────────────────────
  // James's living room (the hook)
  const living = { group: room({ floorTex: TEX.wood('#c98f52'), tile: 6, wallColor: '#f6e4c8', trim: '#ffffff', trimY: 0.6, w: 34, d: 24, lights: 1 }), light: 'warm' };
  living.group.add(at(sofa('#e8734f'), -3, 0, -3.6), at(rug(11, 6, '#9fd3c7'), -1, 0, 1.5), at(plant(), -12, 0, -4.6), at(windowPane(5, 4.4), 7, 7.6, -5.85), at(sign(['HOME', 'SWEET', 'HOME'], 3, 3, { bg: '#fff', fg: '#e8632b', border: '#b9783f' }), -3, 8.8, -5.85));
  const L_tv = tog(living, at(grp(at(box(4.4, 1.4, 1.6, '#b9783f'), 0, 0.7, 0), at(tvBox('#7fd0ff'), 0, 1.4, 0)), 6, 0, -1.8, -0.9));
  const L = { dad: mk(living, 'dad'), mom: mk(living, 'mom'), sp: makeSparkles(living.group, 2), sp2: makeSparkles(living.group, 5), puff: makePuff(living.group), puff2: makePuff(living.group, 8) };
  held(L.mom, tissueBox(), 'R', [0, -0.4, 0.5]);
  L.momBox = L.mom.handR.children[0];

  // under the bridge: the monster's house, a pile of everyone's sneezed-away stuff
  const stone = TEX.brick('#a9a39c', '#8a847d');
  const bridge = { group: grp(sky(), at(floor(240, 160, TEX.grass('#5cc04c'), 6), 0, -0.03, -40), at(floor(46, 16, TEX.concrete('#cdb48c'), 5), 0, 0.01, -1)), light: 'outdoor' };
  { const g = bridge.group, sm = new THREE.MeshLambertMaterial({ map: (() => { const t = stone.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 1); t.needsUpdate = true; return t; })() });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(240, 7), new THREE.MeshLambertMaterial({ color: '#3d9be0' })); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.02, -12); g.add(water);
    g.add(at(box(80, 2.4, 12, sm), 0, 14.2, -5), at(box(80, 1.4, 0.6, '#8a847d'), 0, 16, 0.7), at(box(5, 13, 12, sm), -23, 6.5, -5), at(box(5, 13, 12, sm), 23, 6.5, -5));
    g.add(at(sign('BRIDGE ST.', 6, 1.4, { bg: '#1f6b43', fg: '#fff', border: '#ffffff' }), 0, 14.2, 1.05));
    const r = rng(31); for (let i = 0; i < 14; i++) g.add(at(tree(9 + r() * 5, r() < 0.5 ? '#3f9b3f' : '#58b044'), (i - 6.5) * 14 + r() * 5, 0, -24 - r() * 20));
    g.add(at(couchStack(1), -13, 0, -3.4), at(couchStack(4, 3), -18, 0, -1.5), at(spoonPile(), 11, 0, -2.2), at(fridge(), 5, 0, -3.8, -0.25));
    [['#ff8a5a', -7, 0, -3.5, 0.2], ['#7fd0ff', -4.6, 0, -4.2, -0.3], ['#c7ff7a', -6, 2.3, -3.9, 0.1], ['#ff7ad1', -1.6, 0, -4.5, 0.4]].forEach(([c, x, y, z, ry]) => g.add(at(tvBox(c), x, y, z, ry)));
    const b2 = bed('#ffb3c7'); b2.scale.setScalar(0.8); g.add(at(b2, 16.5, 0, -2.5, 1.2)); const b3 = bed('#9fd3c7'); b3.scale.setScalar(0.8); g.add(at(b3, 16, 2.2, -2.8, 1.6));
    g.add(at(bush(), -21, 0, 3), at(bush(), 21, 0, 3)); }
  const B_tv = tog(bridge, at(grp(at(box(4.4, 1.4, 1.6, '#b9783f'), 0, 0.7, 0), at(tvBox('#7fd0ff'), 0, 1.4, 0)), -8, 0, 0.6, 0.3), false);
  const B_bed = tog(bridge, at(bed('#4f8fe8'), -4, 0, -0.6, Math.PI / 2 + 0.15), false);
  const B = { james: mk(bridge, 'james'), mon: mk(bridge, 'monster'), sp: makeSparkles(bridge.group, 3), sp2: makeSparkles(bridge.group, 7), puff: makePuff(bridge.group), puff2: makePuff(bridge.group, 9) };
  const B_tissue = held(B.james, tissueBox(), 'R', [0, -0.4, 0.5]), B_soup = held(B.james, soup(), 'R', [0, -0.3, 0.5]);
  const B_socks = held(B.mon, socks(), 'R', [0, -0.6, 0.3]), B_pep = held(B.mon, pepper(), 'R', [0, -0.5, 0.3]);

  // the street
  const street = SETS.street({ shops: [['TISSUES', '#d6f2c4', '#2e9e59'], ['SPICES', '#fff0b8', '#e8632b'], ['CAFE', '#bfe3ff', '#2f7de1']] });
  street.group.add(at(sign(['NO', 'PEPPER!'], 3.6, 2.6, { bg: '#e84b4b', fg: '#fff', border: '#ffffff' }), 4.3, 4.2, -1.5));
  const S = { clerk: mk(street, 'clerk') };

  // James's bedroom
  const bedroom = { group: room({ floorTex: TEX.wood('#d8a25c'), tile: 6, wallColor: '#cfe0ff', trim: '#ffffff', trimY: 0.6, w: 30, d: 22, lights: 1 }), light: 'warm' };
  bedroom.group.add(at(windowPane(5, 4.4), 2, 7.6, -5.85), at(bookshelf(4, 6), -12, 0, -5), at(rug(9, 6, '#ffd0df'), 1, 0, 2.5), at(door('', '#b9783f'), 9, 0, -5.9), at(sign(['NO', 'PEPPER', 'ZONE'], 2.8, 3.4, { bg: '#ffcf3f', fg: '#3a2a00' }), -4.5, 8.4, -5.85));
  const R_bed = tog(bedroom, at(bed('#4f8fe8'), -6, 0, -1.4), true);
  const clutter = grp(at(couchStack(2), -11, 0, -3.4), at(couchStack(5, 3), 12.5, 0, -3), at(fridge(), 6, 0, -3.8, -0.2), at(tvBox('#ff8a5a'), 2.4, 0, -4.4), at(tvBox('#c7ff7a'), 2.4, 2.25, -4.4, 0.15), at(tvBox('#7fd0ff'), -1.2, 0, -4.6, -0.2), at(chair('#f2b01e'), 7.5, 0, 1.5, -0.5), at(chair('#2b7de0'), -9.5, 0, 2.5, 0.6), at(sofa('#2f9e55'), -1, 0, -3.2));
  tog(bedroom, clutter, false);
  const R = { james: mk(bedroom, 'james'), mom: mk(bedroom, 'mom'), sp: makeSparkles(bedroom.group, 4), sp2: makeSparkles(bedroom.group, 8), puff: makePuff(bedroom.group), bulb: makeBulb(bedroom.group) };
  const R_tissue = held(R.james, tissueBox(), 'R', [0, -0.4, 0.5]);

  // Owen's house: nearly empty, faint marks on the wall where the furniture used to be
  const owens = { group: room({ floorTex: TEX.wood('#c49360'), tile: 6, wallColor: '#ece0c8', trim: '#ffffff', trimY: 0.6, w: 34, d: 24, lights: 1 }), light: 'warm' };
  owens.group.add(at(box(7.4, 3.6, 0.04, '#dccdae'), -6, 1.9, -5.97), at(box(2.6, 2, 0.04, '#dccdae'), 3, 7.6, -5.97), at(box(4.4, 6.4, 0.04, '#dccdae'), -13, 3.3, -5.97),
    at(sign(['HOME', 'SWEET'], 3, 2.2, { bg: '#fff', fg: '#e8632b', border: '#b9783f' }), -6, 8.8, -5.85), at(door('', '#2f8fe6'), 9, 0, -5.9), at(windowPane(4, 3.6), 2, 7.6, -5.85));
  const O_chair = tog(owens, at(chair('#2e9e59'), 0, 0, -1.6), false);
  const O_couch = tog(owens, at(sofa('#c45a8a'), -6, 0, -3.6), false);
  const O = { owen: mk(owens, 'owen'), james: mk(owens, 'james'), mon: mk(owens, 'monster'), sp: makeSparkles(owens.group, 6), sp2: makeSparkles(owens.group, 10), puff: makePuff(owens.group), puff2: makePuff(owens.group, 11) };
  const O_tissue = held(O.owen, tissueBox(), 'R', [0, -0.4, 0.5]), O_pepM = held(O.mon, pepper(), 'R', [0, -0.5, 0.3]), O_pepO = held(O.owen, pepper(), 'R', [0, -0.5, 0.3]);

  const show = (...o) => o.forEach(x => { x.visible = true; });

  // ───────────────────────── shots ─────────────────────────
  // HOOK
  shot({ line: 'In this town,', set: living, sfx: [['whoosh', 0]], cam: { pos: [0.5, 4.2, 17], look: [0.5, 4.4, -2], fov: 60, blur: 0.12, push: 0.03 },
    act(lt, c) { L.dad.reset().place(-3, -3.4, 0.2).sit(1.75).setFace('smile').idle(c.t).lookAt(6, -1.8); L.mom.reset().place(-11 + lt * 6, 1.5, Math.PI / 2).walk(c.t).setFace('grin'); show(L.momBox); L.mom.pose({ aR: [70, -5] }); } });
  shot({ line: 'every time you sneeze,', set: living, sfx: [['pop', 'sneeze', 0.7]], cam: frame(-3, -3.4, { size: 'medium', y: 0.25, side: -12 }),
    act(lt, c) { L.dad.reset().place(-3, -3.4, 0.2).sit(1.75).setFace('neutral').idle(c.t); sneeze(L.dad, lt, c.w('sneeze')); if (lt > c.w('sneeze') + 0.5) L.dad.setFace('sus'); L.puff.at(lt - c.w('sneeze'), nose(L.dad)); } });
  shot({ line: 'something from your house disappears.', set: living, sfx: [['sparkle', 'disappears'], ['pop', 'disappears']], cam: { pos: [1.2, 3.8, 15], look: [1.4, 4.2, -2.5], fov: 60, blur: 0.2 },
    act(lt, c) { const t0 = c.w('disappears'); L.dad.reset().place(-3, -3.4, 0.3).sit(1.75).setFace(lt < t0 ? 'smile' : 'shock').idle(c.t); if (lt >= t0) L.dad.lookAt(6, -1.8).pose({ aL: [60, 40], aR: [60, 40] }, remap(lt, t0, t0 + 0.15));
      poof(L_tv, lt - t0); L.sp.at(lt - t0, [6, 0, -1.8], 0.9); L.puff.at(lt - t0, [6, 1.5, -1.6]); } });
  shot({ line: 'And it all lands under the bridge.', set: bridge, sfx: [['fall', 'lands'], ['thud', 'bridge']], cam: { pos: [-2, 3.2, 26], look: [-1, 6.2, -2], fov: 60, blur: 0.08, push: 0.02 },
    act(lt, c) { const t1 = c.w('bridge'); drop(B_tv, lt, c.w('lands') - 0.2, t1, 16); B.puff.at(lt - t1, [-8, 0, 1]); B.mon.reset().place(1, 0.5, -0.15).pose('open').setFace(lt < t1 ? 'smile' : 'grin').idle(c.t); if (lt > t1) B.mon.pose('cheer', remap(lt, t1, t1 + 0.2)).jump(remap(lt, t1, t1 + 0.4), 0.4); } });
  // WORLD
  shot({ line: "That's why nobody here sells pepper.", set: street, cam: { pos: [3.2, 3.4, 13.5], look: [2.8, 4.4, -1], fov: 60, blur: 0.3 },
    act(lt, c) { S.clerk.reset().place(0.6, 2.3, 0.2).pose('hips').setFace(lt < c.w('sells') ? 'smile' : 'sus').idle(c.t); if (lt > c.w('nobody')) S.clerk.head.rotation.y += Math.sin(c.t * 9) * 0.3; } });
  // NARRATOR
  shot({ line: 'I was pretty careful.', set: bedroom, cam: frame(2, 1.5, { size: 'medium', side: 10 }),
    act(lt, c) { R.james.reset().place(2, 1.5, 0.1).pose({ aR: [70, -4], aL: [38, 52] }).setFace(lt < c.w('careful') ? 'smile' : 'grin').idle(c.t); show(R_tissue); } });
  // FRIEND + sight gag
  shot({ line: 'But my best friend Owen had allergies.', set: owens, cam: frame(-1, 1, { size: 'close', side: -14 }),
    act(lt, c) { const t = c.w('allergies'); O.owen.reset().place(-1, 1, -0.1).setFace(lt < c.w('owen') ? 'grin' : 'worried').idle(c.t); O.owen.pose({ aR: [150, -32] }, remap(lt, t - 0.3, t)); if (lt > t) { O.owen.head.rotation.x += Math.sin(c.t * 22) * 0.06; O.owen.setFace('sad'); } show(O_tissue); } });
  shot({ line: 'His house was down to one chair.', set: owens, cam: { pos: [1.5, 3.6, 15], look: [0, 3.6, -2], fov: 60, blur: 0.12, push: 0.03 },
    act(lt, c) { show(O_chair); O.owen.reset().place(0, -1.3, 0).sit(1.5).setFace(lt < c.w('one') ? 'smile' : 'sad').idle(c.t, 0.6); if (lt > c.w('chair')) O.owen.pose('shrug', remap(lt, c.w('chair'), c.w('chair') + 0.2)); } });
  // FOIL
  shot({ line: 'Meanwhile, the bridge monster had everything.', set: bridge, cam: { pos: [-1, 1.4, 17], look: [0.5, 8.4, -2], fov: 62, blur: 0.15, push: 0.02, to: { pos: [2, 1.4, 17] }, ease: 'lin' },
    act(lt, c) { B.mon.reset().place(1, 0.5, -0.1).pose(lt < c.w('everything') ? 'hips' : 'cheer').setFace(lt < c.w('everything') ? 'smug' : 'laugh').idle(c.t); } });
  shot({ line: 'Forty couches.', set: bridge, cam: { pos: [-10.5, 3.6, 7], look: [-14, 5, -2.5], fov: 60, blur: 0.35 }, act(lt, c) { } });
  shot({ line: 'Six hundred spoons.', set: bridge, cam: { pos: [9.8, 3.2, 6], look: [11, 2.4, -2.2], fov: 60, blur: 0.4 }, act(lt, c) { } });
  shot({ line: "And my grandma's fridge.", set: bridge, cam: { pos: [3.4, 5, 10], look: [4.2, 5.4, -3], fov: 60, blur: 0.3 },
    act(lt, c) { B.mon.reset().place(1.8, -2.8, 0.75).pose({ aL: [86, -18], aR: [70, 30] }).setFace('love').idle(c.t); B.mon.head.rotation.z = 0.2; } });
  // INCITING
  shot({ line: 'Then my nose started itching.', set: bedroom, cam: frame(2, 1.5, { size: 'close', side: -12 }),
    act(lt, c) { const t = c.w('itching'); R.james.reset().place(2, 1.5, -0.1).setFace(lt < t ? 'neutral' : 'worried').idle(c.t); if (lt > c.w('nose')) { R.james.pose({ aR: [150, -30] }, remap(lt, c.w('nose'), c.w('nose') + 0.2)); R.james.armR.rotation.z += Math.sin(c.t * 18) * 0.08; } sneeze(R.james, lt, c.d); } });
  shot({ line: 'Achoo! My bed was gone.', set: bedroom, sfx: [['sparkle', 0], ['pop', 0, 0.6]], cam: { pos: [-1, 3.8, 15], look: [-2, 3.6, -1], fov: 60, blur: 0.15 },
    act(lt, c) { R.james.reset().place(1.4, 1.8, -0.35).setFace(lt < c.w('gone') ? 'shock' : 'shock').idle(c.t); sneeze(R.james, lt, 0); if (lt > c.w('bed')) R.james.lookAt(-6, -1).pose({ aL: [60, 40], aR: [60, 40] }); poof(R_bed, lt - 0.05); R.sp.at(lt - 0.05, [-6, 0, -1], 1.2); R.puff.at(lt - 0.05, [-6, 1.5, 0]); } });
  shot({ line: "Mom yelled, James, where's your bed?", set: bedroom, cam: frame(8.4, -3.6, { size: 'close', side: -16 }),
    act(lt, c) { R.mom.reset().place(8.4, -3.6, -0.3).pose(lt < c.w('james') ? 'hips' : 'open').setFace(lt < c.w('yelled') ? 'mad' : lt < c.w('james') ? 'angry' : 'say').talk(c.t).idle(c.t); } });
  // IDEA
  shot({ line: "And that's when I had an idea.", set: bedroom, sfx: [['ding', 'idea']], cam: frame(2, 1.5, { size: 'close', side: 14, low: 0.2 }),
    act(lt, c) { R.james.reset().place(2, 1.5, 0.15).setFace(lt < c.w('idea') ? 'neutral' : 'grin').idle(c.t); R.bulb.at(lt - c.w('idea'), R.james); } });
  shot({ line: "I'd take it back from the bridge.", set: bridge, sfx: [['whoosh', 0, 0.6]], cam: { pos: [-11, 3.2, 17], look: [-8, 4.2, 1], fov: 60, blur: 0.12, push: 0, to: { pos: [-3, 3.2, 17], look: [-1, 4.2, 1] }, ease: 'lin' },
    act(lt, c) { show(B_bed); B.james.reset().place(-11 + lt * 4, 3.5, Math.PI / 2).walk(c.t, 1.1).setFace('smirk'); } });
  // TWO FAILED TRIES
  shot({ line: 'First, I tried sneaking in.', set: bridge, cam: frame(-9, 1.8, { size: 'full', side: 32 }),
    act(lt, c) { show(B_bed); B.james.reset().place(-10 + lt * 1.3, 1.8, Math.PI / 2 - 0.3).walk(c.t, 0.6, 22).pose({ aL: [30, -20], aR: [30, -20], head: [-4, -40, 0], lean: [14, 0] }, 0.8).setFace('smirk'); } });
  shot({ line: 'He sat on me.', set: bridge, sfx: [['thud', 'sat']], cam: { pos: [9.6, 9.5, 12.5], look: [8, 2.4, 1.8], fov: 60, blur: 0.15 },
    act(lt, c) { show(B_bed); const t = c.w('sat'), k = E.in(remap(lt, 0, t));
      B.james.reset().place(8, -0.4, 0, 0.5).setFace(lt < t ? 'shock' : 'cry'); B.james.root.rotation.set(-Math.PI / 2, Math.PI, 0, 'YXZ'); B.james.pose({ aL: [0, 60], aR: [0, 60] });
      B.mon.reset().place(8, 0.6, 0, 7 * (1 - k)).sit(0.1).setFace(lt < t ? 'smug' : 'smug').idle(c.t, 0.5); B.puff.at(lt - t, [8, 0, 3]); } });
  shot({ line: 'So I asked nicely.', set: bridge, cam: frame(-2.5, 2.4, { size: 'close', side: 16 }),
    act(lt, c) { show(B_bed); B.james.reset().place(-2.5, 2.4, 0.5).pose('open').setFace(lt < c.w('asked') ? 'smile' : 'say').talk(c.t).idle(c.t); if (lt > c.w('nicely')) B.james.setFace('cute'); } });
  shot({ line: 'He just growled.', set: bridge, sfx: [['thud', 'growled', 0.5]], cam: frame(2, 0, { size: 'face', h: 1.6, side: -14, push: 0.06 }),
    act(lt, c) { show(B_bed); B.mon.reset().place(2, 0, -0.2).pose('hips').setFace(lt < c.w('growled') ? 'mad' : 'angry').idle(c.t, 0.5); if (lt > c.w('growled')) B.mon.head.rotation.z += Math.sin(c.t * 30) * 0.03; } });
  // ACCIDENTAL SUCCESS
  shot({ line: 'Then he sniffled.', set: bridge, cam: frame(2, 0, { size: 'close', h: 1.6, side: 18 }),
    act(lt, c) { show(B_bed); B.mon.reset().place(2, 0, 0.25).pose({ aR: [150, -32] }, remap(lt, c.w('sniffled') - 0.2, c.w('sniffled'))).setFace(lt < c.w('sniffled') ? 'mad' : 'sad').idle(c.t); if (lt > c.w('sniffled')) B.mon.head.rotation.x += Math.sin(c.t * 22) * 0.05; } });
  shot({ line: 'So I gave him a tissue.', set: bridge, sfx: [['pop', 'tissue', 0.6]], cam: { pos: [0.2, 4.6, 14], look: [0.2, 5.2, 0.5], fov: 60, blur: 0.3 },
    act(lt, c) { show(B_bed); const t = c.w('tissue'); B.james.reset().place(-2.4, 2.4, 0.55).pose({ aR: [90, -10] }, remap(lt, c.w('gave') - 0.1, c.w('gave') + 0.15)).setFace('smile').idle(c.t); show(B_tissue);
      B.mon.reset().place(2.6, 0.2, -0.55).setFace(lt < t ? 'sad' : 'wow').idle(c.t); } });
  shot({ line: 'He sneezed,', set: bridge, sfx: [['sparkle', 'sneezed'], ['pop', 'sneezed', 0.6]], cam: { pos: [0.5, 4.2, 20], look: [0, 6.4, -1], fov: 60, blur: 0.12, push: 0.05 },
    act(lt, c) { const t = c.w('sneezed') + 0.05; show(B_bed); B.mon.reset().place(2.6, 0.4, -0.3).setFace('wow').idle(c.t); sneeze(B.mon, lt, t); B.sp.at(lt - t, [2.6, 0, 0.4], 1.5); B.puff.at(lt - t, nose(B.mon));
      poof(B_bed, lt - t - 0.12); B.sp2.at(lt - t - 0.12, [-4, 0, -0.6], 1.1); B.james.reset().place(-1.8, 3.2, 0.5).setFace(lt < t ? 'smile' : 'shock').idle(c.t); } });
  shot({ line: 'and my bed flew home.', set: bedroom, sfx: [['fall', 'bed'], ['sparkle', 'home'], ['thud', 'home']], cam: { pos: [-1, 4.2, 15], look: [-2.5, 3.6, -1], fov: 60, blur: 0.12 },
    act(lt, c) { const t1 = c.w('home') + 0.05; drop(R_bed, lt, c.w('bed') - 0.15, t1, 16); R.sp.at(lt - t1, [-6, 0, -1], 1.2); R.puff.at(lt - t1, [-6, 0.4, 1]);
      R.mom.reset().place(0.6, 1.2, -0.4).setFace(lt < t1 ? 'neutral' : 'shock').idle(c.t).lookAt(-6, -1); if (lt > t1) R.mom.pose({ aL: [60, 40], aR: [60, 40] }); } });
  // MONTAGE
  shot({ line: 'So I started bringing him soup,', set: bridge, sfx: [['pop', 'soup', 0.6]], cam: { pos: [-4.5, 4.4, 12], look: [0.4, 5.4, 0.5], fov: 60, blur: 0.35, roll: -5 },
    act(lt, c) { B.james.reset().place(-1.8, 2.4, 0.6).pose({ aR: [88, -8] }, remap(lt, c.w('bringing'), c.w('bringing') + 0.2)).setFace('grin').idle(c.t); show(B_soup); B.mon.reset().place(2.6, 0.4, -0.6).setFace(lt < c.w('soup') ? 'sad' : 'happy').idle(c.t); } });
  shot({ line: 'warm socks,', set: bridge, cam: frame(2.6, 0.4, { size: 'close', h: 1.6, side: -20 }),
    act(lt, c) { B.mon.reset().place(2.6, 0.4, -0.2).pose({ aR: [62, -12] }).setFace('love').idle(c.t); show(B_socks); } });
  shot({ line: 'and pepper.', set: bridge, sfx: [['sparkle', 'pepper'], ['pop', 'pepper', 0.6]], cam: frame(2.6, 0.4, { size: 'medium', h: 1.6, side: 16 }),
    act(lt, c) { const t = c.w('pepper') + 0.3; B.mon.reset().place(2.6, 0.4, 0.2).pose({ aR: [100, -18] }).setFace('wow').idle(c.t); show(B_pep); if (sneeze(B.mon, lt, t)) B.mon.pose({ aR: [100, -18] }, 0.6); B.sp.at(lt - t, [2.6, 0, 0.6], 1.5); B.puff.at(lt - t, nose(B.mon)); if (lt > t + 0.5) B.mon.setFace('grin'); } });
  shot({ line: 'By lunchtime my room was as full as his bridge.', set: bedroom, sfx: [['pop', 'full', 0.6]], cam: { pos: [1.5, 4.4, 17], look: [1.5, 4.6, -1.5], fov: 60, blur: 0.12, push: 0.04 },
    act(lt, c) { show(clutter); R.james.reset().place(1.6, 2.4, 0).pose(lt < c.w('full') ? 'open' : 'cheer').setFace(lt < c.w('room') ? 'smile' : 'grin').idle(c.t); } });
  // TURN
  shot({ line: 'But then I saw Owen,', set: owens, sfx: [['sad', 'owen', 0.7]], cam: { pos: [0, 5, 21], look: [0, 4.6, -3], fov: 60, blur: 0.05, push: 0.02 },
    act(lt, c) { O.owen.reset().place(0, -1.4, 0).sit(0).pose('slump', 0.6).setFace('sad').idle(c.t, 0.4); } });
  shot({ line: 'alone in his empty house.', set: owens, cam: frame(0, -1.4, { size: 'medium', y: -1.5, side: 22, low: 0.3 }),
    act(lt, c) { O.owen.reset().place(0, -1.4, 0.3).sit(0).pose('slump', 0.6).setFace(lt < c.w('empty') ? 'sad' : 'cry').idle(c.t, 0.4); } });
  shot({ line: "I realized I'd spent all day on my stuff", set: bedroom, cam: frame(1.6, 2.4, { size: 'close', side: -12 }),
    act(lt, c) { show(clutter); R.james.reset().place(1.6, 2.4, -0.15).setFace(lt < c.w('spent') ? 'neutral' : lt < c.w('stuff') ? 'worried' : 'sad').idle(c.t, 0.6); } });
  shot({ line: 'and ignored my best friend.', set: bedroom, sfx: [['sad', 'friend', 0.6]], cam: frame(1.6, 2.4, { size: 'face', side: 10, push: 0.05 }),
    act(lt, c) { show(clutter); R.james.reset().place(1.6, 2.4, 0.15).pose('slump', 0.5).setFace(lt < c.w('ignored') ? 'sad' : 'cry').idle(c.t, 0.4); } });
  // MAKING IT RIGHT
  shot({ line: "So I brought the monster to Owen's.", set: owens, sfx: [['thud', 'monster', 0.6]], cam: { pos: [2, 3.4, 19], look: [3, 5.4, -2], fov: 60, blur: 0.1, push: 0.03 },
    act(lt, c) { const k = remap(lt, 0, c.d * 0.8); O.mon.reset().place(9 - k * 3.6, -4.8 + k * 3, -0.6).walk(c.t, 0.8).setFace('smile'); O.mon.hip.rotation.x += 0.25 * (1 - k); O.james.reset().place(4 - k * 2.6, 0.6 + k * 1.4, -1).walk(c.t, 1).setFace('grin');
      O.owen.reset().place(-3, -1.4, 0.5).sit(0).setFace(lt < c.w('monster') ? 'sad' : 'shock').idle(c.t); } });
  shot({ line: 'I asked, can you sneeze for my best friend?', set: owens, cam: frame(1.4, 2, { size: 'close', side: 16 }),
    act(lt, c) { O.james.reset().place(1.4, 2, 0.3).pose(lt < c.w('friend') ? 'open' : 'point').setFace(lt < c.w('can') ? 'smile' : lt < c.w('friend') ? 'say' : 'cute').talk(c.t).idle(c.t); if (lt > c.w('friend')) O.james.root.rotation.y = -0.6; } });
  shot({ line: 'The monster sniffed the pepper.', set: owens, cam: frame(5.4, -1.8, { size: 'close', h: 1.6, side: -10, low: 0.3 }),
    act(lt, c) { O.mon.reset().place(5.4, -1.8, -0.2).pose({ aR: [100, -18] }, remap(lt, c.w('sniffed') - 0.15, c.w('sniffed'))).setFace(lt < c.w('sniffed') ? 'smile' : 'wow').idle(c.t); show(O_pepM); if (lt > c.w('pepper')) O.mon.head.rotation.x -= 0.4 * remap(lt, c.w('pepper'), c.w('pepper') + 0.3); } });
  shot({ line: "Achoo! Owen's couch came back.", set: owens, sfx: [['pop', 0, 0.6], ['sparkle', 'couch']], cam: { pos: [-1.5, 3.4, 13], look: [-3, 4.0, -2], fov: 60, blur: 0.15 },
    act(lt, c) { const t = c.w('couch'); poof(O_couch, lt - t, false); O.sp.at(lt - t, [-6, 0, -3.2], 1.1); O.puff.at(lt - t, [-6, 0.6, -2]); O.sp2.at(lt - t - 0.1, [-3, 0, -1.2], 0.8);
      O.owen.reset().place(-3, -0.6, 0.25).sit(0).setFace(lt < t ? 'shock' : lt < t + 0.45 ? 'scream' : 'grin').idle(c.t); if (lt > t + 0.45) O.owen.pose('cheer', remap(lt, t + 0.45, t + 0.6)); } });
  shot({ line: 'Achoo! His chair too.', set: owens, sfx: [['pop', 0, 0.6], ['sparkle', 'chair'], ['boing', 'chair', 0.6]], cam: frame(0, -1.2, { size: 'full', side: 14 }),
    act(lt, c) { const t = c.w('chair'); show(O_couch); poof(O_chair, lt - t, false); O.sp.at(lt - t, [0, 0, -1.2], 1); O.puff2.at(lt - t, [0, 0.5, -0.2]);
      O.owen.reset(); if (lt < t) O.owen.place(0, -1.2, 0).sit(0).setFace('grin'); else { O.owen.place(0, -1.2, 0).sit(1.5).jump(remap(lt, t, t + 0.3), 1).setFace(lt < t + 0.45 ? 'scream' : 'laugh'); if (lt > t + 0.45) O.owen.pose({ aL: [168, 22], aR: [168, 22] }); } O.owen.idle(c.t); } });
  // RETURN
  shot({ line: 'Owen handed me the pepper. Achoo!', set: owens, sfx: [['sparkle', 'achoo'], ['pop', 'achoo', 0.6]], cam: { pos: [0, 4.4, 13], look: [0, 5.0, 0.4], fov: 60, blur: 0.3 },
    act(lt, c) { const t = c.w('achoo'); show(O_couch, O_chair); O.owen.reset().place(-2.4, 0.4, 0.5).pose({ aR: [88, -8] }, remap(lt, c.w('handed') - 0.1, c.w('handed') + 0.15)).setFace(lt < t ? 'smile' : 'shock').idle(c.t); if (lt < c.w('pepper') + 0.2) show(O_pepO);
      O.james.reset().place(2.4, 1, -0.5).setFace('smile').idle(c.t); if (lt > c.w('pepper')) O.james.pose({ aR: [150, -30] }, remap(lt, c.w('pepper'), c.w('pepper') + 0.2)); sneeze(O.james, lt, t); O.sp.at(lt - t, [2.4, 0, 1], 1); O.puff.at(lt - t, nose(O.james)); } });
  shot({ line: 'My bed went back to the bridge.', set: bridge, sfx: [['fall', 'bed'], ['thud', 'bridge']], cam: { pos: [-1, 3.6, 18], look: [-1, 4.8, -1], fov: 60, blur: 0.12 },
    act(lt, c) { const t1 = c.w('bridge'); drop(B_bed, lt, c.w('bed'), t1, 16); B.puff.at(lt - t1, [-4, 0.4, 0.4]);
      B.mon.reset().place(1.6, 0.6, -0.3).setFace(lt < t1 ? 'smile' : 'laugh').idle(c.t); if (lt > t1) B.mon.pose('cheer', remap(lt, t1, t1 + 0.2)); } });
  // BUTTON
  shot({ line: 'Owen said, sleep over.', set: owens, cam: frame(-1, 1, { size: 'close', side: -14 }),
    act(lt, c) { show(O_couch, O_chair); O.owen.reset().place(-1, 1, -0.1).pose(lt < c.w('sleep') ? 'idle' : 'open').setFace(lt < c.w('sleep') ? 'smile' : 'say').talk(c.t).idle(c.t); } });
  shot({ line: 'But I get the chair.', set: owens, sfx: [['pop', 'chair', 0.6]], cam: frame(0, -1.2, { size: 'full', y: 0.25, side: 26 }),
    act(lt, c) { show(O_couch, O_chair); O.owen.reset().place(0, -1.2, 0).sit(1.5).setFace(lt < c.w('chair') ? 'say' : 'smug').idle(c.t); if (lt > c.w('chair')) O.owen.pose({ aL: [-10, 40], aR: [-10, 40], head: [0, 0, 10] }); } });
  shot({ line: 'I stared at him.', set: owens, cam: frame(1.6, 2, { size: 'face', side: 6, push: 0.07 }),
    act(lt, c) { show(O_couch, O_chair); O.james.reset().place(1.6, 2, -0.1).setFace('sus').idle(c.t, 0.3); } });
  shot({ line: 'Best sneeze ever.', set: owens, sfx: [['pop', 'best', 0.5]], cam: frame(1.6, 2, { size: 'close', side: -20, low: 0.4 }),
    act(lt, c) { show(O_couch, O_chair); O.james.reset().place(1.6, 2, 0.2).setFace(lt < c.w('sneeze') ? 'laugh' : 'grin').idle(c.t); if (lt < c.w('sneeze')) O.james.hip.position.y += Math.abs(Math.sin(c.t * 14)) * 0.08;
      O.owen.reset().place(-2.2, -1.2, 0.5).sit(1.5).setFace('laugh').idle(c.t); O.owen.hip.position.y += Math.abs(Math.sin(c.t * 14 + 1)) * 0.08; } });
});
