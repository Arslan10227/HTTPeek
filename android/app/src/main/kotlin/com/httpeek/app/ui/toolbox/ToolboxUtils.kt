package com.httpeek.app.ui.toolbox

import android.util.Base64
import com.google.gson.GsonBuilder
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayInputStream
import java.net.URLDecoder
import java.net.URLEncoder
import java.security.MessageDigest
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

object ToolboxUtils {

    private val prettyGson = GsonBuilder().setPrettyPrinting().create()
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    // 1. AES Encryption & Decryption
    fun aesEncrypt(data: String, key: String, iv: String = ""): String {
        return try {
            val keyBytes = key.toByteArray(Charsets.UTF_8).copyOf(16)
            val secretKey = SecretKeySpec(keyBytes, "AES")
            val cipher = if (iv.isEmpty()) {
                Cipher.getInstance("AES/ECB/PKCS5Padding").apply { init(Cipher.ENCRYPT_MODE, secretKey) }
            } else {
                val ivBytes = iv.toByteArray(Charsets.UTF_8).copyOf(16)
                Cipher.getInstance("AES/CBC/PKCS5Padding").apply { init(Cipher.ENCRYPT_MODE, secretKey, IvParameterSpec(ivBytes)) }
            }
            val encrypted = cipher.doFinal(data.toByteArray(Charsets.UTF_8))
            Base64.encodeToString(encrypted, Base64.NO_WRAP)
        } catch (e: Exception) {
            "Error: ${e.message}"
        }
    }

    fun aesDecrypt(base64Data: String, key: String, iv: String = ""): String {
        return try {
            val keyBytes = key.toByteArray(Charsets.UTF_8).copyOf(16)
            val secretKey = SecretKeySpec(keyBytes, "AES")
            val cipher = if (iv.isEmpty()) {
                Cipher.getInstance("AES/ECB/PKCS5Padding").apply { init(Cipher.DECRYPT_MODE, secretKey) }
            } else {
                val ivBytes = iv.toByteArray(Charsets.UTF_8).copyOf(16)
                Cipher.getInstance("AES/CBC/PKCS5Padding").apply { init(Cipher.DECRYPT_MODE, secretKey, IvParameterSpec(ivBytes)) }
            }
            val decrypted = cipher.doFinal(Base64.decode(base64Data.trim(), Base64.DEFAULT))
            String(decrypted, Charsets.UTF_8)
        } catch (e: Exception) {
            "Error: ${e.message}"
        }
    }

    // 2. JWT Decoder & Verification
    fun decodeJwt(jwt: String): Pair<String, String> {
        val parts = jwt.trim().split(".")
        if (parts.size < 2) return Pair("Invalid JWT", "Token must contain at least 2 parts (header.payload.signature)")

        val header = try {
            val decoded = String(Base64.decode(parts[0], Base64.URL_SAFE or Base64.NO_PADDING), Charsets.UTF_8)
            prettyGson.toJson(JsonParser.parseString(decoded))
        } catch (e: Exception) {
            "Failed to decode header: ${e.message}"
        }

        val payload = try {
            val decoded = String(Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_PADDING), Charsets.UTF_8)
            val jsonEl = JsonParser.parseString(decoded)
            val formatted = prettyGson.toJson(jsonEl)

            // Check expiration if present
            if (jsonEl.isJsonObject && jsonEl.asJsonObject.has("exp")) {
                val exp = jsonEl.asJsonObject.get("exp").asLong
                val now = System.currentTimeMillis() / 1000
                val expDate = SimpleDateFormat("yyyy-MM-dd HH:mm:ss z", Locale.getDefault()).format(Date(exp * 1000))
                val isExpired = now > exp
                "$formatted\n\n--- Claims Info ---\nStatus: ${if (isExpired) "⚠️ EXPIRED" else "✅ VALID"}\nExpires: $expDate"
            } else {
                formatted
            }
        } catch (e: Exception) {
            "Failed to decode payload: ${e.message}"
        }

