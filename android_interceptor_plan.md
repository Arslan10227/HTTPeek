# Android Interceptor System Refactor Plan

## Overview
Refactor the "Apps" section to "Interceptors" with expanded capabilities, rename UI components, add new interceptor types, and integrate Android ADB connectivity. This plan transforms the current per-app filtering-only approach into a full interceptor chain system matching httpToolkit's capabilities while maintaining HTTPeek's core strengths.

---

## 1. Terminology Renaming

### 1.1 Rename "Apps" to "Interceptors"
- **File**: `android/.../ui/apps/AppsFragment.kt` → `android/.../ui/interceptors/InterceptorsFragment.kt`
- **File**: `android/.../ui/apps/AppsFragment.kt` → InterceptorsFragment.kt (rewritten)
- **File**: `android/.../ui/apps/` → `android/.../ui/interceptors/`
- **Update**: All references from `AppsFragment` → `InterceptorsFragment`
- **Update**: Bottom navigation or tab selection text
- **Update**: Menu items, toolbars, and settings

### 1.2 Update Model Packages
- **Current**: `com.httpeek.app.model.InstalledAppItem`, `com.httpeek.app.model.GenericRuleItem`
- **New**: `com.httpeek.app.model.interceptor.*`
- **Create**: 
  - `InterceptorRuleModel` - base class for all interceptor rules
  - `HostFilterRule` - whitelist/blacklist (renamed from HostRule)
  - `RewriteRule` - URL rewrite with mutations
  - `MockRule` - static mock responses
  - `CryptoRule` - payload encryption/decryption
  - `BreakpointRule` - pause execution points
  - `ScriptRule` - JavaScript execution
  - `ThrottleProfile` - network condition simulation

### 1.3 Update UI References
- **BottomNavigationView**: Add "Interceptors" tab or replace "Apps" tab
- **Toolbar/ActionBar**: Update title from "Apps" to "Interceptors"
- **SharedPreferences keys**: Rename `app_filter_mode` → `interceptor_chain_active`
- **Notification texts**: Update from app-related to interceptor-related

---

## 2. New Interceptor Types to Implement

### 2.1 CryptoInterceptor (Rule-Based Encryption/Decryption)

**Purpose**: Decrypt/encrypt request/response bodies using configured rules - similar to httpToolkit's crypto interceptors.

**Rule Structure** (`CryptoRule`):
```kotlin
data class CryptoRule(
    val id: String,
    val name: String,
    val enabled: Boolean,
    val urlPattern: String,      // Pattern to match URLs
    val algorithm: CryptoAlgorithm, // AES_CBC, AES_ECB, AES_GCM, AES_CTR
    val encoding: DataEncoding,    // hex, base64, raw
    val key: String,              // Base64-encoded key (16/24/32 bytes when decoded)
    val iv: String,               // Base64-encoded IV (16 bytes for CBC)
    val decryptRequest: Boolean,  // Decrypt request body?
    val decryptResponse: Boolean  // Decrypt response body?
)
```

**Implementation Locations**:
- **`android/.../core/rules/RulesEngine.kt`**: Add `evaluateCryptoRule()` method
- **`android/.../core/proxy/MitmProxyServer.kt`**: Integrate into request/response processing pipeline
- **`android/.../ui/interceptors/`**: UI for creating/editing crypto rules

**Crypto Algorithms Support**:
- AES_CBC with PKCS7 padding (already implemented in `pkg/interceptor/crypto.go`)
- AES_ECB with PKCS7 padding
- AES_GCM (authenticated encryption)
- AES_CTR (stream cipher)

**UI Flow**:
1. InterceptorsFragment → "Add Crypto Rule"
2. Dialog with: algorithm selector, encoding selector, key/IV fields (base64 encoded)
3. URL pattern field with regex builder
4. Test decryption button (sample payload)
5. Save rule → applied to all matching traffic

### 2.2 BreakpointInterceptor (Pause at Points)

**Purpose**: Pause traffic at specific points for interactive inspection - similar to httpToolkit's breakpoint feature.

**Rule Structure** (`BreakpointRule`):
```kotlin
data class BreakpointRule(
    val id: String,
    val name: String,
    val enabled: Boolean,
    urlPattern: String,           // URL pattern to match
    interceptRequest: Boolean,    // Pause when request received?
    interceptResponse: Boolean,   // Pause when response received?
    stage: BreakpointStage,       // "request", "response", "both"
    timeoutMs: Int,               // Max pause duration (milliseconds)
    condition: BreakpointCondition // e.g., "always", "on_error", "on_status_4xx"
)
```

**BreakpointStage**: "request", "response", "both"

