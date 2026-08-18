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
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.httpeek.app.R
import com.httpeek.app.core.vpn.AppFilterManager
import com.httpeek.app.core.vpn.AppFilterMode
import com.httpeek.app.core.vpn.InstalledAppItem
import com.httpeek.app.databinding.FragmentAppsBinding
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

        setupModeRadios()
        setupRecyclerView()
        setupSearchAndActions()
        loadApps()
    }

    private fun setupModeRadios() {
        when (filterManager.getFilterMode()) {
            AppFilterMode.ALL_APPS -> binding.radioAllApps.isChecked = true
            AppFilterMode.ONLY_SELECTED -> binding.radioOnlySelected.isChecked = true
            AppFilterMode.EXCLUDE_SELECTED -> binding.radioExcludeSelected.isChecked = true
        }

        binding.radioAllApps.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                filterManager.setFilterMode(AppFilterMode.ALL_APPS)
                Toast.makeText(requireContext(), "🌐 ٩(◕‿◕｡)۶ Mode: Capture ALL applications globally!", Toast.LENGTH_SHORT).show()
            }
        }

        binding.radioOnlySelected.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                filterManager.setFilterMode(AppFilterMode.ONLY_SELECTED)
                Toast.makeText(requireContext(), "🎯 (・∀・) Mode: Intercept ONLY selected apps (Whitelist)!", Toast.LENGTH_SHORT).show()
            }
        }

        binding.radioExcludeSelected.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                filterManager.setFilterMode(AppFilterMode.EXCLUDE_SELECTED)
                Toast.makeText(requireContext(), "🛡️ (˘▾˘) Mode: Exclude selected apps (Blacklist)!", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setupRecyclerView() {
        appAdapter = AppAdapter(filteredApps) { item, isChecked ->
            item.isSelected = isChecked
            filterManager.toggleApp(item.packageName, isChecked)
            updateCountLabel()
        }

        binding.recyclerApps.apply {
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

        binding.btnSelectAllApps.setOnClickListener {
            filteredApps.forEach {
                it.isSelected = true
                filterManager.toggleApp(it.packageName, true)
            }
            appAdapter.notifyDataSetChanged()
            updateCountLabel()
            Toast.makeText(requireContext(), "🎯 ＼(≧▽≦)／ Selected all visible applications!", Toast.LENGTH_SHORT).show()
        }

        binding.btnDeselectAllApps.setOnClickListener {
            filteredApps.forEach {
                it.isSelected = false
                filterManager.toggleApp(it.packageName, false)
            }
            appAdapter.notifyDataSetChanged()
            updateCountLabel()
            Toast.makeText(requireContext(), "🧹 (︶ω︶) Cleared selection (0 apps selected)", Toast.LENGTH_SHORT).show()
        }
    }

    private fun loadApps() {
        lifecycleScope.launch {
            binding.progressBarApps.visibility = View.VISIBLE
            allApps = filterManager.loadInstalledApps()
            binding.progressBarApps.visibility = View.GONE
            filterList(binding.etAppSearch.text.toString())
        }
    }

    private fun filterList(query: String) {
        filteredApps.clear()
        if (query.isEmpty()) {
            filteredApps.addAll(allApps)
        } else {
            val q = query.lowercase()
            filteredApps.addAll(allApps.filter {
                it.name.lowercase().contains(q) || it.packageName.lowercase().contains(q)
            })
        }
        appAdapter.notifyDataSetChanged()
        updateCountLabel()
    }

    private fun updateCountLabel() {
        val selectedCount = filterManager.getSelectedPackages().size
        binding.tvAppCount.text = "$selectedCount of ${allApps.size} selected"
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
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

            holder.check.setOnCheckedChangeListener(null)
            holder.check.isChecked = item.isSelected
            holder.check.setOnCheckedChangeListener { _, isChecked -> onCheck(item, isChecked) }

            holder.itemView.setOnClickListener {
                holder.check.isChecked = !holder.check.isChecked
            }
        }

        override fun getItemCount(): Int = items.size
    }
}
