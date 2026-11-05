"""Start Uvicorn"""

import logging
import socket

import uvicorn

logger = logging.getLogger(__name__)
PORT = 8000


def create_sockets(port: int = PORT) -> list[socket.socket]:
    """Bind IPv4 and IPv6 wildcard listeners on the same port."""
    ipv4_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        ipv4_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        ipv4_socket.bind(("0.0.0.0", port))
        ipv4_socket.listen(socket.SOMAXCONN)
    except OSError:
        ipv4_socket.close()
        raise

    sockets = [ipv4_socket]
    bound_port = ipv4_socket.getsockname()[1]

    try:
        ipv6_socket = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        ipv6_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        ipv6_socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
        ipv6_socket.bind(("::", bound_port))
        ipv6_socket.listen(socket.SOMAXCONN)
    except OSError as exc:
        if "ipv6_socket" in locals():
            ipv6_socket.close()
        logger.warning("IPv6 listener unavailable; serving IPv4 only: %s", exc)
    else:
        sockets.append(ipv6_socket)

    return sockets


def main() -> None:
    """Run the application with both listeners when IPv6 is available."""
    sockets = create_sockets()
    config = uvicorn.Config("app.main:app", host="0.0.0.0", port=PORT)
    try:
        uvicorn.Server(config).run(sockets=sockets)
    finally:
        for listener in sockets:
            listener.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
