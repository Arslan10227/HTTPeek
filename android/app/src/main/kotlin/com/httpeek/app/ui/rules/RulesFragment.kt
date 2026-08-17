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
import com.httpeek.app.R
import com.httpeek.app.core.rules.HostRule
import com.httpeek.app.core.rules.MockRule
import com.httpeek.app.core.rules.RewriteRule
import com.httpeek.app.core.rules.RulesEngine
import com.httpeek.app.databinding.FragmentRulesBinding
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

        binding.recyclerRules.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerRules.adapter = adapter
    }

    private fun setupListeners() {
        binding.chipGroupRulesCategory.setOnCheckedStateChangeListener { _, checkedIds ->
            currentTab = when (checkedIds.firstOrNull()) {
                R.id.chipTabMock -> RuleTab.MOCK
                R.id.chipTabWhitelist -> RuleTab.WHITELIST
                R.id.chipTabBlacklist -> RuleTab.BLACKLIST
                else -> RuleTab.REWRITE
            }
            loadTabRules()
        }

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
                            name = r.name.ifEmpty { "URL Rewrite" },
                            pattern = "Pattern: ${r.urlPattern}",
                            details = "Action: ${r.redirectUrl ?: "Modify Request"}",
                            enabled = r.enabled,
                            rawObject = r
                        )
                    )
                }
            }
            RuleTab.MOCK -> {
                rulesEngine.mockRules.forEach { m ->
                    displayRules.add(
                        GenericRuleItem(
                            id = m.id,
                            type = "MOCK",
                            name = m.name.ifEmpty { "Mock ${m.responseStatus}" },
                            pattern = "Pattern: ${m.urlPattern}",
                            details = "Status ${m.responseStatus}: ${m.responseBody.take(40)}...",
                            enabled = m.enabled,
                            rawObject = m
                        )
                    )
                }
            }
            RuleTab.WHITELIST -> {
                rulesEngine.whitelist.forEach { w ->
                    displayRules.add(
                        GenericRuleItem(
                            id = w.id,
                            type = "WHITELIST",
                            name = w.domain,
                            pattern = "Domain: ${w.domain}",
                            details = if (w.isRegex) "Regex Match" else "Wildcard / Subdomain match",
                            enabled = w.enabled,
                            rawObject = w
                        )
                    )
                }
            }
            RuleTab.BLACKLIST -> {
                rulesEngine.blacklist.forEach { b ->
                    displayRules.add(
                        GenericRuleItem(
                            id = b.id,
                            type = "BLACKLIST",
                            name = b.domain,
                            pattern = "Domain: ${b.domain}",
                            details = if (b.isRegex) "Regex Bypass" else "Wildcard Bypass",
                            enabled = b.enabled,
                            rawObject = b
                        )
                    )
                }
            }
        }

        adapter.notifyDataSetChanged()
        binding.layoutEmptyRules.visibility = if (displayRules.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun updateRuleEnabled(item: GenericRuleItem, enabled: Boolean) {
        when (currentTab) {
            RuleTab.REWRITE -> {
                val idx = rulesEngine.rewriteRules.indexOfFirst { it.id == item.id }
                if (idx >= 0) {
                    val r = rulesEngine.rewriteRules[idx]
                    rulesEngine.rewriteRules[idx] = r.copy(enabled = enabled)
                }
            }
            RuleTab.MOCK -> {
                val idx = rulesEngine.mockRules.indexOfFirst { it.id == item.id }
                if (idx >= 0) {
                    val m = rulesEngine.mockRules[idx]
                    rulesEngine.mockRules[idx] = m.copy(enabled = enabled)
                }
            }
            RuleTab.WHITELIST -> {
                val idx = rulesEngine.whitelist.indexOfFirst { it.id == item.id }
                if (idx >= 0) {
                    val w = rulesEngine.whitelist[idx]
                    rulesEngine.whitelist[idx] = w.copy(enabled = enabled)
                }
            }
            RuleTab.BLACKLIST -> {
                val idx = rulesEngine.blacklist.indexOfFirst { it.id == item.id }
                if (idx >= 0) {
                    val b = rulesEngine.blacklist[idx]
                    rulesEngine.blacklist[idx] = b.copy(enabled = enabled)
                }
            }
        }
        rulesEngine.saveRules()
    }

    private fun deleteRule(item: GenericRuleItem) {
        when (currentTab) {
            RuleTab.REWRITE -> rulesEngine.rewriteRules.removeAll { it.id == item.id }
            RuleTab.MOCK -> rulesEngine.mockRules.removeAll { it.id == item.id }
            RuleTab.WHITELIST -> rulesEngine.whitelist.removeAll { it.id == item.id }
            RuleTab.BLACKLIST -> rulesEngine.blacklist.removeAll { it.id == item.id }
        }
        rulesEngine.saveRules()
        loadTabRules()
        Toast.makeText(requireContext(), "Rule deleted", Toast.LENGTH_SHORT).show()
    }

    private fun showAddRuleDialog() {
        val ctx = requireContext()
        val layout = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 20, 40, 20)
        }

        val etName = EditText(ctx).apply { hint = "Rule Name (e.g. Test Mock / Redirect API)" }
        val etPattern = EditText(ctx).apply { hint = "URL or Domain Pattern (e.g. *.example.com/api/*)" }
        val etAction = EditText(ctx).apply { hint = "Action (Redirect URL or Mock JSON body)" }

        layout.addView(etName)
        layout.addView(etPattern)
        layout.addView(etAction)

        AlertDialog.Builder(ctx)
            .setTitle("Add ${currentTab.name} Rule")
            .setView(layout)
            .setPositiveButton("Create") { _, _ ->
                val name = etName.text.toString().trim()
                val pattern = etPattern.text.toString().trim()
                val action = etAction.text.toString().trim()

                if (pattern.isEmpty()) {
                    Toast.makeText(ctx, "Pattern cannot be empty", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }

                val id = UUID.randomUUID().toString()
                when (currentTab) {
                    RuleTab.REWRITE -> {
                        rulesEngine.rewriteRules.add(
                            0,
                            RewriteRule(id = id, name = name, urlPattern = pattern, redirectUrl = action.ifEmpty { null })
                        )
                    }
                    RuleTab.MOCK -> {
                        rulesEngine.mockRules.add(
                            0,
                            MockRule(id = id, name = name, urlPattern = pattern, responseBody = action.ifEmpty { "{\"status\":\"ok\"}" })
                        )
                    }
                    RuleTab.WHITELIST -> {
                        rulesEngine.whitelist.add(
                            0,
                            HostRule(id = id, domain = pattern, isRegex = pattern.startsWith("/") && pattern.endsWith("/"))
                        )
                    }
                    RuleTab.BLACKLIST -> {
                        rulesEngine.blacklist.add(
                            0,
                            HostRule(id = id, domain = pattern, isRegex = pattern.startsWith("/") && pattern.endsWith("/"))
                        )
                    }
                }

                rulesEngine.saveRules()
                loadTabRules()
                Toast.makeText(ctx, "Rule added successfully", Toast.LENGTH_SHORT).show()
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
            val type: TextView = v.findViewById(R.id.tvRuleTypeBadge)
            val name: TextView = v.findViewById(R.id.tvRuleName)
            val pattern: TextView = v.findViewById(R.id.tvRulePattern)
            val details: TextView = v.findViewById(R.id.tvRuleDetails)
            val switch: SwitchMaterial = v.findViewById(R.id.switchRuleEnabled)
            val btnDel: View = v.findViewById(R.id.btnDeleteRule)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val v = LayoutInflater.from(parent.context).inflate(R.layout.item_rule_card, parent, false)
            return ViewHolder(v)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            holder.type.text = item.type
            holder.name.text = item.name
            holder.pattern.text = item.pattern
            holder.details.text = item.details

            holder.switch.setOnCheckedChangeListener(null)
            holder.switch.isChecked = item.enabled
            holder.switch.setOnCheckedChangeListener { _, isChecked -> onToggle(item, isChecked) }

            holder.btnDel.setOnClickListener { onDelete(item) }
        }

        override fun getItemCount(): Int = items.size
    }
}