**BreakpointCondition**: "always", "on_error", "on_client_disconnect", "on_status_2xx", "on_status_4xx", "on_status_5xx"

**Implementation Locations**:
- **`android/.../core/rules/RulesEngine.kt`**: Add `shouldBreakpoint()` evaluation
- **`android/.../core/proxy/MitmProxyServer.kt`**: Integrate into OnRequest/OnResponse pipeline
- **`android/.../ui/interceptors/InterceptorsFragment.kt`**: UI for creating breakpoint rules

**Breakpoint UI Flow**:
1. InterceptorsFragment → "Add Breakpoint Rule"
2. Dialog with:
   - Stage selector (request/response/both)
   - Condition selector (always/on_error/etc.)
   - Timeout in minutes
   - URL pattern field
3. When breakpoint triggered:
   - UI shows "Breakpoint paused" indicator
   - Send event to desktop bridge
   - Allow user to modify and resume, or abort

### 2.3 ScriptInterceptor (JavaScript Execution)

**Purpose**: Execute JavaScript rules on request/response - httpToolkit's main differentiator.

**Rule Structure** (`ScriptRule`):
```kotlin
data class ScriptRule(
    val id: String,
    val name: String,
    val enabled: Boolean,
    val urlPattern: String,
    val scriptType: ScriptType,      // "beforeRequest", "afterResponse", "onError"
    val javascriptCode: String,      // JS code to execute
    varargs: Map<String, String>    // Additional variables
)
```

**ScriptType**: "beforeRequest", "afterResponse", "onError", "onBreakpoint"

**JavaScript API available**:
- `request.headers`, `request.body`, `request.url`, `request.method`
- `response.status`, `response.headers`, `response.body`, `response.duration`
- `interceptor.applyRule(id)`, `interceptor.abort()`, `interceptor.resume()`
- `log(message)`, `warn(message)`, `error(message)`

**Implementation Locations**:
- **Use Goja** (`github.com/dop251/goja`) for JS runtime - already a dependency in go.mod
- **`android/.../scriptengine/`**: New package for script engine integration
- **`android/.../core/rules/RulesEngine.kt`**: Add script evaluation
- **`android/.../core/proxy/MitmProxyServer.kt`**: Integrate into pipeline

**JS Execution Flow**:
1. Request comes in → RulesEngine evaluates ScriptRule
2. If matched, JS code executes in Goja sandbox
3. JS can modify request/response properties
4. Return modified request/response, or abort
5. Timeout after configured duration (default 5s)
6. On error: log and continue without script modification

**Security Sandbox**:
- No access to OS filesystem
- No network calls from JS
- Timeout after 5 seconds max
- Whitelist of allowed globals (Math, JSON, Date, etc.)

### 2.4 HostFilterRule (Enhanced Whitelist/Blacklist)

**Purpose**: Enhanced host filtering with priority and conditional logic.

**Current**: Simple whitelist/blacklist in AppFilterManager
**New**: Rule-based with priority, exceptions, and per-URL patterns

**Rule Structure** (`HostFilterRule`):
```kotlin
data class HostFilterRule(
    val id: String,
    val name: String,
    val enabled: Boolean,
    val pattern: String,          // Domain pattern (supports * wildcards, regex)
    val filterType: FilterType,   // "whitelist", "blacklist"
    val action: FilterAction,     // "intercept", "bypass", "redirect"
    val redirectUrl: String?,     // If action=redirect
    val priority: Int,            // Higher priority processes first
    val exceptions: List<String>  // Hosts always bypass this rule
)
```

**FilterType**: "whitelist", "blacklist"
**FilterAction**: "intercept", "bypass", "redirect", "throttle"

**Implementation**:
- **`android/.../core/rules/RulesEngine.kt`**: Enhanced `shouldInterceptHost()` with priority
- **`android/.../core/proxy/MitmProxyServer.kt`**: Priority-based rule evaluation
- **`android/.../ui/interceptors/`**: Advanced host filter management UI

---

## 3. Android ADB Connect Integration

### 3.1 ADB Connection Flow

**Purpose**: Allow Android device to connect to HTTPeek Desktop via ADB reverse tunnel, enabling traffic capture without same-network requirements.

**Flow**:
1. User enables "ADB Connect" in InterceptorsFragment
2. App prompts for ADB permissions (if not granted)
3. App executes `adb connect <desktop-ip>:<port>` via Runtime
4. App verifies connection via `adb tcpip 9099` + ping
5. Desktop bridge WebSocket connects with ADB-derived token
6. Traffic flows through ADB reverse tunnel

