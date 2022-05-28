# MCMA Media Asset Management Tool

This project is a reference implementation on how you can leverage MCMA to power your media workflows in the cloud.

## Requirements for deploying this project
* Node.js installed (version ^14.17.4 or higher) and accessible in PATH. See [Node.js website](https://nodejs.org/en/blog/release/v14.17.4/).
* NPM package 'typescript' (version ^4.3.5 or newer) installed globally (execute `npm install -g typescript`)
* NPM package '@angular/cli' (version ~13.0.3 or newer) installed globally (execute `npm install -g @angular/cli`)
* Terraform installed (version ^1.1.4 or higher) and available in PATH. See the [Terraform website](https://www.terraform.io/)
* Java (min version 8, max version 17) to run Gradle build and deploy scripts. See [OpenJDK](https://jdk.java.net/archive/)
* AWS account and a [configured AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html)

## Setup procedure
1. Clone this repository to your local hard drive
2. Navigate to the `mcma-media-asset-management-tool` folder.
3. Create a file named `gradle.properties`.
4. Add the following information to the created file and update the parameter values reflecting your AWS configuration. The chosen awsProfile must have enough access rights to deploy all the components:
```
environmentName=com-your-domain-mcma
environmentType=dev

awsProfile=<YOUR_AWS_PROFILE>
awsRegion=<YOUR_AWS_REGION>
```
5. Save the file.
6. Open command line in `mcma-media-asset-management-tool` folder.
7. Execute `gradlew deploy` and let it run. This will  take a few minutes.
8. If no errors have occurred until now you have successfully setup the infrastructure in your AWS cloud.
9. After deployment go to [Cognito in the AWS Console](https://eu-west-1.console.aws.amazon.com/cognito/v2/idp/user-pools).
10. Click on the user pool that contains the chosen `environmentName`. If you don't see the user pool, please check if you are viewing the correct region.
11. Click on button `Create user`.
12. Select the following options:
    1. Check `Email`.
    2. Select `Send an email invitation`.
    3. Enter a user name.
    4. Enter your email address.
    5. Check `Mark email address as verified`.
    6. Select `Generate a password`.
13. Click button `Create user`.
14. You'll receive an email in your inbox with the a link to your MAM deployment.
15. Use the username and temporary password to login.
16. On first login you'll be asked to set a new password.
17. Enjoy using the MCMA Media Asset Management Tool!
