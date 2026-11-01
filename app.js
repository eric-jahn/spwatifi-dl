/* Spotify Library Export — fully client-side. No server, no secrets.
 * Auth: Authorization Code + PKCE (the user's password only ever goes to Spotify).
 */
(() => {
  'use strict';

  const SCOPES = 'playlist-read-private playlist-read-collaborative user-library-read';
  const API = 'https://api.spotify.com/v1';
  const $ = (id) => document.getElementById(id);
  const REDIRECT = location.origin + location.pathname;

  const store = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
    del: (k) => { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
  };
  const pref = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  const setStatus = (msg) => { $('status').textContent = msg || ''; };

  // ---------- PKCE ----------
  const b64url = (buf) =>
    btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const randomString = (n = 64) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const bytes = crypto.getRandomValues(new Uint8Array(n));
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  };

  async function startLogin() {
    const clientId = $('clientId').value.trim();
    if (!/^[0-9a-f]{32}$/i.test(clientId)) {
      setStatus('That does not look like a Spotify Client ID (32 hex characters).');
      return;
    }
    pref.set('clientId', clientId);
    const verifier = randomString(96);
    const state = randomString(16);
    store.set('verifier', verifier);
    store.set('state', state);
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const p = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: REDIRECT,
      scope: SCOPES,
      state,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });
    location.href = 'https://accounts.spotify.com/authorize?' + p;
  }

  async function exchangeCode(code) {
    const body = new URLSearchParams({
      client_id: pref.get('clientId') || '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      code_verifier: store.get('verifier') || '',
    });
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) throw new Error('Token exchange failed (' + r.status + ')');
    return r.json();
  }

  function logout() {
    ['token', 'verifier', 'state'].forEach(store.del);
    location.href = REDIRECT;
  }

  // ---------- API ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function api(url, retries = 5) {
    const full = url.startsWith('http') ? url : API + url;
    for (let i = 0; i <= retries; i++) {
      const r = await fetch(full, { headers: { Authorization: 'Bearer ' + store.get('token') } });
      if (r.status === 429) {
        const wait = (parseInt(r.headers.get('Retry-After') || '2', 10) + 1) * 1000;
        setStatus('Rate limited by Spotify, waiting ' + Math.ceil(wait / 1000) + 's…');
        await sleep(wait);
        continue;
      }
      if (r.status === 401) {
        store.del('token');
        throw new Error('Session expired. Please connect again.');
      }
      if (!r.ok) {
        const err = new Error('Spotify API ' + r.status + ' for ' + full.replace(API, ''));
        err.status = r.status;
        throw err;
      }
      return r.json();
    }
    throw new Error('Too many retries');
  }

  async function getAll(url, onPage) {
    const out = [];
    let next = url;
    while (next) {
      const page = await api(next);
      out.push(...(page.items || []));
      if (onPage) onPage(out.length, page.total);
      next = page.next;
    }
    return out;
  }

  // ---------- normalization ----------
  const year = (d) => (d ? String(d).slice(0, 4) : '');

  function normTrack(it) {
    const t = it.item || it.track; // API renamed this field; accept both
    if (!t) return null;
    const isEp = t.type === 'episode';
    return {
      title: t.name || '',
      artist: isEp ? (t.show && t.show.name) || '' : (t.artists || []).map((a) => a.name).join(', '),
      album: isEp ? (t.show && t.show.name) || '' : (t.album && t.album.name) || '',
      year: year(isEp ? t.release_date : t.album && t.album.release_date),
      added: it.added_at || '',
      durationMs: t.duration_ms || 0,
      url: (t.external_urls && t.external_urls.spotify) || (t.uri ? t.uri : ''),
      uri: t.uri || '',
    };
  }

  const byAddedDesc = (a, b) => (b.added || '').localeCompare(a.added || '');

  async function loadPlaylistTracks(pl) {
    let items;
    try {
      items = await getAll(`/playlists/${pl.id}/items?limit=50&additional_types=track,episode`);
    } catch (e) {
      if (e.status === 404 || e.status === 400) {
        items = await getAll(`/playlists/${pl.id}/tracks?limit=50&additional_types=track,episode`);
      } else {
        throw e;
      }
    }
    return items.map(normTrack).filter(Boolean).sort(byAddedDesc);
  }

  // ---------- export formats ----------
  const xml = (s) =>
    String(s ?? '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  function toXSPF(name, tracks) {
    const rows = tracks.map((t) => [
      '    <track>',
      t.url ? `      <location>${xml(t.url)}</location>` : '',
      `      <title>${xml(t.title)}</title>`,
      `      <creator>${xml(t.artist)}</creator>`,
      `      <album>${xml(t.album)}</album>`,
      t.durationMs ? `      <duration>${t.durationMs}</duration>` : '',
      `      <annotation>${xml('Year: ' + t.year + (t.added ? '; Added: ' + t.added : ''))}</annotation>`,
      '    </track>',
    ].filter(Boolean).join('\n')).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<playlist version="1" xmlns="http://xspf.org/ns/0/">\n  <title>${xml(name)}</title>\n  <trackList>\n${rows}\n  </trackList>\n</playlist>\n`;
  }

  function toM3U8(name, tracks) {
    const lines = ['#EXTM3U', '#PLAYLIST:' + name];
    for (const t of tracks) {
      lines.push(`#EXTINF:${Math.round(t.durationMs / 1000) || -1},${t.artist} - ${t.title}`);
      lines.push(`#EXTALB:${t.album}`);
      lines.push(t.url || `${t.artist} - ${t.title}`);
    }
    return lines.join('\n') + '\n';
  }

  const csvCell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralize spreadsheet formula injection
    return '"' + s.replace(/"/g, '""') + '"';
  };
  function toCSV(tracks) {
    const head = ['Title', 'Artist', 'Album', 'Year', 'Added', 'Duration (ms)', 'URL'];
    const rows = tracks.map((t) => [t.title, t.artist, t.album, t.year, t.added, t.durationMs, t.url].map(csvCell).join(','));
    return [head.map(csvCell).join(','), ...rows].join('\r\n') + '\r\n';
  }

  const safeName = (s) => (s || 'playlist').replace(/[^\w\- ]+/g, '_').trim().slice(0, 80) || 'playlist';

  function downloadLink(label, filename, mime, text, alt = true) {
    const a = document.createElement('a');
    a.className = 'btn' + (alt ? ' alt' : '');
    a.textContent = label;
    a.download = filename;
    a.href = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' }));
    return a;
  }

  function exportButtons(name, tracks) {
    const wrap = document.createElement('div');
    wrap.className = 'actions';
    const base = safeName(name);
    wrap.append(
      downloadLink('XSPF', base + '.xspf', 'application/xspf+xml', toXSPF(name, tracks)),
      downloadLink('M3U8', base + '.m3u8', 'audio/x-mpegurl', toM3U8(name, tracks)),
      downloadLink('CSV', base + '.csv', 'text/csv', toCSV(tracks)),
    );
    return wrap;
  }

  // ---------- rendering ----------
  function el(tag, props = {}, ...kids) {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  }

  const fmtDate = (iso) => (iso ? iso.slice(0, 10) : '—');

  function trackTable(tracks, withAdded = true) {
    const t = el('table');
    t.append(el('thead', {}, el('tr', {},
      el('th', { textContent: 'Song' }), el('th', { textContent: 'Artist' }),
      el('th', { textContent: 'Year' }), el('th', { textContent: withAdded ? 'Added' : 'Released' }))));
    const tb = el('tbody');
    for (const x of tracks) {
      tb.append(el('tr', {},
        el('td', { textContent: x.title }), el('td', { textContent: x.artist }),
        el('td', { textContent: x.year }), el('td', { textContent: fmtDate(x.added) })));
    }
    t.append(tb);
    return t;
  }

  function entry(name, tracks, subtitle) {
    const d = el('details');
    d.append(el('summary', {},
      el('strong', { textContent: name }),
      el('span', { className: 'muted', textContent: `${tracks.length} items · ${subtitle}` })));
    d.append(exportButtons(name, tracks), trackTable(tracks));
    return d;
  }

  // ---------- main load ----------
  async function loadLibrary() {
    $('login').hidden = true;
    $('results').hidden = false;
    const all = { exportedAt: new Date().toISOString(), playlists: [], podcasts: [] };

    setStatus('Loading playlists…');
    const playlists = (await getAll('/me/playlists?limit=50', (n, t) => setStatus(`Loading playlist list… ${n}/${t}`))).filter(Boolean);

    // Liked Songs as a pseudo-playlist
    setStatus('Loading Liked Songs…');
    const liked = (await getAll('/me/tracks?limit=50', (n, t) => setStatus(`Loading Liked Songs… ${n}/${t}`)))
      .map(normTrack).filter(Boolean).sort(byAddedDesc);

    const loaded = [{ name: 'Liked Songs', tracks: liked }];
    let i = 0;
    for (const pl of playlists) {
      i++;
      setStatus(`Loading playlist ${i}/${playlists.length}: ${pl.name}`);
      try {
        loaded.push({ name: pl.name || '(untitled)', tracks: await loadPlaylistTracks(pl) });
      } catch (e) {
        console.warn('Skipped playlist', pl.name, e);
        loaded.push({ name: (pl.name || '(untitled)') + ' (unavailable)', tracks: [], error: e.message });
      }
    }

    // Spotify exposes no "date a playlist was added to your library", so playlists are
    // ordered by their most recent track addition, newest first.
    const latest = (p) => (p.tracks[0] && p.tracks[0].added) || '';
    loaded.sort((a, b) => latest(b).localeCompare(latest(a)));

    const plBox = $('playlists');
    plBox.replaceChildren();
    for (const p of loaded) {
      plBox.append(entry(p.name, p.tracks, 'latest add ' + fmtDate(latest(p))));
      all.playlists.push({ name: p.name, tracks: p.tracks });
    }
    $('plCount').textContent = `(${loaded.length})`;

    // Podcasts
    setStatus('Loading podcasts…');
    const shows = (await getAll('/me/shows?limit=50')).filter((s) => s && s.show)
      .sort(byAddedDesc);
    let savedEps = [];
    try {
      savedEps = (await getAll('/me/episodes?limit=50')).map((it) => {
        const e = it.episode;
        return e && {
          title: e.name, artist: (e.show && e.show.name) || '', album: (e.show && e.show.name) || '',
          year: year(e.release_date), added: it.added_at, durationMs: e.duration_ms || 0,
          url: (e.external_urls && e.external_urls.spotify) || e.uri || '', uri: e.uri || '',
        };
      }).filter(Boolean).sort(byAddedDesc);
    } catch (e) { console.warn('Saved episodes unavailable', e); }

    const poBox = $('podcasts');
    poBox.replaceChildren();
    if (savedEps.length) {
      poBox.append(entry('Saved Episodes', savedEps, 'latest add ' + fmtDate(savedEps[0].added)));
      all.podcasts.push({ name: 'Saved Episodes', tracks: savedEps });
    }
    for (const s of shows) {
      const show = s.show;
      const d = el('details');
      d.append(el('summary', {},
        el('strong', { textContent: show.name }),
        el('span', { className: 'muted', textContent: `${show.total_episodes ?? '?'} episodes · followed ${fmtDate(s.added_at)}` })));
      const holder = el('div', { className: 'muted', textContent: 'Expand to load episodes…' });
      d.append(holder);
      let done = false;
      d.addEventListener('toggle', async () => {
        if (!d.open || done) return;
        done = true;
        holder.textContent = 'Loading episodes…';
        try {
          const eps = (await getAll(`/shows/${show.id}/episodes?limit=50`)).filter(Boolean).map((e) => ({
            title: e.name, artist: show.name, album: show.name, year: year(e.release_date),
            added: e.release_date || '', durationMs: e.duration_ms || 0,
            url: (e.external_urls && e.external_urls.spotify) || e.uri || '', uri: e.uri || '',
          })).sort(byAddedDesc);
          holder.replaceChildren(exportButtons(show.name, eps), trackTable(eps, false));
        } catch (err) {
          done = false;
          holder.textContent = 'Could not load episodes: ' + err.message;
        }
      });
      poBox.append(d);
      all.podcasts.push({ name: show.name, followedAt: s.added_at, spotifyUrl: show.external_urls && show.external_urls.spotify });
    }
    $('poCount').textContent = `(${shows.length} shows)`;

    $('allJson').href = URL.createObjectURL(new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' }));
    setStatus('Done. Expand a playlist to see its songs and download it.');
  }

  // ---------- boot ----------
  async function boot() {
    $('redir').textContent = REDIRECT;
    $('clientId').value = pref.get('clientId') || '';
    $('loginBtn').addEventListener('click', startLogin);
    $('logout').addEventListener('click', logout);

    const q = new URLSearchParams(location.search);
    try {
      if (q.get('error')) {
        setStatus('Spotify login was cancelled or failed: ' + q.get('error'));
        history.replaceState({}, '', REDIRECT);
        return;
      }
      if (q.get('code')) {
        if (q.get('state') !== store.get('state')) throw new Error('State mismatch; please try again.');
        const tok = await exchangeCode(q.get('code'));
        store.set('token', tok.access_token);
        history.replaceState({}, '', REDIRECT);
      }
      if (store.get('token')) await loadLibrary();
    } catch (e) {
      console.error(e);
      $('login').hidden = false;
      setStatus(e.message);
    }
  }

  boot();
})();
