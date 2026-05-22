"""
UDP Packet Replay Script from PCAP File

This script reads a PCAP file, extracts UDP packets containing raw payload data, 
and replays them over a UDP socket on local host, while maintaining the original timing.

Usage:
    python replay_pcap.py [-h] [--port PORT] pcap_file

Arguments:
    - pcap_file (str): Path to the PCAP file to be replayed.
    - --port (int, optional): UDP port to use (default: 9999).

Example:
    python script.py traffic.pcap --port 8080

Requirements:
    - Python 3
    - scapy (install using `pip install scapy`)

"""

import socket
from scapy.all import rdpcap, UDP, Raw
import argparse
import time

# Parse command-line arguments
parser = argparse.ArgumentParser(description="Replay UDP packets from a PCAP file.")
parser.add_argument("pcap_file", help="Path to the PCAP file")
parser.add_argument(
    "--port", type=int, default=9999, help="Port to use (default: 9999)"
)
args = parser.parse_args()

PCAP_FILE = args.pcap_file
PORT = args.port

# Read packets from the specified PCAP file
packets = rdpcap(PCAP_FILE)

# Socket setup
udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

print(f"Sending on port {PORT}...")

# Establish timing for replay
if packets[0].time:
    start_time = packets[0].time
else:
    start_time = time.time()

count = 0

for pkt in packets:
    if pkt.haslayer(UDP) and pkt.haslayer(Raw):  # Send only raw data
        payload = pkt[Raw].load
        print(f"Sending {len(payload)} bytes, packet {count}")
        count += 1
        delay = float(pkt.time) - start_time
        time.sleep(max(0, float(delay)))
        udp_sock.sendto(payload, ("127.0.0.1", PORT))
        start_time = float(pkt.time)

udp_sock.close()
print("Replay finished.")
