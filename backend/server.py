#!/usr/bin/env python3
"""
ASGI wrapper to start Node.js Express server for supervisor compatibility.
This allows the existing supervisor configuration to work with Node.js backend.
"""
import subprocess
import sys
import os
import signal

process = None

def signal_handler(signum, frame):
    """Handle termination signals"""
    global process
    if process:
        process.terminate()
        process.wait()
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# Change to backend directory
os.chdir('/app/backend')

# Start Node.js server
try:
    print("🚀 Starting Node.js Express backend on port 8001...")
    process = subprocess.Popen(
        ['node', 'server.js'],
        cwd='/app/backend',
        env=os.environ.copy(),
        stdout=sys.stdout,
        stderr=sys.stderr
    )
    
    # Wait for the process
    process.wait()
    sys.exit(process.returncode)
    
except KeyboardInterrupt:
    print("\n⚠️  Backend server stopped by user")
    if process:
        process.terminate()
    sys.exit(0)
except Exception as e:
    print(f"❌ Error starting backend: {e}")
    sys.exit(1)

# Dummy ASGI app for uvicorn (won't be used)
async def app(scope, receive, send):
    pass
