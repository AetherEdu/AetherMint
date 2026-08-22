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

## Regional readiness checks

Before adding a region to global routing, verify:

```bash
kubectl --context aethermint-region-a -n aethermint-region-a rollout status deploy/aethermint-backend-region-a
kubectl --context aethermint-region-a -n aethermint-region-a rollout status deploy/aethermint-frontend-region-a
kubectl --context aethermint-region-b -n aethermint-region-b rollout status deploy/aethermint-backend-region-b
kubectl --context aethermint-region-b -n aethermint-region-b rollout status deploy/aethermint-frontend-region-b
```
