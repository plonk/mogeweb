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

var eastasianwidth = eaw; //require('eastasianwidth');
//var {ScreenBuffer, GraphicAttrs, Cell} = require('./screenBuffer');
//var {objectSlice, objectBecomeMerged, inspect} = require('./util');

function Receiver(columns, rows, callbacks) {
  if (columns <= 0) throw RangeError('columns');
  if (rows <= 0) throw RangeError('rows');
  this.columns = columns;
  this.rows = rows;
  this.callbacks = {
    write(data) {},
    resize(cols, rows) {},
    cursorKeyMode(mode) {},
    beep() {},
    loadCharacterSet() {},
    playSound() {},
    playSound2() {},
  };
  for (var name of Object.keys(this.callbacks)) {
    if (callbacks[name]) {
      this.callbacks[name] = callbacks[name];
    }
  }

  this.fullReset();
}

function defaultTabStops(columns) {
  var res = [];

  for (var i = 0; i < columns; i += 8) {
    res.push(i);
  }
  return res;
};

Receiver.prototype.fullReset = function () {
  this.resetBuffers();
  this.cursor_x = 0;
  this.cursor_y = 0;
  this.interpretFn = Receiver.prototype.fc_normal;
  this.graphicAttrs = new GraphicAttrs();
  this.title = '';
  this.isCursorVisible = true;
  this.lastGraphicCharacter = ' ';
  this.insertMode = false;
  this.savedState = null;
  this.alternateScreen = false;
  this.scrollingRegionTop = 0;
  this.scrollingRegionBottom = this.rows - 1;
  this.originModeRelative = false;
  this.autoWrap = true;
  this.resetTabStops();
  this.G0 = this.cs_noConversion;
  this.G1 = this.cs_noConversion;
  this.G2 = this.cs_noConversion;
  this.G3 = this.cs_noConversion;
  this.characterSet = 0;
  this.reverseScreenMode = false;
  this.printed = false;
  this.cursorBlink = true;
  this.smoothScrollMode = false;
};

Receiver.prototype.resetTabStops = function () {
  this.tabStops = defaultTabStops(this.columns);
};

Receiver.prototype.resetBuffers = function () {
  this.buffer = new ScreenBuffer(this.columns, this.rows);
  this.backBuffer = new ScreenBuffer(this.columns, this.rows);
};

Receiver.prototype.horizontalTabulationSet = function () {
  // console.log(`HTS ${this.cursor_x}`);

  if (this.tabStops.indexOf(this.cursor_x) === -1) {
    this.tabStops.push(this.cursor_x);
    this.tabStops.sort((a, b) => a - b);
  }
};

Receiver.prototype.tabulationClear = function (args_str) {
  var num = +(args_str || '0');

  if (num === 0) {
    var index = this.tabStops.indexOf(this.cursor_x);
    if (index !== -1) {
      this.tabStops.splice(index, 1);
    }
  } else if (num === 3) {
    this.tabStops = [];
  } else {
    console.log(`TBC unknown param ${args_str}`);
  }
};

Receiver.prototype.nextTabStop = function () {
  var next = this.tabStops.find((elt) => elt > this.cursor_x);
  if (next === undefined) {
    return this.columns - 1;
  } else {
    return next;
  }
};

Receiver.prototype.previousTabStop = function () {
  var tabStops = this.tabStops.slice();
  tabStops.reverse();
  var prev = tabStops.find((elt) => elt < this.cursor_x);
  if (prev === undefined) {
    return 0;
  } else {
    return prev;
  }
};

Receiver.prototype.cursorOffset = function () {
  return this.cursor_y * this.columns + this.cursor_x;
};

Receiver.prototype.advanceCursor = function () {
  if (this.cursor_x === this.columns) {
    if (this.cursor_y === this.scrollingRegionBottom) {
      this.lineFeed();
    } else {
      this.cursor_y += 1;
    }
    this.cursor_x = 0;
  } else {
    this.cursor_x += 1;
  }
};

// FIXME: マルチ幅文字
Receiver.prototype.backCursor = function () {
  if (this.cursor_x === 0) {
    ;
  } else {
    this.cursor_x -= 1;
  }
};

// scroll up one.
Receiver.prototype.lineFeed = function () {
  this.scrollUp(this.scrollingRegionTop, this.scrollingRegionBottom, 1);
};

Receiver.prototype.processControlCharacter = function (c) {
  if (c === '\x08') { // ^H
    this.backCursor();
  } else if (c === '\x0a' || // LF ^J
             c === '\x0c' || // FF ^L
             c === '\x0b') { // VT ^K
    if (this.cursor_y === this.scrollingRegionBottom) { // FIXME: スクロール領域の外はどう取り扱うの？
      this.lineFeed();
    } else {
      this.cursor_y += 1;
    }
  } else if (c === '\x0d') { // CR ^M
    this.cursor_x = 0;
  } else if (c === '\x09') { // Tab ^I
    this.tabStopForward(1);
  } else if (c === '\x07') { // BEL ^G
    this.callbacks.beep();
  } else if (c === '\x0e') { // SO ^N
    // Shift Out
    this.characterSet = 1;
  } else if (c === '\x0f') { // SI ^O
    // Shift In
    this.characterSet = 0;
  }
};

Receiver.prototype.fc_normal = function (c) {
  if (c === '\x1b') { // ESC ^[
    return this.fc_esc;
  } else if (isControl(c)) {
    this.processControlCharacter(c);
    return this.fc_normal;
  } else if (/^[\uFE00-\uFE0f]$/.exec(c)) { // surrogate pair
    console.log(this.cursor_y, this.cursor_x, this.cursorOffset());
    if (this.cursorOffset() !== 0) {
      var cell = this.buffer.getCellAtOffset(this.cursorOffset() - 1);
      cell.character += c;
    }
    return this.fc_normal;
  } else {
    // 文字の追加。
    this.addCharacter(c);
    return this.fc_normal;
  }
};

