use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};

/* ============================================================
 * DATA STRUCTS
 * ========================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareTelemetry {
    pub cpu_usage: f32,
    pub cpu_temp: f32,
    pub ram_temp: f32,
    pub nvme_temp: f32,
    pub motherboard_temp: f32,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FanAutoStatus {
    pub enabled: bool,
    pub max_temp_c: f32,
    pub fan_percent: u8,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FanServiceStatus {
    pub active: bool,
    pub enabled: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FanServiceLog {
    pub lines: Vec<String>,
}

/* ============================================================
 * PREDATOR CONTROL
 * ========================================================== */

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

    fn percent_to_pwm(percent: u8) -> u32 {
        if percent == 0 {
            0
        } else {
            (percent as u32 * 5).min(500)
        }
    }

    fn read_hwmon_temps() -> (f32, f32, f32, f32) {
        let mut cpu = 0.0;
        let mut ram_sum = 0.0;
        let mut ram_count = 0u32;
        let mut nvme = 0.0;
        let mut motherboard = 0.0;

        let hwmon_dir = std::path::Path::new("/sys/class/hwmon");
        if let Ok(entries) = std::fs::read_dir(hwmon_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Ok(name) = std::fs::read_to_string(path.join("name")) {
                    let name = name.trim();
                    match name {
                        "coretemp" => {
                            if let Ok(val) = std::fs::read_to_string(path.join("temp1_input")) {
                                if let Ok(milli) = val.trim().parse::<f32>() {
                                    cpu = milli / 1000.0;
                                }
                            }
                        }
                        "nvme" => {
                            if let Ok(val) = std::fs::read_to_string(path.join("temp1_input")) {
                                if let Ok(milli) = val.trim().parse::<f32>() {
                                    nvme = milli / 1000.0;
                                }
                            }
                        }
                        "spd5118" => {
                            if let Ok(val) = std::fs::read_to_string(path.join("temp1_input")) {
                                if let Ok(milli) = val.trim().parse::<f32>() {
                                    ram_sum += milli / 1000.0;
                                    ram_count += 1;
                                }
                            }
                        }
                        "acpitz" => {
                            if let Ok(val) = std::fs::read_to_string(path.join("temp1_input")) {
                                if let Ok(milli) = val.trim().parse::<f32>() {
                                    motherboard = milli / 1000.0;
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
        }

        let ram = if ram_count > 0 {
            ram_sum / ram_count as f32
        } else {
            0.0
        };

        (cpu, ram, nvme, motherboard)
    }

    pub fn get_max_temp_celsius() -> f32 {
        let mut max = 0.0;
        let hwmon_dir = std::path::Path::new("/sys/class/hwmon");
        
        if let Ok(entries) = std::fs::read_dir(hwmon_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Ok(name) = std::fs::read_to_string(path.join("name")) {
                    let name = name.trim();
                    if matches!(name, "coretemp" | "spd5118" | "nvme" | "acpitz") {
                        if let Ok(val) = std::fs::read_to_string(path.join("temp1_input")) {
                            if let Ok(milli) = val.trim().parse::<f32>() {
                                let temp = milli / 1000.0;
                                if temp > max {
                                    max = temp;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        max
    }

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

        if cpu_percent == 0 {
            fs::write(&pwm1_enable, "2").map_err(|e| format!("Lỗi đặt Auto CPU: {}", e))?;
        } else {
            fs::write(&pwm1_enable, "1").map_err(|e| format!("Lỗi bật Manual CPU: {}", e))?;
            let val = Self::percent_to_pwm(cpu_percent);
            fs::write(&pwm1, val.to_string()).map_err(|e| format!("Lỗi ghi PWM CPU: {}", e))?;
        }

        if gpu_percent == 0 {
            fs::write(&pwm2_enable, "2").map_err(|e| format!("Lỗi đặt Auto GPU: {}", e))?;
        } else {
            fs::write(&pwm2_enable, "1").map_err(|e| format!("Lỗi bật Manual GPU: {}", e))?;
            let val = Self::percent_to_pwm(gpu_percent);
            fs::write(&pwm2, val.to_string()).map_err(|e| format!("Lỗi ghi PWM GPU: {}", e))?;
        }

        eprintln!("[PREDATOR-RUST SUCCESS] Điều khiển quạt thành công!");
        Ok(())
    }

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

        let cpu_pct = ((f1 / 6350.0) * 100.0).clamp(0.0, 100.0) as u8;
        let gpu_pct = ((f2 / 6200.0) * 100.0).clamp(0.0, 100.0) as u8;

        Ok((cpu_pct, gpu_pct))
    }

    pub fn set_profile(&self, mode: &str) -> Result<(), String> {
        if self.profile_path.to_string_lossy().contains("platform-profile") {
            let valid = ["low-power", "quiet", "balanced", "balanced-performance", "performance"];
            if !valid.contains(&mode) {
                return Err(format!("Chế độ không hợp lệ: {}", mode));
            }
            fs::write(&self.profile_path, mode).map_err(|e| format!("Lỗi đặt platform-profile: {}", e))?;
        } else {
            let code = match mode {
                "quiet" => "0",
                "balanced" => "1",
                "performance" => "4",
                "turbo" => "5",
                "low-power" | "eco" => "6",
                _ => return Err("Chế độ không hỗ trợ".into()),
            };
            fs::write(&self.profile_path, code).map_err(|e| format!("Lỗi đặt thermal_profile: {}", e))?;
        }
        Ok(())
    }

    pub fn get_profile(&self) -> Result<String, String> {
        let data = fs::read_to_string(&self.profile_path)
            .map_err(|e| format!("Không thể đọc chế độ hiệu năng: {}", e))?;
        let trimmed = data.trim();

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
        let (cpu_temp, ram_temp, nvme_temp, motherboard_temp) = Self::read_hwmon_temps();

        let mut sys = System::new_with_specifics(
            RefreshKind::nothing()
                .with_cpu(CpuRefreshKind::nothing().with_cpu_usage())
                .with_memory(MemoryRefreshKind::nothing().with_ram()),
        );
        std::thread::sleep(std::time::Duration::from_millis(80));
        sys.refresh_cpu_usage();
        sys.refresh_memory();

        let cpu_usage = sys.global_cpu_usage();
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
            ram_temp,
            nvme_temp,
            motherboard_temp,
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

    pub fn auto_fan_step(&self) -> Result<FanAutoStatus, String> {
        let max_temp = Self::get_max_temp_celsius();
        let fan_percent;
        let message;

        if max_temp >= 60.0 {
            fan_percent = 70;
            message = format!("Temp {:.0}°C → Fan 70%", max_temp);
        } else if max_temp <= 50.0 {
            fan_percent = 40;
            message = format!("Temp {:.0}°C → Fan 40%", max_temp);
        } else {
            fan_percent = 0;
            message = format!("Temp {:.0}°C (hold)", max_temp);
        }

        if fan_percent > 0 {
            let pwm1_enable = self.hwmon_dir.join("pwm1_enable");
            let pwm2_enable = self.hwmon_dir.join("pwm2_enable");
            let pwm1 = self.hwmon_dir.join("pwm1");
            let pwm2 = self.hwmon_dir.join("pwm2");

            let pwm_val = (fan_percent * 255 / 100) as u32;
            let _ = fs::write(&pwm1_enable, "1");
            let _ = fs::write(&pwm2_enable, "1");
            let _ = fs::write(&pwm1, pwm_val.to_string());
            let _ = fs::write(&pwm2, pwm_val.to_string());
        }

        Ok(FanAutoStatus {
            enabled: true,
            max_temp_c: max_temp,
            fan_percent,
            message,
        })
    }
}

/* ============================================================
 * TAURI COMMANDS
 * ========================================================== */

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
}

#[tauri::command]
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
}

#[tauri::command]
fn set_battery_threshold(threshold: u8) -> Result<(), String> {
    let pc = PredatorControl::new()?;
    pc.set_battery_threshold(threshold)
}

#[tauri::command]
fn get_fan_auto_status() -> Result<FanAutoStatus, String> {
    let pc = PredatorControl::new()?;
    pc.auto_fan_step()
}

#[tauri::command]
fn get_fan_service_status() -> Result<FanServiceStatus, String> {
    let output = Command::new("systemctl")
        .args(["is-active", "fan-auto-temp.service"])
        .output()
        .map_err(|e| format!("Lỗi chạy systemctl: {}", e))?;
    
    let active = String::from_utf8_lossy(&output.stdout).trim() == "active";
    
    let output = Command::new("systemctl")
        .args(["is-enabled", "fan-auto-temp.service"])
        .output()
        .map_err(|e| format!("Lỗi chạy systemctl: {}", e))?;
    
    let enabled = String::from_utf8_lossy(&output.stdout).trim() == "enabled";
    
    let message = if active {
        "Service đang chạy (Fan auto)".to_string()
    } else if enabled {
        "Service đã bật (chờ khởi động)".to_string()
    } else {
        "Service đang tắt".to_string()
    };
    
    Ok(FanServiceStatus { active, enabled, message })
}

#[tauri::command]
fn set_fan_service(enable: bool) -> Result<String, String> {
    let action = if enable { "start" } else { "stop" };
    let output = Command::new("sudo")
        .args(["systemctl", action, "fan-auto-temp.service"])
        .output()
        .map_err(|e| format!("Lỗi chạy systemctl: {}", e))?;
    
    if !output.status.success() {
        return Err(format!("Lỗi: {}", String::from_utf8_lossy(&output.stderr)));
    }
    
    let msg = if enable {
        "✓ Đã bật fan-auto-temp.service"
    } else {
        "✓ Đã tắt fan-auto-temp.service"
    };
    
    Ok(msg.to_string())
}

#[tauri::command]
fn get_fan_service_log() -> Result<FanServiceLog, String> {
    let output = Command::new("journalctl")
        .args(["-u", "fan-auto-temp.service", "-n", "20", "--no-pager"])
        .output()
        .map_err(|e| format!("Lỗi chạy journalctl: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<String> = stdout
        .lines()
        .filter(|l| l.contains("Temp") || l.contains("Fan"))
        .map(|l| l.split(": ").last().unwrap_or("").to_string())
        .collect();
    
    Ok(FanServiceLog { lines })
}

/* ============================================================
 * MAIN
 * ========================================================== */

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_status,
            set_fan_speed,
            set_profile,
            set_battery_threshold,
            get_fan_auto_status,
            get_fan_service_status,
            set_fan_service,
            get_fan_service_log
        ])
        .run(tauri::generate_context!())
        .expect("Lỗi khởi chạy ứng dụng Tauri");
}
