#!/usr/bin/env python3
"""Local WebSocket bridge for RIGOL MHO/DHO5000 oscilloscope screenshots."""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import ipaddress
import json
import logging
import os
import socket
import ssl
import struct
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import ParseResult, parse_qs, urlsplit


WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
DEFAULT_SCOPE_IP = "192.168.110.10"
DEFAULT_SCOPE_PORT = 5025
DEFAULT_GENERATOR_PORT = 5555
DEFAULT_VIDEO_PORT = 9001
DEFAULT_BRIDGE_PORT = 8765
DEFAULT_INTERVAL_MS = 1000


def recv_exact(stream: object, length: int) -> bytes:
    data = bytearray()
    while len(data) < length:
        chunk = stream.recv(length - len(data))
        if not chunk:
            raise ConnectionError("SCPI connection closed before the response completed")
        data.extend(chunk)
    return bytes(data)


def read_exact(stream: object, length: int) -> bytes:
    data = bytearray()
    while len(data) < length:
        chunk = stream.read(length - len(data))
        if not chunk:
            raise ConnectionError("WebSocket connection closed")
        data.extend(chunk)
    return bytes(data)


def read_tmc_block(stream: object, max_bytes: int = 32 * 1024 * 1024) -> bytes:
    header = bytearray()
    while True:
        byte = recv_exact(stream, 1)
        header.extend(byte)
        if byte == b"#":
            break
        if len(header) > 256:
            raise ValueError("SCPI binary response did not start with a TMC block")

    count_digit = recv_exact(stream, 1)
    if not count_digit.isdigit():
        raise ValueError("Invalid TMC length digit")
    count_digits = int(count_digit)
    if count_digits < 1 or count_digits > 9:
        raise ValueError("Invalid TMC length width")

    length_text = recv_exact(stream, count_digits)
    if not length_text.isdigit():
        raise ValueError("Invalid TMC payload length")
    payload_length = int(length_text)
    if payload_length < 1 or payload_length > max_bytes:
        raise ValueError(f"Invalid TMC payload size: {payload_length}")

    return recv_exact(stream, payload_length)


class RigolScope:
    def __init__(self, ip: str, port: int, timeout_s: float = 4.0) -> None:
        self.ip = ip
        self.port = port
        self.timeout_s = timeout_s

    def capture_image(self) -> bytes:
        with socket.create_connection((self.ip, self.port), timeout=self.timeout_s) as connection:
            connection.settimeout(self.timeout_s)
            connection.sendall(b":DISPlay:DATA? JPG\n")
            image = read_tmc_block(connection)
        if not image.startswith(b"\xff\xd8\xff"):
            raise ValueError("The oscilloscope response is not a JPEG screenshot")
        return image


