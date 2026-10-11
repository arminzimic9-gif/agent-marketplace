#!/bin/bash
# This script is launched only by Möbius's supervised app-job runner.
set -euo pipefail
exec python3 "$(dirname "$0")/runner.py" "$1"
