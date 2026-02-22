# Managing Containers

Sulla Desktop gives you two ways to manage containers:

1. Dashboard management inside the app
2. Command-line management (Docker, Lima, and kubectl)

## Manage containers in the dashboard

From the Sulla Docker dashboard, you can:

- View running and stopped containers
- Start, stop, and restart containers
- Inspect status and basic health
- Check logs and active workloads

For most day-to-day operations, the dashboard is the fastest option.

## Manage containers from the command line

If you prefer terminal workflows, use the built-in container tooling.

### Docker commands

```bash
docker ps
docker ps -a
docker start <container_name>
docker stop <container_name>
docker restart <container_name>
docker logs -f <container_name>
docker exec -it <container_name> sh
```

### Lima commands

```bash
limactl list
limactl shell <instance_name>
limactl stop <instance_name>
limactl start <instance_name>
```

### kubectl commands (when Kubernetes is enabled)

```bash
kubectl get nodes
kubectl get pods -A
kubectl get svc -A
kubectl describe pod <pod_name> -n <namespace>
kubectl logs <pod_name> -n <namespace>
```

## AI-assisted container management

Your AI executive assistant can also help by:

- Diagnosing container failures
- Checking likely misconfigurations
- Suggesting or applying fixes
- Running iterative debug/test loops with you

## Troubleshooting basics

If something fails, check in this order:

1. Container is running
2. Logs show expected startup behavior
3. Ports are not conflicting
4. Required environment variables are set
5. Dependent services are available

## Best practice

Use dashboard controls for quick visibility, and use CLI for deeper inspection and scripting.
