/**

  TODO:
  - Переделать вычисление расстояний
  - Синхронизировать движение платформ

  COMPLETED:
  - ImageLoader
  - Разобраться с флагами и последовательностью действий
  - Т.к игра не ставиться на паузу - вычисление интерполяции продолжается даже когда вкладка с игрой не активна
 */



(function() {
  'use strict';

  var TICKS_PER_SECOND = 25;
  var SKIP_TICKS = 1000 / TICKS_PER_SECOND;
  var MAX_FRAMESKIP = 5;



  var STATE = {
    NORMAL: 0,
    STICK_DRAW_STARTED: 1,
    STICK_DRAW_FINISHED: 2,
    STICK_FALL_STARTED: 3,
    STICK_FALL_FINISHED: 4,
    HERO_MOVE_STARTED: 5,
    HERO_MOVE_FINISHED: 6,
    SCREEN_SCROLL_STARTED: 7,
    SCREEN_SCROLL_FINISHED: 8,
    GAME_OVER: 9
  };

  // var SCREEN = {
  //   PRELOAD: 0,
  //   MENU: 1,
  //   GAME: 2,
  //   GAME_OVER: 3
  // }



  function Game() {
    console.log('Game constructor');
    
    // Game loop variables
    this.loops = 0;
    this.interpolation = 0;
    this.nextGameTick = getTimeStamp();
    this.gameIsRunning = true;

    this.canvas = null;
    this.canvasCtx = null;
    this.config = Game.config;

    this.images = {};
    this.imagesUrls = {
      'hero': 'images/hero.png',
      'stick': 'images/stick.png',
      'platform30': 'images/platform-30.png',
      'platform50': 'images/platform-50.png',
      'platform60': 'images/platform-60.png',
      'platform80': 'images/platform-80.png',
      'platform100': 'images/platform-100.png'
    };

    this.time = 0;

    this.hero = null;
    this.platforms = [];

    this.distanceMin = 0;
    this.distanceMax = 0;
    this.distancePlatformMove = 0;
    this.maxHeroDistance = 0;

    this.currentState = STATE.NORMAL;
    this.currentScreen = new Screen('preload');

    this.isScreenScrolled = false;
    this.isScreenStopped = false;
    this.isNewPlatformCreated = false;
    this.stickNotOnPlatform = false;
    // this.loop();
    
    this.loadImages();
  }


  Game.config = {
    WIDTH: 320,
    HEIGHT: 480,
    MOVE_SPEED: 25,
    MAX_STICK_HEIGHT: 330, // GAME.HEIGHT - PLATFORM.HEIGTH = 480 - 150
    MIN_DISTANCE_BETWEEN_PLATFORMS: 25,
  }


  Game.prototype = {
    loadImages: function() {
      var imgCount = 0;
      var totalImages = Object.keys(this.imagesUrls).length;

      for (var name in this.imagesUrls) {
        this.images[name] = new Image();
        this.images[name].src = this.imagesUrls[name];
        this.images[name].onload = function() {
          if (++imgCount == totalImages) {
            // console.log('all images were loaded successfully', totalImages, this.images);
            this.init();
          }
        }.bind(this);
      }
    },

    init: function() {
      console.log('init');

      this.canvas = document.getElementById('gameCanvas');
      this.canvasCtx = this.canvas.getContext('2d');

      this.initInput();
      this.initObjects();

      // Init game loop
      this.nextGameTick = getTimeStamp();
      this.loop();

      // Show game screen
      this.currentScreen.change('game');
    },

    initInput: function() {
      this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this), false);
      this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this), false);

      document.getElementById('btn-restart').addEventListener('click', this.restart.bind(this));

      window.addEventListener('focus', function(e) {
        // update tick value when user return to game
        this.nextGameTick = getTimeStamp();
      }.bind(this));
    },

    handleMouseDown: function() {
      if (this.currentState == STATE.NORMAL && this.stick.isFallCompleted === false && this.stick.isFallStarted === false) {
        this.currentState = STATE.STICK_DRAW_STARTED;
        this.stick.isGrowthStarted = true;
      }
    },

    handleMouseUp: function() {
      if (this.currentState == STATE.STICK_DRAW_STARTED) {
        this.stick.isGrowthStarted = false;
        this.stick.isFallStarted = true;
        this.currentState = STATE.STICK_DRAW_FINISHED;
      }
    },

    initObjects: function() {
      var platform1Type = this.images.platform100;
      var platform2Type = this.getPlatformType();
      this.platforms = [];
      this.platforms.push(new Platform(this.canvas, 0, platform1Type));
      this.platforms.push(new Platform(this.canvas, 200, platform2Type));
      
      var p1 = this.platforms[0];
      var heroX = p1.width - this.images.hero.width - this.images.stick.width;
      var stickX = p1.xPos + p1.width - 1;
      var stickY = p1.yPos;

      this.hero = new Hero(this.canvas, this.images.hero, heroX);
      this.stick = new Stick(this.canvas, this.images.stick, stickX, stickY);
      this.score = new Score();

      this.calcDistances();
    },

    restart: function() {
      this.initObjects();
      this.resetFlags();
      this.score.reset();
      this.score.show();
      this.currentScreen.change('game');
      this.currentState = STATE.NORMAL;
    },

    resetFlags: function() {
      this.isScreenScrolled = false;
      this.isScreenStopped = false;
      this.isNewPlatformCreated = false;
      this.stickNotOnPlatform = false;
    },

    loop: function() {
      if (this.gameIsRunning) {
        this.loops = 0;

        this.clearCanvas();

        while(getTimeStamp() > this.nextGameTick && this.loops < MAX_FRAMESKIP) {
          this.update();

          this.nextGameTick += SKIP_TICKS;
          this.loops++;
        }

        this.interpolation = (getTimeStamp() + SKIP_TICKS - this.nextGameTick) / SKIP_TICKS;
        this.render(this.interpolation);

        requestAnimationFrame(this.loop.bind(this));
      }
    },

    update: function() {
      this.hero.update();
      this.stick.update();
      this.platforms.forEach(function(platform) {
        platform.update();
      })
      

      switch(this.currentState) {
        case STATE.STICK_DRAW_STARTED:
          // console.log('STICK_DRAW_STARTED');
          break;

        case STATE.STICK_DRAW_FINISHED:
          // console.log('STICK_DRAW_FINISHED');
          this.currentState = STATE.STICK_FALL_STARTED;
          break;

        case STATE.STICK_FALL_STARTED:
          // console.log('STICK_FALL_STARTED');
          
          if (this.stick.angle + this.stick.angleDelta >= 90) {
            this.currentState = STATE.STICK_FALL_FINISHED;
          }
          break;

        case STATE.STICK_FALL_FINISHED:
          // console.log('STICK_FALL_FINISHED');

          this.hero.canMove = true;
          this.currentState = STATE.HERO_MOVE_STARTED;
          this.calcMaxHeroDistance();
          break;

        case STATE.HERO_MOVE_STARTED: 
          // console.log('HERO_MOVE_STARTED', this.maxHeroDistance, this.hero.xPos);

          if (this.hero.xPos >= this.maxHeroDistance) {
            this.currentState = STATE.HERO_MOVE_FINISHED;
          }
          break;

        case STATE.HERO_MOVE_FINISHED: 
          // console.log('HERO_MOVE_FINISHED');
          this.hero.canMove = false;

          if (this.stickNotOnPlatform) {            
            this.hero.fallDown();
            this.stick.fallDown();

            this.currentState = STATE.FAILED;
          } else {
            this.scrollScreen();
            this.distancePlatformMove = this.platforms[1].xPos;
            this.currentState = STATE.SCREEN_SCROLL_STARTED;
          }

          break;

        case STATE.SCREEN_SCROLL_STARTED: 
          // console.log('SCREEN_SCROLL_STARTED');

          if (this.isNewPlatformCreated === false) {
            this.addNewPlatform();
          }

          if (this.platforms[1].stopped) {
            this.stopScreenScroll();
            this.currentState = STATE.SCREEN_SCROLL_FINISHED;
          }

          break;

        case STATE.SCREEN_SCROLL_FINISHED: 
          // console.log('SCREEN_SCROLL_FINISHED');
          // console.log(this.stick.xPos - this.stick.height); // check if stick still visible

          this.isNewPlatformCreated = false;
          this.platforms.shift();
          
          var p1 = this.platforms[0];
          var p2 = this.platforms[1];
          var stickX = p1.xPos + p1.width - 1;
          var stickY = p1.yPos;
          this.stick = new Stick(this.canvas, this.images.stick, stickX, stickY);

          // reset speed for 2nd platform
          p2.speed = p1.speed;

          this.hero.onPosition = false;
          this.hero.xPosStart = this.hero.xPos;

          this.calcDistances();
          this.score.update();

          this.currentState = STATE.NORMAL;
          break;

        case STATE.FAILED:
          if (this.hero.isVisible() === false) {
            this.hero.isFallDown = false;
          }

          if (this.stick.isFinalFallCompleted) {
            this.currentState = STATE.GAME_OVER;

            // Show game over screen
            this.score.hide();
            this.currentScreen.change('game-over');
            this.currentScreen.showFinalScore(this.score.get());
          }
          
          break;

        case STATE.GAME_OVER:
          console.log('Game over');
          break;
      }
    },

    render: function(interpolation) {
      this.platforms.forEach(function(platform) {
        platform.draw(interpolation);
      })

      this.hero.draw(interpolation);
      this.stick.draw(interpolation);
    },

    clearCanvas: function() {
      this.canvasCtx.clearRect(0, 0, this.config.WIDTH, this.config.HEIGHT);
    },

    calcDistances: function() {
      var p1 = this.platforms[0];
      var p2 = this.platforms[1];
      p1.xPos = Math.floor(p1.xPos);
      p2.xPos = Math.floor(p2.xPos);
      this.distanceMin = p2.xPos - p1.xPos - p1.width + 1;
      this.distanceMax = this.distanceMin + p2.width;
      
      // console.log('---------------');
      // console.log('CALC_DISTANCES');
      // console.log('distance_min', this.distanceMin); 
      // console.log('distance_max', this.distanceMax);
      // console.log('p1_x', p1.xPos, '\t\tp1_width', p1.width);
      // console.log('p2_x', p2.xPos, '\tp2_width', p2.width);
    },

    calcMaxHeroDistance: function() {
      var p2 = this.platforms[1];

      if (this.stick.height > this.distanceMin && this.stick.height <= this.distanceMax) {
        // go to the end of 2nd platform
        this.maxHeroDistance = p2.xPos + p2.width - this.hero.width - this.stick.width;
      } else {
        // go to the end of the stick
        this.maxHeroDistance = this.stick.height + this.hero.xPosStart;
        this.stickNotOnPlatform = true;
      }

      this.hero.setTargetPosition(this.maxHeroDistance);
    },

    scrollScreen: function() {
      this.platforms.forEach(function(platform) {
        platform.canMove = true;
      })
      this.platforms[0].remove = true;

      this.hero.canMove = true;
      this.hero.speed = Game.config.MOVE_SPEED;
      this.hero.direction = Hero.config.DIRECTION_BACKWARD;
      this.stick.canMove = true;
    },

    stopScreenScroll: function() {
      this.platforms.forEach(function(platform) {
        if (platform.onPosition) {
          platform.canMove = false;
        }
        // console.log('platform.xPos', platform.xPos);
      })

      this.hero.canMove = false;
      this.hero.speed = Game.config.MOVE_SPEED / 2;
      this.hero.direction = Hero.config.DIRECTION_FORWARD;
      this.stick.canMove = false;
    },

    getPlatformType: function() {
      var platformIndex = Math.floor(Math.random() * Platform.config.TYPES.length);
      var textureName = 'platform' + Platform.config.TYPES[platformIndex];
      return this.images[textureName];
    },

    calcPlatformPosition: function(p1, p2) {
      var toEdge = Game.config.WIDTH - this.distancePlatformMove;
      var freeSpace = Game.config.WIDTH - p1.width - p2.width - toEdge;
      var x = Math.floor(Math.random() * freeSpace) + toEdge + Game.config.MIN_DISTANCE_BETWEEN_PLATFORMS;
      
      // Round value to grid align
      return this.roundPositionValue(x);
    },

    roundPositionValue: function(value) {
      return Math.floor(value / Game.config.MOVE_SPEED) * Game.config.MOVE_SPEED;
    },

    addNewPlatform: function() {
      this.isNewPlatformCreated = true;

      var platformType = this.getPlatformType();
      var platformNew = new Platform(this.canvas, 0, platformType, false);
      this.platforms.push(platformNew);

      var distanceToEdge = Game.config.WIDTH - this.platforms[1].xPos - this.platforms[1].width;
      var platformPosition = this.calcPlatformPosition(this.platforms[1], platformNew);
      platformNew.targetXPos = platformPosition;
      platformNew.xPos = platformPosition + this.platforms[1].xPos;

      // Изменить начальную позицию если платформа появляется в пределах видимой области
      if (platformNew.xPos < Game.config.WIDTH) {
        // platformNew.xPos = this.roundPositionValue(Game.config.WIDTH + platformNew.width);
        // platformNew.setNewPlatformSpeed(this.distancePlatformMove, platformNew.xPos - platformNew.targetXPos);
      }
    }
  };




  
  function getTimeStamp () {
    return (window.performance && window.performance.now) ? window.performance.now() : new Date().getTime();
  }

  window['Game'] = Game;




  /**
   * Hero object
   */

  
  function Hero(canvas, image, xPos) {
    this.canvas = canvas;
    this.canvasCtx = canvas.getContext('2d');
    this.config = Hero.config;
    this.image = image;

    this.xPos = xPos;
    this.yPos = 480 - 150 - 20;
    this.xPosStart = xPos;
    this.targetXPos = 0;

    this.speed = Game.config.MOVE_SPEED / 2;
    this.interpolation = 0;
    this.direction = 1;

    this.width = this.image.width;
    this.height = this.image.height;

    this.canMove = false;
    this.moveBack = false;
    this.isFallDown = false;

    this.init();
  }

  Hero.config = {
    WIDTH: 20,
    HEIGHT: 20,
    DIRECTION_FORWARD: 1,
    DIRECTION_BACKWARD: -1
  }

  Hero.config.HALF_WIDTH = Hero.config.WIDTH / 2;
  Hero.config.HALF_HEIGHT = Hero.config.HEIGHT / 2;

  Hero.prototype = {
    init: function() {
      // console.log('init hero');

      this.draw(this.interpolation);
      this.update();
    },

    update: function() { 
      if (this.canMove) {
        this.xPos = this.xPos + this.speed * this.direction;

        if (this.targetXPos && this.xPos + this.speed / 2 >= this.targetXPos) {
          // console.log('hero is on target', this.xPos, this.targetXPos);
          this.canMove = false;
          this.xPos = this.targetXPos;
        }
      }

      if (this.isFallDown) {
        this.yPos = this.yPos + this.speed;
      }
    },

    draw: function(interpolation) {
      var xPos = this.xPos;
      var yPos = this.yPos;
      var angle = this.angle;

      if (this.canMove) {
        xPos = this.xPos + this.speed * interpolation * this.direction;
      }

      if (this.isFallDown) {
        yPos = this.yPos + this.speed * interpolation;
      }
      
      this.canvasCtx.drawImage(this.image, xPos, yPos, this.config.WIDTH, this.config.HEIGHT);
    },

    setTargetPosition: function(xPos) {
      this.targetXPos = xPos;
    },

    fallDown: function() {
      this.speed = Game.config.MOVE_SPEED * 3;
      this.canMove = false;
      this.isFallDown = true;
    },

    isVisible: function() {
      return this.yPos < Game.config.HEIGHT;
    }
  }




  /**
   * Platform object
   */

  function Platform(canvas, xPos, image, onPosition) {
    this.canvas = canvas;
    this.canvasCtx = canvas.getContext('2d');
    this.config = Platform.config;

    this.image = image;
    this.width = this.image.width;
    this.height = this.image.height;

    this.speed = Game.config.MOVE_SPEED;
    this.velocity = 2;
    this.distance = 0;

    this.xPos = xPos || 0;
    this.yPos = 480 - this.config.HEIGHT;

    this.remove = false;
    this.canMove = false;
    this.onPosition = (onPosition === false) ? false : true;
      
    if (!this.onPosition) {
      this.canMove = true;
      this.targetXPos = this.xPos;
      this.xPos = Game.config.WIDTH;
    }
  }

  Platform.config = {
    WIDTH: 80,
    HEIGHT: 150,
    TYPES: [30, 50, 60, 80, 100]
  }

  Platform.prototype = {
    init: function() {
      // this.draw();
    },

    update: function() {
      if (this.canMove) {
        this.xPos = this.xPos - this.speed;

        // Stop platform when x = 0
        if (!this.remove) {
          // console.log(this.xPos);
          if (Math.abs(this.xPos) <= this.speed / 2) {
            this.stopped = true;
            // console.log('!', this.xPos, this.speed / 2);
            // this.xPos = 0;
          }
            // console.log('x_pos_current', this.xPos);
        }
      }

      if (!this.onPosition) {
        this.canMove = true;

        if (this.xPos - this.speed / 2 <= this.targetXPos) {
          // console.log('target x_pos', this.targetXPos, this.xPos - this.speed / 2);
          // this.xPos = this.targetXPos;
          this.onPosition = true;
          this.canMove = false;
        }
      }
    },

    draw: function(interpolation) {
      var xPos = this.xPos;

      if (this.canMove) {
        xPos = this.xPos - this.speed * interpolation;
      }
      
      this.canvasCtx.drawImage(this.image, xPos, this.yPos, this.width, this.height);
    },

    isVisible: function() {
      return this.xPos + this.width > 0;
    },

    isOnScreen: function() {
      // console.log('isOnScreen', this.xPos - this.speed / 2, this.xPos);
      return this.xPos - this.speed / 2 > 0;
    },

    setNewPlatformSpeed: function(d1, d2) {
      // var t = d1 / this.speed;
      // this.speed = d2 / t;
      // console.log(this.speed, d1, d2, d2 / t);
    }
  }




  /**
   * Stick object
   */
  
  function Stick(canvas, image, xPos, yPos) {
    this.canvas = canvas;
    this.canvasCtx = canvas.getContext('2d');
    this.config = Stick.config;
    
    this.image = image;
    this.width = this.image.width;
    this.height = this.image.height;

    this.xPos = xPos;
    this.yPos = yPos;
    this.heightIncreaseSpeed = 12;
    this.speed = Game.config.MOVE_SPEED;
    this.velocity = 1.04;
    this.angle = 0;
    this.angleDelta = 3;

    this.targetAngle = 90;

    this.isGrowthStarted = false;
    this.isFallStarted = false;
    this.isFallCompleted = false;
    this.isFinalFallCompleted = false;
    this.canMove = false;
  }

  Stick.config = {
    WIDTH: 4,
    HEIGHT: 4
  }

  Stick.prototype = {
    init: function () {
      
    },

    update: function () {
      if (this.isGrowthStarted) {
        this.height += this.heightIncreaseSpeed;
        
        if (this.height > Game.config.MAX_STICK_HEIGHT) {
          this.height = Game.config.MAX_STICK_HEIGHT
        }
      }

      if (this.isFallStarted) {
        this.angle += this.angleDelta;

        if (this.angle + this.angleDelta >= this.targetAngle) {
          this.angle = this.targetAngle;
          this.isFallCompleted = true;
          this.isFallStarted = false;
        }        
      }

      if (this.canMove) {
        this.xPos -= this.speed;
      }

      if (this.angle >= 180 && this.isFinalFallCompleted === false) {
        this.angle = 180;
        this.isFinalFallCompleted = true;
        this.isFallStarted = false;
        this.isFallCompleted = false;
        return;
      }
    },

    draw: function (interpolation) {
      var height = this.height;
      var xPos = this.xPos;

      if (this.canMove) {
        xPos = this.xPos - this.speed * interpolation;
      }

      if (this.isGrowthStarted) {
        height = this.height + this.heightIncreaseSpeed * interpolation;
        // console.log('height interpolation', height);
      }

      if (this.isFallStarted && !this.isFallCompleted) {
        // draw falling stick
        this.angleDelta *= this.velocity;
        this.angle = this.angle + this.angleDelta * interpolation;

        this.canvasCtx.save();
        this.canvasCtx.translate(xPos, this.yPos);
        this.canvasCtx.rotate(this.angle * Math.PI / 180);
        this.canvasCtx.translate(-xPos, -this.yPos);
        this.canvasCtx.drawImage(this.image, 0, 0, this.config.WIDTH, this.config.HEIGHT, xPos, this.yPos, this.width, -height);
        this.canvasCtx.restore();

      } else if (this.isFallCompleted) {
        // draw stick horizontally
        this.canvasCtx.drawImage(this.image, xPos, this.yPos, height, this.width);

      } else if (this.isFinalFallCompleted) {
        // draw stick vertically
        this.canvasCtx.drawImage(this.image, 0, 0, this.config.WIDTH, this.config.HEIGHT, xPos, this.yPos, -this.width, height);

      } else {
        // just draw stick
        this.canvasCtx.drawImage(this.image, 0, 0, this.config.WIDTH, this.config.HEIGHT, xPos, this.yPos, this.width, -height);
      }
    },

    fallDown: function() {
      this.angleDelta = 10;
      this.targetAngle = 180;
      this.isFallStarted = true;
      this.isFallCompleted = false;
    }
  }




  function Score() {
    this.value = 0;
    this.element = document.getElementById('sg-score-value');
    this.parentElement = this.element.parentNode;
  }

  Score.prototype = {
    get: function() {
      return this.value;
    },

    set: function(value) {
      this.value = value;
    },

    update: function() {
      this.value += 1;
      this.element.innerText = this.value;
    },

    reset: function() {
      this.value = 0;
      this.element.innerText = this.value;
    },

    show: function() {
      this.parentElement.classList.remove('u-hidden'); 
    },

    hide: function() {
      this.parentElement.classList.add('u-hidden');
    }
  }




  function Screen(name) {
    this.parentElement = document.getElementById('game-area');
    this.activeClass = 'screen_active';
    this.change(name);
  }

  Screen.prototype = {
    change: function(name) {
      console.log('change', name);
      this.selector = 'screen-' + name;
      this.element = document.getElementById(this.selector);
      this.toggleActiveClass();
    },

    toggleActiveClass: function() {
      var prevScreen = document.getElementsByClassName(this.activeClass)[0];
      if (prevScreen) {
        prevScreen.classList.remove(this.activeClass);

        // Game-screen still visible when game-over-screen is shown
        if (prevScreen.classList.contains('screen-game')) {
          prevScreen.classList.add('screen_visible');
        }
      }
      this.element.classList.add(this.activeClass);
    },

    showFinalScore: function(score) {
      var currentScoreElement = document.getElementById('sgo-score-value');
      currentScoreElement.innerText = score;
    },

    showData: function(targetElement, data) {
      targetElement.innerText = data;
    }
  }

  

})();

var game = new Game();