#!/bin/bash

# ==========================================
# Sync Station 一键全自动部署脚本 (Lazy Edition)
# 支持：环境安装 + 源码部署 + 进程守护 + 域名反代 + SSL 证书
# ==========================================

if [ "$EUID" -ne 0 ]; then
  echo -e "\033[31m[错误] 请使用 root 权限执行此脚本 (sudo bash lazyRun.sh)\033[0m"
  exit 1
fi

APP_DIR="/opt/syncstation"
CLI_BIN="/usr/local/bin/syncstation"
REPO_URL="https://github.com/Cohenjikan/sync-station.git"

echo -e "\033[32m[1/6] 正在更新系统依赖...\033[0m"
apt-get update -y
apt-get install -y curl sudo build-essential git nginx certbot python3-certbot-nginx iptables-persistent

echo -e "\033[32m[2/6] 正在安装 Node.js 20.x (LTS)...\033[0m"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

echo -e "\033[32m[3/6] 正在安装进程守护工具 PM2...\033[0m"
npm install -g pm2

echo -e "\033[32m[4/6] 正在从 GitHub 拉取最新源码...\033[0m"
rm -rf $APP_DIR
git clone $REPO_URL $APP_DIR
cd $APP_DIR
npm install

echo -e "\033[32m[5/6] 正在配置系统管理指令 (syncstation)...\033[0m"
cat << 'EOF' > $CLI_BIN
#!/bin/bash
APP_DIR="/opt/syncstation"
case "$1" in
    start)
        pm2 start $APP_DIR/server.js --name "syncstation"
        pm2 save
        echo "Sync Station 已启动。"
        ;;
    stop)
        pm2 stop syncstation
        echo "Sync Station 已停止。"
        ;;
    restart)
        pm2 restart syncstation
        echo "Sync Station 已重启。"
        ;;
    status)
        pm2 status syncstation
        ;;
    logs)
        pm2 logs syncstation
        ;;
    reset)
        echo "正在执行恢复出厂设置..."
        pm2 stop syncstation
        rm -rf $APP_DIR/uploads/*
        # 恢复 server.js 的默认 config（可选，此处主要重置文件与状态）
        pm2 restart syncstation
        echo "所有数据已清空，服务已重启。"
        ;;
    uninstall)
        read -p "确定要彻底卸载吗？(y/n): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            pm2 delete syncstation
            pm2 save
            rm -rf $APP_DIR
            rm -f $CLI_BIN
            echo "卸载完成。"
        fi
        ;;
    *)
        echo "用法: syncstation {start|stop|restart|status|logs|reset|uninstall}"
        ;;
esac
EOF
chmod +x $CLI_BIN

echo -e "\033[32m[6/6] 启动守护进程并配置自启...\033[0m"
$CLI_BIN start
pm2 startup | grep "sudo env" | bash
pm2 save

# ================= 域名与 SSL 交互配置 =================
echo -e "\n\033[33m-------------------------------------------------------\033[0m"
read -p "是否现在配置域名反向代理及 HTTPS? (y/n): " CONFIG_DOMAIN
if [[ "$CONFIG_DOMAIN" =~ ^[Yy]$ ]]; then
    read -p "请输入你的解析域名 (例如 sync.example.com): " DOMAIN
    read -p "请输入联系邮箱 (用于申请 SSL 证书): " EMAIL

    echo "正在配置 Nginx..."
    cat << EOF > /etc/nginx/sites-available/syncstation
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 5120M;
    }
}
EOF

    ln -sf /etc/nginx/sites-available/syncstation /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx

    echo "正在申请 SSL 证书 (Certbot)..."
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL

    # 检查 Certbot 是否成功
    if [ $? -ne 0 ]; then
        echo -e "\n\033[31m[警告] SSL 证书申请失败！\033[0m"
        echo -e "\033[31m这通常是由于防火墙（如甲骨文云安全列表）未放行 80/443 端口导致的。\033[0m"
        echo -e "\033[33m请按照以下步骤排查：\033[0m"
        echo "1. 登录云平台后台（Oracle/AWS），在入站规则中放行 TCP 80 和 443 端口。"
        echo "2. 在本服务器手动执行以下命令强制放行内部防火墙："
        echo "   sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT"
        echo "   sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT"
        echo "   sudo netfilter-persistent save"
        echo "3. 确认端口开启后，输入以下命令重新申请证书："
        echo "   sudo certbot --nginx -d $DOMAIN"
    else
        echo -e "\n\033[32m[成功] SSL 证书已自动配置，HTTPS 访问已开启！\033[0m"
        echo -e "\033[32m访问地址: https://$DOMAIN\033[0m"
    fi
else
    echo -e "\n\033[33m跳过域名配置。你可以通过 http://服务器IP:3000 访问。\033[0m"
fi

echo -e "\n\033[32m部署流程结束。输入 'syncstation' 即可管理服务。\033[0m"