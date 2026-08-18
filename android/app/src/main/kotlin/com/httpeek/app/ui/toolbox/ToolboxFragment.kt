package com.httpeek.app.ui.toolbox

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.httpeek.app.databinding.FragmentToolboxBinding
import com.httpeek.app.ui.common.LottieToast
import kotlinx.coroutines.launch

class ToolboxFragment : Fragment() {

    private var _binding: FragmentToolboxBinding? = null
    private val binding get() = _binding!!

    private val tools = listOf(
        "1. JWT Token Inspector & Verification",
        "2. MD5 / SHA-1 / SHA-256 Hash Generator",
        "3. AES-128/256 Encryption (CBC / ECB)",
        "4. AES-128/256 Decryption (CBC / ECB)",
        "5. URL Encoder & Decoder",
        "6. Base64 & Hex Encoder / Decoder",
        "7. Timestamp (Epoch <-> Date) Converter",
        "8. Regex Pattern Matcher & Tester",
        "9. Certificate Subject Hash Calculator (<hash>.0)",
        "10. HTTP Request Composer & Client"
    )

    private val methods = listOf("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD")

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentToolboxBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupToolSpinner()
        setupListeners()
    }

    private fun setupToolSpinner() {
        val toolAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, tools)
        binding.spinnerToolboxMode.adapter = toolAdapter

        val methodAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, methods)
        binding.spinnerComposerMethod.adapter = methodAdapter

        binding.spinnerToolboxMode.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                updateFieldsForTool(position)
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
    }

    private fun updateFieldsForTool(pos: Int) {
        binding.layoutComposerMethod.visibility = if (pos == 9) View.VISIBLE else View.GONE

        when (pos) {
            0 -> { // JWT
                binding.tvInputLabel.text = "JWT Token (header.payload.signature):"
                binding.etToolInput.hint = "Paste JWT token string (e.g. eyJhbGciOi...)"
                binding.tvParamLabel.visibility = View.GONE
                binding.etToolParam.visibility = View.GONE
            }
            1 -> { // Hashes
                binding.tvInputLabel.text = "Input String to Hash:"
                binding.etToolInput.hint = "Enter text to compute MD5, SHA-1, SHA-256, SHA-512..."
                binding.tvParamLabel.visibility = View.GONE
                binding.etToolParam.visibility = View.GONE
            }
            2, 3 -> { // AES Encrypt / Decrypt
                binding.tvInputLabel.text = if (pos == 2) "Plaintext Data:" else "Base64 Ciphertext:"
                binding.etToolInput.hint = "Enter data..."
                binding.tvParamLabel.visibility = View.VISIBLE
                binding.tvParamLabel.text = "AES Key & IV (format: 'Key' or 'Key,IV'):"
                binding.etToolParam.visibility = View.VISIBLE
                binding.etToolParam.hint = "e.g. 16/32-byte secret key"
            }
            4 -> { // URL Encode/Decode
                binding.tvInputLabel.text = "URL String:"
                binding.etToolInput.hint = "Enter text or URL to encode / decode..."
                binding.tvParamLabel.visibility = View.GONE
                binding.etToolParam.visibility = View.GONE
            }
            5 -> { // Base64 & Hex
                binding.tvInputLabel.text = "Text, Base64, or Hex Data:"
                binding.etToolInput.hint = "Enter raw text, Base64, or Hex string..."
                binding.tvParamLabel.visibility = View.GONE
                binding.etToolParam.visibility = View.GONE
            }
            6 -> { // Timestamp
                binding.tvInputLabel.text = "Timestamp (Epoch ms/s) or Date string:"
                binding.etToolInput.hint = "e.g. 1723938400 or 2026-08-17 14:30:00"
                binding.tvParamLabel.visibility = View.GONE
                binding.etToolParam.visibility = View.GONE
            }
            7 -> { // Regex
                binding.tvInputLabel.text = "Target Text to Match:"
                binding.etToolInput.hint = "Enter text sample to test regex against..."
                binding.tvParamLabel.visibility = View.VISIBLE
                binding.tvParamLabel.text = "Regular Expression Pattern:"
                binding.etToolParam.visibility = View.VISIBLE
                binding.etToolParam.hint = "e.g. ([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\\.[a-zA-Z0-9._-]+)"
            }
            8 -> { // Cert Hash
                binding.tvInputLabel.text = "Certificate PEM Text:"
                binding.etToolInput.hint = "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
                binding.tvParamLabel.visibility = View.GONE
                binding.etToolParam.visibility = View.GONE
            }
            9 -> { // HTTP Composer
                binding.tvInputLabel.text = "Request Body (JSON / Form / Raw Payload):"
                binding.etToolInput.hint = "{\"name\": \"test\", \"value\": 123}"
                binding.tvParamLabel.visibility = View.VISIBLE
                binding.tvParamLabel.text = "Custom Request Headers (one per line, e.g. Authorization: Bearer ...):"
                binding.etToolParam.visibility = View.VISIBLE
                binding.etToolParam.hint = "Content-Type: application/json\nAuthorization: Bearer <token>"
            }
        }
    }

    private fun setupListeners() {
        binding.btnExecuteTool.setOnClickListener {
            executeCurrentTool()
        }

        binding.btnCopyOutput.setOnClickListener {
            val text = binding.tvToolOutput.text.toString()
            if (text.isNotBlank()) {
                val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("Tool Output", text))
                LottieToast.showSuccess(requireContext(), "📋 Output copied to clipboard!")
            }
        }
    }

    private fun executeCurrentTool() {
        val pos = binding.spinnerToolboxMode.selectedItemPosition
        val input = binding.etToolInput.text.toString()
        val param = binding.etToolParam.text.toString()
        LottieToast.showRocket(requireContext(), "⚡ Executing tool...")

        when (pos) {
            0 -> { // JWT
                val (header, payload) = ToolboxUtils.decodeJwt(input)
                binding.tvToolOutput.text = "=== HEADER ===\n$header\n\n=== PAYLOAD ===\n$payload"
            }
            1 -> { // Hashes
                val md5 = ToolboxUtils.hashString(input, "MD5")
                val sha1 = ToolboxUtils.hashString(input, "SHA-1")
                val sha256 = ToolboxUtils.hashString(input, "SHA-256")
                val sha512 = ToolboxUtils.hashString(input, "SHA-512")
                binding.tvToolOutput.text = "• MD5: $md5\n• SHA-1: $sha1\n• SHA-256: $sha256\n• SHA-512: $sha512"
            }
            2 -> { // AES Encrypt
                val parts = param.split(",")
                val key = parts.getOrNull(0) ?: "1234567890123456"
                val iv = parts.getOrNull(1) ?: ""
                val encrypted = ToolboxUtils.aesEncrypt(input, key, iv)
                binding.tvToolOutput.text = "AES Encrypted (Base64):\n$encrypted"
            }
            3 -> { // AES Decrypt
                val parts = param.split(",")
                val key = parts.getOrNull(0) ?: "1234567890123456"
                val iv = parts.getOrNull(1) ?: ""
                val decrypted = ToolboxUtils.aesDecrypt(input, key, iv)
                binding.tvToolOutput.text = "AES Decrypted Plaintext:\n$decrypted"
            }
            4 -> { // URL Encode/Decode
                val enc = ToolboxUtils.urlEncode(input)
                val dec = ToolboxUtils.urlDecode(input)
                binding.tvToolOutput.text = "• URL Encoded:\n$enc\n\n• URL Decoded:\n$dec"
            }
            5 -> { // Base64 & Hex
                val b64Enc = ToolboxUtils.base64Encode(input)
                val b64Dec = ToolboxUtils.base64Decode(input)
                val hexEnc = ToolboxUtils.hexEncode(input)
                val hexDec = ToolboxUtils.hexDecode(input)
                binding.tvToolOutput.text = "• Base64 Encoded: $b64Enc\n• Base64 Decoded: $b64Dec\n• Hex Encoded: $hexEnc\n• Hex Decoded: $hexDec"
            }
            6 -> { // Timestamp
                val epoch = input.trim().toLongOrNull()
                if (epoch != null) {
                    val date = ToolboxUtils.convertEpochToDate(epoch)
                    binding.tvToolOutput.text = "Epoch: $epoch\nFormatted Date:\n$date"
                } else {
                    val convertedEpoch = ToolboxUtils.convertDateToEpoch(input.trim())
                    if (convertedEpoch > 0) {
                        binding.tvToolOutput.text = "Date: $input\nEpoch Milliseconds: $convertedEpoch\nEpoch Seconds: ${convertedEpoch / 1000}"
                    } else {
                        binding.tvToolOutput.text = "Could not parse date or epoch string: $input"
                    }
                }
            }
            7 -> { // Regex
                val matches = ToolboxUtils.testRegex(param.ifEmpty { ".*" }, input)
                binding.tvToolOutput.text = matches.joinToString("\n")
            }
            8 -> { // Cert Hash
                val result = ToolboxUtils.calculateCertHash(input)
                binding.tvToolOutput.text = result
            }
            9 -> { // HTTP Composer
                val method = binding.spinnerComposerMethod.selectedItem.toString()
                val url = binding.etComposerUrl.text.toString().trim()
                if (url.isEmpty()) {
                    LottieToast.showError(requireContext(), "💥 URL cannot be empty!")
                    return
                }

                binding.tvToolOutput.text = "Sending $method $url..."
                lifecycleScope.launch {
                    val response = ToolboxUtils.sendHttpRequest(method, url, param, input)
                    binding.tvToolOutput.text = response
                    LottieToast.showSuccess(requireContext(), "⚡ HTTP Request Completed!")
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
