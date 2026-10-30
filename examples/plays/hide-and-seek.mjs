// Box Fort (gallery/hide-and-seek): play a hider. Walk to the box by the fort, drag it into doorway A while the
// AI teammate seals doorway B, lock it with E, then hide in the far corner of the fort.
// Keyboard only (WASD + Space + E). It reads window.__game.state, like a player looking at the screen.
// Run: node record_play.mjs "http://127.0.0.1:8000/?mode=hider&seed=3&brain=local&fresh" hide-and-seek.mjs -o take.mp4 --seconds 24

const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

export async function play(page, { seconds, t0 }) {
  const k = page.keyboard;
  const state = () => page.evaluate(() => window.__game?.state);
  const end = t0 + seconds * 1000 - 150;
  const held = new Set();
  const press = async want => {
    for (const key of MOVE) {
      if (want.includes(key) && !held.has(key)) { await k.down(key); held.add(key); }
      if (!want.includes(key) && held.has(key)) { await k.up(key); held.delete(key); }
    }
  };
  // steer toward a point with the four movement keys, like a player with a keyboard
  const toward = (p, q, dead = 0.15) => [
    q.x - p.x > dead ? 'KeyD' : q.x - p.x < -dead ? 'KeyA' : null,
    q.z - p.z > dead ? 'KeyS' : q.z - p.z < -dead ? 'KeyW' : null,
  ].filter(Boolean);

  let s = await state();
  while (!s || !s.player) { await page.waitForTimeout(100); s = await state(); }
  const stage = { x: 6, z: 0.1 }, plug = s.plugs.A;
  let step = 'reach';
  while (Date.now() < end) {
    s = await state();
    if (!s || s.phase === 'end') break;
    const p = s.player, b = s.objects.find(o => o.id === 'box1');
    if (step === 'reach') {                     // stand on the far side of the box from the doorway
      const side = { x: b.x, z: b.z - 1.15 };
      await press(toward(p, side));
      if (Math.hypot(p.x - side.x, p.z - side.z) < 0.25) { await press([]); await k.down('Space'); step = 'push'; }
    } else if (step === 'push') {               // push it to the spot in front of doorway A
      const want = { x: stage.x - (b.x - p.x), z: stage.z - (b.z - p.z) };
      await press(toward(p, want, 0.05));
      if (Math.hypot(b.x - stage.x, b.z - stage.z) < 0.12) { await press([]); await k.up('Space'); step = 'around'; }
    } else if (step === 'around') {             // walk around it into the doorway, on the fort side
      // straight legs only (out to the side, up past the box, back in), so we never clip its corner
      const front = { x: b.x, z: b.z + 1.15 };
      const via = p.x < b.x + 1.3 && p.z < b.z + 1.0 ? { x: b.x + 1.5, z: p.z }
        : p.z < front.z - 0.1 ? { x: b.x + 1.5, z: front.z } : front;
      await press(toward(p, via, 0.08));
      if (Math.hypot(p.x - front.x, p.z - front.z) < 0.2) { await press([]); await k.down('Space'); step = 'pull'; }
    } else if (step === 'pull') {               // walk backwards into the fort, pulling the box into the gap
      await press(toward(b, plug, 0.04));
      if (Math.abs(b.z - plug.z) < 0.08) { await press([]); await k.up('Space'); await k.press('KeyE'); step = 'hide'; }
    } else {                                    // hide in the far corner
      await press(toward(p, { x: 9, z: 9 }));
    }
    await page.waitForTimeout(40);
  }
  await press([]);
  if (held.has('Space')) await k.up('Space');
}
