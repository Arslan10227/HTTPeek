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
    val path: String = ""
)

data class HttpResponseModel(
    val id: String? = null,
    val statusCode: Int = 200,
    val statusText: String = "",
    val headers: Map<String, List<String>>? = null,
    val bodyString: String? = null,
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
    val startTime: String = "",
    val durationMs: Long? = null,
    var response: HttpResponseModel? = null,
    var isFavorite: Boolean = false
)

data class EventMessage(
    val event: String,
    val data: Any?
)
