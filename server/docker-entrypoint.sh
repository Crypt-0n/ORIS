#!/bin/sh
# Fix volume permissions for persistent data directories before dropping privileges
chown -R node:node /app/data /app/uploads /app/avatars 2>/dev/null || true

# Forward the command to the node user
exec gosu node "$@"
