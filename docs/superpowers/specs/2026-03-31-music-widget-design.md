# Music Widget Design

NetEase Cloud Music controller widget for My Toolbox portal.

## Scope

**MVP**: Playback control (play/pause, next, prev), current track info (title, artist, album, 100x100 artwork), progress bar, open app. NetEase Cloud Music only — filter by bundle ID `com.netease.163music`.

**Not included** (future iteration): Lyrics, high-resolution artwork, volume control, playlist management.

## Architecture

**Approach A: Swift常驻进程 + 事件驱动**

A Swift helper process runs alongside the Node.js server, using macOS MediaRemote framework for real-time playback state and control. Communication via stdin/stdout JSON lines.

### Package Structure

```
packages/music/
├── package.json          # @my-toolbox/music, port 3009
├── tool.yaml
├── tsconfig.json
├── tsconfig.server.json
├── src/
│   ├── native/
│   │   └── music-helper.swift
│   ├── server/
│   │   ├── index.ts
│   │   └── routes.ts
│   └── web/
│       ├── index.css
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       └── vite.config.ts
```

- Port: 3009 (backend), 5182 (Vite dev)
- PM2 name: `music`

## Swift Helper (music-helper.swift)

### Behavior

- On start: register `MRNowPlayingInfoDidChangeNotification` and `MRPlaybackStateDidChangeNotification`, output current state immediately
- Run in CFRunLoop (event-driven, not polling)
- Filter: only active when `MRMediaRemoteGetNowPlayingClient` returns bundle ID `com.netease.163music`

### Output (JSON lines to stdout)

```jsonl
{"type":"nowPlaying","title":"...","artist":"...","album":"...","duration":193.1,"elapsed":70.5,"rate":1,"artworkBase64":"<jpeg-base64>"}
{"type":"nowPlaying","title":"...","rate":0}
{"type":"nowPlaying","inactive":true}
{"type":"commandResult","command":"toggle","success":true}
```

- `rate`: 1 = playing, 0 = paused
- `artworkBase64`: JPEG base64 from `kMRMediaRemoteNowPlayingInfoArtworkData`, null if no artwork
- `inactive: true`: NetEase Cloud Music not running or not the active media source

### Input (JSON lines from stdin)

```jsonl
{"command":"info"}
{"command":"toggle"}
{"command":"next"}
{"command":"prev"}
{"command":"open"}
```

- `info`: immediately output current nowPlaying state
- `toggle/next/prev`: via `MRMediaRemoteSendCommand` (command IDs 3, 4, 5)
- `open`: via `NSWorkspace.launchApplication("NeteaseMusic")`

### Permissions

MediaRemote framework requires no special macOS permissions (no Accessibility, no Screen Recording).

## Node.js Backend

### Process Management

- Spawn `swift src/native/music-helper.swift` on server start
- Parse stdout line-by-line, maintain `currentTrack` in memory
- Auto-restart Swift process on exit

### API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/now-playing` | Current track state (JSON) |
| POST | `/api/control` | Send command to Swift stdin (`toggle`, `next`, `prev`, `open`) |
| GET | `/api/events` | SSE stream for real-time nowPlaying updates |

### Control Request Body

```json
{ "action": "toggle" | "next" | "prev" | "open" }
```

### State

No database. All state in memory, re-acquired from Swift on server restart.

## Frontend Widget

### Layout (horizontal)

```
┌─────────────────────────────────────────┐
│  ┌──────────┐                          │
│  │          │  歌曲名                   │
│  │   封面    │  艺术家 - 专辑            │
│  │  100x100 │                          │
│  │          │  ──●────────  1:10/3:13   │
│  └──────────┘                          │
│               ◀◀   ▶   ▶▶    🔊        │
│                    打开网易云            │
└─────────────────────────────────────────┘
```

### Components

- `App.tsx` — main container, SSE connection, open app link
- `CoverArt` — artwork from base64, placeholder when missing
- `TrackInfo` — title, artist, album (single-line truncate)
- `ProgressBar` — elapsed / duration display
- `Controls` — prev, play/pause, next buttons

### Data Flow

- SSE `EventSource('/api/events')` for real-time updates
- Initial `GET /api/now-playing` on mount
- `POST /api/control` for user actions, optimistic UI update

### Inactive State

When NetEase not running: placeholder UI with "未检测到网易云音乐" message and "打开" button.

### Styling

- Unified color palette (`--bg`, `--surface`, `--accent`, etc.)
- Inline styles + CSS custom properties, no Tailwind
- Rounded cover art, thin progress bar, hover states on controls

### tool.yaml Widget Config

```yaml
widget:
  minW: 3
  minH: 2
  defaultW: 4
  defaultH: 2
```
