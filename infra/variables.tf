variable "region" {
  description = "AWS region. us-east-1 matches the project-achiles S3 bucket."
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Profile from ~/.aws/credentials."
  type        = string
  default     = "default"
}

variable "instance_type" {
  description = "t2.micro is free-tier eligible on older accounts; t3.micro on newer ones. Must be x86_64."
  type        = string
  default     = "t2.micro"
}

variable "root_volume_gb" {
  description = "gp3 root volume. Docker images + the 2 GB swap file need ~10 GB; free tier covers up to 30."
  type        = number
  default     = 20
}

variable "repo_url" {
  description = "Public git URL the instance clones on first boot."
  type        = string
  default     = "https://github.com/akshitchowdhury/Achiles.git"
}

variable "git_ref" {
  description = "Branch or tag to deploy."
  type        = string
  default     = "main"
}

variable "ssh_cidr" {
  description = "CIDR allowed to SSH. Empty = this machine's current public IP (/32)."
  type        = string
  default     = ""
}

variable "frontend_url" {
  description = "Vercel URL the app is served from, no trailing slash. Can be a placeholder and changed later (see DEPLOY.md)."
  type        = string
}

variable "openai_api_key" {
  description = "Used by the RAG service. Stored as an SSM SecureString."
  type        = string
  sensitive   = true

  validation {
    condition     = startswith(var.openai_api_key, "sk-") && length(var.openai_api_key) > 20
    error_message = "openai_api_key must be a real OpenAI key (sk-...), not the placeholder from terraform.tfvars.example."
  }
}

variable "google_client_id" {
  description = "Google OAuth client id. Empty = guest-only sign-in."
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret."
  type        = string
  default     = ""
  sensitive   = true
}
