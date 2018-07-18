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

function Transmitter(term) {
  this.term = term;
  this.cursorKeyMode = 'normal';
};

var SEQUENCE_FUNCTION_KEYS = {
  'ArrowUp'    : '\x1b[A',
  'ArrowDown'  : '\x1b[B',
  'ArrowRight' : '\x1b[C',
  'ArrowLeft'  : '\x1b[D',

  'F1'         : '\x1bOP',
  'F2'         : '\x1bOQ',
  'F3'         : '\x1bOR',
  'F4'         : '\x1bOS',

  'F5'         : '\x1b[15~',
  'F6'         : '\x1b[17~',
  'F7'         : '\x1b[18~',
  'F8'         : '\x1b[19~',

  'F9'         : '\x1b[20~',
  'F10'        : '\x1b[21~',
  'F11'        : '\x1b[23~',
  'F12'        : '\x1b[24~',

  'Insert'     : '\x1b[2~',
  'Delete'     : '\x1b[3~',
  // 'Home'       : '\x1b[1~',
  // 'End'        : '\x1b[4~',
  'Home'       : '\x1b[H',
  'End'        : '\x1b[F',
  'PageUp'     : '\x1b[5~',
  'PageDown'   : '\x1b[6~',
};

var CONTROL_CHARACTER_KEYS = {
  'Enter'      : '\x0d',
  'Backspace'  : '\x7f',
  'Tab'        : '\x09',
  'Escape'     : '\x1b',
};

var APPLICATION_FUNCTION_KEY_TABLE = {
  'ArrowUp'    : '\x1bOA',
  'ArrowDown'  : '\x1bOB',
  'ArrowRight' : '\x1bOC',
  'ArrowLeft'  : '\x1bOD',
  'Home'       : '\x1bOH',
  'End'        : '\x1bOF',
};

var MODIFIER_TABLE = {
  s: 2,
  a: 3,
  sa: 4,
  c: 5,
  sc: 6,
  ac: 7,
  sac: 8,
};

function modificationNumber(c, a, s) {
  var str = '';
  if (s)
    str += 's';
  if (a)
    str += 'a';
  if (c)
    str += 'c';

  return MODIFIER_TABLE[str];
}

function modifyFunctionKey (seq, ctrlKey, altKey, shiftKey) {
  var mod = modificationNumber(ctrlKey, altKey, shiftKey);
  var match;

  if (!(ctrlKey || altKey || shiftKey)) // unmodified
    return seq;

  // console.log(seq);
  // console.log(ctrlKey, altKey, shiftKey);
  // CSI
  match = seq.match(/^\x1b\[(.*?)(.)$/); // ~ を一般化すべき？
  if (match) {
    var num = match[1] || '1';
    return `\x1b[${num};${mod}${match[2]}`;
  }

  // SS3
  match = seq.match(/^\x1bO(.*)$/);
  if (match) {
    // CSI に変更する。
    return `\x1b[1;${mod}${match[1]}`;
  }

  return seq;
};

Transmitter.prototype.toCharacter = function (key, ctrlKey, altKey, shiftKey) {
  console.log(this.cursorKeyMode);
  if (this.cursorKeyMode === 'application' &&
      !(ctrlKey || altKey || shiftKey) && // unmodified
      APPLICATION_FUNCTION_KEY_TABLE[key]) {
      return APPLICATION_FUNCTION_KEY_TABLE[key];
  }

  if (key == 'Backspace' && ctrlKey && altKey) { return '\x1b\x08'; }
  if (key == 'Backspace' && ctrlKey) { return '\x08'; }
  if (key == 'Tab' && shiftKey) { return '\x1b[Z'; }
  if (CONTROL_CHARACTER_KEYS[key]) {
    return CONTROL_CHARACTER_KEYS[key];
  }

  if (SEQUENCE_FUNCTION_KEYS[key]) {
    return modifyFunctionKey(SEQUENCE_FUNCTION_KEYS[key], ctrlKey, altKey, shiftKey);
  }

  // きっと通常の印字文字
  if (altKey) {
    return "\x1b" + this.toCharacter(key, ctrlKey, false, shiftKey);
  } else if (ctrlKey) {
    var char = this.toCharacter(key, false, false, shiftKey).toUpperCase();
    if (char.length === 1 && ord(char) >= 0x40 && ord(char) <= 0x5f) {
      return chr(ord(char) - 0x40);
    } else if (char === '/') {
      return '\x1f'; // ^_
    } else if (char === '~') {
      return '\x1e'; // ^^
    } else if (char === ' ') {
      return '\x00';
    } else {
      return "";
    }
  } else {
    if (key.length === 1) {
      return key;
    } else {
      return "";
    }
  }
};

Transmitter.prototype.typeIn = function (ev) {
  var {key, ctrlKey, altKey, shiftKey} = ev;
  if (key === 'Control' || key === 'Shift' || key === 'Alt')
    return;

  var str = this.toCharacter(key, ctrlKey, altKey, shiftKey);
  if (str.length !== 0) {
    this.term.write(str);
    return true;
  } else {
    return false;
  }
};

Transmitter.prototype.paste = function (text) {
  this.term.write(text);
}

//module.exports = { Transmitter: Transmitter };
