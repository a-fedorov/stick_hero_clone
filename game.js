/**

  TODO:
  - ImageLoader
  - Разобраться с флагами и последовательностью действий
  - Переделать вычисление расстояний
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
    SCREEN_SCROLL_FINISHED: 8
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
    HEIGHT: 480
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

      this.platforms.push(new Platform(this.canvas, 0, this.images.platform100));
      this.platforms.push(new Platform(this.canvas, 200, this.images.platform60));
      
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
      this.stick.isGrowthStarted = false;
      this.stick.isFallStarted = true;
      this.currentState = STATE.STICK_FALL_STARTED;
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

          if (/*this.maxHeroDistance > 0 && */this.hero.xPos > this.maxHeroDistance) {
            this.currentState = STATE.HERO_MOVE_FINISHED;
          }


            // this.currentState = STATE.FAILED;

          break;

        case STATE.HERO_MOVE_FINISHED: 
          // console.log('HERO_MOVE_FINISHED');
          this.hero.canMove = false;

          if (this.stickNotOnPlatform) {
            this.currentState = STATE.FAILED;  
          } else {
            this.currentState = STATE.SCREEN_SCROLL_STARTED;
            this.scrollScreen();
          }

          break;

        case STATE.SCREEN_SCROLL_STARTED: 
          // console.log('SCREEN_SCROLL_STARTED');

          if (this.platforms[0].isVisible() === false && this.isNewPlatformCreated === false) {
            this.isNewPlatformCreated = true;


            var platformType = this.getPlatformType();
            console.log(platformType, this.images[platformType]);
            this.platforms.push(new Platform(this.canvas, 200, this.images[platformType], false));
          }

          if (this.platforms[1].isOnScreen() === false) {
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
          var stickX = p1.xPos + p1.width - this.images.stick.width;
          var stickY = p1.yPos;
          this.stick = new Stick(this.canvas, this.images.stick, stickX, stickY);

          // reset speed for 2nd platform
          p2.speed = p1.speed;

          this.calcDistances();

          this.currentState = STATE.NORMAL;
          break;

        case STATE.FAILED:
          this.hero.canMove = false;
          break;
      }