class RigolGenerator:
    """Small SCPI client for RIGOL DG4000-series signal generators."""

    WAVEFORMS = {
        "triangle": ("RAMP", "TRIangle"),
        "sine": ("SINusoid", "SINusoid"),
        "square": ("SQUare", "SQUare"),
        "pulse": ("PULSe", "PULSe"),
    }

    def __init__(self, ip: str, port: int = DEFAULT_GENERATOR_PORT, timeout_s: float = 5.0) -> None:
        self.connection = socket.create_connection((ip, port), timeout=timeout_s)
        self.connection.settimeout(timeout_s)

    def query(self, command: str) -> str:
        self.connection.sendall(f"{command}\n".encode("ascii"))
        # DG4102 firmware may emit an empty line before LOAD query responses.
        for _ in range(4):
            response = bytearray()
            while True:
                chunk = self.connection.recv(1)
                if not chunk:
                    raise ConnectionError("DG4102 closed the SCPI connection")
                if chunk == b"\n":
                    break
                response.extend(chunk)
                if len(response) > 65536:
                    raise ValueError("DG4102 SCPI response is too large")
            text = response.decode("ascii", errors="replace").strip()
            if text:
                return text
        raise ValueError("DG4102 returned an empty SCPI response")

    def apply(
        self,
        channel: int,
        waveform: str,
        amplitude_vpp: float,
        frequency_hz: float,
        load: str,
        output_enabled: bool,
    ) -> dict:
        if channel not in (1, 2):
            raise ValueError("Generator channel must be 1 or 2")
        if waveform not in self.WAVEFORMS:
            raise ValueError(f"Unsupported waveform: {waveform}")
        if not 0.001 <= amplitude_vpp <= 20:
            raise ValueError("Amplitude must be between 0.001 and 20 Vpp")
        if not 0.001 <= frequency_hz <= 50_000_000:
            raise ValueError("Frequency must be between 0.001 Hz and 50 MHz")
        if load not in ("INF", "50"):
            raise ValueError("Load must be INF or 50")

        commands = [
            f":OUTPut{channel}:LOAD {'INFinity' if load == 'INF' else '50'}",
            f":SOURce{channel}:FUNCtion:{self.WAVEFORMS[waveform][0]}",
            f":SOURce{channel}:VOLTage:UNIT VPP",
            f":SOURce{channel}:VOLTage {amplitude_vpp:.9g}",
            f":SOURce{channel}:VOLTage:OFFSet 0",
            f":SOURce{channel}:FREQuency {frequency_hz:.9g}",
        ]
        if waveform == "triangle":
            commands.append(f":SOURce{channel}:FUNCtion:RAMP:SYMMetry 50")
        elif waveform == "square":
            commands.append(f":SOURce{channel}:FUNCtion:SQUare:DCYCle 50")
        elif waveform == "pulse":
            commands.append(f":SOURce{channel}:PULSe:DCYCle 50")
        commands.append(f":OUTPut{channel}:STATe {'ON' if output_enabled else 'OFF'}")

        for command in commands:
            self.connection.sendall(f"{command}\n".encode("ascii"))
        if self.query("*OPC?") != "1":
            raise RuntimeError("DG4102 did not report operation complete")

        settings = {
            "identity": self.query("*IDN?"),
            "waveform": self.query(f":SOURce{channel}:FUNCtion:SHApe?"),
            "amplitudeVpp": float(self.query(f":SOURce{channel}:VOLTage?")),
            "frequencyHz": float(self.query(f":SOURce{channel}:FREQuency?")),
            "output": self.query(f":OUTPut{channel}:STATe?"),
            "load": self.query(f":OUTPut{channel}:LOAD?"),
        }
        expected_waveform = {"triangle": "RAMP", "sine": "SIN", "square": "SQU", "pulse": "PULS"}[waveform]
        if not str(settings["waveform"]).upper().startswith(expected_waveform):
            raise RuntimeError(f"Waveform readback mismatch: {settings['waveform']}")
        if abs(settings["amplitudeVpp"] - amplitude_vpp) > max(0.001, amplitude_vpp * 0.001):
            raise RuntimeError(f"Amplitude readback mismatch: {settings['amplitudeVpp']} Vpp")
        if abs(settings["frequencyHz"] - frequency_hz) > max(0.001, frequency_hz * 0.001):
            raise RuntimeError(f"Frequency readback mismatch: {settings['frequencyHz']} Hz")
        if settings["output"] != ("ON" if output_enabled else "OFF"):
            raise RuntimeError(f"Output-state readback mismatch: {settings['output']}")
        return settings

    def read(self, channel: int) -> dict:
        if channel not in (1, 2):
            raise ValueError("Generator channel must be 1 or 2")
        return {
            "identity": self.query("*IDN?"),
            "waveform": self.query(f":SOURce{channel}:FUNCtion:SHApe?"),
            "amplitudeVpp": float(self.query(f":SOURce{channel}:VOLTage?")),
            "frequencyHz": float(self.query(f":SOURce{channel}:FREQuency?")),
            "output": self.query(f":OUTPut{channel}:STATe?"),
            "load": self.query(f":OUTPut{channel}:LOAD?"),
        }

    def set_output(self, channel: int, enabled: bool) -> str:
        if channel not in (1, 2):
            raise ValueError("Generator channel must be 1 or 2")
        self.connection.sendall(
            f":OUTPut{channel}:STATe {'ON' if enabled else 'OFF'}\n".encode("ascii")
        )
        if self.query("*OPC?") != "1":
            raise RuntimeError("DG4102 did not report operation complete")
        return self.query(f":OUTPut{channel}:STATe?")

    def close(self) -> None:
        try:
            self.connection.close()
        except OSError:
            pass


