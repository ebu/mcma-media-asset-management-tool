#################################
#  Step 2 : Create media asset
#################################

resource "aws_iam_role" "step_02_create_media_asset" {
  name               = format("%.64s", "${var.prefix}-${var.aws_region}-02-create-media-asset")
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

resource "aws_iam_role_policy" "step_02_create_media_asset" {
  name   = aws_iam_role.step_02_create_media_asset.name
  role   = aws_iam_role.step_02_create_media_asset.id
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
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${aws_lambda_function.step_02_create_media_asset.function_name}:*",
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
        Sid    = "ListAndDescribeDynamoDBTables"
        Effect = "Allow"
        Action = [
          "dynamodb:List*",
          "dynamodb:DescribeReservedCapacity*",
          "dynamodb:DescribeLimits",
          "dynamodb:DescribeTimeToLive",
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowTableOperations"
        Effect = "Allow"
        Action = [
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:DeleteItem",
          "dynamodb:DescribeTable",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
        ]
        Resource = [
          var.mam_service.aws_dynamodb_table.service_table.arn,
          "${var.mam_service.aws_dynamodb_table.service_table.arn}/index/*",
        ]
      },
    ]
  })
}

resource "aws_lambda_function" "step_02_create_media_asset" {
  function_name    = format("%.64s", "${var.prefix}-02-create-media-asset")
  role             = aws_iam_role.step_02_create_media_asset.arn
  handler          = "index.handler"
  filename         = "${path.module}/02-create-media-asset/build/dist/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/02-create-media-asset/build/dist/lambda.zip")
  runtime          = "nodejs18.x"
  timeout          = "900"
  memory_size      = "2048"

  layers = var.enhanced_monitoring_enabled && contains(keys(local.lambda_insights_extensions), var.aws_region) ? [
    local.lambda_insights_extensions[var.aws_region]
  ] : []

  environment {
    variables = {
      MCMA_LOG_GROUP_NAME = var.log_group.name
      MCMA_TABLE_NAME     = var.mam_service.aws_dynamodb_table.service_table.id
      MCMA_PUBLIC_URL     = var.mam_service.rest_api_url
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = var.tags
}
