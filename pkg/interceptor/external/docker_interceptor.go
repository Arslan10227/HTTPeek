package external

import (
    "context"
    "fmt"
    "os/exec"
    "time"

    "httpeek/pkg/interceptor"
    "httpeek/pkg/storage"
)

type DockerInterceptor struct {
    interceptor.BaseInterceptor
    repo       *storage.ExternalInterceptorRepo
    cmd        *exec.Cmd
    runID      string
    imageName  string
    containerID string
}

func NewDockerInterceptor(repo *storage.ExternalInterceptorRepo, imageName string) *DockerInterceptor {
    base := interceptor.NewBaseInterceptor("docker", 95, true)
    return &DockerInterceptor{BaseInterceptor: base, repo: repo, imageName: imageName}
}


// Start runs the Docker container that sets up the proxy.
func (d *DockerInterceptor) Start(ctx context.Context) error {
    // Generate a unique run ID.
    d.runID = fmt.Sprintf("docker-%d", time.Now().UnixNano())
    // Pull image (optional) and run container.
    d.cmd = exec.CommandContext(ctx, "docker", "run", "--rm", "--name", d.runID, d.imageName)
    if err := d.cmd.Start(); err != nil {
        return fmt.Errorf("failed to start docker interceptor: %w", err)
    }
    // Record run in DB.
    pid := d.cmd.Process.Pid
    if err := d.repo.CreateRun(d.runID, d.Name(), pid, "{}" ); err != nil {
        return err
    }
    go func() {
        // Wait for command to finish and then mark finished.
        err := d.cmd.Wait()
        status := "stopped"
        if err != nil {
            status = fmt.Sprintf("error: %v", err)
        }
        _ = d.repo.FinishRun(d.runID, status)
    }()
    return nil
}

func (d *DockerInterceptor) Stop(ctx context.Context) error {
    if d.cmd == nil || d.cmd.Process == nil {
        return fmt.Errorf("docker interceptor not running")
    }
    // Stop container via docker stop.
    stopCmd := exec.CommandContext(ctx, "docker", "stop", d.runID)
    if out, err := stopCmd.CombinedOutput(); err != nil {
        return fmt.Errorf("failed to stop docker container: %v, output: %s", err, string(out))
    }
    // Wait for process termination handled in goroutine.
    return nil
}

// Ensure DockerInterceptor satisfies the Interceptor interface.
var _ interceptor.Interceptor = (*DockerInterceptor)(nil)