**Implementation Locations**:
- **`android/.../ui/interceptors/InterceptorsFragment.kt`**: ADB connect/disconnect button
- **`android/.../core/bridge/ADBConnectionManager.kt`** (NEW): ADB connection management
- **`android/.../HttpeekVpnService.kt`**: ADB connection intent handling

**ADBConnectionManager** methods:
```kotlin
object ADBConnectionManager {
    fun connect(host: String, port: Int = 5555): Pair<Boolean, String>
    fun disconnect(host: String): Boolean
    fun isConnected(host: String): Boolean
    fun getConnectedDevices(): List<ADBDevice>
    fun onADBDeviceAdded(listener: (ADBDevice) -> Unit)
    fun onADBDeviceRemoved(listener: (ADBDevice) -> Unit)
}
```

**ADBDevice** data class:
```kotlin
data class ADBDevice(
    val serial: String,
    val model: String,
    val product: String,
    val isOnline: Boolean,
    val apiLevel: Int
)
```

**Permissions Required** (AndroidManifest.xml):
```xml
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_PHONE_STATE" /> <!-- optional -->
```

**ADB Command Execution**:
```kotlin
private fun executeAdbCommand(command: String): String {
    return Runtime.getRuntime().exec(
        arrayOf("adb", *command.split(" "))
    ).run { 
        reader.bufferedReader().use { readLine() }
    }
}
```

### 3.2 ADB Connect UI

**InterceptorsFragment UI**:
```
+----------------------------------------+
|   Interceptor Rules                    |
|  [ + ] [ - ]  Add Rule                 |
|                                        |
|   ADB Connect                          |  ← NEW
|   [ CONNECT ]                           |
|   Device: [input]  Port: [9555]        |
|                                        |
|   VPN Status: • 9099                   |
+----------------------------------------+
```

**ADB Connect Dialog**:
- Input field for desktop IP address
- Port spinner (default 5555, common ADB port)
- "Discover on LAN" button (uses `adb devices` broadcast)
- "Pair via QR code" option (existing flow)
- "Cancel" button

**Status Indicators**:
- "ADB: Connected to 192.168.1.50:5555" (green)
- "ADB: Offline" (gray)
- "ADB: Connection failed" (red with retry)

---

## 4. UI/UX Improvements for Interceptors

### 4.1 InterceptorsFragment Layout

**New Layout Structure** (`fragment_interceptors.xml`):
```xml
<com.google.android.material.appbar.MaterialToolbar
    android:id="@+id/toolbar"
    android:title="Interceptors"
    .../>

<androidx.viewpager2.widget.ViewPager2
    android:id="@+id/viewpager"
    .../>

<com.google.android.material.bottomnavigation.BottomNavigationView
    android:id="@+id/bottom_nav"
    .../>
```

**ViewPager2 Tabs** (swipe between):
1. **Rules** - Add/edit/delete interceptor rules (rewrite, mock, crypto, breakpoint, script)
2. **Host Filter** - Host whitelist/blacklist management
3. **Throttle** - Network condition simulation
4. **ADB Connect** - ADB reverse tunnel management
5. **Presets** - Pre-configured interceptor profiles

**Bottom Navigation Items**:
- Interceptors (selected)
- Traffic
- Certificate
- Tools
- Settings

### 4.2 Rules Management UI

**Add Rule Dialog** (per rule type):

**Crypto Rule Dialog**:
```
+-------------------------------+
| Add Crypto Rule               |
+-------------------------------+
| Algorithm: [AES_GCM ___]        |
| Encoding: [Base64 ___]          |
| Key:    [base64: ___]           |
| IV:     [base64: ___]           |
| Decrypt Request: ☐              |
| Decrypt Response: ☐             |
| URL Pattern:  [https?://___]    |
|        [regex: ___]             |
+-------------------------------+
|          [Test]  [Save]         |
+-------------------------------+
```

**Breakpoint Rule Dialog**:
```
+-------------------------------+
| Add Breakpoint Rule           |
+-------------------------------+
| Stage:      [Request ___]       |
| Condition:  [Always ___]        |
| Timeout:    [5] min             |
| URL Pattern:  [https?://___]    |
|        [regex: ___]             |
+-------------------------------+
|   [Abort]  [Resume]  [Save]    |
+-------------------------------+
```

**Script Rule Dialog**:
```
+-------------------------------+
| Add Script Rule               |
+-------------------------------+
| Type:         [beforeRequest]   |
| JS Code:                       |
| [// Decode body                 |
|  const decoded = atob(key)     |
|  return decoded(body)]          |
| URL Pattern:  [https?://___]    |
+-------------------------------+
|   [Validate]  [Save]           |
+-------------------------------+
```

