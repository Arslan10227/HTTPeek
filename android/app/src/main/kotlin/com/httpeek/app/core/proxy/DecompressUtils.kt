package com.httpeek.app.core.proxy

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.nio.charset.Charset
import java.util.zip.GZIPInputStream
import java.util.zip.Inflater
import java.util.zip.InflaterInputStream

/**
 * High-performance response decompression & UTF-8 decoder utility.
 * Decompresses GZIP, Deflate, and raw compressed streams, and extracts clean human-readable text.
 */
object DecompressUtils {

    fun decompress(bytes: ByteArray?, contentEncoding: String?): ByteArray? {
        if (bytes == null || bytes.isEmpty()) return bytes
        if (contentEncoding.isNullOrBlank()) {
            // Check magic bytes for GZIP (0x1f, 0x8b)
            if (bytes.size >= 2 && (bytes[0] == 0x1f.toByte()) && (bytes[1] == 0x8b.toByte())) {
                return tryDecompressGzip(bytes) ?: bytes
            }
            return bytes
        }

        val encoding = contentEncoding.lowercase().trim()
        return when {
            encoding.contains("gzip") || encoding.contains("x-gzip") -> {
                tryDecompressGzip(bytes) ?: bytes
            }
            encoding.contains("deflate") -> {
                tryDecompressDeflate(bytes) ?: bytes
            }
            else -> {
                // If it starts with GZIP magic bytes regardless of header
                if (bytes.size >= 2 && (bytes[0] == 0x1f.toByte()) && (bytes[1] == 0x8b.toByte())) {
                    tryDecompressGzip(bytes) ?: bytes
                } else {
                    bytes
                }
            }
        }
    }

    private fun tryDecompressGzip(bytes: ByteArray): ByteArray? {
        return try {
            GZIPInputStream(ByteArrayInputStream(bytes)).use { gzip ->
                gzip.readBytes()
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun tryDecompressDeflate(bytes: ByteArray): ByteArray? {
        // Try standard zlib wrapped deflate
        try {
            return InflaterInputStream(ByteArrayInputStream(bytes)).use { it.readBytes() }
        } catch (e: Exception) {}

        // Fallback to raw deflate (nowrap = true)
        return try {
            InflaterInputStream(ByteArrayInputStream(bytes), Inflater(true)).use { it.readBytes() }
        } catch (e: Exception) {
            null
        }
    }

    fun decodeToString(bytes: ByteArray?, contentType: String?): String? {
        if (bytes == null || bytes.isEmpty()) return null

        val charset = extractCharset(contentType)
        return try {
            String(bytes, charset)
        } catch (e: Exception) {
            try {
                String(bytes, Charsets.UTF_8)
            } catch (e2: Exception) {
                String(bytes)
            }
        }
    }

    private fun extractCharset(contentType: String?): Charset {
        if (contentType.isNullOrBlank()) return Charsets.UTF_8
        try {
            val parts = contentType.split(";")
            for (part in parts) {
                val trimmed = part.trim()
                if (trimmed.startsWith("charset=", ignoreCase = true)) {
                    val charsetName = trimmed.substring(8).trim().replace("\"", "").replace("'", "")
                    return Charset.forName(charsetName)
                }
            }
        } catch (e: Exception) {}
        return Charsets.UTF_8
    }
}
