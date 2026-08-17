package com.httpeek.app.ui.inspector

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.httpeek.app.databinding.SheetInspectorBinding
import com.httpeek.app.model.HttpRequestModel

class InspectorBottomSheet(
    private val request: HttpRequestModel
) : BottomSheetDialogFragment() {

    private var _binding: SheetInspectorBinding? = null
    private val binding get() = _binding!!
    private val cardAdapter = InspectorCardAdapter()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = SheetInspectorBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.tvSheetMethod.text = request.method
        binding.tvSheetUrl.text = request.url
        val resp = request.response
        binding.tvSheetStatus.text = resp?.let { "${it.statusCode} ${it.statusText}" } ?: "Pending"

        binding.rvInspectorCards.layoutManager = LinearLayoutManager(requireContext())
        binding.rvInspectorCards.adapter = cardAdapter
        cardAdapter.submitCards(buildCards(request))

        binding.btnCopyCurl.setOnClickListener {
            val curl = buildCurlCommand(request)
            val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("cURL", curl))
            Toast.makeText(requireContext(), "cURL copied to clipboard", Toast.LENGTH_SHORT).show()
        }
    }

    private fun buildCards(req: HttpRequestModel): List<InspectorCardItem> {
        val resp = req.response
        val cards = mutableListOf(
            InspectorCardItem(
                id = "summary",
                title = "Summary",
                body = buildString {
                    append("Method: ").append(req.method).append('\n')
                    append("URL: ").append(req.url).append('\n')
                    append("Status: ").append(resp?.let { "${it.statusCode} ${it.statusText}" } ?: "Pending").append('\n')
                    append("Duration: ").append(req.durationMs?.let { "${it}ms" } ?: "Pending").append('\n')
                    append("SSL: ").append(if (req.hostPort.ssl) "HTTPS" else "HTTP")
                }
            ),
            InspectorCardItem(
                id = "request",
                title = "Request Headers",
                body = formatHeaders(req.headers),
                expanded = false
            ),
            InspectorCardItem(
                id = "req-body",
                title = "Request Body",
                body = formatBody(req.bodyString),
                expanded = false
            )
        )

        if (resp != null) {
            cards.add(
                InspectorCardItem(
                    id = "response",
                    title = "Response Headers",
                    body = formatHeaders(resp.headers),
                    expanded = false
                )
            )
            cards.add(
                InspectorCardItem(
                    id = "resp-body",
                    title = "Response Body",
                    body = formatBody(resp.bodyString),
                    expanded = true
                )
            )
        }

        return cards
    }

    private fun formatBody(body: String?): String {
        if (body.isNullOrBlank()) return "No payload"
        val trimmed = body.trim()
        if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
            return try {
                val jsonEl = com.google.gson.JsonParser.parseString(trimmed)
                com.google.gson.GsonBuilder().setPrettyPrinting().create().toJson(jsonEl)
            } catch (e: Exception) {
                trimmed
            }
        }
        return trimmed
    }

    private fun formatHeaders(headers: Map<String, List<String>>?): String {
        if (headers.isNullOrEmpty()) return "No headers"
        return headers.entries.joinToString("\n") { (k, vals) ->
            "$k: ${vals.joinToString(", ")}"
        }
    }

    private fun buildCurlCommand(req: HttpRequestModel): String {
        val sb = StringBuilder("curl -X ").append(req.method).append(" '").append(req.url).append("'")
        req.headers?.forEach { (k, vals) ->
            vals.forEach { v ->
                sb.append(" \\\n  -H '").append(k).append(": ").append(v).append("'")
            }
        }
        if (!req.bodyString.isNullOrEmpty()) {
            sb.append(" \\\n  --data-raw '").append(req.bodyString).append("'")
        }
        return sb.toString()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
