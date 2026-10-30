# Box Fort (hide-and-seek)

![Box Fort: the hiders seal the fort with boxes, then a seeker leans the ramp on the wall and climbs in](poster.gif)

**Play it:** run it locally (below). There is no hosted copy yet.

**Source clip:** a Korean short about OpenAI's 2019 hide-and-seek research ("Emergent Tool Use From Multi-Agent
Autocurricula"). The clip is OpenAI footage, so it is **not** in this repository and the poster shows only the
game, not the usual video-and-game side by side. The game borrows the idea (two teams, boxes, a ramp, locks, a
fort room) and the look (pale tiles, white walls, a grey block city, warm yellow props, glowing red and cyan
agents). The arena, rules and code are new.

**Modes** (title screen): `1` play a hider · `2` play a seeker · `3` watch the AIs play each other.

**Controls:** WASD / arrows move · hold Space / A grab and drag · E / X lock or unlock · R / Y turn the held ramp ·
H AI panel · Enter play again · Esc menu. A box carries whoever stands on it, so you can also ride one.

**Rules:** 16 s of preparation (seekers frozen), then 40 s of hunt. Each second of the hunt, seekers score if any
seeker sees any hider, otherwise hiders score. Walls and boxes are 1.1 m high and block sight. Anyone can move a
free prop; a locked prop can only be unlocked by the team that locked it.

## Who decides: Jev or the local brain

Every character you do not control has a brain that picks a plan every ~1 to 1.5 s, and a body that carries it out
(walk with A*, push and drag props, stage a box and pull it into a doorway, lean the ramp on a wall, climb it).

- **Jev** (TypeSafe's System One decision model) when the server has a key. Each team sends one request: the
  world as JSON (positions, props, doors, the last plans, what earlier rounds taught) and one `choice` question
  per AI character whose options are the plans available right now (`block_A__box1`, `lock_ramp`, `climb`,
  `chase__h2`, ...), plus a `score` question on how likely a hider is to be seen in the next 10 s. Jev answers with
  a choice and a probability for every option; the panel shows the top three per character.
- **The local brain** when there is no key, or when Jev fails: the same options, scored by hand-written utilities,
  turned into probabilities with a softmax. It is a stand-in so the game always works, not the point.

Between rounds both brains get the same memory: when the seekers broke a sealed fort with the ramp, the next
rounds weigh locking or hiding the ramp higher (and Jev reads the earlier rounds in its state). In testing with the
local brain this gives the arms race of the clip in a few rounds: an open room, then a sealed fort, then the ramp
over the wall, then a locked ramp. Rounds differ with the seed; nothing is scripted to happen at a given time.

## Run it, with or without a Jev key

```bash
cd gallery/hide-and-seek/game
node server.mjs                       # http://127.0.0.1:8000 (local brain)
```

To use Jev, put the key in `game/.env` (copy `.env.example`; `.env` is git-ignored) or in the environment:

```bash
JEV_API_KEY=your-key node server.mjs
```

On Vercel, deploy the `game/` folder and set `JEV_API_KEY` in the project's environment variables; `api/jev.mjs`
is the serverless relay. Optionally set `JEV_ACCESS_CODE`: the title screen then asks for it, so a public page
cannot spend your key. The browser never sees the key; the relay checks every request's shape, forwards it to
`https://api.typesafe.ai/v1/systemone` with model `jev-latest`, and limits each IP to 150 requests a minute.
The bottom-left corner of the game says which brain is playing.

URL parameters: `?mode=hider|seeker|watch`, `?autostart` (= watch), `?seed=N`, `?brain=local`, `?jev=URL`
(another relay), `?prep=s&hunt=s`, `?panel=0`, `?fresh` (forget earlier rounds), and for testing `?timescale=N`,
`?manual`, `?lesson=N`, `?debug`.

## Assets

None from fal or any other generator: everything is Three.js geometry (boxes, an extruded wedge, capsules,
instanced blocks), one canvas texture for the tiles, and tiny Web Audio blips. 0 fal calls, 0 USD.

## How it was checked

- Played headless in Chromium (software WebGL, so about 5 fps there; the frame rate on a real GPU was not
  measured): zero console errors in every run.
- Full rounds with the local brain on seeds 1 to 5: the hiders sealed both doorways before the hunt on every seed
  (in 5 to 14 s); the seekers fetched the ramp, leaned it on the fort wall and climbed in on seeds 1, 3 and 5;
  with the ramp lesson the hiders locked the ramp and won 38:0 on seed 1.
- The Jev path end to end with a fake System One server: the relay accepted the requests (3.7 KB, three
  questions), forwarded them with the bearer key, and the game applied the answers ("Jev 연결됨" in the corner).
  It has **not** been run against the real Jev API, because no key was available.
- `examples/plays/hide-and-seek.mjs` plays a hider with the keyboard: it drags box 1 into doorway A, locks it and
  hides in the corner (seed 3).
- Poster: seed 3, frames stepped with `?manual`, seconds 1 to 5 (fort) and 21 to 27 (ramp and climb).

## What differs from the clip

- Two hiders and two seekers on one fort room, not the research arenas; physics is a simple height field, so props
  slide on a grid instead of tumbling.
- No box surfing for the AI yet (a player can ride a box), and no physics glitches to exploit.
- The agents do not learn their movement from scratch like the research agents did: the brain picks among plans and
  the body executes them. What carries over between rounds is a small memory of which defense was beaten.

**Code:** [`game/`](game/), written by Claude Code with Three.js only.
