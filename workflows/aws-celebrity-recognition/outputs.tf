output "workflow_definition" {
  value = {
    name             = var.name
    input_parameters = [
      {
        parameter_name : "mediaWorkflowId"
        parameter_type : "url"
      },
      {
        parameter_name : "mediaAssetId"
        parameter_type : "string"
      },
      {
        parameter_name : "inputFile"
        parameter_type : "S3Locator"
      }
    ]
    optional_input_parameters = []
    output_parameters         = []
    state_machine_arn         = local.state_machine_arn
    activity_arns             = [
      aws_sfn_activity.step_02_celebrity_recognition.id,
    ]
  }
}
