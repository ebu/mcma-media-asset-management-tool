#################################
#  Step 3 : Transcription
#################################

resource "aws_iam_role" "step_03_transcription" {
  name               = format("%.64s", "${var.prefix}-${var.aws_region}-03-transcription")
  path               = var.iam_role_path
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowLambdaAssumingRole"
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "step_03_transcription" {
  name   = aws_iam_role.step_03_transcription.name
  role   = aws_iam_role.step_03_transcription.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Sid      = "DescribeCloudWatchLogs"
        Effect   = "Allow"
        Action   = "logs:DescribeLogGroups"
        Resource = "*"
      },
      {
        Sid    = "WriteToCloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:${var.log_group.name}:*",
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${aws_lambda_function.step_03_transcription.function_name}:*",
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda-insights:*",
        ]
      },
      {
        Sid    = "XRay"
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries",
        ]
        Resource = "*"
      },
      {
        Sid      = "AllowInvokingApiGateway"
        Effect   = "Allow"
        Action   = "execute-api:Invoke"
        Resource = [
          "${var.service_registry.aws_apigatewayv2_stage.service_api.execution_arn}/GET/*",
          "${var.job_processor.aws_apigatewayv2_stage.service_api.execution_arn}/*/*",
        ]
      },
      {
        Sid      = "AllowReadingFromMediaBucket"
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${var.media_bucket.arn}/*"
      },
      {
        Sid      = "AllowGettingActivityTask"
        Effect   = "Allow"
        Action   = "states:GetActivityTask"
        Resource = aws_sfn_activity.step_03_transcription.id
      },
    ]
  })
}

resource "aws_lambda_function" "step_03_transcription" {
  filename         = "${path.module}/03-transcription/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.prefix}-03-transcription")
  role             = aws_iam_role.step_03_transcription.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/03-transcription/build/dist/lambda.zip")
  runtime          = "nodejs16.x"
  timeout          = "900"
  memory_size      = "2048"

  layers = var.enhanced_monitoring_enabled && contains(keys(local.lambda_insights_extensions), var.aws_region) ? [
    local.lambda_insights_extensions[var.aws_region]
  ] : []

  environment {
    variables = {
      MCMA_LOG_GROUP_NAME             = var.log_group.name
      MCMA_SERVICE_REGISTRY_URL       = var.service_registry.service_url
      MCMA_SERVICE_REGISTRY_AUTH_TYPE = var.service_registry.auth_type
      ACTIVITY_ARN                    = aws_sfn_activity.step_03_transcription.id
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = var.tags
}

resource "aws_sfn_activity" "step_03_transcription" {
  name = "${var.prefix}-03-transcription"

  tags = var.tags
}
