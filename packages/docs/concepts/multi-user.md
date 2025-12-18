# Multi-user model (preview)

Multi-user editing is modeled as:

- **Command streams** (changes transmitted as commands)
- **Row-level locking** (released on commit)

Server/transport integration is pluggable (WebSocket, SSE, polling, etc.).

