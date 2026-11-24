package app.callshield.data

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.withTimeoutOrNull
import java.net.Inet4Address

/** Finds the backend on the same Wi-Fi. The backend announces "_callshield._tcp" (see backend/app/services/discovery.py). */
object Discovery {
    private const val SERVICE_TYPE = "_callshield._tcp."

    suspend fun find(context: Context, timeoutMs: Long = 7000): String? =
        withTimeoutOrNull(timeoutMs) { servers(context).firstOrNull() }

    @Suppress("DEPRECATION")
    private fun servers(context: Context): Flow<String> = callbackFlow {
        val nsd = context.getSystemService(Context.NSD_SERVICE) as NsdManager
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        val lock = wifi.createMulticastLock("callshield-discovery").apply {
            setReferenceCounted(false)
            acquire()
        }

        val listener = object : NsdManager.DiscoveryListener {
            override fun onServiceFound(service: NsdServiceInfo) {
                if (!service.serviceType.startsWith(SERVICE_TYPE.trimEnd('.'))) return
                nsd.resolveService(service, object : NsdManager.ResolveListener {
                    override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) = Unit
                    override fun onServiceResolved(info: NsdServiceInfo) {
                        val host = info.host
                        if (host is Inet4Address) trySend("http://${host.hostAddress}:${info.port}")
                    }
                })
            }

            override fun onDiscoveryStarted(serviceType: String) = Unit
            override fun onServiceLost(service: NsdServiceInfo) = Unit
            override fun onDiscoveryStopped(serviceType: String) = Unit
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                close()
            }

            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) = Unit
        }

        runCatching { nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener) }
            .onFailure { close(it) }

        awaitClose {
            runCatching { nsd.stopServiceDiscovery(listener) }
            runCatching { lock.release() }
        }
    }
}
