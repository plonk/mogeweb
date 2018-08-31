// extern transmitter;

$(function(){
  var buttons = [];
  var DIAGONAL_BUTTON = 6;
  var DASH_BUTTON = 2;
  var lastButtonPressed = null;
  var nextKeyRepeatAt = null;
  function onButtonPressed(pressed, buttons, repeat) {
    var diagonal = buttons[DIAGONAL_BUTTON];
    var dash = buttons[DASH_BUTTON];
    if (pressed == 0) { transmitter.paste("q"); }
    if (pressed == 1) { transmitter.paste("\r"); }
    //if (pressed == 2) { addlog("Dash "); }
    if (pressed == 3) { transmitter.paste("i"); }
    if (pressed == 12) {
      if (diagonal) {
        if (buttons[13]) {
          enterdir("u", dash);
        } else if (buttons[15]) {
          enterdir("y", dash);
        }
      } else {
        enterdir("k", dash);
      }
    }
    if (pressed == 13) {
      if (diagonal) {
        if (buttons[12]) {
          enterdir("u", dash);
        } else if (buttons[14]) {
          enterdir("n", dash);
        }
      } else {
        enterdir("l", dash);
      }
    }
    if (pressed == 14) {
      if (diagonal) {
        if (buttons[15]) {
          enterdir("b", dash);
        } else if (buttons[13]) {
          enterdir("n", dash);
        }
      } else {
        enterdir("j", dash);
      }
    }
    if (pressed == 15) {
      if (diagonal) {
        if (buttons[14]) {
          enterdir("b", dash);
        } else if (buttons[12]) {
          enterdir("y", dash);
        }
      } else {
        enterdir("h", dash);
      }
    }

    lastButtonPressed = pressed;
    if (repeat)
      nextKeyRepeatAt = +(new Date()) + 30;
    else
      nextKeyRepeatAt = +(new Date()) + 300;
  }

  function addlog(msg){
    console.log(msg);
  }

  function enterdir(dir, dash) {
    var dir1;
    if (dash) {
      dir1 = dir.toUpperCase();
    } else {
      dir1 = dir;
    }
    transmitter.paste(dir1);
  }

  $(window).on('gamepadconnected', function(e){
    e = e.originalEvent;
    addlog("gamepad " + e.gamepad.id + " connected\n");
  });
  $(window).on('gamepaddisconnected', function(e){
    e = e.originalEvent;
    addlog("gamepad " + e.gamepad.id + " disconnected\n");
  });
  var iter = function(){
    var gamepad = navigator.getGamepads()[0];
    if (gamepad) {
      $("#gamepad-id").text(gamepad.id);
      var pressed = null;
      for (var i = 0; i < gamepad.buttons.length; i++) {
        if (gamepad.buttons[i].pressed) {
          $("#gamepad-button-" + i + " > span#state").text("＊");
        } else {
          $("#gamepad-button-" + i + " > span#state").text("");
        }
        if (!buttons[i] && gamepad.buttons[i].pressed) {
          pressed = i;
        }
        if (buttons[i] && !gamepad.buttons[i].pressed) {
          if (lastButtonPressed == i) {
            lastButtonPressed = null;
            nextKeyRepeat = null;
          }
        }
        buttons[i] = gamepad.buttons[i].pressed;
      }
      // キーリピート。

      if (pressed !== null) {
        onButtonPressed(pressed, buttons, false)
      } else {
        if (lastButtonPressed !== null &&
            +(new Date()) >= nextKeyRepeatAt) {
          onButtonPressed(lastButtonPressed, buttons, true);
        }
      }
    } else {
      $("#gamepad-id").text("Unknown");
    }
    window.requestAnimationFrame(iter);
  }
  window.requestAnimationFrame(iter);
});
