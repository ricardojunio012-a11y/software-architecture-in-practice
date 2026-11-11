# The fake AWS: LocalStack accepts any credentials
provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    s3  = var.cloud_url
    sqs = var.cloud_url
  }

  default_tags {
    tags = {
      project     = "morada"
      environment = var.environment
      managed_by  = "opentofu"
    }
  }
}

provider "postgresql" {
  host     = var.db_host
  port     = 5432
  username = "morada"
  password = "morada"
  sslmode  = "disable"
}
