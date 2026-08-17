package com.httpeek.app

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.httpeek.app.databinding.ActivityMainBinding
import com.httpeek.app.ui.apps.AppsFragment
import com.httpeek.app.ui.cert.SslFragment
import com.httpeek.app.ui.rules.RulesFragment
import com.httpeek.app.ui.toolbox.ToolboxFragment
import com.httpeek.app.ui.traffic.TrafficFragment

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private val trafficFragment by lazy { TrafficFragment() }
    private val appsFragment by lazy { AppsFragment() }
    private val rulesFragment by lazy { RulesFragment() }
    private val sslFragment by lazy { SslFragment() }
    private val toolboxFragment by lazy { ToolboxFragment() }

    private var activeFragment: Fragment = trafficFragment

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupFragments(savedInstanceState)
        setupBottomNavigation()
    }

    private fun setupFragments(savedInstanceState: Bundle?) {
        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .add(R.id.fragmentContainer, toolboxFragment, "toolbox").hide(toolboxFragment)
                .add(R.id.fragmentContainer, sslFragment, "ssl").hide(sslFragment)
                .add(R.id.fragmentContainer, rulesFragment, "rules").hide(rulesFragment)
                .add(R.id.fragmentContainer, appsFragment, "apps").hide(appsFragment)
                .add(R.id.fragmentContainer, trafficFragment, "traffic")
                .commit()
            activeFragment = trafficFragment
        }
    }

    private fun setupBottomNavigation() {
        binding.bottomNavigation.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_capture -> {
                    switchFragment(trafficFragment)
                    true
                }
                R.id.nav_apps -> {
                    switchFragment(appsFragment)
                    true
                }
                R.id.nav_rules -> {
                    switchFragment(rulesFragment)
                    true
                }
                R.id.nav_ca -> {
                    switchFragment(sslFragment)
                    true
                }
                R.id.nav_toolbox -> {
                    switchFragment(toolboxFragment)
                    true
                }
                else -> false
            }
        }
    }

    private fun switchFragment(target: Fragment) {
        if (activeFragment == target) return
        supportFragmentManager.beginTransaction()
            .hide(activeFragment)
            .show(target)
            .commit()
        activeFragment = target
    }
}
