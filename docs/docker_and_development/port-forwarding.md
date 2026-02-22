# Port Forwarding

Port forwarding lets you access services running inside containers or Kubernetes pods from your local machine.

## Common use cases

- Open a local web app running in a container
- Access API endpoints for testing
- Connect local tools to in-cluster services

## Port forwarding in Sulla dashboard

From the Sulla container/dashboard view, you can:

- Identify the container service port (for example `3000`, `8080`, `5432`)
- Map it to a local host port
- Open/test the forwarded address locally

Example result:

- Container port `3000` -> Host port `3000`
- Access in browser: `http://localhost:3000`

## Docker CLI port forwarding

When starting a container, publish ports with `-p`:

```bash
docker run -p 3000:3000 <image_name>
```

Format:

- `-p <host_port>:<container_port>`

Inspect active mappings:

```bash
docker ps
```

## Kubernetes port forwarding (kubectl)

For pod-level access:

```bash
kubectl port-forward pod/<pod_name> 8080:8080 -n <namespace>
```

For service-level access:

```bash
kubectl port-forward svc/<service_name> 8080:80 -n <namespace>
```

Then access locally at:

- `http://localhost:8080`

## Troubleshooting

If forwarding does not work, check:

1. Service/container is running
2. You used the correct internal port
3. Host port is not already in use
4. App is listening on the expected interface/port inside container
5. Namespace/resource name is correct for kubectl commands

## AI-assisted debugging

If forwarding fails, ask Sulla to debug by sharing:

- Which container/pod/service you are forwarding
- Local and target ports
- Error output

Sulla can help identify bad mappings, blocked ports, or service configuration issues.
