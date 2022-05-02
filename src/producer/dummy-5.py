import boto3
from datetime import datetime
import time
import calendar
import json

kinesis = boto3.client('kinesis')
stream_name = 'stream-process-receive'

for x in range(0, 1000):
    data = '5 seconds'
    property_timestamp = calendar.timegm(datetime.utcnow().timetuple())

    payload = {
        'timestamp': str(property_timestamp),
        'data': data
    }

    response = kinesis.put_record(
        StreamName=stream_name,
        Data=json.dumps(payload),
        PartitionKey=str(property_timestamp)
    )

    response

    print(response)

    time.sleep(5)