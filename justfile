# Sulla Desktop Development Commands

# Default command: show help and list all available commands
default:
    @echo "╔════════════════════════════════════════════════════════════════╗"
    @echo "║           Sulla Desktop - Development Commands                 ╚"
    @echo "╚════════════════════════════════════════════════════════════════╝"
    @echo ""
    @just --list --unsorted

# Clean build artifacts only (preserves VM and cached images)
clean:
    @echo "Cleaning up for fresh install (preserves VM and cached images)..."
    rm -rf node_modules
    rm -rf .yarn/cache
    rm -rf .yarn/install-state.gz
    rm -rf dist
    rm -rf ~/Library/Preferences/rancher-desktop
    rm -rf ~/Library/Caches/rancher-desktop
    rm -rf ~/Library/Logs/rancher-desktop
    rm -rf ~/.rd
    rm -rf ~/.kube/config
    rm -rf resources/cert-manager*
    rm -rf resources/darwin/lima
    rm -rf resources/darwin/_output
    rm -f resources/darwin/alpine-lima-*.iso
    rm -rf resources/host/
    rm -rf resources/preload.js*
    rm -rf resources/rancher-dashboard/
    rm -rf resources/rdx-proxy.tar
    rm -rf resources/spin-operator*
    rm -rf resources/win32/
    @echo "Cleanup complete. Run 'just build' for a fresh install."

# Clean all caches and generated files for a fresh install (WIPES VM AND IMAGES)
#rm -rf ~/.lima # This wipes the images too
clean-hard:
    @echo "Cleaning up for fresh install (this will wipe VM and cached images)..."
    rm -rf node_modules
    rm -rf .yarn/cache
    rm -rf .yarn/install-state.gz
    rm -rf dist
    rm -rf ~/Library/Application\ Support/rancher-desktop
    rm -rf ~/Library/Application\ Support/sulla-desktop
    rm -rf ~/Library/Preferences/rancher-desktop
    rm -rf ~/Library/Caches/rancher-desktop
    rm -rf ~/Library/Caches/lima
    rm -rf ~/Library/Logs/rancher-desktop
    rm -rf ~/.rd
    rm -rf ~/.kube/config
    rm -rf resources/cert-manager*
    rm -rf resources/darwin/lima
    rm -rf resources/darwin/_output
    rm -f resources/darwin/alpine-lima-*.iso
    rm -rf resources/host/
    rm -rf resources/preload.js*
    rm -rf resources/rancher-dashboard/
    rm -rf resources/rdx-proxy.tar
    rm -rf resources/spin-operator*
    rm -rf resources/win32/
    @echo "Cleanup complete. Run 'just build' for a fresh install."

# Install dependencies and build the application for production
build:
    yarn install
    yarn run postinstall
    yarn build

# Rebuild without wiping VM (preserves cached images)
rebuild: clean build

# Full rebuild - wipes everything including VM and cached images
rebuild-hard: clean-hard build

# Start the development server (runs in foreground)
start:
    NODE_NO_WARNINGS=1 yarn start

up: 
    NODE_NO_WARNINGS=1 just build start

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

# Restart the development server (use --hard to wipe VM and images)
restart hard="":
    #!/usr/bin/env bash
    just stop
    if [ "{{hard}}" = "--hard" ] || [ "{{hard}}" = "hard" ]; then
        echo "Hard restart: full rebuild (wiping VM and images)..."
        just rebuild-hard
    else
        echo "Building (preserving VM and images)..."
        just build
    fi
    just start

pods:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl get pods -n sulla

apply-yaml:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl apply -f /Users/jonathonbyrdziak/Sites/sulla/sulla-desktop/pkg/rancher-desktop/assets/sulla-deployments.yaml -n sulla

ping-chroma:
    @echo "Pinging Chroma health endpoint..."
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    curl -s -m 5 http://localhost:30115/api/v2/heartbeat || echo "Chroma unreachable (timeout or 410)"

# Port-forward PostgreSQL to localhost:5432 for external access (e.g., pgAdmin, DBeaver)
# Connection: host=localhost, port=5432, user=sulla, password=sulla_dev_password, database=sulla
pg-forward:
    @echo "Port-forwarding PostgreSQL to localhost:5432..."
    @echo "Connect with: host=localhost, port=5432, user=sulla, password=sulla_dev_password, database=sulla"
    @echo "Press Ctrl+C to stop"
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl port-forward -n sulla svc/postgres 30116:30116 --address=0.0.0.0

