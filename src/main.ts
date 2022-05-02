import { CloudWatchEncryptionMode, Database, S3EncryptionMode, SecurityConfiguration } from '@aws-cdk/aws-glue-alpha';
import { DeliveryStream, LambdaFunctionProcessor } from '@aws-cdk/aws-kinesisfirehose-alpha';
import { S3Bucket } from '@aws-cdk/aws-kinesisfirehose-destinations-alpha';
import { App, Duration, RemovalPolicy, Size, Stack, StackProps } from 'aws-cdk-lib';
import { CfnWorkGroup } from 'aws-cdk-lib/aws-athena';
import { CfnCrawler } from 'aws-cdk-lib/aws-glue';
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Stream, StreamEncryption } from 'aws-cdk-lib/aws-kinesis';
import { Key } from 'aws-cdk-lib/aws-kms';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { join } from 'path';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    // Cria um chave cryptografica    
    const kmsKey = new Key(this, 'stream-process-kms-key', {
      enableKeyRotation: true,
    });

    /**
     * Amazon Kinesis Data Streams is a massively scalable service that can 
     * continuously capture gigabytes of data per second from hundreds of 
     * thousands of sources. Like many distributed systems, Kinesis Data 
     * Streams achieves this level of scalability by partitioning or sharding 
     * your data where records are simultaneously written to and read from 
     * different shards in parallel. All Kinesis Data Streams require allocation 
     * of at least one shard and you choose how many shards you want to allocate 
     * to a given stream.
     * 
     * When writing to a shard in a Kinesis Data Stream, each shard supports 
     * ingestion of up to 1 MB of data per second or 1,000 records written per 
     * second. When reading from a shard, each shard supports output of 2 MB of 
     * data per second. You choose an initial number of shards to allocate for 
     * your Kinesis Data Stream, then can update your shard allocation over time. 
     * Increasing your shard allocation enables your application to easily scale 
     * from thousands of records to millions of records written per second.
     */
    const receiveStream = new Stream(this, 'stream-process-receive', {
      streamName: 'stream-process-receive',
      encryption: StreamEncryption.KMS,
      encryptionKey: kmsKey,
      shardCount: 1,
    });

    const bucket = new Bucket(this, 'stream-process-bucket', {
      bucketName: 'stream-process-data',
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryptionKey: kmsKey,
    });

    const lambda = new NodejsFunction(this, 'stream-process-lambda', {
      functionName: 'stream-processor',
      entry: join(__dirname, 'lambda-fns/index.ts'),
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });
    const processor = new LambdaFunctionProcessor(lambda, {
      bufferInterval: Duration.minutes(1),
      bufferSize: Size.mebibytes(3),
      retries: 5,
    });
    const s3Dest = new S3Bucket(bucket, {
      processor: processor,
      encryptionKey: kmsKey,
    });
    new DeliveryStream(this, 'stream-process-delivery', {
      deliveryStreamName: 'stream-process-delivery',
      destinations: [s3Dest],
      sourceStream: receiveStream,
    });

    const athenaQueryBucket = new Bucket(this, 'athena-query', {
      bucketName: 'athena-query-process-data',
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryptionKey: kmsKey,
    });

    const crawlerRole = new Role(this, 'crawler-role', {
      roleName: 'crawler-role',
      assumedBy: new ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
      ],
    });
    crawlerRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: ['*'],
        actions: ['glue:GetSecurityConfiguration'],
      })
    );

    const glueDb = new Database(this, 'glue-db', {
      databaseName: 'glue-db',
    });

    const glueSecurityOptions = new SecurityConfiguration(this, 'glue-security-options', {
      securityConfigurationName: 'glue-security-options',
      s3Encryption: {
        mode: S3EncryptionMode.KMS,
      },
      cloudWatchEncryption: {
        mode: CloudWatchEncryptionMode.KMS,
      },
    });

    const crawler = new CfnCrawler(this, 'crawler', {
      name: 'crawler-stream-processor',
      role: crawlerRole.roleArn,
      databaseName: glueDb.databaseName,
      schemaChangePolicy: {
        deleteBehavior: 'DELETE_FROM_DATABASE',
      },
      targets: {
        s3Targets: [
          {
            path: bucket.bucketName, //`s3://${bucket.bucketName}`,
          }
        ],
      },
      crawlerSecurityConfiguration: glueSecurityOptions.securityConfigurationName,
    });

    const glueCrawlerArn = `arn:aws:glue:${Stack.of(this).region}:${Stack.of(this).account}:crawler/${crawler.name}`
    const glueCrawlerLogArn = `arn:aws:logs:${Stack.of(this).region}:${Stack.of(this).account}:log-group:/aws-glue/crawlers:log-stream:${crawler.name}`

    crawlerRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: [
          glueDb.databaseArn,
          glueDb.catalogArn,
          glueCrawlerArn,
          glueCrawlerLogArn,
          bucket.bucketArn,
          `${bucket.bucketArn}/*`,
        ],
        actions: [
          'logs:*',
          'logs:AssociateKmsKey',
          'glue:*',
          's3:*',
          'kms:Decrypt',
        ]
      }),
    );

    new CfnWorkGroup(this, 'analitycs-athena', {
      name: 'stream-athena-workgroup',
      workGroupConfiguration: {
        resultConfiguration: {
          outputLocation: `s3://${athenaQueryBucket.bucketName}`,
          encryptionConfiguration: {
            encryptionOption: 'SSE_KMS',
            kmsKey: kmsKey.keyArn,
          },
        },
      },
    });
  }
}

// https://dev.to/aws-builders/example-how-to-analyze-dynamodb-item-changes-with-kinesis-and-athena-created-with-cdk-1o6p
// https://github.com/JohannesKonings/test-aws-dynamodb-athena-cdk


// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new MyStack(app, 'stream-process-example-dev', { env: devEnv });
// new MyStack(app, 'stream-process-example-prod', { env: prodEnv });

app.synth();