### 4.3 Throttle Profile UI

**Existing**: `Preset2G`, `Preset3G`, `Preset4G`, `Preset5G`, `PresetWiFi`, `PresetDSL`, `PresetOffline`
**Enhanced**: Allow users to create custom throttle profiles

**Custom Throttle Profile Dialog**:
```
+--------------------------+
| Custom Network Profile   |
+--------------------------+
| Name:          [My WiFi __]|
| Downstream:    [5000] Kbps|
| Upstream:      [1000] Kbps |
| Latency:       [50] ms     |
| Jitter:        [10] ms     |
| Drop Rate:     [0] %       |
|                        |
|  [Save]  [Cancel]          |
+--------------------------+
```

### 4.4 ADB Connect UI Improvements

**Status Cards**:
```
+--------------------------+
| ADB Connection           |
+--------------------------+
| Status:   • CONNECTED    |
| Device:   GT-N8000       |
| IP:       192.168.1.50   |
|          [DISCONNECT]    |
+--------------------------+

+--------------------------+
| ADB Connection           |
+--------------------------+
| Status:   • DISCONNECTED |
|          [CONNECT]       |
+--------------------------+
```

**QR Code Pairing** from ADB screen:
- "Pair via QR code" launches existing QrScanActivity
- "Enter Manually" shows IP:Port fields
- "Discover Devices" runs `adb devices` and lists detected devices

---

## 5. Rules Engine Enhancements

### 5.1 RulesEngine.kt Additions

**New Methods**:

```kotlin
// Crypto evaluation
fun evaluateCryptoRule(rule: CryptoRule, request: HttpRequestModel, response: HttpResponseModel): 
    Triple<Boolean, HttpRequestModel?, HttpResponseModel?>

// Breakpoint evaluation
fun evaluateBreakpointRule(rule: BreakpointRule, ctx: Context?): BreakpointResult

// Script evaluation
fun evaluateScriptRule(rule: ScriptRule, request: HttpRequestModel, response: HttpResponseModel): 
    Triple<Boolean, HttpRequestModel?, HttpResponseModel?>

// Host filter with priority
fun shouldInterceptHost(host: String, priority: Int = 0): Boolean

// Throttle evaluation  
fun applyThrottleProfile(profile: ThrottleProfile, direction: ThrottleDirection): Boolean
```

**BreakpointResult**:
```kotlin
data class BreakpointResult(
    val shouldPause: Boolean,
    val stage: BreakpointStage,
    val timeoutMs: Int,
    val modification: Modifier?  // Optional request/response modification
)
```

**Modifier**:
```kotlin
data class Modifier(
    val request: HttpRequestModel? = null,
    val response: HttpResponseModel? = null
)
```

### 5.2 Rules Persistence

**SharedPreferences Structure**:
```kotlin
private const val PREFS_NAME = "httpeek_interceptors"
private const val KEY_CRYPTO_RULES = "crypto_rules"
private const val KEY_BREAKPOINT_RULES = "breakpoint_rules"
private const val KEY_SCRIPT_RULES = "script_rules"
private const val KEY_HOST_FILTERS = "host_filters"
private const val KEY_THROTTLE_PROFILES = "throttle_profiles"
private const val KEY_ACTIVE_CHAIN = "active_chain" // "host_filter|rewrite|mock|crypto|breakpoint|script"
```

**Sync with Desktop**:
- `rules:sync` WebSocket event includes all interceptor rule types
- Android `RulesEngine.importRulesFromDesktopJson()` parses new rule types
- Bidirectional sync: Android changes → desktop WebSocket → desktop rules editor

### 5.3 Rule Priority Order

**Default Chain** (matches desktop priority):
1. **HostFilter** - whitelist/blacklist (highest priority - bypass first)
2. **Crypto** - decrypt/encrypt (if matched, transform before forwarding)
3. **Rewrite** - URL/body/header modifications
4. **Mock** - return synthetic response (short-circuit)
5. **Breakpoint** - pause for inspection (if triggered, may short-circuit)
6. **Script** - execute JS (modify or abort)
7. **Forward to upstream** - original MitmProxyServer flow
8. **Throttle** - apply network conditions to actual traffic

**Priority Logic**:
- Each interceptor has `priority` field (lower = executes first)
- `RulesEngine.evaluateChain(host, request, response)` iterates in priority order
- First interceptor that modifies or decides wins; subsequent interceptors skipped
- If none modify, traffic flows normally to upstream

---

## 6. Migration Plan

