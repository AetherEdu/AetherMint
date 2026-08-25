# Kubernetes deployment

This guide covers running the AetherMint platform in a single production
cluster from the manifests in [`infra/k8s/`](../../infra/k8s/). It includes the
frontend, backend, and the supporting data services (PostgreSQL, Redis,
MongoDB), Horizontal Pod Autoscaling on CPU/memory and custom metrics, health
probes, resource limits, and secret management.

For the multi-region topology and failover contract, see
[`multi-region.md`](./multi-region.md). The regional resources under
`infra/kubernetes/` are a separate, provider-neutral stack; `infra/k8s/` is the
self-contained single-cluster production stack.

## Architecture

| Component | Workload | Replicas | Exposed via | Notes |
| --- | --- | --- | --- | --- |
| Frontend (Next.js) | `Deployment` | 2 (HPA 2–10) | Ingress `/` | Port 3000 |
| Backend (Express) | `Deployment` | 3 (HPA 3–12) | Ingress `/api`, ClusterIP | Port 3001, `/api/health` probes |
| PostgreSQL | `Deployment` + PVC | 1 | ClusterIP `postgres:5432` | Password from secret |
| Redis | `Deployment` + PVC | 1 | ClusterIP `redis:6379` | AOF enabled, password from secret |
| MongoDB | `Deployment` + PVC | 1 | ClusterIP `mongodb:27017` | Document store |

All traffic enters through the ingress, which terminates TLS, serves the
frontend at `/`, and routes `/api` directly to the backend.

## Prerequisites

- A Kubernetes cluster (the manifests are provider-neutral; kustomize renders
  standard resources).
- `kubectl` (and optionally `kustomize`) configured for the target cluster.
- An ingress controller (examples use ingress-nginx; adjust
  `ingressClassName`/annotations for the controller in use).
