# Red Apple · TF-10K Turbofan Test Cell

Two single-file three.js + Web Audio apps built around the same simulated engine, the TF-10K, a fictional 10,000 lbf high-bypass turbofan.

**`index.html` — Red Apple, an unmanned fighter flight game.** Choose Take off or Land: the takeoff mission starts lined up with the parking brake set, with a weight-on-wheels rotation model (Vr about 124 kt, liftoff about 140 kt, tail strike past 13.5°), callouts, gear lever lock on the ground, and touch-and-go after any landing. Take off and land a 12,800 lb canard-delta unmanned fighter (10 m cranked delta wing, canards, twin canted tails, 10,000 lbf TF-10K) at one of four airfields, chosen on the title screen or on the moving map. Flight model in the style of desktop sims: elevator, aileron and rudder moments against static and directional stability and damping, sideslip with adverse yaw and dihedral effect, ramped yoke, trim with fly-by-wire style auto-trim and auto-rudder, angle-of-attack stall, three oleo-strut landing gear legs modelled as spring-dampers (bounces, de-rotation, struts bottoming, wingtip and tail clearance, grass and pavement friction), autopilot with IAS, HDG, ALT and V/S selectors plus A/THR and APP (ILS autoland with flare and rollout), flaps, gear, spoilers and brakes; ILS glideslope and localizer, PAPI, approach lights; calm, crosswind and gusty conditions; scoring on sink rate, touchdown point, centreline, speed and bank. Cameras include a 3D virtual cockpit with canopy, HUD combiner, three live glass displays (PFD, engine, nav), a moving side-stick and pedals, and mouse head-look. Every control works from inside the cockpit: a glareshield autopilot panel with clickable SPD/HDG/ALT/V/S windows and mode buttons, a gear lever with lights, a flap lever, speed-brake, brake and assist switches, and a throttle you grab and drag. The right display shows a live nose camera that tracks the destination runway, and the cockpit is laid out for a fighter-style over-the-nose view with an approach head tilt and a hold-X glance at the displays. Keyboard, mouse-dragged 3D thrust lever, or touch stick.

**`testcell.html` — TF-10K turbofan test cell.** Cutaway 3D engine with FADEC-style auto start, Boeing-style 3D thrust lever, fuel cutoff and spool-down; live EICAS gauges, fuel consumption; numbered hotspots explaining each component; CFM56-style synthesized sound.

On phones and tablets the game switches to a full-screen touch layout: a touch stick, a vertical throttle with TO/GA, CLB and IDLE, a button bar for flaps, gear, brakes, speed brake and the autopilot drawer, a rotate-to-landscape prompt, safe-area padding and a lighter graphics preset.

The flight model is 6-DOF with a quaternion attitude, so the H-20 can roll, fly inverted and loop. Its fighter-style fly-by-wire commands roll rate (up to about 230°/s), limits load to +9/−3 g and holds bank and flight path with the stick centred; landing, takeoff and autoland behave as before. Full aerobatic manoeuvres are possible.

Open either file in a browser or serve the folder with any static host. Deployed with Vercel.

Made by Baris Hiz.

## Aircraft

The aircraft is a fan-made likeness of the Kızılelma unmanned fighter, shaped from public photos on Wikimedia Commons: chined diamond-section body, side intakes under the chine, canards, twin canted fins, no canopy, two-tone grey finish, with no name, flag or national markings. It is not affiliated with or endorsed by the aircraft's maker. Above about 90 % thrust an afterburner flame with shock diamonds lights (visual only).

## Istanbul scenery

The world is a 72 km square of Istanbul centred on 41.07 N, 29.00 E, draped over real terrain heights (airports are levelled to their runway elevation). Runways use real threshold coordinates: Istanbul Airport (IST 16R/34L), Sabiha Gökçen (SAW 06L/24R), Atatürk (ISL 05/23) and Samandıra (SMD 18/36). The three Bosphorus bridges are built to their real spans and tower heights and are solid (you can fly under the decks). Golden Horn bridges, the main mosques, Galata Tower, the Maiden's Tower, the Çamlıca tower, palaces and about 50 skyscrapers stand at their real positions, and city blocks are planted wherever the imagery shows built-up land.

The game loads photo textures from `assets/` and falls back to generated scenery if they are missing.

- Ground imagery: Sentinel-2 cloudless 2017 by EOX IT Services GmbH (https://s2maps.eu), contains modified Copernicus Sentinel data 2017, licensed CC BY 4.0.
- Terrain heights: Mapzen/AWS terrain tiles (SRTM and other open data).
- Runway, bridge and landmark positions: © OpenStreetMap contributors (ODbL).
- Sky panorama and surface photos (grass, asphalt, concrete, corrugated metal, aerial ground): Poly Haven (https://polyhaven.com), CC0.
