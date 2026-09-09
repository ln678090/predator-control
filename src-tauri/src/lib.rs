use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use sysinfo::{Components, CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};
use std::io::{self, Write};
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareTelemetry {
    pub cpu_usage: f32,
    pub cpu_temp: f32,
    pub gpu_usage: Option<f32>,
    pub gpu_temp: Option<f32>,
    pub gpu_mem_used: Option<f32>,
    pub gpu_mem_total: Option<f32>,
    pub ram_used_gb: f32,
    pub ram_total_gb: f32,
    pub ram_percent: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatus {
    pub fan_cpu: u8,
    pub fan_gpu: u8,
    pub profile: String,
    pub battery_level: u8,
    pub battery_threshold: Option<u8>,
    pub battery_status: String,
    pub telemetry: HardwareTelemetry,
}

pub struct PredatorControl {
    hwmon_dir: PathBuf,
    profile_path: PathBuf,
    battery_path: PathBuf,
}

impl PredatorControl {
    pub fn new() -> Result<Self, String> {
        let base_hwmon = Path::new("/sys/devices/platform/acer-wmi/hwmon");
        let mut resolved_hwmon: Option<PathBuf> = None;

        if let Ok(entries) = fs::read_dir(base_hwmon) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() && p.file_name().unwrap_or_default().to_string_lossy().starts_with("hwmon") {
                    resolved_hwmon = Some(p);
                    break;
                }
            }
        }

        let hwmon_dir = resolved_hwmon.ok_or_else(|| {
            "Không tìm thấy node hwmon nào trong /sys/devices/platform/acer-wmi/hwmon".to_string()
        })?;

        // Ưu tiên node platform-profile mới nếu có, fallback về node gốc
        let modern_profile = PathBuf::from("/sys/devices/platform/acer-wmi/platform-profile/platform-profile-0/profile");
        let fallback_profile = PathBuf::from("/sys/devices/platform/acer-wmi/thermal_profile");
        let profile_path = if modern_profile.exists() {
            modern_profile
        } else {
            fallback_profile
        };

        Ok(Self {
            hwmon_dir,
            profile_path,
            battery_path: PathBuf::from("/sys/class/power_supply/BAT1"),
        })
    }

    /// Chuyển đổi 0-100% sang dải PWM hiệu dụng (0 - 500)
    fn percent_to_pwm(percent: u8) -> u32 {
        if percent == 0 {
            0
        } else {
            // Tỷ lệ tuyến tính: 1% -> 5 PWM, 100% -> 500 PWM
            (percent as u32 * 5).min(500)
        }
    }

    /// Đặt chế độ quạt: cpu/gpu từ 0 đến 100%. Nếu bằng 0 thì về Auto.
