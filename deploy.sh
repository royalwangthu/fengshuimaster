#!/bin/bash
cd "$(dirname "$0")"
git add -A && git commit -m "update $(date '+%Y-%m-%d %H:%M')"
git push
mv .git .git-bak
vercel --prod
mv .git-bak .git
echo "✅ Done! Changes saved to GitHub + deployed to Vercel"
