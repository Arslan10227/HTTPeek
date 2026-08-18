package com.httpeek.app.ui.apps

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.ImageView
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.httpeek.app.R
import com.httpeek.app.core.vpn.AppFilterManager
import com.httpeek.app.core.vpn.AppFilterMode
import com.httpeek.app.core.vpn.InstalledAppItem
import com.httpeek.app.databinding.FragmentAppsBinding
import com.httpeek.app.ui.common.LottieToast
import kotlinx.coroutines.launch

class AppsFragment : Fragment() {

    private var _binding: FragmentAppsBinding? = null
    private val binding get() = _binding!!

    private lateinit var filterManager: AppFilterManager
    private var allApps = listOf<InstalledAppItem>()
    private val filteredApps = mutableListOf<InstalledAppItem>()
    private lateinit var appAdapter: AppAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentAppsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        filterManager = AppFilterManager(requireContext())

        setupFilterChips()
        setupRecyclerView()
        setupSearchAndActions()
        loadApps()
    }

    private fun setupFilterChips() {
        when (filterManager.getFilterMode()) {
            AppFilterMode.ALL_APPS -> binding.chipAllApps.isChecked = true
            AppFilterMode.ONLY_SELECTED -> binding.chipWhitelist.isChecked = true
            AppFilterMode.EXCLUDE_SELECTED -> binding.chipBlacklist.isChecked = true
        }

        binding.chipGroupFilterMode.setOnCheckedStateChangeListener { _, checkedIds ->
            when (checkedIds.firstOrNull()) {
                R.id.chipWhitelist -> {
                    filterManager.setFilterMode(AppFilterMode.ONLY_SELECTED)
                    LottieToast.showShield(requireContext(), "🎯 Intercept ONLY selected apps (Whitelist)")
                }
                R.id.chipBlacklist -> {
                    filterManager.setFilterMode(AppFilterMode.EXCLUDE_SELECTED)
                    LottieToast.showWink(requireContext(), "🛡️ Exclude selected apps from capture (Blacklist)")
                }
                else -> {
                    filterManager.setFilterMode(AppFilterMode.ALL_APPS)
                    LottieToast.showSuccess(requireContext(), "🌐 Capturing ALL applications globally")
                }
            }
        }
    }

    private fun setupRecyclerView() {
        appAdapter = AppAdapter(filteredApps) { item, isChecked ->
            item.isSelected = isChecked
            filterManager.toggleApp(item.packageName, isChecked)
        }

        binding.rvApps.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = appAdapter
        }
    }

    private fun setupSearchAndActions() {
        binding.etAppSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                filterList(s?.toString() ?: "")
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        binding.btnSelectAll.setOnClickListener {
            val selected = mutableSetOf<String>()
            allApps.forEach {
                it.isSelected = true
                selected.add(it.packageName)
            }
            filterManager.setSelectedPackages(selected)
            appAdapter.notifyDataSetChanged()
            LottieToast.showRocket(requireContext(), "Selected all ${allApps.size} apps")
        }

        binding.btnDeselectAll.setOnClickListener {
            allApps.forEach { it.isSelected = false }
            filterManager.setSelectedPackages(emptySet())
            appAdapter.notifyDataSetChanged()
            LottieToast.showWink(requireContext(), "Deselected all apps")
        }
    }

    private fun loadApps() {
        lifecycleScope.launch {
            allApps = filterManager.loadInstalledApps()
            filterList(binding.etAppSearch.text?.toString() ?: "")
        }
    }

    private fun filterList(query: String) {
        val q = query.trim().lowercase()
        filteredApps.clear()
        if (q.isEmpty()) {
            filteredApps.addAll(allApps)
        } else {
            filteredApps.addAll(allApps.filter {
                it.name.lowercase().contains(q) || it.packageName.lowercase().contains(q)
            })
        }
        appAdapter.notifyDataSetChanged()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    class AppAdapter(
        private val items: List<InstalledAppItem>,
        private val onCheckChanged: (InstalledAppItem, Boolean) -> Unit
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

            holder.check.setOnCheckedChangeListener(null)
            holder.check.isChecked = item.isSelected

            holder.itemView.setOnClickListener {
                val newChecked = !holder.check.isChecked
                holder.check.isChecked = newChecked
                onCheckChanged(item, newChecked)
            }

            holder.check.setOnCheckedChangeListener { _, isChecked ->
                onCheckChanged(item, isChecked)
            }
        }

        override fun getItemCount(): Int = items.size
    }
}