        return Pair(header, payload)
    }

    // 3. Hashes & Encoders
    fun hashString(input: String, algorithm: String): String {
        return try {
            val md = MessageDigest.getInstance(algorithm)
            val digest = md.digest(input.toByteArray(Charsets.UTF_8))
            digest.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            "Error: ${e.message}"
        }
    }

    fun urlEncode(input: String): String = try { URLEncoder.encode(input, "UTF-8") } catch (e: Exception) { "Error" }
    fun urlDecode(input: String): String = try { URLDecoder.decode(input, "UTF-8") } catch (e: Exception) { "Error" }

    fun base64Encode(input: String): String = Base64.encodeToString(input.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
    fun base64Decode(input: String): String = try { String(Base64.decode(input, Base64.DEFAULT), Charsets.UTF_8) } catch (e: Exception) { "Error" }

    fun hexEncode(input: String): String = input.toByteArray(Charsets.UTF_8).joinToString("") { "%02x".format(it) }
    fun hexDecode(hex: String): String = try {
        val clean = hex.replace(" ", "").replace("\n", "")
        val bytes = ByteArray(clean.length / 2) { i ->
            clean.substring(i * 2, i * 2 + 2).toInt(16).toByte()
        }
        String(bytes, Charsets.UTF_8)
    } catch (e: Exception) { "Hex decode error: ${e.message}" }

    // 4. Timestamp Converter
    fun convertEpochToDate(epoch: Long): String {
        val ms = if (epoch < 10000000000L) epoch * 1000 else epoch
        val d = Date(ms)
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss z (XXX)", Locale.getDefault())
        return sdf.format(d)
    }

    fun convertDateToEpoch(dateStr: String): Long {
        val formats = arrayOf(
            "yyyy-MM-dd HH:mm:ss",
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd"
        )
        for (fmt in formats) {
            try {
                val sdf = SimpleDateFormat(fmt, Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
                val d = sdf.parse(dateStr)
                if (d != null) return d.time
            } catch (e: Exception) {}
        }
        return -1L
    }

    // 5. Regex Tester
    fun testRegex(pattern: String, text: String): List<String> {
        return try {
            val p = Pattern.compile(pattern)
            val m = p.matcher(text)
            val results = mutableListOf<String>()
            while (m.find()) {
                results.add("Match: \"${m.group()}\" at index [${m.start()}..${m.end()}]")
            }
            results.ifEmpty { listOf("No matches found for pattern: $pattern") }
        } catch (e: Exception) {
            listOf("Regex Syntax Error: ${e.message}")
        }
    }

    // 6. Cert Subject Hash Calculator
    fun calculateCertHash(certPem: String): String {
        return try {
            val clean = certPem.trim()
            val cf = CertificateFactory.getInstance("X.509")
            val cert = cf.generateCertificate(ByteArrayInputStream(clean.toByteArray(Charsets.UTF_8))) as X509Certificate

            val subjectX500 = cert.subjectX500Principal.encoded
            val md5 = MessageDigest.getInstance("MD5").digest(subjectX500)
            val oldHash = (md5[0].toInt() and 0xFF) or
                    ((md5[1].toInt() and 0xFF) shl 8) or
                    ((md5[2].toInt() and 0xFF) shl 16) or
                    ((md5[3].toInt() and 0xFF) shl 24)
            val oldHashStr = "%08x".format(oldHash.toLong() and 0xFFFFFFFFL)

            val sha1 = MessageDigest.getInstance("SHA-1").digest(subjectX500)
            val newHash = (sha1[0].toInt() and 0xFF) or
                    ((sha1[1].toInt() and 0xFF) shl 8) or
                    ((sha1[2].toInt() and 0xFF) shl 16) or
                    ((sha1[3].toInt() and 0xFF) shl 24)
            val newHashStr = "%08x".format(newHash.toLong() and 0xFFFFFFFFL)

            "Subject: ${cert.subjectX500Principal}\n" +
            "Issuer: ${cert.issuerX500Principal}\n" +
            "Serial Number: ${cert.serialNumber}\n" +
            "Valid From: ${cert.notBefore}\n" +
            "Valid Until: ${cert.notAfter}\n\n" +
            "• Android Old Hash (cacerts): $oldHashStr.0\n" +
            "• Android New Hash (SHA-1): $newHashStr.0"
        } catch (e: Exception) {
            "Certificate Parse Error: ${e.message}"
        }
    }

    // 7. Mobile HTTP Request Composer
    suspend fun sendHttpRequest(
        method: String,
        url: String,
        headersText: String,
        bodyText: String
    ): String = withContext(Dispatchers.IO) {
        val start = System.currentTimeMillis()
        try {
            val reqBuilder = Request.Builder().url(url)

            if (headersText.isNotBlank()) {
                headersText.lines().forEach { line ->
                    val colon = line.indexOf(':')
                    if (colon > 0) {
                        val k = line.substring(0, colon).trim()
                        val v = line.substring(colon + 1).trim()
                        reqBuilder.addHeader(k, v)
                    }
                }
            }

            val body = if (method in listOf("POST", "PUT", "PATCH")) {
                bodyText.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
            } else null

            reqBuilder.method(method, body)
            val response = httpClient.newCall(reqBuilder.build()).execute()
            val duration = System.currentTimeMillis() - start
            val respBody = response.body?.string() ?: ""

            val formattedBody = try {
                val jsonEl = JsonParser.parseString(respBody)
                prettyGson.toJson(jsonEl)
            } catch (e: Exception) {
                respBody
            }

            val headersFormatted = response.headers.joinToString("\n") { "${it.first}: ${it.second}" }

            "HTTP/${response.protocol} ${response.code} ${response.message} (${duration}ms)\n\n" +
            "--- Response Headers ---\n$headersFormatted\n\n" +
            "--- Response Body (${respBody.length} bytes) ---\n$formattedBody"
        } catch (e: Exception) {
            "Request Failed: ${e.localizedMessage}"
        }
    }
}
