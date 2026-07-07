# Purrsona AWS Migration — Plan & Console Runbook

Region: **ap-southeast-1** (Singapore)
Compute: **ECS Fargate** (App Runner is unavailable — closed to new customers since April 30, 2026)
Database: **RDS for PostgreSQL 16** with `pgvector` + `postgis`
Storage: **S3**
Scope: infrastructure only — provisioned by you via the AWS Console. No IaC, no CI/CD, no custom domain/TLS in this pass.

All console steps below assume the `feature/aws-integration` branch, which contains the app-side changes required for this to actually work (S3 client behavior, CORS, RDS SSL, production Docker images). Merge that branch before deploying.

---

## 1. Architecture mapping

| Component (local) | AWS service | Notes |
|---|---|---|
| `db` — Postgres 16 + PostGIS + pgvector container | **RDS for PostgreSQL 16.14** | Both extensions available on RDS PG16 (`pgvector` 0.8.2, `postgis` 3.4.6) |
| `minio` — S3-compatible storage container | **S3 bucket** | App already speaks the S3 API via boto3; only needs `S3_ENDPOINT` unset + IAM role |
| `backend` — FastAPI + PyTorch/MegaDescriptor container | **ECS Fargate service** (1 vCPU / 3 GB) | Model is now baked into the image at build time (fixed on this branch) |
| `frontend` — Next.js container | **ECS Fargate service** (0.5 vCPU / 1 GB) | Now has a real production build target (fixed on this branch) — was running `next dev` before |
| Docker network (`depends_on`) | **VPC + security groups + Service Connect** (or ALB) | See networking section below |
| N/A (new) | **ECR** (2 repositories) | Container images need to live somewhere ECS can pull from |
| N/A (new) | **Application Load Balancer** | Public entry point for the frontend; ECS Fargate has no built-in public URL like App Runner did |

---

## 2. Fargate sizing

Valid Fargate CPU/memory pairs (fixed combinations only):

| vCPU | Memory options |
|---|---|
| 0.25 | 0.5, 1, 2 GB |
| 0.5 | 1, 2, 3, 4 GB |
| 1 | 2, 3, 4, 5, 6, 7, 8 GB |
| 2 | 4–16 GB (1 GB steps) |

**Backend**: `1 vCPU / 3 GB`. The MegaDescriptor (Swin-Tiny) model plus PyTorch's runtime needs headroom beyond the base container; 3 GB gives comfortable margin. Bump to 4 GB if you see OOM kills under load — cheap to change later, just edit the task definition and redeploy.

**Frontend**: `0.5 vCPU / 1 GB`. Next.js standalone server is lightweight; this tier is generous for a low-traffic personal deployment.

---

## 3. Networking overview

Both services need to run in a VPC. Simplest correct setup for this scale:

