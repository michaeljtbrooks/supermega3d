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
    
    //Identify our overlays 
    this.screen.overlays = { //Contains our various overlay screens
        "skyUnderlay" : $('#pagewrapper'),
        "deadScreen" : $('#respawn')
    };
    //Indentify our head-up-displays (huds)
    this.screen.hud = {
        "currentBallCount" : $('#hud-ammo .current'),
        "maxBallCount" : $('#hud-ammo .max'),
        "nomCount" : $('#hud-noms .current'),
        "notificationHud" : $('#hud-notifications ul')
    };
    //Get our instruction windows:
    this.screen.instructions = $('#instructions'); //Also is our pause screen!
    this.screen.level_select = $('#level-select');
};
SuperMega.Engine.prototype = Object.assign( {}, {
    constructor: SuperMega.Engine,
    screen: {},       //Output to our user
    socket: {},       //Interface to our server
    controls: null,   //Input from our user
    level: null,      //The currently active level
});