### 6.1 Phase 1: Foundation (Week 1)
- [ ] Rename "Apps" → "Interceptors" UI
- [ ] Create `InterceptorsFragment` as main entry point
- [ ] Move existing AppsFragment functionality to Interceptors
- [ ] Update all navigation references
- [ ] Test existing per-app filtering still works

### 6.2 Phase 2: New Interceptor Types (Week 2-3)
- [ ] Implement CryptoRule in RulesEngine and MitmProxyServer
- [ ] Implement BreakpointRule in RulesEngine and MitmProxyServer
- [ ] Create CryptoRule and BreakpointRule UI dialogs
- [ ] Add rules persistence for new types
- [ ] Test with desktop rules sync

### 6.3 Phase 3: ScriptInterceptor (Week 4)
- [ ] Integrate Goja JS runtime
- [ ] Create ScriptRule model and UI
- [ ] Implement script sandbox with timeout
- [ ] Add JS API documentation in UI
- [ ] Test script execution on sample payloads

### 6.4 Phase 4: ADB Connect (Week 5)
- [ ] Create ADBConnectionManager
- [ ] Implement ADB command execution
- [ ] Create ADB Connect UI in InterceptorsFragment
- [ ] Test ADB connect/discover/device listing
- [ ] Handle Android permission flows

### 6.5 Phase 5: UI/UX Polish (Week 6)
- [ ] Design all new dialogs and screens
- [ ] Implement bottom navigation with Interceptors tab
- [ ] Create preset interceptor profiles
- [ ] Add tooltips and help text for new features
- [ ] Material Design 3 compliance review
- [ ] User testing feedback incorporation

### 6.6 Phase 6: Stability & Release (Week 7)
- [ ] Full regression testing
- [ ] Performance testing with multiple active interceptors
- [ ] Memory usage profiling
- [ ] Battery impact analysis
- [ ] Release candidate build
- [ ] Publish to internal testing track

---

## 7. Comparison: HTTPeek vs httpToolkit Interceptors

| Feature | HTTPeek (Planned) | httpToolkit |
|---------|------------------|-------------|
| **Host Filter** | ✅ Priority-based whitelist/blacklist | ✅ |
| **Rewrite Rules** | ✅ URL/body/header modification | ✅ |
| **Mock Responses** | ✅ Static body/headers/status | ✅ |
| **Crypto/Encoding** | ✅ AES/Base64/Hex (new) | ✅ Full suite |
| **Breakpoints** | ✅ Pause/inspect/resume (new) | ✅ |
| **Script/JS** | ✅ Goja sandbox (new) | ✅ Main feature |
| **Throttle** | ✅ Global profiles + custom (enhanced) | ✅ |
| **ADB Connect** | ✅ Reverse tunnel (new) | ❌ |
| **Priority Chain** | ✅ Configurable order (new) | ✅ Limited |
| **Per-App Filtering** | ✅ Existing VPN filter | ❌ (different focus) |

---

## 8. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Goja script sandbox escape** | Security vulnerability | Strict API whitelist, 5s timeout, no filesystem/network access |
| **Crypto rule misconfiguration** | Traffic decryption failure | Key size validation, default to pass-through on error |
| **Breakpoint UI confusion** | User can't resume traffic | Clear UI state, automatic resume after timeout, abort option |
| **Script timeout performance** | UI freeze | Background executor, non-blocking execution, cancellation support |
| **ADB permission issues** | Can't connect devices | Graceful fallback to manual IP:Port entry, clear error messages |
| **Rules sync compatibility** | Desktop/Android rule mismatch | Version checking, incremental sync, fallback to local rules only |
| **Performance overhead** | Battery/drain from multiple interceptors | Profile each interceptor, optional disabled-by-default, lazy loading |

---

## 9. Success Metrics

- **Adoption**: 50%+ of existing Users try new interceptor types within 2 weeks
- **Performance**: <5% battery impact with all interceptors enabled
- **Reliability**: 99.9% of rule executions complete without crash
- **Script success rate**: 90%+ of JS scripts execute without timeout/error
- **ADB connect success**: 80%+ of attempts succeed on first try (same network)
- **User satisfaction**: >4/5 rating for "Interceptor ease of use" in post-use survey

---

## 10. Next Immediate Steps

1. **This sprint**: Rename Apps→Interceptors, migrate existing functionality
2. **Next sprint**: Implement CryptoRule (highest user demand based on httpToolkit features)
3. **Following sprint**: Add BreakpointRule + ADB Connect
4. **Roadmap**: ScriptRule integration in next release cycle

---
*Plan generated based on deep analysis of HTTPeek Android codebase and httpToolkit interceptor reference implementation.*