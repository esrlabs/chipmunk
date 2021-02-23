const tmp = require('tmp');
const fs = require('fs');
// const HUGE_FILE = "/Users/muellero/tmp/logviewer_usecases/indexing/access_huge.log";

let addon = require('../dist');
const assert = require('assert');

function createSampleFile(lines) {
  const tmpobj = tmp.fileSync();
  console.log(`Create example grabber file`);
  for (let i = 0; i < lines; i++) {
    fs.appendFileSync(tmpobj.name, `some line data: ${i}\n`);
  }
  var stats = fs.statSync(tmpobj.name);
  console.log(`file-size: ${stats.size}`);
  return tmpobj;
}

async function testSession() {
  let file_obj = createSampleFile(1000);
  let session = new addon.RustSession("my_id");
  console.log("session-id: " + session.id);
  session.start((event_string) => {
    // This is call back in thread
    console.log("JS:" + event_string);

    let event = JSON.parse(event_string);
    console.log("JS: event.OperationDone: " + event.OperationDone);
    if (event_string === '"SessionDestroyed"') {
      console.log("JS: we are done")
    } else if (event.OperationDone === assign_op_id) {
      let streamLen = session.getStreamLen();
      console.log(`JS: assign operation done, we can grab ${streamLen} lines content`);
      let content = JSON.parse(session.grab(10, 3));
      console.log(content);
      let content2 = JSON.parse(session.grab(500, 3));
      console.log(content2);
    }
  });
  // let assign_op_id = session.assign(HUGE_FILE, "src-id-42");
  let assign_op_id = session.assign(file_obj.name, "src-id-42");
  console.log("JS: started assign operation with op-id: " + assign_op_id);
  await new Promise(r => setTimeout(r, 2000));
  session.stop();
}

testSession();
// assert.equal(obj.value, 10, "verify value works");


