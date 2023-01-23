mkdir source
mv ./* source
mv ./. source
mv source/.git .


cd source
typedoc src/index.ts src/services/*  --darkHighlightTheme one-dark-pro --lightHighlightTheme one-dark-pro

cd ..
mv source/docs/* .
rm -rf source

git add .
git commit -m "update docs"

branch=$(git rev-parse --abbrev-ref HEAD)

git push origin $branch:$branch-docs
