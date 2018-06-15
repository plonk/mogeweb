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
