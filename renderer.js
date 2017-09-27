'use strict';

// var pty = require('pty');
// var {ipcRenderer, remote, clipboard} = require('electron')
// var {Receiver}    = require('./receiver')
// var {Transmitter} = require('./transmitter');
// var {orElse, ord, chr, escapeHtml, padLeft, setUnion} = require('./util');

function toFraktur (char) {
  if (char.length !== 1)
    return char;

  var fraktur = ['𝔄', '𝔅', 'ℭ', '𝔇', '𝔈', '𝔉', '𝔊', 'ℌ', 'ℑ', '𝔍', '𝔎', '𝔏', '𝔐', '𝔑', '𝔒', '𝔓', '𝔔', 'ℜ', '𝔖', '𝔗', '𝔘', '𝔙', '𝔚', '𝔛', '𝔜', 'ℨ',
                 '𝔞', '𝔟', '𝔠', '𝔡', '𝔢', '𝔣', '𝔤', '𝔥', '𝔦', '𝔧', '𝔨', '𝔩', '𝔪', '𝔫', '𝔬', '𝔭', '𝔮', '𝔯', '𝔰', '𝔱', '𝔲', '𝔳', '𝔴', '𝔵', '𝔶', '𝔷'];
  var normal = "ABCDEFGHIJKLMNOPQRSTUVWXYZ" + "abcdefghijklmnopqrstuvwxyz";
  var index = normal.indexOf(char);

  if (index === -1) {
    return char;
  } else {
    return fraktur[index];
  }
}

function createBgStartTag(color) {
  return `<span class="background-color-${color}">`;
}

function createFgStartTag(attrs) {
  var classes = '';

  if (attrs.bold)       classes += ' bold';
  if (attrs.italic)     classes += ' italic';
  if (attrs.blink)      classes += ' blink';
  if (attrs.fastBlink)  classes += ' fast-blink';
  if (attrs.crossedOut) classes += ' crossed-out';
  if (attrs.underline)  classes += ' underline';
  if (attrs.faint)      classes += ' faint';
  if (attrs.conceal)    classes += ' conceal';

  var fg = orElse(attrs.textColor, receiver.getDefaultTextColor());
  var bg = orElse(attrs.backgroundColor, receiver.getDefaultBackgroundColor());

  if (attrs.bold)
    fg += 8;

  if (attrs.reverseVideo) {
    classes += ` text-color-${bg}`;
  } else {
    classes += ` text-color-${fg}`;
  }

  return `<span class="${classes}">`;
}

// emojione が U+FE0E と U+FE0F を逆に解釈するので入れ替える。
function swapVariantSelectors(str) {
  return str.replace(/[\uFE0E\uFE0F]/, c => (c == '\uFE0E') ? '\uFE0F' : '\uFE0E');
}

function cursorClass(receiver) {
  var klass = 'cursor';
  if (receiver.reverseScreenMode)
    klass += '-reverse';
  if (receiver.cursorBlink)
    klass += '-blink';
  return klass;
}

function buildRowHtml(y) {
  var str = '';
  var bgColor = null;

  for (var x  = 0; x < receiver.columns; x++) {
    var cell = receiver.buffer.getCellAt(y, x);
    var char = cell.character;

    var newBgColor;
    if (cell.attrs.reverseVideo) {
      newBgColor = orElse(cell.attrs.textColor, receiver.getDefaultTextColor())
    } else {
      newBgColor = orElse(cell.attrs.backgroundColor, 'transparent');
    }

    if (bgColor !== newBgColor) {
      if (bgColor !== null) {
        str += "</span>";
      }
      bgColor = newBgColor;
      str += createBgStartTag(bgColor);
    }

    if (cell.attrs.fraktur) {
      char = toFraktur(char);
    }

    var cursor = (y === receiver.cursor_y &&
                  x === receiver.cursor_x &&
                  receiver.isCursorVisible &&
                  receiver.buffer.getScrollBackOffset() === 0);

    str += createFgStartTag(cell.attrs, cursor);
    if (cursor) {
      var klass = cursorClass(receiver);
      str += `<span class="${klass}">`;
    }
    str += emojione.unicodeToImage(escapeHtml(swapVariantSelectors(char)));
    if (cursor)
      str += '</span>';
    str += '</span>';
  }
  str += '</span>';
  return str;
}

