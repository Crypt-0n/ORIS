#!/bin/bash
# Start Ollama server in background
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "[ORIS] Waiting for Ollama to start..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "[ORIS] Ollama is ready."
        break
    fi
    sleep 1
done

# Pull default model if not already present
MODEL="${OLLAMA_MODEL:-phi3:mini}"
if ! ollama list | grep -q "$MODEL"; then
    echo "[ORIS] Pulling model $MODEL (first run only)..."
    ollama pull "$MODEL"
    echo "[ORIS] Model $MODEL ready."
else
    echo "[ORIS] Model $MODEL already available."
fi

# Keep Ollama running in foreground
wait $OLLAMA_PID
