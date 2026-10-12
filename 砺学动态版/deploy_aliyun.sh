#!/usr/bin/env bash
# ============================================================
# 砺学动态版 · 阿里云轻量应用服务器 一键部署脚本
# 适用系统：Ubuntu 22.04（阿里云轻量应用服务器"系统镜像"）
# 用法：
#   1. 把本项目（含本脚本）传到服务器上的某个目录；
#   2. 在终端进入该项目目录；
#   3. 执行：bash deploy_aliyun.sh
# 脚本会自动：安装 Python/依赖 -> 建虚拟环境 -> 配置开机自启 -> 放行系统端口。
# 注意：阿里云控制台的"防火墙"还需您手动放行（见部署指南第五步），否则外网打不开。
# ============================================================
set -e

PORT=8010
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR"

echo "=================================================="
echo " 砺学动态版 · 阿里云部署脚本"
echo " 应用目录: $APP_DIR"
echo " 监听端口: $PORT"
echo "=================================================="

echo "[1/5] 安装系统依赖（Python3、pip、venv、git）..."
sudo apt-get update -y
sudo apt-get install -y python3-venv python3-pip git curl

echo "[2/5] 创建虚拟环境并安装 Python 依赖..."
cd "$APP_DIR"
python3 -m venv venv
# shellcheck disable=SC1091
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q

echo "[3/5] 写入 Systemd 服务（开机自启 + 崩溃自重启）..."
sudo tee /etc/systemd/system/lixue.service > /dev/null <<EOF
[Unit]
Description=Lixue Dynamic Service
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/venv/bin/python main.py
Restart=always
User=$USER
Environment=PORT=$PORT

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable lixue
sudo systemctl restart lixue

echo "[4/5] 放行系统防火墙端口 $PORT（若系统未启用 ufw 会自动跳过）..."
sudo ufw allow ${PORT}/tcp || true
sudo ufw reload || true

echo "[5/5] 完成 ✅"
echo ""
echo "下一步：请到【阿里云控制台 -> 轻量应用服务器 -> 防火墙】添加规则，放行 TCP $PORT 端口。"
echo "然后浏览器打开： http://<您的服务器公网IP>:$PORT"
echo "查看服务状态： sudo systemctl status lixue"
