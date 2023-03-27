data "aws_caller_identity" "current" {}

locals {
  lambda_insights_extensions = {
    "us-east-1"      = "arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension:21"
    "us-east-2"      = "arn:aws:lambda:us-east-2:580247275435:layer:LambdaInsightsExtension:21"
    "us-west-1"      = "arn:aws:lambda:us-west-1:580247275435:layer:LambdaInsightsExtension:20"
    "us-west-2"      = "arn:aws:lambda:us-west-2:580247275435:layer:LambdaInsightsExtension:21"
    "af-south-1"     = "arn:aws:lambda:af-south-1:012438385374:layer:LambdaInsightsExtension:13"
    "ap-east-1"      = "arn:aws:lambda:ap-east-1:519774774795:layer:LambdaInsightsExtension:13"
    "ap-south-1"     = "arn:aws:lambda:ap-south-1:580247275435:layer:LambdaInsightsExtension:21"
    "ap-northeast-3" = "arn:aws:lambda:ap-northeast-3:194566237122:layer:LambdaInsightsExtension:2"
    "ap-northeast-2" = "arn:aws:lambda:ap-northeast-2:580247275435:layer:LambdaInsightsExtension:20"
    "ap-southeast-1" = "arn:aws:lambda:ap-southeast-1:580247275435:layer:LambdaInsightsExtension:21"
    "ap-southeast-2" = "arn:aws:lambda:ap-southeast-2:580247275435:layer:LambdaInsightsExtension:21"
    "ap-northeast-1" = "arn:aws:lambda:ap-northeast-1:580247275435:layer:LambdaInsightsExtension:32"
    "ca-central-1"   = "arn:aws:lambda:ca-central-1:580247275435:layer:LambdaInsightsExtension:20"
    "cn-north-1"     = "arn:aws-cn:lambda:cn-north-1:488211338238:layer:LambdaInsightsExtension:14"
    "cn-northwest-1" = "arn:aws-cn:lambda:cn-northwest-1:488211338238:layer:LambdaInsightsExtension:14"
    "eu-central-1"   = "arn:aws:lambda:eu-central-1:580247275435:layer:LambdaInsightsExtension:21"
    "eu-west-1"      = "arn:aws:lambda:eu-west-1:580247275435:layer:LambdaInsightsExtension:21"
    "eu-west-2"      = "arn:aws:lambda:eu-west-2:580247275435:layer:LambdaInsightsExtension:21"
    "eu-south-1"     = "arn:aws:lambda:eu-south-1:339249233099:layer:LambdaInsightsExtension:13"
    "eu-west-3"      = "arn:aws:lambda:eu-west-3:580247275435:layer:LambdaInsightsExtension:20"
    "eu-north-1"     = "arn:aws:lambda:eu-north-1:580247275435:layer:LambdaInsightsExtension:20"
    "me-south-1"     = "arn:aws:lambda:me-south-1:285320876703:layer:LambdaInsightsExtension:13"
    "sa-east-1"      = "arn:aws:lambda:sa-east-1:580247275435:layer:LambdaInsightsExtension:20"
  }
}
