# The infrastructure of one Morada environment: the charges queue with its dead-letter
# queue, the bucket for the financial reports, and the reporting database.

resource "aws_sqs_queue" "charges_dlq" {
  name                      = "morada-${var.environment}-charges-dlq"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "charges" {
  name                       = "morada-${var.environment}-charges"
  visibility_timeout_seconds = 30
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.charges_dlq.arn
    maxReceiveCount     = 5
  })
}

resource "aws_s3_bucket" "reports" {
  bucket = "morada-${var.environment}-financial-reports"
}

resource "aws_s3_bucket_versioning" "reports" {
  bucket = aws_s3_bucket.reports.id
  versioning_configuration {
    status = "Enabled"
  }
}

# The free LocalStack has no RDS. The PostgreSQL server comes from Compose, and
# OpenTofu creates the reporting role and database in it.
resource "postgresql_role" "reporting" {
  name     = "reporting"
  login    = true
  password = var.reporting_password
}

resource "postgresql_database" "reporting" {
  name  = "morada_reporting"
  owner = postgresql_role.reporting.name
}

output "charges_queue" {
  value = aws_sqs_queue.charges.url
}
