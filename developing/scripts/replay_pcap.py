"""
TCP Packet Replay Script from PCAP File

This script reads a PCAP file, extracts TCP packets containing raw payload data, 
and replays them over a TCP server while maintaining the original timing.

Usage:
    python replay_pcap.py [-h] [--port PORT] pcap_file

Arguments:
    - pcap_file (str): Path to the PCAP file to be replayed.
    - --port (int, optional): TCP port to listen on (default: 9999).

Example:
    python script.py traffic.pcap --port 8080

Requirements:
    - Python 3
    - scapy (install using `pip install scapy`)

"""

import socket
from scapy.all import rdpcap, TCP, Raw
import argparse
import time

# Parse command-line arguments
parser = argparse.ArgumentParser(description="Replay TCP packets from a PCAP file.")
parser.add_argument("pcap_file", help="Path to the PCAP file")
parser.add_argument(
    "--port", type=int, default=9999, help="Port to listen on (default: 9999)"
)
args = parser.parse_args()

PCAP_FILE = args.pcap_file
PORT = args.port

# Read packets from the specified PCAP file
packets = rdpcap(PCAP_FILE)

# Server setup
server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.bind(("0.0.0.0", PORT))
server.listen(1)

print(f"Listening on port {PORT}...")
conn, addr = server.accept()
print(f"Connection from {addr}")

# Establish timing for replay
if packets[0].time:
    start_time = packets[0].time
else:
    start_time = time.time()

count = 0

for pkt in packets:
    if pkt.haslayer(TCP) and pkt.haslayer(Raw):  # Send only raw data
        print(f"Sending {len(pkt[Raw].load)} bytes, packet {count}")
        count += 1
        delay = float(pkt.time) - start_time
        time.sleep(max(0, float(delay)))
        conn.send(pkt[Raw].load)
        start_time = float(pkt.time)

conn.close()
server.close()
print("Replay finished.")