function wcwidth(c) {
  switch (eastasianwidth.eastAsianWidth(c)) {
  case 'Na':
  case 'N':
  case 'H':
    return 1;
  case 'A': // ambiguous;
    return 1;
  case 'W':
  case 'F':
    return 2;
  default:
    console.log(`wcwidth ${c}`);
    return 1;
  }
}

// カーソルを進めずに印字する。
Receiver.prototype.printCharacter = function (c) {
  var cell = this.buffer.getCellAtOffset(this.cursorOffset());
  cell.attrs = this.graphicAttrs.clone();
  cell.character = this.applyCurrentCharacterSet(c);
  this.printed = true;
};

Receiver.prototype.addCharacter = function (c) {
  this.lastGraphicCharacter = c;
  switch (wcwidth(c)) {
  case 1:
    if (this.insertMode) {
      this.insertBlankCharacters('1');
    }
    if (this.cursor_x === this.columns) {
      if (this.autoWrap) {
        this.advanceCursor();
        this.printCharacter(c);
        this.advanceCursor();
      } else {
        this.printCharacter(c);
      }
    } else {
      this.printCharacter(c);
      this.advanceCursor();
    }
    break;
  case 2:
    if (this.insertMode) {
      this.insertBlankCharacters('2');
    }
    if (this.cursor_x === this.columns - 1) {
      if (this.autoWrap) {
        this.advanceCursor();
      }
    }
    this.buffer.getCellAtOffset(this.cursorOffset()).attrs = this.graphicAttrs.clone();
    this.buffer.getCellAtOffset(this.cursorOffset()).character = c;
    this.buffer.getCellAtOffset(this.cursorOffset() + 1).attrs = this.graphicAttrs.clone();
    this.buffer.getCellAtOffset(this.cursorOffset() + 1).character = '';
    this.advanceCursor();
    this.advanceCursor();
    break;
  default:
    console.log(`length ${c}`)
    break;
  }
};

Receiver.prototype.repeatLastCharacter = function (args_str) {
  var num = +(args_str || '1'); // デフォルト値不明

  for (var i = 0; i < num ; i++)
    this.addCharacter(this.lastGraphicCharacter);
};

Receiver.prototype.scrollBack = function (n) {
  var offset = this.buffer.getScrollBackOffset();
  this.buffer.setScrollBackOffset(offset + n);
};

// 画面のクリア。カーソル位置はそのまま。
Receiver.prototype.clear = function (from, to) {
  // XXX: 文字属性のコピーは？
  for (var i = from; i < to; i++) {
    this.buffer.setCellAtOffset(i, new Cell());
  }
};

Receiver.prototype.fc_controlSequenceIntroduced = function (c) {
  var args = '';
  function parsingControlSequence(c) {
    if (isControl(c)) {
      this.processControlCharacter(c);
      return this.interpretFn;
    } else if (/^[\x40-\x7e]$/.exec(c)) {
      this.dispatchCommand(c, args);
      return this.fc_normal;
    } else if (/^[\x30-\x3f\x20-\x2f]$/.exec(c)) { // parameter or intermediate
      args += c;
      return parsingControlSequence;
    } else {
      console.log(`unexpected character ${c}`);
      return this.fc_normal;
    }
  }
  return parsingControlSequence.call(this, c);
};

Receiver.prototype.cursorPosition = function (args_str) {
  // console.log('CUP', args_str);
  var args = args_str.split(/;/);
  var y = (args[0] || '1') - 1;
  var x = (args[1] || '1') - 1;

  if (this.originModeRelative) {
    this.cursor_y = y + this.scrollingRegionTop;
    this.cursor_x = x;
  } else {
    this.cursor_y = y;
    this.cursor_x = x;
  }
};

Receiver.prototype.eraseDisplay = function (args_str) {
  switch (args_str || '0') {
  case '0':
    this.buffer.clearToEnd(this.cursor_y, this.cursor_x, this.graphicAttrs);
    break;
  case '1':
    // カーソル位置を含む
    this.buffer.clearFromBeginning(this.cursor_y, this.cursor_x, this.graphicAttrs);
    break;
  case '2':
    this.buffer.clearAll(this.graphicAttrs);
    break;
  case '3': // xterm; erase saved lines
    console.log('erase saved lines');
    break;
  default:
    console.log(`Error: ED ${args_str}`);
    break;
  }
};

Receiver.prototype.getDefaultTextColor = function () {
  return this.reverseScreenMode ? 0 : 7;
};

Receiver.prototype.getDefaultBackgroundColor = function () {
  return this.reverseScreenMode ? 7 : 0;
};

Receiver.prototype.sgr_defaultTextColor = function () {
  this.graphicAttrs.textColor = null;
};

Receiver.prototype.sgr_defaultBackgroundColor = function () {
  this.graphicAttrs.backgroundColor = null;
};

Receiver.prototype.sgr_reverseVideo = function () {
  this.graphicAttrs.reverseVideo = true;
};

