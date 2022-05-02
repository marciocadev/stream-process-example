from http import client
from unicodedata import name
import boto3
import random
from datetime import datetime
import time
import calendar
import json

kinesis = boto3.client('kinesis')
stream_name = 'stream-process-receive'
class groceries:
  def __init__(self, name, value):
    self.name = name
    self.value = value

itemList = []
itemList.append(groceries('biscoito', 5))
itemList.append(groceries('leite', 30))
itemList.append(groceries('sorvete', 25))

for x in range(0, 10000):
  # clientId varia de 0 a 50
  clientId = random.randrange(0,50)
  itemNum = random.randrange(0,3)
  property_timestamp = calendar.timegm(datetime.utcnow().timetuple())

  payload = {
    'timestamp': str(property_timestamp),
    'clientId': clientId,
    'name': itemList[itemNum].name,
    'value': itemList[itemNum].value,
  }

  response = kinesis.put_record(
    StreamName=stream_name,
    Data=json.dumps(payload),
    PartitionKey=str(property_timestamp)
  )

  response

  print(response)

  time.sleep(1)