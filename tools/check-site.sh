#!/bin/bash
# ============================================================
# IsaacPerez.co — pre-commit guard
# ============================================================
# The repo tree IS the site and a push to main IS a production deploy, with no
# build, no CI and no staging gate. Everything below is a check for a mistake
# this repo has actually made, or one that would be found by an App Store
# reviewer rather than by us. No package.json, no runner, no dependencies --
# bash, grep, sed, awk and (for --remote) curl.
#
#   tools/check-site.sh            local checks only; safe in a pre-commit hook
#   tools/check-site.sh --remote   also status-checks the live URLs (needs network)
#
# Exit status is the number of failures, capped at 125; 0 means clean.
set -u

cd "$(dirname "$0")/.." || exit 125
fails=0
note() { printf '  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; fails=$((fails + 1)); }
pass() { printf 'ok    %s\n' "$*"; }

PAGES=$(git ls-files '*.html' | grep -v '^docs/')
WITHHELD=$(grep -v '^[[:space:]]*#' .vercelignore | grep -v '^[[:space:]]*$')

# ------------------------------------------------------------
# 1. Asset references resolve, with the exact on-disk case
# ------------------------------------------------------------
# macOS APFS is case-insensitive and Vercel is not: the hero photo really is
# isaac.JPG, and a src="isaac.jpg" works locally and 404s in production (fix
# commit 3adf50c). `test -f` cannot see the difference, so each basename is
# compared against the directory listing literally.
case_fails=0
for page in $PAGES; do
  dir=$(dirname "$page")
  refs=$(grep -oE '(src|href)="[^"#?]+"' "$page" | sed -E 's/^[a-z]+="//; s/"$//')
  for ref in $refs; do
    case "$ref" in
      http*|mailto:*|tel:*|//*|'') continue ;;
      */) continue ;;                      # directory URL: a page, checked in 3
    esac
    case "$ref" in
      /*) target=".${ref}" ;;
      *)  target="${dir}/${ref}" ;;
    esac
    if [ ! -e "$target" ]; then
      fail "$page references $ref — no such file ($target)"
      case_fails=$((case_fails + 1))
      continue
    fi
    base=$(basename "$target")
    if ! ls -A "$(dirname "$target")" | grep -Fxq "$base"; then
      fail "$page references $ref — wrong case; on disk it is $(ls -A "$(dirname "$target")" | grep -Fix "$base")"
      case_fails=$((case_fails + 1))
    fi
  done
done
[ "$case_fails" -eq 0 ] && pass "every src/href in $(echo "$PAGES" | wc -l | tr -d ' ') pages resolves with exact case"

# ------------------------------------------------------------
# 2. No deployed page references a file .vercelignore withholds
# ------------------------------------------------------------
# .vercelignore is the line between "in the repo" and "on the internet". A page
# that links something withheld renders against a 404 in production and looks
# fine locally, which is the same failure mode as a case slip.
ignore_fails=0
for page in $PAGES; do
  refs=$(grep -oE '(src|href)="/[^"#?]+"' "$page" | sed -E 's/^[a-z]+="\///; s/"$//')
  for ref in $refs; do
    for w in $WITHHELD; do
      w_clean=${w%/}
      case "$ref" in
        "$w_clean"|"$w_clean"/*)
          fail "$page references /$ref, which .vercelignore keeps out of the deployment"
          ignore_fails=$((ignore_fails + 1)) ;;
      esac
    done
  done
done
[ "$ignore_fails" -eq 0 ] && pass "no deployed page links a .vercelignore'd path"

# ------------------------------------------------------------
# 3. sitemap.xml and the pages on disk agree
# ------------------------------------------------------------
# Every <loc> is a URL an external system may point at -- four of them are
# declared in App Store Connect -- so a rename that misses the sitemap, or a
# sitemap entry with no page behind it, is a 404 somebody else finds first.
map_fails=0
locs=$(grep -o '<loc>[^<]*</loc>' sitemap.xml | sed 's/<[^>]*>//g')
for loc in $locs; do
  path=${loc#https://isaacperez.co}
  case "$path" in
    /) file="index.html" ;;
    */) file=".${path}index.html" ;;
    *)  file=".${path}" ;;
  esac
  if [ ! -f "$file" ]; then
    fail "sitemap lists $loc but $file does not exist"
    map_fails=$((map_fails + 1))
  fi
done
for page in $PAGES; do
  [ "$page" = "404.html" ] && continue          # deliberately not in the sitemap
  url="https://isaacperez.co/$(dirname "$page")/"
  [ "$page" = "index.html" ] && url="https://isaacperez.co/"
  if ! printf '%s\n' $locs | grep -Fxq "$url"; then
    fail "$page is deployed but $url is not in sitemap.xml"
    map_fails=$((map_fails + 1))
  fi
