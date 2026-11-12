# TF-10K Turbofan Test Cell

Interactive 3D simulator of a 10,000 lbf high-bypass turbofan, built with three.js and the Web Audio API in a single HTML file.

- FADEC-style auto start, Boeing-style 3D thrust lever, fuel cutoff and spool-down
- Live EICAS gauges (N1, N2, EGT, fuel flow) plus EPR, oil, vibration, P3/T3 and fuel consumption
- Synthesized CFM56-style engine sound: air-turbine starter whine, igniters, light-off, fan whine and takeoff buzz-saw, compressor whine, jet roar, blade clacking at low rpm
- Cutaway model with spinning spools, glowing hot section, exhaust plume and airflow particles
- Numbered hotspots open a card for each component with live numbers

Open `index.html` in a browser, or serve the folder with any static host. Deployed with Vercel.

Made by Baris Hiz.
