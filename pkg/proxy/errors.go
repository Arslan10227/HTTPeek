package proxy

import "errors"

var (
	// ErrBreakpointAborted is returned when a paused breakpoint is aborted by the user.
	ErrBreakpointAborted = errors.New("breakpoint aborted")
	// ErrBreakpointTimeout is returned when a breakpoint pause exceeds the timeout.
	ErrBreakpointTimeout = errors.New("breakpoint timed out")
	// ErrHostFiltered is returned when a host is excluded from capture by the filter.
	ErrHostFiltered = errors.New("host filtered")
)
