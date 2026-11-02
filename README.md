# spwatifi

Export **any** Spotify account's playlists and podcasts to open formats you can import into other apps.
Runs entirely in your browser from a tiny local web page. No backend, no stored data, no secrets in this repo.

## What you get

- **Playlists** (plus *Liked Songs*), each listing **song, artist, year, and date added**.
  - Tracks inside each playlist are sorted by **date added, newest first**.
  - Playlists are ordered by their most recent addition, newest first. (Spotify doesn't expose when you added a playlist itself, so most recent track activity is used.)
- **Podcasts**: saved episodes and followed shows (episodes load when you expand a show, newest first).
- Download links for each list in open formats:
  - **XSPF** (open XML playlist standard)
  - **M3U8** (universal playlist format)
  - **CSV** (spreadsheet / import tools such as Soundiiz, TuneMyMusic, etc.)
- One-click **JSON** dump of everything.

> Spotify audio is DRM-protected and can't be downloaded. Exports contain metadata and Spotify links,
> which playlist-migration tools match by title/artist.

## Installation

You need **Python 3** (any recent version) and **Git**. There is nothing else to install: no packages, no build step.

### macOS

1. Install the tools. Using [Homebrew](https://brew.sh):
   ```bash
   brew install python git
   ```
   (Or run `xcode-select --install` for Git and download Python from <https://www.python.org/downloads/>.)
2. Get the code and start the server:
   ```bash
   git clone https://github.com/eric-jahn/spwatifi-dl.git
   cd spwatifi-dl
   python3 serve.py
   ```

### Windows

1. Install the tools. In PowerShell:
   ```powershell
   winget install Python.Python.3.12 Git.Git
   ```
   (Or download them from <https://www.python.org/downloads/> and <https://git-scm.com/download/win>. Tick **Add python.exe to PATH** in the Python installer.) Then open a new PowerShell window.
2. Get the code and start the server:
   ```powershell
   git clone https://github.com/eric-jahn/spwatifi-dl.git
   cd spwatifi-dl
   py serve.py
   ```
   If `py` isn't found, use `python serve.py`.

### Linux

1. Install the tools with your package manager:
   ```bash
   # Debian / Ubuntu
   sudo apt install python3 git
   # Fedora
   sudo dnf install python3 git
   # Arch
   sudo pacman -S python git
   ```
2. Get the code and start the server:
   ```bash
   git clone https://github.com/eric-jahn/spwatifi-dl.git
   cd spwatifi-dl
   python3 serve.py
   ```

No Git? Click **Code > Download ZIP** on GitHub, unzip it, and run the same `serve.py` command inside the folder.

The server prints `Serving at http://127.0.0.1:8888/`. Press `Ctrl+C` to stop it. To use another port, pass it as an argument (for example `python3 serve.py 9000`) and use that port in the Redirect URI below too.

## Quick start

1. Create a free app at <https://developer.spotify.com/dashboard>.
2. Add this Redirect URI: `http://127.0.0.1:8888/`
3. Start the server (see [Installation](#installation)).
4. Open <http://127.0.0.1:8888/>, paste your app's **Client ID**, and click **Connect Spotify**.

Each person uses their own Client ID, so you can share this repo and anyone can export their own account.

> Spotify development-mode apps only allow users you add under *User Management* in the dashboard
> (up to 25). Add the accounts you want to export there.

## Privacy and security

- Login uses Spotify's official **OAuth Authorization Code + PKCE** flow. The page never asks for, sees, or stores your Spotify username or password; you type them only on spotify.com.
- A Client ID is public by design (PKCE needs no client secret). **Never put a client secret in this repo.**
- The access token lives in `sessionStorage` (cleared when the tab closes) and is sent only to Spotify.
- Read-only scopes: `playlist-read-private`, `playlist-read-collaborative`, `user-library-read`.
- The server binds to `127.0.0.1` only.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The page |
| `app.js` | Login, fetching, sorting, export formats |
| `serve.py` | Local static server on `127.0.0.1:8888` |

## License

MIT