Receiver.prototype.selectGraphicRendition = function (args_str) {
  var args = args_str.split(/;/).map(num_str => (num_str === '') ? 0 : +num_str);
  var i = 0;

  while (i < args.length) {
    var arg = args[i];
    if (arg === 0) {
      this.graphicAttrs.reset();
      i++;
    } else if (arg === 1) {
      this.graphicAttrs.bold = true;
      i++;
    } else if (arg === 2) { // faint
      this.graphicAttrs.faint = true;
      i++;
    } else if (arg === 3) { // italic
      this.graphicAttrs.italic = true;
      i++;
    } else if (arg === 4) { // underline
      this.graphicAttrs.underline = true;
      i++;
    } else if (arg === 5) { // blink slow
      this.graphicAttrs.blink = true;
      i++;
    } else if (arg === 6) { // blink rapid
      this.graphicAttrs.fastBlink = true;
      i++;
    } else if (arg === 7) {
      this.sgr_reverseVideo();
      i++;
    } else if (arg === 8) { // conceal
      this.graphicAttrs.conceal = true;
      i++;
    } else if (arg === 9) { // crossed out
      this.graphicAttrs.crossedOut = true;
      i++;
    } else if (arg >= 10 && arg <= 19) {
      // Unimplemented
      // this.setFont(arg - 10);
      console.log(`unsupported SGR arg ${args[i]}`);
      i++;
    } else if (arg === 20) { // fraktur
      this.graphicAttrs.fraktur = true;
      i++;
    } else if (arg === 21) { // bold off (or underline double)
      this.graphicAttrs.bold = false;
      i++;
    } else if (arg === 22) { // normal color/intensity
      this.graphicAttrs.faint = false;
      i++;
    } else if (arg === 23) { // neither italic nor fraktur
      this.graphicAttrs.italic = false;
      this.graphicAttrs.fractur = false;
      i++;
    } else if (arg === 24) { // underline: none
      this.graphicAttrs.underline = false;
      i++;
    } else if (arg === 25) { // blink: off
      this.graphicAttrs.blink = false;
      this.graphicAttrs.fastBlink = false;
      i++;
    } else if (arg === 27) { // image: positive
      this.graphicAttrs.reverseVideo = false;
      i++;
    } else if (arg === 28) { // reveal
      this.graphicAttrs.conceal = false;
      i++;
    } else if (arg === 29) { // not crossed out
      this.graphicAttrs.crossedOut = false;
      i++;
    } else if (arg >= 30 && arg <= 37) {
      this.graphicAttrs.textColor = arg - 30;
      i++;
    } else if (arg === 38) { // extended set foreground
      i++;
      if (args[i] === 5) {
        i++;
        this.graphicAttrs.textColor = args[i];
        i++;
      } else if (args[i] === 2) {
        // TODO: サニティチェックしよう。
        this.graphicAttrs.textColorRGB = [+args[i+1], +args[i+2], +args[i+3]];
        i += 4;
      } else {
        console.log(`unsupported SGR arg ${args[i]}`);
        return;
      }
    } else if (arg === 39) {
      this.sgr_defaultTextColor();
      i++;
    } else if (arg >= 40 && arg <= 47) {
      this.graphicAttrs.backgroundColor = arg - 40;
      i++;
    } else if (arg === 48) {
      i++;
      if (args[i] === 5) {
        i++;
        this.graphicAttrs.backgroundColor = args[i];
        i++;
      } else if (args[i] === 2) {
        // TODO: サニティチェックしよう。
        this.graphicAttrs.backgroundColorRGB = [+args[i+1], +args[i+2], +args[i+3]];
        i += 4;
      } else {
        console.log("Unsupported SGR 48 spec.");
        return;
      }
    } else if (arg === 49) {
      this.sgr_defaultBackgroundColor();
      i++;
    } else if (arg >= 90 && arg <= 97) {
      this.graphicAttrs.textColor = arg - 82;
      i++;
    } else if (arg >= 100 && arg <= 107) {
      this.graphicAttrs.backgroundColor = arg - 92;
      i++;
    } else {
      console.log(`unknown SGR arg ${args[i]}`);
      return;
    }
  }
};

Receiver.prototype.cursorForward = function (args_str) {
  var num = +(args_str || '1');
  if (num === 0) num = 1;

  this.cursor_x = Math.min(this.cursor_x + num, this.columns - 1);
};

Receiver.prototype.cursorBackward = function (args_str) {
  var num = +(args_str || '1');
  if (num === 0) num = 1;

  this.cursor_x = Math.max(this.cursor_x - num, 0);
};

Receiver.prototype.cursorDown = function (args_str) {
  var num = +(args_str || '1');
  if (num === 0) num = 1;

  this.cursor_y = Math.min(this.cursor_y + num, this.scrollingRegionBottom);
};

Receiver.prototype.cursorUp = function (args_str) {
  var num = +(args_str || '1');
  if (num === 0) num = 1;

  this.cursor_y = Math.max(this.cursor_y - num, this.scrollingRegionTop);
};

Receiver.prototype.eraseInLine = function (args_str) {
  var num = +args_str;
  switch (num) {
  case 0: // to the end
    for (var i = this.cursor_x; i < this.columns; i++) {
      this.buffer.setCellAt(this.cursor_y, i,
                           new Cell({attrs: this.graphicAttrs}));
    }
    break;
  case 1: // from the beginning
    // カーソル位置の文字も消す
    for (var i = 0; i <= this.cursor_x; i++) {
      this.buffer.setCellAt(this.cursor_y, i,
                           new Cell({attrs: this.graphicAttrs}));
    }
    break;
  case 2: // entire line
    for (var i = 0; i < this.columns; i++) {
      this.buffer.setCellAt(this.cursor_y, i,
                           new Cell({attrs: this.graphicAttrs}));
    }
    break;
  default:
    console.log(`EL ${args_str}`);
    break;
  }
};

Receiver.prototype.deviceStatusReport = function (args_str) {
  var num = +args_str;

  switch (num) {
  case 5: // Status Report
    this.callbacks.write('\x1b[0n');
    break;
  case 6: // Report Cursor Position;
    var y = this.cursor_y + 1;
    var x = this.cursor_x + 1;
    this.callbacks.write(`\x1b[${y};${x}R`);
    break;
  default:
    console.error(`unknown argument to DSR ${args_str}`);
    break;
  }
};

