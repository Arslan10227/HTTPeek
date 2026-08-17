package com.httpeek.app.ui.inspector

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.httpeek.app.databinding.ItemInspectorCardBinding

data class InspectorCardItem(
    val id: String,
    val title: String,
    val body: String,
    var expanded: Boolean = true
)

class InspectorCardAdapter : RecyclerView.Adapter<InspectorCardAdapter.ViewHolder>() {

    private val items = mutableListOf<InspectorCardItem>()

    fun submitCards(cards: List<InspectorCardItem>) {
        items.clear()
        items.addAll(cards)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemInspectorCardBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class ViewHolder(private val binding: ItemInspectorCardBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: InspectorCardItem) {
            binding.tvCardTitle.text = item.title
            binding.tvCardBody.text = item.body
            binding.tvCardBody.visibility = if (item.expanded) View.VISIBLE else View.GONE
            binding.ivChevron.rotation = if (item.expanded) 180f else 0f

            binding.root.setOnClickListener {
                item.expanded = !item.expanded
                notifyItemChanged(bindingAdapterPosition)
            }
        }
    }
}
