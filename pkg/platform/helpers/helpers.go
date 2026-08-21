package helpers

import (
    "os"
    "os/exec"
    "path/filepath"
    "runtime"
)

// GetUserConfigDir returns the user configuration directory for the application.
// It creates (if necessary) a subdirectory "ProxyPin" under the OS-specific
// user config directory and returns its absolute path.
func GetUserConfigDir() (string, error) {
    base, err := os.UserConfigDir()
    if err != nil {
        return "", err
    }
    cfgDir := filepath.Join(base, "ProxyPin")
    if err := os.MkdirAll(cfgDir, 0o700); err != nil {
        return "", err
    }
    return cfgDir, nil
}

// GetAssetsDir locates the assets directory containing companion binaries and scripts.
func GetAssetsDir() string {
    // 1. Check relative to current executable (build/bin/assets or <app>/assets)
    if execPath, err := os.Executable(); err == nil && execPath != "" {
        execDir := filepath.Dir(execPath)
        candidate := filepath.Join(execDir, "assets")
        if info, err := os.Stat(candidate); err == nil && info.IsDir() {
            return candidate
        }
        // Also check parent directory (e.g. build/bin/ -> assets/)
        parentCandidate := filepath.Join(filepath.Dir(execDir), "assets")
        if info, err := os.Stat(parentCandidate); err == nil && info.IsDir() {
            return parentCandidate
        }
    }

    // 2. Check current working directory
    if info, err := os.Stat("assets"); err == nil && info.IsDir() {
        abs, _ := filepath.Abs("assets")
        return abs
    }

    // 3. Fallback to AppData/ProxyPin/assets
    if cfgDir, err := GetUserConfigDir(); err == nil {
        return filepath.Join(cfgDir, "assets")
    }

    return "assets"
}

// GetJVMAgentJarPath returns the resolved absolute path to the JVM agent JAR.
func GetJVMAgentJarPath() string {
    assetsDir := GetAssetsDir()
    primary := filepath.Join(assetsDir, "jvm-agent", "http-proxy-agent-1.3.9-all.jar")
    if _, err := os.Stat(primary); err == nil {
        return primary
    }

    // Check development path tmp/jvm-agent
    devPath := filepath.Join("tmp", "jvm-agent", "http-proxy-agent-1.3.9-all.jar")
    if _, err := os.Stat(devPath); err == nil {
        abs, _ := filepath.Abs(devPath)
        return abs
    }

    return primary
}

// GetFridaScriptPath returns the path to the bundled SSL unpinning script.
func GetFridaScriptPath() string {
    assetsDir := GetAssetsDir()
    primary := filepath.Join(assetsDir, "frida", "ssl_unpinning.js")
    if _, err := os.Stat(primary); err == nil {
        return primary
    }

    devPath := filepath.Join("assets", "frida", "ssl_unpinning.js")
    if _, err := os.Stat(devPath); err == nil {
        abs, _ := filepath.Abs(devPath)
        return abs
    }

    return primary
}

// GetADBPath returns the resolved path to the ADB binary, prioritizing bundled assets.
func GetADBPath(dataDir string) string {
    assetsDir := GetAssetsDir()
    exeName := "adb"
    if runtime.GOOS == "windows" {
        exeName = "adb.exe"
    }

    // 1. Check bundled assets/adb/
    bundled := filepath.Join(assetsDir, "adb", exeName)
    if _, err := os.Stat(bundled); err == nil {
        return bundled
    }

    // 2. Check bundled assets/platform-tools/
    bundledPT := filepath.Join(assetsDir, "platform-tools", exeName)
    if _, err := os.Stat(bundledPT); err == nil {
        return bundledPT
    }

    // 3. Check dataDir/tools/platform-tools
    if dataDir != "" {
        cached := filepath.Join(dataDir, "tools", "platform-tools", exeName)
        if _, err := os.Stat(cached); err == nil {
            return cached
        }
    }

    // 4. Check PATH
    if p, err := exec.LookPath(exeName); err == nil {
        return p
    }

    return exeName
}

// GetFridaPath returns the resolved path to the Frida executable, prioritizing bundled assets.
func GetFridaPath() string {
    assetsDir := GetAssetsDir()
    exeName := "frida"
    if runtime.GOOS == "windows" {
        exeName = "frida.exe"
    }

    // 1. Check bundled assets/frida/
    bundled := filepath.Join(assetsDir, "frida", exeName)
    if _, err := os.Stat(bundled); err == nil {
        return bundled
    }

    // 2. Check PATH
    if p, err := exec.LookPath(exeName); err == nil {
        return p
    }

    return exeName
}

// GetFridaPsPath returns the resolved path to the frida-ps executable, prioritizing bundled assets.
func GetFridaPsPath() string {
    assetsDir := GetAssetsDir()
    exeName := "frida-ps"
    if runtime.GOOS == "windows" {
        exeName = "frida-ps.exe"
    }

    // 1. Check bundled assets/frida/
    bundled := filepath.Join(assetsDir, "frida", exeName)
    if _, err := os.Stat(bundled); err == nil {
        return bundled
    }

    // 2. Check PATH
    if p, err := exec.LookPath(exeName); err == nil {
        return p
    }

    return exeName
}

