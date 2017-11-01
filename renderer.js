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

var COLORS = [
  "rgb(0,0,0)",
  "rgb(194,54,33)",
  "rgb(37,188,36)",
  "rgb(173,173,39)",
  "rgb(73,46,225)",
  "rgb(211,56,211)",
  "rgb(51,187,200)",
  "rgb(203,204,205)",
  "rgb(129,131,131)",
  "rgb(252,57,31)",
  "rgb(49,231,34)",
  "rgb(234,236,35)",
  "rgb(88,51,255)",
  "rgb(249,53,248)",
  "rgb(20,240,240)",
  "rgb(233,235,235)",
];

for (var r = 0; r <= 5; r++)
  for (var g = 0; g <= 5; g++)
    for (var b = 0; b <= 5; b++)
      COLORS.push("rgb(" +
                  Math.round(r*255/5) + "," +
                  Math.round(g*255/5) + "," +
                  Math.round(b*255/5) + ")");

for (var i = 0; i < 24; i++) {
  var intensity = 8 + i*10;
  COLORS.push("rgb(" + intensity + "," + intensity + "," + intensity + ")");
}

console.log(COLORS);

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

function randomColor()
{
    var str = '#';
    for (var i = 0; i < 3; i++) {
        str += Math.floor(8 + Math.random() * 8).toString(16);
    }
    return str;
}

var getTextHeight = function(font) {
  var text = $('<span>Hg</span>').css({ 'font': font });
  var block = $('<div style="display: inline-block; width: 1px; height: 0px;"></div>');

  var div = $('<div></div>');
  div.append(text, block);

  var body = $('body');
  body.append(div);

  try {

    var result = {};

    block.css({ verticalAlign: 'baseline' });
    result.ascent = block.offset().top - text.offset().top;

    block.css({ verticalAlign: 'bottom' });
    result.height = block.offset().top - text.offset().top;

    result.descent = result.height - result.ascent;

  } finally {
    div.remove();
  }

  return result;
};

