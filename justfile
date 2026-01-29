# Sulla Desktop Development Commands

# Default command: list all available commands
default:
    @just --list

# Clean all caches and generated files for a fresh install
cleanup:
    @echo "Cleaning up for fresh install..."
    rm -rf node_modules
    rm -rf .yarn/cache
    rm -rf .yarn/install-state.gz
    rm -rf dist
    rm -rf resources/darwin/lima
    rm -rf resources/darwin/_output
    rm -f resources/darwin/alpine-lima-*.iso
    rm -rf ~/.lima
    rm -rf ~/Library/Application\ Support/rancher-desktop
    rm -rf ~/Library/Application\ Support/sulla-desktop
    rm -rf ~/Library/Caches/lima
    @echo "Cleanup complete. Run 'just build' for a fresh install."

# Install dependencies and build the application for production
build:
    yarn install
    yarn run postinstall
    yarn build

rebuild: cleanup build

# Start the development server (runs in foreground)
start:
    yarn dev

# Tail the development server logs
logs:
    tail -f /tmp/sulla-desktop.log

# Stop the development server gracefully
stop:
    #!/usr/bin/env bash
    echo "Checking for running Sulla Desktop..."
    PIDS=$(pgrep -f "sulla.*Electron|Electron.*sulla" 2>/dev/null || true)
    if [ -z "$PIDS" ]; then
        echo "Sulla Desktop is not running."
        exit 0
    fi
    echo "Found Sulla processes: $PIDS"
    
    # Send SIGTERM for graceful shutdown
    echo "Requesting graceful shutdown (SIGTERM)..."
    pkill -TERM -f "sulla.*Electron|Electron.*sulla" 2>/dev/null || true
    
    # Wait for graceful shutdown (up to 15 seconds)
    for i in {1..15}; do
        REMAINING=$(pgrep -f "sulla.*Electron|Electron.*sulla" 2>/dev/null || true)
        if [ -z "$REMAINING" ]; then
            echo "Sulla Desktop stopped gracefully."
            exit 0
        fi
        echo "Waiting for shutdown... ($i/15)"
        sleep 1
    done
    
    # Force kill if graceful shutdown failed
    echo "Graceful shutdown timed out, force killing..."
    pkill -9 -f "sulla.*Electron|Electron.*sulla" 2>/dev/null || true
    sleep 1
    echo "Sulla Desktop stopped."

# Restart the development server (use --hard to rebuild)
restart hard="":
    #!/usr/bin/env bash
    just stop
    if [ "{{hard}}" = "--hard" ] || [ "{{hard}}" = "hard" ]; then
        echo "Hard restart: rebuilding..."
        just rebuild
    fi
    just start

pods:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl get pods -n sulla