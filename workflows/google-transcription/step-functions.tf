#################################
#  Step Functions Workflow definition
#################################

resource "aws_iam_role" "workflow" {
  name               = format("%.64s", "${var.prefix}-${var.aws_region}-step-functions")
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Principal = {
          Service = "states.${var.aws_region}.amazonaws.com"
        }
        Effect = "Allow"
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "workflow" {
  name   = aws_iam_role.workflow.name
  role   = aws_iam_role.workflow.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "lambda:InvokeFunction"
        Resource = [
          aws_lambda_function.step_01_validate_input.arn,
          aws_lambda_function.step_02_extract_audio.arn,
          aws_lambda_function.step_03_transcription.arn,
          aws_lambda_function.step_04_register_output.arn,
        ]
      }
    ]
  })
}

#################################
#  Step Functions : Workflow
#################################

resource "aws_sfn_state_machine" "workflow" {
  name       = var.prefix
  role_arn   = aws_iam_role.workflow.arn
  definition = jsonencode({
    Comment = "Media Ingest"
    StartAt = "Validate input"
    States  = {
      "Validate input" = {
        Type       = "Task"
        Resource   = aws_lambda_function.step_01_validate_input.arn
        ResultPath = "$.data.doExtractAudio"
        Next       = "Extract audio?"
      }
      "Extract audio?" = {
        Type    = "Choice",
        Choices = [
          {
            Variable      = "$.data.doExtractAudio"
            BooleanEquals = true
            Next          = "Extract audio"
          },
        ]
        Default = "Transcription"
      }
      "Extract audio" = {
        Type     = "Parallel"
        Branches = [
          {
            StartAt = "Start transform job"
            States  = {
              "Start transform job" = {
                Type     = "Task"
                Resource = aws_lambda_function.step_02_extract_audio.arn
                End      = true
              }
            }
          },
          {
            StartAt = "Wait for transform job completion"
            States  = {
              "Wait for transform job completion" = {
                Type           = "Task"
                Resource       = aws_sfn_activity.step_02_extract_audio.id
                ResultPath     = "$.data.transformJobId"
                TimeoutSeconds = 3600
                End            = true
              }
            }
          }
        ]
        OutputPath = "$[1]"
        Next       = "Transcription"
      }
      "Transcription" = {
        Type     = "Parallel"
        Branches = [
          {
            StartAt = "Start AI job"
            States  = {
              "Start AI job" = {
                Type     = "Task"
                Resource = aws_lambda_function.step_03_transcription.arn
                End      = true
              }
            }
          },
          {
            StartAt = "Wait for AI job completion"
            States  = {
              "Wait for AI job completion" = {
                Type           = "Task"
                Resource       = aws_sfn_activity.step_03_transcription.id
                ResultPath     = "$.data.aiJobId"
                TimeoutSeconds = 3600
                End            = true
              }
            }
          }
        ]
        OutputPath = "$[1]"
        Next       = "Register output"
      }
      "Register output" = {
        Type       = "Task"
        Resource   = aws_lambda_function.step_04_register_output.arn
        ResultPath = null
        End        = true
      }
    }
  })

  tags = var.tags
}

locals {
  ## local variable to avoid cyclic dependency
  state_machine_arn = "arn:aws:states:${var.aws_region}:${var.aws_account_id}:stateMachine:${var.prefix}"
}
