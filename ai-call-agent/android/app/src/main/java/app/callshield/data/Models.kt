package app.callshield.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class Station(
    val id: Int,
    val name: String,
    val lat: Double,
    val lng: Double,
    val address: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val distance_km: Double? = null,
)

@Serializable
data class User(
    val id: Int,
    val name: String,
    val email: String,
    val role: String = "user",
    val phone: String? = null,
    val line_number: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val address: String? = null,
    val language: String = "ask",
    val block_threshold: Double = 0.75,
    val auto_report: Boolean = true,
    val police_delivery: String = "test",
    val station: Station? = null,
)

@Serializable
data class SessionResponse(val token: String, val user: User)

@Serializable
data class CallItem(
    val id: Int,
    val channel: String = "phone",
    val caller_number: String,
    val caller_name: String? = null,
    val status: String,
    val language: String = "en",
    val verdict: String,
    val risk_score: Double = 0.0,
    val category: String? = null,
    val reasons: List<String> = emptyList(),
    val turns_count: Int = 0,
    val started_at: String,
    val ended_at: String? = null,
    val duration: Int? = null,
    val has_recording: Boolean = false,
)

@Serializable
data class CallPage(val items: List<CallItem>, val total: Int)

@Serializable
data class Turn(
    val speaker: String,
    val text: String,
    val text_en: String? = null,
    val created_at: String,
)

@Serializable
data class ReportBrief(
    val id: Int,
    val reference: String,
    val status: String,
    val mode: String,
    val station_name: String? = null,
)

@Serializable
data class CallDetail(
    val id: Int,
    val channel: String = "phone",
    val caller_number: String,
    val caller_name: String? = null,
    val status: String,
    val language: String = "en",
    val verdict: String,
    val risk_score: Double = 0.0,
    val category: String? = null,
    val reasons: List<String> = emptyList(),
    val started_at: String,
    val duration: Int? = null,
    val signals: JsonObject = JsonObject(emptyMap()),
    val turns: List<Turn> = emptyList(),
    val report: ReportBrief? = null,
    val rule: String? = null,
    val number_reports: Int = 0,
)

@Serializable
data class Report(
    val id: Int,
    val reference: String,
    val source: String = "auto",
    val call_id: Int? = null,
    val caller_number: String,
    val category: String,
    val summary: String,
    val risk_score: Double? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val address: String? = null,
    val station_name: String? = null,
    val station_lat: Double? = null,
    val station_lng: Double? = null,
    val station_phone: String? = null,
    val station_email: String? = null,
    val station_address: String? = null,
    val distance_km: Double? = null,
    val status: String,
    val mode: String,
    val sent_to: String? = null,
    val sent_at: String? = null,
    val error: String? = null,
    val acknowledged_at: String? = null,
    val ack_by: String? = null,
    val ack_note: String? = null,
    val created_at: String,
    val public_url: String? = null,
)

@Serializable
data class DayCount(val date: String, val total: Int, val spam: Int)

@Serializable
data class Stats(
    val screened: Int = 0,
    val blocked: Int = 0,
    val connected: Int = 0,
    val suspicious: Int = 0,
    val reports_sent: Int = 0,
    val reports_acknowledged: Int = 0,
    val last_7_days: List<DayCount> = emptyList(),
)

@Serializable
data class NumberLookup(
    val number: String,
    val reports: Int,
    val category: String? = null,
    val risk: Double,
    val level: String,
    val rule: String? = null,
)

@Serializable
data class DangerousNumber(val number: String, val reports: Int, val category: String)

@Serializable
data class SyncData(
    val user: User,
    val line_number: String? = null,
    val forward_to: String? = null,
    val blocked: List<String> = emptyList(),
    val trusted: List<String> = emptyList(),
    val dangerous: List<DangerousNumber> = emptyList(),
)

@Serializable
data class ManualReportResult(
    val number: String,
    val counted: Boolean,
    val report: Report? = null,
    val duplicate_report: Boolean = false,
)

@Serializable
data class ApkInfo(val versionName: String, val versionCode: Int, val url: String)

@Serializable
data class AppInfo(
    val lan_servers: List<String> = emptyList(),
    val public_server: String? = null,
    val latest: ApkInfo? = null,
)

@Serializable
data class LiveTurn(val call_id: Int, val speaker: String, val text: String, val text_en: String? = null, val created_at: String)