Receiver.prototype.cursorToLine = function (args_str) {
  var num = +(args_str || '1');

  this.cursor_y = num - 1;
};

Receiver.prototype.deleteCharacters = function (args_str) {
  var num = +(args_str || '1');

  num = Math.min(num, this.columns - this.cursor_x);

  for (var i = 0; i < this.columns - this.cursor_x - num; i++) {
    this.buffer.setCellAt(this.cursor_y, this.cursor_x + i,
                          this.buffer.getCellAt(this.cursor_y, this.cursor_x + i + num));
  }
  for (var offset = (this.cursor_y + 1) * this.columns - num;
       offset < (this.cursor_y + 1) * this.columns;
       offset++) {
    this.buffer.setCellAtOffset(offset, new Cell({attrs: this.graphicAttrs})); // 文字属性要る？
  }
};

Receiver.prototype.eraseCharacters = function (args_str) {
  var num = +(args_str || '1');

  num = Math.min(num, this.columns - this.cursor_x);

  for (var i = 0; i < num; i++) {
    this.buffer.setCellAt(this.cursor_y, this.cursor_x + i,
                          new Cell({attrs: this.graphicAttrs}));
  }
};

Receiver.prototype.cursorHorizontalAbsolute = function (args_str) {
  var num = +(args_str || '1');
  if (num === 0)
    num = 1;

  this.cursor_x = num - 1;
};

Receiver.prototype.tabStopForward = function (args) {
  var num = +args;

  this.cursor_x = this.nextTabStop();
  // this.cursor_x = Math.min(this.columns - 1, (Math.floor(this.cursor_x / 8) + num) * 8);
};

Receiver.prototype.tabStopBackward = function (args) {
  var num = +args;

  this.cursor_x = Math.max(0, (Math.floor(this.cursor_x / 8) - num) * 8);
};

// 現在の行のカーソル位置に空白文字を指定の個数だけ挿入する。カーソル
// より右の内容は右にずらされる。
Receiver.prototype.insertBlankCharacters = function (args_str) {
  var num = +args_str;

  // line[cursor_x] から line[columns - 1 - num] までを
  // line[cursor_x + num] から line[columns - 1] までにコピーする。
  // i は 行の先頭からのオフセット位置。
  for (var i = this.columns - 1 - num; i >= this.cursor_x; i--) {
    this.buffer.setCellAt(this.cursor_y, i + num,
                          this.buffer.getCellAt(this.cursor_y, i));
  }

  // line[cursor_x] から line[cursor_x + num - 1] までを空白にする。
  for (var j = 0; j < num; j++) {
    this.buffer.setCellAt(this.cursor_y, this.cursor_x + j, new Cell());
  }
};

Receiver.prototype.scrollDown = function (y1, y2, nlines) {
  this.buffer.scrollDown(y1, y2, nlines, this.graphicAttrs);
};

Receiver.prototype.scrollUp = function (y1, y2, nlines) {
  this.buffer.scrollUp(y1, y2, nlines, this.graphicAttrs);
};

Receiver.prototype.insertLines = function (args_str) {
  if (this.cursor_y < this.scrollingRegionTop ||
    this.cursor_y > this.scrollingRegionBottom) {
    console.log(`IL cursor outside scrolling region`);
    return;
  }

  var num = +(args_str || '1');
  num = Math.min(this.scrollingRegionBottom - this.cursor_y + 1, num);

  this.scrollDown(this.cursor_y, this.scrollingRegionBottom, num);
};

Receiver.prototype.deleteLines = function (args_str) {
  if (this.cursor_y < this.scrollingRegionTop ||
    this.cursor_y > this.scrollingRegionBottom) {
    console.log(`DL cursor outside scrolling region`);
    return;
  }

  var num = +(args_str || '1');
  num = Math.min(this.scrollingRegionBottom - this.cursor_y + 1, num);

  this.scrollUp(this.cursor_y, this.scrollingRegionBottom, num);
};

Receiver.prototype.setMode = function (args_str) {
  var num = +args_str;

  switch (num) {
  case 4:
    this.insertMode = true;
    break;
  case 2:
  case 12:
  case 20:
    console.log(`setMode: unimplemented mode ${args_str}`);
  default:
    console.log(`setMode: unknown mode ${args_str}`);
  }
};

Receiver.prototype.resetMode = function (args_str) {
  var num = +args_str;

  switch (num) {
  case 4:
    this.insertMode = false;
    break;
  case 2:
  case 12:
  case 20:
    console.log(`resetMode: unimplemented mode ${args_str}`);
  default:
    console.log(`resetMode: unknown mode ${args_str}`);
  }
};

Receiver.prototype.sendPrimaryDeviceAttributes = function (args_str) {
  var num = +(args_str || '0');

  if (num === 0) {
    // this.callbacks.write('\x1b[?1;2c'); // rxvt
    // this.callbacks.write('\x1b[?64;1;2;6;9;15;18;21;22c'); // xterm
    this.callbacks.write('\x1b[?64;1;4;9;22c');
  } else {
    console.log(`send primary device attributes ${args_str}`);
  }
};

Receiver.prototype.sendSecondaryDeviceAttributes = function (args_str) {
  var num = +(args_str || '0');

  if (num === 0) {
    // this.callbacks.write('\x1b[>85;95;0c'); // rxvt
    this.callbacks.write('\x1b[>41;318;0c'); // XTerm(318)
  } else {
    console.log(`send secondary device attributes ${args_str}`);
  }
};

