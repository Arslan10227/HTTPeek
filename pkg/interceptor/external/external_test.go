package external

import (
	"context"
	"path/filepath"
	"testing"

	"httpeek/pkg/storage"
)

func setupTestRepo(t *testing.T) (*storage.DB, *storage.ExternalInterceptorRepo) {
	tempDir := t.TempDir()
	db, err := storage.OpenDB(tempDir)
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	repo := storage.NewExternalInterceptorRepo(db)
	return db, repo
}

func TestExternalInterceptorsInstantiation(t *testing.T) {
	db, repo := setupTestRepo(t)
	defer db.Close()

	jvm := NewJVMInterceptor(repo, "non-existent.jar")
	if jvm.Name() != "JVMInterceptor" {
		t.Errorf("expected JVMInterceptor, got %s", jvm.Name())
	}
	if jvm.Priority() != 85 {
		t.Errorf("expected priority 85, got %d", jvm.Priority())
	}
	if jvm.JarPath() != "non-existent.jar" {
		t.Errorf("expected non-existent.jar, got %s", jvm.JarPath())
	}

	term := NewTerminalInterceptor(repo)
	if term.Name() != "TerminalInterceptor" {
		t.Errorf("expected TerminalInterceptor, got %s", term.Name())
	}

	browser := NewBrowserInterceptor(repo)
	if browser.Name() != "BrowserInterceptor" {
		t.Errorf("expected BrowserInterceptor, got %s", browser.Name())
	}

	electron := NewElectronInterceptor(repo)
	if electron.Name() != "ElectronInterceptor" {
		t.Errorf("expected ElectronInterceptor, got %s", electron.Name())
	}

	adb := NewADBInterceptor(repo)
	if adb.Name() != "ADBInterceptor" {
		t.Errorf("expected ADBInterceptor, got %s", adb.Name())
	}

	frida := NewFridaInterceptor(repo)
	if frida.Name() != "FridaInterceptor" {
		t.Errorf("expected FridaInterceptor, got %s", frida.Name())
	}

	docker := NewDockerInterceptor(repo, "test-image:latest")
	if docker.Name() != "docker" {
		t.Errorf("expected docker, got %s", docker.Name())
	}
}

func TestJVMInterceptorMissingJar(t *testing.T) {
	db, repo := setupTestRepo(t)
	defer db.Close()

	jvm := NewJVMInterceptor(repo, filepath.Join(t.TempDir(), "missing.jar"))
	ctx := context.Background()

	_, err := jvm.ListTargets(ctx)
	if err == nil {
		t.Error("expected error for missing jar in ListTargets, got nil")
	}

	err = jvm.Attach(ctx, 1234, "127.0.0.1", 9099, "cert.crt", "")
	if err == nil {
		t.Error("expected error for missing jar in Attach, got nil")
	}

	_, err = jvm.LaunchApplication(ctx, "app.jar", nil, "127.0.0.1", 9099, "cert.crt", "")
	if err == nil {
		t.Error("expected error for missing jar in LaunchApplication, got nil")
	}
}

func TestExternalRepoOperations(t *testing.T) {
	db, repo := setupTestRepo(t)
	defer db.Close()

	runID := "test-run-1"
	err := repo.CreateRun(runID, "TestInterceptor", 9999, `{"key":"val"}`)
	if err != nil {
		t.Fatalf("CreateRun failed: %v", err)
	}

	runs, err := repo.ListRuns(10)
	if err != nil {
		t.Fatalf("ListRuns failed: %v", err)
	}
	if len(runs) != 1 {
		t.Fatalf("expected 1 run, got %d", len(runs))
	}
	if runs[0].ID != runID || runs[0].InterceptorName != "TestInterceptor" {
		t.Errorf("unexpected run details: %+v", runs[0])
	}

	err = repo.FinishRun(runID, "stopped")
	if err != nil {
		t.Fatalf("FinishRun failed: %v", err)
	}

	runs, err = repo.ListRuns(10)
	if err != nil {
		t.Fatalf("ListRuns after finish failed: %v", err)
	}
	if !runs[0].StoppedAt.Valid || !runs[0].Status.Valid || runs[0].Status.String != "stopped" {
		t.Errorf("run not marked stopped properly: %+v", runs[0])
	}
}
