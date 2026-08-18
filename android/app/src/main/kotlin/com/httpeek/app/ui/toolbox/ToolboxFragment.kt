package com.httpeek.app.ui.toolbox

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.util.Base64
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.httpeek.app.R
import com.httpeek.app.databinding.FragmentToolboxBinding
import com.httpeek.app.ui.common.LottieToast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.net.URLDecoder
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

class ToolboxFragment : Fragment() {

    private var _binding: FragmentToolboxBinding? = null
    private val binding get() = _binding!!

    enum class ToolMode { HTTP_COMPOSER, JWT, CRYPTO, ENCODER, REGEX, DIFF }
    private var currentMode = ToolMode.HTTP_COMPOSER

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val methods = listOf("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD")
    private val contentTypes = listOf(
        "application/json",
        "application/x-www-form-urlencoded",
        "text/plain",
        "text/html",
        "application/xml"
    )

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentToolboxBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupDropdowns()
        setupChips()
        setupListeners()
        updateUIMode(ToolMode.HTTP_COMPOSER)
    }

    private fun setupDropdowns() {
        val methodAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, methods)
        binding.spinnerMethod.setAdapter(methodAdapter)

        val ctAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, contentTypes)
        binding.spinnerContentType.setAdapter(ctAdapter)
    }

    private fun setupChips() {
        binding.chipGroupTools.setOnCheckedStateChangeListener { _, checkedIds ->
            val mode = when (checkedIds.firstOrNull()) {
                R.id.chipJwt -> ToolMode.JWT
                R.id.chipCrypto -> ToolMode.CRYPTO
                R.id.chipEncoder -> ToolMode.ENCODER
                R.id.chipRegex -> ToolMode.REGEX
                R.id.chipDiff -> ToolMode.DIFF
                else -> ToolMode.HTTP_COMPOSER
            }
            updateUIMode(mode)
        }
    }

    private fun updateUIMode(mode: ToolMode) {
        currentMode = mode
        binding.cardResult.visibility = View.GONE

        when (mode) {
            ToolMode.HTTP_COMPOSER -> {
                binding.tilUrl.hint = "URL (https://api.example.com/data)"
                binding.tilUrl.visibility = View.VISIBLE
                binding.tilMethod.visibility = View.VISIBLE
                binding.tilContentType.visibility = View.VISIBLE
                binding.tilHeaders.visibility = View.VISIBLE
                binding.tilHeaders.hint = "Headers (Key: Value)"
                binding.tilBody.visibility = View.VISIBLE
                binding.tilBody.hint = "Request Body (JSON, form...)"
                binding.btnExecute.text = "Send Request"
            }
            ToolMode.JWT -> {
                binding.tilUrl.hint = "Paste JWT Token (header.payload.sig)"
                binding.tilUrl.visibility = View.VISIBLE
                binding.tilMethod.visibility = View.GONE
                binding.tilContentType.visibility = View.GONE
                binding.tilHeaders.visibility = View.GONE
                binding.tilBody.visibility = View.GONE
                binding.btnExecute.text = "Inspect JWT"
            }
            ToolMode.CRYPTO -> {
                binding.tilUrl.hint = "Plaintext / Ciphertext"
                binding.tilUrl.visibility = View.VISIBLE
                binding.tilMethod.visibility = View.GONE
                binding.tilContentType.visibility = View.GONE
                binding.tilHeaders.visibility = View.VISIBLE
                binding.tilHeaders.hint = "Secret Key (16 or 32 chars)"
                binding.tilBody.visibility = View.GONE
                binding.btnExecute.text = "Encrypt / Decrypt AES"
            }
            ToolMode.ENCODER -> {
                binding.tilUrl.hint = "Input Text or Base64 / URL-Encoded string"
                binding.tilUrl.visibility = View.VISIBLE
                binding.tilMethod.visibility = View.GONE
                binding.tilContentType.visibility = View.GONE
                binding.tilHeaders.visibility = View.GONE
                binding.tilBody.visibility = View.GONE
                binding.btnExecute.text = "Encode & Decode"
            }
            ToolMode.REGEX -> {
                binding.tilUrl.hint = "Regex Pattern (e.g. [a-z0-9]+@[a-z]+\\.[a-z]{2,})"
                binding.tilUrl.visibility = View.VISIBLE
                binding.tilMethod.visibility = View.GONE
                binding.tilContentType.visibility = View.GONE
                binding.tilHeaders.visibility = View.GONE
                binding.tilBody.visibility = View.VISIBLE
                binding.tilBody.hint = "Test String"
                binding.btnExecute.text = "Test Pattern"
            }
            ToolMode.DIFF -> {
                binding.tilUrl.hint = "Text A (Original)"
                binding.tilUrl.visibility = View.VISIBLE
                binding.tilMethod.visibility = View.GONE
                binding.tilContentType.visibility = View.GONE
                binding.tilHeaders.visibility = View.GONE
                binding.tilBody.visibility = View.VISIBLE
                binding.tilBody.hint = "Text B (Modified)"
                binding.btnExecute.text = "Compare Diff"
            }
        }
    }

    private fun setupListeners() {
        binding.btnExecute.setOnClickListener {
            executeCurrentTool()
        }

        binding.btnCopyResult.setOnClickListener {
            val text = binding.tvResult.text.toString()
            if (text.isNotEmpty()) {
                val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("Result", text))
                LottieToast.showSuccess(requireContext(), "Copied to clipboard!")
            }
        }
    }

    private fun executeCurrentTool() {
        when (currentMode) {
            ToolMode.HTTP_COMPOSER -> executeHttpComposer()
            ToolMode.JWT -> executeJwt()
            ToolMode.CRYPTO -> executeCrypto()
            ToolMode.ENCODER -> executeEncoder()
            ToolMode.REGEX -> executeRegex()
            ToolMode.DIFF -> executeDiff()
        }
    }

    private fun executeHttpComposer() {
        val url = binding.etUrl.text.toString().trim()
        if (url.isEmpty()) {
            LottieToast.showError(requireContext(), "Please enter a URL")
            return
        }

        val method = binding.spinnerMethod.text.toString().trim().uppercase().ifEmpty { "GET" }
        val ct = binding.spinnerContentType.text.toString().trim().ifEmpty { "application/json" }
        val bodyText = binding.etBody.text.toString()

        binding.btnExecute.isEnabled = false
        binding.cardResult.visibility = View.VISIBLE
        binding.tvResultStatus.text = "Sending..."
        binding.tvResult.text = "Connecting to $url..."

        lifecycleScope.launch(Dispatchers.IO) {
            val start = System.currentTimeMillis()
            try {
                val reqBuilder = Request.Builder().url(if (url.startsWith("http")) url else "https://$url")

                // Headers
                val headersStr = binding.etHeaders.text.toString()
                headersStr.lines().forEach { line ->
                    val colon = line.indexOf(':')
                    if (colon > 0) {
                        val k = line.substring(0, colon).trim()
                        val v = line.substring(colon + 1).trim()
                        reqBuilder.addHeader(k, v)
                    }
                }

                // Method + Body
                if (method in listOf("POST", "PUT", "PATCH", "DELETE")) {
                    val reqBody = bodyText.toRequestBody(ct.toMediaTypeOrNull())
                    reqBuilder.method(method, reqBody)
                } else {
                    reqBuilder.method(method, null)
                }

                val response = httpClient.newCall(reqBuilder.build()).execute()
                val duration = System.currentTimeMillis() - start
                val code = response.code
                val body = response.body?.string() ?: ""

                withContext(Dispatchers.Main) {
                    binding.tvResultStatus.text = "$code ${response.message} (${duration}ms)"
                    binding.tvResult.text = body
                    binding.btnExecute.isEnabled = true
                    LottieToast.showSuccess(requireContext(), "HTTP $code in ${duration}ms")
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.tvResultStatus.text = "Error"
                    binding.tvResult.text = e.localizedMessage ?: e.toString()
                    binding.btnExecute.isEnabled = true
                    LottieToast.showError(requireContext(), "Request failed: ${e.message}")
                }
            }
        }
    }

    private fun executeJwt() {
        val raw = binding.etUrl.text.toString().trim()
        if (raw.isEmpty()) return

        try {
            val parts = raw.split(".")
            if (parts.size >= 2) {
                val header = String(Base64.decode(parts[0], Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP))
                val payload = String(Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP))
                val prettyHeader = JSONObject(header).toString(2)
                val prettyPayload = JSONObject(payload).toString(2)

                binding.cardResult.visibility = View.VISIBLE
                binding.tvResultStatus.text = "JWT Decoded"
                binding.tvResult.text = "=== HEADER ===\n$prettyHeader\n\n=== PAYLOAD ===\n$prettyPayload"
                LottieToast.showSuccess(requireContext(), "JWT Payload decoded!")
            } else {
                LottieToast.showError(requireContext(), "Invalid JWT format (requires header.payload.sig)")
            }
        } catch (e: Exception) {
            binding.cardResult.visibility = View.VISIBLE
            binding.tvResultStatus.text = "Decode Error"
            binding.tvResult.text = e.message
        }
    }

    private fun executeCrypto() {
        val input = binding.etUrl.text.toString()
        val keyStr = binding.etHeaders.text.toString().trim()
        if (input.isEmpty() || keyStr.isEmpty()) {
            LottieToast.showError(requireContext(), "Enter input data and secret key")
            return
        }

        try {
            val keyBytes = keyStr.toByteArray().copyOf(16)
            val keySpec = SecretKeySpec(keyBytes, "AES")

            // Encrypt
            val cipher = Cipher.getInstance("AES/ECB/PKCS5Padding")
            cipher.init(Cipher.ENCRYPT_MODE, keySpec)
            val encrypted = Base64.encodeToString(cipher.doFinal(input.toByteArray()), Base64.NO_WRAP)

            binding.cardResult.visibility = View.VISIBLE
            binding.tvResultStatus.text = "AES-128 Encrypted"
            binding.tvResult.text = "Ciphertext (Base64):\n$encrypted"
            LottieToast.showShield(requireContext(), "AES-128 encrypted")
        } catch (e: Exception) {
            binding.cardResult.visibility = View.VISIBLE
            binding.tvResultStatus.text = "Crypto Error"
            binding.tvResult.text = e.message
        }
    }

    private fun executeEncoder() {
        val input = binding.etUrl.text.toString()
        if (input.isEmpty()) return

        val sb = StringBuilder()
        // URL Encode / Decode
        try { sb.append("• URL Encoded: ").append(URLEncoder.encode(input, "UTF-8")).append("\n\n") } catch (e: Exception) {}
        try { sb.append("• URL Decoded: ").append(URLDecoder.decode(input, "UTF-8")).append("\n\n") } catch (e: Exception) {}

        // Base64 Encode / Decode
        sb.append("• Base64 Encoded: ").append(Base64.encodeToString(input.toByteArray(), Base64.NO_WRAP)).append("\n\n")
        try {
            val b64Dec = String(Base64.decode(input, Base64.DEFAULT))
            sb.append("• Base64 Decoded: ").append(b64Dec).append("\n\n")
        } catch (e: Exception) {}

        // Hashes
        try {
            val md5 = MessageDigest.getInstance("MD5").digest(input.toByteArray()).joinToString("") { "%02x".format(it) }
            val sha256 = MessageDigest.getInstance("SHA-256").digest(input.toByteArray()).joinToString("") { "%02x".format(it) }
            sb.append("• MD5: ").append(md5).append("\n\n")
            sb.append("• SHA-256: ").append(sha256)
        } catch (e: Exception) {}

        binding.cardResult.visibility = View.VISIBLE
        binding.tvResultStatus.text = "En/Decoded"
        binding.tvResult.text = sb.toString()
        LottieToast.showWink(requireContext(), "Encoded & Hashes computed")
    }

    private fun executeRegex() {
        val patternStr = binding.etUrl.text.toString().trim()
        val text = binding.etBody.text.toString()

        if (patternStr.isEmpty()) return

        try {
            val pattern = Pattern.compile(patternStr)
            val matcher = pattern.matcher(text)
            val matches = mutableListOf<String>()
            while (matcher.find()) {
                matches.add(matcher.group())
            }

            binding.cardResult.visibility = View.VISIBLE
            binding.tvResultStatus.text = "${matches.size} Match${if (matches.size == 1) "" else "es"}"
            binding.tvResult.text = if (matches.isEmpty()) "No matches found." else matches.joinToString("\n\n") { "• $it" }
            LottieToast.showSuccess(requireContext(), "Found ${matches.size} matches")
        } catch (e: Exception) {
            binding.cardResult.visibility = View.VISIBLE
            binding.tvResultStatus.text = "Regex Error"
            binding.tvResult.text = e.message
        }
    }

    private fun executeDiff() {
        val textA = binding.etUrl.text.toString()
        val textB = binding.etBody.text.toString()

        val linesA = textA.lines()
        val linesB = textB.lines()

        val diffSb = StringBuilder()
        val maxLines = maxOf(linesA.size, linesB.size)
        var diffCount = 0

        for (i in 0 until maxLines) {
            val a = linesA.getOrNull(i)
            val b = linesB.getOrNull(i)
            if (a != b) {
                diffCount++
                if (a != null) diffSb.append("- [L${i+1}] $a\n")
                if (b != null) diffSb.append("+ [L${i+1}] $b\n")
            }
        }

        binding.cardResult.visibility = View.VISIBLE
        binding.tvResultStatus.text = "$diffCount Difference${if (diffCount == 1) "" else "s"}"
        binding.tvResult.text = if (diffCount == 0) "Texts are identical." else diffSb.toString()
        LottieToast.showWink(requireContext(), "$diffCount line differences found")
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
