#!/bin/bash

if [ "$EUID" -ne 0 ]; then
  echo "需 root 权限执行"
  exit 1
fi

APP_DIR="/opt/syncstation"
CLI_BIN="/usr/local/bin/syncstation"
REPO_URL="https://github.com/Cohenjikan/sync-station.git"

apt-get update -y
apt-get install -y curl sudo build-essential git nginx certbot python3-certbot-nginx

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

npm install -g pm2

rm -rf $APP_DIR
git clone $REPO_URL $APP_DIR
cd $APP_DIR
npm install

cat << 'EOF' > $CLI_BIN
#!/bin/bash
APP_DIR="/opt/syncstation"
case "$1" in
    start) pm2 start $APP_DIR/server.js --name "syncstation"; pm2 save ;;
    stop) pm2 stop syncstation ;;
    restart) pm2 restart syncstation ;;
    status) pm2 status syncstation ;;
    logs) pm2 logs syncstation ;;
    reset) pm2 stop syncstation; rm -rf $APP_DIR/uploads/*; pm2 restart syncstation ;;
    uninstall) pm2 delete syncstation; pm2 save; rm -rf $APP_DIR; rm -f /usr/local/bin/syncstation ;;
    *) echo "指令: syncstation {start|stop|restart|status|logs|reset|uninstall}" ;;
esac
EOF
chmod +x $CLI_BIN

$CLI_BIN start
pm2 startup | grep "sudo env" | bash
pm2 save

read -p "配置域名及 HTTPS? (y/n): " CONFIG_DOMAIN
if [[ "$CONFIG_DOMAIN" =~ ^[Yy]$ ]]; then
    read -p "输入域名: " DOMAIN
    read -p "输入邮箱 (SSL 证书使用): " EMAIL

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
    nginx -t
    systemctl reload nginx

    certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL
fi
