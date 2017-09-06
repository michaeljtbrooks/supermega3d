'use strict';

/**
 * Ultra Geo Man
 * 
 * 
 * Main Engine
 *
 * @author Kevin Fitzgerald / @kftzg / http://kevinfitzgerald.net
 * @author Dr Michael Brooks / @michaeljtbrooks
 * Last Updated: 2017-08-25 21:33 UTC 
 *
 * Copyright 2013 Kevin Fitzgerald + 2017 Michael Brooks
 * 
 */

/**
 * Approach:
 * 
 *  Engine contains everything to interact with user via screen and with server
 *      Screen (to speak to the user)
 *      Socket (to communicate with server)
 *      User account
 *      [Menu mode:]
 *          User's options
 *      [Play level mode:]
 *          Controls
 *          Level
 *              Contents (platforms, power ups, noms, traps, ends, debris etc)
 *              Player
 *                  Camera
 *  
 *  NB: The WebGL is a dynamically added Canvas element which sits underneath all the overlay screens!
 */

//SuperMega Namespace
window.SuperMega = window.SuperMega || {};


var KEYCODE = {
    /**
    * @author Adam Vogel - @adambvogel (http://adamvogel.net)
    */
    'BACKSPACE' : 8,

    'ENTER' : 13,
    'SHIFT' : 16,
    'CTRL' : 17,
    'ALT' : 18,
    'PAUSE_BREAK' : 19,
    'CAPS_LOCK' : 20,
    'ESCAPE' : 27,
    'SPACE' : 32,
    'PAGE_UP' : 33,
    'PAGE_DOWN' : 34,
    'END' : 35,
    'HOME' : 36,

    'LEFT_ARROW' : 37,
    'UP_ARROW' : 38,
    'RIGHT_ARROW' : 39,
    'DOWN_ARROW' : 40,

    'INSERT' : 45,
    'DELETE' : 46,

    '0' : 48,
    '1' : 49,
    '2' : 50,
    '3' : 51,
    '4' : 52,
    '5' : 53,
    '6' : 54,
    '7' : 55,
    '8' : 56,
    '9' : 57,
    'PLUS' : 59,
    'MINUS' : 61,

    'A' : 65,
    'B' : 66,
    'C' : 67,
    'D' : 68,
    'E' : 69,
    'F' : 70,
    'G' : 71,
    'H' : 72,
    'I' : 73,
    'J' : 74,
    'K' : 75,
    'L' : 76,
    'M' : 77,
    'N' : 78,
    'O' : 79,
    'P' : 80,
    'Q' : 81,
    'R' : 82,
    'S' : 83,
    'T' : 84,
    'U' : 85,
    'V' : 86,
    'W' : 87,
    'X' : 88,
    'Y' : 89,
    'Z' : 90,

    'WINDOWS_KEY' : 91,
    'SELECT_KEY' : 93,

    'NUMPAD_0' : 96,
    'NUMPAD_1' : 97,
    'NUMPAD_2' : 98,
    'NUMPAD_3' : 99,
    'NUMPAD_4' : 100,
    'NUMPAD_5' : 101,
    'NUMPAD_6' : 102,
    'NUMPAD_7' : 103,
    'NUMPAD_8' : 104,
    'NUMPAD_9' : 105,
    'NUMPAD_MULTIPLY' : 106,
    'NUMPAD_ADD' : 107,
    'NUMPAD_SUBTRACT' : 109,
    'NUMPAD_DECIMAL_POINT' : 110,
    'NUMPAD_DIVIDE' : 111,

    'F1' : 112,
    'F2' : 113,
    'F3' : 114,
    'F4' : 115,
    'F5' : 116,
    'F6' : 117,
    'F7' : 118,
    'F8' : 119,
    'F9' : 120,
    'F10' : 121,
    'F11' : 122,
    'F12' : 123,

    'NUM_LOCK' : 144,
    'SCROLL_LOCK' : 145,
    'SEMI_COLON' : 186,
    'EQUAL_SIGN' : 187,
    'COMMA' : 188,
    'DASH' : 189,
    'PERIOD' : 190,
    'FORWARD_SLASH' : 191,
    'GRAVE_ACCENT' : 192,
    'OPEN_BRACKET' : 219,
    'BACKSLASH' : 220,
    'CLOSE_BRACKET' : 221,
    'SINGLE_QUOTE' : 222
}; //keycode enum


