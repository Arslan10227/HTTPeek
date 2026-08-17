package com.httpeek.app.ui.apps

import android.app.Dialog
import android.content.Context
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.httpeek.app.R
import com.httpeek.app.core.vpn.AppFilterManager
import com.httpeek.app.core.vpn.AppFilterMode
import com.httpeek.app.core.vpn.InstalledAppItem
import kotlinx.coroutines.launch

class AppsFilterDialog : DialogFragment() {

    private lateinit var filterManager: AppFilterManager
    private var allApps = listOf<InstalledAppItem>()
    private var filteredApps = mutableListOf<InstalledAppItem>()
    private lateinit var appAdapter: AppAdapter

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        filterManager = AppFilterManager(requireContext())
        val context = requireContext()

        val view = LayoutInflater.from(context).inflate(R.layout.dialog_app_filter, null)

        val radioAll = view.findViewById<RadioButton>(R.id.radioAllApps)
        val radioOnly = view.findViewById<RadioButton>(R.id.radioOnlySelected)
        val radioExclude = view.findViewById<RadioButton>(R.id.radioExcludeSelected)
        val etSearch = view.findViewById<EditText>(R.id.etAppSearch)
        val btnSelectAll = view.findViewById<Button>(R.id.btnSelectAllApps)
        val btnDeselectAll = view.findViewById<Button>(R.id.btnDeselectAllApps)
        val recyclerView = view.findViewById<RecyclerView>(R.id.recyclerApps)
        val progressBar = view.findViewById<ProgressBar>(R.id.progressBarApps)

        // Set initial radio
        when (filterManager.getFilterMode()) {
            AppFilterMode.ALL_APPS -> radioAll.isChecked = true
            AppFilterMode.ONLY_SELECTED -> radioOnly.isChecked = true
            AppFilterMode.EXCLUDE_SELECTED -> radioExclude.isChecked = true
        }

        radioAll.setOnCheckedChangeListener { _, isChecked -> if (isChecked) filterManager.setFilterMode(AppFilterMode.ALL_APPS) }
        radioOnly.setOnCheckedChangeListener { _, isChecked -> if (isChecked) filterManager.setFilterMode(AppFilterMode.ONLY_SELECTED) }
        radioExclude.setOnCheckedChangeListener { _, isChecked -> if (isChecked) filterManager.setFilterMode(AppFilterMode.EXCLUDE_SELECTED) }

        appAdapter = AppAdapter(filteredApps) { item, isChecked ->
            item.isSelected = isChecked
            filterManager.toggleApp(item.packageName, isChecked)
        }
        recyclerView.layoutManager = LinearLayoutManager(context)
        recyclerView.adapter = appAdapter

        etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                filterList(s?.toString() ?: "")
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        btnSelectAll.setOnClickListener {
            filteredApps.forEach {
                it.isSelected = true
                filterManager.toggleApp(it.packageName, true)
            }
            appAdapter.notifyDataSetChanged()
        }

        btnDeselectAll.setOnClickListener {
            filteredApps.forEach {
                it.isSelected = false
                filterManager.toggleApp(it.packageName, false)
            }
            appAdapter.notifyDataSetChanged()
        }

        lifecycleScope.launch {
            progressBar.visibility = View.VISIBLE
            allApps = filterManager.loadInstalledApps()
            progressBar.visibility = View.GONE
            filterList(etSearch.text.toString())
        }

        return AlertDialog.Builder(context)
            .setTitle("Per-App Traffic Filter")
            .setView(view)
            .setPositiveButton("Done", null)
            .create()
    }

    private fun filterList(query: String) {
        filteredApps.clear()
        if (query.isEmpty()) {
            filteredApps.addAll(allApps)
        } else {
            filteredApps.addAll(allApps.filter {
                it.name.contains(query, ignoreCase = true) || it.packageName.contains(query, ignoreCase = true)
            })
        }
        appAdapter.notifyDataSetChanged()
    }

    class AppAdapter(
        private val items: List<InstalledAppItem>,
        private val onCheck: (InstalledAppItem, Boolean) -> Unit
    ) : RecyclerView.Adapter<AppAdapter.ViewHolder>() {

        class ViewHolder(v: View) : RecyclerView.ViewHolder(v) {
            val icon: ImageView = v.findViewById(R.id.imgAppIcon)
            val name: TextView = v.findViewById(R.id.tvAppName)
            val pkg: TextView = v.findViewById(R.id.tvAppPkg)
            val check: CheckBox = v.findViewById(R.id.chkAppSelected)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val v = LayoutInflater.from(parent.context).inflate(R.layout.item_app_filter, parent, false)
            return ViewHolder(v)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            holder.name.text = item.name
            holder.pkg.text = item.packageName
            holder.icon.setImageDrawable(item.icon)
            holder.check.isChecked = item.isSelected

            holder.check.setOnCheckedChangeListener(null)
            holder.check.isChecked = item.isSelected
            holder.check.setOnCheckedChangeListener { _, isChecked ->
                onCheck(item, isChecked)
            }

            holder.itemView.setOnClickListener {
                holder.check.isChecked = !holder.check.isChecked
            }
        }

        override fun getItemCount(): Int = items.size
    }
}
