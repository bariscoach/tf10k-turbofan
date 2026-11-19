#!/bin/bash
# usage: src/deploy.sh "commit message" -- build, commit and push to GitHub, deploy to Vercel. Assets live in ../assets.
set -e; cd "$(dirname "$0")"; bash build.sh
# the autoland suite must pass before anything is published
python3 test/mkharness.py >/dev/null && node test/landing-test.js >out/landing.txt 2>/dev/null || { cat out/landing.txt; echo "LANDING TESTS FAILED: not deploying"; exit 1; }; tail -1 out/landing.txt
node test/perf-test.js >out/perf.txt 2>/dev/null || { cat out/perf.txt; echo "PERFORMANCE TESTS FAILED: not deploying"; exit 1; }; tail -1 out/perf.txt
node test/chute-test.js >out/chute.txt 2>/dev/null || { cat out/chute.txt; echo "CHUTE TESTS FAILED: not deploying"; exit 1; }; tail -1 out/chute.txt
node test/combat-test.js >out/combat.txt 2>/dev/null || { cat out/combat.txt; echo "COMBAT TESTS FAILED: not deploying"; exit 1; }; tail -1 out/combat.txt
cd .. && git add -A && git commit -q -m "$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && for i in 1 2 3 4; do git push -q origin main 2>/dev/null && { echo PUSHED; break; } || { echo retry; sleep 6; }; done; git log --oneline -1 | cut -c1-70; vercel --prod --yes 2>&1 | grep -E 'Aliased|Error' | head -2
