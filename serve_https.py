#!/usr/bin/env python3

import argparse
import functools
import ssl
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(description="Serve the Sivy ASC test console over HTTPS.")
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8443)
    parser.add_argument("--certfile", type=Path, required=True)
    parser.add_argument("--keyfile", type=Path, required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(args.directory))
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(certfile=args.certfile, keyfile=args.keyfile)
    server.socket = context.wrap_socket(server.socket, server_side=True)

    print(f"Serving HTTPS on https://{args.bind}:{args.port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
