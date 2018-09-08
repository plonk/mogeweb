// extern transmitter;

$(function(){
  function GamepadController(gamepad) {
    this.gamepad = gamepad;
    this.id = gamepad.id;
    this.buttons = [];
    this.DIAGONAL_BUTTON = 6;
    this.DASH_BUTTON = 2;
    this.lastButtonPressed = null;
    this.nextKeyRepeatAt = null;
    this.buttonBindings = ["B", "A", "Y", "X", "L",
                           "None", "R", "None", "None", "None",
                           "None", "None", "Up", "Right", "Down",
                           "Left", "None", "None", "None", "None"];
    this.axisBindings = ["Horizontal", "Vertical", "None", "None", "None", "None"];
  }
  GamepadController.prototype.update = function(outFunc) {
    var pressed = null; // このフレームに押されたボタンの番号。
    for (var i = 0; i < this.gamepad.buttons.length; i++) {
      if (!this.buttons[i] && this.gamepad.buttons[i].pressed) {
        pressed = i;
      }
      if (this.buttons[i] && !this.gamepad.buttons[i].pressed) {
        if (this.lastButtonPressed == i) {
          this.lastButtonPressed = null;
          this.nextKeyRepeat = null;
        }
      }
      this.buttons[i] = this.gamepad.buttons[i].pressed;
    }

    // キーリピート。
    if (pressed !== null) {
      this.onButtonPressed(pressed, this.buttons, false, outFunc)
    } else {
      if (this.lastButtonPressed !== null &&
          +(new Date()) >= this.nextKeyRepeatAt) {
        this.onButtonPressed(this.lastButtonPressed, this.buttons, true, outFunc);
      }
    }
  };

  GamepadController.prototype.onButtonPressed = function (pressed, buttons, repeat, outFunc) {
    function enterdir(dir, dash) {
      outFunc(dash ? dir.toUpperCase() : dir);
    };
    // var axisCheck = (axisLabel, sign) => {
    //   var index = this.axisBindings.indexOf(axisLabel);
    //   if (index === -1) return false;
    //   console.log(index, this.gamepad.axes[index], sign);
    //   if (Math.abs(this.gamepad.axes[index] - sign) < 0.5)
    //     return true;
    // };
    var isPressed = (label) => {
      // if (label === "Up") { if (axisCheck("Vertical", -1)) return true; }
      // if (label === "Down") { if (axisCheck("Vertical", +1)) return true; }
      // if (label === "Left") { if (axisCheck("Horizontal", -1)) return true; }
      // if (label === "Right") { if (axisCheck("Horizontal", +1)) return true; }

      var btnNum = this.buttonBindings.indexOf(label);
      if (btnNum === null) {
        return false;
      } else {
        return buttons[btnNum];
      }
    }

    var diagonal = isPressed("R");
    var dash = isPressed("Y");

    if (isPressed("B")) { outFunc("q"); }
    if (isPressed("A")) { outFunc("\r"); }
    if (isPressed("X")) { outFunc("s"); }
    if (isPressed("L")) { outFunc("t"); }

    if (isPressed("Up")) {
      if (diagonal) {
        if (isPressed("Right")) {
          enterdir("u", dash);
        } else if (isPressed("Left")) {
          enterdir("y", dash);
        }
      } else {
        enterdir("k", dash);
      }
    } else if (isPressed("Right")) {
      if (diagonal) {
        if (isPressed("Up")) {
          enterdir("u", dash);
        } else if (isPressed("Down")) {
          enterdir("n", dash);
        }
      } else {
        enterdir("l", dash);
      }
    } else if (isPressed("Down")) {
      if (diagonal) {
        if (isPressed("Left")) {
          enterdir("b", dash);
        } else if (isPressed("Right")) {
          enterdir("n", dash);
        }
      } else {
        enterdir("j", dash);
      }
    } else if (isPressed("Left")) {
      if (diagonal) {
        if (isPressed("Down")) {
          enterdir("b", dash);
        } else if (isPressed("Up")) {
          enterdir("y", dash);
        }
      } else {
        enterdir("h", dash);
      }
    }

    this.lastButtonPressed = pressed;
    if (repeat)
      this.nextKeyRepeatAt = +(new Date()) + 30;
    else
      this.nextKeyRepeatAt = +(new Date()) + 300;
  }

  GamepadController.prototype.getButtonBinding = function(buttonNumber) {
    return this.buttonBindings[buttonNumber];
  };
  GamepadController.prototype.setButtonBinding = function(buttonNumber, label) {
    this.buttonBindings[buttonNumber] = label;
  };
  GamepadController.prototype.getAxisBinding = function(axisNumber) {
    return this.axisBindings[axisNumber];
  };
  GamepadController.prototype.setAxisBinding = function(axisNumber, label) {
    this.axisBindings[axisNumber] = label;
  };

  // ---------------------------------------------------------

  function NullGamepadController() {
    this.id = "None";
    this.buttons = [];
  }
  NullGamepadController.prototype.update = function(outFunc) {};
  NullGamepadController.prototype.getButtonBinding = function(buttonNumber) { return "None"; };
  NullGamepadController.prototype.setButtonBinding = function(buttonNumber, label) {};
  NullGamepadController.prototype.getAxisBinding = function(axisNumber) { return "None"; };
  NullGamepadController.prototype.setAxisBinding = function(buttonNumber, label) {};

  // ---------------------------------------------------------

  function renderGamepadStateView() {
    s = `Gamepad: <span id="gamepad-id">None</span><br>`;


    for (var i = 0; i < 20; i++) {
      s += `<div id="gamepad-button-${i}" class="gamepad-button">\n` +
        `B${i}<br>` +
        `<span id="state">n/a</span><br>` +
        `<select id=\"gamepad-button-binding-${i}\" class=\"gamepad-button-binding\" data-number=\"${i}\">` +
        "  <option value=\"None\">なし</option>" +
        "  <option value=\"A\">決定</option>" +
        "  <option value=\"B\">キャンセル</option>" +
        "  <option value=\"X\">メニュー</option>" +
        "  <option value=\"Y\">ダッシュ</option>" +
        "  <option value=\"L\">矢</option>" +
        "  <option value=\"R\">ナナメ移動</option>" +
        "  <option value=\"Up\">↑</option>" +
        "  <option value=\"Down\">↓</option>" +
        "  <option value=\"Left\">←</option>" +
        "  <option value=\"Right\">→</option>" +
        "</select>" +
        `</div>`;
    }
    return s;
  }

  function renderButtonBinding(num, func) {
    $(`#gamepad-button-binding-${num} option[value=${func}]` ).prop('selected', true);
  }

  function addlog(msg){
    console.log(msg);
  }

  function updateGamepadStateView(gamepadController) {
    $('#gamepad-id').text(gamepadController.id);

    for (var i = 0; i < 20; i++) {
      if (gamepadController.buttons[i] === true) {
        $("#gamepad-button-" + i + " > span#state").text("＊");
      } else if (gamepadController.buttons[i] === false) {
        $("#gamepad-button-" + i + " > span#state").html("&nbsp;");
      } else { // undefined
        $("#gamepad-button-" + i + " > span#state").html("n/a");
      }
    }

    for (var i = 0; i < 20 ; i++) {
      var label = gamepadController.getButtonBinding(i);
      renderButtonBinding(i, label);
    }
  }

  $(window).on('gamepadconnected', function(e){
    e = e.originalEvent;
    addlog("gamepad " + e.gamepad.id + " connected\n");
  });
  $(window).on('gamepaddisconnected', function(e){
    e = e.originalEvent;
    addlog("gamepad " + e.gamepad.id + " disconnected\n");
  });

  $('#gamepad-state').html(renderGamepadStateView());
  $('.gamepad-button-binding').on('change', function() {
    var label = $(this).val();
    var buttonNumber = +$(this).data("number");
    gamepadController.setButtonBinding(buttonNumber, label);
  });

  var gamepadController = new NullGamepadController();
  var iter = function(){
    var gamepad = navigator.getGamepads()[0];
    if (gamepad) {
      if (gamepadController instanceof NullGamepadController)
        gamepadController = new GamepadController(gamepad);
    } else {
      if (!(gamepadController instanceof NullGamepadController))
        gamepadController = new NullGamepadController();
    }
    gamepadController.update(function (str) { transmitter.paste(str) });
    updateGamepadStateView(gamepadController);
    window.requestAnimationFrame(iter);
  }
  window.requestAnimationFrame(iter);
});
