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
// グレースケール。
for (var i = 0; i < 24; i++) {
  var intensity = 8 + i*10;
  COLORS.push("rgb(" + intensity + "," + intensity + "," + intensity + ")");
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

function getTextHeight(font) {
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
}

function setRowClipAndTransform(ctx, y, fontHeight, halfWidthInPixels, type) {
  switch (type) {
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
}

function colorStyles(attrs, defaultBackgroundColorIndex) {
  var bg;
  var fg;

  if (attrs.backgroundColorRGB) {
    var rgb = attrs.backgroundColorRGB;
    bg = "rgb("+rgb[0]+","+rgb[1]+","+rgb[2]+")";
  } else {
    bg = COLORS[attrs.backgroundColor !== null ? attrs.backgroundColor : defaultBackgroundColorIndex];
  }
  if (attrs.textColorRGB) {
    var rgb = attrs.textColorRGB;
    fg = "rgb("+rgb[0]+","+rgb[1]+","+rgb[2]+")";
  } else {
    var fgIndex = attrs.textColor !== null ? attrs.textColor : receiver.getDefaultTextColor();
    if (attrs.bold)
      fgIndex += 8;
    fg = COLORS[fgIndex];
  }

  if (attrs.reverseVideo) {
    return [bg, fg];
  } else {
    return [fg, bg];
  }
}

function renderScreenStatics(ctx, frame, halfWidth, doubleWidth, metrics) {
  var defaultBackgroundColorIndex = (receiver.reverseScreenMode) ? 7 : 0;
  var yoffset = Math.round((metrics.height - metrics.ascent)/2);

  function renderRow(y) {
    ctx.save();
    setRowClipAndTransform(ctx, y, metrics.height, halfWidth, receiver.buffer.getLine(y).getType());

    for (var x  = 0; x < receiver.columns; x++) {
      var cell = receiver.buffer.getCellAt(y, x);
      var char = cell.character;
      var attrs = cell.attrs;
      var width = wcwidth(char);
      var [fg, bg] = colorStyles(attrs, defaultBackgroundColorIndex);

      ctx.fillStyle = bg;
      ctx.fillRect(x * halfWidth, y * metrics.height,
                   halfWidth * width, metrics.height);

      if (!attrs.blink) {
        renderCharacter(ctx, x, y, cell, fg, halfWidth, doubleWidth, metrics);
      }

      if (width == 2)
        x++;
    }

    ctx.restore();
  }

  ctx.clearRect(0, 0, halfWidth * receiver.columns, metrics.height * receiver.rows);

  for (var y = 0; y < receiver.rows; y++) {
    renderRow(y);
  }
}

function isBlockElement(char) {
  return !!blockElementMatrix(char);
}

function blockElementMatrix(char) {
  if (char === "▖") return [0, 0, 1, 0];
  if (char === "▗") return [0, 0, 0, 1];
  if (char === "▘") return [1, 0, 0, 0];
  if (char === "▙") return [1, 0, 1, 1];
  if (char === "▚") return [1, 0, 0, 1];
  if (char === "▛") return [1, 1, 1, 0];
  if (char === "▜") return [1, 1, 0, 1];
  if (char === "▝") return [0, 1, 0, 0];
  if (char === "▞") return [0, 1, 1, 0];
  if (char === "▟") return [0, 1, 1, 1];
  if (char === "▌") return [1, 0, 1, 0];
  if (char === "▐") return [0, 1, 0, 1];
  if (char === "▄") return [0, 0, 1, 1];
  if (char === "▀") return [1, 1, 0, 0];
  if (char === "█") return [1, 1, 1, 1];
}

function isInPUA(c) {
  return (c.length === 2 &&
          c.codePointAt(0) >= 0x100000 &&
          c.codePointAt(0) <= 0x10FFFF);
}

function puaCharacterSet(c) {
  return String.fromCodePoint((c.codePointAt(0) >> 8) & 0xff);
}

function hasGlyph(charset, c) {
  return true;
}

function startingCodePoint(designation, charset) {
  var xx = designation.codePointAt(0);
  var yy = charset.start;

  return 0x100000 | (xx << 8) | yy;
}

function isSoftCharacter(char)  {
  if (isInPUA(char)) {
    var cs = softCharacterSets[puaCharacterSet(char)];
    if (cs) {
      if (hasGlyph(cs, char)) {
        return true;
      }
    }
  }
  return false;
}

var softCharacterSets = {};

function renderSoftCharacter(char, ctx, x, y, cell, fgStyle, halfWidth, doubleWidth, metrics) {
  var csName  = puaCharacterSet(char);
  var cs      = softCharacterSets[csName];
  var start   = startingCodePoint(csName, cs);
  var offset  = char.codePointAt(0) - start;

  if (cs.type === "pixmap") {
    var fonty   = Math.floor((offset * cs.fontWidth) / cs.canvas.width) * cs.fontHeight;
    var fontx   = (offset * cs.fontWidth) % cs.canvas.width;
    var fontctx = cs.canvas.getContext('2d');
    ctx.drawImage(cs.canvas, fontx, fonty, cs.fontWidth, cs.fontHeight,
                  x * halfWidth, y * metrics.height, halfWidth, metrics.height);
  } else if (cs.type === "bitmap") {
    // offset は「いくつ目の文字か」。
    var oy = Math.floor(offset / 16) * cs.fontHeight;
    var ox = (offset % 16) * cs.fontWidth;
    for (var yoff = 0; yoff < cs.fontHeight; yoff++) {
      for (var xoff = 0; xoff < cs.fontWidth; xoff++) {
        var bit = cs.array[(oy + yoff) * (cs.fontWidth*16) + (ox + xoff)];
        var xscale = halfWidth / cs.fontWidth;
        var yscale = metrics.height / cs.fontHeight;
        if (bit) {
          ctx.fillRect((x*halfWidth) + xoff*xscale, (y*metrics.height) + yoff*yscale,
                       1*xscale, 1*yscale);
        }
      }
    }
  } else {
    throw new Error("unknown font type: " + cs.type);
  }
}

function renderCharacter(ctx, x, y, cell, fgStyle, halfWidth, doubleWidth, metrics) {
  var char = cell.character;
  var width = wcwidth(char);

  ctx.fillStyle = fgStyle;

  if (width === 1 && isBlockElement(char)) {
    var [tl, tr, bl, br] = blockElementMatrix(char);
    var h1 = Math.ceil(metrics.height/2);
    var h2 = Math.floor(metrics.height - h1);
    if (tl)
      ctx.fillRect(x*halfWidth, y * metrics.height,
                   halfWidth/2, h1);
    if (tr)
      ctx.fillRect(x*halfWidth + halfWidth/2, y * metrics.height,
                   halfWidth/2, h1);
    if (bl)
      ctx.fillRect(x*halfWidth, y * metrics.height +h1,
                   halfWidth/2, h2);
    if (br)
      ctx.fillRect(x*halfWidth + halfWidth/2, y * metrics.height +h1,
                   halfWidth/2, h2);
  } else if (isSoftCharacter(char)) {
    renderSoftCharacter(char, ctx, x, y, cell, fgStyle, halfWidth, doubleWidth, metrics);
  } else if (char !== "" && char !== " ") { // その他の文字
    var xoffset = (width == 1) ? 0 : Math.floor(Math.max(0,halfWidth*2 - doubleWidth)/2);
    var maxWidth = width*halfWidth;
    if (cell.attrs.bold) {
      ctx.fillText(char, xoffset + x*halfWidth + 0.5, y * metrics.height + metrics.ascent, maxWidth);
    }
    for (var i = 0; i < 2; i++)
      ctx.fillText(char, xoffset + x*halfWidth, y * metrics.height + metrics.ascent, maxWidth);
  }

  if (cell.attrs.underline) {
    ctx.strokeStyle = fgStyle;
    var underLineY = y * metrics.height + metrics.height - Math.floor(metrics.descent/2) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x * halfWidth, underLineY)
    ctx.lineTo(x * halfWidth + width*halfWidth, underLineY);
    ctx.stroke();
  }
}

// t: [0, 1]
function blinkAlpha(t) {
  var a = 1 - t;
  return (a < 0.5) ? a * 2 : -2*a + 2
}

function cursorAlpha(t) {
  //return Math.abs(1 - t*2);
  return Math.abs(Math.cos(t * Math.PI));
}

function renderScreenDynamics(ctx, frame, lastStaticRedraw, halfWidth, doubleWidth, metrics, clearAll) {
  var defaultBackgroundColorIndex = (receiver.reverseScreenMode) ? 7 : 0;

  function renderRow(y) {
    ctx.save();
    setRowClipAndTransform(y, metrics.height, halfWidth, receiver.buffer.getLine(y).getType());

    for (var x  = 0; x < receiver.columns; x++) {
      var cell = receiver.buffer.getCellAt(y, x);
      var char = cell.character;
      var attrs = cell.attrs;
      var width = wcwidth(char);
      var cursor;

      if (receiver.isCursorVisible && receiver.buffer.getScrollBackOffset() === 0) {
          if (y === receiver.cursor_y && receiver.cursor_x === receiver.columns) {
            if (width === 1 && x === receiver.columns - 1) {
              cursor = true;
            } else if (width == 2 && x === receiver.columns - 2) {
              cursor = true;
            } else {
              cursor = false;
            }
          } else if (y === receiver.cursor_y && x === receiver.cursor_x) {
            cursor = true;
          } else {
            cursor = false;
          }
      } else {
        cursor = false;
      }
      var [fg, bg] = colorStyles(attrs, defaultBackgroundColorIndex);

      if (cursor) {
        ctx.clearRect(x*halfWidth, y*metrics.height, halfWidth*width, metrics.height);
        var t = ((frame - lastStaticRedraw) % 60)/59;
        ctx.save();
        ctx.globalAlpha = cursorAlpha(t);

        // カーソルの描画。
        if (window_focused) {
          ctx.fillStyle = 'magenta';
          ctx.fillRect(x * halfWidth, y * metrics.height,
                       halfWidth * width, metrics.height);
        } else {
          ctx.strokeStyle = 'magenta';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x * halfWidth + 1, y * metrics.height + 1);
          ctx.lineTo(x * halfWidth + (halfWidth * width) - 1, y * metrics.height + 1);
          ctx.lineTo(x * halfWidth + (halfWidth * width) - 1, (y+1) * metrics.height - 1);
          ctx.lineTo(x * halfWidth + 1, (y+1) * metrics.height - 1);
          ctx.closePath();
          ctx.stroke();
        }

        ctx.restore();
      }

      if (attrs.blink) {
        ctx.clearRect(x*halfWidth, y*metrics.height, halfWidth*width, metrics.height);
        ctx.save();
        ctx.globalAlpha = blinkAlpha((frame % 60)/59);
        //if (frame % 60 < 30)
          renderCharacter(ctx, x, y, cell, fg, halfWidth, doubleWidth, metrics);
        ctx.restore();
      } else if (cursor) {
          renderCharacter(ctx, x, y, cell, fg, halfWidth, doubleWidth, metrics);
      }

      if (width == 2)
        x++;
    }

    ctx.restore();
  }

  if (clearAll)
    ctx.clearRect(0, 0, halfWidth * receiver.columns, metrics.height * receiver.rows);

  for (var y = 0; y < receiver.rows; y++) {
    renderRow(y);
  }
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


var soundSystem = new SoundSystem2();
var soundBuffer = [];

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
    websocket.send(JSON.stringify({"type": "data", "data": str}));
  };
  transmitter = new Transmitter(term);
  var inBuffer = [];
  var utf8decoder;
  websocket.onmessage = function (event) {
    var message = JSON.parse(event.data);
    switch (message["type"]) {
    case "data":
      receiver.feed(message["data"]);
      force_redraw = true;
      break;
    case "ping":
      websocket.send(JSON.stringify({"type":"pong"}));
      break;
    default:
      console.log("unknown message type");
    }
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

  var fontSpec = '20px monospace';
  var ctx = document.getElementById('bottom-layer').getContext('2d');
      ctx.font = fontSpec;
  var ctx2 = document.getElementById('top-layer').getContext('2d');
  var letterWidthInPixels = Math.round(ctx.measureText("m").width);
  var kanjiWidthInPixels  = Math.round(ctx.measureText("漢").width);
  var fontHeight = getTextHeight(ctx.font);
  fontHeight.height = Math.round(fontHeight.height);
  //fontHeight.width = Math.round(fontHeight.width);
  console.log([letterWidthInPixels, fontHeight]);
  var frame = 0;
  var lastStaticRedraw = 0;

  $('#screen-outer').width(letterWidthInPixels * 80);
  $('#screen-outer').height(fontHeight.height * 24);
  $('#bottom-layer')[0].width = letterWidthInPixels * 80;
  $('#bottom-layer')[0].height = fontHeight.height * 24;
  $('#top-layer')[0].width = letterWidthInPixels * 80;
  $('#top-layer')[0].height = fontHeight.height * 24;

  // サイズ変更でキャンバスの状態が失われるので、フォントを設定しなお
  // す。
  ctx.font = fontSpec;
  //ctx.textBaseline = "top";
  ctx2.font = fontSpec;
  //ctx2.textBaseline = "top";

  var render = function() {
    if (soundBuffer.length > 0) {
      console.log("addnotes", soundBuffer);
      if (soundSystem.addNotes(soundBuffer)) {
        soundBuffer.length = 0;
      }
    }

    if (force_redraw) {
      renderScreenStatics(ctx, frame, letterWidthInPixels, kanjiWidthInPixels, fontHeight);
      lastStaticRedraw = frame;
      renderScreenDynamics(ctx2, frame, lastStaticRedraw, letterWidthInPixels, kanjiWidthInPixels, fontHeight, true);
      force_redraw = false;
    } else {
      renderScreenDynamics(ctx2, frame, lastStaticRedraw, letterWidthInPixels, kanjiWidthInPixels, fontHeight, false);
    }
    frame++;
    window.requestAnimationFrame(render)
  };
  window.requestAnimationFrame(render);
}

