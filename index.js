/*
  This file is part of Mogeweb.

  Mogeweb is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 2 of the License, or
  (at your option) any later version.

  Mogeweb is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with Mogeweb.  If not, see <https://www.gnu.org/licenses/>.
*/

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
