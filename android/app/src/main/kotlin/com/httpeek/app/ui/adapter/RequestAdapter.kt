package com.httpeek.app.ui.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.httpeek.app.R
import com.httpeek.app.databinding.ItemRequestCardBinding
import com.httpeek.app.model.HttpRequestModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

class RequestAdapter(
    private val onItemClick: (HttpRequestModel) -> Unit,
    private val onToggleFavorite: (HttpRequestModel) -> Unit
) : ListAdapter<HttpRequestModel, RequestAdapter.ViewHolder>(DiffCallback()) {

    private val timeFormatter = DateTimeFormatter.ofPattern("HH:mm:ss", Locale.getDefault())

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
            binding.tvMethod.text = item.method
            binding.tvHost.text = item.hostPort.host
            binding.tvPath.text = item.path.ifEmpty { item.url }
            binding.tvDuration.text = item.durationMs?.let { "${it}ms" } ?: "..."

            binding.tvTime.text = formatTime(item.startTime)

            val size = item.response?.bodySize ?: 0L
            binding.tvSize.text = when {
                size < 1024 -> "$size B"
                size < 1024 * 1024 -> String.format(Locale.getDefault(), "%.1f KB", size / 1024.0)
                else -> String.format(Locale.getDefault(), "%.1f MB", size / (1024.0 * 1024.0))
            }

            val context = binding.root.context
            when (item.method.uppercase(Locale.getDefault())) {
                "GET" -> applyMethodStyle(R.color.method_get_text, R.color.method_get_bg)
                "POST" -> applyMethodStyle(R.color.method_post_text, R.color.method_post_bg)
                "PUT" -> applyMethodStyle(R.color.method_put_text, R.color.method_put_bg)
                "DELETE" -> applyMethodStyle(R.color.method_delete_text, R.color.method_delete_bg)
                "PATCH" -> applyMethodStyle(R.color.method_patch_text, R.color.method_patch_bg)
                else -> applyMethodStyle(R.color.method_default_text, R.color.method_default_bg)
            }

            val status = item.response?.statusCode
            if (status != null) {
                binding.tvStatusCode.text = status.toString()
                val statusColor = when (status / 100) {
                    2 -> R.color.status_2xx
                    3 -> R.color.status_3xx
                    4 -> R.color.status_4xx
                    else -> R.color.status_5xx
                }
                binding.tvStatusCode.setTextColor(ContextCompat.getColor(context, statusColor))
            } else {
                binding.tvStatusCode.text = "..."
                binding.tvStatusCode.setTextColor(ContextCompat.getColor(context, R.color.text_muted))
            }

            binding.tvSsl.visibility = if (item.hostPort.ssl) android.view.View.VISIBLE else android.view.View.GONE
            binding.tvProcess.text = item.process?.name ?: ""

            binding.btnFavorite.setImageResource(
                if (item.isFavorite) android.R.drawable.btn_star_big_on else android.R.drawable.btn_star_big_off
            )
            binding.btnFavorite.contentDescription =
                if (item.isFavorite) "Remove from favorites" else "Add to favorites"

            binding.btnFavorite.setOnClickListener { onToggleFavorite(item) }
            binding.root.setOnClickListener { onItemClick(item) }
        }

        private fun applyMethodStyle(textColor: Int, bgColor: Int) {
            val context = binding.root.context
            binding.tvMethod.setTextColor(ContextCompat.getColor(context, textColor))
            binding.tvMethod.setBackgroundColor(ContextCompat.getColor(context, bgColor))
        }

        private fun formatTime(startTime: String): String {
            if (startTime.isBlank()) return "--:--:--"
            return try {
                val instant = Instant.parse(startTime)
                timeFormatter.format(instant.atZone(ZoneId.systemDefault()))
            } catch (_: Exception) {
                if (startTime.length >= 8) startTime.takeLast(8) else startTime
            }
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<HttpRequestModel>() {
        override fun areItemsTheSame(oldItem: HttpRequestModel, newItem: HttpRequestModel): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: HttpRequestModel, newItem: HttpRequestModel): Boolean {
            return oldItem == newItem
        }
    }
}
