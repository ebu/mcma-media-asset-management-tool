#########################
# Provider registration
#########################

provider "aws" {
  profile = var.aws_profile
  region  = var.aws_region
}

provider "mcma" {
  service_registry_url = module.service_registry.service_url

  aws4_auth {
    profile = var.aws_profile
    region  = var.aws_region
  }
}

############################################
# Cloud watch log group for central logging
############################################

resource "aws_cloudwatch_log_group" "main" {
  name = "/mcma/${var.global_prefix}"
}

#########################
# MAM service
#########################
module "service" {
  source = "../service"

  prefix = "${var.global_prefix}-mam-service"

  stage_name = var.environment_type

  aws_region = var.aws_region

  media_bucket     = aws_s3_bucket.media
  service_registry = module.service_registry
  job_processor    = module.job_processor

  log_group = aws_cloudwatch_log_group.main
}

#########################
# MAM Website
#########################
module "website" {
  source = "../website"

  prefix = var.global_prefix

  environment_type = var.environment_type

  aws_region = var.aws_region

  media_bucket = aws_s3_bucket.media
  mam_service  = module.service
}

#########################
# Service Registry Module
#########################

module "service_registry" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/service-registry/aws/0.15.0/module.zip"

  prefix = "${var.global_prefix}-service-registry"

  stage_name = var.environment_type

  aws_region  = var.aws_region
  aws_profile = var.aws_profile

  log_group                   = aws_cloudwatch_log_group.main
  api_gateway_metrics_enabled = true
  xray_tracing_enabled        = true
  enhanced_monitoring_enabled = true
}

#########################
# Job Processor Module
#########################

module "job_processor" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/job-processor/aws/0.15.0/module.zip"

  prefix = "${var.global_prefix}-job-processor"

  stage_name     = var.environment_type
  dashboard_name = var.global_prefix

  aws_region = var.aws_region

  service_registry = module.service_registry
  execute_api_arns = [
    "${module.service_registry.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/GET/*",
    "${module.ffmpeg_service.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.mediainfo_ame_service.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.stepfunctions_workflow_service.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.aws_ai_service.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.google_ai_service.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.azure_ai_service.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.service.aws_apigatewayv2_api.rest_api.execution_arn}/${var.environment_type}/*/*",
  ]

  log_group                   = aws_cloudwatch_log_group.main
  api_gateway_metrics_enabled = true
  xray_tracing_enabled        = true
  enhanced_monitoring_enabled = true
}

#########################
# Media Info AME Service
#########################

module "mediainfo_ame_service" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/mediainfo-ame-service/aws/0.1.0/module.zip"

  prefix = "${var.global_prefix}-mediainfo-ame-service"

  stage_name = var.environment_type
  aws_region = var.aws_region

  service_registry = module.service_registry

  execute_api_arns = [
    "${module.service_registry.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.job_processor.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
  ]

  log_group                   = aws_cloudwatch_log_group.main
  api_gateway_metrics_enabled = true
  xray_tracing_enabled        = true
  enhanced_monitoring_enabled = true
}

#########################
# FFmpeg service
#########################

module "ffmpeg_service" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/ffmpeg-service/aws/0.1.0/module.zip"

  prefix = "${var.global_prefix}-ffmpeg-service"

  stage_name = var.environment_type
  aws_region = var.aws_region

  service_registry = module.service_registry

  execute_api_arns = [
    "${module.service_registry.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.job_processor.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
  ]

  log_group                   = aws_cloudwatch_log_group.main
  api_gateway_metrics_enabled = true
  xray_tracing_enabled        = true
  enhanced_monitoring_enabled = true
}

#########################
# AWS AI service
#########################

module "aws_ai_service" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/aws-ai-service/aws/0.1.1/module.zip"

  prefix = "${var.global_prefix}-aws-ai-service"

  stage_name = var.environment_type
  aws_region = var.aws_region

  service_registry = module.service_registry

  execute_api_arns = [
    "${module.service_registry.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.job_processor.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
  ]

  log_group = aws_cloudwatch_log_group.main
}

#########################
# Google AI service
#########################

