var addon = require('../native');

export { done };

console.log(addon.hello());

function done() {
  console.log("JS: done called");
}

var e = new addon.TestEmitter(function (cmd: string) {
  console.log("JS: in callback, cmd=", cmd);
  if (cmd == 'number') {
    return 12;
  }
  else if (cmd == 'done') {
    // release the underlying EventHandler
    console.log("JS: shuting down test emitter");
    e.shutdown();
    setTimeout(done);
  }
  else {
    console.log("invalid command");
  }
});
e.start();
console.log("JS: exiting");
