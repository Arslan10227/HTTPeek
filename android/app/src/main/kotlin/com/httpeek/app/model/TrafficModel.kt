package com.httpeek.app.model

import com.google.gson.annotations.SerializedName

data class HostPortModel(
    val host: String = "",
    val port: Int = 80,
    val ssl: Boolean = false
)

data class ProcessInfoModel(
    val pid: Int = 0,
    val name: String = "",
    val path: String = "",
    val packageName: String = "",
    val icon: String? = null // Base64 PNG
)

data class HttpResponseModel(
    val id: String? = null,
    val statusCode: Int = 200,
    val statusText: String = "",
    val headers: Map<String, List<String>>? = null,
    val bodyString: String? = null,
    val bodyBase64: String? = null,
    val bodySize: Long = 0,
    val contentType: String = "",
    val durationMs: Long = 0
)

data class HttpRequestModel(
    val id: String = "",
    val method: String = "GET",
    val url: String = "",
    val path: String = "",
    val hostPort: HostPortModel = HostPortModel(),
    val process: ProcessInfoModel? = null,
    val headers: Map<String, List<String>>? = null,
    val bodyString: String? = null,
    val bodyBase64: String? = null,
    val startTime: String = "",
    val durationMs: Long? = null,
    var response: HttpResponseModel? = null,
    var isFavorite: Boolean = false
)

data class EventMessage(
    val event: String,
    val data: Any?
)

data class DiscoveredDesktopBeacon(
    val service: String = "",
    val name: String = "",
    val port: Int = 9099,
    val hostName: String = "",
    val remoteIp: String = "",
    val platform: String = "desktop",
    val timestamp: Long = 0
)

data class NetworkThrottleProfile(
    val id: String = "custom",
    val name: String = "No Throttling",
    val latencyMs: Long = 0,
    val kbpsDown: Long = 0, // 0 = unlimited
    val kbpsUp: Long = 0,
    val dropRate: Float = 0.0f
) {
    companion object {
        val UNLIMITED = NetworkThrottleProfile("unlimited", "Full Speed (Unlimited)", 0, 0, 0, 0f)
        val PROFILE_4G = NetworkThrottleProfile("4g", "4G / LTE (30ms, 20 Mbps)", 30, 20480, 10240, 0f)
        val PROFILE_3G = NetworkThrottleProfile("3g", "3G / HSPA (100ms, 1.5 Mbps)", 100, 1536, 768, 0.01f)
        val PROFILE_2G = NetworkThrottleProfile("2g", "2G / Edge (350ms, 250 Kbps)", 350, 250, 100, 0.05f)
        val PROFILE_WEAK_WIFI = NetworkThrottleProfile("weak_wifi", "Weak Wi-Fi (200ms latency, 10% drop)", 200, 1024, 512, 0.10f)
        val PROFILE_OFFLINE = NetworkThrottleProfile("offline", "Offline / Airplane Mode (100% drop)", 0, 0, 0, 1.0f)

        val ALL_PROFILES = listOf(UNLIMITED, PROFILE_4G, PROFILE_3G, PROFILE_2G, PROFILE_WEAK_WIFI, PROFILE_OFFLINE)
    }
}
