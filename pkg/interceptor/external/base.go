package external

import (
    "httpeek/pkg/interceptor"
    "httpeek/pkg/proxy"
)

// ExternalInterceptor provides a base implementation for interceptors that run external processes
// such as Docker, ADB, Frida, or JVM agents. It embeds BaseInterceptor to get default fields
// and implements the Interceptor interface with no‑op methods. Concrete interceptors should
// embed this struct and override the methods they need.
type ExternalInterceptor struct {
    interceptor.BaseInterceptor
    // Command to execute for starting the external process. Concrete interceptors set this.
    Cmd string
    // Args are the command‑line arguments for the external process.
    Args []string
    // PID of the started process, if applicable.
    pid int
}

// NewExternalInterceptor creates a new ExternalInterceptor with the given name, priority, and
// enabled flag. It does not start any process; that is the responsibility of the concrete
// implementation.
func NewExternalInterceptor(name string, priority int, enabled bool) *ExternalInterceptor {
    return &ExternalInterceptor{
        BaseInterceptor: interceptor.NewBaseInterceptor(name, priority, enabled),
    }
}

// PreConnect can be used to inject proxy environment variables before a connection is made.
func (e *ExternalInterceptor) PreConnect(ctx *proxy.Context, hp proxy.HostPort) (proxy.HostPort, error) {
    // Default implementation does nothing.
    return hp, nil
}

// OnRequest, Execute, OnResponse, OnError default to the embedded BaseInterceptor behavior.
func (e *ExternalInterceptor) OnRequest(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpRequest, error) {
    return e.BaseInterceptor.OnRequest(ctx, req)
}

func (e *ExternalInterceptor) Execute(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpResponse, error) {
    return e.BaseInterceptor.Execute(ctx, req)
}

func (e *ExternalInterceptor) OnResponse(ctx *proxy.Context, req *proxy.HttpRequest, resp *proxy.HttpResponse) (*proxy.HttpResponse, error) {
    return e.BaseInterceptor.OnResponse(ctx, req, resp)
}

func (e *ExternalInterceptor) OnError(ctx *proxy.Context, req *proxy.HttpRequest, err error) {
    e.BaseInterceptor.OnError(ctx, req, err)
}

// Start launches the external command. Concrete interceptors may provide more sophisticated
// handling (e.g., capturing output, monitoring lifecycle). This stub simply records the PID.
func (e *ExternalInterceptor) Start() error {
    // Placeholder: real implementation will exec.Command.
    return nil
}

// Stop terminates the external process if it was started.
func (e *ExternalInterceptor) Stop() error {
    // Placeholder: real implementation will kill the process.
    return nil
}
