const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8888 });

var pty = require('pty.js');

console.log('Server started on port 8888')

wss.on('connection', function connection(ws) {
  //var term = pty.spawn('ruby', ["welcome.rb"], {
  var term = pty.spawn('bash', [], {
    name: 'xterm',
    cols: 80,
    rows: 24,
    env: process.env
  });

  term.on('data', function(data) {
    try {
      ws.send(data);
    } catch (e) {
      console.log(e);
    }
  });

  term.on('close', function() {
    console.log('term closed');
    ws.close();
  });

  ws.on('message', function incoming(message) {
    term.write(message);
  });

  ws.on('close', function () {
    term.socket.destroy();
    console.log('close end');
  });
});
