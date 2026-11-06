# Woodlands Highscores — GitHub Pages

A public, static high-score website using real leaderboard entries read from Barebones Woodlands. The site starts **empty**: no rankings have been fetched from the live game in this delivery.

## 1. Create the repository

Your GitHub username is `thomasleeblankenship-svg`.

1. Open https://github.com/new and sign into GitHub.
2. Name the repository `woodlands-highscores`, set **Public**, then create it.
3. Upload `index.html`, `.nojekyll`, and the `data/highscores.json` file from this folder. GitHub's **Add file → Upload files** supports the `data` folder if you drag it into the browser; if that does not preserve folders, create `data/highscores.json` via **Add file → Create new file**.
4. Under **Settings → Pages**, set **Deploy from a branch**, branch `main`, folder `/(root)`, and save.
5. Once Pages finishes deploying, open https://thomasleeblankenship-svg.github.io/woodlands-highscores/ . This is an expected URL, not verified active until you deploy.

## 2. Capture genuine rankings

1. Install `woodlands-highscores-collector.user.js` in Tampermonkey, or paste its entire contents into the game console for a single session.
2. Log into the game normally. **Stop the skill bot** before using the collector, so its own periodic board check does not interfere.
3. Click **Export Highscores** at the bottom-right. It asks the game to open its ordinary highscores view, clicks the displayed categories, and downloads `highscores.json` to your machine.
4. Open the public website and use **Preview a JSON snapshot** to confirm it looks right. Previewing does not upload anything.
5. In GitHub, replace `data/highscores.json` with the newly exported JSON (or edit that file using GitHub's editor and paste the export). Commit the change. GitHub Pages then displays the real snapshot.

## Notes and limits

- The collector uses the game's existing `lboard` request and reads the game's visible leaderboard UI. It does not intercept passwords, cookies or authentication tokens, or modify packets.
- The game appears to show a top-ten per category, so entries outside the top ten may not be visible.
- The exporter deliberately preserves **raw leaderboard entry text** instead of guessing which substring is the username vs. score. The site does not claim independent verification of numbers.
- Static GitHub Pages cannot query your `127.0.0.1` manager from other people's browsers or update the repository without publishing new data. Each export must be committed to the repository. Automated publishing is a possible future addition with a carefully scoped GitHub credential.
- Do not upload local manager session tokens, browser cookies, game credentials, or the manager's SQLite database to the public repository.
- The exporter has not been tested on the live game. If the game's DOM has changed, selectors may need adjusting.
