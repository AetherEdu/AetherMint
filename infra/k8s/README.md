# Production Kubernetes manifests

Provider-neutral Kubernetes manifests for running the AetherMint platform in a
single production cluster: frontend, backend, and the supporting data services
(PostgreSQL, Redis, MongoDB), with Horizontal Pod Autoscaling on CPU, memory,
and custom request-rate metrics.

Layout:

- `kustomization.yaml` — entry point; renders the whole stack
- `backend-*.yaml`, `frontend-*.yaml` — application workloads
- `postgres-*.yaml`, `redis-*.yaml`, `mongodb-*.yaml` — supporting services
- `pvc.yaml` — persistent volumes for the stateful services
- `ingress.yaml` — TLS-terminating ingress (frontend + `/api` → backend)
- `hpa.yaml` — autoscaling policies (CPU, memory, custom metrics)
- `secret-provider.yaml` — optional External Secrets Operator template

Render and validate:

```bash
kubectl kustomize infra/k8s
```

Apply:

```bash
kubectl apply -k infra/k8s
```

Full deployment guide, prerequisites, and the secret provisioning steps live in
[`docs/infrastructure/kubernetes.md`](../../docs/infrastructure/kubernetes.md).
