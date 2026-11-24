"""Lets the Android app find this backend on the same Wi-Fi (mDNS service "_callshield._tcp")."""

import logging
import socket

from app.config import settings

logger = logging.getLogger("callshield.discovery")

SERVICE_TYPE = "_callshield._tcp.local."
_state: dict = {"zeroconf": None, "info": None}


def lan_addresses() -> list[str]:
    """Private IPv4 addresses of this machine, the default-route one first."""
    found: list[str] = []
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        found.append(probe.getsockname()[0])
        probe.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            found.append(info[4][0])
    except OSError:
        pass
    private = [ip for ip in dict.fromkeys(found) if ip.startswith(("10.", "192.168.", "172.")) and not ip.startswith("127.")]
    return private


async def start() -> None:
    if not settings.DISCOVERY_ENABLED:
        return
    addresses = lan_addresses()
    if not addresses:
        return
    try:
        from zeroconf import ServiceInfo
        from zeroconf.asyncio import AsyncZeroconf

        host = socket.gethostname().split(".")[0] or "server"
        info = ServiceInfo(
            SERVICE_TYPE,
            f"Call Shield on {host}.{SERVICE_TYPE}",
            addresses=[socket.inet_aton(ip) for ip in addresses],
            port=settings.APP_PORT,
            properties={"path": "/api", "app": "callshield"},
            server=f"{host}-callshield.local.",
        )
        zc = AsyncZeroconf()
        await zc.async_register_service(info)
        _state.update(zeroconf=zc, info=info)
        logger.info("Announced on the local network at %s:%s", addresses[0], settings.APP_PORT)
    except Exception as exc:  # discovery is a convenience; never block startup
        logger.warning("Local network announcement unavailable: %s", exc)


async def stop() -> None:
    zc, info = _state["zeroconf"], _state["info"]
    if zc is None:
        return
    try:
        await zc.async_unregister_service(info)
        await zc.async_close()
    except Exception:
        pass
    _state.update(zeroconf=None, info=None)