Receiver.prototype.sendTertiaryDeviceAttributes = function (args_str) {
  if (args_str !== '' && args_str !== '0') {
    console.log(`unknown argument (${args_str}) to DA3`);
    return;
  }

  // DCS ! | FF 01 02 03 ST
  // site FF, ID 123
  this.callbacks.write('\x1bP!|FF010203\x1b\\');
};

Receiver.prototype.useAlternateScreenBuffer = function () {
  if (this.alternateScreen)
    return;

  var tmp = this.buffer;
  this.buffer = this.backBuffer;
  this.backBuffer = tmp;
  this.alternateScreen = true;
};

Receiver.prototype.useNormalScreenBuffer = function () {
  if (!this.alternateScreen)
    return;

  var tmp = this.buffer;
  this.buffer = this.backBuffer;
  this.backBuffer = tmp;
  this.alternateScreen = false;
};

// DECCOLM用。
Receiver.prototype.setScreenSizeAndReset = function (columns, rows) {
  this.columns = columns;
  this.rows = rows;

  // リバース画面の設定はリセットしたくない。
  var aspects = objectSlice(this, ['reverseScreenMode']);
  this.fullReset();
  objectBecomeMerged(this, aspects);
  this.callbacks.resize(columns, rows);
};

Receiver.prototype.setScreenSize = function (columns, rows) {
  // スクリーンバッファーをリサイズする。
  //
  // 高さを大きくする場合：
  //
  //   スクロールバックバッファーからひっぱりだしてくる。
  //
  //   バッファーで足りなかったら空行を追加する。
  //
  // 高さを小さくする場合：
  //
  //   カーソルより下の行を削除する。
  //
  //   カーソルの行とそれより上の行は、スクロールバックバッファーに入れ
  //   る。
  if (rows > this.rows) {
    var addedLines = this.buffer.increaseRows(rows);
    this.backBuffer.increaseRows(rows);
    this.cursor_y += rows - this.rows - addedLines;
  } else if (rows < this.rows) {
    var linesBelow = this.rows - this.cursor_y - 1;
    this.buffer.decreaseRows(rows, linesBelow);
    this.backBuffer.decreaseRows(rows, linesBelow);
  }
  this.buffer.columns = columns;
  this.backBuffer.columns = columns;

  this.columns = columns;
  this.rows = rows;

  this.scrollingRegionTop = 0;
  this.scrollingRegionBottom = this.rows - 1;

  this.cursor_x = Math.min(this.cursor_x, this.columns - 1);
  this.cursor_y = Math.min(this.cursor_y, this.rows - 1);

  // タブストップのリセット。
  this.resetTabStops();

  this.callbacks.resize(columns, rows);
};

Receiver.prototype.doPrivateModeSet = function (num) {
  switch (num) {
  case 1:
    console.log('application cursor keys');
    this.callbacks.cursorKeyMode('application');
    break;
  case 3:
    this.setScreenSizeAndReset(132, 24);
    break;
  case 4:
    this.smoothScrollMode = true;
    console.log('smooth scroll mode');
    break;
  case 5:
    this.reverseScreenMode = true;
    console.log('reverse screen mode');
    break;
  case 6:
    this.originModeRelative = true;
    this.goToHomePosition();
    break;
  case 7:
    this.autoWrap = true;
    break;
  case 8:
    console.log('auto-repeat keys');
    break;
  case 12:
    // xtermのドキュメントはsetで点滅とあるが、実際の実装は逆なのでそ
    // れに従う。
    this.cursorBlink = false;
    break;
  case 25:
    this.isCursorVisible = true;
    break;
  case 40:
    console.log('allow 80 <-> 132 mode');
    break;
  case 45:
    console.log('reverse-wraparound mode (unimplemented)');
    break;
  case 47:
    this.useAlternateScreenBuffer();
    break;
  case 1049:
    this.saveCursor();
    this.useAlternateScreenBuffer();
    this.buffer.clearAll(this.graphicAttrs);
    break;
  default:
    console.log(`CSI ? ${num} h`);
  }
};

function parseParametersDefaultingToZero(args_str) {
  return args_str.split(/;/).map(field => {
    if (field === "") {
      return 0;
    } else {
      return +field;
    }
  });
}

Receiver.prototype.privateModeSet = function (args_str) {
  for (var num of parseParametersDefaultingToZero(args_str)) {
    this.doPrivateModeSet(num);
  }
};

Receiver.prototype.doPrivateModeReset = function (num) {
  switch (num) {
  case 1:
    console.log('normal cursor keys');
    this.callbacks.cursorKeyMode('normal');
    break;
  case 3:
    this.setScreenSizeAndReset(80, 24);
    break;
  case 4:
    this.smoothScrollMode = false;
    console.log('jump scroll mode');
    break;
  case 5:
    this.reverseScreenMode = false;
    console.log('normal screen mode');
    break;
  case 6:
    this.originModeRelative = false;
    this.goToHomePosition();
  case 7:
    this.autoWrap = false;
    break;
  case 8:
    console.log('no auto-repeat keys (unimplemented)');
    break;
  case 12:
    // xtermのドキュメントはresetで点滅停止とあるが、実際の実装は逆な
    // のでそれに従う。
    this.cursorBlink = true;
    break;
  case 25:
    this.isCursorVisible = false;
    break;
  case 40:
    console.log('disallow 80 <-> 132 mode (unimplemented)');
    break;
  case 45:
    console.log('no reverse-wraparound mode');
    break;
  case 47:
    this.useNormalScreenBuffer();
    break;
  case 1049:
    this.useNormalScreenBuffer();
    this.restoreCursor();
    break;
  default:
    console.log(`CSI ? ${num} l`);
  }
};

