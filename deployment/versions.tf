terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.65.0"
    }
    mcma = {
      source  = "ebu/mcma"
      version = ">= 0.0.23"
    }
  }
  required_version = ">= 1.0"
}
