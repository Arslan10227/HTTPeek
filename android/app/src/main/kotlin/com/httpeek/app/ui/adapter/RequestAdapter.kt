package com.httpeek.app.ui.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.httpeek.app.R
import com.httpeek.app.databinding.ItemRequestCardBinding
import com.httpeek.app.model.HttpRequestModel
import java.util.Locale

class RequestAdapter(
    private val onItemClick: (HttpRequestModel) -> Unit,
    private val onToggleFavorite: (HttpRequestModel) -> Unit
) : ListAdapter<HttpRequestModel, RequestAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemRequestCardBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(private val binding: ItemRequestCardBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: HttpRequestModel) {
            val context = binding.root.context

            // Method badge
            val method = item.method.uppercase(Locale.getDefault())
            binding.tvMethod.text = method
            when (method) {
                "GET" -> applyMethodStyle(R.color.method_get_text, R.color.method_get_bg)
                "POST" -> applyMethodStyle(R.color.method_post_text, R.color.method_post_bg)
                "PUT" -> applyMethodStyle(R.color.method_put_text, R.color.method_put_bg)
                "DELETE" -> applyMethodStyle(R.color.method_delete_text, R.color.method_delete_bg)
                "PATCH" -> applyMethodStyle(R.color.method_patch_text, R.color.method_patch_bg)
                else -> applyMethodStyle(R.color.method_default_text, R.color.method_default_bg)
            }

            // Host + Path
            binding.tvHost.text = item.hostPort.host
            binding.tvPath.text = item.path.ifEmpty { "/" }

            // Status Code
            val status = item.response?.statusCode
            if (status != null) {
                binding.tvStatusCode.text = status.toString()
                val (textColor, bgColor) = when (status / 100) {
                    2 -> Pair(R.color.status_2xx, R.color.method_post_bg)
                    3 -> Pair(R.color.status_3xx, R.color.method_get_bg)
                    4 -> Pair(R.color.status_4xx, R.color.method_put_bg)
                    else -> Pair(R.color.status_5xx, R.color.method_delete_bg)
                }
                binding.tvStatusCode.setTextColor(ContextCompat.getColor(context, textColor))
                binding.tvStatusCode.backgroundTintList = ContextCompat.getColorStateList(context, bgColor)
                binding.tvStatusCode.visibility = View.VISIBLE
            } else {
                binding.tvStatusCode.text = "…"
                binding.tvStatusCode.setTextColor(ContextCompat.getColor(context, R.color.text_muted))
                binding.tvStatusCode.backgroundTintList = ContextCompat.getColorStateList(context, R.color.surface_variant)
                binding.tvStatusCode.visibility = View.VISIBLE
            }

            // Timestamp + Content Type
            binding.tvTimestamp.text = item.startTime.ifEmpty { "Just now" }
            val contentType = item.response?.headers?.get("Content-Type")?.firstOrNull()
                ?: item.headers?.get("Content-Type")?.firstOrNull()
                ?: if (item.hostPort.ssl) "HTTPS" else "HTTP"
            binding.tvContentType.text = contentType.split(";").firstOrNull() ?: contentType

            // Duration
            if (item.durationMs != null && item.durationMs > 0) {
                binding.tvDuration.text = "${item.durationMs}ms"
                binding.tvDuration.visibility = View.VISIBLE
            } else {
                binding.tvDuration.visibility = View.GONE
            }

            binding.root.setOnClickListener { onItemClick(item) }
        }

        private fun applyMethodStyle(textColor: Int, bgColor: Int) {
            val context = binding.root.context
            binding.tvMethod.setTextColor(ContextCompat.getColor(context, textColor))
            binding.tvMethod.backgroundTintList = ContextCompat.getColorStateList(context, bgColor)
        }
    }

    private class DiffCallback : DiffUtil.ItemCallback<HttpRequestModel>() {
        override fun areItemsTheSame(oldItem: HttpRequestModel, newItem: HttpRequestModel): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: HttpRequestModel, newItem: HttpRequestModel): Boolean {
            return oldItem.id == newItem.id &&
                   oldItem.response?.statusCode == newItem.response?.statusCode &&
                   oldItem.durationMs == newItem.durationMs &&
                   oldItem.isFavorite == newItem.isFavorite
        }
    }
}
