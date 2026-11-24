package app.callshield.screening

import android.content.Context
import app.callshield.data.json
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.Serializable
import java.io.File

@Serializable
data class LoggedCall(
    val number: String,
    val at: Long,
    val rejected: Boolean,
    val reason: String,
    val category: String? = null,
    val reports: Int = 0,
)

/** The last 100 calls this phone screened, shown on Home. */
class DecisionLog(context: Context) {
    private val file = File(context.filesDir, "decisions.json")
    private val state = MutableStateFlow(load())
    val entries: StateFlow<List<LoggedCall>> = state

    private fun load(): List<LoggedCall> = runCatching { json.decodeFromString<List<LoggedCall>>(file.readText()) }.getOrDefault(emptyList())

    @Synchronized
    fun add(entry: LoggedCall) {
        val next = (listOf(entry) + state.value).take(100)
        state.value = next
        runCatching { file.writeText(json.encodeToString(kotlinx.serialization.builtins.ListSerializer(LoggedCall.serializer()), next)) }
    }

    fun clear() {
        state.value = emptyList()
        file.delete()
    }
}
