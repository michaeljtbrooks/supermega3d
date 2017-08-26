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
    
    
    //Bind events to screen elements
    if(this.screen.havePointerLock){
	    document.addEventListener( 'pointerlockchange', this.pointerlockchange, false );
	    document.addEventListener( 'mozpointerlockchange', this.pointerlockchange, false );
	    document.addEventListener( 'webkitpointerlockchange', this.pointerlockchange, false );
	
	    document.addEventListener( 'pointerlockerror', this.pointerlockerror, false );
	    document.addEventListener( 'mozpointerlockerror', this.pointerlockerror, false );
	    document.addEventListener( 'webkitpointerlockerror', this.pointerlockerror, false );
	    
	    this.screen.overlays.instructions.on("click", this.toggle_pointer_lock); //The instruction screen will only take a click when it's shown!!
    }else{ //Show pointer lock not supported error msg
    	this.screen.overlays.instructions.html('Your browser doesn\'t seem to support Pointer Lock API - Try <a href="https://www.google.co.uk/chrome/browser/desktop/index.html" title="Get Google Chrome">Google Chrome</a>');
    	this.screen.overlays.blocker.show(0);
		this.screen.overlays.instructions.show(0);
    }
};
SuperMega.Engine.prototype = Object.assign( {}, {
    constructor: SuperMega.Engine,
    screen: {},       //Output to our user
    socket: {},       //Interface to our server
    controls: null,   //Input from our user
    level: null,      //The currently active level
});
SuperMega.Engine.prototype.is_pointer_lock_active = function(){
	/**
	 * Determines whether the pointerlock is active or not
	 * 
	 * @return: <Boolean> true if pointer_lock active
	 */
	var element = document.body;
	if ( document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element ) {
		//Pointer_lock is ON!
		return true;
	}
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