Receiver.prototype.privateModeReset = function (args_str) {
  for (var num of parseParametersDefaultingToZero(args_str)) {
    this.doPrivateModeReset(num);
  }
};

Receiver.prototype.dispatchCommandQuestion = function (letter, args_str) {
  switch (letter) {
  case 'l':
    this.privateModeReset(args_str);
    break;
  case 'h':
    this.privateModeSet(args_str);
    break;
  default:
    console.log(`unknown ? command letter ${letter} args ${args_str}`);
  }
  return this.fc_normal;
};

Receiver.prototype.dispatchCommandEquals = function (letter, args_str) {
  switch (letter) {
  case 'c':
    this.sendTertiaryDeviceAttributes(args_str);
    break;
  default:
    console.log(`unknown command CSI = ${args_str}`);
    break;
  }
};

Receiver.prototype.changeModifyKeysResource = function (args_str) {
  var args = args_str.split(/;/);
  var resourceNames = ['modifyKeyboard', 'modifyCursorKeys', 'modifyFunctionKeys', undefined, 'modifyOtherKeys'];
  switch (args.length) {
  case 1:
    switch(args[0]) {
    case '0': case '1': case '2': case '4':
      console.debug(`${resourceNames[args[0]]} to initial value`);
      break;
    default:
      console.error(`unable to interpret: CSI > ${args_str} m`);
    }
    break;
  case 2:
    switch(args[0]) {
    case '0': case '1': case '2': case '4':
      console.debug(`${resourceNames[args[0]]} to ${args[1]}`);
      break;
    default:
      console.error(`unable to interpret: CSI > ${args_str} m`);
    }
    break;
  default:
    console.error(`unable to interpret: CSI > ${args_str} m`);
    return;
  }
};

Receiver.prototype.dispatchCommandGreater = function (letter, args_str) {
  switch (letter) {
  case 'c':
    this.sendSecondaryDeviceAttributes();
    break;
  case 'm':
    this.changeModifyKeysResource(args_str);
    break;
  default:
    console.log(`unknown > command letter ${letter} args ${args_str}`);
  }
  return this.fc_normal;
};

Receiver.prototype.goToHomePosition = function () {
  this.cursor_x = 0;

  if (this.originModeRelative) {
    this.cursor_y = this.scrollingRegionTop;
  } else {
    this.cursor_y = 0;
  }
};

Receiver.prototype.setTopBottomMargins = function (args_str) {
  if (args_str === '')
    args_str = '1;' + this.rows;

  var args = args_str.split(/;/).map((elt) => +elt);
  var top = args[0];
  var bottom = args[1];

  if (top >= bottom ||
     top < 1 ||
     bottom > this.rows) {
    console.log(`DECSTBM invalid range ${args_str}`);
    return;
  }

  this.scrollingRegionTop = top - 1;
  this.scrollingRegionBottom = bottom - 1;

  this.goToHomePosition();
};

Receiver.prototype.cmd_scrollUp = function (args_str) {
  var num = +(args_str || '1');
  if (num === 0)
    num = 1;

  this.scrollUp(this.scrollingRegionTop, this.scrollingRegionBottom, num);
};

Receiver.prototype.cmd_scrollDown = function (args_str) {
  var num = +(args_str || '1');
  if (num === 0)
    num = 1;

  this.scrollDown(this.scrollingRegionTop, this.scrollingRegionBottom, num);
};

Receiver.prototype.dispatchTilde = function (args_str) {
  var intermediate = args_str[args_str.length - 1]
  if (intermediate === ",") {
    // play sound
    var [p1, p2, p3] = args_str.slice(0, args_str.length-1).split(/;/);
    this.callbacks.playSound(+p1, +p2, +p3);
  } else if (intermediate === "-") {
    // YOTEPS
    var [p1, p2, p3] = args_str.slice(0, args_str.length-1).split(/;/);
    this.callbacks.playSound2(+p1, +p2, +p3);
  } else {
    console.log(`unknown intermediate character ${intermediate}. final = '~'`);
  }
};

// After CSI.
 Receiver.prototype.dispatchCommand = function (letter, args_str) {
  if (args_str[0] === '?') {
    this.dispatchCommandQuestion(letter, args_str.slice(1));
    return this.fc_normal;
  } else if (args_str[0] === '>') {
    this.dispatchCommandGreater(letter, args_str.slice(1));
    return this.fc_normal;
  } else if (args_str[0] === '=') {
    this.dispatchCommandEquals(letter, args_str.slice(1));
    return this.fc_normal;
  }

  switch (letter) {
  case 'G':
    this.cursorHorizontalAbsolute(args_str);
    break;
  case 'H':
  case 'f':
    this.cursorPosition(args_str);
    break;
  case 'I':
    this.tabStopForward(args_str);
    break;
  case 'Z':
    this.tabStopBackward(args_str);
    break;
  case 'J':
    this.eraseDisplay(args_str);
    break;
  case 'm':
    this.selectGraphicRendition(args_str);
    break;
  case 'K':
    this.eraseInLine(args_str);
    break;
  case 'A':
    this.cursorUp(args_str);
    break;
  case 'B':
    this.cursorDown(args_str);
    break;
  case 'C':
    this.cursorForward(args_str);
    break;
  case 'D':
    this.cursorBackward(args_str);
    break;
  case 'P':
    this.deleteCharacters(args_str);
    break;
  case 'X':
    this.eraseCharacters(args_str);
    break;
  case 'd':
    this.cursorToLine(args_str);
    break;
  case 'n':
    this.deviceStatusReport(args_str);
    break;
  case '@':
    this.insertBlankCharacters(args_str);
    break;
  case 'L':
    this.insertLines(args_str);
    break;
  case 'M':
    this.deleteLines(args_str);
    break;
  case 'b':
    this.repeatLastCharacter(args_str);
    break;
  case 'h':
    this.setMode(args_str);
    break;
  case 'l':
    this.resetMode(args_str);
    break;
  case 'c':
    this.sendPrimaryDeviceAttributes(args_str);
    break;
  case 'r':
    this.setTopBottomMargins(args_str);
    break;
  case 'g':
    this.tabulationClear(args_str);
    break;
  case 'S':
    this.cmd_scrollUp(args_str);
    break;
  case 'T':
    this.cmd_scrollDown(args_str);
    break;
  case '~':
    this.dispatchTilde(args_str);
    break;
  default:
    console.log(`unknown command letter ${letter} args ${args_str}`);
  }
  return this.fc_normal;
};

