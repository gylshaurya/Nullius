#!/usr/bin/env bash
#
# Publish apps/web/dist to the gh-pages branch.
#
# The important detail is that this OVERLAYS the new build onto whatever is
# already published rather than replacing it, so old hashed asset files survive.
#
# Why: GitHub Pages caches HTML for several minutes, and Vite gives every asset a
# content hash. A visitor holding a cached index.html after a deploy asks for
# chunk names that no longer exist, the module graph aborts, and they get a blank
# page with no error in the console. Keeping old chunks around costs a few
# kilobytes and removes the failure entirely.
#
#   pnpm build:pages && bash scripts/deploy-pages.sh

set -euo pipefail

REPO="https://github.com/gylshaurya/Nullius.git"
DIST="apps/web/dist"
WORK="$(mktemp -d)"

[ -f "$DIST/index.html" ] || { echo "no build at $DIST; run pnpm build:pages first" >&2; exit 1; }

# Deep links need a 404 that boots the same app, and .nojekyll stops GitHub
# from hiding files that begin with an underscore.
cp "$DIST/index.html" "$DIST/404.html"
touch "$DIST/.nojekyll"

# Start from what is already live, so previous assets are retained.
git clone --depth 1 --branch gh-pages "$REPO" "$WORK/live" 2>/dev/null \
  || { mkdir -p "$WORK/live" && git -C "$WORK/live" init -q -b gh-pages; }

cp -R "$DIST/." "$WORK/live/"

cd "$WORK/live"
git add -A
if git diff --cached --quiet; then
  echo "nothing changed"
  exit 0
fi
git -c user.name="Shaurya" -c user.email="shaurya.shauryagoyal123@gmail.com" commit -q -m "deploy"
git push -q "$REPO" HEAD:gh-pages

echo "deployed"
echo "  https://gylshaurya.github.io/Nullius/"
echo "  assets retained: $(ls assets | wc -l | tr -d ' ') files"
