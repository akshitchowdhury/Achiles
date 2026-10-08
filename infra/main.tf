# Achiles backend on one EC2 instance. Everything here is free-tier or
# zero-cost except the public IPv4 address (AWS bills those hourly) and usage
# beyond the free tier. Deliberately absent: NAT gateway, load balancer, RDS,
# CloudWatch detailed monitoring, custom KMS keys.

data "aws_caller_identity" "current" {}

# ---------------------------------------------------------------- network

# The default VPC already has public subnets and an internet gateway, so no
# VPC, NAT gateway or route tables need creating (or paying for).
data "aws_vpc" "default" {
  default = true
}

# Not every AZ offers every instance type (us-east-1e has no t3, for one), so
# pick a default subnet in an AZ that offers the requested type.
data "aws_ec2_instance_type_offerings" "available" {
  location_type = "availability-zone"
  filter {
    name   = "instance-type"
    values = [var.instance_type]
  }
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
  filter {
    name   = "availability-zone"
    values = data.aws_ec2_instance_type_offerings.available.locations
  }
}

# This machine's public IP, so SSH is open to exactly one address by default.
data "http" "my_ip" {
  url = "https://checkip.amazonaws.com"
}

locals {
  ssh_cidrs = distinct(concat(["${chomp(data.http.my_ip.response_body)}/32"], var.ssh_cidrs))
  subnet_id = sort(data.aws_subnets.default.ids)[0]
  ssm_path  = "/achiles"
}

resource "aws_security_group" "achiles" {
  name        = "achiles"
  description = "Achiles API (8080 for the Vercel rewrite) and SSH from one IP"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = local.ssh_cidrs
  }

  # Open to the world because Vercel's egress IPs aren't fixed. Postgres,
  # Redis and the RAG service are never published, only the API.
  ingress {
    description = "Achiles API"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ---------------------------------------------------------------- ssh key

# Generated here so there's no key to create by hand. The private half is
# written next to this file (gitignored) and lives in the Terraform state.
resource "tls_private_key" "ssh" {
  algorithm = "ED25519"
}

resource "aws_key_pair" "achiles" {
  key_name   = "achiles"
  public_key = tls_private_key.ssh.public_key_openssh
}

resource "local_sensitive_file" "ssh_key" {
  filename        = "${path.module}/achiles-ssh.pem"
  content         = tls_private_key.ssh.private_key_openssh
  file_permission = "0600"
}

# ---------------------------------------------------------------- secrets

resource "random_password" "postgres" {
  length  = 32
  special = false
}

resource "random_password" "session" {
  length  = 64
  special = false
}

# Standard-tier parameters are free; SecureStrings use the AWS-managed
# aws/ssm key, which is also free. deploy/write-env.sh on the instance turns
# every parameter under /achiles/ into a line of .env, so the names here are
# the env var names.
locals {
  secrets = merge(
    {
      POSTGRES_PASSWORD = random_password.postgres.result
      SESSION_SECRET    = random_password.session.result
      OPENAI_API_KEY    = var.openai_api_key
      # Origin only. The API matches this against the browser's Origin header
      # and appends /api/auth/... for the OAuth callback, so a pasted page URL
      # like https://app.vercel.app/welcome must lose its path.
      FRONTEND_URL = regex("^https?://[^/?#]+", var.frontend_url)
    },
    # SSM rejects empty values, so optional settings are only stored when set.
    var.google_client_id != "" ? { CLIENTID = var.google_client_id } : {},
    var.google_client_secret != "" ? { CLIENTSECRET = var.google_client_secret } : {},
  )
}

resource "aws_ssm_parameter" "env" {
  for_each = nonsensitive(toset(keys(local.secrets)))

  name  = "${local.ssm_path}/${each.key}"
  type  = "SecureString"
  value = local.secrets[each.key]
}

# ---------------------------------------------------------------- iam

data "aws_iam_policy_document" "assume_ec2" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "achiles" {
  name               = "achiles-ec2"
  assume_role_policy = data.aws_iam_policy_document.assume_ec2.json
}

data "aws_iam_policy_document" "achiles" {
  statement {
    sid     = "ReadOwnConfig"
    actions = ["ssm:GetParametersByPath", "ssm:GetParameters", "ssm:GetParameter"]
    resources = [
      "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${local.ssm_path}",
      "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${local.ssm_path}/*",
    ]
  }

  # s3.SetUp seeds the plan art on boot: HEAD (needs GetObject) then PUT.
  statement {
    sid       = "SeedPlanArt"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["arn:aws:s3:::project-achiles/*"]
  }
}

resource "aws_iam_role_policy" "achiles" {
  name   = "achiles"
  role   = aws_iam_role.achiles.id
  policy = data.aws_iam_policy_document.achiles.json
}

# Session Manager: a shell from the AWS console or CLI without port 22, for
# when SSH is blocked by the network you're on.
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.achiles.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "achiles" {
  name = "achiles-ec2"
  role = aws_iam_role.achiles.name
}

# ---------------------------------------------------------------- instance

data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_instance" "achiles" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.instance_type
  subnet_id              = local.subnet_id
  vpc_security_group_ids = [aws_security_group.achiles.id]
  key_name               = aws_key_pair.achiles.key_name
  iam_instance_profile   = aws_iam_instance_profile.achiles.name

  # Never bill for burst: when CPU credits run out the instance slows down
  # instead of charging for "unlimited" mode (the default on t3).
  credit_specification {
    cpu_credits = "standard"
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_gb
    encrypted             = true
    delete_on_termination = true
  }

  # IMDSv2 only. Hop limit 2 so containers (one bridge hop away) can still
  # reach the metadata service for the instance role's S3 credentials.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  user_data = templatefile("${path.module}/bootstrap.sh.tftpl", {
    repo_url = var.repo_url
    git_ref  = var.git_ref
  })
  # A changed script only matters on a fresh instance; don't replace a running
  # one because bootstrap.sh was edited. Taint it to force a rebuild.
  user_data_replace_on_change = false

  # The instance reads its .env from these at boot.
  depends_on = [aws_ssm_parameter.env, aws_iam_role_policy.achiles]

  tags = {
    Name = "achiles"
  }

  lifecycle {
    # A newer AL2023 AMI shouldn't rebuild the server on the next apply.
    ignore_changes = [ami, user_data]
  }
}

# Stable address for client/vercel.json across stop/start.
resource "aws_eip" "achiles" {
  domain   = "vpc"
  instance = aws_instance.achiles.id

  tags = {
    Name = "achiles"
  }
}
