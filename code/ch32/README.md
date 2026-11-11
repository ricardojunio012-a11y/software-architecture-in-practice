# Chapter 32: Containers, Kubernetes, and serverless

Lab for chapter 32 of *Software Architecture in Practice*.

The Morada API runs on a **simulated** Kubernetes: the lab reads the real manifests in the `k8s/` folder (Deployment, Service, HTTPRoute, PodDisruptionBudget, and HPA), checks that they match each other, and simulates, on a logical clock with a fixed seed, the scheduler, the HPA, and the node autoscaler on the 5th of the month. The PDF financial report is a function: the code is real, it generates real PDFs, and the whole month of calls is simulated with cold starts and Lambda-style billing. The optional `cloud` step deploys the same function to LocalStack and really calls it.

Why simulate, instead of starting a cluster with kind? A local cluster takes minutes to start, competes for memory with the rest of the machine, and does not give the same answer twice: the moment the HPA reacts depends on the real clock. The simulation follows the algorithm described in the Kubernetes documentation and always gives the same result, which can be checked. The manifests are still real and can be applied to a cluster (`kubectl apply -f k8s/`), as long as the image exists and, for the HTTPRoute, there is a Gateway named `public-gateway`.

| Version | What it does |
|---|---|
| `manifests` | Checks the rules across the manifests (selectors, ports, CPU requests, probes, PDB) |
| `hpa` | The 5th in four scenarios: 3 fixed replicas, 24 fixed, HPA, and HPA with pre-scaling |
| `function` | Generates three PDFs with the function's code and simulates the month: the batch on the 1st and the on-demand requests |
| `cost` | One whole month, in dollars at us-east-1 prices: API on EKS, API on VMs with Kamal, PDF as a function or in the cluster |
| `cloud` | (optional) Deploys the function to LocalStack, calls it four times, and checks the PDF in the bucket |

## Prerequisite

Docker with Docker Compose. No port is published on the host. The `cloud` step pulls the LocalStack image (about 1.8 GB) and the Lambda Node.js runtime image, and gives LocalStack the Docker socket, so it can create the function containers.

## Walkthrough

```bash
docker compose run --rm app manifests
docker compose run --rm tools verify manifests
docker compose run --rm app hpa
docker compose run --rm tools verify hpa
docker compose run --rm app function
docker compose run --rm tools verify function
docker compose run --rm app cost
docker compose run --rm tools verify cost
docker compose run --rm app tests

# optional: the real function, on LocalStack
docker compose --profile cloud run --rm cloud
docker compose run --rm tools verify cloud
docker compose --profile cloud down -v
```

The generated PDFs are in `output/pdf/`.

## Try it

- Delete `cpu` from `requests` in `k8s/deployment.yaml` and run `manifests` and `hpa`.
- Change the HPA target from 60% to 80% in `k8s/hpa.yaml`: how many node-hours does the 5th save, and how many requests go unanswered?
- In `src/cluster.ts`, change `nodeStartup` from 120 to 30 s (nodes already on, waiting): is pre-scaling still worth it?
- In `src/platform.ts`, change the idle timeout from 5 to 30 minutes and look at the cold starts of the on-demand requests.
