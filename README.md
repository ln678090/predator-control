# Predator Sense Pro

Ứng dụng quản lý quạt, hiệu năng và pin cho laptop Acer Predator trên Linux. Hỗ trợ đầy đủ các dòng Predator sử dụng module kernel `acer-wmi` và `facer`.

![Predator Sense Pro](https://img.shields.io/badge/Linux-Arch%20%7C%20CachyOS%20%7C%20Ubuntu%20%7C%20Fedora-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Tính năng

- 🎛️ **Điều khiển quạt thủ công**: CPU & GPU từ 0-100%
- 🔄 **Chế độ tự động**: Trả lại quyền kiểm soát cho EC khi cần
- ⚡ **5 chế độ hiệu năng**: Eco, Quiet, Balanced, Performance, Turbo
- 🔋 **Giới hạn sạc pin**: Bảo vệ pin khi dùng lâu dài
- 📊 **Telemetry realtime**: CPU/GPU usage, nhiệt độ, VRAM, RAM
- ❄️ **Chế độ hạ nhiệt nhanh**: 60s max fan trước khi tắt máy/bỏ balo
- 🎨 **Giao diện Tauri + React**: Nhẹ, hiện đại, native

## 🖥️ Hỗ trợ

### Hệ điều hành

- ✅ **Arch Linux** (chủ lực)
- ✅ **CachyOS** (tối ưu nhất)
- ✅ **EndeavourOS**, **Manjaro**, **Garuda**
- ✅ **Ubuntu**, **Debian**, **Pop!_OS**
- ✅ **Fedora**, **openSUSE**

### Phần cứng

- Laptop Acer Predator (Helios, Triton, Orion)
- Module kernel: `acer-wmi`, `facer`
- GPU NVIDIA (yếu tố bắt buộc để đọc telemetry GPU)

## 📦 Cài đặt

### 1. Yêu cầu hệ thống

#### Arch/CachyOS

```bash
sudo pacman -S --needed base-devel nodejs npm pnpm git
```

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install -y build-essential curl git libwebkit2gtk-4.1-dev \
    libappindicator3-dev librsvg2-dev libgtk-3-dev libayatana-appindicator3-dev \
    javascript-common nodejs npm
```

#### Fedora

```bash
sudo dnf install -y @development-tools curl git nodejs npm \
    webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel
```

### 2. Cài Rust (tất cả distro)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup default stable
```

### 3. Clone và cài đặt dependencies

```bash
git clone https://github.com/ln678090/predator-control.git
cd predator-control
pnpm install
```

### 4. Cấu hình udev rules (BẮT BUỘC)

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

### 5. Cấu hình module kernel (tự động tải khi boot)

```bash
echo 'options facer enable_all=1 predator_v4=1' | sudo tee /etc/modprobe.d/facer.conf
```

### 6. Build và chạy

#### Chế độ phát triển (có¹²³ log realtime)

```bash
pnpm tauri dev
```

#### Build bản Release

```bash
pnpm tauri build
```

File binary sẽ nằm tại:
- `src-tauri/target/release/predator-control`

### 7. Cài đặt vào hệ thống

```bash
sudo install -m 755 src-tauri/target/release/predator-control /usr/local/bin/predator-control
```

### 8. Tạo shortcut menu ứng dụng

```bash
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

## 🚀 Sử dụng

### Mở ứng dụng

```bash
predator-control
```

Hoặc tìm kiếm "Predator Sense Pro" trong menu ứng dụng.

### Các chế độ quạt

| Chế độ | Mô tả |
|--------|-------|
| **Auto (0%)** | Trả lại quyền kiểm soát cho EC, quạt tự động theo nhiệt độ |
| **Manual (1-100%)** | Điều khiển thủ công từng quạt CPU/GPU |
| **Max (100%)** | Quạt chạy tối đa, làm mát nhanh |
| **Cooldown (60s)** | Max fan 60 giây rồi tự về Auto, dùng trước khi tắt máy/bỏ balo |

### Các chế độ hiệu năng

- **Eco (Low-power)**: Tiết kiệm pin, giảm xung nhịp
- **Quiet**: Yên tĩnh, ưu tiên im lặng
- **Balanced**: Cân bằng hiệu năng/nhiệt độ
- **Performance**: Hiệu năng cao
- **Turbo**: Max performance (nhiệt cao, ồn)

## 🛠️ Gỡ lỗi

### Ứng dụng không mở được

Kiểm tra log terminal:

```bash
predator-control
```

### Quạt không phản hồi

1. Kiểm tra quyền truy cập sysfs:
   ```bash
   cat /sys/devices/platform/acer-wmi/thermal_profile
   ```
2. Nếu báo `Permission denied`, chạy lại bước cấu hình udev rules.

### Lỗi `Could not connect to localhost`

Chỉ xảy ra khi chạy `cargo build` thay vì `pnpm tauri build`. Luôn dùng:

```bash
pnpm tauri build
```

### GPU không hiện telemetry

Cần cài driver NVIDIA:

```bash
# Arch/CachyOS
sudo pacman -S nvidia nvidia-utils

# Ubuntu
sudo apt install nvidia-driver-535 nvidia-utils
```

## 📁 Cấu trúc dự án

```
predator-control/
├── src/                    # Frontend React + TypeScript
│   ├── App.tsx
│   ├── App.css
│   └── main.tsx
├── src-tauri/              # Backend Rust
│   ├── src/
│   │   └── lib.rs
│   ├── capabilities/
│   │   └── default.json
│   ├── tauri.conf.json
│   └── Cargo.toml
├── package.json
└── README.md
```

## 🔧 Dọn dẹp bản cũ

Nếu đã cài các bản Python/Tauri cũ:

```bash
# Xoa file desktop entry cũ
rm ~/.local/share/applications/*predator*.desktop 2>/dev/null
sudo rm /usr/share/applications/*predator*.desktop 2>/dev/null

# Xoa binary cũ
sudo rm /usr/bin/predator-control 2>/dev/null
```

## 📝 License

MIT License - tự do sử dụng và chỉnh sửa.

## 🤝 Đóng góp

1. Fork repo
2. Tạo branch tính năng (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Mở Pull Request

## 📬 Liên hệ

- GitHub: [@ln678090](https://github.com/ln678090)
- Issues: [Bao lỗi tại đây](https://github.com/ln678090/predator-control/issues)

---

**Made with ❤️ for Acer Predator users on Linux**