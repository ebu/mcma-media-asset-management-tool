#################################
#  Step 9 : Register Transcoded Media
#################################

resource "aws_iam_role" "step_08_register_web_version" {
  name               = format("%.64s", "${var.prefix}-${var.aws_region}-08-register-web-version")
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

resource "aws_iam_role_policy" "step_08_register_web_version" {
  name   = aws_iam_role.step_08_register_web_version.name
  role   = aws_iam_role.step_08_register_web_version.id
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
        Sid      = "WriteToCloudWatchLogs"
        Effect   = "Allow"
        Action   = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:${var.log_group.name}:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/${aws_lambda_function.step_08_register_web_version.function_name}:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda-insights:*",
        ]
      },
      {
        Sid      = "XRay"
        Effect   = "Allow"
        Action   = [
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
        Sid      = "AllowBucketLocation"
        Effect   = "Allow"
        Action   = "s3:GetBucketLocation"
        Resource = var.media_bucket.arn
      },
      {
        Sid      = "AllowReadingWritingMediaBucket"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${var.media_bucket.arn}/*"
      },
      {
        Sid      = "ListAndDescribeDynamoDBTables"
        Effect   = "Allow"
        Action   = [
          "dynamodb:List*",
          "dynamodb:DescribeReservedCapacity*",
          "dynamodb:DescribeLimits",
          "dynamodb:DescribeTimeToLive",
        ]
        Resource = "*"
      },
      {
        Sid      = "AllowTableOperations"
        Effect   = "Allow"
        Action   = [
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

resource "aws_lambda_function" "step_08_register_web_version" {
  filename         = "${path.module}/08-register-web-version/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.prefix}-08-register-web-version")
  role             = aws_iam_role.step_08_register_web_version.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/08-register-web-version/build/dist/lambda.zip")
  runtime          = "nodejs14.x"
  timeout          = "900"
  memory_size      = "2048"

  layers = var.enhanced_monitoring_enabled ? ["arn:aws:lambda:${var.aws_region}:580247275435:layer:LambdaInsightsExtension:14"] : []

  environment {
    variables = {
      LogGroupName     = var.log_group.name
      MediaBucket      = var.media_bucket.id
      TableName        = var.mam_service.aws_dynamodb_table.service_table.id
      PublicUrl        = var.mam_service.rest_api_url
      ServicesUrl      = var.service_registry.services_url
      ServicesAuthType = var.service_registry.auth_type
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = var.tags
}