function renderScreen(ctx, halfWidthInPixels, doubleWidthInPixels, fontHeightMetrics) {
  // if (receiver.reverseScreenMode) {}

  var fontHeight = fontHeightMetrics.height;
  var fontAscent = fontHeightMetrics.ascent;
  var yoffset = Math.round((fontHeight - fontAscent)/2);

  function renderRow(y) {
    ctx.save();
    switch (receiver.buffer.getLine(y).getType()) {
    case 'double-width':
      ctx.scale(2,1);
      break;
    case 'top-half':
      ctx.beginPath();
      ctx.rect(0, y*fontHeight, halfWidthInPixels*receiver.columns, fontHeight);
      ctx.clip();
      ctx.translate(0, -y*fontHeight);
      ctx.scale(2,2);
      break;
    case 'bottom-half':
      ctx.beginPath();
      ctx.rect(0, y*fontHeight, halfWidthInPixels*receiver.columns, fontHeight);
      ctx.clip();
      ctx.translate(0, -y*fontHeight);
      ctx.scale(2,2);

      ctx.translate(0, -fontHeight/2);
      break;
    }

    for (var x  = 0; x < receiver.columns; x++) {
      var cell = receiver.buffer.getCellAt(y, x);
      var char = cell.character;
      var cursor = (y === receiver.cursor_y &&
                    x === receiver.cursor_x &&
                    receiver.isCursorVisible &&
                    receiver.buffer.getScrollBackOffset() === 0);
      var width = wcwidth(char);

      // 何も描画しなくていいセルだったらスキップ。

      if (cursor) {
        if (window_focused) {
          ctx.fillStyle = 'magenta';
          ctx.fillRect(x * halfWidthInPixels, y * fontHeight,
                       halfWidthInPixels * width, fontHeight);
        } else {
          ctx.fillStyle = 'magenta';
          var strokeWidth = 2;
          ctx.fillRect(x * halfWidthInPixels, y * fontHeight, // top
                       halfWidthInPixels * width, strokeWidth);
          ctx.fillRect(x * halfWidthInPixels, y * fontHeight, // left
                       strokeWidth, fontHeight);
          ctx.fillRect(x * halfWidthInPixels, (y+1) * fontHeight - strokeWidth, // bottom
                       halfWidthInPixels * width, strokeWidth);
          ctx.fillRect((x+1) * halfWidthInPixels - strokeWidth, y * fontHeight,
                       strokeWidth, fontHeight);
        }
      } else {
        if (cell.attrs.backgroundColor) {
          ctx.fillStyle = COLORS[cell.attrs.backgroundColor];
          ctx.fillRect(x * halfWidthInPixels, y * fontHeight,
                       halfWidthInPixels * width, fontHeight);
        }
      }

      if (char !== "" && char !== " ") {
        var fg;
        if (cell.attrs.textColor !== null)
          fg = cell.attrs.textColor;
        else
          fg = receiver.getDefaultTextColor();
        if (cell.attrs.bold)
          fg += 8;
        ctx.fillStyle = COLORS[fg];

        var xoffset = (width == 1) ? 0 : Math.floor(Math.max(0,halfWidthInPixels*2 - doubleWidthInPixels)/2);
        var maxWidth = width*halfWidthInPixels;
        if (cell.attrs.bold) {
          ctx.fillText(char, xoffset + x*halfWidthInPixels + 0.5, yoffset + y * fontHeight, maxWidth);
        }
        ctx.fillText(char, xoffset + x*halfWidthInPixels, yoffset + y * fontHeight, maxWidth);
        ctx.fillText(char, xoffset + x*halfWidthInPixels, yoffset + y * fontHeight, maxWidth);
      }

      if (width == 2)
        x++;
    }

    ctx.restore();
  }

  ctx.clearRect(0, 0, halfWidthInPixels * receiver.columns, fontHeight * receiver.rows);

  for (var y = 0; y < receiver.rows; y++) {
    renderRow(y);
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

var windowNeedsResizing = false;
var beepAudio = new Audio('beep.wav');
var ignoreResizeEventOnce = false;

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
  //renderScreen();
  $('#inputModal').modal('hide');
}

function paste() {
  transmitter.paste(clipboard.readText());
  //renderScreen();
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
  //renderScreen();
}

var receiver;
var transmitter;
var websocket;
var window_focused = true;
var force_redraw = false;

function setup()
{
  window.onbeforeunload = function (e) {
    // 最近のブラウザでは、ここで設定した文字列は表示されない。
    e.returnValue = "閉じますか？";
    return "閉じますか？";
  };

  if (websocket)
    websocket.close();
  websocket = new WebSocket($WEB_SOCKET_URL);
  websocket.binaryType = 'arraybuffer';
  var term = {};
  term.write = function (str) {
    websocket.send(str);
  };
  transmitter = new Transmitter(term);
  var inBuffer = [];
  var utf8decoder;
  websocket.onmessage = function (event) {
    var t0 = performance.now();
    receiver.feed(event.data);
    // console.log([performance.now() - t0, event.data.length]);
    force_redraw = true;
    // inBuffer.push(event.data);
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

  var fontSpec = '20px Courier New';
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  ctx.font = fontSpec;
  var letterWidthInPixels = ctx.measureText("m").width;
  var kanjiWidthInPixels = ctx.measureText("漢").width;
  var fontHeight = getTextHeight(ctx.font);
  var frame = 0;

  $('#canvas')[0].width = letterWidthInPixels * 80;
  $('#canvas')[0].height = fontHeight.height * 24;

  ctx.font = fontSpec;
  ctx.textBaseline = "top";
  var render = function() {
    if (frame % 1 == 0) {
      if (force_redraw) {
        force_redraw = false;
        renderScreen(ctx, letterWidthInPixels, kanjiWidthInPixels, fontHeight);
      }
    }
    frame++;
    window.requestAnimationFrame(render)
  };
  window.requestAnimationFrame(render);
}

window.onload = () => {
  var ctrlJustPressed = false;
  var stickyCtrl = false;
  var ctrlLock = false;

  function switchStickyCtrl(flag) {
    if (flag) {
      $('#indicator-sticky').show();
      $('#indicator-no-sticky').hide();
      stickyCtrl = true;
    } else {
      $('#indicator-sticky').hide();
      $('#indicator-no-sticky').show();
      stickyCtrl = false;
    }
  }

  function switchCtrlLock(flag) {
    if (flag) {
      $('#indicator-lock').show();
      $('#indicator-no-lock').hide();
      ctrlLock = true;
    } else {
      $('#indicator-lock').hide();
      $('#indicator-no-lock').show();
      ctrlLock = false;
    }
  }

  $(document).keyup((e) => {
    if (e.key === "Control" && ctrlJustPressed) {
      if (ctrlLock) {
        switchCtrlLock(false);
      } else if (!stickyCtrl) {
        switchStickyCtrl(true);
      } else {
        switchCtrlLock(true);
        switchStickyCtrl(false);
      }
      ctrlJustPressed = false;
    }
  });

  $(document).keydown((e) => {
    if (e.key === "Control") {
        ctrlJustPressed = true;
      return;
    } else {
      ctrlJustPressed = false;
    }

    if (e.key === 'F12') // デベロッパーツールズ
      return;

    if (!modalShown) {
      e.preventDefault();

      var scrollAmount = receiver.rows;
      if (e.key === 'PageUp' && e.shiftKey) {
        receiver.scrollBack(scrollAmount);
        //renderScreen();
      } else if (e.key === 'PageDown' && e.shiftKey){
        receiver.scrollBack(-scrollAmount);
        //renderScreen();
      } else {
        if (transmitter) {
          if (stickyCtrl) {
            e.ctrlKey = true;
            switchStickyCtrl(false);
          }
          if (ctrlLock) {
            e.ctrlKey = true;
          }
          transmitter.typeIn(e);
        }
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

  //renderScreen();
  // fitWindow();

  window.onblur = function (e) {
    window_focused = false;
    force_redraw = true;
  };

  window.onfocus = function (e) {
    window_focused = true;
    force_redraw = true;
  };
};
