variable "environment" {
  description = "staging or production: the same code creates both environments"
  type        = string
  default     = "staging"
}

variable "cloud_url" {
  description = "Address of the cloud API (here, LocalStack)"
  type        = string
}

variable "db_host" {
  type = string
}

# A lab value. In a real environment, the password comes from the secrets vault
# (chapter 36) and is never kept in the repository or in plain text in the state.
variable "reporting_password" {
  type      = string
  sensitive = true
  default   = "reporting-local"
}
