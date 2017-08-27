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

SuperMega.Engine = function(){
    /**
     * Our Engine
     */
    this.screen = {}; //Our interface to our user
    this.socket = {}; //Our interface to the server
    this.screen.renderer = {} //Our renderer (whatever that is?!)
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
    
};
SuperMega.Engine.prototype = Object.assign( {}, {
    constructor: SuperMega.Engine,
    //Object containers
    screen: {
                renderer: {},
                overlays: {},
                hud: {},
                level_select: null,
                hasLock: false
            },       //Output to our user
    socket: {},       //Interface to our server
    camera: null,     //Convenience pointer to the camera
    controls: null,   //Input from our user
    keys: [],         //Array for storing which keys are down
    level: null,      //The currently active level
    player: null,     //Our local player (stays active across levels)
    renderer: null    //WebGL renderer
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
		this.level.clock.stop(); //Stop our rendering clock
		this.screen.overlays.blocker.show(0);
		this.screen.overlays.instructions.show(0);
	}else{ //Lock is now on, hide instructions overlay
		this.screen.hasLock = true;
		this.level.clock.start(); //Start our rendering clock
		this.screen.overlays.instructions.hide(0);
		this.screen.overlays.blocker.hide(0);
	}
};
SuperMega.Engine.prototype.on_window_resize(e){
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
}
SuperMega.Engine.on_key_down(e){
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
}