module "google_ai_service" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/google-ai-service/aws/0.1.0/module.zip"

  prefix = "${var.global_prefix}-google-ai-service"

  stage_name = var.environment_type
  aws_region = var.aws_region

  service_registry = module.service_registry

  execute_api_arns = [
    "${module.service_registry.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.job_processor.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
  ]

  google_credentials_file = var.google_credentials_file
  google_bucket_location  = var.google_bucket_location
  google_bucket_name      = var.google_bucket_name

  log_group                   = aws_cloudwatch_log_group.main
  api_gateway_metrics_enabled = true
  xray_tracing_enabled        = true
  enhanced_monitoring_enabled = true
}

#########################
# Azure AI service
#########################

module "azure_ai_service" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/azure-ai-service/aws/0.1.0/module.zip"

  prefix = "${var.global_prefix}-azure-ai-service"

  stage_name = var.environment_type
  aws_region = var.aws_region

  service_registry = module.service_registry

  execute_api_arns = [
    "${module.service_registry.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.job_processor.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
  ]

  azure_config_file = var.azure_config_file

  log_group = aws_cloudwatch_log_group.main
}

########################################
# AWS Step Functions Workflow Service
########################################

module "stepfunctions_workflow_service" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/step-functions-workflow-service/aws/0.1.0/module.zip"

  prefix = "${var.global_prefix}-sf-workflow-service"

  stage_name = var.environment_type
  aws_region = var.aws_region

  service_registry = module.service_registry

  execute_api_arns = [
    "${module.service_registry.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.job_processor.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
  ]

  log_group = aws_cloudwatch_log_group.main

  workflows = [
    module.media_ingest_workflow.workflow_definition,
    module.aws_celebrity_recognition.workflow_definition,
    module.aws_face_detection.workflow_definition,
    module.aws_label_detection.workflow_definition,
    module.aws_transcription.workflow_definition,
    module.azure_transcription.workflow_definition,
    module.google_transcription.workflow_definition,
  ]
}

module "media_ingest_workflow" {
  source = "../workflows/media-ingest"

  prefix = "${var.global_prefix}-wf-media-ingest"

  aws_region = var.aws_region

  service_registry = module.service_registry
  job_processor    = module.job_processor
  mam_service      = module.service

  media_bucket = aws_s3_bucket.media

  log_group = aws_cloudwatch_log_group.main
}

module "aws_celebrity_recognition" {
  source = "../workflows/aws-celebrity-recognition"

  prefix = "${var.global_prefix}-wf-aws-celebrity-recognition"

  aws_region = var.aws_region

  service_registry = module.service_registry
  job_processor    = module.job_processor
  mam_service      = module.service

  media_bucket = aws_s3_bucket.media

  log_group = aws_cloudwatch_log_group.main
}

module "aws_face_detection" {
  source = "../workflows/aws-face-detection"

  prefix = "${var.global_prefix}-wf-aws-face-detection"

  aws_region = var.aws_region

  service_registry = module.service_registry
  job_processor    = module.job_processor
  mam_service      = module.service

  media_bucket = aws_s3_bucket.media

  log_group = aws_cloudwatch_log_group.main
}

module "aws_label_detection" {
  source = "../workflows/aws-label-detection"

  prefix = "${var.global_prefix}-wf-aws-label-detection"

  aws_region = var.aws_region

  service_registry = module.service_registry
  job_processor    = module.job_processor
  mam_service      = module.service

  media_bucket = aws_s3_bucket.media

  log_group = aws_cloudwatch_log_group.main
}

module "aws_transcription" {
  source = "../workflows/aws-transcription"

  prefix = "${var.global_prefix}-wf-aws-transcription"

  aws_region = var.aws_region

  service_registry = module.service_registry
  job_processor    = module.job_processor
  mam_service      = module.service

  media_bucket = aws_s3_bucket.media

  log_group = aws_cloudwatch_log_group.main
}

module "azure_transcription" {
  source = "../workflows/azure-transcription"

  prefix = "${var.global_prefix}-wf-azure-transcription"

  aws_region = var.aws_region

  service_registry = module.service_registry
  job_processor    = module.job_processor
  mam_service      = module.service

  media_bucket = aws_s3_bucket.media

  log_group = aws_cloudwatch_log_group.main
}

module "google_transcription" {
  source = "../workflows/google-transcription"

  prefix = "${var.global_prefix}-wf-google-transcription"

  aws_region = var.aws_region

  service_registry = module.service_registry
  job_processor    = module.job_processor
  mam_service      = module.service

  media_bucket = aws_s3_bucket.media

  log_group = aws_cloudwatch_log_group.main
}
