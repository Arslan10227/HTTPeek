package com.httpeek.app.core.rules

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.httpeek.app.model.HttpRequestModel
import com.httpeek.app.model.HttpResponseModel
import java.util.regex.Pattern

data class HostRule(
    val id: String = "",
    val domain: String = "",
    val isRegex: Boolean = false,
    val enabled: Boolean = true
)

data class RewriteRule(
    val id: String = "",
    val name: String = "",
    val urlPattern: String = "",
    val isRegex: Boolean = false,
    val enabled: Boolean = true,
    val redirectUrl: String? = null,
    val modifyHeaders: Map<String, String>? = null,
    val removeHeaders: List<String>? = null,
    val replaceBody: String? = null,
    val overrideStatusCode: Int? = null
)

data class MockRule(
    val id: String = "",
    val name: String = "",
    val urlPattern: String = "",
    val enabled: Boolean = true,
    val responseStatus: Int = 200,
    val responseContentType: String = "application/json",
    val responseHeaders: Map<String, String> = mapOf("Content-Type" to "application/json"),
    val responseBody: String = "{\"status\": \"mocked\"}"
)

/**
 * Rules Engine for HTTPeek Android.
 * Evaluates host whitelists/blacklists, URL rewrites, and mock responses.
 */
class RulesEngine(private val context: Context) {

    companion object {
        private const val PREFS_RULES = "httpeek_rules"
        private const val KEY_WHITELIST = "whitelist"
        private const val KEY_BLACKLIST = "blacklist"
        private const val KEY_REWRITE_RULES = "rewrite_rules"
        private const val KEY_MOCK_RULES = "mock_rules"
    }

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_RULES, Context.MODE_PRIVATE)
    private val gson = Gson()

    var whitelist = mutableListOf<HostRule>()
    var blacklist = mutableListOf<HostRule>()
    var rewriteRules = mutableListOf<RewriteRule>()
    var mockRules = mutableListOf<MockRule>()

    init {
        loadRules()
    }

    fun loadRules() {
        whitelist = loadList(KEY_WHITELIST, object : TypeToken<List<HostRule>>() {}.type)
        blacklist = loadList(KEY_BLACKLIST, object : TypeToken<List<HostRule>>() {}.type)
        rewriteRules = loadList(KEY_REWRITE_RULES, object : TypeToken<List<RewriteRule>>() {}.type)
        mockRules = loadList(KEY_MOCK_RULES, object : TypeToken<List<MockRule>>() {}.type)
    }

    fun saveRules() {
        prefs.edit()
            .putString(KEY_WHITELIST, gson.toJson(whitelist))
            .putString(KEY_BLACKLIST, gson.toJson(blacklist))
            .putString(KEY_REWRITE_RULES, gson.toJson(rewriteRules))
            .putString(KEY_MOCK_RULES, gson.toJson(mockRules))
            .apply()
    }

    private fun <T> loadList(key: String, type: java.lang.reflect.Type): MutableList<T> {
        val json = prefs.getString(key, null) ?: return mutableListOf()
        return try {
            gson.fromJson(json, type) ?: mutableListOf()
        } catch (e: Exception) {
            mutableListOf()
        }
    }

    /**
     * Checks if a domain should be intercepted based on whitelist/blacklist rules.
     */
    fun shouldInterceptHost(host: String): Boolean {
        val cleanHost = host.split(":")[0].lowercase()

        // 1. Blacklist check (if matches any active blacklist rule, bypass)
        for (rule in blacklist) {
            if (!rule.enabled) continue
            if (matchesDomain(cleanHost, rule.domain, rule.isRegex)) {
                return false
            }
        }

        // 2. Whitelist check (if whitelist has active rules, only intercept if matches)
        val activeWhitelist = whitelist.filter { it.enabled }
        if (activeWhitelist.isNotEmpty()) {
            return activeWhitelist.any { matchesDomain(cleanHost, it.domain, it.isRegex) }
        }

        return true
    }

    /**
     * Evaluates active Mock Rules for an incoming request.
     */
    fun evaluateMockRule(request: HttpRequestModel): HttpResponseModel? {
        val url = request.url
        for (rule in mockRules) {
            if (!rule.enabled) continue
            if (matchesUrl(url, rule.urlPattern)) {
                val headersMap = rule.responseHeaders.mapValues { listOf(it.value) }
                return HttpResponseModel(
                    id = "mock_${System.currentTimeMillis()}",
                    statusCode = rule.responseStatus,
                    statusText = "OK (Mocked by HTTPeek)",
                    headers = headersMap,
                    bodyString = rule.responseBody,
                    bodySize = rule.responseBody.toByteArray().size.toLong(),
                    contentType = rule.responseContentType,
                    durationMs = 5
                )
            }
        }
        return null
    }

    /**
     * Evaluates active Rewrite Rules for an incoming request.
     */
    fun evaluateRewriteRequest(request: HttpRequestModel): HttpRequestModel {
        var modified = request
        val url = request.url

        for (rule in rewriteRules) {
            if (!rule.enabled) continue
            if (matchesUrl(url, rule.urlPattern)) {
                var newUrl = modified.url
                if (!rule.redirectUrl.isNullOrEmpty()) {
                    newUrl = rule.redirectUrl
                }

                val newHeaders = (modified.headers?.toMutableMap() ?: mutableMapOf())
                rule.modifyHeaders?.forEach { (k, v) ->
                    newHeaders[k] = listOf(v)
                }
                rule.removeHeaders?.forEach { k ->
                    newHeaders.remove(k)
                }

                val newBody = rule.replaceBody ?: modified.bodyString

                modified = modified.copy(
                    url = newUrl,
                    headers = newHeaders,
                    bodyString = newBody
                )
            }
        }

        return modified
    }

    private fun matchesDomain(host: String, pattern: String, isRegex: Boolean): Boolean {
        if (isRegex) {
            return try {
                Pattern.compile(pattern, Pattern.CASE_INSENSITIVE).matcher(host).find()
            } catch (e: Exception) {
                false
            }
        }

        val p = pattern.lowercase()
        if (p.startsWith("*.")) {
            val suffix = p.substring(2)
            return host == suffix || host.endsWith(".$suffix")
        }
        return host == p || host.endsWith(".$p")
    }

    private fun matchesUrl(url: String, pattern: String): Boolean {
        if (pattern.startsWith("/") && pattern.endsWith("/")) {
            // Regex pattern
            return try {
                Pattern.compile(pattern.substring(1, pattern.length - 1), Pattern.CASE_INSENSITIVE).matcher(url).find()
            } catch (e: Exception) {
                false
            }
        }
        return url.contains(pattern, ignoreCase = true)
    }
}
