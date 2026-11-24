package app.callshield.screening

import android.content.Context
import app.callshield.data.SyncData
import app.callshield.data.json
import kotlinx.serialization.Serializable
import java.io.File

@Serializable
private data class CacheFile(
    val lineNumber: String? = null,
    val blocked: List<String> = emptyList(),
    val trusted: List<String> = emptyList(),
    val dangerous: Map<String, CachedDanger> = emptyMap(),
    val syncedAt: Long = 0,
)

@Serializable
private data class CachedDanger(val reports: Int, val category: String)

/** The lists the phone needs to decide calls offline. Kept in memory and in one small JSON file. */
class ScreeningCache(context: Context) {
    private val file = File(context.filesDir, "screening.json")

    @Volatile
    private var data: CacheFile = load()

    val lineNumber: String? get() = data.lineNumber
    val blocked: Set<String> get() = data.blocked.toSet()
    val trusted: Set<String> get() = data.trusted.toSet()
    val dangerous: Map<String, Danger> get() = data.dangerous.mapValues { Danger(it.value.reports, it.value.category) }
    val syncedAt: Long get() = data.syncedAt

    private fun load(): CacheFile = runCatching { json.decodeFromString<CacheFile>(file.readText()) }.getOrDefault(CacheFile())

    fun update(sync: SyncData) {
        val next = CacheFile(
            lineNumber = sync.forward_to ?: sync.line_number,
            blocked = sync.blocked,
            trusted = sync.trusted,
            dangerous = sync.dangerous.associate { it.number to CachedDanger(it.reports, it.category) },
            syncedAt = System.currentTimeMillis(),
        )
        data = next
        runCatching {
            val tmp = File(file.parentFile, "screening.json.tmp")
            tmp.writeText(json.encodeToString(CacheFile.serializer(), next))
            tmp.renameTo(file)
        }
    }

    /** Apply a local change right away (for example after tapping Block) without waiting for the next sync. */
    fun addRule(number: String, kind: String) {
        val current = data
        data = when (kind) {
            "block" -> current.copy(blocked = (current.blocked + number).distinct(), trusted = current.trusted - number)
            "allow" -> current.copy(trusted = (current.trusted + number).distinct(), blocked = current.blocked - number)
            else -> current.copy(blocked = current.blocked - number, trusted = current.trusted - number)
        }
    }

    fun clear() {
        data = CacheFile()
        file.delete()
    }
}
