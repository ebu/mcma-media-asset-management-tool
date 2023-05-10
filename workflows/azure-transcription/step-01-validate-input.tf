#################################
#  Step 1 : Validate input
#################################

resource "aws_iam_role" "step_01_validate_input" {
  name               = format("%.64s", "${var.prefix}-${var.aws_region}-01-validate-input")
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

resource "aws_iam_role_policy" "step_01_validate_input" {
  name   = aws_iam_role.step_01_validate_input.name
  role   = aws_iam_role.step_01_validate_input.id
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
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${aws_lambda_function.step_01_validate_input.function_name}:*",
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
        Sid      = "AllowReadingFromMediaBucket"
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${var.media_bucket.arn}/*"
      },
    ]
  })
}

resource "aws_lambda_function" "step_01_validate_input" {
  function_name    = format("%.64s", "${var.prefix}-01-validate-input")
  role             = aws_iam_role.step_01_validate_input.arn
  handler          = "index.handler"
  filename         = "${path.module}/01-validate-input/build/dist/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/01-validate-input/build/dist/lambda.zip")
  runtime          = "nodejs18.x"
  timeout          = "900"
  memory_size      = "2048"

  layers = var.enhanced_monitoring_enabled && contains(keys(local.lambda_insights_extensions), var.aws_region) ? [
    local.lambda_insights_extensions[var.aws_region]
  ] : []

  environment {
    variables = {
      MCMA_LOG_GROUP_NAME = var.log_group.name
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = var.tags
}
