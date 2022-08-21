#########################
# Environment Variables
#########################

variable "environment_name" {}
variable "environment_type" {}

variable "global_prefix" {}

#########################
# AWS Variables
#########################

variable "aws_profile" {}
variable "aws_region" {}

#########################
# Google Configuration
#########################

variable "google_credentials_file" {}
variable "google_bucket_location" {}
variable "google_bucket_name" {}

#########################
# Azure Configuration
#########################

variable "azure_config_file" {}