- `metrics-server` installed for CPU/memory autoscaling.
- Optional: Prometheus Adapter for the custom-metric autoscaling (see
  [Autoscaling](#autoscaling)).

## Deploy

Render and review the full manifest set:

```bash
kubectl kustomize infra/k8s
```

Apply the stack:

```bash
kubectl apply -k infra/k8s
```

Wait for rollouts:

```bash
kubectl -n aethermint rollout status deploy/aethermint-backend
kubectl -n aethermint rollout status deploy/aethermint-frontend
kubectl -n aethermint rollout status deploy/aethermint-postgres
kubectl -n aethermint rollout status deploy/aethermint-redis
kubectl -n aethermint rollout status deploy/aethermint-mongodb
```

Smoke-test the health endpoints:

```bash
kubectl -n aethermint exec deploy/aethermint-backend -- \
  wget -qO- http://localhost:3001/api/health
```

## Secrets

Deployments read runtime configuration from the `aethermint-runtime` Secret
(plus the non-secret `aethermint-config` ConfigMap). No secret values are
committed to the repository.

The secret must contain at least the keys used by the manifests:

| Key | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | backend | e.g. `postgresql://aethermint:<password>@postgres:5432/aethermint` |
| `DB_PASSWORD` | postgres | Must match the password embedded in `DATABASE_URL` |
| `REDIS_PASSWORD` | backend, redis | Leave empty if Redis runs without auth locally |
| `JWT_SECRET`, `STELLAR_*`, `ADMIN_PRIVATE_KEY` | backend | See `.env.example` for the full variable set |

Create it from an env file (same convention as the multi-region stack):

```bash
kubectl -n aethermint create secret generic aethermint-runtime \
  --from-env-file=backend.production.env
```

### Configured secrets provider (recommended)

The recommended path is the External Secrets Operator: a platform-managed
`SecretStore` (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, Vault,
etc.) backs `aethermint-runtime` and the operator keeps the Secret in sync and
rotates it on the store's schedule.

1. Install the External Secrets Operator in the cluster.
2. Create a `SecretStore` named `aethermint-secret-store` for your provider
   (see <https://external-secrets.io/latest/provider/>).
3. Populate the store with the keys listed above under `aethermint/runtime`.
4. Uncomment `- secret-provider.yaml` in `infra/k8s/kustomization.yaml` and
   re-apply.

See also [`docs/security/secrets-management.md`](../security/secrets-management.md)
for the overall secrets policy and rotation intervals.

## Health probes

| Workload | Readiness / liveness endpoint |
| --- | --- |
| Backend | HTTP `GET /api/health` on 3001 (returns 503 while draining during shutdown) |
| Frontend | HTTP `GET /` on 3000 |
| PostgreSQL | `pg_isready -U aethermint -d aethermint` |
| Redis | `redis-cli -a <password> ping` → `PONG` |
| MongoDB | `mongosh --eval "db.adminCommand('ping')"` |

Readiness gates traffic at the service/ingress level; liveness restarts
unhealthy pods. Backend pods also `sleep 10` on `preStop` so the ingress
controller drains them before termination.

## Resources

Requests and limits are defined per service in the deployment manifests and
mirrored in `docker-compose.yml` so local and production behaviour stay
comparable:

| Workload | Requests | Limits |
| --- | --- | --- |
| Backend | 250m CPU / 512Mi | 1000m CPU / 1Gi |
| Frontend | 100m CPU / 256Mi | 500m CPU / 512Mi |
| PostgreSQL | 250m CPU / 512Mi | 1000m CPU / 1Gi |
| Redis | 100m CPU / 128Mi | 500m CPU / 512Mi |
| MongoDB | 250m CPU / 512Mi | 1000m CPU / 1Gi |

Right-size these for observed usage; the HPA targets are relative to the
requested amounts.

## Autoscaling

`infra/k8s/hpa.yaml` defines `HorizontalPodAutoscaler` resources for the
stateless workloads:

- **Backend:** 3–12 replicas, scaling on CPU ≥ 70%, memory ≥ 80%, and a custom
  per-pod request rate (`backend_http_requests_per_second`) above 1 req/s.
- **Frontend:** 2–10 replicas, scaling on CPU ≥ 60%, memory ≥ 75%, and
  `frontend_http_requests_per_second` above 2 req/s.

Scale-down is stabilized (300 s window) to avoid flapping; scale-up reacts
within 60 s. Stateful services have no HPA because scaling a single-replica,
PVC-backed database requires a dedicated HA setup (replica sets / clusters) —
see the failover document for the replication strategy.

### Custom metrics

CPU/memory utilization only requires `metrics-server`. The custom request-rate
metrics require the [Prometheus Adapter](https://github.com/kubernetes-sigs/prometheus-adapter)
configured with a rule that maps a request-rate series (e.g. from the backend's
`/api/metrics` endpoint) to per-pod metrics named
`backend_http_requests_per_second` and `frontend_http_requests_per_second`.
Example adapter rule:

```yaml
rules:
  - seriesQuery: 'http_requests_total{namespace!="",pod!=""}'
    resources:
      overrides:
        namespace: { resource: namespace }
        pod: { resource: pod }
    name:
      matches: 'http_requests_total'
      as: '{{.namespace}}_http_requests_per_second'
    metricsQuery: 'sum(rate(http_requests_total{<<.LabelMatchers>>}[1m])) by (<<.GroupBy>>)'
```

Without the adapter, the HPA still functions on CPU/memory and reports the
custom metric as unavailable.

## Ingress and TLS

`infra/k8s/ingress.yaml` routes `aethermint.example.com` `/` to the frontend
and `/api` to the backend over TLS. Before going live:

1. Replace `aethermint.example.com` with the real host.
2. Provision the `aethermint-tls` secret (e.g. cert-manager + a
   ClusterIssuer — the annotation is included, commented out).
3. Update `NEXT_PUBLIC_API_URL` in `infra/k8s/configmap.yaml` to the public
   origin.

## Image tags

The deployments reference `ghcr.io/aetheredu/aethermint-*:latest` as a
placeholder. Promote immutable release tags (commit digests) as part of the
release pipeline and never run `latest` in production — the same rule as the
multi-region stack.

## Comparison with docker-compose

`docker-compose.yml` runs the same services locally: frontend on 3000, backend
on 3001, plus PostgreSQL, Redis, and MongoDB. The compose file now declares the
same CPU/memory requests and limits, so capacity planning and autoscaling
targets validated locally carry over to the cluster. Key differences:

| Concern | docker-compose | Kubernetes |
| --- | --- | --- |
| Service discovery | compose network aliases | cluster DNS (`postgres`, `redis`, `mongodb`) |
| Secrets | `.env` + compose `environment` | `aethermint-runtime` Secret (provider-managed) |
| Scaling | manual (`docker compose up --scale`) | HPA on CPU/memory/custom metrics |
| TLS | none (localhost) | Ingress + cert-manager |
| Persistence | named volumes | PVCs (cluster StorageClass) |

## Troubleshooting

- **`CreateContainerConfigError` / pending pods:** the `aethermint-runtime`
  Secret is missing a referenced key. Create or update the Secret and re-apply.
- **Pods restarting in a loop:** check probe endpoints with
  `kubectl -n aethermint logs deploy/<name>` and verify the health endpoints
  return 200.
- **HPA shows `<unknown>` for metrics:** confirm `metrics-server` is installed
  (`kubectl get --raw /apis/metrics.k8s.io/v1beta1`) and that the pods have
  resource requests defined (they do).
- **No external access:** confirm the ingress controller is running, the host
  resolves to the ingress, and the `aethermint-tls` secret exists.
