<div align="center">

<img src="docs/assets/hero.png" alt="Sync Station — real-time text & file sync hub across all your devices" width="100%" />

<sub>▶ <a href="docs/assets/promo.mp4">Watch the 30-second promo</a></sub>

# Sync Station

**Your private clipboard, everywhere.**

A private, self-hosted hub that hot-syncs text and files across all your devices over WebSocket — no chat-app round-trips, no account juggling.

[![License: MIT](https://img.shields.io/github/license/Cohenjikan/sync-station?style=flat-square)](https://github.com/Cohenjikan/sync-station/blob/main/LICENSE)
[![Node](https://img.shields.io/badge/Node-20.x-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Socket.IO](https://img.shields.io/badge/Realtime-Socket.IO-010101?style=flat-square&logo=socket.io&logoColor=white)](https://socket.io)
[![Self-Hosted](https://img.shields.io/badge/Self--Hosted-VPS-blue?style=flat-square)](https://github.com/Cohenjikan/sync-station)
[![Stars](https://img.shields.io/github/stars/Cohenjikan/sync-station?style=flat-square)](https://github.com/Cohenjikan/sync-station/stargazers)

**English** · [中文](README.md)

</div>

<div align="center">

<img src="docs/assets/demo.gif" alt="Paste on one device, it appears on the next" width="80%" />

<sub>Drop it on one device, grab it on the next — near-instant.</sub>

</div>

---

## What is this? 🛰️

You know the dance: copy a line of text on your phone, send it to "Saved Messages," switch to your laptop, open the chat app, copy it back out. Or email a file to yourself just to move it one room over.

**Sync Station kills that dance.** It's a lightweight hub running on *your own* VPS: paste or drop text and files on one device and they show up almost instantly on every other device that has the page open. Your data flows only through **your own server** — never a third-party cloud.

> In one line: **Drop it on one device, grab it on the next.**

Who it's for: people juggling a phone, laptop, work PC and home PC who are tired of abusing chat apps and self-email to ferry clipboard text and files around. You're comfortable running a one-line `curl` deploy on a Debian/Ubuntu box and want a **private bridge you control** instead of yet another cloud service.

---

## Why use it ✨

| | |
| :-- | :-- |
| 🔒 **Truly self-hosted, single-tenant** | Your data lives on **your own VPS**, not a third-party cloud — which is the entire point versus pasting into chat apps. |
| ⚡ **Genuine one-command bootstrap** | `lazyRun.sh` goes beyond installing the app: Node 20 + PM2 daemon, Nginx reverse proxy, Let's Encrypt SSL, optional BBR TCP tuning, iptables fix hints, and a global `syncstation` CLI. |
| 🪟 **One dataset, two UI modes** | Split view (separate text/file panes) and a merged chat-stream view, toggled live — whichever fits the moment. |
| 📎 **Drag-and-drop *and* clipboard-paste upload** | Send a file the fastest way available — drag it onto the window, or just `Ctrl/Cmd-V` a file straight from your clipboard. |
| 🪶 **Tiny, easy-to-audit stack** | express + socket.io + multer. The whole server is one ~280-line file, so you can actually read what's happening. |

---

## Features 🧩

### ⚡ Real-time hot sync over WebSocket
Paste or drop something on one device and it appears on the others without refreshing. Every server-side mutation pushes a `sync_state` event over socket.io to authed connections, and the client renders on receipt. Latency depends on the network round-trip — on a decent connection it's a **near-instant, sub-second** push.

<div align="center"><img src="docs/assets/feature-1.png" alt="The real-time content stream — send on one end, it appears instantly on the others" width="85%" /></div>

### 🪟 Dual UI: split view + merged chat stream
Use the split view to keep text and files in separate panes when you're organizing; flip to the merged view for a single running, chat-style feed. Both render the same shared state and toggle live with one button.

<div align="center"><img src="docs/assets/feature-2.png" alt="Split view next to merged chat-stream view" width="85%" /></div>

### 📎 Drag-drop and clipboard-paste upload
Send a file however's fastest: drag it onto the window (a full-screen drop overlay confirms the target) or `Ctrl/Cmd-V` a file straight from your clipboard. An optimistic front-end shows the item instantly with a pending spinner, then settles once the server confirms.

<div align="center"><img src="docs/assets/feature-3.png" alt="Dragging a file over the window triggers the upload overlay" width="85%" /></div>

### 🗂️ Capped temp storage pool with oldest-first eviction
Treat it as scratch space that won't fill your disk. Files are sorted by timestamp and the oldest are pruned automatically once total size exceeds the cap. Default cap is 5GB and is admin-configurable.

<div align="center"><img src="docs/assets/feature-4.png" alt="Storage usage versus cap and the settings panel" width="85%" /></div>

### 🧠 Optimistic front-end with in-memory text state
Sent text shows up instantly and feels snappy; text history is held in a server-side in-memory array (trimmed to a cap) rather than hammering the disk.

> ⚠️ Note: **files DO live on disk** — multer writes uploads to the `uploads/` directory. Only **text history and the file index** are purely in-memory.

### 💾 Config persistence to config.json
Your PIN, admin password, and limits are written to `config.json` and reloaded on boot, so they survive restarts and updates. The CLI `update` restarts the service without wiping your config.

### 🔐 Two-tier access control (4-digit PIN + admin password)
A quick lock-screen PIN gates day-to-day access and is remembered per device, while a separate admin password protects settings. **Changing the PIN kicks every device off and forces re-auth.**

> ⚠️ This is a lightweight "keep casual visitors out" gate, **not strong auth**. See [Honest trade-offs](#honest-trade-offs-) below.

### 🚀 One-line VPS deploy + management CLI
Go from a bare Debian/Ubuntu box to an HTTPS site with one `curl` pipe, then manage it with simple commands. `lazyRun.sh` installs Node 20, PM2, an Nginx reverse proxy and Certbot/Let's Encrypt SSL, optional BBR, and writes a global `syncstation` CLI.

---

## Quickstart 🚀

> Start with a clean **Debian/Ubuntu** server.

### Option A: One-line full deploy (recommended)

One command handles dependencies, source checkout and the PM2 daemon, then optionally configures an Nginx reverse proxy with Let's Encrypt SSL. The script interactively asks whether to enable BBR and configure a domain + HTTPS.

> Point your domain's A record to the server IP **before** configuring HTTPS.

```bash
bash <(curl -L https://raw.githubusercontent.com/Cohenjikan/sync-station/refs/heads/main/lazyRun.sh)
```

When it finishes, open your domain (or `http://<server-ip>:3000`) in a browser, sign in with the default credentials, then **change them immediately** in the settings panel.

### Option B: Manual deploy

If you're on a non-Debian OS or want full control:

**Prerequisites:**
- **Node.js** (v20.x LTS or higher recommended)
- **Git**
- **PM2** (Node.js process manager)
- *(Optional)* **Nginx & Certbot** (for reverse proxy and HTTPS)

**Steps:**

```bash
# 1. Clone
git clone https://github.com/Cohenjikan/sync-station.git /opt/syncstation
cd /opt/syncstation

# 2. Install dependencies
npm install

# 3. Install PM2 and start
npm install -g pm2
pm2 start server.js --name "syncstation"
pm2 save
pm2 startup
```

> **Note:** Manual deployment does **not** generate the global `syncstation` CLI. Use standard PM2 commands (e.g. `pm2 logs syncstation` / `pm2 restart syncstation`). The service listens on `http://127.0.0.1:3000` by default; configure your own reverse proxy to route a domain to it.

### Run it locally

```bash
git clone https://github.com/Cohenjikan/sync-station.git
cd sync-station
npm install
npm start
# open http://localhost:3000
```

### Default credentials

| | |
| :-- | :-- |
| Access PIN | `0000` |
| Admin password | `admin` |

> 🚨 **Change both in the web settings panel immediately after deployment.** The defaults are public.

---

## CLI Management 🛠️

Full deployment registers a global `syncstation` command.

| Command | Description |
| :--- | :--- |
| `syncstation start` | Start the PM2 daemon |
| `syncstation stop` | Stop the service |
| `syncstation restart` | Restart the service |
| `syncstation status` | View resource usage and uptime |
| `syncstation logs` | Tail real-time console logs |
| `syncstation update` | Pull the latest version and restart (keeps config) |
| `syncstation reset` | Factory reset (wipes all files, text records, custom passwords) |
| `syncstation uninstall` | Deep uninstall and remove all associated files |

---

## How it works ⚙️

```
Device A ─┐                              ┌─ Device B
Device …  ─┼── WebSocket (socket.io) ────┼─ Device …
Device N ─┘             │                └─ Device N
                        ▼
            Your VPS (Node + Express)
            ├─ Text history → in-memory array (trimmed to cap)
            ├─ File index   → in-memory
            └─ File bytes   → uploads/ (on disk, oldest evicted)
                        ▲
          Nginx reverse proxy + Let's Encrypt SSL (optional)
```

**Stack:** Node.js · Express · Socket.IO · Multer. The whole server is one ~280-line `server.js`.

---

## Honest trade-offs ⚖️

This is designed as a **lightweight access gate for a private deployment**, not a zero-trust security product. Know these facts before you decide how to use it:

- **Not zero-trust security.** The PIN, admin password, and config are stored in **plaintext** in `config.json`. It ships with default credentials `0000` / `admin` — **change them immediately after deploying.**
- **File downloads pass the PIN in the URL query string** (`?pin=...`), so the PIN can leak into server logs, proxy logs, and browser history. Treat it as a "keep casual visitors out" gate, not strong auth.
- **There's no rate-limiting or lockout** on PIN/admin attempts, and the 4-digit PIN has only 10,000 combinations. Fine behind a private domain, weak if publicly exposed.
- **Storage is single-shared, not per-user or per-device.** Everyone with the PIN sees — and can delete — the same text and files. It's a shared bridge, not isolated mailboxes.
- **No message threading, per-device identity, or end-to-end encryption.** The merged and split views read the same shared state.
- **Mobile support is viewport-level only.** The meta tag sets `viewport-fit=cover`, but no `env(safe-area-inset-*)` CSS is actually applied, so notch/safe-area handling is largely nominal.
- **Traffic is cleartext unless you set up HTTPS.** Without Option A's Nginx + Let's Encrypt, traffic is unencrypted — do set up HTTPS.

---

## Screenshots 📸

| PIN lock screen | Split view | Merged chat stream |
| :--: | :--: | :--: |
| ![PIN lock screen](docs/assets/pin.png) | ![Split view](docs/assets/feature-2.png) | ![Merged view](docs/assets/feature-1.png) |

---

## Contributing 🤝

Issues and PRs welcome. This is a deliberately small project — please keep changes aligned with the "lightweight, easy-to-audit" spirit.

## License 📄

[MIT](LICENSE) © Cohen & Louie

<div align="center">
<sub>Stop emailing yourself files. ⭐ If it helps you, drop a star.</sub>
</div>
