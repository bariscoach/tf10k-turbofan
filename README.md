# Hawk UAV Landing · TF-10K Turbofan Test Cell

Two single-file three.js + Web Audio apps built around the same simulated engine, the TF-10K, a fictional 10,000 lbf high-bypass turbofan.

**`index.html` — Hawk UAV landing trainer.** Land a 24,000 lb HALE drone (35 m wing, 9,000 lbf derated TF-10K-D) at one of four airfields, chosen on the title screen or on the moving map. Point-mass flight model with angle-of-attack stall, natural pitch and roll stability, flaps, gear, spoilers and brakes; ILS glideslope and localizer, PAPI, approach lights; calm, crosswind and gusty conditions; scoring on sink rate, touchdown point, centreline, speed and bank. Keyboard, mouse-dragged 3D thrust lever, or touch stick.

**`testcell.html` — TF-10K turbofan test cell.** Cutaway 3D engine with FADEC-style auto start, Boeing-style 3D thrust lever, fuel cutoff and spool-down; live EICAS gauges, fuel consumption; numbered hotspots explaining each component; CFM56-style synthesized sound.

Open either file in a browser or serve the folder with any static host. Deployed with Vercel.

Made by Baris Hiz.
