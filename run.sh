#!/bin/bash

if [ "$EUID" -ne 0 ]; then
  echo "请使用 root 权限运行此脚本: sudo bash run.sh"
  exit 1
fi

APP_DIR="/opt/syncstation"
CLI_BIN="/usr/local/bin/syncstation"

echo "更新系统依赖..."
apt-get update -y
apt-get install -y curl sudo build-essential

echo "安装 Node.js 20.x (LTS)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

echo "安装进程守护工具 PM2..."
npm install -g pm2

echo "部署应用文件至 $APP_DIR..."
mkdir -p $APP_DIR
cp -r ./* $APP_DIR/
cd $APP_DIR
npm install

echo "生成全局指令工具..."
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
        echo "执行恢复出厂设置..."
        pm2 stop syncstation
        rm -rf $APP_DIR/uploads/*
        pm2 restart syncstation
        echo "已清空所有文件与文本记录，服务已重置并启动。"
        ;;
    uninstall)
        echo "执行深度卸载..."
        pm2 delete syncstation
        pm2 save
        rm -rf $APP_DIR
        rm -f /usr/local/bin/syncstation
        echo "卸载彻底完成。"
        ;;
    -h|help|*)
        echo "Sync Station CLI 管理工具"
        echo "--------------------------"
        echo "syncstation start     启动服务"
        echo "syncstation stop      关闭服务"
        echo "syncstation restart   重启服务"
        echo "syncstation status    查看运行状态及资源占用"
        echo "syncstation logs      查看实时运行日志"
        echo "syncstation reset     恢复出厂设置 (清空文件、文本及修改的密码)"
        echo "syncstation uninstall 彻底卸载服务并清理残留文件"
        echo "syncstation -h        查看此帮助菜单"
        ;;
esac
EOF

chmod +x $CLI_BIN

echo "初始化并注册开机自启..."
syncstation start
pm2 startup | grep "sudo env" | bash
pm2 save

echo "安装部署完成。直接输入 'syncstation -h' 使用。"