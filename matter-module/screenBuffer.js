'use strict';

//var {orElse} = require('./util');

// グラフィック属性。文字の修飾状態。
function GraphicAttrs() {
  // 色インデックスで指定するのはよくないな。
  this.reset();
}

const GraphicAttrs_FIELDS = ['textColor', 'backgroundColor', 'bold', 'italic', 'blink', 'fastBlink', 'fraktur', 'crossedOut', 'underline', 'faint', 'conceal', 'reverseVideo']

GraphicAttrs.prototype.reset = function () {
  this.textColor = null;
  this.backgroundColor = null;
  this.bold = false;
  this.italic = false;
  this.blink = false;
  this.fastBlink = false;
  this.fraktur = false;
  this.crossedOut = false;
  this.underline = false;
  this.faint = false;
  this.conceal = false;
  this.reverseVideo = false;
};

GraphicAttrs.prototype.clone = function () {
  var res = new GraphicAttrs();
  for (var attr of GraphicAttrs_FIELDS) {
    res[attr] = this[attr];
  }
  return res;
};

GraphicAttrs.prototype.equals = function (other) {
  for (var attr of GraphicAttrs_FIELDS) {
    if (this[attr] !== other[attr]) {
      return false;
    }
  }
  return true;
};

// 文字セル。
function Cell(proto) {
  if (!proto)
    proto = {};

  this.character = orElse(proto.character, ' ');
  this.broken = orElse(proto.broken, false);
  if (proto.attrs) {
    this.attrs = proto.attrs.clone();
  } else {
    this.attrs = new GraphicAttrs();
  }
}

Cell.prototype.clone = function () {
  var res = new Cell();
  res.character = this.character;
  res.broken = this.broken;
  res.attrs = this.attrs.clone();
  return res;
};

Cell.prototype.equals = function (other) {
  return this.character === other.character &&
    this.broken === other.broken &&
    this.attrs.equals(other.attrs);
};

function createArrayThus(length, fn) {
  var res = [];
  for (var i = 0; i < length; i++) {
    res.push(fn(i));
  }
  return res;
}


function Row(length) {
  this._type = 'normal';
  this.array = [];
}

const ROW_TYPES = ['normal', 'double-width', 'top-half', 'bottom-half'];

Row.prototype.setType = function (type) {
  if (!ROW_TYPES.includes(type)) throw RangeError('normal, double-width, top-half, bottom-half');

  this._type = type;
};

Row.prototype.getType = function () {
  return this._type;
}

Row.prototype.checkInRange = function (index) {
  if (!Number.isInteger(index))
    throw TypeError('not an integer');

  if (index < 0)
    throw RangeError('index');
};

Row.prototype.getCellAt = function (index) {
  this.checkInRange(index);

  if (this.array[index] === undefined)
    this.array[index] = new Cell();

  return this.array[index];
};

Row.prototype.setCellAt = function (index, cell) {
  this.checkInRange(index);

  this.array[index] = cell;
};

Row.prototype.clear = function (columns, attrs) {
  for (var i = 0; i < columns; i++) {
    this.array[i] = new Cell();
    this.array[i].attrs = attrs.clone();
  }
  this.setType('normal');
};

Row.prototype.toString = function () {
  var str = '';

  for (var i = 0; i < this.array.length; i++) {
    str += this.getCellAt(i).character;
  }

  return str.trimRight();
};

//var CBuffer = require('CBuffer');

// スクリーンバッファー。文字セルの二次元配列のようなもの。
function ScreenBuffer(columns, rows) {
  if (columns <= 0) throw RangeError('columns');
  if (rows <= 0) throw RangeError('rows');
  this.columns = columns;
  this.rows = rows;
  this._buffer = this.createBuffer(2000);
  this.scrollPerformed = false; // スクロール操作が実行されたかのフラグ。
  this._scrollBackOffset = 0;
}

ScreenBuffer.prototype.getScrollBackBufferLength = function () {
  return this._buffer.length;
};

ScreenBuffer.prototype.getScrollBackBufferCapacity = function () {
  return this._buffer.size;
};

ScreenBuffer.prototype.createBuffer = function (capacity) {
  var buf = new CBuffer(capacity);

  for (var i = 0; i < this.rows; i++)
    buf.unshift(new Row());

  return buf;
};

ScreenBuffer.prototype.getScrollBackOffset = function () {
  return this._scrollBackOffset;
};

ScreenBuffer.prototype.setScrollBackOffset = function (n) {
  var _n;

  // XXX: n の範囲チェックをしてください。
  if (n < 0) {
    _n = 0;
  } else if (this._buffer.length - n < this.rows) {
    _n = this._buffer.length - this.rows;
  } else {
    _n = n;
  }
  this._scrollBackOffset = _n;
};

ScreenBuffer.prototype.getCellAt = function (y, x) {
  if (!Number.isInteger(x)) throw TypeError('x not an integer');
  if (!Number.isInteger(y)) throw TypeError('y not an integer');
  if (x < 0 || x >= this.columns) throw RangeError('x');
  if (y < 0 || y >= this.rows) throw RangeError('y');

  return this.getLine(y).getCellAt(x);
};

ScreenBuffer.prototype.setCellAt = function (y, x, cell) {
  if (!Number.isInteger(x)) throw TypeError('x not an integer');
  if (!Number.isInteger(y)) throw TypeError('y not an integer');
  if (x < 0 || x >= this.columns) throw RangeError('x');
  if (y < 0 || y >= this.rows) throw RangeError('y');
  // TODO: cell の型チェック?

  this.getLine(y).setCellAt(x, cell);
}

