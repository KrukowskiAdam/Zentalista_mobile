# Ręcznie kiedy chcesz
cd tools && node update_fake_leaderboard.mjs
localStorage.clear()
location.reload()
## NPM RUN ALL
npm run dev

## Restart emulators (clear cache)
# Ctrl+C to stop, then:
firebase emulators:start

## Running Server:

firebase serve
firebase emulators:start
npm run serve

## Daisy nasłuchiwanie zmian

npx tailwindcss -i ./src/input.css -o ./public/css/style.css --watch

## log firebase

firebase functions:log
firebase functions:log --project=costam-3f612

## usuniecie node modules

rm -rf node_modules package-lock.json

## Running VSCode:

cd mellowcards
git add .
git status
git commit -m "style"  
git push origin main
git push --force origin main (jesli chcemy force)
cmd + shift + F = search
firebase deploy --only functions,hosting ?
firebase deploy

## Firebase test

firebase functions:log

## Firebase deploy

firebase deploy --only functions

## Export struktury plików

tree -P '_.js|_.html|_.json|_.jpg|_.png|_.md|_.gitignore|_.env|_.yml|_.css' -I 'node_modules' > projekt.txt

## Struktura

tree -I 'node_modules|dist|.git|.vscode'

## Firebase emulator local

firebase emulators:start

## Pobieranie danego comita z github

git reset --hard 83c3cd171f4d446f95301f774e6ec2ef4aa7217d
git clean -fd
git pull origin main

## git ostatnie >

# Pobierz zmiany z GitHub

git fetch origin
git reset --hard origin/main
git clean -fd

# Zresetuj lokalną gałąź do stanu z GitHub

git reset --hard origin/main

## pobranie commita

git fetch origin
git checkout main
git reset --hard 9fa7fe03721bd3f028f4b48dddbd05b12b68676f
git clean -fdx (usowa node modules)
git clean -fd (szanuje .gitignore czyli zostawi node_modules w spokoju)

**poprawki słówek**
cd tools
node replace_word.mjs --file 01 --find "Stare słowo" --en "Nowe słowo" --translate