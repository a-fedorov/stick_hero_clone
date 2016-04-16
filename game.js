/**

  TODO:
  - ImageLoader
  - Разобраться с флагами и последовательностью действий
  - Переделать вычисление расстояний
  - Синхронизировать движение платформ
 */



(function() {
  'use strict';

  var TICKS_PER_SECOND = 25;
  var SKIP_TICKS = 1000 / TICKS_PER_SECOND;
  var MAX_FRAMESKIP = 5;

  var next_game_tick = getTimeStamp();
  var loops = 0;
  var interpolation = 0;

  var game_is_running = true;


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
  }



  function Game() {
    console.log('Game constructor');

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

    this.loadImages();

    this.distanceMin = 0;
    this.distanceMax = 0;
    this.distancePlatformMove = 0;

    this.maxHeroDistance = 0;
    this.currentState = STATE.NORMAL;

    this.isScreenScrolled = false;
    this.isScreenStopped = false;
    this.isNewPlatformCreated = false;
    this.stickNotOnPlatform = false;
    // this.loop();
  }


  Game.config = {
    WIDTH: 320,
    HEIGHT: 480,
    MIN_DISTANCE_BETWEEN_PLATFORMS: 40
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

      var platform1Type = this.images.platform100;
      var platform2Type = this.getPlatformType();
      this.platforms.push(new Platform(this.canvas, 0, platform1Type));
      this.platforms.push(new Platform(this.canvas, 200, platform2Type));
      
      var p1 = this.platforms[0];
      var heroX = p1.width - this.images.hero.width - this.images.stick.width;
      var stickX = p1.xPos + p1.width - this.images.stick.width;
      var stickY = p1.yPos;

      this.hero = new Hero(this.canvas, this.images.hero, heroX);
      this.stick = new Stick(this.canvas, this.images.stick, stickX, stickY);

      this.calcDistances();

      // Temp solution until preloader will be created
      setTimeout(function() {
        next_game_tick = getTimeStamp();
        this.loop();
      }.bind(this), 200);

    },

    initInput: function() {
      this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this), false);
      this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this), false);
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
        this.currentState = STATE.STICK_FALL_STARTED;
      }
    },

    loop: function() {
      if (game_is_running) {
        loops = 0;

        // Clear canvas
        this.clearCanvas();

        while(getTimeStamp() > next_game_tick && loops < MAX_FRAMESKIP) {
          this.update();

          next_game_tick += SKIP_TICKS;
          loops++;
        }

        interpolation = (getTimeStamp() + SKIP_TICKS - next_game_tick) / SKIP_TICKS;
        this.render(interpolation);

        requestAnimationFrame(this.loop.bind(this));
      }
    },

    update: function() {
      this.hero.update();
      this.stick.update();
      this.platforms.forEach(function(platform) {
        platform.update();
      })

      // console.log('x_pos', this.platforms[1].xPos);


      switch(this.currentState) {
        case STATE.STICK_DRAW_STARTED:
          // console.log('STICK_DRAW_STARTED');
          break;

        case STATE.STICK_DRAW_FINISHED:
          // console.log('STICK_DRAW_FINISHED');
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
            this.stick.angleDelta = 10;
            this.hero.speed = 60;
            this.hero.isFallDown = true;
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
            this.isNewPlatformCreated = true;

            var platformType = this.getPlatformType();
            this.platformNew = new Platform(this.canvas, 0, platformType, false);
            this.platforms.push(this.platformNew);

            var distanceToEdge = Game.config.WIDTH - this.platforms[1].xPos - this.platforms[1].width;
            var platformPosition = this.calcPlatformPosition(this.platforms[1], this.platformNew);
            this.platformNew.targetXPos = platformPosition;
            this.platformNew.xPos = Game.config.WIDTH + platformPosition - distanceToEdge - this.platforms[1].width;
            // console.log('x_pos_new', this.platformNew.xPos, platformPosition);
            // console.log(this.platformNew.xPos, this.platformNew.targetXPos);

            // Изменить начальную позицию если платформа появляется в пределах видимой области
            if (this.platformNew.xPos < Game.config.WIDTH) {
              console.log('<');
              this.platformNew.xPos = Game.config.WIDTH + this.platformNew.width;
              this.platformNew.setNewPlatformSpeed(this.distancePlatformMove, this.platformNew.xPos - this.platformNew.targetXPos);
            }

          }

          if (this.platforms[1].isOnScreen() === false) {
            // Platform should be stopped when horizontal positions will be equal to zero
            var deltaX = this.platforms[1].xPos;
            // this.platforms[1].xPos = 0;
            // this.platforms[2].xPos -= deltaX;
            // this.hero.xPos -= deltaX;
            console.log('p1_x', this.platforms[1].xPos);

            this.stopScreenScroll();
            this.currentState = STATE.SCREEN_SCROLL_FINISHED;
          }

          // // Check if new platform is on it's position
          // if (this.platforms.length == 3 && this.platforms[2].onPosition) {
          // }

          break;

        case STATE.SCREEN_SCROLL_FINISHED: 
          // console.log('SCREEN_SCROLL_FINISHED');
          // console.log(this.stick.xPos - this.stick.height); // check if stick still visible

          this.isNewPlatformCreated = false;
          this.platforms.shift();
          
          var p1 = this.platforms[0];
          var p2 = this.platforms[1];
          var stickX = p1.xPos + p1.width - this.images.stick.width;
          var stickY = p1.yPos;
          this.stick = new Stick(this.canvas, this.images.stick, stickX, stickY);

          // reset speed for 2nd platform
          p2.speed = p1.speed;

          this.hero.onPosition = false;
          this.hero.xPosStart = this.hero.xPos;

          this.calcDistances();

          this.currentState = STATE.NORMAL;
          break;

        case STATE.FAILED:
          this.hero.canMove = false;
          this.stick.isFallCompleted = false;
          this.stick.isFallStarted = true;
          this.stick.targetAngle = 180;

          if (this.hero.yPos > Game.config.HEIGHT) {
            this.hero.isFallDown = false;
          }
          
          if (this.stick.angle >= 180) {
            this.stick.angle = 180;
            this.stick.isFinalFallCompleted = true;
            this.stick.isFallStarted = false;
            this.currentState = STATE.GAME_OVER;
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
      this.distanceMin = p2.xPos - p1.xPos - p1.width + this.stick.width + 1;
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

      if (-this.stick.height > this.distanceMin && -this.stick.height <= this.distanceMax) {
        // go to the end of 2nd platform
        this.maxHeroDistance = p2.xPos + p2.width - this.hero.width - this.stick.width;
      } else {
        // go to the end of stick
        this.maxHeroDistance = -this.stick.height + this.hero.xPosStart;
        this.stickNotOnPlatform = true;
      }

      this.hero.setTargetPosition(this.maxHeroDistance);
    },

    scrollScreen: function() {
      this.platforms.forEach(function(platform) {
        platform.canMove = true;
      })

      this.hero.canMove = true;
      this.hero.speed = 20;
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
      this.hero.speed = 10;
      this.hero.direction = Hero.config.DIRECTION_FORWARD;
      this.stick.canMove = false;
    },

    getPlatformType: function() {
      var platformIndex = Math.floor(Math.random() * Platform.config.types.length);
      var textureName = 'platform' + Platform.config.types[platformIndex];
      return this.images[textureName];
    },

    calcPlatformPosition: function(p1, p2) {
      var freeSpace = Game.config.WIDTH - p1.width - p2.width - Game.config.MIN_DISTANCE_BETWEEN_PLATFORMS;
      var x = p1.width + Math.floor(Math.random() * freeSpace) + Game.config.MIN_DISTANCE_BETWEEN_PLATFORMS;
      // Snap to 10px grid
      console.log(Math.floor(x / 10) * 10);
      return Math.floor(x / 10) * 10;
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

    this.speed = 10;
    this.interpolation = 0;
    this.direction = 1;

    this.width = this.image.width;
    this.height = this.image.height;

    this.canMove = false;
    this.moveBack = false;
    this.isFallDown = false;
    // this.onPosition = false;


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
      console.log('init hero');

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
        var xPos = this.xPos + this.speed * interpolation * this.direction;
      }

      if (this.isFallDown) {
        var yPos = this.yPos + this.speed * interpolation;
      }
      
      this.canvasCtx.drawImage(this.image, xPos, yPos, this.config.WIDTH, this.config.HEIGHT);
    },

    setTargetPosition: function(xPos) {
      // console.log('target', xPos);
      this.targetXPos = xPos;
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
    this.speed = 20;
    this.velocity = 2;

    this.xPos = xPos || 0;
    this.yPos = 480 - this.config.HEIGHT;

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
    types: [30, 50, 60, 80, 100]
  }

  Platform.prototype = {
    init: function() {
      // this.draw();
    },

    update: function() {
      if (this.canMove) {
        this.xPos = this.xPos - this.speed;
      }

      if (!this.onPosition) {
        this.canMove = true;

        if (this.xPos - this.speed / 2 <= this.targetXPos) {
          console.log('target x_pos', this.targetXPos, this.xPos - this.speed / 2);
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
      console.log(this.xPos - this.speed / 2);
      return this.xPos - this.speed / 2 > 0;
    },

    setNewPlatformSpeed: function(d1, d2) {
      var t = d1 / this.speed;
      this.speed = Math.ceil(d2 / t);
      // console.log(this.speed, d1, d2);
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
    this.height = this.image.height * (-1);

    this.xPos = xPos;
    this.yPos = yPos;
    this.heightIncreaseSpeed = 10;
    this.speed = 20;
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
        this.height -= this.heightIncreaseSpeed;
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
    },

    draw: function (interpolation) {
      var height = this.height;
      var xPos = this.xPos;

      if (this.canMove) {
        xPos = this.xPos - this.speed * interpolation;
      }

      if (this.isGrowthStarted) {
        height = this.height - this.heightIncreaseSpeed * interpolation;
      }

      if (this.isFallStarted && !this.isFallCompleted) {
        this.angleDelta *= this.velocity;
        this.angle = this.angle + this.angleDelta * interpolation;

        this.canvasCtx.save();
        this.canvasCtx.translate(xPos, this.yPos);
        this.canvasCtx.rotate(this.angle * Math.PI / 180);
        this.canvasCtx.translate(-xPos, -this.yPos);
        this.canvasCtx.drawImage(this.image, xPos, this.yPos, this.width, height);
        this.canvasCtx.restore();
      } else if (this.isFallCompleted) {
        this.canvasCtx.drawImage(this.image, xPos, this.yPos, -height, this.width);
      } else if (this.isFinalFallCompleted) {
        this.canvasCtx.drawImage(this.image, xPos, this.yPos, -this.width, -this.height);
      } else {
        this.canvasCtx.drawImage(this.image, xPos, this.yPos, this.width, height);
      }
    },
  }
  

})();

var game = new Game();