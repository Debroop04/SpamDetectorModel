package app.callshield.ui

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import app.callshield.CallShieldApp
import app.callshield.ui.components.Divider
import app.callshield.ui.components.ToastHost
import app.callshield.ui.screens.CallDetailScreen
import app.callshield.ui.screens.CallsScreen
import app.callshield.ui.screens.ConnectScreen
import app.callshield.ui.screens.HomeScreen
import app.callshield.ui.screens.LoginScreen
import app.callshield.ui.screens.LookupScreen
import app.callshield.ui.screens.NewReportScreen
import app.callshield.ui.screens.RegisterScreen
import app.callshield.ui.screens.ReportDetailScreen
import app.callshield.ui.screens.ReportsScreen
import app.callshield.ui.screens.SettingsScreen
import app.callshield.ui.screens.SetupScreen
import app.callshield.ui.theme.AppTheme
import app.callshield.ui.theme.Icons

@Composable
fun AppRoot(app: CallShieldApp, linkedServer: String?, onLinkHandled: () -> Unit) {
    val nav = remember {
        Navigator(
            when {
                app.session.server.isNullOrBlank() -> Route.Connect
                app.session.token.isNullOrBlank() -> Route.Login
                else -> Route.Home
            },
        )
    }

    LaunchedEffect(linkedServer) {
        if (linkedServer != null && !app.session.isSignedIn) nav.reset(Route.Connect)
    }

    DisposableEffect(Unit) {
        app.api.onUnauthorized = {
            app.session.signOut()
            app.store.clear()
            nav.reset(Route.Login)
        }
        onDispose { app.api.onUnauthorized = null }
    }

    BackHandler(enabled = nav.stack.size > 1) { nav.pop() }

    val c = AppTheme.colors
    // Status and navigation bar icons follow the app's theme (which can differ from the phone's).
    val view = LocalView.current
    SideEffect {
        val window = (view.context as? Activity)?.window ?: return@SideEffect
        WindowCompat.getInsetsController(window, view).apply {
            isAppearanceLightStatusBars = !c.isDark
            isAppearanceLightNavigationBars = !c.isDark
        }
    }
    Box(Modifier.fillMaxSize().background(c.bg)) {
        Column(Modifier.fillMaxSize()) {
            AnimatedContent(
                targetState = nav.current,
                transitionSpec = { fadeIn(tween(160)) togetherWith fadeOut(tween(120)) },
                modifier = Modifier.weight(1f),
                label = "screen",
            ) { route ->
                Screen(route, app, nav, linkedServer, onLinkHandled)
            }
            if (nav.current.isTab) BottomBar(nav)
        }
        ToastHost(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = if (nav.current.isTab) 84.dp else 20.dp))
    }
}

@Composable
private fun Screen(route: Route, app: CallShieldApp, nav: Navigator, linkedServer: String?, onLinkHandled: () -> Unit) {
    when (route) {
        Route.Connect -> ConnectScreen(app, linkedServer, onLinkHandled) { nav.reset(Route.Login) }
        Route.Login -> LoginScreen(app, onRegister = { nav.push(Route.Register) }, onChangeServer = { nav.reset(Route.Connect) }) {
            nav.reset(Route.Home)
            nav.push(Route.Setup)
        }
        Route.Register -> RegisterScreen(app, onBack = { nav.pop() }) {
            nav.reset(Route.Home)
            nav.push(Route.Setup)
        }
        Route.Setup -> SetupScreen(app, onBack = { if (!nav.pop()) nav.reset(Route.Home) })
        Route.Home -> HomeScreen(app, nav)
        Route.Calls -> CallsScreen(app, nav)
        is Route.CallDetail -> CallDetailScreen(app, route.id, nav)
        is Route.NewReport -> NewReportScreen(app, route.number, nav)
        Route.Reports -> ReportsScreen(app, nav)
        is Route.ReportDetail -> ReportDetailScreen(app, route.id, nav)
        Route.Lookup -> LookupScreen(app, nav)
        Route.Settings -> SettingsScreen(app, nav)
    }
}

private data class Tab(val route: Route, val label: String, val icon: ImageVector)

private val TABS = listOf(
    Tab(Route.Home, "Home", Icons.Home),
    Tab(Route.Calls, "Calls", Icons.PhoneIncoming),
    Tab(Route.NewReport(), "Report", Icons.PlusCircle),
    Tab(Route.Reports, "Reports", Icons.FileText),
    Tab(Route.Settings, "Settings", Icons.Settings),
)

@Composable
private fun BottomBar(nav: Navigator) {
    val c = AppTheme.colors
    Column(Modifier.fillMaxWidth().background(c.surface)) {
        Divider()
        Row(Modifier.fillMaxWidth().navigationBarsPadding().height(64.dp).padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            TABS.forEach { tab ->
                val selected = when (tab.route) {
                    is Route.NewReport -> nav.current is Route.NewReport
                    else -> nav.current == tab.route
                }
                val center = tab.route is Route.NewReport
                Column(
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { nav.tab(tab.route) }
                        .padding(vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    if (center) {
                        // The main action is always a solid button, so only the open tab looks highlighted.
                        Box(
                            Modifier.size(width = 52.dp, height = 32.dp).clip(RoundedCornerShape(12.dp)).background(c.accent),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(tab.icon, tab.label, Modifier.size(20.dp), tint = c.onAccent)
                        }
                    } else {
                        Box(
                            Modifier.size(width = 52.dp, height = 32.dp).clip(RoundedCornerShape(12.dp)).background(if (selected) c.accentSoft else c.surface),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(tab.icon, tab.label, Modifier.size(20.dp), tint = if (selected) c.accent else c.ink3)
                        }
                    }
                    Spacer(Modifier.height(2.dp))
                    Text(tab.label, style = MaterialTheme.typography.labelSmall, color = if (selected) c.ink else c.ink3)
                }
            }
        }
    }
}
