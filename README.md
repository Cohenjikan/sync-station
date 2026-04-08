# Sync Station

[English Version](#english-version)

跨设备文本与文件同步中转站。解决多设备间频繁切换账号、依赖社交软件互传剪贴板内容的痛点。全链路私密化部署，基于 WebSocket 实现秒级热更新。

## 核心特性

* **实时热同步**：WebSocket 双向通信，多端数据毫秒级同步，拒绝手动刷新。
* **双模 UI 布局**：支持分屏视图（文本/文件独立分区）与合并视图（原生聊天流体验），移动端深度适配视口与安全区。
* **内存级状态映射**：读写分离架构，前端乐观更新叠加服务端内存指针缓存，彻底规避磁盘 I/O 阻塞。
* **临时存储池**：支持 PC 端全局拖拽上传。自定义存储上限（默认 5GB），超额自动置换最旧文件。
* **双层权限隔离**：
  * 一级防护：仿系统锁屏 4 位 PIN 码，拦截越权访问，支持设备记忆。
  * 二级防护：独立 Admin 密码管控核心配置。

## 自动化部署

准备一台干净的 Debian/Ubuntu 服务器。

### 方案 A：完整部署（推荐）

包含环境配置、源码拉取、进程守护，并自动配置 Nginx 反向代理与 Let's Encrypt SSL 证书。
需提前将域名 A 记录解析至服务器 IP。

```bash
bash <(curl -L https://raw.githubusercontent.com/Cohenjikan/sync-station/refs/heads/main/lazyRun.sh)
```

### 方案 B：基础部署

仅配置 Node.js 环境与 PM2 守护进程，运行于 `3000` 端口。适用于已有自建网关或反代环境的用户。

```bash
bash <(curl -L https://raw.githubusercontent.com/Cohenjikan/sync-station/refs/heads/main/run.sh)
```

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
* **Volatile Storage Pool**: Supports global drag-and-drop on desktop. Customizable storage limits (default 5GB) with automatic FIFO pruning for old files.
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

### Option B: Basic Deployment

Installs Node.js, PM2, and runs the service on port `3000`. Use this if you manage your own reverse proxy or gateway.

```bash
bash <(curl -L https://raw.githubusercontent.com/Cohenjikan/sync-station/refs/heads/main/run.sh)
```

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
| `syncstation reset` | Factory reset (wipes all files, text records, and custom passwords) |
| `syncstation uninstall` | Deep uninstall and remove all associated files |
