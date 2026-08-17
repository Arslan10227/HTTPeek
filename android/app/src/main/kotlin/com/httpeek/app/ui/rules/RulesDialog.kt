package com.httpeek.app.ui.rules

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.DialogFragment
import com.httpeek.app.R
import com.httpeek.app.core.rules.HostRule
import com.httpeek.app.core.rules.MockRule
import com.httpeek.app.core.rules.RewriteRule
import com.httpeek.app.core.rules.RulesEngine
import java.util.*

class RulesDialog : DialogFragment() {

    private lateinit var rulesEngine: RulesEngine

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val context = requireContext()
        rulesEngine = RulesEngine(context)

        val view = LayoutInflater.from(context).inflate(R.layout.dialog_rules_manager, null)

        val spinnerType = view.findViewById<Spinner>(R.id.spinnerRuleType)
        val etPattern = view.findViewById<EditText>(R.id.etRulePattern)
        val etAction = view.findViewById<EditText>(R.id.etRuleAction)
        val btnAdd = view.findViewById<Button>(R.id.btnAddRule)
        val tvRulesList = view.findViewById<TextView>(R.id.tvActiveRulesList)

        val types = arrayOf("Domain Whitelist", "Domain Blacklist", "URL Rewrite / Redirect", "Mock Response")
        spinnerType.adapter = ArrayAdapter(context, android.R.layout.simple_spinner_dropdown_item, types)

        fun refreshRulesDisplay() {
            val sb = StringBuilder()
            sb.append("=== Active Whitelist (${rulesEngine.whitelist.size}) ===\n")
            rulesEngine.whitelist.forEach { sb.append(" • ${it.domain} (${if (it.enabled) "ACTIVE" else "OFF"})\n") }

            sb.append("\n=== Active Blacklist (${rulesEngine.blacklist.size}) ===\n")
            rulesEngine.blacklist.forEach { sb.append(" • ${it.domain} (${if (it.enabled) "ACTIVE" else "OFF"})\n") }

            sb.append("\n=== Active Rewrites (${rulesEngine.rewriteRules.size}) ===\n")
            rulesEngine.rewriteRules.forEach { sb.append(" • ${it.name}: ${it.urlPattern} -> ${it.redirectUrl ?: "[Modify Headers/Body]"}\n") }

            sb.append("\n=== Active Mocks (${rulesEngine.mockRules.size}) ===\n")
            rulesEngine.mockRules.forEach { sb.append(" • ${it.name}: ${it.urlPattern} => [${it.responseStatus} ${it.responseContentType}]\n") }

            tvRulesList.text = sb.toString()
        }

        refreshRulesDisplay()

        btnAdd.setOnClickListener {
            val pattern = etPattern.text.toString().trim()
            val action = etAction.text.toString().trim()

            if (pattern.isEmpty()) {
                Toast.makeText(context, "Please enter domain or URL pattern", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            when (spinnerType.selectedItemPosition) {
                0 -> { // Whitelist
                    rulesEngine.whitelist.add(HostRule(id = UUID.randomUUID().toString(), domain = pattern, enabled = true))
                }
                1 -> { // Blacklist
                    rulesEngine.blacklist.add(HostRule(id = UUID.randomUUID().toString(), domain = pattern, enabled = true))
                }
                2 -> { // Rewrite
                    rulesEngine.rewriteRules.add(
                        RewriteRule(
                            id = UUID.randomUUID().toString(),
                            name = "Rewrite $pattern",
                            urlPattern = pattern,
                            redirectUrl = if (action.isNotEmpty()) action else null,
                            enabled = true
                        )
                    )
                }
                3 -> { // Mock
                    rulesEngine.mockRules.add(
                        MockRule(
                            id = UUID.randomUUID().toString(),
                            name = "Mock $pattern",
                            urlPattern = pattern,
                            responseBody = if (action.isNotEmpty()) action else "{\"mock\": true}",
                            enabled = true
                        )
                    )
                }
            }

            rulesEngine.saveRules()
            refreshRulesDisplay()
            etPattern.text.clear()
            etAction.text.clear()
            Toast.makeText(context, "Rule added successfully", Toast.LENGTH_SHORT).show()
        }

        return AlertDialog.Builder(context)
            .setTitle("Rules & Interception Manager")
            .setView(view)
            .setPositiveButton("Done", null)
            .create()
    }
}