SuperMega.Engine = function(){
    /**
     * Our Engine
     */
    this.screen = {}; //Our interface to our user
    this.socket = {}; //Our interface to the server
    this.screen.renderer = {}; //Our renderer (whatever that is?!)
    this.play_mode = false; //Flag to see if we're in level play mode
    
    //Check environment:
    this.screen.havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;
    this.screen.hasLock = false; //Start with lock off
    
    //Identify our overlays 
    this.screen.overlays = { //Contains our various overlay screens
        "skyUnderlay" : $('#pagewrapper'),
        "deadScreen" : $('#respawn'),
        "instructions" : $('#instructions'),
        "blocker" : $('#blocker'),
    };
    //Indentify our head-up-displays (huds)
    this.screen.hud = {
        "currentBallCount" : $('#hud-ammo .current'),
        "maxBallCount" : $('#hud-ammo .max'),
        "nomCount" : $('#hud-noms .current'),
        "notificationHud" : $('#hud-notifications ul')
    };
    //Get our Level select:
    this.screen.level_select = $('#level-select');
    
    //Init clock:
    this.clock = new THREE.Clock(); //Clock to watch our frames
    
};
SuperMega.Engine.prototype = Object.assign( {}, {
    constructor: SuperMega.Engine,
    //Object containers
    scene: null, 	//The scene object, is passed down into level, then into player. Created up here!
    screen: {
                renderer: {},
                overlays: {},
                hud: {},
                level_select: null,
                hasLock: false
            },       //Output to our user
    socket: {},       //Interface to our server
    camera: null,     //Convenience pointer to the camera
    clock: null,	  //Our clock object to watch frames (and calc delta)
    controls: null,   //Input from our user
    keys: {},         //Storing which keys are down
    key_toggle_watchers: {}, //Storing which keys are disabled until next press (??deprecated)
    level: null,      //The currently active level
    player: null,     //Our local player (stays active across levels)
    renderer: null,    //WebGL renderer
    KEYCODE : KEYCODE   //Provides keycodes inside object
});
SuperMega.Engine.prototype.enter_play_mode = function(){
    /**
     * Activates the relevant events for playing the level, such as controls
     * 
     */
    //Bind events to screen elements
    //Pointer lock controls
    if(this.screen.havePointerLock){
        $(document).on( 'pointerlockchange', this.toggle_pointer_lock);
        $(document).on( 'mozpointerlockchange', this.toggle_pointer_lock);
        $(document).on( 'webkitpointerlockchange', this.toggle_pointer_lock);
        
        $(document).on( 'pointerlockerror', this.error_pointer_lock);
        $(document).on( 'mozpointerlockerror', this.error_pointer_lock);
        $(document).on( 'webkitpointerlockerror', this.error_pointer_lock);
        
        this.screen.overlays.instructions.on("click", this.toggle_pointer_lock); //The instruction screen will only take a click when it's shown!!
    }else{ //Show pointer lock not supported error msg
        this.screen.overlays.instructions.html('Your browser doesn\'t seem to support Pointer Lock API - Try <a href="https://www.google.co.uk/chrome/browser/desktop/index.html" title="Get Google Chrome">Google Chrome</a>');
        this.screen.overlays.blocker.show(0);
        this.screen.overlays.instructions.show(0);
    }
    // Gaming controls:
    $(window).on( 'resize', this.on_window_resize);
    $(window).on( 'keydown', this.on_key_down);
    $(window).on( 'keyup', this.on_key_up);
    $(document).on( 'mouseup', this.on_mouse_up);
    $(document).on( 'mousemove', this.on_mouse_move);
    $(document).on( 'mousewheel', this.on_mouse_scroll);
    
    //Set flag
    this.play_mode = true;
    //Clock start is dealt with when pointerlock gets engaged
    
    //Set up scene handling items (we do this up at the Engine level so we can do cut-scenes and other cool animations)
    //TODO: Scene creation etc
}
SuperMega.Engine.prototype.exit_play_mode = function(){
    /**
     * Unbinds the level play events
     */
    //Pointer lock controls
    if(this.screen.havePointerLock){
        $(document).off( 'pointerlockchange', this.toggle_pointer_lock);
        $(document).off( 'mozpointerlockchange', this.toggle_pointer_lock);
        $(document).off( 'webkitpointerlockchange', this.toggle_pointer_lock);
        
        $(document).off( 'pointerlockerror', this.error_pointer_lock);
        $(document).off( 'mozpointerlockerror', this.error_pointer_lock);
        $(document).off( 'webkitpointerlockerror', this.error_pointer_lock);
        
        this.screen.overlays.instructions.off("click", this.toggle_pointer_lock); //The instruction screen will only take a click when it's shown!!
    }else{ //Show pointer lock not supported error msg
        this.screen.overlays.blocker.hide(0);
        this.screen.overlays.instructions.hide(0);
    }
    // Gaming controls:
    $(window).off( 'resize', this.on_window_resize);
    $(window).off( 'keydown', this.on_key_down);
    $(window).off( 'keyup', this.on_key_up);
    $(document).off( 'mouseup', this.on_mouse_up);
    $(document).off( 'mousemove', this.on_mouse_move);
    $(document).off( 'mousewheel', this.on_mouse_scroll);
    
    //Set flag
    this.play_mode = false;
    this.clock.stop();
}
SuperMega.Engine.prototype.is_pointer_lock_active = function(){
	/**
	 * Determines whether the pointerlock is active or not
	 * 
	 * @return: <Boolean> true if pointer_lock active
	 */
	var element = document.body;
	if ( document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element ) {
		//Pointer_lock is ON!
	    this.screen.hasLock = true;
	    return true;
	}
	this.screen.hasLock = false;
	return false;
};
SuperMega.Engine.prototype.toggle_pointer_lock = function(e){
	/**
	 * Turns the pointer lock on or off.
	 * 
	 * @param e: Event passed in from a bound trigger
	 */
	var element = document; //We exit using document.exitPointerLock, not the canvas!
	if(!this.is_pointer_lock_active){ //Lock OFF
		//Turn lock on
		element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock; //Cross browser compat
		element.requestPointerLock();
	} else { //Lock ON
		//Lock is on, turn it off
		element.exitPointerLock = element.exitPointerLock || element.mozExitPointerLock || element.webkitExitPointerLock; //Cross browser compat
		element.exitPointerLock();
	}
	
	//Now check the status and update our display accordingly
	if(!this.is_pointer_lock_active){ //Lock is now off, show the instructions window
		this.screen.hasLock = false;
		this.clock.stop(); //Stop our rendering clock
		this.screen.overlays.blocker.show(0);
		this.screen.overlays.instructions.show(0);
	}else{ //Lock is now on, hide instructions overlay
		this.screen.hasLock = true;
		this.clock.start(); //Start our rendering clock
		this.screen.overlays.instructions.hide(0);
		this.screen.overlays.blocker.hide(0);
	}
};
SuperMega.Engine.prototype.on_window_resize = function(e){
    /**
     * When the user changes their window size
     * 
     * @param e: Javascript event
     * 
     */
    var play_window = window;
    var SCREEN_WIDTH = play_window.innerWidth;
    var SCREEN_HEIGHT = play_window.innerHeight;
    if(this.camera){ //Resize camera view
        this.camera.resize(play_window);
    }
    
    //Tweak renderer and controls
    this.renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
    if (!this.camera.chaseCamEnabled) { //We only alter controls if free-lock is enabled
        this.controls.handleResize();
    }
};
//------ Key Handling -----
SuperMega.Engine.prototype.on_key_down = function(e){
    /**
     * Handles keyboard input
     * 
     * @param e: Javascript event
     */
    if(!this.screen.hasLock){ //We don't move character if not locked
        //TODO: Allow player to un-escape out of the pause
        return false;
    }
    this.keys[event.keyCode] = true;
};
SuperMega.Engine.prototype.on_key_up = function(e){
	/**
	 * Detects when a key is released
	 * 
	 * @param e: Javascript event
	 */
	
	// Disable the key code
    this.keys[event.keyCode] = false;

    // Disable any holds that were active on the key, waiting for the key to be released
    if (this.key_toggle_watchers[event.keyCode] !== null) {
        this.key_toggle_watchers[event.keyCode] = false;
    }
};
SuperMega.Engine.prototype.is_wait_required = function(key){
	/**
	 * Detects if a key is ready to be pressed again
	 * 
	 * @param key: they keycode for the keyboard key we are asking about
	 * @return: <Boolean>
	 */
	if(this.key_toggle_watchers[key]){
		return this.key_toggle_watchers[key];
	}
	//No hold ever set. Thus must be false!
	return false;
};
SuperMega.Engine.wait_required = function(key, timeout){
	/**
	 * Blocks a key, marking it not to be used until it is released
	 * @param key: Key to block
	 * @param timeout: Optional - How long to wait to automatically release the lock if the player doesn't get off the keyboard
	 */
	this.key_toggle_watchers[key] = true;
	
    // If a timeout was specified, automatically release the lock after the timeout
    var self = this;
	if (timeout !== null && timeout > 0) {
        setTimeout(function() { self.key_toggle_watchers[key] = false; }, timeout);
    }
};
SuperMega.Engine.is_key_down = function(args){
    /**
     * Sees if a key is depressed
     * 
     * @param args: {int} The keycode(s) we're checking, can check a whole list if you'd like
     * @returns: {Boolean} if key is down or not
     */
    //Grab the key definitions
    var keys = this.keys; //Our var to watch the keys
    // If just one key is to be checked
    if (typeof args === 'number') { 
        // 'args' is a single key, eg. KEYCODE.A : 65
        if (keys[args] !== null) {
            // Return whether the given key is down
            return keys[args];
        } else {
            return false;
        }
    } else if ( (typeof args === 'object' ) && args.isArray ) {
        // 'args' is a an array of keys
        // Verify all are down or fail
        for (var i=0; i<args.length; i++) {
            if ((keys[args[i]] !== null) && (keys[args[i]])) {
                // do nothing, keep looping
            } else {
                // if any of the keys are null or not down
                return false;
            }
        }
        // all keys are down
        return true;  
    } else {
        // Nothing to do
        return false;
    }
}
//----- Mouse Handling -----
SuperMega.Engine.prototype.on_mouse_up = function(e){
	/**
	 * User releases the mouse button
	 * 
	 * @param e: Javascript event
     */
	
    if(!this.screen.hasLock){ //We don't fire if no lock
        //TODO: Allow player to un-escape out of the pause
        return false;
    }
    
    //Don't propagate
    e.preventDefault();
    
    // Fire ball if player not dead
    if (player.hp > 0) {
        // Throw a ball!
        this.player.throw_ball(this.socket,this.level); //Need to transmit the socket in!
    }
};
SuperMega.Engine.prototype.on_mouse_move = function(e){
	/**
	 * Occurs when the player moves the mouse
	 * Adapted on code obtained from Adam Vogel / @adambvogel (http://adamvogel.net)
	 * 
	 * @param e - DOM event
	 */
	if(!this.screen.hasLock || !this.player){ //Disregard if no pointer lock or no player
        //TODO: Allow player to un-escape out of the pause
        return false;
    }
	var position_for_broadcast = this.player.mouse_move(e); //Rotates the player!
	//this.socket.broadcast_position(position_for_broadcast);
};
SuperMega.Engine.prototype.render = function(){
	/**
	 * Core play_mode engine loop!
	 * 
	 * Renders one frame of a level.
	 * 
	 * 
	 */
	if(!this.play_mode){ //Do nothing if not in play mode
		return false;
	}
	
	//Get delta!
	var delta = this.clock.getDelta();
	
	//Run the physics if we are activated and level is loaded
	var level = this.level;
	if(level.loaded && (this.screen.hasLock || !this.play_continues_while_paused)){
		if(!level.complete){
            //Animate items
            this.animate(delta);
            // Simulate physics
            this.scene.simulate(delta);
        }else{ //Level finished!! Spin camera around
            this.animate_level_complete(delta);
        }
	}
	
	//Render whatever happens (whether paused or not)
	if(level.background_scene){ //Render level's background first
		this.renderer.render(level.background_scene, level.background_camera);
	}
	this.renderer.render( scene, camera ); //Render main object action
	requestAnimationFrame(this.render); //Go to next frame (loop)
};
SuperMega.Engine.prototype.animate_level_complete = function(delta){
	/**
	 * Runs the Level Complete sequence
	 * (just the Camera spinning around the character and level end)
	 * 
	 *  @param delta: The time in ms since last render frame
	 * 
	 */
	this.player.rotateOnAxis( new THREE.Vector3(0,0,1), this.ANGLE_SPEED*delta);
    this.player.__dirtyRotation = true;
    this.player.__dirtyPosition = true;
};
SuperMega.Engine.prototype.animate = function(delta){
    /**
     * Animates in play mode
     * 
     * @TODO: Build this
     */
    var self = this;
    if(!self.screen.hasLock){
            return; //Bail out this animate loop if we're not locked
    }
    
    //Handle user input
    this.user_input_to_player_movement(delta);
    
    //Animate level contents (ensures moving platforms move etc)
    this.level.animate(delta); //Also animates the day/night cycle in level
    
    
};
SuperMega.Engine.prototype.user_input_to_player_movement = function(delta){
	/**
	 * Moves player based upon the inputs from the user
	 * Should only be called in play mode
	 * 
         * @param delta: {float} Time since last frame
         * 
	 * @TODO: build this
	 */
    //Init
    var self = this;
    var player = this.player;
    var level = this.level;
    var socket = this.socket;
    
    //Deal with DEAD situation:
    if(this.player.hp <= 0){
        //You're dead:
        if (this.is_key_down(KEYCODE.ENTER)) {
            // Don't accept another ENTER keystroke until the key has been released
            if (!this.is_wait_required(KEYCODE.ENTER)) {

                // Block the ENTER key
                this.wait_required(KEYCODE.ENTER);

                // Tell the server the player wants to respawn
                player.respawn(level);
                level.respawn(); //Rebuilds life-based collectables
                socket.emit('respawn');

                // Remove the dead overlay
                this.screen.deadScreen.hide();
            }
        }
    }
    
    
    //Set movement flags based upon keys that are down
    //##HERE##
};


