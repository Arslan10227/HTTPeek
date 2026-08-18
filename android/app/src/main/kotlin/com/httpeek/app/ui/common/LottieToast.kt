package com.httpeek.app.ui.common

import android.app.Activity
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.AlphaAnimation
import android.view.animation.AnimationSet
import android.view.animation.ScaleAnimation
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import com.airbnb.lottie.LottieAnimationView
import com.httpeek.app.R

enum class LottieFaceType(val assetFile: String) {
    HAPPY("lottie/face_happy.json"),
    WINK("lottie/face_wink.json"),
    ROCKET("lottie/face_rocket.json"),
    SHIELD("lottie/face_shield.json"),
    ERROR("lottie/face_error.json")
}

/**
 * Modern floating animated Lottie Toast popup.
 * Renders smooth 60fps animated faces & emojis for all application feedback.
 */
object LottieToast {

    fun show(
        context: Context,
        message: String,
        type: LottieFaceType = LottieFaceType.HAPPY,
        durationMs: Long = 2500L
    ) {
        val activity = context as? Activity
        if (activity != null && !activity.isFinishing && !activity.isDestroyed) {
            showInActivity(activity, message, type, durationMs)
        } else {
            showSystemToastFallback(context, message, type)
        }
    }

    fun showSuccess(context: Context, message: String) = show(context, message, LottieFaceType.HAPPY)
    fun showWink(context: Context, message: String) = show(context, message, LottieFaceType.WINK)
    fun showRocket(context: Context, message: String) = show(context, message, LottieFaceType.ROCKET)
    fun showShield(context: Context, message: String) = show(context, message, LottieFaceType.SHIELD)
    fun showError(context: Context, message: String) = show(context, message, LottieFaceType.ERROR)

    private fun showInActivity(
        activity: Activity,
        message: String,
        type: LottieFaceType,
        durationMs: Long
    ) {
        Handler(Looper.getMainLooper()).post {
            try {
                val rootView = activity.findViewById<ViewGroup>(android.R.id.content) ?: return@post
                val toastView = LayoutInflater.from(activity).inflate(R.layout.layout_lottie_toast, rootView, false)

                val lottieView = toastView.findViewById<LottieAnimationView>(R.id.lottieFaceView)
                val tvMessage = toastView.findViewById<TextView>(R.id.tvToastMessage)

                lottieView.setAnimation(type.assetFile)
                lottieView.playAnimation()
                tvMessage.text = message

                val params = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                    topMargin = 100
                }

                toastView.layoutParams = params

                // Entrance Animation
                val enterAnim = AnimationSet(true).apply {
                    addAnimation(AlphaAnimation(0f, 1f).apply { duration = 250 })
                    addAnimation(ScaleAnimation(0.8f, 1f, 0.8f, 1f, ScaleAnimation.RELATIVE_TO_SELF, 0.5f, ScaleAnimation.RELATIVE_TO_SELF, 0.5f).apply { duration = 250 })
                }
                toastView.startAnimation(enterAnim)
                rootView.addView(toastView)

                // Exit Animation after duration
                Handler(Looper.getMainLooper()).postDelayed({
                    try {
                        val exitAnim = AlphaAnimation(1f, 0f).apply {
                            duration = 250
                            setAnimationListener(object : android.view.animation.Animation.AnimationListener {
                                override fun onAnimationStart(animation: android.view.animation.Animation?) {}
                                override fun onAnimationEnd(animation: android.view.animation.Animation?) {
                                    rootView.removeView(toastView)
                                }
                                override fun onAnimationRepeat(animation: android.view.animation.Animation?) {}
                            })
                        }
                        toastView.startAnimation(exitAnim)
                    } catch (e: Exception) {}
                }, durationMs)
            } catch (e: Exception) {
                showSystemToastFallback(activity, message, type)
            }
        }
    }

    private fun showSystemToastFallback(context: Context, message: String, type: LottieFaceType) {
        Handler(Looper.getMainLooper()).post {
            try {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                    val toast = Toast(context)
                    val v = LayoutInflater.from(context).inflate(R.layout.layout_lottie_toast, null)
                    v.findViewById<LottieAnimationView>(R.id.lottieFaceView).apply {
                        setAnimation(type.assetFile)
                        playAnimation()
                    }
                    v.findViewById<TextView>(R.id.tvToastMessage).text = message
                    toast.view = v
                    toast.duration = Toast.LENGTH_SHORT
                    toast.show()
                } else {
                    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            }
        }
    }
}
