#!/usr/bin/env bash
set -euo pipefail

function die(){ echo "ERROR: $*" >&2; exit 1; }
function info(){ echo "[INFO] $*"; }
function warn(){ echo "[WARN] $*"; }

echo "Installing local AI components..."

if command -v ollama >/dev/null 2>&1; then
  info "Ollama CLI already installed."
else
  info "Ollama CLI not found. Installing Ollama..."
  if [[ "$OSTYPE" == darwin* ]]; then
    if command -v brew >/dev/null 2>&1; then
      brew install ollama
    else
      die "Homebrew not found. Please install Homebrew or install Ollama manually from https://ollama.com"
    fi
  elif [[ "$OSTYPE" == linux* ]]; then
    if command -v curl >/dev/null 2>&1; then
      info "Downloading Ollama CLI..."
      curl -fsSL https://github.com/ollama/ollama/releases/latest/download/ollama-latest-linux-amd64.tar.gz | tar -xz
      sudo mv ollama /usr/local/bin/
    else
      die "curl is required to download Ollama. Install curl and retry."
    fi
  else
    die "Unsupported OS: $OSTYPE. Install Ollama manually from https://ollama.com"
  fi
fi

if [[ -z "${OLLAMA_HOST:-}" ]]; then
  export OLLAMA_HOST="127.0.0.1:11434"
fi

function ollama_server_running(){
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "http://${OLLAMA_HOST}/v1/models" >/dev/null 2>&1
  else
    ollama list >/dev/null 2>&1
  fi
}

SERVER_STARTED=0
SERVER_PID=""
function stop_server(){
  if [[ "$SERVER_STARTED" -eq 1 && -n "$SERVER_PID" ]]; then
    info "Stopping temporary Ollama server..."
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap stop_server EXIT

if ollama_server_running; then
  info "Ollama server already running at http://${OLLAMA_HOST}."
else
  info "Starting temporary Ollama server for model download..."
  ollama serve > /tmp/ollama-install.log 2>&1 &
  SERVER_PID=$!
  SERVER_STARTED=1

  info "Waiting for Ollama to become available..."
  SECONDS=0
  while [[ "$SECONDS" -lt 60 ]]; do
    if ollama_server_running; then
      break
    fi
    sleep 1
  done
  if ! ollama_server_running; then
    die "Ollama server did not start within 60 seconds. Check /tmp/ollama-install.log"
  fi
fi

info "Pulling default model llama3.2..."
ollama pull llama3.2

info "Verifying model is available..."
ollama show llama3.2 >/dev/null 2>&1 || die "Failed to verify llama3.2 model after pull."

info "Installation complete."
if [[ "$SERVER_STARTED" -eq 1 ]]; then
  info "A temporary Ollama server was started for the model pull and has been stopped."
fi

echo
cat <<'EOF'
Next steps:
  1. Start Ollama with the default model:
       ollama serve --model llama3.2
  2. Open ADHDashboard and go to Settings → AI.
  3. Enable Ollama, set URL to http://127.0.0.1:11434, and test the connection.
EOF
