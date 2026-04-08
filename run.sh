#!/bin/bash

if [ "$EUID" -ne 0 ]; then
  echo "Please run this script as root"
  exit 1
fi

APP_DIR="/opt/syncstation"
CLI_BIN="/usr/local/bin/syncstation"
REPO_URL="https://github.com/Cohenjikan/sync-station.git"

echo "Updating system dependencies..."
apt-get update -y
apt-get install -y curl sudo build-essential git

echo "Installing Node.js 20.x (LTS)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

echo "Installing PM2..."
npm install -g pm2

echo "Cloning repository to $APP_DIR..."
rm -rf $APP_DIR
git clone $REPO_URL $APP_DIR
cd $APP_DIR
npm install

echo "Generating CLI tool..."
cat << 'EOF' > $CLI_BIN
#!/bin/bash

APP_DIR="/opt/syncstation"

case "$1" in
    start)
        pm2 start $APP_DIR/server.js --name "syncstation"
        pm2 save
        echo "Sync Station started."
        ;;
    stop)
        pm2 stop syncstation
        echo "Sync Station stopped."
        ;;
    restart)
        pm2 restart syncstation
        echo "Sync Station restarted."
        ;;
    status)
        pm2 status syncstation
        ;;
    logs)
        pm2 logs syncstation
        ;;
    reset)
        echo "Executing factory reset..."
        pm2 stop syncstation
        rm -rf $APP_DIR/uploads/*
        pm2 restart syncstation
        echo "Files and records cleared. Service reset and started."
        ;;
    uninstall)
        echo "Executing deep uninstall..."
        pm2 delete syncstation
        pm2 save
        rm -rf $APP_DIR
        rm -f /usr/local/bin/syncstation
        echo "Uninstall complete."
        ;;
    -h|help|*)
        echo "Sync Station CLI Tool"
        echo "--------------------------"
        echo "syncstation start     Start service"
        echo "syncstation stop      Stop service"
        echo "syncstation restart   Restart service"
        echo "syncstation status    View status and resources"
        echo "syncstation logs      View real-time logs"
        echo "syncstation reset     Factory reset (clears files, texts, and passwords)"
        echo "syncstation uninstall Uninstall service and clean files"
        echo "syncstation -h        View this help menu"
        ;;
esac
EOF

chmod +x $CLI_BIN

echo "Initializing and registering startup..."
syncstation start
pm2 startup | grep "sudo env" | bash
pm2 save

echo "Installation complete. Run 'syncstation -h' to use."
