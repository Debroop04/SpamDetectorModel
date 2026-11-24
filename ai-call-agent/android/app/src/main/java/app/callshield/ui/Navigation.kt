package app.callshield.ui

import androidx.compose.runtime.Stable
import androidx.compose.runtime.mutableStateListOf

sealed interface Route {
    data object Connect : Route
    data object Login : Route
    data object Register : Route
    data object Setup : Route
    data object Home : Route
    data object Calls : Route
    data class NewReport(val number: String? = null) : Route
    data object Reports : Route
    data object Settings : Route
    data class CallDetail(val id: Int) : Route
    data class ReportDetail(val id: Int) : Route
    data object Lookup : Route

    val isTab: Boolean get() = this is Home || this is Calls || this is NewReport || this is Reports || this is Settings
}

/** A tiny back stack. Enough for this app, and no navigation library to load. */
@Stable
class Navigator(start: Route) {
    val stack = mutableStateListOf(start)
    val current: Route get() = stack.last()

    fun push(route: Route) {
        if (current != route) stack.add(route)
    }

    fun pop(): Boolean {
        if (stack.size <= 1) return false
        stack.removeAt(stack.lastIndex)
        return true
    }

    fun reset(route: Route) {
        stack.clear()
        stack.add(route)
    }

    fun tab(route: Route) {
        if (route == Route.Home) reset(Route.Home) else {
            stack.clear()
            stack.add(Route.Home)
            stack.add(route)
        }
    }
}
