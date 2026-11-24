package app.callshield.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiException(val status: Int, message: String) : Exception(message)

val json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
}

/** Thin client for the Call Shield backend. All calls run on the IO dispatcher. */
class Api(private val session: Session) {
    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val jsonType = "application/json".toMediaType()

    var onUnauthorized: (() -> Unit)? = null

    private fun base(): String = session.server ?: throw ApiException(0, "Connect to a server first")

    fun url(path: String): String = base() + path

    private suspend fun send(method: String, path: String, body: JsonElement? = null, server: String? = null, timeoutMs: Long? = null): String =
        withContext(Dispatchers.IO) {
            val target = (server ?: base()) + path
            if (target.toHttpUrlOrNull() == null) throw ApiException(0, "That server address is not valid")
            val builder = Request.Builder().url(target).header("Accept", "application/json")
            session.token?.let { builder.header("Authorization", "Bearer $it") }
            val requestBody = body?.toString()?.toRequestBody(jsonType)
            builder.method(method, if (method == "GET" || method == "DELETE") null else (requestBody ?: "{}".toRequestBody(jsonType)))
            val client = if (timeoutMs != null) {
                http.newBuilder().callTimeout(timeoutMs, TimeUnit.MILLISECONDS).build()
            } else {
                http
            }
            try {
                client.newCall(builder.build()).execute().use { response ->
                    val text = response.body.string()
                    if (!response.isSuccessful) {
                        if (response.code == 401 && session.token != null) onUnauthorized?.invoke()
                        throw ApiException(response.code, errorMessage(text, response.code))
                    }
                    text
                }
            } catch (e: IOException) {
                throw ApiException(0, "Cannot reach the server. Check that your phone and computer are on the same Wi-Fi.")
            }
        }

    private fun errorMessage(text: String, code: Int): String = runCatching {
        val detail = json.parseToJsonElement(text).jsonObject["detail"]
        when (detail) {
            is JsonPrimitive -> detail.contentOrNull
            else -> detail?.jsonArray?.firstOrNull()?.jsonObject?.get("msg")?.jsonPrimitive?.contentOrNull
        }
    }.getOrNull() ?: "Request failed ($code)"

    private inline fun <reified T> parse(text: String): T = json.decodeFromString(text)

    private fun body(vararg pairs: Pair<String, Any?>): JsonObject = buildJsonObject {
        pairs.forEach { (key, value) ->
            put(
                key,
                when (value) {
                    null -> JsonNull
                    is Boolean -> JsonPrimitive(value)
                    is Number -> JsonPrimitive(value)
                    else -> JsonPrimitive(value.toString())
                },
            )
        }
    }

    // ---------- Connection and account ----------

    suspend fun ping(server: String): Boolean = runCatching {
        send("GET", "/health", server = server.trimEnd('/'), timeoutMs = 4000).contains("\"status\"")
    }.getOrDefault(false)

    suspend fun appInfo(): AppInfo = parse(send("GET", "/api/app/info"))

    suspend fun login(email: String, password: String): SessionResponse =
        parse(send("POST", "/api/auth/login", body("email" to email, "password" to password)))

    suspend fun register(name: String, email: String, password: String): SessionResponse =
        parse(send("POST", "/api/auth/register", body("name" to name, "email" to email, "password" to password)))

    suspend fun me(): User = parse(send("GET", "/api/auth/me"))

    suspend fun updateMe(vararg fields: Pair<String, Any?>): User = parse(send("PATCH", "/api/me", body(*fields)))

    suspend fun setLocation(lat: Double, lng: Double): User =
        json.decodeFromJsonElement(User.serializer(), json.parseToJsonElement(send("PUT", "/api/me/location", body("lat" to lat, "lng" to lng))).jsonObject["user"]!!)

    suspend fun sync(): SyncData = parse(send("GET", "/api/me/sync"))

    // ---------- Calls, reports, numbers ----------

    suspend fun stats(): Stats = parse(send("GET", "/api/stats"))

    suspend fun calls(verdict: String? = null, limit: Int = 60): CallPage =
        parse(send("GET", "/api/calls?limit=$limit" + (verdict?.let { "&verdict=$it" } ?: "")))

    suspend fun liveCalls(): List<CallItem> = parse(send("GET", "/api/calls/live"))

    suspend fun call(id: Int): CallDetail = parse(send("GET", "/api/calls/$id"))

    suspend fun reportCall(id: Int): Report = parse(send("POST", "/api/calls/$id/report"))

    suspend fun blockLiveCall(id: Int) = send("POST", "/api/calls/$id/block")

    suspend fun reports(): List<Report> = parse(send("GET", "/api/reports?limit=200"))

    suspend fun report(id: Int): Report = parse(send("GET", "/api/reports/$id"))

    suspend fun resend(id: Int): Report = parse(send("POST", "/api/reports/$id/resend"))

    suspend fun lookup(number: String, timeoutMs: Long? = null): NumberLookup =
        parse(send("GET", "/api/numbers/lookup?number=" + java.net.URLEncoder.encode(number, "UTF-8"), timeoutMs = timeoutMs))

    suspend fun reportNumber(number: String, category: String, note: String?, sendToPolice: Boolean): ManualReportResult =
        parse(send("POST", "/api/numbers/report", body("number" to number, "category" to category, "note" to note, "send_to_police" to sendToPolice)))

    suspend fun setRule(number: String, kind: String) = send("PUT", "/api/numbers/rules", body("number" to number, "kind" to kind))

    suspend fun removeRule(number: String) = send("DELETE", "/api/numbers/rules/" + java.net.URLEncoder.encode(number, "UTF-8"))

    fun authedUrl(path: String): String {
        val token = session.token ?: return url(path)
        return url(path) + (if ("?" in path) "&" else "?") + "token=" + java.net.URLEncoder.encode(token, "UTF-8")
    }
}