Receiver.prototype.operatingSystemCommand = function (arg_str) {
  // FIXME: OSコマンドにセミコロンを含めることができないと思われる。
  var args = arg_str.split(/;/);

  if (args[0] === '0') { // set title bar
    this.title = String(args[1]);
  } else if (args[0] === '11') {
    this.callbacks.write(`\x1b]11;rgb:0000/0000/0000\x1b\\`);
  } else if (args[0] === '12') {
    this.callbacks.write(`\x1b]12;rgb:e5e5/e5e5/e5e5\x1b\\`);
  } else {
    console.log(`unknown OSC ${arg_str}`);
  }
};

Receiver.prototype.fc_startOperatingSystemCommand = function (c) {
  var args = '';
  function parsingOperatingSystemCommand(c) {
    // String Terminator に対応していない。
    if (c === '\x07') { // BEL
      this.operatingSystemCommand(args);
      return this.fc_normal;
    } else if (c === '\x1b') {
      return function (d) {
        if (d === '\\') {
          this.operatingSystemCommand(args);
          return this.fc_normal;
        } else {
          args += '\x1b' + d;
          return parsingOperatingSystemCommand;
        }
      };
    } else {
      args += c;
      return parsingOperatingSystemCommand;
    }
  }
  return parsingOperatingSystemCommand.call(this, c);
};

Receiver.prototype.saveCursor = function () {
  this.savedState = {
    cursor_x: this.cursor_x,
    cursor_y: this.cursor_y,
    graphicAttrs: this.graphicAttrs.clone(),
    charcterSet: this.characterSet,
    G0: this.G0,
    G1: this.G1,
    G2: this.G2,
    G3: this.G3,
    originModeRelative: this.originModeRelative,
  };
};

Receiver.prototype.restoreCursor = function () {
  if (this.savedState === null) {
    this.goToHomePosition();
  } else {
    for (var key of Object.keys(this.savedState)) {
      this[key] = this.savedState[key];
    }
  }
};

Receiver.prototype.isInScrollingRegion = function () {
  return this.cursor_y >= this.scrollingRegionTop &&
    this.cursor_y <= this.scrollingRegionTop;
};

Receiver.prototype.index = function () {
  if (this.isInScrollingRegion()) {
    if (this.cursor_y === this.scrollingRegionBottom) {
      this.scrollUp(this.scrollingRegionTop, this.scrollingRegionBottom, 1);
    } else {
      this.cursor_y += 1;
    }
  } else if (this.cursor_y !== this.rows - 1) {
    this.cursor_y += 1;
  }
};

// スクロール領域の外ではスクロールを起こさない。
Receiver.prototype.reverseIndex = function () {
  if (this.isInScrollingRegion()) {
    if (this.cursor_y === this.scrollingRegionTop) {
      this.scrollDown(this.scrollingRegionTop, this.scrollingRegionBottom, 1);
    } else {
      this.cursor_y -= 1;
    }
  } else if (this.cursor_y !== 0) {
    this.cursor_y -= 1;
  }
};

Receiver.prototype.screenAlignmentDisplay = function () {
  for (var y = 0; y < this.buffer.rows; y++) {
    for (var x = 0; x < this.buffer.columns; x++) {
      this.buffer.setCellAt(y, x, new Cell());
    }
  }
};

Receiver.prototype.dispatchCommandNumber = function (c) {
  if (isControl(c)) {
    this.processControlCharacter(c);
    return this.interpretFn;
  }

  switch (c) {
  case '3': // Top Half
    this.buffer.getLine(this.cursor_y).setType('top-half');
    break;
  case '4': // Bottom Half
    this.buffer.getLine(this.cursor_y).setType('bottom-half');
    break;
  case '5': // Single-Width Line
    this.buffer.getLine(this.cursor_y).setType('normal');
    break;
  case '6': // Double-Width Line
    this.buffer.getLine(this.cursor_y).setType('double-width');
    break;
  case '8':
    this.screenAlignmentDisplay();
    break;
  default:
    console.log(`unknown ESC # ${c}`);
  }
  return this.fc_normal;
};

Receiver.prototype.characterSetFunction = function (c) {
  switch (c) {
  case 'A': // UK
    return this.cs_British;
  case 'B': // US
    return this.cs_noConversion;
  case '0':
    return this.cs_lineDrawing;
  case '1': // alternate ROM
    return this.cs_noConversion;
  case '2': // alternate ROM special characters
    return this.cs_noConversion;
  default:
    console.log(`unknown character designation ${c}`);
    return this.cs_noConversion;
  }
};

Receiver.prototype.fc_designateCharacterSetG0 = function (c) {
  this.G0 = this.characterSetFunction(c);
  return this.fc_normal;
};

Receiver.prototype.fc_designateCharacterSetG1 = function (c) {
  this.G1 = this.characterSetFunction(c);
  return this.fc_normal;
};