function renderBitmapFont(cs, font) {
  // PATTERN sixelgraphics.js

  var glyphCount = 0;
  for (var glyph of font.split(';')) {
    var lineCount = 0;
    for (var line of glyph.split('/')) {
      var chCount = 0;
      for (var ch of line) {
        for (var i = 0; i < 6; i++) {
          var y = Math.floor(glyphCount / 16) * cs.fontHeight + lineCount * 6 + i;
          var x = (glyphCount % 16) * cs.fontWidth + chCount;
          var index = y * (cs.fontWidth*16) + x;
          if (index < cs.array.length) {
            console.log(index, PATTERN[ch][i]);
            cs.array[index] = PATTERN[ch][i];
          }
        }
        chCount++;
      }
      lineCount++;
    }
    glyphCount++;
  }
  console.log(font);
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
        force_redraw = true;
      } else if (e.key === 'PageDown' && e.shiftKey){
        receiver.scrollBack(-scrollAmount);
        force_redraw = true;
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

  $('#connect-button').on('click', function (e) {
    setup();
    $(this).blur();
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
    loadCharacterSet: function(parameterBytes, dscs, font) {
      var [pfn, pcn, pe, pcmw, pss, pt, pcmh] = parameterBytes.split(/;/);
      var csName = dscs[1];
      var fontWidth = +pcmw;
      var fontHeight = +pcmh;

      if (pt === "3") {
        var canvas = renderSixelGraphics(font);
        softCharacterSets[csName] = { type: "pixmap",
                                      start: 0x20 + +pcn,
                                      fontWidth: fontWidth,
                                      fontHeight: fontHeight,
                                      canvas: canvas,
                                      nCharacters: (canvas.width / pcmw) * (canvas.height / pcmh) };
        console.log([ "loadCharacterSet", softCharacterSets[dscs[1]] ]);
      } else {
        if (softCharacterSets[csName] === undefined) {
          softCharacterSets[csName] = { type: "bitmap",
                                        start: 0x20 + +pcn,
                                        fontWidth: fontWidth,
                                        fontHeight: fontHeight,
                                        array: new Uint8Array(fontWidth * fontHeight * 96),
                                        nCharacters: 96 };
        }
        renderBitmapFont(softCharacterSets[csName], font);
      }
    },
    // DECPS
    playSound: function (volume, duration, note) {
      soundBuffer.push({volume: volume / 7 * 100, duration: duration * (1/32) * 1000, note: note + 2});
    },
    // YOTEPS
    playSound2: function (volume, duration, note) {
      soundBuffer.push({volume: volume, duration: duration, note: note});
    },
    beep: function() {
      // VMWare などの仮想環境でサウンドデバイスが音を出し始めるまで数
      // 十msかかるので、無音を挟む。
      soundBuffer.push({volume: 0, duration: 75, note: 0});

      // B6 10ms
      soundBuffer.push({volume: 100, duration: 10, note: 26});
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
