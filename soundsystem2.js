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

var ht = Math.pow(2,1/12); // half tone

class SoundSystem2 {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.busyUntil = this.ctx.currentTime;
    this.oscillator = this.ctx.createOscillator();
    this.gainNode = this.ctx.createGain();

    this.oscillator.connect(this.gainNode);
    this.oscillator.type = 'square';
    this.gainNode.connect(this.ctx.destination);

    this.gainNode.gain.value = 0;
    this.oscillator.start();

    this.globalVolume = 0.25;
  }

  addNotes(queue) {
    if (queue.length === 0)
      return false;

    if (this.busyUntil > this.ctx.currentTime)
      return false;

    var offset = 0;
    for (var {volume, duration, note} of queue) {
      console.log([volume, duration, note]);
      var g = volume / 100;
      var d = duration * 0.001;
      var n = (note <= 128) ? note : note - 256;
      var freq = 440 * Math.pow(ht, n);
      this.gainNode.gain.setValueAtTime(g * this.globalVolume, this.ctx.currentTime + offset);
      this.oscillator.frequency.setValueAtTime(freq, this.ctx.currentTime + offset);
      console.log(g, d, freq);
      offset += d;
    }
    this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime + offset);
    this.busyUntil = this.ctx.currentTime + offset;
    return true;
  }
}