class WebSocketClient:
    def __init__(self, connection: socket.socket, rfile: object, wfile: object) -> None:
        self.connection = connection
        self.rfile = rfile
        self.wfile = wfile
        self.send_lock = threading.Lock()
        self.closed = False

    def send_frame(self, opcode: int, payload: bytes = b"") -> None:
        with self.send_lock:
            if self.closed:
                return
            first = 0x80 | opcode
            length = len(payload)
            if length < 126:
                header = bytes((first, length))
            elif length <= 0xFFFF:
                header = bytes((first, 126)) + struct.pack("!H", length)
            else:
                header = bytes((first, 127)) + struct.pack("!Q", length)
            self.wfile.write(header + payload)
            self.wfile.flush()

    def send_json(self, value: dict) -> None:
        self.send_frame(1, json.dumps(value, separators=(",", ":")).encode("utf-8"))

    def read_frame(self) -> tuple[int, bytes]:
        first, second = read_exact(self.rfile, 2)
        opcode = first & 0x0F
        masked = (second & 0x80) != 0
        length = second & 0x7F
        if length == 126:
            length = struct.unpack("!H", read_exact(self.rfile, 2))[0]
        elif length == 127:
            length = struct.unpack("!Q", read_exact(self.rfile, 8))[0]
        if length > 2 * 1024 * 1024:
            raise ValueError("WebSocket message is too large")
        mask = read_exact(self.rfile, 4) if masked else b""
        payload = bytearray(read_exact(self.rfile, length))
        if masked:
            for index in range(length):
                payload[index] ^= mask[index % 4]
        return opcode, bytes(payload)

    def close(self) -> None:
        with self.send_lock:
            if self.closed:
                return
            self.closed = True
            try:
                self.wfile.write(b"\x88\x02" + struct.pack("!H", 1000))
                self.wfile.flush()
            except OSError:
                pass
            try:
                self.connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            try:
                self.connection.close()
            except OSError:
                pass


