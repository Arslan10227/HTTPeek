/**
 * Secret scanner — detects common API keys, tokens, and credentials
 * in request/response bodies and headers.
 *
 * Each detector has:
 * - id: unique identifier
 * - label: human-readable name
 * - pattern: regex to match the secret
 * - severity: 'high' | 'medium' | 'low'
 * - extractValue: if true, the matched value is included in the finding
 */

export interface SecretFinding {
  id: string;
  label: string;
  severity: 'high' | 'medium' | 'low';
  location: 'request-header' | 'request-body' | 'response-header' | 'response-body' | 'url' | 'cookie';
  key?: string;     // the key/field name where the secret was found
  preview: string;  // masked preview of the matched value
  line?: number;    // line number in the body (if applicable)
}

interface Detector {
  id: string;
  label: string;
  pattern: RegExp;
  severity: 'high' | 'medium' | 'low';
  keyPattern?: RegExp; // optional: capture the key name preceding the value
}

// --- Detectors ---

const detectors: Detector[] = [
  // AWS Access Key ID (starts with AKIA, 20 chars)
  {
    id: 'aws-access-key',
    label: 'AWS Access Key ID',
    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
    severity: 'high',
  },
  // AWS Secret Access Key (40-char base64, typically after "aws_secret" or in JSON)
  {
    id: 'aws-secret-key',
    label: 'AWS Secret Access Key',
    pattern: /(?:aws_secret|secretAccessKey|aws_secret_access_key)["\s:=]+([A-Za-z0-9/+=]{40})\b/gi,
    severity: 'high',
    keyPattern: /(?:aws_secret|secretAccessKey|aws_secret_access_key)/i,
  },
  // Google API Key (AIza followed by 35 chars)
  {
    id: 'google-api-key',
    label: 'Google API Key',
    pattern: /\b(AIza[0-9A-Za-z\-_]{35})\b/g,
    severity: 'high',
  },
  // GitHub Personal Access Token (ghp_ / github_pat_ prefix)
  {
    id: 'github-token',
    label: 'GitHub Token',
    pattern: /\b(gh[pousr]_[A-Za-z0-9]{36})\b/g,
    severity: 'high',
  },
  // Slack Token (xoxb- / xoxp-)
  {
    id: 'slack-token',
    label: 'Slack Token',
    pattern: /\b(xox[bp]-[0-9A-Za-z-]{10,})\b/g,
    severity: 'high',
  },
  // Stripe Secret Key (sk_live_ / sk_test_)
  {
    id: 'stripe-secret-key',
    label: 'Stripe Secret Key',
    pattern: /\b(sk_(?:live|test)_[0-9a-zA-Z]{24,})\b/g,
    severity: 'high',
  },
  // Generic Bearer token in Authorization header
  {
    id: 'bearer-token',
    label: 'Bearer Token',
    pattern: /\b(Bearer\s+[A-Za-z0-9\-_\.=]{20,})\b/g,
    severity: 'medium',
  },
  // Generic API key patterns: "api_key", "apikey", "api-key" followed by a value
  {
    id: 'generic-api-key',
    label: 'API Key',
    pattern: /(?:api[_-]?key|apikey)["\s:=]+([A-Za-z0-9\-_]{20,})\b/gi,
    severity: 'medium',
    keyPattern: /(?:api[_-]?key|apikey)/i,
  },
  // Password / passwd in JSON or form data
  {
    id: 'password',
    label: 'Password',
    pattern: /(?:password|passwd|pwd)["\s:=]+["']?([^\s"']{4,})["']?/gi,
    severity: 'high',
    keyPattern: /(?:password|passwd|pwd)/i,
  },
  // Private key blocks (BEGIN ... PRIVATE KEY)
  {
    id: 'private-key',
    label: 'Private Key',
    pattern: /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+|PGP\s+)?PRIVATE KEY-----/g,
    severity: 'high',
  },
  // JWT tokens (eyJ... header.payload.signature)
  {
    id: 'jwt',
    label: 'JWT Token',
    pattern: /\b(eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)\b/g,
    severity: 'medium',
  },
  // Connection strings with credentials
  {
    id: 'connection-string',
    label: 'Connection String (with credentials)',
    pattern: /\b(?:mongodb|postgres|postgresql|mysql|redis|amqp):\/\/[^\s:@]+:[^\s@]+@[^\s/]+/gi,
    severity: 'high',
  },
  // Generic token patterns: "token", "access_token", "refresh_token", "auth_token"
  {
    id: 'generic-token',
    label: 'Token',
    pattern: /(?:access_token|refresh_token|auth_token|token)["\s:=]+["']?([A-Za-z0-9\-_\.]{20,})["']?/gi,
    severity: 'medium',
    keyPattern: /(?:access_token|refresh_token|auth_token|token)/i,
  },
  // Client secret
  {
    id: 'client-secret',
    label: 'Client Secret',
    pattern: /(?:client_secret|clientsecret)["\s:=]+["']?([A-Za-z0-9\-_]{16,})["']?/gi,
    severity: 'high',
    keyPattern: /(?:client_secret|clientsecret)/i,
  },
];

// --- Masking ---

function maskValue(value: string): string {
  if (value.length <= 8) return '****';
  return value.slice(0, 4) + '****' + value.slice(-4);
}

// --- Scanner ---

export interface ScanInput {
  url?: string;
  requestHeaders?: Record<string, any>;
  requestBody?: string;
  responseHeaders?: Record<string, any>;
  responseBody?: string;
  cookies?: string;
}

export function scanForSecrets(input: ScanInput): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const seen = new Set<string>(); // dedup by id+preview

  const scanText = (
    text: string,
    location: SecretFinding['location'],
  ) => {
    if (!text || typeof text !== 'string') return;
    for (const detector of detectors) {
      // Reset regex lastIndex since we reuse patterns with /g flag
      detector.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = detector.pattern.exec(text)) !== null) {
        const fullMatch = match[0];
        // Use captured group if available, otherwise the full match
        const value = match[1] || fullMatch;
        const preview = maskValue(value);

        // Try to extract key name
        let key: string | undefined;
        if (detector.keyPattern) {
          const keyMatch = fullMatch.match(detector.keyPattern);
          if (keyMatch) key = keyMatch[0];
        } else {
          // For header-based detections, use the header name
          // For body, try to find the key before the value
        }

        // Find line number
        const lineIdx = text.slice(0, match.index).split('\n').length;

        const dedupKey = `${detector.id}:${preview}:${location}:${lineIdx}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        findings.push({
          id: detector.id,
          label: detector.label,
          severity: detector.severity,
          location,
          key,
          preview,
          line: lineIdx,
        });
      }
    }
  };

  // Scan URL (query params often contain tokens)
  if (input.url) {
    scanText(input.url, 'url');
  }

  // Scan request headers
  if (input.requestHeaders) {
    const headerStr = JSON.stringify(input.requestHeaders);
    scanText(headerStr, 'request-header');
  }

  // Scan request body
  if (input.requestBody) {
    scanText(input.requestBody, 'request-body');
  }

  // Scan response headers
  if (input.responseHeaders) {
    const headerStr = JSON.stringify(input.responseHeaders);
    scanText(headerStr, 'response-header');
  }

  // Scan response body
  if (input.responseBody) {
    scanText(input.responseBody, 'response-body');
  }

  // Scan cookies
  if (input.cookies) {
    scanText(input.cookies, 'cookie');
  }

  // Sort: high > medium > low
  const severityOrder = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return findings;
}