/*

      var p1 = this.platforms[0];
      var p2 = this.platforms[1];

      if (this.stick.isFallCompleted) {
        this.hero.canMove = true;
        // console.log(this.hero.xPos);
      }

      // Check if stick is on a platform
      if (this.stick.isFallStarted) {
        // calc max distance hero can walk
        if(-this.stick.height > this.distanceMin && -this.stick.height <= this.distanceMax) {
          // go to the end of 2nd platform
          this.maxHeroDistance = p2.xPos + p2.width - this.hero.width - this.hero.speed * 3;
          // console.log(this.maxHeroDistance);
        } else {
          // go to the end of stick
          this.maxHeroDistance = -this.stick.height + this.hero.xPosStart - this.hero.width / 2;
          // console.log(this.maxHeroDistance, -this.stick.height, this.hero.xPosStart, this.hero.xPos);
        }
      }

      // Рассчитать условие остановки героя 
      // Конец платформы или конец палки, если она вне платформы
      if (this.maxHeroDistance && this.hero.xPos > this.maxHeroDistance && this.isScreenScrolled === false) {
        this.hero.canMove = false;
        this.scrollScreen();
      }

      if (!p2.isOnScreen()) {
        this.stopScreenScroll();
      }

      if (!p1.isVisible() && !this.isNewPlatformCreated) {
        this.isNewPlatformCreated = true;
        this.platforms.push(new Platform(this.canvas, 160, this.images.platform80, false));
      }
*/
      // if (!this.isScreenScrolled && this.isScreenStopped && ) {
      // }
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


      console.log(p1.xPos, p2.xPos);
      
      this.distanceMin = p2.xPos - p1.xPos - p1.width + this.stick.width + 1;
      this.distanceMax = this.distanceMin + p2.width;
      
      /*console.log('CALC_DISTANCES');
      console.log('distance_min', this.distanceMin); 
      console.log('distance_max', this.distanceMax);
      console.log('p1_width', p1.width);
      console.log('p2_width', p2.width);
      console.log('p1_x', p1.xPos);
      console.log('p2_x', p2.xPos);*/
    },

    calcMaxHeroDistance: function() {
      var p2 = this.platforms[1];
      if(-this.stick.height > this.distanceMin && -this.stick.height <= this.distanceMax) {
        // go to the end of 2nd platform
        this.maxHeroDistance = p2.xPos + p2.width - this.hero.width - this.hero.speed * 4;
      } else {
        // go to the end of stick
        this.maxHeroDistance = -this.stick.height + this.hero.xPosStart - this.hero.width / 2;
        this.stickNotOnPlatform = true;
      }
    },

    scrollScreen: function() {
      this.isScreenScrolled = true;
      this.platforms.forEach(function(platform) {
        platform.canMove = true;
      })
      this.hero.canMove = true;
      this.hero.moveBack = true;
      this.stick.canMove = true;
    },

    stopScreenScroll: function() {
      this.isScreenScrolled = false;
      this.isScreenStopped = true;
      this.platforms.forEach(function(platform) {
        if (platform.onPosition) {
          platform.canMove = false;
        }
      })
      this.hero.canMove = false;
      this.hero.moveBack = false;
      this.stick.canMove = false;
    },

    getPlatformType: function() {
      var platformIndex = Math.floor(Math.random() * Platform.config.types.length);
      return 'platform' + Platform.config.types[platformIndex];
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
    this.speed = 10;
    this.interpolation = 0;
    this.direction = 1;

    this.width = this.image.width;
    this.height = this.image.height;

    this.canMove = false;
    this.moveBack = false;

    this.init();
  }

  Hero.config = {
    WIDTH: 20,
    HEIGHT: 20,
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
      }

      if (this.moveBack) {
        this.direction = -1;
      } else {
        this.direction = 1;
      }
    },

    draw: function(interpolation) {
      var xPos = this.xPos;
      var angle = this.angle;

      if (this.canMove) {
        var xPos = this.xPos + this.speed * interpolation * this.direction;
      }
      
      this.canvasCtx.drawImage(this.image, xPos, this.yPos, this.config.WIDTH, this.config.HEIGHT);
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
    this.speed = 10;
    this.velocity = 2;

    this.xPos = xPos || 0;
    this.yPos = 480 - this.config.HEIGHT;

    this.canMove = false;
    this.onPosition = (onPosition === false) ? false : true;
      
    if (!this.onPosition) {
      this.canMove = true;
      this.targetXPos = this.xPos;
      this.xPos = this.targetXPos + 200;
      // this.speed = 20;
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
          // console.log(this.xPos, this.targetXPos);
          this.canMove = true;

        /**
         * FIX CALCULATING POSITION FOR NEW PLATFORM 
         */

        if (this.xPos - this.speed / 2 <= this.targetXPos) {
          console.log('not on target pos', this.xPos, this.targetXPos);
          this.xPos = this.targetXPos;
          this.onPosition = true;
          this.canMove = false;
        } else {
          // this.speed += this.velocity;
          // console.log(this.xPos);
          // this.xPos = this.xPos - this.speed * 1.5;
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
      return this.xPos > 0;
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
    this.heightIncreaseSpeed = 8;
    this.speed = 10;
    this.velocity = 1.04;
    this.angle = 0;
    this.angleDelta = 3;

    this.isGrowthStarted = false;
    this.isFallStarted = false;
    this.isFallCompleted = false;
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

        if (this.angle + this.angleDelta >= 90) {
          this.angle = 90;
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
      } else {
        this.canvasCtx.drawImage(this.image, xPos, this.yPos, this.width, height);
      }
    },
  }
  

})();

var game = new Game();