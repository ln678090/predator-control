# Predator Sense Pro

Ứng dụng quản lý quạt, hiệu năng và pin cho laptop Acer Predator trên Linux. Hỗ trợ đầy đủ các dòng Predator sử dụng module kernel `acer-wmi` và `facer`.

![Linux](https://img.shields.io/badge/Linux-Arch%20%7C%20CachyOS%20%7C%20EndeavourOS-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Tính năng

- 🎛️ **Điều khiển quạt thủ công**: CPU & GPU từ 0-100%
- 🤖 **Smart Fan Control**: Tự động tăng quạt khi nhiệt ≥60°C, giảm về 40% khi ≤50°C
- 📊 **Fan Service Log**: Xem log realtime service quạt nền
- ⚡ **5 chế độ hiệu năng**: Eco, Quiet, Balanced, Performance, Turbo
- 🔋 **Giới hạn sạc pin**: Bảo vệ pin khi dùng lâu dài
- 📈 **Telemetry realtime**: CPU/GPU usage, nhiệt độ (CPU, RAM, NVMe, Board), VRAM, RAM
- ❄️ **Chế độ hạ nhiệt nhanh**: 60s max fan trước khi tắt máy/bỏ balo
- 🎨 **Giao diện Tauri + React**: Nhẹ, hiện đại, native

## 🖥️ Hỗ trợ

### Hệ điều hành

- ✅ **Arch Linux** (chủ lực)
- ✅ **CachyOS** (tối ưu nhất)
- ✅ **EndeavourOS**, **Manjaro**, **Garuda**
- ⚠️ Ubuntu/Debian/Fedora (cần tự build)

### Phần cứng

- Laptop Acer Predator (Helios, Triton, Orion)
- Module kernel: `acer-wmi`, `facer`
- GPU NVIDIA (để đọc telemetry GPU)

## 📦 Cài đặt nhanh (Arch/CachyOS)

### 1. Cài dependencies

```bash
sudo pacman -S --needed base-devel nodejs npm pnpm git
```

### 2. Cài Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf [https://sh.rustup.rs](https://sh.rustup.rs) | sh
source $HOME/.cargo/env
rustup default stable
```

### 3. Clone và cài đặt

```bash
git clone [https://github.com/ln678090/predator-control.git](https://github.com/ln678090/predator-control.git)
cd predator-control
pnpm install
```

### 4. Cấu hình module kernel

```bash
echo 'options facer enable_all=1 predator_v4=1' | sudo tee /etc/modprobe.d/facer.conf
```

### 5. Cấu hình udev rules (BẮT BUỘC)

Để ứng dụng truy cập sysfs mà không cần sudo:

```bash
sudo tee /etc/udev/rules.d/99-predator-wmi.rules << 'EOF'
# Cho phép user toàn quyền chỉnh profile và quạt trên acer-wmi
SUBSYSTEM=="platform", DRIVERS=="acer-wmi", RUN+="/usr/bin/chmod -R ugo+rw /sys/devices/platform/acer-wmi"
SUBSYSTEM=="platform-profile", RUN+="/usr/bin/chmod -R ugo+rw /sys/devices/platform/acer-wmi/platform-profile"
SUBSYSTEM=="hwmon", ATTRS{name}=="acer", RUN+="/usr/bin/chmod -R ugo+rw /sys/devices/platform/acer-wmi/hwmon"
EOF

sudo udevadm control --reload-rules
sudo udevadm trigger
sudo chmod -R ugo+rw /sys/devices/platform/acer-wmi
```

### 6. Cấu hình sudo không password (cho Fan Service)

Để app bật/tắt service quạt không cần password:

```bash
sudo visudo
```

Thêm dòng này (thay `ln678090` bằng username của bạn):

```text
ln678090 ALL=(ALL) NOPASSWD: /usr/bin/systemctl start fan-auto-temp.service, /usr/bin/systemctl stop fan-auto-temp.service, /usr/bin/journalctl
```

### 7. Build và cài đặt

```bash
# Build release
pnpm tauri build

# Cài binary
sudo install -m 755 src-tauri/target/release/predator-control /usr/local/bin/predator-control

# Tạo desktop entry
mkdir -p ~/.local/share/applications
cat << 'EOF' > ~/.local/share/applications/predator-control.desktop
[Desktop Entry]
Name=Predator Sense Pro
Comment=Quản lý quạt, hiệu năng và pin Acer Predator
Exec=/usr/local/bin/predator-control
Icon=utilities-system-monitor
Terminal=false
Type=Application
Categories=System;Settings;HardwareSettings;
Keywords=fan;cooling;performance;acer;predator;
EOF

update-desktop-database ~/.local/share/applications
```

### 8. (Tuỳ chọn) Cài Fan Service nền

Service tự động điều khiển quạt dựa trên nhiệt độ:

```bash
# Tạo script
cat > ~/bin/fan-auto-temp.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

find_acer_hwmon() {
  for d in /sys/devices/platform/acer-wmi/hwmon/hwmon*; do
    [ -d "$d" ] && echo "$d" && return 0
  done
  exit 1
}

PWM_BASE=$(find_acer_hwmon)
set_fan() {
  local pct=$1
  local pwm=$((pct * 255 / 100))
  echo 1 | sudo tee "$PWM_BASE/pwm1_enable" "$PWM_BASE/pwm2_enable" >/dev/null
  echo "$pwm" | sudo tee "$PWM_BASE/pwm1" "$PWM_BASE/pwm2" >/dev/null
}

get_max_temp() {
  local max=0
  for d in /sys/class/hwmon/hwmon*; do
    [ -d "$d" ] || continue
    local name=$(cat "$d/name" 2>/dev/null | tr -d '\n')
    case "$name" in
      coretemp|spd5118|nvme|acpitz)
        local t=$(cat "$d/temp1_input" 2>/dev/null | tr -d '\n')
        [ -n "$t" ] && [ "$t" -gt "$max" ] 2>/dev/null && max="$t"
        ;;
    esac
  done
  echo "$max"
}

while true; do
  max_temp=$(get_max_temp)
  [ -z "$max_temp" ] || [ "$max_temp" -eq 0 ] && { sleep 3; continue; }
  temp_c=$((max_temp / 1000))
  [ "$temp_c" -ge 60 ] && set_fan 70 && echo "⚡ Temp ${temp_c}°C → Fan 70%"
  [ "$temp_c" -le 50 ] && set_fan 40 && echo "❄️ Temp ${temp_c}°C → Fan 40%"
  sleep 3
done
EOF

chmod +x ~/bin/fan-auto-temp.sh

# Tạo service
sudo tee /etc/systemd/system/fan-auto-temp.service << 'EOF'
[Unit]
Description=Smart fan control based on system temps
After=facer-load.service
Requires=facer-load.service

[Service]
Type=simple
ExecStart=/home/ln678090/bin/fan-auto-temp.sh
Restart=always
RestartSec=5
User=ln678090

[Install]
WantedBy=graphical.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable fan-auto-temp.service
sudo systemctl start fan-auto-temp.service
```

## 🚀 Sử dụng

### Mở ứng dụng

```bash
predator-control
```

Hoặc tìm "Predator Sense Pro" trong menu.

### Các chế độ quạt

| Chế độ              | Mô tả                                                       |
| ------------------- | ----------------------------------------------------------- |
| **Auto (0%)**       | Trả lại quyền kiểm soát cho EC                              |
| **Manual (1-100%)** | Điều khiển thủ công từng quạt CPU/GPU                       |
| **Max (100%)**      | Quạt chạy tối đa                                            |
| **Cooldown (60s)**  | Max fan 60s rồi tự về Auto                                  |
| **Smart Fan**       | Tự động tăng/giảm dựa trên nhiệt (≥60°C → 70%, ≤50°C → 40%) |

### Các chế độ hiệu năng

- **Eco**: Tiết kiệm pin
- **Quiet**: Yên tĩnh
- **Balanced**: Cân bằng
- **Performance**: Hiệu năng cao
- **Turbo**: Max performance

## 🛠️ Gỡ lỗi

### Quạt không phản hồi

```bash
# Kiểm tra quyền
cat /sys/devices/platform/acer-wmi/thermal_profile

# Nếu lỗi permission, chạy lại udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### Fan Service không hoạt động

```bash
# Xem log
journalctl -u fan-auto-temp.service -f

# Restart service
sudo systemctl restart fan-auto-temp.service
```

## 📁 Cấu trúc dự án

predator-control/
├── src/ # Frontend React + TypeScript
│ ├── App.tsx
│ ├── App.css
│ └── main.tsx
├── src-tauri/ # Backend Rust
│ ├── src/lib.rs
│ ├── tauri.conf.json
│ └── Cargo.toml
├── package.json
└── README.md

text

## 🧹 Dọn bản cũ

```bash
rm ~/.local/share/applications/*predator*.desktop 2>/dev/null
sudo rm /usr/share/applications/*predator*.desktop 2>/dev/null
sudo rm /usr/bin/predator-control 2>/dev/null
```

## 📝 License

MIT License

## 🤝 Đóng góp

1. Fork repo
2. Tạo branch: `git checkout -b feature/ten-tinh-nang`
3. Commit: `git commit -m 'Add tinh nang moi'`
4. Push: `git push origin feature/ten-tinh-nang`
5. Mở Pull Request

## 📬 Liên hệ

- GitHub: [@ln678090](https://github.com/ln678090)
- Issues: [Báo lỗi tại đây](https://github.com/ln678090/predator-control/issues)

---

**Made with ❤️ for Acer Predator users on Arch/CachyOS Linux**
