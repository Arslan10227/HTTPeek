package proxy

// MobileAPIBridge exposes app-level operations to the embedded mobile REST API.
type MobileAPIBridge interface {
	ExportHAR(requests []*HttpRequest) (string, error)
	ImportHAR(harJSON, sessionName string) (any, error)
	ListSessions() (any, error)
	CreateSession(name string) (any, error)
	GetSessionRequests(sessionID string) (any, error)
	DeleteSession(sessionID string) error
	GetFavorites() (any, error)
	ToggleFavorite(requestID string, isFavorite bool) error
	GetRules(kind string) (any, error)
	SetRules(kind string, payload []byte) error
	GetAllRules() (map[string]any, error)
	ResumeBreakpoint(requestID string, isResponse bool, modifiedJSON string) error
	AbortBreakpoint(requestID string, isResponse bool) error
	GetReportConfigs() (any, error)
	SetReportConfigs(payload []byte) error
	RepeatRequest(requestID string) (any, error)
	SendCustomRequest(reqJSON string) (any, error)
}

