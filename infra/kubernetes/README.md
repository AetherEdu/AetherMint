# Multi-region Kubernetes manifests

The manifests in this directory are provider-neutral Kubernetes resources. Each
region is deployed as an independent cluster or cluster context, while the
provider-neutral routing contract lives in [`../multi-region/edge-routing.yaml`](../multi-region/edge-routing.yaml).

## Render manifests

```bash
kubectl kustomize infra/kubernetes/overlays/region-a
kubectl kustomize infra/kubernetes/overlays/region-b
```

## Apply to each cluster

Create the runtime secret in each cluster before applying the overlay. The
secret values are intentionally not committed:

```bash
kubectl --context aethermint-region-a -n aethermint-region-a create secret generic aethermint-runtime \
  --from-env-file=backend.production.env
kubectl --context aethermint-region-a apply -k infra/kubernetes/overlays/region-a

kubectl --context aethermint-region-b -n aethermint-region-b create secret generic aethermint-runtime \
  --from-env-file=backend.production.env
kubectl --context aethermint-region-b apply -k infra/kubernetes/overlays/region-b
```

The backend image must expose `/api/health` on port 3001 and the frontend image
must expose `/` on port 3000. Replace the image tags in the base deployments as
part of the release promotion process; never use `latest` for a production
release.

## Blue-green release mode

The `release/` overlay renders a blue and a green Deployment + Service pair for
backend and frontend, replacing the single rolling-update Deployment during
release-mode operation. Each color only talks to its own backend service; the
edge router (the `ReleaseRoute` contract in
[`../../release/release-route.yaml`](../../release/release-route.yaml)) sends
traffic to the active color's frontend service.

```bash
kubectl kustomize infra/kubernetes/release
```

See [`docs/infrastructure/release-runbook.md`](../../docs/infrastructure/release-runbook.md)
for the full blue-green/canary release and rollback procedure, and
`scripts/deploy-blue-green.sh` / `scripts/deploy-canary.sh` for the
coordinators that drive it.

## Regional readiness checks

Before adding a region to global routing, verify:

```bash
kubectl --context aethermint-region-a -n aethermint-region-a rollout status deploy/aethermint-backend-region-a
kubectl --context aethermint-region-a -n aethermint-region-a rollout status deploy/aethermint-frontend-region-a
kubectl --context aethermint-region-b -n aethermint-region-b rollout status deploy/aethermint-backend-region-b
kubectl --context aethermint-region-b -n aethermint-region-b rollout status deploy/aethermint-frontend-region-b
```
