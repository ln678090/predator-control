#!/usr/bin/env bash
# Build script thông minh - tự động điều chỉnh số core dựa trên tải CPU hiện tại

set -e

# Lấy số core vật lý
TOTAL_CORES=$(nproc)

# Lấy tổng CPU usage hiện tại (dạng số nguyên, ví dụ 45 = 45%)
CURRENT_CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print int($2)}')

# Nếu CPU đang dùng > 70%, chỉ dùng 25% core
# Nếu CPU đang dùng 40-70%, dùng 50% core
# Nếu CPU đang dùng < 40%, dùng 75% core
if [ "$CURRENT_CPU" -gt 70 ]; then
  BUILD_CORES=$((TOTAL_CORES / 4))
  echo "⚠️  CPU đang bận (${CURRENT_CPU}%) → Dùng ${BUILD_CORES} core (25%)"
elif [ "$CURRENT_CPU" -gt 40 ]; then
  BUILD_CORES=$((TOTAL_CORES / 2))
  echo "📊 CPU đang tải vừa (${CURRENT_CPU}%) → Dùng ${BUILD_CORES} core (50%)"
else
  BUILD_CORES=$((TOTAL_CORES * 3 / 4))
  echo "✅ CPU đang rảnh (${CURRENT_CPU}%) → Dùng ${BUILD_CORES} core (75%)"
fi

# Đảm bảo ít nhất 1 core
[ "$BUILD_CORES" -lt 1 ] && BUILD_CORES=1

# Build với số core được tính toán
echo "🚀 Starting build with ${BUILD_CORES} cores..."
CARGO_BUILD_JOBS=$BUILD_CORES pnpm tauri build "$@"
