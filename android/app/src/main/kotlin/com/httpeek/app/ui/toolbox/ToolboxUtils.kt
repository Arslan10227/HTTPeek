package com.httpeek.app.ui.toolbox

import android.util.Base64
import com.google.gson.GsonBuilder
import com.google.gson.JsonParser
import java.net.URLDecoder
import java.net.URLEncoder
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.*
import java.util.regex.Pattern
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

object ToolboxUtils {

    private val prettyGson = GsonBuilder().setPrettyPrinting().create()

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

    // 2. JWT Decoder
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
            prettyGson.toJson(JsonParser.parseString(decoded))
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
                results.add("Match: \"${m.group()}\" at [${m.start()}..${m.end()}]")
            }
            results.ifEmpty { listOf("No matches found") }
        } catch (e: Exception) {
            listOf("Regex Syntax Error: ${e.message}")
        }
    }
}