- Use the **default VPC** (every account has one per region unless deleted) — no need to create a custom VPC for this.
- **RDS**: place in a private-ish setup — default VPC subnets are technically public, but RDS's security group will restrict access to only the backend's security group, which is the actual security boundary here.
- **Backend Fargate service**: needs outbound internet access (to pull the container image on first run isn't needed since the model is baked in now, but it still needs to reach RDS and S3). Default VPC subnets have a route to an Internet Gateway, so this works without extra NAT setup.
- **Frontend Fargate service**: sits behind an **Application Load Balancer** (ALB) for public HTTP access. The backend does *not* need its own ALB if the frontend's `next.config.js` `rewrites()` proxies `/api/*` to it — but ECS tasks don't have stable IPs, so the backend needs *some* stable address the frontend can reach. Two options:
  - **Simpler (recommended for this scope)**: give the backend its own internal ALB too (or even a second public-facing ALB target group) and set `BACKEND_URL` on the frontend task to that ALB's DNS name.
  - Service Connect / Cloud Map (ECS's built-in service discovery) is the "more correct" long-term answer but adds console complexity; skip it for this pass and use a second ALB target group instead.
- **Security groups**:
  - `sg-rds`: inbound 5432 from `sg-backend` only.
  - `sg-backend`: inbound 8000 from `sg-alb` only. Outbound: all (needed for RDS + S3 + JWT stuff).
  - `sg-frontend`: inbound 3000 from `sg-alb` only. Outbound: all.
  - `sg-alb`: inbound 80/443 from `0.0.0.0/0`. Outbound: to `sg-backend` and `sg-frontend`.

---

## 4. Console runbook (dependency order)

Do these in order — each step's output feeds the next.

### Step 1 — VPC & security groups

1. Console → **VPC** → confirm a default VPC exists in ap-southeast-1 (it does unless previously deleted). Note its VPC ID and subnet IDs (pick at least 2 subnets in different AZs for RDS's subnet group and for Fargate task placement).
2. **VPC → Security groups → Create security group**, repeat 4 times:
   - `purrsona-sg-alb`: inbound rule HTTP (80) from `0.0.0.0/0`. (Add HTTPS/443 later if you set up TLS.)
   - `purrsona-sg-frontend`: inbound rule Custom TCP 3000, source = `purrsona-sg-alb`.
   - `purrsona-sg-backend`: inbound rule Custom TCP 8000, source = `purrsona-sg-alb`.
   - `purrsona-sg-rds`: inbound rule PostgreSQL (5432), source = `purrsona-sg-backend`.

### Step 2 — RDS for PostgreSQL

1. Console → **RDS** → **Create database**.
2. Engine: **PostgreSQL**, version **16.14** (or latest available 16.x).
3. Template: **Dev/Test** (cheaper, single-AZ; switch to Production/Multi-AZ later if you want failover).
4. Settings: DB instance identifier `purrsona-db`, master username `purrsona`, set a strong master password (save it — you'll need it for the backend's `DATABASE_URL`).
5. Instance class: `db.t4g.micro` or `db.t3.micro` is enough for this workload at this scale.
6. Storage: default (20 GB gp3) is fine.
7. Connectivity: VPC = the default VPC from Step 1. **Public access: No**. VPC security group: select `purrsona-sg-rds` (remove the default one). Availability Zone: any.
8. Additional configuration → Initial database name: `purrsona`.
9. **Create database**. Wait for status **Available** (a few minutes).
10. Once available, open the instance and note the **Endpoint** (hostname) and **Port** (5432).
11. **Enable extensions**: RDS parameter groups control which extensions are loadable.
    - RDS → **Parameter groups** → **Create parameter group** (family `postgres16`, name `purrsona-pg16`).
    - Edit it, find `shared_preload_libraries` — leave default unless you need `pg_stat_statements` etc.
    - Go back to your DB instance → **Modify** → change **DB parameter group** to `purrsona-pg16` → apply immediately.
    - `vector` (pgvector) and `postgis` don't need to be in `shared_preload_libraries` — they're loaded via `CREATE EXTENSION`, which any RDS PG16 instance supports out of the box. You do **not** need a custom parameter group just for this; the step above is only needed if you want to tune other settings later. Skip it if you don't need it.
12. Run the schema migration against the new database. From a machine with network access to RDS (or temporarily allow your IP in `purrsona-sg-rds` for this one step, then remove it):
    ```
    psql "postgresql://purrsona:<password>@<rds-endpoint>:5432/purrsona" -f backend/migrations/001_initial.sql
    psql "postgresql://purrsona:<password>@<rds-endpoint>:5432/purrsona" -f backend/migrations/seed.sql   # optional, dev/demo data only
    ```
    This runs `CREATE EXTENSION IF NOT EXISTS vector;` and `CREATE EXTENSION IF NOT EXISTS postgis;` — both are supported directly on RDS PG16, no extra setup needed.

### Step 3 — S3 bucket

1. Console → **S3** → **Create bucket**.
2. Bucket name: globally unique, e.g. `purrsona-images-<your-account-id>`. Region: **ap-southeast-1**.
3. Block Public Access: keep all 4 boxes **checked** (block public access) — photo URLs will be served via signed access or through the backend, not direct public bucket access, since sighting photos should not be indiscriminately public given the app's privacy-conscious design (coordinate blurring etc.).
   - If you *do* want photos directly viewable by URL (simplest for this app's current design, since `photo_url` is just embedded in API responses), you'll need to uncheck "Block all public access" and add a bucket policy allowing `s3:GetObject` for `arn:aws:s3:::<bucket>/photos/*`. This is a real tradeoff — flag it to yourself before deciding.
4. Leave versioning/encryption at defaults (SSE-S3 is fine).
5. **Create bucket**.

### Step 4 — IAM role for the backend task

The backend needs S3 access without static keys (per the app-side fix on `feature/aws-integration`).

1. Console → **IAM** → **Roles** → **Create role**.
2. Trusted entity type: **AWS service** → Use case: **Elastic Container Service** → **Elastic Container Service Task**.
3. Attach a permissions policy: create a new policy (JSON) scoped to just your bucket:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject"],
         "Resource": "arn:aws:s3:::<your-bucket-name>/*"
       }
     ]
   }
   ```
4. Name the role `purrsona-backend-task-role`. This is the role you'll attach to the backend's ECS task definition as the **Task Role** (not the Task Execution Role — that's separate, for ECR pull permissions, and AWS provides `ecsTaskExecutionRole` by default).

### Step 5 — ECR repositories

1. Console → **ECR** → **Create repository**, twice:
   - `purrsona-backend`
   - `purrsona-frontend`
2. Push images (from your machine, with the AWS CLI configured, or from wherever you build):
   ```
   aws ecr get-login-password --region ap-southeast-1 | podman login --username AWS --password-stdin <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com

   podman build -t purrsona-backend ./backend
   podman tag purrsona-backend:latest <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/purrsona-backend:latest
   podman push <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/purrsona-backend:latest

   podman build --target production -t purrsona-frontend ./frontend
   podman tag purrsona-frontend:latest <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/purrsona-frontend:latest
   podman push <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/purrsona-frontend:latest
   ```
   Note the `--target production` flag for the frontend — without it you'll push the dev-server image, which is wrong for this deployment.

### Step 6 — ECS cluster

1. Console → **ECS** → **Clusters** → **Create cluster**.
2. Name: `purrsona-cluster`. Infrastructure: **AWS Fargate (serverless)**.
3. **Create**.

### Step 7 — Backend task definition + service

1. ECS → **Task definitions** → **Create new task definition**.
2. Family: `purrsona-backend`. Launch type: **AWS Fargate**. OS: Linux/X86_64.
3. Task size: **1 vCPU / 3 GB**.
4. Task role: `purrsona-backend-task-role` (from Step 4). Task execution role: default `ecsTaskExecutionRole` (create if it doesn't exist yet — ECS console offers to create it automatically).
5. Container: name `backend`, image URI = the ECR image from Step 5, port 8000.
6. Environment variables (these map from `backend/.env.example` on `feature/aws-integration`):
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | `postgresql://purrsona:<password>@<rds-endpoint>:5432/purrsona` |
   | `DATABASE_SSL_MODE` | `require` |
   | `JWT_SECRET` | a real random secret, not the dev default |
   | `JWT_EXPIRY_HOURS` | `24` |
   | `BOOTSTRAP_ADMIN_EMAIL` | your admin email, optional |
   | `CORS_ALLOWED_ORIGINS` | the frontend's public URL (you'll get this from the ALB in Step 9 — can update later) |
   | `S3_REGION` | `ap-southeast-1` |
   | `S3_BUCKET` | your bucket name from Step 3 |
   | `RATE_LIMIT_PER_MINUTE` | `60` |
   - **Do not set** `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — leaving them unset is what makes the app use the task's IAM role and real S3 automatically (this is the fix from `feature/aws-integration`).
7. Health check (container-level, optional but recommended): command `CMD-SHELL, curl -f http://localhost:8000/health || exit 1`.
8. **Create**.
9. ECS → your cluster → **Services** → **Create**.
   - Task definition: `purrsona-backend`. Service name: `purrsona-backend-svc`. Desired tasks: `1`.
   - Networking: VPC from Step 1, subnets (pick 2), security group `purrsona-sg-backend`. Public IP: **not needed** if using an ALB in front (Step 9 covers the ALB target group wiring — for now, just create the service; you'll attach the load balancer target group when you set up the ALB, or attach it directly here if the console offers a "Load balancing" section during service creation — attach the backend's ALB/target group at this point if you're doing the two-ALB approach from the networking section).
   - **Create service**.

### Step 8 — Frontend task definition + service

1. Same as Step 7, but:
   - Family: `purrsona-frontend`. Task size: **0.5 vCPU / 1 GB**.
   - Task role: not needed (frontend doesn't call AWS APIs directly) — leave as `ecsTaskExecutionRole` only.
   - Container port: 3000.
   - Environment variables:
     | Key | Value |
     |---|---|
     | `BACKEND_URL` | the backend's internal ALB DNS name from Step 9, e.g. `http://purrsona-backend-alb-xxxx.ap-southeast-1.elb.amazonaws.com` |
   - Health check: `CMD-SHELL, wget -qO- http://localhost:3000/ || exit 1` (no dedicated `/health` route on the frontend; hitting `/` is fine).
2. Service name: `purrsona-frontend-svc`, security group `purrsona-sg-frontend`, attach to the public-facing ALB (Step 9).

### Step 9 — Application Load Balancer(s)

You need at least one public ALB (for the frontend). Whether the backend gets its own ALB or uses Service Connect is a scope decision — the simplest console path for "just infra" is a second ALB (internal-facing) for the backend.

**Public ALB (frontend):**
1. EC2 → **Load Balancers** → **Create load balancer** → **Application Load Balancer**.
2. Name: `purrsona-alb-public`. Scheme: **Internet-facing**. VPC: default. Subnets: pick 2+ public subnets.
3. Security group: `purrsona-sg-alb`.
4. Listener: HTTP 80 → forward to a new target group `purrsona-tg-frontend` (target type: **IP**, since Fargate tasks don't register as EC2 instances). Health check path `/`.
5. Create. Note the ALB's DNS name — this is your public URL for the app.
6. Go back to the frontend ECS service (Step 8) and attach this target group if you didn't during service creation.

**Internal ALB (backend):**
1. Same steps, but Scheme: **Internal**. Security group: still needs to allow inbound from `purrsona-sg-alb`... actually for an internal ALB reachable only by the frontend tasks, you can reuse a security group that allows inbound 8000 from `purrsona-sg-frontend` instead of from another ALB SG. Adjust `purrsona-sg-backend`'s inbound rule source accordingly if you go this route (internal ALB → backend tasks, frontend tasks → internal ALB).
2. Target group `purrsona-tg-backend`, health check path `/health`.
3. Note this internal ALB's DNS name — that's the `BACKEND_URL` value for Step 8.

### Step 10 — Verify

1. Visit the public ALB's DNS name in a browser → should load the Purrsona login page.
2. Register/login → confirm the dashboard loads (proves frontend → internal ALB → backend → RDS all work).
3. Try the sighting wizard's photo upload → confirms backend → S3 (via IAM role) works.
4. Check ECS service logs (CloudWatch Logs, auto-created per task definition) if anything fails — the container-level health checks and application logs will point at the specific failure (RDS connection refused → security group issue; S3 access denied → IAM role/bucket policy issue; etc.).

---

## 5. Known gaps in this pass (flagged, not addressed)

- **No custom domain / TLS.** The public ALB is HTTP-only on its default AWS-generated DNS name. Add an ACM certificate + HTTPS listener + Route 53 record later if needed.
- **No CI/CD.** Images are pushed manually per the Step 5 commands. Set up a pipeline (CodePipeline, GitHub Actions, etc.) later if you want automated deploys.
- **Secrets are set as plain ECS environment variables**, not AWS Secrets Manager. Fine for a personal-scale deployment; revisit if this becomes multi-user or handles more sensitive data.
- **Bucket public access decision (Step 3.3)** is a real tradeoff not resolved here — decide based on whether you want photo URLs directly browser-loadable or routed through the backend.
- **Single-AZ RDS, single Fargate task per service** — no redundancy. Acceptable for personal-scale; revisit `Desired tasks` and RDS Multi-AZ if uptime matters more.
