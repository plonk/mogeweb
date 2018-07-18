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

var PATTERN = {
  "?" : [0,0,0,0,0,0],
  "@" : [1,0,0,0,0,0],
  "A" : [0,1,0,0,0,0],
  "B" : [1,1,0,0,0,0],
  "C" : [0,0,1,0,0,0],
  "D" : [1,0,1,0,0,0],
  "E" : [0,1,1,0,0,0],
  "F" : [1,1,1,0,0,0],
  "G" : [0,0,0,1,0,0],
  "H" : [1,0,0,1,0,0],
  "I" : [0,1,0,1,0,0],
  "J" : [1,1,0,1,0,0],
  "K" : [0,0,1,1,0,0],
  "L" : [1,0,1,1,0,0],
  "M" : [0,1,1,1,0,0],
  "N" : [1,1,1,1,0,0],
  "O" : [0,0,0,0,1,0],
  "P" : [1,0,0,0,1,0],
  "Q" : [0,1,0,0,1,0],
  "R" : [1,1,0,0,1,0],
  "S" : [0,0,1,0,1,0],
  "T" : [1,0,1,0,1,0],
  "U" : [0,1,1,0,1,0],
  "V" : [1,1,1,0,1,0],
  "W" : [0,0,0,1,1,0],
  "X" : [1,0,0,1,1,0],
  "Y" : [0,1,0,1,1,0],
  "Z" : [1,1,0,1,1,0],
  "[" : [0,0,1,1,1,0],
  "\\" : [1,0,1,1,1,0],
  "]" : [0,1,1,1,1,0],
  "^" : [1,1,1,1,1,0],
  "_" : [0,0,0,0,0,1],
  "`" : [1,0,0,0,0,1],
  "a" : [0,1,0,0,0,1],
  "b" : [1,1,0,0,0,1],
  "c" : [0,0,1,0,0,1],
  "d" : [1,0,1,0,0,1],
  "e" : [0,1,1,0,0,1],
  "f" : [1,1,1,0,0,1],
  "g" : [0,0,0,1,0,1],
  "h" : [1,0,0,1,0,1],
  "i" : [0,1,0,1,0,1],
  "j" : [1,1,0,1,0,1],
  "k" : [0,0,1,1,0,1],
  "l" : [1,0,1,1,0,1],
  "m" : [0,1,1,1,0,1],
  "n" : [1,1,1,1,0,1],
  "o" : [0,0,0,0,1,1],
  "p" : [1,0,0,0,1,1],
  "q" : [0,1,0,0,1,1],
  "r" : [1,1,0,0,1,1],
  "s" : [0,0,1,0,1,1],
  "t" : [1,0,1,0,1,1],
  "u" : [0,1,1,0,1,1],
  "v" : [1,1,1,0,1,1],
  "w" : [0,0,0,1,1,1],
  "x" : [1,0,0,1,1,1],
  "y" : [0,1,0,1,1,1],
  "z" : [1,1,0,1,1,1],
  "{" : [0,0,1,1,1,1],
  "|" : [1,0,1,1,1,1],
  "}" : [0,1,1,1,1,1],
  "~" : [1,1,1,1,1,1],
};

function renderSixelGraphics(sixelGraphics) {
  var pixels = null;
  var registers = [];
  var currentColor = null;
  var posx = 0;
  var posy = 0;
  var canvas;
  var image;

  function drawSixel(pixels, m) {
    var i = 0;
    for (var b of PATTERN[m]) {
      if (b === 1) {
        if (posy + i < canvas.height) {
          var base = ((posy + i)* canvas.width + posx) * 4;
          pixels[base + 0] = currentColor[0];
          pixels[base + 1] = currentColor[1];
          pixels[base + 2] = currentColor[2];
          pixels[base + 3] = 255;
        }
      }
      i++;
    }
    posx += 1;
    //console.log(posx, posy);
  }

  sixelGraphics.replace(/("[0-9;]+|#[0-9]+;[0-9;]+|#[0-9]+|![0-9]+[?-~]|[?-~]|[\-$])/g, function (m) {
    if (m[0] === "\"") {
      var [pan, pad, ph, pv] = m.slice(1).split(/;/);
      canvas = document.createElement('canvas');
      canvas.width = ph;
      canvas.height = pv;
      image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      pixels = image.data;
    } else if (/^#[0-9]+;[0-9;]+$/.exec(m)) {
      var [pc, pu, px, py, pz] = m.slice(1).split(/;/);
      //console.log('define color', m);
      registers[+pc] = [px, py, pz].map(function (n) { return Math.round(n * 255 / 100); });
    } else if (/^#[0-9]+$/.exec(m)) {
      currentColor = registers[+m.slice(1)];
      //console.log("select color", currentColor, m, m.slice(1));
    } else if (/^[?-~]$/.exec(m)) {
      drawSixel(pixels, m);
    } else if (/^![0-9]+[?-~]$/.exec(m)) {
      var match = /^!([0-9]+)([?-~])$/.exec(m);
      var count = +match[1];
      var c = match[2];
      for (var i = 0; i < count; i++) {
        drawSixel(pixels, c);
      }
    } else if (m === "-") {
      posx = 0;
      posy += 6;
    } else if (m === "$") {
      posx = 0;
    } else {
      throw new Error("logic error");
    }
  });

  canvas.getContext('2d').putImageData(image, 0, 0);
  return canvas;
}