ScreenBuffer.prototype.getCellAtOffset = function (offset) {
  if (!Number.isInteger(offset)) throw TypeError('not an integer');
  if (offset < 0 || offset >= this.rows * this.columns) throw RangeError('offset');

  var y = Math.floor(offset / this.columns);
  var x = offset % this.columns;
  return this.getLine(y).getCellAt(x);
};

ScreenBuffer.prototype.setCellAtOffset = function (offset, cell) {
  if (!Number.isInteger(offset)) throw TypeError('not an integer');
  if (offset < 0 || offset >= this.rows * this.columns) throw RangeError('offset');

  var y = Math.floor(offset / this.columns);
  var x = offset % this.columns;
  this.getLine(y).setCellAt(x, cell);
};

function spliceArray(ary, start, deleteCount, ary2) {
  var removed = Array.prototype.splice.apply(ary, [start, deleteCount].concat(ary2));
  return removed;
};

// 範囲 は [y1, y2]。y2を含む。
ScreenBuffer.prototype.scrollDown = function (y1, y2, nlines, attrs) {
  for (var i = y2 - nlines; i >= y1; i--) {
    this.setLine(i + nlines, this.getLine(i));
  }

  for (var j = y1; j < y1 + nlines; j++) {
    var row = new Row();
    row.clear(this.columns, attrs);
    this.setLine(j, row);
  }

  this.scrollPerformed = true;
};

// METHOD: scrollUp(y1, y2, nlines)
ScreenBuffer.prototype.scrollUp = function (y1, y2, nlines, attrs) {
  if (y1 === 0 && y2 === this.rows - 1) {
    this.softScrollUp(nlines, attrs);
    return;
  }

  for (var i = y1 + nlines; i <= y2; i++) {
    this.setLine(i - nlines, this.getLine(i));
  }

  for (var j = y2 - nlines + 1; j < y2 + 1; j++) {
    var row = new Row()
    row.clear(this.columns, attrs);
    this.setLine(j, row);
  }

  this.scrollPerformed = true;
};

ScreenBuffer.prototype.softScrollUp = function (nlines, attrs) {
  for (var i = 0; i < nlines; i++) {
    var row = new Row();
    row.clear(this.columns, attrs);
    this._buffer.unshift(row);
  }
}

ScreenBuffer.prototype.getLine = function (index) {
  // TODO: 引数チェック
  if (!Number.isInteger(index)) {
    throw new RangeError(`index = ${index}`);
  }
  var indexIntoCBuffer = this._scrollBackOffset + this.rows - index - 1;
  if (indexIntoCBuffer < 0 ||
      indexIntoCBuffer >= this._buffer.length) {
    throw new RangeError(`indexIntoCBuffer = ${indexIntoCBuffer}`);
  }

  return this._buffer.get(indexIntoCBuffer);
}

ScreenBuffer.prototype.setLine = function (index, line) {
  this._buffer.set(this._scrollBackOffset + this.rows - index - 1, line);
}

ScreenBuffer.prototype.increaseRows = function (newNumberOfRows) {
  var shortage = 0;
  if (this._buffer.length < newNumberOfRows) {
    shortage = newNumberOfRows - this._buffer.length;
    for (var i = 0; i < shortage; i++) {
      this._buffer.unshift(new Row());
    }
  }

  this._scrollBackOffset = 0;
  this.rows = newNumberOfRows;

  return shortage;
};

ScreenBuffer.prototype.decreaseRows = function (newNumberOfRows, allowedToDiscard) {
  // console.log(`allowedToDiscard = ${allowedToDiscard}`);
  var toDiscard = Math.min(this.rows - newNumberOfRows, allowedToDiscard);
  for (var i = 0; i < toDiscard; i++) {
    this._buffer.shift();
  }

  this._scrollBackOffset = 0;
  this.rows = newNumberOfRows;

  return toDiscard;
}

ScreenBuffer.prototype.clone = function () {
  var newBuffer = new ScreenBuffer(this.columns, this.rows);

  for (var y = 0; y < this.rows; y++) {
    for (var x = 0; x < this.columns; x++) {
      newBuffer.setCellAt(y, x, this.getCellAt(y, x).clone());
    }
  }

  return newBuffer;
};

ScreenBuffer.prototype.clearToEnd = function (y, x, attrs) {
  if (x !== 0) {
    for (var i = x; i < this.columns; i++) {
      var cell = new Cell();
      cell.attrs = attrs.clone();
      this.getLine(y).setCellAt(i, cell);
    }
    y += 1;
  }

  for (var j = y; j < this.rows; j++) {
    this.getLine(j).clear(this.columns, attrs);
  }
};

ScreenBuffer.prototype.clearFromBeginning = function (y, x, attrs) {
  if (x !== this.columns - 1) {
    for (var i = 0; i <= x; i++) {
      var cell = new Cell();
      cell.attrs = attrs.clone();
      this.getLine(y).setCellAt(i, cell);
    }
    if (y === 0)
      return;
    y -= 1;
  }

  for (var j = 0; j <= y; j++) {
    this.getLine(j).clear(this.columns, attrs);
  }
};

ScreenBuffer.prototype.clearAll = function (attrs) {
  for (var i = 0; i < this.rows; i++) {
    this.getLine(i).clear(this.columns, attrs);
  }
};

ScreenBuffer.prototype.resetFlags = function () {
  this.scrollPerformed = false;
};

ScreenBuffer.prototype.toString = function () {
  var str = '';
  for (var i = 0; i < this.rows; i++) {
    str += this.getLine(i).toString() + '\n';
  }
  return str;
}

// module.exports = {
//   GraphicAttrs: GraphicAttrs,
//   Cell: Cell,
//   ScreenBuffer: ScreenBuffer,
// };