pg-connect:
    @echo "Starting port-forward in background (auto-stops on exit)..."
    @trap 'kill 0' EXIT; \
     just pg-forward & \
        sleep 3 && \
        echo "Connecting to psql..." && \
        PGPASSWORD=sulla_dev_password psql -h localhost -p 30116 -U sulla -d sulla

pg-conn:
     echo "Connecting to psql..." && \
     PGPASSWORD=sulla_dev_password psql -h localhost -p 30116 -U sulla -d sulla

# Port-forward Redis to localhost:6379 for external access
redis:
    @echo "Port-forwarding Redis to localhost:6379..."
    @echo "Press Ctrl+C to stop"
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl port-forward -n sulla svc/redis 6379:6379 --address=0.0.0.0

# Query PostgreSQL conversations table (summary)
pg-conversations:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl exec -n sulla deploy/postgres -- \
    psql -U sulla -c "SELECT thread_id, jsonb_array_length(messages) as msg_count, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 10;"

# Query PostgreSQL conversations with full messages
pg-messages thread_id="":
    #!/usr/bin/env bash
    if [ -z "{{thread_id}}" ]; then
        echo "Usage: just pg-messages <thread_id>"
        echo "Get thread IDs with: just pg-conversations"
        exit 1
    fi
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl exec -n sulla deploy/postgres -- \
    psql -U sulla -c "SELECT jsonb_pretty(messages) FROM conversations WHERE thread_id = '{{thread_id}}';"

# Login to Docker Hub inside the VM (bypasses rate limiting for image pulls)
docker-login:
    @echo "Logging into Docker Hub inside the VM..."
    @echo "This will store credentials in the VM and bypass Docker Hub rate limits."
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- docker login

# Check Docker login status inside the VM
docker-status:
    @echo "Checking Docker login status..."
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- docker info 2>/dev/null | grep -E "Username|Registry" || echo "Not logged in"

# Query PostgreSQL calendar_events table
pg-events:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl exec -n sulla deploy/postgres -- \
    psql -U sulla -c "SELECT id, title, start_time, end_time, location, description FROM calendar_events ORDER BY start_time;"

get-lima-config:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl list --json 2>/dev/null || echo '[]' | jq -c 'if . == [] then "No instances found" else .[] | {name, status, dir, sshLocalPort} end'

lima-logs:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 sudo cat /var/log/messages | tail -50

check-ws:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 sudo nerdctl --address /var/run/docker/containerd/containerd.sock ps | grep rd-ws-server

logs image:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl logs -n sulla deployment/{{image}} -f

kill-pod image:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl delete pod -n sulla -l app={{image}} --force --grace-period=0

watch-pod image:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl get pods -n sulla -l app={{image}} -w

describe image:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl describe pod -n sulla {{image}}

describe-default image:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl describe pod -n kube-system {{image}}

monitor:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl get pods -n kube-system -w

nerd:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- bash ./wait-k8s-ready.sh

k3s-health:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- curl -kfsS --unix-socket /run/k3s/server.sock https://localhost:6444/healthz

pull-ollama:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- \
    sudo nerdctl --address /var/run/docker/containerd/containerd.sock --namespace k8s.io pull ollama/ollama:latest

stop-k8s:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl stop 0 

chat-ping:
    curl http://localhost:3000/health
    
chat:
    curl -X POST http://localhost:3000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model": "sulla", "messages": [{"role": "user", "content": "Test message"}]}'

limactl:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl list

nodes:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- sudo k3s kubectl get nodes

kubectl:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    sudo k3s kubectl help

# Watch pod events in real time (shows scheduling, image pulls, crashes)
watch-events:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- sudo k3s kubectl get events -A --watch







# Quick check: is API server responding?
k3s-ready:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- sudo k3s kubectl get --raw=/readyz || echo "API not ready"

fix-flannel:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- sudo rm -rf /run/flannel /var/lib/cni/flannel
    limactl shell 0 -- sudo /etc/init.d/k3s restart
    echo "Watching k3s logs for flannel..."
    limactl shell 0 -- sudo tail -f /var/log/k3s.log | grep -i flannel

k3s-restart:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- sudo systemctl restart k3s

flannel-logs:
    limactl shell 0 -- sudo tail -f /var/log/k3s.log | grep -i flannel






# Tail live k3s server logs inside Lima VM (most useful for startup hangs)
k3s-logs:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- sudo tail -f /var/log/k3s.log | grep -i flannel

# Tail k3s agent logs (if using agent mode, less common in single-node)
k3s-agent-logs:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- sudo journalctl -u k3s-agent -f

# Show last 100 lines of k3s logs + follow
k3s-tail:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- sudo journalctl -u k3s -n 100 -f

# Check if k3s process is even running inside VM
k3s-status:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- sudo systemctl status k3s
