terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 3.75.2, < 4.0.0"
    }
  }
  required_version = ">= 1.0"
}
