##############################
# Lambda websocket-ping
##############################

locals {
  lambda_name_websocket_ping = format("%.64s", replace("${var.prefix}-websocket-ping", "/[^a-zA-Z0-9_]+/", "-" ))
}

resource "aws_iam_role" "websocket_ping" {
  name = format("%.64s", replace("${var.prefix}-${var.aws_region}-websocket-ping", "/[^a-zA-Z0-9_]+/", "-" ))

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
}

resource "aws_iam_role_policy" "websocket_ping" {
  name = aws_iam_role.websocket_ping.name
  role = aws_iam_role.websocket_ping.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = concat([
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
        ],
        Resource = concat([
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:${var.log_group.name}:*",
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.lambda_name_websocket_ping}:*",
        ], var.enhanced_monitoring_enabled ? [
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda-insights:*"
        ] : [])
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
          aws_dynamodb_table.service_table.arn,
          "${aws_dynamodb_table.service_table.arn}/index/*",
        ]
      },
      {
        Sid      = "AllowPostingToWebSockets"
        Effect   = "Allow"
        Action   = "execute-api:ManageConnections"
        Resource = "${aws_apigatewayv2_api.websocket.execution_arn}/${var.stage_name}/*/*"
      },
      {
        Sid    = "AllowEnablingDisablingEventRule"
        Effect = "Allow"
        Action = [
          "events:EnableRule",
          "events:DescribeRule",
          "events:DisableRule",
        ]
        Resource = aws_cloudwatch_event_rule.websocket_ping.arn
      }
    ],
      var.xray_tracing_enabled ?
      [
        {
          Sid    = "AllowLambdaWritingToXRay"
          Effect = "Allow"
          Action = [
            "xray:PutTraceSegments",
            "xray:PutTelemetryRecords",
            "xray:GetSamplingRules",
            "xray:GetSamplingTargets",
            "xray:GetSamplingStatisticSummaries",
          ]
          Resource = "*"
        }
      ] : [])
  })
}

resource "aws_lambda_function" "websocket_ping" {
  depends_on = [
    aws_iam_role_policy.websocket_ping
  ]

  function_name    = local.lambda_name_websocket_ping
  role             = aws_iam_role.websocket_ping.arn
  handler          = "index.handler"
  filename         = "${path.module}/websocket-ping/build/dist/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/websocket-ping/build/dist/lambda.zip")
  runtime          = "nodejs18.x"
  timeout          = "30"
  memory_size      = "2048"

  layers = var.enhanced_monitoring_enabled && contains(keys(local.lambda_insights_extensions), var.aws_region) ? [
    local.lambda_insights_extensions[var.aws_region]
  ] : []

  environment {
    variables = {
      MCMA_LOG_GROUP_NAME    = var.log_group.name
      MCMA_TABLE_NAME        = aws_dynamodb_table.service_table.name
      CLOUD_WATCH_EVENT_RULE = aws_cloudwatch_event_rule.websocket_ping.name
    }
  }

  tracing_config {
    mode = var.xray_tracing_enabled ? "Active" : "PassThrough"
  }
}

resource "aws_cloudwatch_event_rule" "websocket_ping" {
  name                = local.lambda_name_websocket_ping
  schedule_expression = "cron(0/5 * * * ? *)"

  lifecycle {
    ignore_changes = [is_enabled]
  }
}

resource "aws_lambda_permission" "websocket_ping" {
  statement_id  = "AllowInvocationFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.websocket_ping.arn
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.websocket_ping.arn
}

resource "aws_cloudwatch_event_target" "websocket_ping" {
  arn  = aws_lambda_function.websocket_ping.arn
  rule = aws_cloudwatch_event_rule.websocket_ping.name
}
