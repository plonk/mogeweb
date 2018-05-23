if (process.argv.length < 4) {
  console.log("Usage: nodejs index.js PORT COMMAND [ARGS...]");
  process.exit();
}

const port = +process.argv[2];
const command = process.argv[3];
const args = process.argv.slice(4);
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: port });
var pty = require('pty.js');

console.log('Server started on port ' + port)

wss.on('connection', function connection(ws) {
  var term = pty.spawn(command, args, {
    name: 'xterm',
    cols: 80,
    rows: 24,
    env: process.env
  });

  term.on('data', function(data) {
    try {
      ws.send(JSON.stringify({"type":"data", "data":data}));
    } catch (e) {
      console.log(e);
    }
  });

  term.on('close', function() {
    console.log('term closed');
    ws.close();
  });

  ws.on('message', function incoming(str) {
    var message = JSON.parse(str);
    switch (message["type"]) {
    case "data":
      term.write(message["data"]);
      break;
    case "pong":
      pongWaiting = false;
      break;
    default:
      console.log("unknown message type");
    }
  });

  ws.on('close', function () {
    term.socket.destroy();
    console.log('close end');
  });

  ws.on('error', console.error);

  var pongWaiting = false;
  var job = setInterval(function () {
    if (pongWaiting) {
      console.log("client failed to pong");
      term.socket.destroy();
      clearInterval(job);
    } else {
      try {
        ws.send(JSON.stringify({"type":"ping"}));
      } catch (e) {
        console.log(e);
      }
      pongWaiting = true;
    }
  }, 10*1000);
});
