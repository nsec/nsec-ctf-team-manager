"""Listener setup tests."""

import socket
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.server import create_sockets


def test_creates_ipv4_and_ipv6_listeners_on_same_port():
    listeners = create_sockets(port=0)
    try:
        ipv4 = next(sock for sock in listeners if sock.family == socket.AF_INET)
        assert ipv4.getsockname()[0] == "0.0.0.0"
        port = ipv4.getsockname()[1]

        try:
            ipv6 = next(sock for sock in listeners if sock.family == socket.AF_INET6)
        except StopIteration:
            pytest.skip("IPv6 is unavailable on this host")

        assert ipv6.getsockname()[:2] == ("::", port)
        assert ipv6.getsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY) == 1
    finally:
        for listener in listeners:
            listener.close()