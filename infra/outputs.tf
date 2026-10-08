output "public_ip" {
  description = "Elastic IP. Goes into client/vercel.json as <ip>:8080."
  value       = aws_eip.achiles.public_ip
}

output "ssh" {
  value = "ssh -i ${abspath(local_sensitive_file.ssh_key.filename)} ec2-user@${aws_eip.achiles.public_ip}"
}

output "watch_bootstrap" {
  description = "First boot takes ~15-25 min on a micro (image builds)."
  value       = "ssh -i ${abspath(local_sensitive_file.ssh_key.filename)} ec2-user@${aws_eip.achiles.public_ip} sudo tail -f /var/log/achiles-bootstrap.log"
}

output "health_url" {
  value = "http://${aws_eip.achiles.public_ip}:8080/healthz"
}

output "instance_id" {
  description = "For Session Manager: aws ssm start-session --target <id>"
  value       = aws_instance.achiles.id
}
