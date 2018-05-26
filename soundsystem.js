var ht = Math.pow(2,1/12); // half tone
var Fs = [
  undefined,
  880 / Math.pow(ht,9),
  880 / Math.pow(ht,8),
  880 / Math.pow(ht,7),
  880 / Math.pow(ht,6),
  880 / Math.pow(ht,5),
  880 / Math.pow(ht,4),
  880 / Math.pow(ht,3),
  880 / Math.pow(ht,2),
  880 / Math.pow(ht,1),
  880,
  880 * Math.pow(ht,1),
  880 * Math.pow(ht,2),
  880 * Math.pow(ht,3),
  880 * Math.pow(ht,4),
  880 * Math.pow(ht,5),
  880 * Math.pow(ht,6),
  880 * Math.pow(ht,7),
  880 * Math.pow(ht,8),
  880 * Math.pow(ht,9),
  880 * Math.pow(ht,10),
  880 * Math.pow(ht,11),
  880 * Math.pow(ht,12),
  880 * Math.pow(ht,13),
  880 * Math.pow(ht,14),
  880 * Math.pow(ht,15),
];
var th = 1/32;

class SoundSystem {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.busyUntil = this.ctx.currentTime;
    this.oscillator = this.ctx.createOscillator();
    this.gainNode = this.ctx.createGain();

    this.oscillator.connect(this.gainNode);
    this.oscillator.type = 'triangle';
    this.gainNode.connect(this.ctx.destination);

    this.gainNode.gain.value = 0;
    this.oscillator.start();
  }

  addNotes(queue) {
    if (queue.length === 0)
      return false;

    if (this.busyUntil > this.ctx.currentTime)
      return false;

    var offset = 0;
    for (var {volume, duration, note} of queue) {
      console.log([volume, duration, note]);
      var g = volume / 7; // 0~7 → 0.0~1.0
      var d = duration * th;
      var freq = Fs[note];
      this.gainNode.gain.setValueAtTime(g, this.ctx.currentTime + offset);
      this.oscillator.frequency.setValueAtTime(freq, this.ctx.currentTime + offset);
      offset += d;
    }
    this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime + offset);
    this.busyUntil = this.ctx.currentTime + offset;
    return true;
  }
}