// Thay thế hàm set_fan_speed trong impl PredatorControl:
    pub fn set_fan_speed(&self, cpu_percent: u8, gpu_percent: u8) -> Result<(), String> {
        eprintln!("[PREDATOR-RUST] Nhận lệnh fan: CPU={}%, GPU={}%", cpu_percent, gpu_percent);

        if cpu_percent > 100 || gpu_percent > 100 {
            let err = format!("Tỷ lệ quạt không hợp lệ: CPU={}, GPU={}", cpu_percent, gpu_percent);
            eprintln!("[PREDATOR-RUST ERROR] {}", err);
            return Err(err);
        }

        let pwm1_enable = self.hwmon_dir.join("pwm1_enable");
        let pwm2_enable = self.hwmon_dir.join("pwm2_enable");
        let pwm1 = self.hwmon_dir.join("pwm1");
        let pwm2 = self.hwmon_dir.join("pwm2");

        // CPU Fan
        if cpu_percent == 0 {
            eprintln!("[PREDATOR-RUST] Đang ghi '2' vào {:?}", pwm1_enable);
            fs::write(&pwm1_enable, "2").map_err(|e| {
                let msg = format!("Lỗi đặt Auto CPU ({:?}): {}", pwm1_enable, e);
                eprintln!("[PREDATOR-RUST ERROR] {}", msg);
                msg
            })?;
        } else {
            eprintln!("[PREDATOR-RUST] Đang ghi '1' vào {:?}", pwm1_enable);
            fs::write(&pwm1_enable, "1").map_err(|e| {
                let msg = format!("Lỗi bật Manual CPU ({:?}): {}", pwm1_enable, e);
                eprintln!("[PREDATOR-RUST ERROR] {}", msg);
                msg
            })?;
            let val = Self::percent_to_pwm(cpu_percent);
            eprintln!("[PREDATOR-RUST] Đang ghi '{}' vào {:?}", val, pwm1);
            fs::write(&pwm1, val.to_string()).map_err(|e| {
                let msg = format!("Lỗi ghi PWM CPU ({:?}): {}", pwm1, e);
                eprintln!("[PREDATOR-RUST ERROR] {}", msg);
                msg
            })?;
        }

        // GPU Fan
        if gpu_percent == 0 {
            eprintln!("[PREDATOR-RUST] Đang ghi '2' vào {:?}", pwm2_enable);
            fs::write(&pwm2_enable, "2").map_err(|e| {
                let msg = format!("Lỗi đặt Auto GPU ({:?}): {}", pwm2_enable, e);
                eprintln!("[PREDATOR-RUST ERROR] {}", msg);
                msg
            })?;
        } else {
            eprintln!("[PREDATOR-RUST] Đang ghi '1' vào {:?}", pwm2_enable);
            fs::write(&pwm2_enable, "1").map_err(|e| {
                let msg = format!("Lỗi bật Manual GPU ({:?}): {}", pwm2_enable, e);
                eprintln!("[PREDATOR-RUST ERROR] {}", msg);
                msg
            })?;
            let val = Self::percent_to_pwm(gpu_percent);
            eprintln!("[PREDATOR-RUST] Đang ghi '{}' vào {:?}", val, pwm2);
            fs::write(&pwm2, val.to_string()).map_err(|e| {
                let msg = format!("Lỗi ghi PWM GPU ({:?}): {}", pwm2, e);
                eprintln!("[PREDATOR-RUST ERROR] {}", msg);
                msg
            })?;
        }

        eprintln!("[PREDATOR-RUST SUCCESS] Điều khiển quạt thành công!");
        Ok(())
    }

    /// Đọc tốc độ quạt (quy đổi thành tỷ lệ phần trăm 0-100% dựa trên max ~6300 RPM)
    pub fn get_fan_speed(&self) -> Result<(u8, u8), String> {
        let f1 = fs::read_to_string(self.hwmon_dir.join("fan1_input"))
            .unwrap_or_else(|_| "0".into())
            .trim()
            .parse::<f32>()
            .unwrap_or(0.0);

        let f2 = fs::read_to_string(self.hwmon_dir.join("fan2_input"))
            .unwrap_or_else(|_| "0".into())
            .trim()
            .parse::<f32>()
            .unwrap_or(0.0);

        // Quy đổi ước lượng dựa trên dải đo thực nghiệm ~6300 RPM max
        let cpu_pct = ((f1 / 6350.0) * 100.0).clamp(0.0, 100.0) as u8;
        let gpu_pct = ((f2 / 6200.0) * 100.0).clamp(0.0, 100.0) as u8;

        Ok((cpu_pct, gpu_pct))
    }

    pub fn set_profile(&self, mode: &str) -> Result<(), String> {
        // Hỗ trợ cả 2 chuẩn: tên chuỗi (platform-profile) hoặc mã số (thermal_profile legacy)
        if self.profile_path.to_string_lossy().contains("platform-profile") {
            let valid = ["low-power", "quiet", "balanced", "balanced-performance", "performance"];
            if !valid.contains(&mode) {
                return Err(format!("Chế độ không hợp lệ: {}. Danh sách hỗ trợ: {:?}", mode, valid));
            }
            fs::write(&self.profile_path, mode).map_err(|e| format!("Lỗi đặt platform-profile: {}", e))?;
        } else {
            let code = match mode {
                "quiet" => "0",
                "balanced" => "1",
                "performance" => "4",
                "turbo" => "5",
                "low-power" | "eco" => "6",
                _ => return Err("Chế độ mã số không hỗ trợ".into()),
            };
            fs::write(&self.profile_path, code).map_err(|e| format!("Lỗi đặt thermal_profile: {}", e))?;
        }
        Ok(())
    }

    pub fn get_profile(&self) -> Result<String, String> {
        let data = fs::read_to_string(&self.profile_path)
            .map_err(|e| format!("Không thể đọc chế độ hiệu năng: {}", e))?;
        let trimmed = data.trim();

        // Chuẩn hóa tên profile nếu trả về dạng mã số
        let normalized = match trimmed {
            "0" => "quiet",
            "1" => "balanced",
            "4" => "balanced-performance",
            "5" => "performance",
            "6" => "low-power",
            other => other,
        };

        Ok(normalized.to_string())
    }

    pub fn get_battery_level(&self) -> Result<u8, String> {
        let data = fs::read_to_string(self.battery_path.join("capacity"))
            .map_err(|e| format!("Không thể đọc dung lượng pin: {}", e))?;
        data.trim().parse::<u8>().map_err(|e| format!("Lỗi định dạng pin: {}", e))
    }

    pub fn get_battery_threshold(&self) -> Option<u8> {
        fs::read_to_string(self.battery_path.join("charge_control_end_threshold"))
            .ok()
            .and_then(|d| d.trim().parse::<u8>().ok())
    }

    pub fn set_battery_threshold(&self, threshold: u8) -> Result<(), String> {
        if threshold > 100 {
            return Err("Giới hạn sạc pin phải từ 0-100%".into());
        }
        fs::write(self.battery_path.join("charge_control_end_threshold"), threshold.to_string())
            .map_err(|e| format!("Không thể ghi ngưỡng sạc pin: {}", e))?;
        Ok(())
    }

    pub fn get_battery_status(&self) -> String {
        fs::read_to_string(self.battery_path.join("status"))
            .ok()
            .map(|d| d.trim().to_string())
            .unwrap_or_else(|| "N/A".into())
    }

    pub fn get_telemetry(&self) -> HardwareTelemetry {
        let mut sys = System::new_with_specifics(
            RefreshKind::nothing()
                .with_cpu(CpuRefreshKind::nothing().with_cpu_usage())
                .with_memory(MemoryRefreshKind::nothing().with_ram()),
        );
        std::thread::sleep(std::time::Duration::from_millis(80));
        sys.refresh_cpu_usage();
        sys.refresh_memory();

        let cpu_usage = sys.global_cpu_usage();
        let components = Components::new_with_refreshed_list();
        let mut cpu_temp = 0.0;

        for c in &components {
            let label = c.label().to_lowercase();
            if label.contains("core") || label.contains("cpu") || label.contains("package") {
                if let Some(t) = c.temperature() {
                    if t > cpu_temp {
                        cpu_temp = t;
                    }
                }
            }
        }

        let ram_total = sys.total_memory() as f32 / (1024.0 * 1024.0 * 1024.0);
        let ram_used = sys.used_memory() as f32 / (1024.0 * 1024.0 * 1024.0);
        let ram_percent = if ram_total > 0.0 { (ram_used / ram_total) * 100.0 } else { 0.0 };

        let (gpu_usage, gpu_temp, gpu_mem_used, gpu_mem_total) = match Command::new("nvidia-smi")
            .args(["--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total", "--format=csv,noheader,nounits"])
            .output()
        {
            Ok(output) if output.status.success() => {
                let out_str = String::from_utf8_lossy(&output.stdout);
                let parts: Vec<&str> = out_str.trim().split(',').map(|s| s.trim()).collect();
                if parts.len() >= 4 {
                    let u = parts[0].parse::<f32>().ok();
                    let t = parts[1].parse::<f32>().ok();
                    let mu = parts[2].parse::<f32>().map(|v| v / 1024.0).ok();
                    let mt = parts[3].parse::<f32>().map(|v| v / 1024.0).ok();
                    (u, t, mu, mt)
                } else {
                    (None, None, None, None)
                }
            }
            _ => (None, None, None, None),
        };

        HardwareTelemetry {
            cpu_usage,
            cpu_temp,
            gpu_usage,
            gpu_temp,
            gpu_mem_used,
            gpu_mem_total,
            ram_used_gb: (ram_used * 100.0).round() / 100.0,
            ram_total_gb: (ram_total * 100.0).round() / 100.0,
            ram_percent: (ram_percent * 10.0).round() / 100.0,
        }
    }

    pub fn get_status(&self) -> Result<SystemStatus, String> {
        let (fan_cpu, fan_gpu) = self.get_fan_speed().unwrap_or((0, 0));
        let profile = self.get_profile().unwrap_or_else(|_| "unknown".into());
        let battery_level = self.get_battery_level().unwrap_or(0);
        let battery_threshold = self.get_battery_threshold();
        let battery_status = self.get_battery_status();
        let telemetry = self.get_telemetry();

        Ok(SystemStatus {
            fan_cpu,
            fan_gpu,
            profile,
            battery_level,
            battery_threshold,
            battery_status,
            telemetry,
        })
    }
}


