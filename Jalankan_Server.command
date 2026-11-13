#!/bin/bash
# ==============================================================================
# Script Peluncur Server Papan Komitmen BBPOM Pangkalpinang
# Cukup klik 2x file ini di Mac Anda untuk menyalakan server kapan saja
# ==============================================================================

cd "$(dirname "$0")"
export PATH="$HOME/.local/node/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

echo "================================================================"
echo " Memulai Server Papan Komitmen BBPOM di Pangkalpinang..."
echo "================================================================"
node server.js

