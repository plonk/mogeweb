# YOTEPS ー Play Sound

## フォーマット

	CSI Pvolume; Pduration; Pnote , ~

CSI (Control Sequence Introducer)は `ESC [` の 2バイト。
中間文字はコンマで、最終文字はチルダ。

## パラメータ

### Pvolume

	0 = off
      :
      :
    100 = 最大音量

### Pduration

ミリ秒単位。

### Pnote

範囲は 0\~255 で、A4(=440Hz) から上げる半音の数。
ただし、128\~255 は -128\~-1 にマップされる。(8ビット2の補数表現)