function renderRow(y) {
  var row = $(`#row-${y} > div`);

  row.html(buildRowHtml(y));
}

function formatPosition(y, x) {
  var str_y = padLeft(String(receiver.cursor_y + 1), 2, '0');
  var str_x = padLeft(String(receiver.cursor_x + 1), 3, '0');
  return `(${str_y},${str_x})`;
}

function setWindowTitle() {
  var title = document.querySelector('title');
  var alt = receiver.alternateScreen ? '[AltScr]' : '';
  var pos = formatPosition(receiver.cursor_y, receiver.cursor_x);
  var scrollBack = `${-receiver.buffer.getScrollBackOffset()}`;
  title.text = `matter ${alt} ${pos} ${scrollBack} - ${receiver.title}`;
}

function renderScreen() {
  $('#screen_outer').removeClass();
  if (receiver.reverseScreenMode) {
    $('#screen_outer').addClass(`background-color-7`);
  } else {
    $('#screen_outer').addClass(`background-color-0`);
  }

  $('#screen').html(buildScreenHtml());

  setWindowTitle();

  if (windowNeedsResizing) {
    fitWindow();
    windowNeedsResizing = false;
  }
}

function buildRowClasses(y) {
  var str = 'row-' + receiver.buffer.getLine(y).getType();
  if (y === receiver.scrollingRegionTop)
    str += ' row-scroll-region-top';
  if (y === receiver.scrollingRegionBottom)
    str += ' row-scroll-region-bottom';
  return str;
}

function buildScreenHtml() {
  var str = '';

  for (var y = 0; y < receiver.rows; y++) {
    str += `<div id="row-${y}" class="${buildRowClasses(y)}" style="white-space: pre"><div>`;
    str += buildRowHtml(y);
    str += '</div></div>';
  }

  return str;
}

// var commandLine = remote.getCurrentWindow().commandLine;

// var term = pty.spawn(commandLine[0], commandLine.slice(1), {
//   name: 'xterm',
//   cols: 80,
//   rows: 24,
//   cwd: process.cwd(),
//   env: process.env
// });

// term.on('data', function(data) {
//   var _data = Array.from(data);

//   if (!receiver.smoothScrollMode) {
//     receiver.feed(_data);
//     renderScreen();
//     return;
//   }

//   term.pause();
//   function iter(index) {
//     while (true) {
//       if (index === _data.length) {
//         renderScreen();
//         term.resume();
//         return;
//       } else {
//         var char = _data[index];

//         receiver.feed(char);
//         if (receiver.smoothScrollMode && receiver.buffer.scrollPerformed) {
//           setTimeout(() => {
//             // console.log(Date.now());
//             renderScreen();
//             iter(index + 1);
//           }, 0); // どの道、レンダリングに百数十ミリ秒かかるのでタイムアウトを設定しない。
//           return;
//         } else {
//           index += 1;
//         }
//       }
//     }
//   }
//   iter(0);
// });

// term.on('close', function () {
//   window.close();
// });

var windowNeedsResizing = false;
var beepAudio = new Audio('beep.wav');
var ignoreResizeEventOnce = false;

// var receiver = new Receiver(term.cols, term.rows, {
//   write: (data) => term.write(data),
//   resize: (cols, rows) => {
//     term.resize(cols, rows);
//     windowNeedsResizing = true;
//   },
//   cursorKeyMode: (mode) => {
//     transmitter.cursorKeyMode = mode;
//   },
//   beep: () => {
//     beepAudio.play();
//   }
// });

// function adjustWindowHeight() {
//   var height = $('#screen').height() + 25;

//   ipcRenderer.send('adjust-window-height', height);
// }

// function adjustWindowWidth() {
//   var minWidth = 1000;

//   $('#screen #row-0 div').each(function () {
//     minWidth = Math.min($(this).width(), minWidth);
//   });

