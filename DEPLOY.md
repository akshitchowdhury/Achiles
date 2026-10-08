# Deploying Achiles (prototype)

```
Browser ──HTTPS──▶ Vercel (React build)
                     │  /api/*  rewrite (client/vercel.json)
                     ▼
              EC2 :8080 ▶ api (Go) ──gRPC──▶ rag (Python) ──▶ OpenAI
                           │                  │
                           ├──▶ redis         └──▶ postgres/achiles_vectors (pgvector)
                           └──▶ postgres/achiles
```

The browser only ever talks to the Vercel domain. Vercel proxies `/api/*` to
the VM, so the API is same-origin: the session cookie is first-party, there is
no CORS, and there is no mixed-content problem even though Vercel→EC2 is plain
HTTP. The VM needs no domain name and no TLS certificate.

## Option A: Terraform (recommended)

`infra/` creates a dedicated instance and the instance installs itself. That
covers a t2.micro in the default VPC, an Elastic IP, a security group, an IAM
role, an SSH key and secrets in SSM Parameter Store. There's no NAT gateway,
load balancer or RDS to pay for.

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # add your OpenAI key
terraform init
terraform apply
```

On first boot the instance installs Docker, clones `main`, writes `.env` from
SSM (`deploy/write-env.sh`), runs `docker compose up -d --build` and seeds the
plans. This takes about 15–25 minutes on a micro. Watch it with the
`watch_bootstrap` output; it ends with `ACHILES BOOTSTRAP COMPLETE`. Then put
the `public_ip` output into `client/vercel.json` (see section 3).

Changing a setting such as `frontend_url`: update `terraform.tfvars`, then:

```bash
terraform apply
ssh ... 'cd /opt/achiles && bash deploy/write-env.sh && docker compose up -d'
```

If SSH is blocked on your network, `instance_id` works with Session Manager
from the EC2 console (**Connect → Session Manager**).

`terraform destroy` removes everything, including the database.

The manual steps below do the same by hand.

## 1. EC2

1. Launch **Amazon Linux 2023**, `t2.micro` or `t3.micro` (whichever the
   console marks *Free tier eligible*), 20 GB gp3 root volume.
   On a newer AWS account (Free plan with credits), `t3.small` (2 GB) may also
   be eligible and gives this stack much more room.
2. Security group inbound:
   - `22` from **your IP only**
   - `8080` from anywhere (Vercel's egress IPs aren't fixed)
3. Allocate an **Elastic IP** and associate it, so the address in
   `vercel.json` survives a stop/start. AWS bills public IPv4 addresses
   hourly; check whether your free tier covers it.
4. Optional: attach an IAM role allowing `s3:GetObject` (for HEAD) and `s3:PutObject`
   on the `project-achiles` bucket, so plan art can be seeded without keys.

## 2. Server

```bash
ssh ec2-user@<elastic-ip>
git clone <repo-url> achiles && cd achiles
bash deploy/ec2-setup.sh        # swap, docker, compose — then log out/in
cd achiles                       # after logging back in
cp deploy/.env.example .env && chmod 600 .env && nano .env
docker compose up -d --build    # first build takes a while on a micro
bash deploy/seed.sh             # once: loads the 5 plans + templates
curl localhost:8080/healthz     # {"status":"ok"}
```

On first boot the RAG service embeds `LLM/trainingDoc/MasterWorkoutPlan.md`
(25 chunks, well under a cent). Later restarts find the chunks and skip this.

Logs: `docker compose logs -f api rag`. Memory: `docker stats`, `free -m`.

## 3. Vercel

1. Import the repo, set **Root Directory** to `client`. The Vite preset
   detects the build. No environment variables are needed: the client
   defaults to `/api`.
2. In `client/vercel.json`, replace both `EC2_HOST` with `<elastic-ip>:8080`
   (or its `ec2-…compute.amazonaws.com` name). Commit and push.
3. Put the deployed URL into the VM's `.env` as `FRONTEND_URL`, then
   `docker compose up -d` again.

## 4. Google sign-in (optional)

On the OAuth client in Google Cloud Console:

- Authorised JavaScript origin: `https://<your-app>.vercel.app`
- Authorised redirect URI: `https://<your-app>.vercel.app/api/auth/oauth/google/callback`

Then set `CLIENTID` / `CLIENTSECRET` in `.env`. Without them, guest sign-up
still works.

## Updating

```bash
cd /opt/achiles      # Terraform installs here; the manual setup uses ~/achiles
git pull && docker compose up -d --build
```

## Things to know

- **Coach latency.** One answer took ~15s locally. The API allows `RAG_TIMEOUT`
  (90s). Vercel doesn't document a timeout for external rewrites, so check the
  coach page once after deploying. If long answers fail at Vercel but succeed
  with `curl` on the VM, lower `RAG_TIMEOUT`.
- **Cost guard.** `/askAchiles` is rate-limited per athlete (3, then 1 per 2
  minutes) and globally (20, then 1 per minute) via `ACHILES_*` variables. If
  Redis is down, the coach is switched off rather than left unmetered. Also
  set a monthly spend limit on the OpenAI project.
- **The VM's port 8080 is public.** Anyone who finds the IP can call the API
  directly, bypassing Vercel. That's acceptable for a prototype. To close it,
  see Vercel's "restricting your origin to Vercel traffic".
- **Backups.** Postgres lives in the `pgdata` Docker volume on the instance.
  Terminating the instance deletes it.
  `docker compose exec postgres pg_dump -U postgres achiles > backup.sql`.

## Sharing the VM with another app

Achiles can run next to another app on the same instance:

- It publishes only `8080` (`API_PUBLISH_PORT` in `.env` to change it), so
  an existing web server on 80/443 (Caddy, nginx) is untouched.
- Everything it creates is prefixed `achiles_` (containers, network, the
  `pgdata` volume), and `deploy/ec2-setup.sh` skips anything that already
  exists and never restarts Docker.
- **Memory is the limit.** Check `free -m` before `docker compose up`. If the
  other app already uses more than ~300 MB of a 1 GB instance, Achiles will
  push both into swap and the coach will crawl. Move to a 2 GB instance, or
  give Achiles its own.
