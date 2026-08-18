package com.httpeek.app.ui.rules

import android.app.AlertDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.switchmaterial.SwitchMaterial
import com.google.android.material.tabs.TabLayout
import com.httpeek.app.R
import com.httpeek.app.core.rules.HostRule
import com.httpeek.app.core.rules.MockRule
import com.httpeek.app.core.rules.RewriteRule
import com.httpeek.app.core.rules.RulesEngine
import com.httpeek.app.databinding.FragmentRulesBinding
import com.httpeek.app.ui.common.LottieToast
import java.util.UUID

class RulesFragment : Fragment() {

    private var _binding: FragmentRulesBinding? = null
    private val binding get() = _binding!!

    private lateinit var rulesEngine: RulesEngine
    private var currentTab = RuleTab.REWRITE
    private lateinit var adapter: RulesAdapter

    enum class RuleTab { REWRITE, MOCK, WHITELIST, BLACKLIST }

    data class GenericRuleItem(
        val id: String,
        val type: String,
        val name: String,
        val pattern: String,
        val details: String,
        var enabled: Boolean,
        val rawObject: Any
    )

    private val displayRules = mutableListOf<GenericRuleItem>()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentRulesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        rulesEngine = RulesEngine(requireContext())

        setupRecyclerView()
        setupListeners()
        loadTabRules()
    }

    private fun setupRecyclerView() {
        adapter = RulesAdapter(
            items = displayRules,
            onToggle = { item, isChecked ->
                item.enabled = isChecked
                updateRuleEnabled(item, isChecked)
            },
            onDelete = { item ->
                deleteRule(item)
            }
        )

        binding.rvRules.layoutManager = LinearLayoutManager(requireContext())
        binding.rvRules.adapter = adapter
    }

    private fun setupListeners() {
        binding.tabLayoutRules.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                currentTab = when (tab?.position) {
                    1 -> RuleTab.MOCK
                    2 -> RuleTab.WHITELIST
                    3 -> RuleTab.BLACKLIST
                    else -> RuleTab.REWRITE
                }
                loadTabRules()
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })

        binding.btnAddRule.setOnClickListener {
            showAddRuleDialog()
        }
    }

    private fun loadTabRules() {
        rulesEngine.loadRules()
        displayRules.clear()

        when (currentTab) {
            RuleTab.REWRITE -> {
                rulesEngine.rewriteRules.forEach { r ->
                    displayRules.add(
                        GenericRuleItem(
                            id = r.id,
                            type = "REWRITE",
                            name = r.name.ifEmpty { r.urlPattern },
                            pattern = r.urlPattern,
                            details = "Redirect: ${r.redirectUrl ?: r.replaceBody ?: "Pass"}",
                            enabled = r.enabled,
                            rawObject = r
                        )
                    )
                }
            }
            RuleTab.MOCK -> {
                rulesEngine.mockRules.forEach { r ->
                    displayRules.add(
                        GenericRuleItem(
                            id = r.id,
                            type = "MOCK (${r.responseStatus})",
                            name = r.name.ifEmpty { r.urlPattern },
                            pattern = r.urlPattern,
                            details = "Body: ${r.responseBody.take(40)}...",
                            enabled = r.enabled,
                            rawObject = r
                        )
                    )
                }
            }
            RuleTab.WHITELIST -> {
                rulesEngine.whitelist.forEach { r ->
                    displayRules.add(
                        GenericRuleItem(
                            id = r.id,
                            type = "WHITELIST",
                            name = r.domain,
                            pattern = r.domain,
                            details = "Capture only this domain",
                            enabled = r.enabled,
                            rawObject = r
                        )
                    )
                }
            }
            RuleTab.BLACKLIST -> {
                rulesEngine.blacklist.forEach { r ->
                    displayRules.add(
                        GenericRuleItem(
                            id = r.id,
                            type = "BLACKLIST",
                            name = r.domain,
                            pattern = r.domain,
                            details = "Bypass capture for this domain",
                            enabled = r.enabled,
                            rawObject = r
                        )
                    )
                }
            }
        }

        adapter.notifyDataSetChanged()
        val empty = displayRules.isEmpty()
        binding.rulesEmptyState.visibility = if (empty) View.VISIBLE else View.GONE
        binding.rvRules.visibility = if (empty) View.GONE else View.VISIBLE
    }

    private fun updateRuleEnabled(item: GenericRuleItem, enabled: Boolean) {
        when (val obj = item.rawObject) {
            is RewriteRule -> {
                val idx = rulesEngine.rewriteRules.indexOfFirst { it.id == obj.id }
                if (idx >= 0) rulesEngine.rewriteRules[idx] = obj.copy(enabled = enabled)
            }
            is MockRule -> {
                val idx = rulesEngine.mockRules.indexOfFirst { it.id == obj.id }
                if (idx >= 0) rulesEngine.mockRules[idx] = obj.copy(enabled = enabled)
            }
            is HostRule -> {
                val wIdx = rulesEngine.whitelist.indexOfFirst { it.id == obj.id }
                if (wIdx >= 0) rulesEngine.whitelist[wIdx] = obj.copy(enabled = enabled)
                val bIdx = rulesEngine.blacklist.indexOfFirst { it.id == obj.id }
                if (bIdx >= 0) rulesEngine.blacklist[bIdx] = obj.copy(enabled = enabled)
            }
        }
        rulesEngine.saveRules()
    }

    private fun deleteRule(item: GenericRuleItem) {
        when (item.rawObject) {
            is RewriteRule -> rulesEngine.rewriteRules.removeAll { it.id == item.id }
            is MockRule -> rulesEngine.mockRules.removeAll { it.id == item.id }
            is HostRule -> {
                rulesEngine.whitelist.removeAll { it.id == item.id }
                rulesEngine.blacklist.removeAll { it.id == item.id }
            }
        }
        rulesEngine.saveRules()
        loadTabRules()
        LottieToast.showWink(requireContext(), "🗑️ Rule '${item.name}' deleted")
    }

    private fun showAddRuleDialog() {
        val view = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_rules_manager, null)
        val etPattern = view.findViewById<EditText>(R.id.etRulePattern)
        val etAction = view.findViewById<EditText>(R.id.etRuleAction)
        val btnAdd = view.findViewById<Button>(R.id.btnAddRule)
        val tvActiveList = view.findViewById<TextView>(R.id.tvActiveRulesList)
        val spinnerType = view.findViewById<Spinner>(R.id.spinnerRuleType)

        btnAdd.visibility = View.GONE
        tvActiveList.visibility = View.GONE
        spinnerType.visibility = View.GONE

        when (currentTab) {
            RuleTab.REWRITE -> {
                etPattern.hint = "URL Pattern (e.g. *.api.com/v1/*)"
                etAction.hint = "Redirect Target URL (e.g. http://10.0.0.2:8080)"
            }
            RuleTab.MOCK -> {
                etPattern.hint = "URL Pattern (e.g. *.api.com/user)"
                etAction.hint = "Mock Response Body JSON (e.g. {\"status\":\"ok\"})"
            }
            RuleTab.WHITELIST -> {
                etPattern.hint = "Domain Pattern (e.g. *.example.com)"
                etAction.visibility = View.GONE
            }
            RuleTab.BLACKLIST -> {
                etPattern.hint = "Domain Pattern (e.g. *.adserver.com)"
                etAction.visibility = View.GONE
            }
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Add ${currentTab.name} Rule")
            .setView(view)
            .setPositiveButton("Create") { _, _ ->
                val pattern = etPattern.text.toString().trim()
                val action = etAction.text.toString().trim()

                if (pattern.isNotEmpty()) {
                    when (currentTab) {
                        RuleTab.REWRITE -> {
                            rulesEngine.rewriteRules.add(
                                RewriteRule(
                                    id = UUID.randomUUID().toString(),
                                    name = pattern,
                                    urlPattern = pattern,
                                    redirectUrl = action.ifEmpty { null },
                                    enabled = true
                                )
                            )
                        }
                        RuleTab.MOCK -> {
                            rulesEngine.mockRules.add(
                                MockRule(
                                    id = UUID.randomUUID().toString(),
                                    name = pattern,
                                    urlPattern = pattern,
                                    responseStatus = 200,
                                    responseBody = action.ifEmpty { "{\"status\": \"mocked\"}" },
                                    enabled = true
                                )
                            )
                        }
                        RuleTab.WHITELIST -> {
                            rulesEngine.whitelist.add(
                                HostRule(
                                    id = UUID.randomUUID().toString(),
                                    domain = pattern,
                                    enabled = true
                                )
                            )
                        }
                        RuleTab.BLACKLIST -> {
                            rulesEngine.blacklist.add(
                                HostRule(
                                    id = UUID.randomUUID().toString(),
                                    domain = pattern,
                                    enabled = true
                                )
                            )
                        }
                    }
                    rulesEngine.saveRules()
                    loadTabRules()
                    LottieToast.showRocket(requireContext(), "🚀 Rule '$pattern' active!")
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    class RulesAdapter(
        private val items: List<GenericRuleItem>,
        private val onToggle: (GenericRuleItem, Boolean) -> Unit,
        private val onDelete: (GenericRuleItem) -> Unit
    ) : RecyclerView.Adapter<RulesAdapter.ViewHolder>() {

        class ViewHolder(v: View) : RecyclerView.ViewHolder(v) {
            val tvType: TextView = v.findViewById(R.id.tvRuleTypeBadge)
            val tvName: TextView = v.findViewById(R.id.tvRuleName)
            val tvPattern: TextView = v.findViewById(R.id.tvRulePattern)
            val tvDetails: TextView = v.findViewById(R.id.tvRuleDetails)
            val switchEnabled: SwitchMaterial = v.findViewById(R.id.switchRuleEnabled)
            val btnDelete: ImageButton = v.findViewById(R.id.btnDeleteRule)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val v = LayoutInflater.from(parent.context).inflate(R.layout.item_rule_card, parent, false)
            return ViewHolder(v)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            holder.tvType.text = item.type
            holder.tvName.text = item.name
            holder.tvPattern.text = item.pattern
            holder.tvDetails.text = item.details

            holder.switchEnabled.setOnCheckedChangeListener(null)
            holder.switchEnabled.isChecked = item.enabled
            holder.switchEnabled.setOnCheckedChangeListener { _, isChecked ->
                onToggle(item, isChecked)
            }

            holder.btnDelete.setOnClickListener {
                onDelete(item)
            }
        }

        override fun getItemCount(): Int = items.size
    }
}