//   ipcRenderer.send('adjust-window-width', minWidth);
// }
var modalShown = false;

function showInputModal() {
  $('#inputModal').modal('show');
}

function showAboutModal() {
  $('#aboutModal').modal('show');
}

function enterText() {
  var text = $('#text')[0].value;
  if (text === '') return;

  transmitter.paste(text);
  renderScreen();
  $('#inputModal').modal('hide');
}

function paste() {
  transmitter.paste(clipboard.readText());
  renderScreen();
}

function copy() {
  clipboard.writeText(clipboard.readText('selection'));
}

function changeFontSize(pixels) {
  $('#screen').css('font-size', `${pixels}px`);
  fitWindow();
}

// 現在のウィンドウの大きさを端末画面の大きさに合わせる。
function fitWindow() {
  $('#screen').css('width', `${receiver.columns}ch`);

  var width = $('#screen').outerWidth(true);
  var height = $('#screen').outerHeight(true) + 40 + 25;

  remote.getCurrentWindow().setSize(Math.floor(width), Math.floor(height));
  ignoreResizeEventOnce = true;
}

function fitScreen() {
  if (ignoreResizeEventOnce) {
    ignoreResizeEventOnce = false;
    return;
  }
  var [windowWidth, windowHeight] = remote.getCurrentWindow().getSize();

  // var screenWidth = width - 40;
  var charWidth = $('#screen').width() / receiver.columns;
  var nColumns = Math.round((windowWidth - 40) / charWidth);

  var lineHeight = parseFloat($('#screen').css('line-height').replace(/px/, ''));
  // console.log(lineHeight);
  var nRows = Math.ceil((windowHeight - 65) / lineHeight);

  receiver.setScreenSize(nColumns, nRows);
  renderScreen();
}

var receiver;
var transmitter;
var websocket;

function setup()
{
  if (websocket)
    websocket.close();
  websocket = new WebSocket('ws://localhost:8888/');
  websocket.binaryType = 'arraybuffer';
  var term = {};
  term.write = function (str) {
    websocket.send(str);
  };
  transmitter = new Transmitter(term);
  var utf8decoder;
  websocket.onmessage = function (event) {
    // var cary = Array.from(utf8decoder.decode(event.data, { stream: true }));
    // receiver.feed(cary);

    receiver.feed(Array.from(event.data));
    renderScreen();
  };

  websocket.onopen = function (event) {
    utf8decoder = new TextDecoder('utf-8');
    $('#indicator-online').show();
    $('#indicator-offline').hide();
  };

  websocket.onclose = function (event) {
    $('#indicator-online').hide();
    $('#indicator-offline').show();
  };
}

window.onload = () => {
  $(document).keydown((e) => {
    if (!modalShown) {
      e.preventDefault();

      var scrollAmount = receiver.rows;
      if (e.key === 'PageUp' && e.shiftKey) {
        receiver.scrollBack(scrollAmount);
        renderScreen();
      } else if (e.key === 'PageDown' && e.shiftKey){
        receiver.scrollBack(-scrollAmount);
        renderScreen();
      } else {
        if (transmitter)
          transmitter.typeIn(e);
      }
    }
  });

  $('#input-button').on('click', function () {
    showInputModal();
  });

  $('#connect-button').on('click', function () {
    setup();
  });

  $('#inputModal').on('shown.bs.modal', function () {
    modalShown = true;
    $('#text').focus().val('');
  });

  $('#inputModal').on('hidden.bs.modal', function () {
    modalShown = false;
  });

  $('#aboutModal').on('shown.bs.modal', function () {
    modalShown = true;
  });

  $('#aboutModal').on('hidden.bs.modal', function () {
    modalShown = false;
  });

  $('#version').html('0.0.2');

  // ------------------------------------------------------------

  receiver = new Receiver(80, 24, {
    cursorKeyMode: function (mode) {
      transmitter.cursorKeyMode = mode;
    },
  });
  setup();

  // ------------------------------------------------------------

  renderScreen();
  // fitWindow();
};