Receiver.prototype.fc_designateCharacterSetG2 = function (c) {
  this.G2 = this.characterSetFunction(c);
  return this.fc_normal;
};

Receiver.prototype.fc_designateCharacterSetG3 = function (c) {
  this.G3 = this.characterSetFunction(c);
  return this.fc_normal;
};

Receiver.prototype.fc_singleShift2 = function (c) {
  this.addCharacter(this.G2(c));
  return this.fc_normal;
};

Receiver.prototype.fc_singleShift3 = function (c) {
  this.addCharacter(this.G3(c));
  return this.fc_normal;
};

Receiver.prototype.dispatchDeviceControlString = function (args_str) {
  var match;

  if (args_str === '$q"p') {
    this.callbacks.write('\x1bP1$r64;1"p\e\\');
  } else if ((match = /^([\x30-\x3f]*)([\x20-\x2f]*)([\x40-\x7e])/.exec(args_str)) !== null) {
    var [_, parameterBytes, intermediateBytes, finalByte] = match;
    if (finalByte === '{') {
      // DECDLD

      var str = args_str.slice(match[0].length);
      var dscs = str.slice(0,2);
      var font = str.slice(2);
      this.callbacks.loadCharacterSet(parameterBytes, dscs, font);
    } else {
      console.log('got DCS', inspect(args_str));
    }
  } else {
    console.log('got DCS', inspect(args_str));
  }
};

Receiver.prototype.fc_deviceControlString = function (c) {
  var args = '';
  function iter(c) {
    if (c === '\x1b') {
      return function (d) {
        if (d === '\\') {
          this.dispatchDeviceControlString(args);
          return this.fc_normal;
        } else {
          args += '\x1b' + d;
          return iter;
        }
      };
    } else {
      args += c;
      return iter;
    }
  }
  return iter.call(this, c);
};

Receiver.prototype.fc_esc = function (c) {
  if (isControl(c)) {
    this.processControlCharacter(c);
    return this.interpretFn;
  } else if (c === '[') {
    return this.fc_controlSequenceIntroduced;
  } else if (c === ']') {
    return this.fc_startOperatingSystemCommand;
  } else if (c === '7') {
    this.saveCursor();
    return this.fc_normal;
  } else if (c === '8') {
    this.restoreCursor();
    return this.fc_normal;
  } else if (c === '=') {
    console.log('application keypad mode');
    return this.fc_normal;
  } else if (c === '>') {
    console.log('normal keypad mode');
    return this.fc_normal;
  } else if (c === 'c') {
    this.fullReset();
    return this.fc_normal;
  } else if (c === 'M') {
    this.reverseIndex();
    return this.fc_normal;
  } else if (c === '#') {
    return this.dispatchCommandNumber;
  } else if (c === 'E') {
    this.cursor_x = 0;
    this.index();
    return this.fc_normal;
  } else if (c === 'D') {
    this.index();
    return this.fc_normal;
  } else if (c === 'H') {
    this.horizontalTabulationSet();
    return this.fc_normal;
  } else if (c === '(') {
    return this.fc_designateCharacterSetG0;
  } else if (c === ')') {
    return this.fc_designateCharacterSetG1;
  } else if (c === '*') {
    return this.fc_designateCharacterSetG2;
  } else if (c === '+') {
    return this.fc_designateCharacterSetG3;
  } else if (c === 'N') {
    // Single Shift 2
    return this.fc_singleShift2;
  } else if (c === 'O') {
    // Single Shift 3
    return this.fc_singleShift3;
  } else if (c === 'P') { // Device Control String
    return this.fc_deviceControlString;
  } else {
    console.log(`got ${c} while expecting [`);
    return this.fc_normal;
  }
};

Receiver.prototype.cs_noConversion = function (c) {
  return c;
};

Receiver.prototype.cs_British = function (c) {
  if (c === '#') {
    return '£';
  } else {
    return c;
  }
};

Receiver.prototype.applyCurrentCharacterSet = function (c) {
  if (this.characterSet === 0) {
    return this.G0(c);
  } else if (this.characterSet === 1) {
    return this.G1(c);
  } else {
    console.log('corrupt state');
    return c;
  }
};

Receiver.prototype.cs_lineDrawing = function (c) {
  var specialCharacters = ['◆','▒','␉','␌','␍','␊','°','±','␤','␋','┘','┐','┌','└','┼','⎺','⎻','─','⎼','⎽','├','┤','┴','┬','│','≤','≥','π','≠','£','·'];
  var index = '`abcdefghijklmnopqrstuvwxyz{|}~'.indexOf(c);

  if (index === -1) {
    return c;
  } else {
    return specialCharacters[index];
  }
};

function isControl(c) {
  //return isTrue(/^[\x00-\x1f\x7f]$/.exec(c));
  var cp = c.codePointAt(0);
  return (cp >= 0 && cp <= 0x1f) || cp == 0x7f;
}

function isTrue(value) {
  return !!value;
}

Receiver.prototype.feedCharacter = function (character) {
  this.interpretFn = this.interpretFn(character);
  this.printed = false;
};

Receiver.prototype.feed = function (data) {
  // フラグのリセット
  this.buffer.resetFlags();
  this.backBuffer.resetFlags();

  if (this.buffer.getScrollBackOffset() !== 0) {
    this.buffer.setScrollBackOffset(0);
  }
  if (this.backBuffer.getScrollBackOffset() !== 0) {
    this.backBuffer.setScrollBackOffset(0);
  }

  var oldCursorY = this.cursor_y;
  var oldCursorX = this.cursor_x;

  for (var char of data) {
    this.feedCharacter(char);
  }
};

// module.exports = {
//   Receiver: Receiver
// };
