package com.pianogame.desktop

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private var isWebViewConfigured = false

  override fun onCreate(savedInstanceState: Bundle?) {
    // enableEdgeToEdge() // We handle insets manually for immersive mode
    super.onCreate(savedInstanceState)
    
    // Hide system UI (Fullscreen / Immersive mode)
    val windowInsetsController = androidx.core.view.WindowCompat.getInsetsController(window, window.decorView)
    windowInsetsController.systemBarsBehavior = androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    windowInsetsController.hide(androidx.core.view.WindowInsetsCompat.Type.systemBars())

    // Wait for the WebView to be added to the view hierarchy
    window.decorView.viewTreeObserver.addOnGlobalLayoutListener(object : android.view.ViewTreeObserver.OnGlobalLayoutListener {
      override fun onGlobalLayout() {
        if (!isWebViewConfigured) {
          isWebViewConfigured = configureWebView(window.decorView)
        }
      }
    })
  }

  override fun onResume() {
    super.onResume()
    if (!isWebViewConfigured) {
      isWebViewConfigured = configureWebView(window.decorView)
    }
  }

  private fun configureWebView(view: android.view.View): Boolean {
    if (view is android.webkit.WebView) {
      view.settings.useWideViewPort = true
      view.settings.loadWithOverviewMode = true
      return true
    } else if (view is android.view.ViewGroup) {
      for (i in 0 until view.childCount) {
        if (configureWebView(view.getChildAt(i))) {
          return true
        }
      }
    }
    return false
  }
}
