package cert

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

// JavaInstallation represents an installed Java JDK or JRE on the system.
type JavaInstallation struct {
	Path        string `json:"path"`
	Version     string `json:"version"`
	Vendor      string `json:"vendor"`
	KeytoolPath string `json:"keytoolPath"`
	CacertsPath string `json:"cacertsPath"`
	IsInstalled bool   `json:"isInstalled"`
}

// JavaManager detects and manages Root CA installation in Java keystores (cacerts).
type JavaManager struct {
	ca *CA
}

// NewJavaManager creates a new JavaManager with the given Root CA.
func NewJavaManager(ca *CA) *JavaManager {
	return &JavaManager{ca: ca}
}

// DetectInstallations searches standard system directories and environment variables for Java installations.
func (jm *JavaManager) DetectInstallations() []JavaInstallation {
	candidates := make(map[string]bool)

	// 1. Environment variables
	for _, envKey := range []string{"JAVA_HOME", "JDK_HOME", "JRE_HOME", "GRAALVM_HOME"} {
		if val := strings.TrimSpace(os.Getenv(envKey)); val != "" {
			candidates[filepath.Clean(val)] = true
		}
	}

	// 2. PATH resolution
	keytoolExe := "keytool"
	if runtime.GOOS == "windows" {
		keytoolExe = "keytool.exe"
	}
	if p, err := exec.LookPath(keytoolExe); err == nil {
		// Keytool is inside bin/, so parent directory is JAVA_HOME
		binDir := filepath.Dir(p)
		candidates[filepath.Clean(filepath.Dir(binDir))] = true
	}

	userHome, _ := os.UserHomeDir()

	// 3. Platform specific directories
	switch runtime.GOOS {
	case "windows":
		searchRoots := []string{
			`C:\Program Files\Java`,
			`C:\Program Files (x86)\Java`,
			`C:\Program Files\Eclipse Adoptium`,
			`C:\Program Files\Amazon Corretto`,
			`C:\Program Files\Zulu`,
			`C:\Program Files\Microsoft`,
			`C:\Program Files\BellSoft`,
			`C:\Program Files\Semeru`,
			`C:\Program Files\Oracle`,
		}
		if userHome != "" {
			searchRoots = append(searchRoots,
				filepath.Join(userHome, ".jdks"),
				filepath.Join(userHome, ".sdkman", "candidates", "java"),
				filepath.Join(userHome, "AppData", "Local", "Programs", "Eclipse Adoptium"),
			)
		}

		for _, root := range searchRoots {
			entries, err := os.ReadDir(root)
			if err == nil {
				for _, entry := range entries {
					if entry.IsDir() {
						candidates[filepath.Clean(filepath.Join(root, entry.Name()))] = true
					}
				}
			}
		}

	case "darwin":
		searchRoots := []string{
			"/Library/Java/JavaVirtualMachines",
			"/System/Library/Java/JavaVirtualMachines",
		}
		if userHome != "" {
			searchRoots = append(searchRoots,
				filepath.Join(userHome, "Library", "Java", "JavaVirtualMachines"),
				filepath.Join(userHome, ".sdkman", "candidates", "java"),
			)
		}
		for _, root := range searchRoots {
			entries, err := os.ReadDir(root)
			if err == nil {
				for _, entry := range entries {
					if entry.IsDir() {
						// macOS JDKs often have Contents/Home
						homeDir := filepath.Join(root, entry.Name(), "Contents", "Home")
						if _, err := os.Stat(homeDir); err == nil {
							candidates[filepath.Clean(homeDir)] = true
						} else {
							candidates[filepath.Clean(filepath.Join(root, entry.Name()))] = true
						}
					}
				}
			}
		}

	case "linux":
		searchRoots := []string{
			"/usr/lib/jvm",
			"/usr/java",
			"/opt/java",
			"/opt/jvm",
		}
		if userHome != "" {
			searchRoots = append(searchRoots, filepath.Join(userHome, ".sdkman", "candidates", "java"))
		}
		for _, root := range searchRoots {
			entries, err := os.ReadDir(root)
			if err == nil {
				for _, entry := range entries {
					if entry.IsDir() {
						candidates[filepath.Clean(filepath.Join(root, entry.Name()))] = true
					}
				}
			}
		}
	}

	var results []JavaInstallation
	for path := range candidates {
		if inst, err := jm.InspectFolder(path); err == nil && inst != nil {
			results = append(results, *inst)
		}
	}

	return results
}

