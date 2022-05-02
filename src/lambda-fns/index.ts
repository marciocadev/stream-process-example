
export const handler = async(event:any) => {
  console.log(event);

  const result = event.records.map((currentVal:any, idx:number, arr:any[]) => {
    try {
      const entry = Buffer.from(currentVal.data, 'base64').toString();
      const tmp = JSON.parse(entry);
      let data = Buffer.from(JSON.stringify(tmp)).toString('base64');
      // if (idx === 0) {
      //   let endLine = arr.length > 1 ? ',' : ']';
      //   data = Buffer.from('['.concat(JSON.stringify(tmp).concat(endLine))).toString('base64');
      // } else if (idx === arr.length - 1) {
      //   data = Buffer.from(JSON.stringify(tmp).concat(']')).toString('base64');
      // } else {
      //   data = Buffer.from(JSON.stringify(tmp).concat(',')).toString('base64');
      // }
      return {
        recordId: currentVal.recordId,
        result: 'Ok',
        data: data.concat('\n'),
      }
    } catch(error) {
      return {
        recordId: currentVal.recordId,
        result: 'ProcessingFailed',
        data: JSON.parse(Buffer.from(currentVal.data, 'base64').toString()),
      }
    }
  });

  return { records: result }
}