#[tauri::command]
fn set_fan_speed(cpu: u8, gpu: u8) -> Result<(), String> {
    eprintln!("\n==========================================");
    eprintln!("[RUST BACKEND] Nhận lệnh fan: CPU={}%, GPU={}%", cpu, gpu);
    let _ = io::stderr().flush();

    let pc = match PredatorControl::new() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[RUST ERROR] Không tìm thấy phần cứng Predator: {}", e);
            let _ = io::stderr().flush();
            return Err(e);
        }
    };

    match pc.set_fan_speed(cpu, gpu) {
        Ok(_) => {
            eprintln!("[RUST SUCCESS] Đã áp dụng CPU={}%, GPU={}", cpu, gpu);
            let _ = io::stderr().flush();
            Ok(())
        }
        Err(e) => {
            eprintln!("[RUST ERROR THẬT SỰ KHI GHI SYSFS QUẠT]: {}", e);
            let _ = io::stderr().flush();
            Err(e)
        }
    }
}#[tauri::command]
fn get_status() -> Result<SystemStatus, String> {
    let pc = PredatorControl::new()?;
    pc.get_status()
}

#[tauri::command]
fn set_profile(mode: String) -> Result<(), String> {
    eprintln!("\n==========================================");
    eprintln!("[RUST BACKEND] Nhận lệnh đổi profile: {}", mode);
    let _ = io::stderr().flush();

    let pc = match PredatorControl::new() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[RUST ERROR] Không tìm thấy phần cứng Predator: {}", e);
            let _ = io::stderr().flush();
            return Err(e);
        }
    };

    match pc.set_profile(&mode) {
        Ok(_) => {
            eprintln!("[RUST SUCCESS] Đã đổi profile thành công: {}", mode);
            let _ = io::stderr().flush();
            Ok(())
        }
        Err(e) => {
            eprintln!("[RUST ERROR THẬT SỰ KHI ĐỔI PROFILE]: {}", e);
            let _ = io::stderr().flush();
            Err(e)
        }
    }
}#[tauri::command]
fn set_battery_threshold(threshold: u8) -> Result<(), String> {
    let pc = PredatorControl::new()?;
    pc.set_battery_threshold(threshold)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_status,
            set_fan_speed,
            set_profile,
            set_battery_threshold
        ])
        .run(tauri::generate_context!())
        .expect("Lỗi khởi chạy ứng dụng Tauri");
}
