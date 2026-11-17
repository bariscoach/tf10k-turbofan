#!/bin/bash
# usage: src/deploy.sh "commit message" -- build, commit and push to GitHub, deploy to Vercel. Assets live in ../assets.
set -e; cd "$(dirname "$0")"; bash build.sh
cd .. && git add -A && git commit -q -m "$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && for i in 1 2 3 4; do git push -q origin main 2>/dev/null && { echo PUSHED; break; } || { echo retry; sleep 6; }; done; git log --oneline -1 | cut -c1-70; vercel --prod --yes 2>&1 | grep -E 'Aliased|Error' | head -2
