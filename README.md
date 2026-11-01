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

## Quick start

1. Create a free app at <https://developer.spotify.com/dashboard>.
2. Add this Redirect URI: `http://127.0.0.1:8888/`
3. Run:
   ```bash
   python3 serve.py
   ```
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
