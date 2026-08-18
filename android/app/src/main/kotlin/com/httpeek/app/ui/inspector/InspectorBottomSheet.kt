package com.httpeek.app.ui.inspector

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.tabs.TabLayoutMediator
import com.httpeek.app.R
import com.httpeek.app.databinding.SheetInspectorBinding
import com.httpeek.app.model.HttpRequestModel
import com.httpeek.app.ui.common.LottieToast
import org.json.JSONObject

class InspectorBottomSheet(
    private val request: HttpRequestModel
) : BottomSheetDialogFragment() {

    private var _binding: SheetInspectorBinding? = null
    private val binding get() = _binding!!

    data class InspectorTab(val title: String, val content: String)

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = SheetInspectorBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Expand bottom sheet
        (dialog as? BottomSheetDialog)?.behavior?.apply {
            state = BottomSheetBehavior.STATE_EXPANDED
            skipCollapsed = true
        }

        setupHeader()
        setupTabs()
        setupListeners()
    }

    private fun setupHeader() {
        binding.tvInspectorMethod.text = request.method
        binding.tvInspectorHost.text = request.hostPort.host
        binding.tvInspectorPath.text = request.path

        val resp = request.response
        if (resp != null) {
            val code = resp.statusCode
            binding.tvInspectorStatus.text = "$code"
            val (bgRes, textRes) = when (code) {
                in 200..299 -> Pair(R.color.method_post_bg, R.color.status_2xx)
                in 300..399 -> Pair(R.color.method_get_bg, R.color.status_3xx)
                in 400..499 -> Pair(R.color.method_put_bg, R.color.status_4xx)
                else -> Pair(R.color.method_delete_bg, R.color.status_5xx)
            }
            binding.tvInspectorStatus.setBackgroundColor(ContextCompat.getColor(requireContext(), bgRes))
            binding.tvInspectorStatus.setTextColor(ContextCompat.getColor(requireContext(), textRes))
        } else {
            binding.tvInspectorStatus.text = "Pending"
            binding.tvInspectorStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.text_muted))
        }
    }

    private fun setupTabs() {
        val resp = request.response
        val tabs = mutableListOf<InspectorTab>()

        // 1. Overview
        val overview = buildString {
            append("• URL:\n${request.url}\n\n")
            append("• Method: ${request.method}\n")
            append("• Host: ${request.hostPort.host}:${request.hostPort.port}\n")
            append("• Protocol: ${if (request.hostPort.ssl) "HTTPS (TLS)" else "HTTP"}\n")
            append("• Status: ${resp?.let { "${it.statusCode} ${it.statusText}" } ?: "Pending"}\n")
            append("• Duration: ${request.durationMs?.let { "${it}ms" } ?: "Pending"}\n")
            append("• Timestamp: ${request.startTime}\n")
        }
        tabs.add(InspectorTab("Overview", overview))

        // 2. Response Body
        val respBody = resp?.bodyString ?: "No response body received yet."
        val formattedRespBody = tryFormatJson(respBody)
        tabs.add(InspectorTab("Response Body", formattedRespBody))

        // 3. Request Headers
        val reqHeaders = formatHeaders(request.headers)
        tabs.add(InspectorTab("Req Headers", reqHeaders))

        // 4. Response Headers
        if (resp != null) {
            val respHeaders = formatHeaders(resp.headers)
            tabs.add(InspectorTab("Resp Headers", respHeaders))
        }

        // 5. Request Body
        val reqBody = request.bodyString ?: "(empty body)"
        tabs.add(InspectorTab("Req Body", tryFormatJson(reqBody)))

        val adapter = TabContentAdapter(tabs)
        binding.viewPagerInspector.adapter = adapter

        TabLayoutMediator(binding.tabLayoutInspector, binding.viewPagerInspector) { tab, position ->
            tab.text = tabs[position].title
        }.attach()

        // Default to Response Body tab if response exists
        if (resp != null && !resp.bodyString.isNullOrEmpty()) {
            binding.viewPagerInspector.setCurrentItem(1, false)
        }
    }

    private fun tryFormatJson(raw: String): String {
        return try {
            if (raw.trim().startsWith("{")) JSONObject(raw).toString(2)
            else raw
        } catch (e: Exception) {
            raw
        }
    }

    private fun formatHeaders(headers: Map<String, List<String>>?): String {
        if (headers.isNullOrEmpty()) return "(no headers)"
        return headers.entries.joinToString("\n") { (k, vals) ->
            "$k: ${vals.joinToString(", ")}"
        }
    }

    private fun setupListeners() {
        binding.btnCopyCurl.setOnClickListener {
            val curl = buildCurlCommand(request)
            val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("cURL", curl))
            LottieToast.showSuccess(requireContext(), "📋 cURL copied to clipboard!")
        }
    }

    private fun buildCurlCommand(req: HttpRequestModel): String {
        val sb = StringBuilder("curl -X ").append(req.method)
        req.headers?.forEach { (k, vals) ->
            vals.forEach { sb.append(" -H '").append(k).append(": ").append(it).append("'") }
        }
        if (!req.bodyString.isNullOrEmpty()) {
            sb.append(" --data '").append(req.bodyString.replace("'", "\\'")).append("'")
        }
        sb.append(" '").append(req.url).append("'")
        return sb.toString()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    class TabContentAdapter(
        private val tabs: List<InspectorTab>
    ) : RecyclerView.Adapter<TabContentAdapter.ViewHolder>() {

        class ViewHolder(val text: TextView) : RecyclerView.ViewHolder(text)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val tv = TextView(parent.context).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                setPadding(36, 36, 36, 36)
                textSize = 12f
                typeface = android.graphics.Typeface.MONOSPACE
                setTextIsSelectable(true)
                setTextColor(ContextCompat.getColor(context, R.color.text_primary))
            }
            return ViewHolder(tv)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            holder.text.text = tabs[position].content
        }

        override fun getItemCount(): Int = tabs.size
    }
}