class UpstreamWebSocket:
    """Minimal WebSocket client for RIGOL's local H.264 screen stream."""

    def __init__(self, ip: str, port: int, timeout_s: float = 8.0) -> None:
        self.connection = socket.create_connection((ip, port), timeout=timeout_s)
        self.connection.settimeout(timeout_s)
        self.stream = self.connection.makefile("rb")
        key = base64.b64encode(bytes(range(16))).decode("ascii")
        request = (
            f"GET / HTTP/1.1\r\n"
            f"Host: {ip}:{port}\r\n"
            f"Origin: http://{ip}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.connection.sendall(request.encode("ascii"))
        response = bytearray()
        while b"\r\n\r\n" not in response:
            chunk = self.stream.read(1)
            if not chunk:
                raise ConnectionError("RIGOL video WebSocket closed during handshake")
            response.extend(chunk)
            if len(response) > 16384:
                raise ValueError("RIGOL video WebSocket handshake is too large")
        status_line = bytes(response).split(b"\r\n", 1)[0]
        if b" 101 " not in status_line:
            raise ConnectionError(f"RIGOL video WebSocket rejected: {status_line.decode('latin-1')}")

    def send_text(self, text: str) -> None:
        payload = text.encode("utf-8")
        mask = os.urandom(4)
        masked = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))
        length = len(payload)
        if length < 126:
            header = bytes((0x81, 0x80 | length))
        elif length <= 0xFFFF:
            header = bytes((0x81, 0x80 | 126)) + struct.pack("!H", length)
        else:
            header = bytes((0x81, 0x80 | 127)) + struct.pack("!Q", length)
        self.connection.sendall(header + mask + masked)

    def read_frame(self) -> tuple[int, bytes]:
        first, second = read_exact(self.stream, 2)
        final = (first & 0x80) != 0
        opcode = first & 0x0F
        masked = (second & 0x80) != 0
        length = second & 0x7F
        if length == 126:
            length = struct.unpack("!H", read_exact(self.stream, 2))[0]
        elif length == 127:
            length = struct.unpack("!Q", read_exact(self.stream, 8))[0]
        if length > 8 * 1024 * 1024:
            raise ValueError("RIGOL video frame is too large")
        mask = read_exact(self.stream, 4) if masked else b""
        payload = bytearray(read_exact(self.stream, length))
        if masked:
            for index in range(length):
                payload[index] ^= mask[index % 4]
        while not final and opcode != 8:
            first, second = read_exact(self.stream, 2)
            final = (first & 0x80) != 0
            masked = (second & 0x80) != 0
            part_length = second & 0x7F
            if part_length == 126:
                part_length = struct.unpack("!H", read_exact(self.stream, 2))[0]
            elif part_length == 127:
                part_length = struct.unpack("!Q", read_exact(self.stream, 8))[0]
            part_mask = read_exact(self.stream, 4) if masked else b""
            part = bytearray(read_exact(self.stream, part_length))
            if masked:
                for index in range(part_length):
                    part[index] ^= part_mask[index % 4]
            payload.extend(part)
        return opcode, bytes(payload)

    def close(self) -> None:
        try:
            self.stream.close()
        except OSError:
            pass
        try:
            self.connection.close()
        except OSError:
            pass


class BridgeState:
    def __init__(
        self,
        scope_ip: str,
        scope_port: int,
        interval_ms: int,
        allowed_origins: list[str],
        access_key: str,
    ) -> None:
        self.lock = threading.RLock()
        self.clients: set[WebSocketClient] = set()
        self.scope_ip = scope_ip
        self.scope_port = scope_port
        self.interval_ms = interval_ms
        self.allowed_origins = set(allowed_origins)
        self.access_key = access_key
        self.wake = threading.Event()
        self.stopping = threading.Event()
        self.last_error = ""
        self.last_capture = 0

    def origin_allowed(self, origin: str) -> bool:
        if origin in self.allowed_origins:
            return True
        parsed = urlsplit(origin)
        return (
            parsed.scheme in ("http", "https")
            and parsed.hostname in ("localhost", "127.0.0.1", "::1")
        )

    def request_authorized(self, parsed: ParseResult) -> bool:
        if not self.access_key:
            return True
        values = parse_qs(parsed.query).get("key", [])
        supplied = values[-1] if values else ""
        return hmac.compare_digest(supplied, self.access_key)

    def add_client(self, client: WebSocketClient) -> None:
        with self.lock:
            self.clients.add(client)
        self.wake.set()

    def remove_client(self, client: WebSocketClient) -> None:
        with self.lock:
            self.clients.discard(client)

    def configure(self, command: dict) -> None:
        with self.lock:
            scope_ip = str(command.get("ip", self.scope_ip)).strip()
            ipaddress.ip_address(scope_ip)
            scope_port = int(command.get("port", self.scope_port))
            interval_ms = int(command.get("intervalMs", self.interval_ms))
            if not 1 <= scope_port <= 65535:
                raise ValueError("Scope port must be between 1 and 65535")
            if not 250 <= interval_ms <= 10000:
                raise ValueError("Refresh interval must be between 250 and 10000 ms")
            self.scope_ip = scope_ip
            self.scope_port = scope_port
            self.interval_ms = interval_ms
            self.last_error = ""
        self.wake.set()

    def broadcast(self, message: dict) -> None:
        with self.lock:
            clients = list(self.clients)
        for client in clients:
            try:
                client.send_json(message)
            except (ConnectionError, OSError, ValueError):
                client.close()
                self.remove_client(client)

    def status(self, state: str, message: str) -> None:
        with self.lock:
            scope_ip = self.scope_ip
            interval_ms = self.interval_ms
        self.broadcast({
            "type": "status",
            "state": state,
            "message": message,
            "ip": scope_ip,
            "intervalMs": interval_ms,
            "timestamp": time.time(),
        })

    def run(self) -> None:
        while not self.stopping.is_set():
            with self.lock:
                has_clients = bool(self.clients)
                scope_ip = self.scope_ip
                scope_port = self.scope_port
                interval_ms = self.interval_ms

            if not has_clients:
                self.wake.wait(0.5)
                self.wake.clear()
                continue

            try:
                image = RigolScope(scope_ip, scope_port).capture_image()
                self.last_capture = time.time()
                self.last_error = ""
                self.broadcast({
                    "type": "screenshot",
                    "mimeType": "image/jpeg",
                    "data": base64.b64encode(image).decode("ascii"),
                    "capturedAt": self.last_capture,
                    "ip": scope_ip,
                    "model": "RIGOL MHO 5054",
                })
            except Exception as error:  # Keep the bridge alive and report the scope state.
                message = str(error) or error.__class__.__name__
                if message != self.last_error:
                    logging.warning("Scope capture failed: %s", message)
                    self.last_error = message
                self.status("error", message)

            self.wake.wait(interval_ms / 1000)
            self.wake.clear()


class ScopeBridgeHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    bridge: BridgeState

    def log_message(self, _format: str, *_args: object) -> None:
        return

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlsplit(self.path)
        path = parsed.path
        if path == "/health":
            if not self.bridge.request_authorized(parsed):
                self.send_error(401, "Missing or invalid access key")
                return
            payload = json.dumps({
                "status": "ok",
                "scopeIp": self.bridge.scope_ip,
                "clients": len(self.bridge.clients),
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if path not in ("/scope", "/video", "/generator") or self.headers.get("Upgrade", "").lower() != "websocket":
            payload = (
                b"RIGOL scope bridge is running. Use ws://127.0.0.1:8765/video "
                b"for H.264 video, /scope for screenshots, or /generator for DG4102 control."
            )
            self.send_response(426 if path in ("/scope", "/video", "/generator") else 200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        origin = self.headers.get("Origin", "")
        if not self.bridge.origin_allowed(origin):
            self.send_error(403, "Origin is not allowed")
            return
        if not self.bridge.request_authorized(parsed):
            self.send_error(401, "Missing or invalid access key")
            return

        key = self.headers.get("Sec-WebSocket-Key", "")
        if not key:
            self.send_error(400, "Missing Sec-WebSocket-Key")
            return
        accept = base64.b64encode(
            hashlib.sha1(f"{key}{WS_GUID}".encode("ascii")).digest()
        ).decode("ascii")
        self.send_response(101, "Switching Protocols")
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        client = WebSocketClient(self.connection, self.rfile, self.wfile)
        if path == "/generator":
            self.handle_generator(client)
            return
        if path == "/video":
            self.relay_video_stream(client, parsed)
            return

        self.bridge.add_client(client)
        with self.bridge.lock:
            client.send_json({
                "type": "status",
                "state": "bridge",
                "message": "本地示波器桥已连接",
                "ip": self.bridge.scope_ip,
                "intervalMs": self.bridge.interval_ms,
                "timestamp": time.time(),
            })

        try:
            while not self.bridge.stopping.is_set():
                opcode, payload = client.read_frame()
                if opcode == 8:
                    break
                if opcode == 9:
                    client.send_frame(10, payload)
                    continue
                if opcode != 1:
                    continue
                try:
                    command = json.loads(payload.decode("utf-8"))
                    if command.get("type") == "configure":
                        self.bridge.configure(command)
                        self.bridge.status("configured", "示波器连接参数已更新")
                    elif command.get("type") == "capture":
                        self.bridge.wake.set()
                except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
                    client.send_json({"type": "status", "state": "error", "message": str(error)})
        except (ConnectionError, OSError, EOFError, ValueError):
            pass
        finally:
            self.close_connection = True
            self.bridge.remove_client(client)
            client.close()

    def handle_generator(self, client: WebSocketClient) -> None:
        try:
            while not self.bridge.stopping.is_set():
                opcode, payload = client.read_frame()
                if opcode == 8:
                    break
                if opcode == 9:
                    client.send_frame(10, payload)
                    continue
                if opcode != 1:
                    continue
                try:
                    command = json.loads(payload.decode("utf-8"))
                    ip = str(command.get("ip", "")).strip()
                    ipaddress.ip_address(ip)
                    port = int(command.get("port", DEFAULT_GENERATOR_PORT))
                    channel = int(command.get("channel", 1))
                    generator = RigolGenerator(ip, port)
                    try:
                        action = command.get("type")
                        if action == "apply":
                            settings = generator.apply(
                                channel=channel,
                                waveform=str(command.get("waveform", "triangle")),
                                amplitude_vpp=float(command.get("amplitudeVpp", 1)),
                                frequency_hz=float(command.get("frequencyHz", 1000)),
                                load=str(command.get("load", "INF")),
                                output_enabled=bool(command.get("output", True)),
                            )
                        elif action == "read":
                            settings = generator.read(channel)
                        elif action == "output":
                            enabled = bool(command.get("enabled", False))
                            state = generator.set_output(channel, enabled)
                            settings = {"output": state}
                        else:
                            raise ValueError(f"Unsupported generator action: {action}")
                        client.send_json({
                            "type": "generator",
                            "state": "ok",
                            "action": action,
                            "channel": channel,
                            "ip": ip,
                            "settings": settings,
                        })
                        logging.info("DG4102 %s succeeded at %s channel %d", action, ip, channel)
                    finally:
                        generator.close()
                except (UnicodeDecodeError, json.JSONDecodeError, OSError, RuntimeError, ValueError) as error:
                    client.send_json({
                        "type": "generator",
                        "state": "error",
                        "message": str(error),
                    })
        except (ConnectionError, OSError, EOFError, ValueError):
            pass
        finally:
            self.close_connection = True
            client.close()

    def relay_video_stream(self, client: WebSocketClient, parsed: ParseResult) -> None:
        query = {key: values[-1] for key, values in parse_qs(parsed.query).items()}
        scope_ip = str(query.get("ip", self.bridge.scope_ip)).strip()
        try:
            ipaddress.ip_address(scope_ip)
            upstream = UpstreamWebSocket(scope_ip, DEFAULT_VIDEO_PORT)
            upstream.send_text(json.dumps({"type": "SET_ENCODER", "size": None, "rate": None}))
        except Exception as error:
            client.send_json({
                "type": "status",
                "state": "error",
                "message": f"无法连接 RIGOL 实时视频流：{error}",
            })
            self.close_connection = True
            client.close()
            return

        logging.info("Proxying RIGOL H.264 video from %s:%d", scope_ip, DEFAULT_VIDEO_PORT)
        try:
            while not self.bridge.stopping.is_set():
                opcode, payload = upstream.read_frame()
                if opcode in (1, 2):
                    client.send_frame(opcode, payload)
                elif opcode == 8:
                    break
                elif opcode == 9:
                    client.send_frame(10, payload)
        except (ConnectionError, OSError, EOFError, ValueError) as error:
            try:
                client.send_json({
                    "type": "status",
                    "state": "error",
                    "message": f"RIGOL 实时视频流中断：{error}",
                })
            except (ConnectionError, OSError):
                pass
        finally:
            self.close_connection = True
            upstream.close()
            client.close()


class BridgeHttpServer(ThreadingHTTPServer):
    allow_reuse_address = False
    daemon_threads = True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="127.0.0.1", help="Bridge bind address")
    parser.add_argument("--port", type=int, default=DEFAULT_BRIDGE_PORT, help="Bridge WebSocket port")
    parser.add_argument("--scope-ip", default=DEFAULT_SCOPE_IP, help="RIGOL oscilloscope IP")
    parser.add_argument("--scope-port", type=int, default=DEFAULT_SCOPE_PORT, help="RIGOL raw SCPI port")
    parser.add_argument("--interval-ms", type=int, default=DEFAULT_INTERVAL_MS, help="Screenshot interval")
    parser.add_argument(
        "--allowed-origin",
        action="append",
        dest="allowed_origins",
        default=None,
        help="Allowed browser origin; repeat for multiple origins",
    )
    parser.add_argument(
        "--access-key",
        default=os.environ.get("SIVY_BRIDGE_KEY", ""),
        help="Optional access key; can also be set with SIVY_BRIDGE_KEY",
    )
    parser.add_argument("--tls-cert", default="", help="PEM certificate for direct WSS")
    parser.add_argument("--tls-key", default="", help="PEM private key for direct WSS")
    parser.add_argument(
        "--allow-insecure-remote",
        action="store_true",
        help="Allow a non-loopback plain-WS bind; not recommended",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        ipaddress.ip_address(args.scope_ip)
    except ValueError:
        raise SystemExit(f"Invalid scope IP: {args.scope_ip}")
    if not 250 <= args.interval_ms <= 10000:
        raise SystemExit("--interval-ms must be between 250 and 10000")
    try:
        loopback_bind = ipaddress.ip_address(args.bind).is_loopback
    except ValueError:
        loopback_bind = args.bind.lower() == "localhost"
    if not loopback_bind and not args.allow_insecure_remote:
        if not args.access_key:
            raise SystemExit("Refusing a remote bind without --access-key or SIVY_BRIDGE_KEY")
        if not (args.tls_cert and args.tls_key):
            raise SystemExit(
                "Refusing a remote plain-WS bind. Provide --tls-cert/--tls-key "
                "or use --allow-insecure-remote behind a trusted WSS reverse proxy."
            )
    if bool(args.tls_cert) != bool(args.tls_key):
        raise SystemExit("--tls-cert and --tls-key must be provided together")

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    allowed_origins = args.allowed_origins or [
        "https://bestjourin.github.io",
    ]
    bridge = BridgeState(
        args.scope_ip,
        args.scope_port,
        args.interval_ms,
        allowed_origins,
        args.access_key,
    )
    worker = threading.Thread(target=bridge.run, name="rigol-scope-poller", daemon=True)
    worker.start()

    handler = type("ConfiguredBridgeHandler", (ScopeBridgeHandler,), {"bridge": bridge})
    try:
        server = BridgeHttpServer((args.bind, args.port), handler)
    except OSError as error:
        raise SystemExit(
            f"Bridge port {args.bind}:{args.port} is already in use. "
            "Close the existing scope bridge window before starting a new one."
        ) from error
    if args.tls_cert and args.tls_key:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(args.tls_cert, args.tls_key)
        server.socket = context.wrap_socket(server.socket, server_side=True)
        scheme = "wss"
    else:
        scheme = "ws"
    logging.info(
        "RIGOL bridge ready: %s://%s:%d with /video (MHO5054 H.264), "
        "/scope (MHO5054 JPG), /generator (DG4102 SCPI) -> scope %s:%d",
        scheme,
        args.bind,
        args.port,
        args.scope_ip,
        args.scope_port,
    )
    if args.access_key:
        logging.info("Access key authentication is enabled")
    logging.info("Open the web page and click Connect Scope for the live H.264 view.")
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        bridge.stopping.set()
        bridge.wake.set()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
