#!/usr/bin/env bash
set -e

echo "🔧 Installing Predator Control..."

# 1. Copy binary
sudo cp src-tauri/target/release/predator-control /usr/bin/
echo "✅ Binary installed to /usr/bin/predator-control"

# 2. Install sudoers rule
sudo cp 99-predator-control /etc/sudoers.d/99-predator-control
sudo chmod 440 /etc/sudoers.d/99-predator-control
echo "✅ Sudoers rule installed"

# 3. Install desktop entry
sudo cp predator-control.desktop /usr/share/applications/
echo "✅ Desktop entry installed"

echo ""
echo "🎉 Installation complete!"
echo "   - Run 'predator-control' from terminal or app launcher"
echo "   - To uninstall: sudo rm /usr/bin/predator-control /etc/sudoers.d/99-predator-control /usr/share/applications/predator-control.desktop"
