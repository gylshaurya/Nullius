#!/usr/bin/env bash
#
# Rewrite the whole history under a teammate's identity and repoint every
# hardcoded URL at their repo. Does NOT push. It builds a branch called
# `transfer` and prints the commands to push it, so you can inspect first.
#
#   bash scripts/transfer.sh <teammate-github-username> [repo-name] [hours]
#
# Example:
#   bash scripts/transfer.sh arjunexample Nullius 9
#
# What it does:
#   1. Looks up the teammate's numeric GitHub id, so commits are authored with
#      the noreply address GitHub already trusts for their account. This is what
#      makes commits show their avatar and count toward their contributions.
#      Using a plain email that is not verified on their account shows the name
#      but does not link to the profile.
#   2. Updates the three files that hardcode the old owner or repo name.
#   3. Replays every commit with the same tree and message, but the teammate as
#      author and committer, and dates spread over the given window.
#
# Your original history stays on `main` untouched as a backup.

set -euo pipefail

OWNER="${1:-}"
REPO="${2:-Nullius}"
HOURS="${3:-9}"

[ -n "$OWNER" ] || { echo "usage: bash scripts/transfer.sh <teammate-username> [repo-name] [hours]" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "working tree is dirty; commit or stash first" >&2; exit 1; }

echo "==> looking up github.com/$OWNER"
API="$(curl -fsSL "https://api.github.com/users/$OWNER")" || { echo "no such GitHub user: $OWNER" >&2; exit 1; }
GH_ID="$(printf '%s' "$API" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')"
GH_NAME="$(printf '%s' "$API" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("name") or d["login"])')"
GH_EMAIL="${GH_ID}+${OWNER}@users.noreply.github.com"

echo "    name  : $GH_NAME"
echo "    email : $GH_EMAIL"
echo "    repo  : https://github.com/$OWNER/$REPO"
echo ""

# ---------------------------------------------------------------------------
# 1. Repoint the hardcoded references
# ---------------------------------------------------------------------------
echo "==> updating hardcoded URLs"
OLD_OWNER="gylshaurya"
OLD_REPO="Nullius"

python3 - "$OLD_OWNER" "$OLD_REPO" "$OWNER" "$REPO" <<'PY'
import sys, pathlib
old_o, old_r, new_o, new_r = sys.argv[1:5]
for f in ['README.md', 'package.json', 'scripts/deploy-pages.sh']:
    p = pathlib.Path(f)
    if not p.exists():
        continue
    s = p.read_text()
    s = s.replace(f'{old_o}.github.io/{old_r}', f'{new_o}.github.io/{new_r}')
    s = s.replace(f'github.com/{old_o}/{old_r}', f'github.com/{new_o}/{new_r}')
    s = s.replace(f'VITE_BASE=/{old_r}/', f'VITE_BASE=/{new_r}/')
    p.write_text(s)
    print(f'    {f}')
PY

# The deploy script also commits as a person; make that the teammate too.
python3 - "$GH_NAME" "$GH_EMAIL" <<'PY'
import sys, pathlib, re
name, email = sys.argv[1], sys.argv[2]
p = pathlib.Path('scripts/deploy-pages.sh')
s = p.read_text()
s = re.sub(r'user\.name="[^"]*"', f'user.name="{name}"', s)
s = re.sub(r'user\.email="[^"]*"', f'user.email="{email}"', s)
p.write_text(s)
PY

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git -c user.name="$GH_NAME" -c user.email="$GH_EMAIL" commit -q -m "update deployment links"
  echo "    committed"
else
  echo "    nothing to change"
fi

# ---------------------------------------------------------------------------
# 2. Replay every commit under the teammate's identity, with new dates
# ---------------------------------------------------------------------------
TMP="$(mktemp -d)"
git rev-list --reverse HEAD > "$TMP/commits"
N="$(wc -l < "$TMP/commits" | tr -d ' ')"
echo ""
echo "==> replaying $N commits as $GH_NAME over the last $HOURS hours"

python3 - "$N" "$HOURS" > "$TMP/dates" <<'PY'
import sys, datetime, random
n, hours = int(sys.argv[1]), float(sys.argv[2])
random.seed(11)                                     # deterministic, reproducible
end = datetime.datetime.now().astimezone() - datetime.timedelta(minutes=8)
start = end - datetime.timedelta(hours=hours)
span = (end - start).total_seconds()
for i in range(n):
    at = start + datetime.timedelta(seconds=span * i / max(n - 1, 1))
    if 0 < i < n - 1:                               # keep first and last exact
        at += datetime.timedelta(seconds=random.randint(-300, 300))
    print(at.strftime('%Y-%m-%dT%H:%M:%S%z'))
PY

prev=""
i=1
while [ "$i" -le "$N" ]; do
  c="$(sed -n "${i}p" "$TMP/commits")"
  d="$(sed -n "${i}p" "$TMP/dates")"
  tree="$(git rev-parse "${c}^{tree}")"

  if [ -z "$prev" ]; then
    new="$(git log -1 --format=%B "$c" | \
      GIT_AUTHOR_NAME="$GH_NAME" GIT_AUTHOR_EMAIL="$GH_EMAIL" GIT_AUTHOR_DATE="$d" \
      GIT_COMMITTER_NAME="$GH_NAME" GIT_COMMITTER_EMAIL="$GH_EMAIL" GIT_COMMITTER_DATE="$d" \
      git commit-tree "$tree" -F -)"
  else
    new="$(git log -1 --format=%B "$c" | \
      GIT_AUTHOR_NAME="$GH_NAME" GIT_AUTHOR_EMAIL="$GH_EMAIL" GIT_AUTHOR_DATE="$d" \
      GIT_COMMITTER_NAME="$GH_NAME" GIT_COMMITTER_EMAIL="$GH_EMAIL" GIT_COMMITTER_DATE="$d" \
      git commit-tree "$tree" -p "$prev" -F -)"
  fi

  printf '    %2d/%s  %s  %s\n' "$i" "$N" "$(echo "$d" | cut -c1-16)" "$(git log -1 --format=%s "$c")"
  prev="$new"
  i=$((i + 1))
done

git branch -f transfer "$prev"
rm -rf "$TMP"

echo ""
echo "==> done. Branch 'transfer' is ready. Your original 'main' is untouched."
echo ""
git log transfer --format='    %ad  %an <%ae>  %s' --date=format:'%m-%d %H:%M' | head -4
echo "    ..."
echo ""
echo "Verify it looks right, then push:"
echo ""
echo "    git remote add teammate https://github.com/$OWNER/$REPO.git"
echo "    git push -f teammate transfer:main"
echo ""
echo "Then rebuild and deploy the site under the new owner:"
echo ""
echo "    git checkout transfer"
echo "    pnpm build:pages && bash scripts/deploy-pages.sh"
echo ""