done
[ "$map_fails" -eq 0 ] && pass "sitemap.xml and the $(echo "$PAGES" | wc -l | tr -d ' ') pages on disk match"

# ------------------------------------------------------------
# 4. Every inline <script> body is allowlisted in vercel.json
# ------------------------------------------------------------
# script-src carries no 'unsafe-inline', only sha256 hashes. The hashes are
# byte-exact, so changing so much as the indentation of a pre-paint theme IIFE
# makes the browser silently refuse to run it: the page loads in the wrong theme
# with nothing in the console but a CSP report.
if ! command -v python3 >/dev/null 2>&1; then
  note "skipped the CSP hash check: python3 not on PATH"
else
  # The body has to be hashed byte-for-byte, leading newline and closing
  # indentation included, which is not a job for line-based shell tools.
  if python3 - $PAGES <<'PYEOF'
import base64, hashlib, re, sys, pathlib
declared = set(re.findall(r"'sha256-([^']+)'", pathlib.Path('vercel.json').read_text()))
used, bad = set(), 0
for page in sys.argv[1:]:
    for m in re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', pathlib.Path(page).read_text(), re.S):
        h = base64.b64encode(hashlib.sha256(m.group(1).encode()).digest()).decode()
        used.add(h)
        if h not in declared:
            print(f"        {page}: inline <script> sha256-{h} is not in script-src")
            bad += 1
for h in declared - used:
    print(f"        vercel.json allowlists sha256-{h} but no page has that body any more")
    bad += 1
sys.exit(1 if bad else 0)
PYEOF
  then
    pass "every inline script body is hash-allowlisted in the CSP, and every hash is used"
  else
    fail "vercel.json's script-src does not match the inline scripts (above)"
  fi
fi


# ------------------------------------------------------------
# 5. /photo/pricing/ quotes one price per package, in three places
# ------------------------------------------------------------
# The four prices exist as JSON-LD minPrice, as the rendered card amount and (the
# lowest one) in the meta description. A rich result advertising a price the page
# no longer charges is worse than no rich result.
P=photo/pricing/index.html
ld=$(awk '/"name": "/ { gsub(/.*"name": "|",?$/, ""); name = $0 }
          /"minPrice"/ { gsub(/.*"minPrice": "|".*/, ""); if (name != "") { print name "=" $0; name = "" } }' "$P" \
     | sed 's/&amp;/\&/g' | sort)
cards=$(awk '/class="ph-price-name"/ { gsub(/.*ph-price-name">|<\/h2>.*/, ""); name = $0 }
             /class="val"/ { gsub(/.*class="val">\$|<\/span>.*/, ""); if (name != "") { print name "=" $0; name = "" } }' "$P" \
        | sed 's/&amp;/\&/g' | sort)
if [ "$ld" = "$cards" ]; then
  pass "$(printf '%s\n' "$cards" | wc -l | tr -d ' ') package prices agree between the JSON-LD and the cards"
else
  fail "$P: the JSON-LD prices and the rendered cards disagree"
  note "JSON-LD: $(printf '%s' "$ld" | tr '\n' ' ')"
  note "cards:   $(printf '%s' "$cards" | tr '\n' ' ')"
fi
floor=$(printf '%s\n' "$cards" | sed 's/.*=//' | sort -n | head -1)
meta=$(grep -o 'Starting at \$[0-9]*' "$P" | head -1 | sed 's/.*\$//')
if [ "$floor" = "$meta" ]; then
  pass "the meta description's \"Starting at \$$meta\" is the lowest package price"
else
  fail "$P: meta description says \$$meta, cheapest package is \$$floor"
fi

# ------------------------------------------------------------
# 6. --remote: the live URLs still answer
# ------------------------------------------------------------
# Read-only. Four of these are App Store Connect's declared privacy/terms/support
# URLs for Quarters and Souvenir: if one 404s, the next person to notice is a
# reviewer during a submission.
if [ "${1:-}" = "--remote" ]; then
  for loc in $locs; do
    code=$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 20 "$loc")
    [ "$code" = "200" ] && pass "$loc $code" || fail "$loc returned $code"
  done
  dl=$(grep -ho 'https://github.com/[^"]*ShootSort\.zip' $PAGES | head -1)
  if [ -n "$dl" ]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 30 "$dl")
    [ "$code" = "200" ] && pass "ShootSort download $code" || fail "ShootSort download returned $code"
  fi
fi

printf '\n%s\n' "$fails failure(s)"
[ "$fails" -gt 125 ] && exit 125
exit "$fails"