// InspectFolder inspects a given path to verify if it is a valid Java JDK or JRE installation.
func (jm *JavaManager) InspectFolder(path string) (*JavaInstallation, error) {
	cleanPath := filepath.Clean(strings.TrimSpace(path))
	if cleanPath == "" {
		return nil, fmt.Errorf("empty path")
	}

	// 1. Locate keytool executable
	keytoolExe := "keytool"
	if runtime.GOOS == "windows" {
		keytoolExe = "keytool.exe"
	}

	possibleKeytools := []string{
		filepath.Join(cleanPath, "bin", keytoolExe),
		filepath.Join(cleanPath, "jre", "bin", keytoolExe),
		filepath.Join(cleanPath, "..", "bin", keytoolExe),
	}

	var keytoolPath string
	for _, k := range possibleKeytools {
		if fi, err := os.Stat(k); err == nil && !fi.IsDir() {
			keytoolPath = k
			break
		}
	}
	if keytoolPath == "" {
		return nil, fmt.Errorf("keytool executable not found in %s", cleanPath)
	}

	// 2. Locate cacerts file
	possibleCacerts := []string{
		filepath.Join(cleanPath, "lib", "security", "cacerts"),
		filepath.Join(cleanPath, "jre", "lib", "security", "cacerts"),
		filepath.Join(cleanPath, "security", "cacerts"),
		filepath.Join(cleanPath, "lib", "security", "jssecacerts"),
	}

	var cacertsPath string
	for _, c := range possibleCacerts {
		if fi, err := os.Stat(c); err == nil && !fi.IsDir() {
			cacertsPath = c
			break
		}
	}
	if cacertsPath == "" {
		return nil, fmt.Errorf("cacerts keystore not found in %s", cleanPath)
	}

	// 3. Extract Java version and vendor
	version, vendor := extractJavaMeta(cleanPath, keytoolPath)

	// 4. Check if CA is already installed
	isInstalled := jm.checkAliasInstalled(keytoolPath, cacertsPath)

	return &JavaInstallation{
		Path:        cleanPath,
		Version:     version,
		Vendor:      vendor,
		KeytoolPath: keytoolPath,
		CacertsPath: cacertsPath,
		IsInstalled: isInstalled,
	}, nil
}

func extractJavaMeta(javaPath, keytoolPath string) (version string, vendor string) {
	// Try reading `release` file first
	releasePath := filepath.Join(javaPath, "release")
	if f, err := os.Open(releasePath); err == nil {
		defer f.Close()
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "JAVA_VERSION=") {
				version = strings.Trim(strings.TrimPrefix(line, "JAVA_VERSION="), "\"")
			}
			if strings.HasPrefix(line, "IMPLEMENTOR=") {
				vendor = strings.Trim(strings.TrimPrefix(line, "IMPLEMENTOR="), "\"")
			}
		}
	}

	// Fallback to java -version execution if needed
	if version == "" {
		javaExe := "java"
		if runtime.GOOS == "windows" {
			javaExe = "java.exe"
		}
		binJava := filepath.Join(filepath.Dir(keytoolPath), javaExe)
		cmd := exec.Command(binJava, "-version")
		hideExec(cmd)
		var out bytes.Buffer
		cmd.Stderr = &out
		cmd.Stdout = &out
		if err := cmd.Run(); err == nil {
			output := out.String()
			re := regexp.MustCompile(`version "([^"]+)"`)
			if matches := re.FindStringSubmatch(output); len(matches) > 1 {
				version = matches[1]
			}
			if strings.Contains(output, "OpenJDK") {
				vendor = "OpenJDK"
			} else if strings.Contains(output, "HotSpot") {
				vendor = "Oracle HotSpot"
			}
		}
	}

	if version == "" {
		version = filepath.Base(javaPath)
	}
	if vendor == "" {
		vendor = "Java SE Runtime"
	}
	return version, vendor
}

func (jm *JavaManager) checkAliasInstalled(keytoolPath, cacertsPath string) bool {
	// Check for httpeek-ca or legacy proxypin-ca alias
	for _, alias := range []string{"httpeek-ca", "proxypin-ca"} {
		cmd := exec.Command(keytoolPath, "-list", "-keystore", cacertsPath, "-storepass", "changeit", "-alias", alias)
		hideExec(cmd)
		if err := cmd.Run(); err == nil {
			return true
		}
	}
	return false
}

// InstallCert installs the CA certificate into the specified Java installation.
func (jm *JavaManager) InstallCert(inst JavaInstallation) error {
	if jm.ca == nil || len(jm.ca.CertPEM) == 0 {
		return fmt.Errorf("no Root CA certificate available")
	}

	tmpFile, err := os.CreateTemp("", "httpeek-ca-*.crt")
	if err != nil {
		return fmt.Errorf("create temp cert file failed: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write(jm.ca.CertPEM); err != nil {
		tmpFile.Close()
		return fmt.Errorf("write temp cert failed: %w", err)
	}
	tmpFile.Close()

	// 1. Delete existing alias if present to avoid DuplicateCertificate error
	for _, alias := range []string{"httpeek-ca", "proxypin-ca"} {
		cmdDel := exec.Command(inst.KeytoolPath, "-delete", "-alias", alias, "-keystore", inst.CacertsPath, "-storepass", "changeit")
		hideExec(cmdDel)
		_ = cmdDel.Run()
	}

	// 2. Import Root CA
	cmdImport := exec.Command(
		inst.KeytoolPath,
		"-importcert",
		"-trustcacerts",
		"-alias", "httpeek-ca",
		"-file", tmpFile.Name(),
		"-keystore", inst.CacertsPath,
		"-storepass", "changeit",
		"-noprompt",
	)
	hideExec(cmdImport)
	out, err := cmdImport.CombinedOutput()
	if err != nil {
		return fmt.Errorf("keytool importcert failed: %s (%w)", string(out), err)
	}

	return nil
}

// UninstallCert removes the CA certificate from the specified Java installation.
func (jm *JavaManager) UninstallCert(inst JavaInstallation) error {
	for _, alias := range []string{"httpeek-ca", "proxypin-ca"} {
		cmd := exec.Command(
			inst.KeytoolPath,
			"-delete",
			"-alias", alias,
			"-keystore", inst.CacertsPath,
			"-storepass", "changeit",
		)
		hideExec(cmd)
		_ = cmd.Run()
	}
	return nil
}
