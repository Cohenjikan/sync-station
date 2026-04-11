# Sync Station

[English Version](#english-version)

跨设备文本与文件同步中转站。解决多设备间频繁切换账号、依赖社交软件互传剪贴板内容的痛点。轻松安装，全链路私密化部署，基于 WebSocket 实现秒级热更新。

## 核心特性

* **实时热同步**：WebSocket 双向通信，多端数据毫秒级同步，拒绝手动刷新。
* **双模 UI 布局**：支持分屏视图（文本/文件独立分区）与合并视图（原生聊天流体验），移动端深度适配视口与安全区。
* **内存级状态映射**：读写分离架构，前端乐观更新叠加服务端内存指针缓存，彻底规避磁盘 I/O 阻塞。
* **临时存储池**：支持 PC 端全局拖拽上传、剪贴板直接粘贴文件。自定义存储上限（默认 5GB），超额自动置换最旧文件。
* **配置持久化**：PIN 码、管理员密码等设置写入本地 `config.json`，服务重启后自动恢复，无需重新配置。
* **双层权限隔离**：
  * 一级防护：仿系统锁屏 4 位 PIN 码，拦截越权访问，支持设备记忆。
  * 二级防护：独立 Admin 密码管控核心配置。

## 自动化部署

推荐准备一台干净的 Debian/Ubuntu 服务器。

### 方案 A：完整部署（推荐）

一键安装 Sync Station，包含环境配置、源码拉取、进程守护，并自动配置 Nginx 反向代理与 Let's Encrypt SSL 证书。
需提前将域名 A 记录解析至服务器 IP。

```bash
bash <(curl -L https://raw.githubusercontent.com/Cohenjikan/sync-station/refs/heads/main/lazyRun.sh)
```

### 方案 B：手动部署

如果你使用的是非 Debian 系系统，或希望完全掌控服务器环境，可以采用手动部署。

**环境依赖要求：**
* **Node.js** (推荐 v20.x LTS 或以上)
* **Git**
* **PM2** (Node.js 进程守护工具)
* *(可选)* **Nginx & Certbot** (若需配置域名反代及 HTTPS)

**操作步骤：**

1. **拉取源码并进入目录**
```bash
git clone https://github.com/Cohenjikan/sync-station.git /opt/syncstation
cd /opt/syncstation
```

2. **安装项目依赖**
```bash
npm install
```

3. **安装 PM2 并启动服务**
```bash
npm install -g pm2
pm2 start server.js --name "syncstation"
pm2 save
pm2 startup
```

> **注意：** 纯手动部署不会生成 `syncstation` 全局 CLI 管理指令。你需要使用标准的 PM2 指令（如 `pm2 logs syncstation` 或 `pm2 restart syncstation`）来管理服务。服务默认运行在 `http://127.0.0.1:3000`，如需外网域名访问，请自行配置反向代理。

### 默认凭证

* 访问 PIN 码：`0000`
* 管理员密码：`admin`

部署完成后，请立即进入网页设置面板修改。

## 命令行工具 (CLI)

部署脚本会自动在全局注入 `syncstation` 管理指令。

| 指令 | 说明 |
| :--- | :--- |
| `syncstation start` | 启动进程守护 |
| `syncstation stop` | 停止进程 |
| `syncstation restart` | 重启进程 |
| `syncstation status` | 查看运行状态与资源占用 |
| `syncstation logs` | 打印实时运行日志 |
| `syncstation update` | 拉取最新版本并重启服务 |
| `syncstation reset` | 恢复出厂设置（清空所有文件、文本记录与自定义密码） |
| `syncstation uninstall` | 彻底卸载服务并清理所有关联文件 |

---

## English Version

[中文版本](#sync-station)

A private sync hub for instant text and file sharing across devices. Eliminates the friction of logging into chat applications solely to transfer clipboard data. Powered by WebSockets for zero-latency updates.

## Core Features

* **Real-Time Synchronization**: WebSocket-driven architecture ensures millisecond-level updates across all connected clients. No manual refreshing required.
* **Dual-View UI**: Choose between Split View (isolated text/file zones) and Merged View (chat-stream layout). Fully optimized for mobile viewports and safe areas.
* **In-Memory State Mapping**: Read/write separation with optimistic UI updates and server-side memory caching, eliminating disk I/O bottlenecks entirely.
* **Volatile Storage Pool**: Supports global drag-and-drop on desktop and direct clipboard file paste. Customizable storage limits (default 5GB) with automatic FIFO pruning for old files.
* **Config Persistence**: PIN, admin password, and settings are saved to `config.json` on disk and restored automatically after service restarts.
* **Two-Tier Authentication**:
  * Tier 1: 4-digit PIN lock screen to prevent unauthorized access, with device memory support.
  * Tier 2: Admin password to protect system configurations and trigger global forced logouts.

## Automated Deployment

Requires a clean Debian/Ubuntu server.

### Option A: Full Deployment (Recommended)

Installs dependencies, clones the repository, sets up PM2 daemon, and automatically configures Nginx reverse proxy with Let's Encrypt SSL.
Point your domain's A record to the server IP before running.

```bash
bash <(curl -L https://raw.githubusercontent.com/Cohenjikan/sync-station/refs/heads/main/lazyRun.sh)
```

### Option B: Manual Deployment

If you are using a non-Debian based OS or prefer full control over your server environment, you can deploy manually.

**Prerequisites:**
* **Node.js** (v20.x LTS or higher recommended)
* **Git**
* **PM2** (Process manager for Node.js)
* *(Optional)* **Nginx & Certbot** (For reverse proxy and HTTPS)

**Steps:**

1. **Clone the repository**
```bash
git clone https://github.com/Cohenjikan/sync-station.git /opt/syncstation
cd /opt/syncstation
```

2. **Install project dependencies**
```bash
npm install
```

3. **Install PM2 globally and start the service**
```bash
npm install -g pm2
pm2 start server.js --name "syncstation"
pm2 save
pm2 startup
```

> **Note:** Manual deployment does not generate the global `syncstation` CLI tool. You must use standard PM2 commands (e.g., `pm2 logs syncstation` or `pm2 restart syncstation`) to manage the process. The service runs on `http://127.0.0.1:3000` by default. You will need to configure your own reverse proxy if you want to route a domain to this port.

### Default Credentials

* Access PIN: `0000`
* Admin Password: `admin`

Change these immediately in the web settings panel after deployment.

## CLI Management

The deployment script globally registers the `syncstation` CLI tool.

| Command | Description |
| :--- | :--- |
| `syncstation start` | Start the PM2 daemon |
| `syncstation stop` | Stop the service |
| `syncstation restart` | Restart the service |
| `syncstation status` | View resource usage and uptime |
| `syncstation logs` | Tail real-time console logs |
| `syncstation update` | Pull latest version from GitHub and restart |
| `syncstation reset` | Factory reset (wipes all files, text records, and custom passwords) |
| `syncstation uninstall` | Deep uninstall and remove all associated files |
