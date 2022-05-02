import { awscdk } from "projen";
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: "2.22.0",
  defaultReleaseBranch: "main",
  name: "stream-process-example",
  projenrcTs: true,

  deps: [
    '@aws-cdk/aws-glue-alpha@2.22.0-alpha.0',
    '@aws-cdk/aws-kinesisfirehose-alpha@2.22.0-alpha.0',
    '@aws-cdk/aws-kinesisfirehose-destinations-alpha@2.22.0-alpha.0',
  ],
  devDeps: [
    '@types/aws-lambda',
  ],
  gitignore: [
    '.venv',
  ],
});
project.synth();