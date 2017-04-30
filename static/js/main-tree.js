'use strict';

/**
 * WebGL Ball Game Client
 *
 * @author Kevin Fitzgerald / @kftzg / http://kevinfitzgerald.net
 * @author Dr Michael Brooks / @michaeljtbrooks
 * Last Updated: 2017-04-23 22:12 UTC 
 *
 * Copyright 2013 Kevin Fitzgerald + 2017 Michael Brooks
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http: *www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

//Add in smart print declaration of values to Vector3
THREE.Vector3.prototype.str = function(){
    return "x:"+this.x.toFixed(3)+", y:"+this.y.toFixed(3)+", x:"+this.z.toFixed(3);
}

/**
 * Applies a rotation to a vector in the Z axis to give that vector in terms of the rotated object
 * @param a: <radians> the amount our Z axis has rotated by
 * @return: <THREE.Vector3> with the new values
 */
THREE.Vector3.prototype.applyZRotation3 = function(a){
    var out_vector = new THREE.Vector3();
    out_vector.x = this.x * Math.cos(a) + this.y * Math.sin(a); //Rotational matrix
    out_vector.y = this.y * Math.cos(a) + -this.x * Math.sin(a); //For rotational matrices we use -(sin A)  on the second axis
    out_vector.z = this.z; //Yep, it's simply (0,0,1) for that rotational matrix!
    return out_vector;
}

THREE.Euler.prototype.str = function(){
    return "x:"+this.x.toFixed(3)+", y:"+this.y.toFixed(3)+", x:"+this.z.toFixed(3);
}


// Set physijs's Web Worker script path
Physijs.scripts.worker = 'js/libs/physijs_worker.js';

// Use Detector.js to display the "womp womp" screen if browser sux
if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

// *********************************************************************************************************************
// ***** GLOBAL VARS ***************************************************************************************************
// *********************************************************************************************************************

var DEBUG = true; //Debug mode

    // screen size
var SCREEN_WIDTH = window.innerWidth,
    SCREEN_HEIGHT = window.innerHeight,

    // lighting shadow map sizes
    SHADOW_MAP_WIDTH = 512,
    SHADOW_MAP_HEIGHT = 512,

    // Camera rendering range
    NEAR = 1,
    FAR = 2000,
    chaseScale = 5.5,
    chaseAngle = 0,
    cameraOffset = new THREE.Vector3(0,0,4),

    // Movement speeds
    speed = 8,
    angleSpeed = 1.25,
    MOVE_SPEED = speed*25,

    worldWidth = 64,
    worldDepth = 64,

    // Ball config
    ballCounter = 0,
    currentBallCount = 0,
    maxBallCount = 10,

    // Bitwise flags for elements that can collide (for ammo.js / bullet)
    CollisionTypes = {
        NOTHING: 0,
        BALL: 1,
        PLAYER: 2,
        TREE: 4,
        BODY: 8,	//Means a dead body
        GROUND: 16
    },

    // Collison masks for ammo.js / bullet
    // Masks must reference each other to be effective
    // e.g. ball -> player ; player -> ball
    // http://www.bulletphysics.org/mediawiki-1.5.8/index.php?title=Collision_Filtering
    CollisionMasks = {
        BALL:   CollisionTypes.PLAYER |
                CollisionTypes.TREE |
                CollisionTypes.GROUND,

        PLAYER: CollisionTypes.BALL |
                CollisionTypes.BODY |
                CollisionTypes.TREE |
                CollisionTypes.GROUND,

        TREE:   CollisionTypes.BALL |
        	CollisionTypes.PLAYER, //Cannot walk into trees

        BODY:   CollisionTypes.PLAYER |
                CollisionTypes.GROUND,

        GROUND: CollisionTypes.BALL |
                CollisionTypes.BODY |
                CollisionTypes.PLAYER //Allowing ground to collide with player
    },
    STEPUP_THRESHOLD = 0.80, //How far down an object must hit you to trigger a stepup (NOT ACTIVE)
    PLAYER_HEIGHT = 2, //Our player's height
    PLAYER_WIDTH = PLAYER_HEIGHT / 2,
    PLAYER_DEPTH = PLAYER_HEIGHT / 2,


    // Core scene elements
    camera, controls, scene, renderer,
    clock = new THREE.Clock(),

    // jQuery Selectors / DOM references
    containerDiv, deadScreen,
    hud = {}, notificationHud,

    // Stats plugins
    stats, physicsStats,

    // Flags and interactions
    loaded = false,         // true when pointer lock is enabled and animate has called once
    pauseRotation = DEBUG,  // (pauses light rotation)
    keys = [],              // array for storing which keys are up/down
    chaseCamEnabled = true, // currently only the chase cam works, free look broke
    toggleWatchers = {},    // holds what keys are pressed until they're released

    // Scene elements
    player, balls = {}, players = {},

    // Terrain elements
    ground, hills, water,

    // Lighting elements
    light, light2, lightRig, ambient, moon,

    // Tree geometry and materials, loaded from the model
    treeGeo, treeMats, all_trees = [],
    
    // All collidables:
    all_platforms = [], all_collidables = [], moving_entities=[],
    
    // Collectables and interactables
    all_interactables = [],

    // Client-player info
    playerId, nickname,

    // Networking
    socket, positionToBroadcast = null,

    // Pointer lock stuff
    // (https://github.com/mrdoob/three.js/blob/master/examples/misc_controls_pointerlock.html)
    skyUnderlay,
    blocker = document.getElementById( 'blocker'),
    instructions = document.getElementById( 'instructions'),
    havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;
	
    var hasLock = false; //Lock is off initially (overidden later on in debug mode
    
    var POWER_STATES = { //Show what each power state gives you [standard, orange, yellow, white]
	    "jump" : [50,55,60,65],
	    "move" : [MOVE_SPEED*1.0, MOVE_SPEED*1.2, MOVE_SPEED*1.4, MOVE_SPEED*1.6],
	    "shoot" : [1,2,3,4],
	    "max_gradient" : [1.0,1.3,1.6,1.9],
    }
    var JUMP_BOOST_TIME = 0.20; //Time in seconds where you can depress space up to to boost jump speed
    
    var debug_rays = {}; //See where our rays are pointing

// *********************************************************************************************************************
// ***** POINTER LOCK **************************************************************************************************
// *********************************************************************************************************************

// https://developer.mozilla.org/en-US/docs/WebAPI/Pointer_Lock
// Adapted from https://github.com/mrdoob/three.js/blob/master/examples/misc_controls_pointerlock.html

// If this browser supports pointer lock, let's rock and roll
if ( havePointerLock ) {

    var element = document.body;
    

    // Callback when the pointerlock is obtained or released
    var pointerlockchange = function ( event ) {

        // Check if we got a lock or not
        if ( document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element ) {

            // Update the global lock flag
            hasLock = true;

            // Start the clock
            clock.start();

            // Remove the DOM overlay
            blocker.style.display = 'none';

        } else {

            // Released the lock

            // Update the global lock flag
            hasLock = false;

            // Stop the render clock
            clock.stop();

            // Show the DOM overlay
            blocker.style.display = '-webkit-box';
            blocker.style.display = '-moz-box';
            blocker.style.display = 'box';

            // Show the instructions overlay too
            instructions.style.display = '';
        }
    };

    // If something goes wrong, show the instructions
    var pointerlockerror = function ( event ) {
        instructions.style.display = '';
    };

    // Hook pointer lock state change events
    document.addEventListener( 'pointerlockchange', pointerlockchange, false );
    document.addEventListener( 'mozpointerlockchange', pointerlockchange, false );
    document.addEventListener( 'webkitpointerlockchange', pointerlockchange, false );

    document.addEventListener( 'pointerlockerror', pointerlockerror, false );
    document.addEventListener( 'mozpointerlockerror', pointerlockerror, false );
    document.addEventListener( 'webkitpointerlockerror', pointerlockerror, false );

    // Add click event to the instructions overlay to let the player engage the game
    instructions.addEventListener( 'click', function ( event ) {

        // Hide the instructions
        instructions.style.display = 'none';

        // Ask the browser to lock the pointer
        element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;

//        // If Firefox, request a full screen resize
//        // I thought about puting this back in, but firefox does a poor gl job
//        // as it is, don't want to make things worse by making it render more than it
//        // can handle..
//        if ( /Firefox/i.test( navigator.userAgent ) ) {
//
//            var fullscreenchange = function ( event ) {
//
//                if ( document.fullscreenElement === element || document.mozFullscreenElement === element || document.mozFullScreenElement === element ) {
//
//                    document.removeEventListener( 'fullscreenchange', fullscreenchange );
//                    document.removeEventListener( 'mozfullscreenchange', fullscreenchange );
//
//                    // Get the pointer lock
//                    element.requestPointerLock();
//                }
//
//            };
//
//            document.addEventListener( 'fullscreenchange', fullscreenchange, false );
//            document.addEventListener( 'mozfullscreenchange', fullscreenchange, false );
//
//            element.requestFullscreen = element.requestFullscreen || element.mozRequestFullscreen || element.mozRequestFullScreen || element.webkitRequestFullscreen;
//
//            // Request fullscreen too
//            element.requestFullscreen();
//
//        } else {

            // Otherwise, just get the pointer lock
            element.requestPointerLock();

//        }

    }, false );

} else {

    // Pointer lock not supported to show a "yer browser sux" message
    instructions.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API - Try Google Chrome, or Firefox';

}
//IF debug mode, automatically start:
if(DEBUG && havePointerLock){
	hasLock = true;
	instructions.style.display = "none"; //Hide the instructions
	blocker.style.display = "none"; //Hide the instructions
	pointerlockchange(null);
}


// *********************************************************************************************************************
// ***** INIT TIME *****************************************************************************************************
// *********************************************************************************************************************


/**
 * Initializes the core world and scene
 */
function init() {

    //
    // BIND EVENTS
    //

    window.addEventListener( 'resize', onWindowResize, false );
    window.addEventListener( 'keydown', onKeyDown, false );
    window.addEventListener( 'keyup', onKeyUp, false );
    document.addEventListener( 'mouseup', onMouseUp, false );
    document.addEventListener( 'mousemove', onMouseMove, false );
    $(document).mousewheel( onMouseScroll ) ;

    //
    // DOM ELEMENTS & SELECTORS
    //

    // Create a container for the fps/physics stat monitor
    containerDiv = document.createElement( 'div' );
    document.body.appendChild( containerDiv );

    // Overlays
    skyUnderlay = $('#pagewrapper');
    deadScreen = $('#respawn');

    // Hud setup
    hud.currentBallCount = $('#hud-ammo .current');
    hud.maxBallCount = $('#hud-ammo .max');
    hud.nomCount = $('#hud-noms .current');
    notificationHud = $('#hud-notifications ul');
    notificationHud.append('<li id="debug-stats"></li>');
    
    //Set nickname:
    /**
     *  Sets the nickname, fires up the game:
     *  
     *  @param nick: <str> The player's nickname
     */
    function set_nickname(nick){
        // Validate the nickname is letters, numbers and between 3 and 15 chars.
        if (nick.match(/^[a-zA-Z0-9_]{3,15}$/)) {
    
            // Check if the socket server was reachable
            if (window.io == null) {
                // Tell the client hte server is down and reload the page
                // Maybe the server crashed
                alert('Hmm. Appears the server is down... might be a fluke :/');
                window.location.reload();
                return;
            }
    
            // Don't allow double submit the form
            $('#loading button').unbind('click');
            $('#loading form').unbind('submit');
    
            // Update the client player's nickname
            nickname = nick;
    
            // Connect to the node server
            connect(nick);
    
            // Remove the nickname screen
            $('#loading .error').hide();
            $('#loading').hide();
        } else {
            // Invalid nickname, show the validation error
            $('#loading .error').show().html('<br/>Name must be 3-10 letters or numbers.')
        }
    }
        
    // Bind up the nickname screen when the dom is ready
    $(document).ready(function(){
        //In debug mode, skip this:
        if(DEBUG){
            set_nickname("test");
        }
	
	// Bind the form submit, so the player can hit ENTER on the nickname text box
        $('#loading form').bind('submit', function(e) {
            e.preventDefault();
            var nick = $.trim($('#nickname').val());
            set_nickname($(this));
        });
        
    });

    // Update the ball counter hud
    hud.currentBallCount.text(maxBallCount - currentBallCount);
    hud.maxBallCount.text(maxBallCount);

    //
    // SCENE SETUP
    //

    // Scene has to be a Physijs Scene, not a THREE scene so physics work
    scene = new Physijs.Scene({ fixedTimeStep: 1 / 60 });
    var level = new SuperMega.Level(scene); //Test it
    scene.loaded = false; //Holds off events and collision detection until loaded
    scene.fog = new THREE.Fog( 0xffffff, 1000, FAR );   // Fog is irrelevant

    // Physics - set gravity and update listener
    scene.setGravity(new THREE.Vector3( 0, 0, -30 ));
    scene.addEventListener(
        'update',
        function() {
            scene.simulate( undefined, 1 );
            physicsStats.update();
        }
    );

    //
    // CAMERA
    //

    // Basic perspective camera
    camera = new THREE.PerspectiveCamera( 45, SCREEN_WIDTH / SCREEN_HEIGHT, NEAR, FAR );

    // I'm being "that guy" and changing the world orientation such that
    // X,Y are the top-down coordinates, and Z is the height off the ground
    // Sorry in advance.
    camera.up.y = 0;
    camera.up.z = 1;


    //
    // LIGHTS
    //

    // Ambient light is 10%
    ambient = new THREE.AmbientLight( 0x202020, 10 );
    scene.add( ambient );

    // Sun lights (two of them for fun reflective patterns
    // This achieves the appearance/art style I'm going for
    light = new THREE.DirectionalLight( 0xffe0bb, 1.0 );
    light2 = new THREE.DirectionalLight( 0xffe0bb, 1.0 );

    // Moon light to make the "night time" not totally unplayable
    // Stays active during the day too, so essentialyl 3 lights are active
    // during they day cycle
    moon = new THREE.DirectionalLight( 0x999999, 0.6 );

    // Only the main daylight and moon cast shadows
    light.castShadow = true;
    light2.castShadow = false;
    moon.castShadow = true;

    // Update the shadow cameras
    light.shadowCameraNear = -256;
    light.shadowCameraFar = 256;
    light.shadowCameraLeft = -128;
    light.shadowCameraRight = 128;
    light.shadowCameraTop = 128;
    light.shadowCameraBottom = -128;

    moon.shadowCameraNear = -256;
    moon.shadowCameraFar = 256;
    moon.shadowCameraLeft = -128;
    moon.shadowCameraRight = 128;
    moon.shadowCameraTop = 128;
    moon.shadowCameraBottom = -128;

    // Don't show the wire lines of the lights
    // Good for debugging, though
    light.shadowCameraVisible = false;
    light2.shadowCameraVisible = false;
    moon.shadowCameraVisible = false;

    // More shadow configs
    light.shadowBias = .0001;  // 0.0001
    light.shadowDarkness = 0.25; // 0.5
    moon.shadowDarkness = 0.2;
    light.shadowMapWidth = SHADOW_MAP_WIDTH;
    light.shadowMapHeight = SHADOW_MAP_HEIGHT;

    // Create a light rig so lights rotate in tandum, relative to the core object
    lightRig = new THREE.Object3D();
    lightRig.boundRadius = 10;
    lightRig.add(light);
    lightRig.add(light2);
    
    //Set at noon if pauseRotation is on
    if(pauseRotation){
	lightRig.rotation.y = 0-(Math.PI/2); //90deg
    }

    // Add the lights to the scene
    scene.add( lightRig );
    scene.add( moon );

    // Offset the lights in the rig
    light.position.set( 10, 0, 0 );
    light2.position.set(0, 0, 10 );

    // Set the moon overhead position
    moon.position.set(0, 0, 10 );
    moon.lookAt(0, 0, 0);

    // Set the light rig's initial rotation
    lightRig.rotation.x = 0.6807; // middle of northern hemisphere ~39deg N latitude

    //
    // RENDERER
    //

    // Setup the THREE.js gl renderer
    // (opting out of antialias, cuz i don't really want it - or the performance costs of it)
    renderer = new THREE.WebGLRenderer( { antialias: false, alpha: true } );
    renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
    containerDiv.appendChild( renderer.domElement );
    renderer.setClearColor( scene.fog.color, 1 );
    renderer.autoClear = false; // This breaks of FF on mac, apparently (v20)
    renderer.shadowMapEnabled = true;
    renderer.shadowMapSoft =  true;
}


/**
 * Occurs when the user enters a nickname and is ready to connect to the game server
 * @param nickname - The nickname the player entered
 */
function connect(nickname) {

    //
    // SOCKET SETUP
    //

    // Connect to the game server on the same host, different port
    socket = io.connect(window.__ioUrl);

    /**
     * Occurs when the socket establishes a connection with the game server
     * @var object data - The world and player information
     * data => {
     *   player { player_id, nickname, hp, color, start_pos, balls },
     *   ground,
     *   hills,
     *   water,
     *   trees,
     *   players
     * }
     */
    socket.on('connected', function(data) {

        //
        // CONNECTED
        //

        // Update the global player id based on server assignment
        playerId = data.player.player_id;


        /**
         * Occurs when the socket disconnects from the server
         * This could be because the server died or the connection to the server died.
         * @var null data - Not used
         */
        socket.on('disconnect', function(data) {
            // Interrupt the game with the bad news
            alert('Connection dropped - :(');

            // Reload the page since we don't handle graceful reloads or retries
            // socket.io does reconect automatically, however if the server crashes
            // the terrain is going to be brand new, so it'll be totally unreliable
            window.location.reload();
        });

        // Now that we're connected, tell the server the name the player chose
        socket.emit('nickname', nickname);

        // Create the scene based off the world information given from the server
        createScene(data);


        //
        // SETUP STATS COUNTERS
        //

        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.top = '0px';
        stats.domElement.style.zIndex = 100;
        containerDiv.appendChild( stats.domElement );

        physicsStats = new Stats();
        physicsStats.domElement.style.position = 'absolute';
        physicsStats.domElement.style.top = '50px';
        physicsStats.domElement.style.zIndex = 100;
        containerDiv.appendChild( physicsStats.domElement );

    });


    /**
     * Occurs when another client sets/changes their nickname
     * @var object data - The nickname event data
     * data => {
     *   playerId,
     *   nickname
     * }
     */
    socket.on('nicknames', function(data){

        // Update the player object's nickname field
        players[data.playerId].userData.nickname = data.nickname;

        // Update the player's sprite to refect the new name
        updatePlayerSprite(data.playerId);

        // Publish notification to the screen
        addNotification(data.nickname+' connected');
    });


    /**
     * Occurs when another player moves
     * @var object data - The move event data
     * data => {
     *   id,
     *   position: { x, y, z, zRotation }
     * }
     */
    socket.on('moves', function (data) {
        // Update the player's position in the world
        updatePlayer(data.id, data.position);
    });


    /**
     * Occurs when another player throws a ball
     * @var object data - The ball launch data
     * data => {
     *   sourcePlayerId,
     *   force : { x, y, z },
     *   position: { x, y, z },
     *   restitution,
     *   ballId,
     *   color
     * }
     */
    socket.on('fires', function (data) {
        addBall(
            new THREE.Vector3(data.position.x, data.position.y, data.position.z),
            new THREE.Vector3(data.force.x, data.force.y, data.force.z),
            data.restitution,
            data.sourcePlayerId,
            data.color,
            data.ballId);
    });


    /**
     * Occurs when a ball has been removed from the world
     * @var array data - Array of balls to remove
     * data => [ {
     *   playerId,
     *   ballId
     * } ... ]
     */
    socket.on('unfires', function(data){

        for (var i in data) {
            deleteBallById(data[i].playerId, data[i].ballId);
        }
    });


    /**
     * Occurs when another client hits a player
     * @var object data - Hit event data
     * data => {
     *   playerId,
     *   playerSourceId,
     *   velocity,
     *   newHp
     * }
     */
    socket.on('hits', function (data) {

        // Check if the target is now dead (kill event)
        if (data.newHp <= 0) {

            //
            // KILLED
            //

            // Log it to the console in case you were away and wanna see who killed your ass
            console.log(' ** PLAYER ' + data.playerId + ' WAS KILLED BY PLAYER ' + data.playerSourceId + ' ***', data);

            // Names of the sender and receiver
            var sourceName = data.playerSourceId == playerId ? nickname : players[data.playerSourceId].userData.nickname,
                victimName = '';

            // Check if the client is the victim
            if (data.playerId == playerId) {
                // THIS PLAYER IS NOW DEAD
                player.userData.hp = data.newHp;
                victimName = nickname;

                // Show the dead screen
                deadScreen.show();

                // Drop a hilarious dead body clone and hide the original
                dropDeadBody(player);
                player.visible = false;
                player.userData.sprite.visible = false;

            } else {

                // A REMOTE PLAYER IS DEAD
                players[data.playerId].userData.hp = data.newHp;
                victimName = players[data.playerId].userData.nickname;

                // Drop a hilarious dead body clone and hide the original
                dropDeadBody(players[data.playerId]);
                players[data.playerId].visible = false;
                players[data.playerId].userData.sprite.visible = false;
            }

            // Publish a death notification
            addNotification(sourceName +' killed ' + victimName);

        } else {

            //
            // STILL ALIVE
            //

            // Update the target player's HP
            if (data.playerId == playerId) {
                player.userData.hp = data.newHp;
            } else {
                players[data.playerId].userData.hp = data.newHp;
            }
        }

        // Update victim player sprite (hp changes)
        updatePlayerSprite(data.playerId);
    });


    /**
     * Occurs when a player respawns (even self)
     * @var object data - Respawn data
     * data => {
     *   player_id,
     *   hp,
     *   pos
     * }
     */
    socket.on('respawns', function(data) {
        // Check if the client respawned
        if (data.player_id == playerId) {
            // SELF RESPAWN

            // Delete all my balls
            deletePlayerBalls(playerId);

            // Reset hp and position to respawn info
            player.userData.hp = data.hp;
            player.position.x = data.pos.x;
            player.position.y = data.pos.y;
            player.rotation.z = 0;
            initPlayerZ();
            player.__dirtyPosition = true;
            player.__dirtyRotation = true;

            // Show the player model and sprite again (i hide them on death for the bouncy body)
            player.visible = true;
            player.userData.sprite.visible = true;

        } else {
            // REMOTE PLAYER RESPAWN

            // Update HP and position
            players[data.player_id].userData.hp = data.hp;
            updatePlayer(data.player_id, data.pos);

            // Show the player model and sprite again (i hide them on death for the bouncy body)
            players[data.player_id].visible = true;
            players[data.player_id].userData.sprite.visible = false;
        }

        // Update the player sprite to reflect their refreshed HP
        updatePlayerSprite(data.player_id);
    });


    /**
     * Occurs when a new player joins the game (not identified yet tho)
     * @var object data - New player event data
     * data => {
     *   player,
     *   ground,
     *   hills,
     *   water,
     *   trees,
     *   players
     * }
     */
    socket.on('new_player', function (data) {
        // Add the player to the world
        addPlayer(data);
    });


    /**
     * Occurs when a player leaves the server
     * @var int data - Player ID who left
     */
    socket.on('delete_player', function (data) {
        // Attempt to extract the name of the player
        var name = data == playerId ? nickname : players[data].userData.nickname;

        // Publish a disconnect notification
        addNotification(name + ' disconnected');

        // Remove the player from the world
        deletePlayer(data);
    });
}


/**
 * Initializes the terrain, players and the rest of the world that is dependent on the server
 * @param data - Connection info
 */
function createScene(data) {
    
    console.log(data);
    
    //
    // WATER
    //

    // Setup the water material, blue, semi-reflective, semi-transparent
    var planeMaterial = new THREE.MeshPhongMaterial({
        color: 0x4D708A,
        ambient: 0xAFCADE,
        specular: 0xf5f5f5,
        shininess: 100,
        transparent: true,
        opacity: 0.5,
        shading: THREE.FlatShading
    });

    // Create a plane based on the data given from the server
    water = createPlaneFromData(
        data.water.data,
        data.water.worldWidth,
        data.water.worldHeight,
        data.water.width,
        data.water.height,
        planeMaterial,
        data.water.multiplier,
        data.water.subtractor
    );

    // Add the water plane to the scene
    water.castShadow = false;
    water.receiveShadow = true;
    scene.add(water);


    //
    // GROUND
    //

    var groundPhysMaterial = Physijs.createMaterial(
        new THREE.MeshLambertMaterial( { color: 0x557733, shading: THREE.FlatShading } ),
        .8, // high friction
        .4 // low restitution
    );

    // Create a plane based on the data given from the server
    ground = createPlaneFromData(
        data.ground.data,
        data.ground.worldWidth,
        data.ground.worldHeight,
        data.ground.width,
        data.ground.height,
        groundPhysMaterial,
        data.ground.multiplier,
        data.ground.subtractor
    );
 
    // Add the ground to the scene
    scene.add(ground);


    //
    // HILLS
    //

    var hillsPhysMaterial = Physijs.createMaterial(
        new THREE.MeshLambertMaterial( { color: 0xFAD55C, shading: THREE.FlatShading } ),
        .8, // high friction
        .4 // low restitution
    );

    // Create a plane based on the data given from the server
    hills = createPlaneFromData(data.hills.data, data.hills.worldWidth, data.hills.worldHeight, data.hills.width, data.hills.height, hillsPhysMaterial, data.hills.multiplier, data.hills.subtractor );

    // Add the hills to the scene
    scene.add(hills);


    
    //
    // PLATFORMS - 20 random ones!
    //
    for(var pl=0; pl<20; pl++) {
        addPlatform(null, null, null, null); //The internal function will randomise it for us!
    }
    
    // Now 4 MOVING ones!!
    addMovingPlatform({
	    "translation" : new THREE.Vector3(Math.PI/20,Math.PI/20,0),
	    "translation_mode" : "orbiting",
	    "magnitude" : 30
    });
    addMovingPlatform({
	    "translation" : new THREE.Vector3(Math.PI/5,Math.PI/5,0),
	    "translation_mode" : "orbiting",
	    "magnitude" : 20
    });
    addMovingPlatform({
	    "angular_momentum" : new THREE.Vector3(Math.PI/4,0,0),
	    "translation" : new THREE.Vector3(Math.PI/10,Math.PI/10,0),
	    "translation_mode" : "orbiting",
	    "magnitude" : 20
    });
    addMovingPlatform({
	    "translation" : new THREE.Vector3(20,0,0),
	    "translation_mode" : "reciprocating",
	    "magnitude" : 60
    });
    
    //Now a fucking steep platform:
    var steep_platform = addPlatform(null, null, null, new THREE.Euler(-Math.PI/1.5,-Math.PI/1.5,0), false); //Really steep bastard
    steep_platform.material.color.setHex(0xDD33CC); //Pink platform
    
    //Now a huuuuge fucker to test our motions
    addMovingPlatform({
	"translation" : new THREE.Vector3(20,20,0),
	"translation_mode" : "reciprocating",
	"magnitude" : 60,
	"size" : [30,30,100]
    });

    
    //
    // PICKUPS!!!!!
    //
    for(var pu=0; pu<5; pu++) {
	var xPos = (Math.random() * worldWidth*2) - (worldWidth / 1);
	var yPos = (Math.random() * worldDepth*2) - (worldDepth / 1);
        var zPos = intersectGroundObjs(xPos, yPos)[0].point.z + 3; //Find position just above ground 
        var pos = new THREE.Vector3(xPos,yPos,zPos);
        var pup = new SuperMega.Powerup({
            "position" : pos,
            "translation" : new THREE.Vector3(0,0,20),
	    "translation_mode" : "reciprocating",
	    "magnitude" : 10,
        });
        all_interactables.push(pup);
        scene.add(pup);
    }
    
    
    //
    // TRAPS!!!!!
    //
    for(var tp=0; tp<10; tp++) {
	var xPos = (Math.random() * worldWidth*2) - (worldWidth / 1);
	var yPos = (Math.random() * worldDepth*2) - (worldDepth / 1);
        var zPos = intersectGroundObjs(xPos, yPos)[0].point.z + 3; //Find position just above ground 
        var pos = new THREE.Vector3(xPos,yPos,zPos);
        var type = (Math.random()*2);
        if(type<1){ //Make a trap
            var thing = new SuperMega.Trap({
                "position" : pos,
                "translation" : new THREE.Vector3(Math.random()*30-15,Math.random()*30-15,Math.random()*6-3),
        	"translation_mode" : "reciprocating",
        	"magnitude" : 100,
            });
        }else{ //Make a platform
            var thing = new SuperMega.Platform({
                "position" : pos,
                "translation" : new THREE.Vector3(Math.random()*30-15,Math.random()*30-15,Math.random()*6-3),
        	"translation_mode" : "reciprocating",
        	"magnitude" : 100,
        	"preset" : "ice_platform"
            });
        }
        all_platforms.push(thing); //Ensures we can stand on them and behave as solid objects
        moving_entities.push(thing); //Ensures they get animated
        scene.add(thing);
    }
    
    //
    // NOMS!!!!!
    //
    for(var nm=0; nm<10; nm++) {
	var xPos = (Math.random() * worldWidth*2) - (worldWidth / 1);
	var yPos = (Math.random() * worldDepth*2) - (worldDepth / 1);
        var zPos = intersectGroundObjs(xPos, yPos)[0].point.z + 1; //Find position just above ground 
        var pos = new THREE.Vector3(xPos,yPos,zPos);
        var nom = new SuperMega.Nom({
            "position" : pos,
        });
        all_interactables.push(nom); //Ensures we can stand on them and behave as solid objects
        moving_entities.push(nom); //Ensures they get animated
        scene.add(nom);
    }
    
    //
    // The End
    //
    var xPos = (Math.random() * worldWidth*2) - (worldWidth / 1);
    var yPos = (Math.random() * worldDepth*2) - (worldDepth / 1);
    var zPos = intersectGroundObjs(xPos, yPos)[0].point.z + 0.25; //Find position just above ground 
    var pos = new THREE.Vector3(xPos,yPos,zPos);
    var the_end = new SuperMega.TheEnd({
        "position" : pos,
    });
    all_interactables.push(the_end); //Ensures we can stand on them and behave as solid objects
    moving_entities.push(the_end); //Ensures they get animated
    scene.add(the_end);
    
    
    //
    // TREES
    //

    // Init the JSON loader to load up my tree model
    var loader = new THREE.JSONLoader();

    // Load my tree model I made in Blender
    loader.load( "js/models/tree.js", function( geometry, materials ) {

        // Extract the tree geometry
        treeGeo = geometry;

        // Extract the tree materials
        treeMats = new THREE.MeshFaceMaterial( materials );

        // Modify the tree materials
        for (var i in treeMats.materials) {

            // Make the tree look like the rest of the world - FLAT SHADING!
            treeMats.materials[i].shading = THREE.FlatShading;

            // Make the foliage emissive, so they look better at night
            if (i == 0) {
                treeMats.materials[i].emissive = treeMats.materials[i].color;
                treeMats.materials[i].emissive.r *= 0.8;
                treeMats.materials[i].emissive.g *= 0.8;
                treeMats.materials[i].emissive.b *= 0.8;
            }
        }

    // Drop trees where the server said to do so
    for(var i in data.trees) {
        addTree(data.trees[i].x, data.trees[i].y, null, data.trees[i].rotation);
    }
    
    //Store the collidable entities:
    all_collidables = $.merge(all_platforms, all_trees);

    
    
    //
    // PLAYER
    //

    // Setup player material based on color from server
    var playerMaterial = new THREE.MeshPhongMaterial({
            color: data.player.color,
            ambient: data.player.color, // should generally match color
            specular: 0x050505,
            shininess: 100
        }),

        // Simple cube rectangle geometry
        playerGeometry = new THREE.CubeGeometry( 1, 1, 2, 1, 1, 1 ),

        // Create the player as a physics object, to take advantage of physics collisions
        playerPhysMaterials = Physijs.createMaterial(
            playerMaterial,
            .8, // high friction
            .4 // low restitution
        );

    // Create the physics-enabled player mesh
    player = new Physijs.BoxMesh(
        playerGeometry,
        playerPhysMaterials,
        0  //Mass - if >0 player is amenable to gravity. This is not a good idea because we move with translations, not forces!!
    ); //LOCAL PLAYER
    
    //Identity and name for server
    player.userData.id = data.player.player_id;
    player.userData.nickname = nickname;
    
    //Outside reset defaults
    player.body = false;
    player.noms = 0; //Number of noms!!
    
    //Reset routine
    player.reset = function(){
        
        this.ready = false;
    
        // Assign starting properties
        this.userData.hp = 100.0;
        this.isJumping = false; //Not used
        this.velocity = new THREE.Vector3(0,0,0); //Actual velocity relative to player
        this.standing_on_velocity = new THREE.Vector3(0,0,0); //The velocity of the last thing you stood on!
        this.power_state = 0; //Start off at nowt power
        this.jump_keydown_continuously = false; //Space is not being pressed
        
        // Because I decided to make Z vertical (instead of Y)
        this.up.x = 0; this.up.y = 0; this.up.z = 1;
        
        
        //Make real player visible again
        updatePlayerSprite(this.userData.id); //Inits the sprite
        this.visible = true;
        //this.userData.sprite.visible = true;
        // Delete all my balls
        deletePlayerBalls(this.userData.id);

        this.__dirtyPosition = true;
        this.__dirtyRotation = true;
        
        //Remove any straggling bodies:
        if(this.body){
            scene.remove(this.body);
        }
    }
    player.reset();
    
    
    //Create collision ray LocalVectors - these are the directions we'll send the rays off in
    player.ray_dirvectors = [];
    var dirs = [[0, 0, -1], [0, 0, 1], [0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0]];
    for (var i = 0; i < dirs.length; i++) {
        player.ray_dirvectors.push(new THREE.Vector3(dirs[i][0]*(player.geometry.width/2),dirs[i][1]*player.geometry.depth/2,dirs[i][2]*player.geometry.height/2));
    }
    for (var vertexIndex = 0; vertexIndex < player.geometry.vertices.length; vertexIndex++){
	player.ray_dirvectors.push(player.geometry.vertices[vertexIndex]); //Add the rays off to the vertices
    }
    //Index numbers:       0	    1       2        3       4       5           6              7                8                 9                  10               11                12              13
    //z axis perpendicular
    player.ray_names = ["bottom", "top", "front", "back", "left", "right", "leftbacktop", "leftbackbottom","leftfronttop","leftfrontbottom", "rightbackbottom", "rightbacktop", "rightfrontbottom", "rightfronttop"]; //Let's hope the THREE vertex order never changes!!
    player.bottom_vertices = [player.ray_dirvectors[7], player.ray_dirvectors[9], player.ray_dirvectors[10], player.ray_dirvectors[12]]; //Store our vectors with "bottom" in them
    player.bottom_vertices_names = [player.ray_names[7], player.ray_names[9], player.ray_names[10], player.ray_names[12]];
    player.top_vertices = [player.ray_dirvectors[6], player.ray_dirvectors[8], player.ray_dirvectors[11], player.ray_dirvectors[13]]; //Store our vectors with "top" in them
    player.top_vertices_names = [player.ray_names[6], player.ray_names[8], player.ray_names[11], player.ray_names[13]];
    
    //x axis perpendicular
    player.left_vertices = [player.ray_dirvectors[4], player.ray_dirvectors[6], player.ray_dirvectors[7], player.ray_dirvectors[8], player.ray_dirvectors[9]]; //Store our vectors with "left" in them, INCLUDING THE CENTRAL VECTOR (it's a large face!)
    player.left_vertices_names = [player.ray_names[4], player.ray_names[6], player.ray_names[7], player.ray_names[8], player.ray_names[9]];
    player.right_vertices = [player.ray_dirvectors[5], player.ray_dirvectors[10], player.ray_dirvectors[11], player.ray_dirvectors[12], player.ray_dirvectors[13]]; //Store our vectors with "top" in them
    player.right_vertices_names = [player.ray_names[5], player.ray_names[10], player.ray_names[11], player.ray_names[12], player.ray_names[13]];
    
    //y axis perpendicular
    player.front_vertices = [player.ray_dirvectors[2], player.ray_dirvectors[8], player.ray_dirvectors[9], player.ray_dirvectors[12], player.ray_dirvectors[13]]; //Store our vectors with "front" in them, INCLUDING THE CENTRAL VECTOR (it's a large face!)
    player.front_vertices_names = [player.ray_names[2], player.ray_names[8], player.ray_names[9], player.ray_names[12], player.ray_names[13]];
    player.back_vertices = [player.ray_dirvectors[3], player.ray_dirvectors[6], player.ray_dirvectors[7], player.ray_dirvectors[10], player.ray_dirvectors[11]]; //Store our vectors with "back" in them
    player.back_vertices_names = [player.ray_names[3], player.ray_names[6], player.ray_names[7], player.ray_names[10], player.ray_names[11]];
    
    //Organise into dict:
    player.flat_plane_points = {
	"x" : player.left_vertices,
	"-x" : player.right_vertices,
	"y" : player.back_vertices,
	"-y" : player.front_vertices
    }
    player.flat_plane_points_names = {
	"x" : player.left_vertices_names,
	"-x" : player.right_vertices_names,
	"y" : player.back_vertices_names,
	"-y" : player.front_vertices_names
    }
    player.flat_plane_points_directions = {
	"x" : new THREE.Vector3(1,0,0),
	"-x" : new THREE.Vector3(-1,0,0),
	"y" : new THREE.Vector3(0,1,0),
	"-y" : new THREE.Vector3(0,-1,0)
    }
	    
    
    player.caster = new THREE.Raycaster(); //Use one raycaster, save memory!
    
    //Player constants:
    player.PLATFORM_GRACE = 0.15; //Units above a platform you will hover.
    
    //Shadows:
    player.castShadow = true;
    player.receiveShadow = true;
    
    //Velocity management
    /**
     * Adjusts the player's velocity for conservation of momentum if player rotates while moving (most noticable on ice sliding)
     * @param z_rotation_speed: The angular momentum player is rotating by
     */
    player.rotateVelocity = function(z_rotation_speed){
	//Capture old velocities:
	var old_vel = this.velocity.clone();
	//Convert to new velocity. NB if we rotate the player clockwise, our velocities are moving ANTICLOCKWISE relatively, hence an inverse angular momentum
	this.velocity.x = old_vel.x * Math.cos(z_rotation_speed) + old_vel.y * Math.sin(z_rotation_speed); //Rotational matrix. 
	this.velocity.y = old_vel.y * Math.cos(z_rotation_speed) + -old_vel.x * Math.sin(z_rotation_speed); //For rotational matrices we use -(sin A)  on the second axis
	this.velocity.z = old_vel.z; //Yep, it's simply (0,0,1) for that rotational matrix!
    }
    
    
    /**
     * Adjusts the player's base velocity to the platform you are standing on
     * @param platformObj: The object you are standing on
     */
    player.adjustStandingOnVelocity = function (platformObj){
	//Sanity check the platform has returned its velocity (we have to be nearly in contact with it)
	if(!platformObj){
	    return this.standing_on_velocity.clone();
	}
	
	//Check that this platform has velocity:
	var plat_vel = platformObj.object.velocity;
	if(typeof platformObj.object.velocity == "undefined"){ //No velocity stated
	    plat_vel = new THREE.Vector3(0,0,0); //It has ZERO velocity.
	} else {
	    plat_vel = platformObj.object.velocity.clone(); //Copy to thing
	}
	
	//Now we must adjust the standing on velocity to suit
	if(!(plat_vel.x == 0 && plat_vel.y==0 && plat_vel.z ==0 )){
	    //Rotate the velocities into terms of the character. In the end I had to do this manually ffs.
	    //this.standing_on_velocity = new THREE.Vector3();
	    //this.standing_on_velocity.x = plat_vel.x * Math.cos(this.rotation.z) + plat_vel.y * Math.sin(this.rotation.z); //Rotational matrix
	    //this.standing_on_velocity.y = plat_vel.y * Math.cos(this.rotation.z) + -plat_vel.x * Math.sin(this.rotation.z); //For rotational matrices we use -(sin A)  on the second axis
	    //this.standing_on_velocity.z = plat_vel.z; //Yep, it's simply (0,0,1) for that rotational matrix!
	    //Test our new function:
	    this.standing_on_velocity = plat_vel.applyZRotation3(this.rotation.z); //My own function which does the above
	    //console.log("Plat_vel: "+plat_vel.x+","+plat_vel.y+","+plat_vel.z+"  Player vel:"+this.standing_on_velocity.x+","+this.standing_on_velocity.y+","+this.standing_on_velocity.z+" @"+this.rotation.z);
	    //var euler_vel = plat_vel.clone().applyEuler(this.rotation); //This doesn't quite work... why??
	    //console.log("Euler vel: "+euler_vel.x+","+euler_vel.y+","+euler_vel.z)
	} else {
	    this.standing_on_velocity = plat_vel;
	}
	return plat_vel;
    }
    
    
    //Now build a collision detector:
    /**
     * Internal collision detector, uses rays which pass from object centre to vertices. Useful for "after the fact" collision detection
     * 
     * @param otherObjs: The list of objects we are testing a collision for
     * 
     * @return {
     * 		"other_objects" : other_objects we collided with
     *		"rays" : dict of ray:distance to contact
     *	}
     */
    player.detectCollision = function(otherObjs){
	var target_objects = otherObjs || all_collidables; //Default to our all_trees obstacle collection
	var rays_hit = {}; //Dict of what hit what
	var other_objects = [];
	var collision_detected = false;
	var origin_point = this.position.clone();
	
	for (var rayIndex = 0; rayIndex < this.ray_dirvectors.length; rayIndex++){		
    			
    		//Ray creation for point in space from player's origin
    		var ray_name = this.ray_names[rayIndex]; //Human readable name
    		var local_ray_dir = this.ray_dirvectors[rayIndex].clone(); //Grab the vector of this ray relative to the player's object 
    		var global_ray_dir = local_ray_dir.applyMatrix4( this.matrix ); //Convert into a vector relative to the world map
    		var directionVector = global_ray_dir.sub( origin_point ); //Now convert into actual positions in space
    		this.caster.set( origin_point, directionVector.clone().normalize() ); //Create a rays eminating from the player's origin out along the vector 
    		
    		//Now look for collisions
    		var collisionResults = this.caster.intersectObjects( target_objects );
    		if ( collisionResults.length > 0 && collisionResults[0].distance < directionVector.length() ) { //Means this ray collided!
    		    other_objects.push(collisionResults[0].object);
    		    var closest_hit_to_centre = collisionResults[0].distance; //The closest point on the ray from origin which hit the object
    		    var percentage_distance_hit = closest_hit_to_centre/directionVector.length(); //The percentage distance along the ray to the vertex where contact happened 
    		    collision_detected = true;
    		    rays_hit[ray_name] = percentage_distance_hit; //Our output dict
    		    //console.log("Contact: "+ray_name);
    		} else { //Ray did not collide
    		}
    	    }
	
	if(collision_detected){
	    //console.log(rays_hit);
	    return {
		"other_objects" : other_objects,
		"rays" : rays_hit
	    };
	}
	return false;
	
    }
    player.detectCollisions = player.detectCollision; //Alias
    
    /**
     * Detects when you'll collide with something if jumping or falling, so that we can arrest the Z movement by the specified amount
     * This stops you jumping and falling through platforms. It'll also ensure you "hover" just over objects rather than collide with them all the time
     * Uses rays extending from the object above and below
     * 
     * @param otherObjs: The list of objects we are testing a collision for
     * 
     * @return: {
     * 			direction: 1 (up) / -1 (down),
     * 			shortest: <float>, (the distance down or up (depending on standing/falling or jumping) to the nearest object)
     * 			x_gradient: <x_gradient fraction>,
	    		z_gradient: <z_gradient fraction>,
     * 			distances: [<float_dist1>,<float_dist2>,<float_dist3>,<float_dist4>],
     * 			vertices: [<vertex1>,<vertex2>,<vertex3>,<vertex4>]
     * 			vertices_names: [<vertexname1>,<vertexname2>,<vertexname3>,<vertexname4>]
     * 			floor_properties: [<vertex1properties>,<vertex2properties>,<vertex3properties>,<vertex4properties>]
     * }
     */
    player.zCollisionPrediction = function(otherObjs){
	//Order: leftbackbottom, leftfrontbottom, rightbackbottom, rightfrontbottom
	//Sanitise inputs
	var target_objects = otherObjs || all_collidables ; //Default to our all_trees obstacle collection
	
	//Determine direction to use
	if(player.velocity.z>0){ //Player is jumping up
	    var zVertices = player.top_vertices; //Look up instead
	    var direction = new THREE.Vector3(0,0,1); //upwards
	    var vertex_names = player.top_vertices_names;
	} else { //Standing or falling
	    var zVertices = player.bottom_vertices; //Default to looking down
	    var direction = new THREE.Vector3(0,0,-1); //Downwards
	    var vertex_names = player.bottom_vertices_names;
	}
	
	//Create rays which start at each vertex, then head off downwards or upwards
	var vertex_collisions = [];
	var all_floor_properties = []; //Contains the restitution and friction for the floor you are standing on
	var collided_with_objects = []; //The object you are colliding with
	var standing_on_ids = [];
	for(var rayIndex=0; rayIndex < zVertices.length; rayIndex++){ //Only need to test four rays! 
	    var local_vertex = zVertices[rayIndex].clone(); //Grab the vertex
	    var global_vertex = local_vertex.applyMatrix4(this.matrixWorld); //Turn into global position
	    this.caster.set(global_vertex, direction.clone().normalize()); //Set a ray with appropriate direction:
	    
	    var collisionResults = this.caster.intersectObjects(target_objects); //See what the outgoing rays hit
	    if ( collisionResults.length > 0 ) { //Means this ray collided, unsurprising given its infinite length!!
		var collided_with = collisionResults[0];
		var ray_distance = collided_with.distance; //The closest point on the ray from origin which hit the object
		vertex_collisions.push(ray_distance);
		collided_with_objects.push(collided_with);
		standing_on_ids.push(collided_with.object.id); //Add its ID into the list of objects you are standing on
		all_floor_properties.push(collided_with.object.material._physijs); //Allows us to get the friction and restitution of the object! ##HERE##
	    } else { //No collisions of ray with objects / ground
		vertex_collisions.push(Infinity);
		collided_with_objects.push(null);
		all_floor_properties.push({ //Air effectively!
		    "friction":0,
		    "restitution":0,
		})
	    }
	}
	
	//Calculate gradient at your feet - NB we do not bother with the PLATFORM_GRACE as it would apply to both
	var shortest_dist = Math.min.apply(null,vertex_collisions); //Minimum distance of the four points
	var shortest_vertex_index = vertex_collisions.indexOf(shortest_dist); //Finds which vertex has the shortest path to the object
	if(shortest_vertex_index==0){ //Depth of the player is flipped with height, remember? (Y -> Z)
	    var x_grad = (vertex_collisions[2] - shortest_dist)/this.geometry.width;
	    var y_grad = (vertex_collisions[1] - shortest_dist)/this.geometry.height;
	} else if(shortest_vertex_index==1){ 
	    var x_grad = (vertex_collisions[3] - shortest_dist)/this.geometry.width;
	    var y_grad = (0-(vertex_collisions[0] - shortest_dist))/this.geometry.height;
	} else if(shortest_vertex_index==2){ 
	    var x_grad = (0-(vertex_collisions[0] - shortest_dist))/this.geometry.width;
	    var y_grad = (vertex_collisions[3] - shortest_dist)/this.geometry.height;
	} else if(shortest_vertex_index==3){ 
	    var x_grad = (0-(vertex_collisions[1] - shortest_dist))/this.geometry.width;
	    var y_grad = (0-(vertex_collisions[2] - shortest_dist))/this.geometry.height;
	}
	
	
	//Use the closest to touching floor item to deduce friction:
	var floor_properties = all_floor_properties[shortest_vertex_index];
	var standing_on = null; //Default to not standing on stuff
	var hit_touchable = null;
	if(Math.abs(shortest_dist) < 2*player.PLATFORM_GRACE){ //Just come into contact with a platfornm
	    if(player.velocity.z<=0){ //Standing on it
        	    standing_on = collided_with_objects[shortest_vertex_index]; //Resolve what you are standing on
        	    //console.log(standing_on);
	    }
	    //Add in any traps etc with "touched" methods
	    if(typeof collided_with_objects[shortest_vertex_index] !== "undefined"){
		if(typeof collided_with_objects[shortest_vertex_index].object.touched !== "undefined"){
		    var hit_touchable = collided_with_objects[shortest_vertex_index].object;
		}
	    }
	}
	
	
	return {
	    "direction": direction.z, //The Z direction (-1 down, +1 up)
	    "shortest": shortest_dist,
	    "x_gradient": x_grad,
	    "y_gradient": y_grad,
	    "distances": vertex_collisions,
	    "vertices" : zVertices,
	    "vertices_names" : vertex_names,
	    "floor_properties" : floor_properties,
	    "standing_on" : standing_on,
	    "standing_on_ids" : standing_on_ids,
	    "hit_touchable" : hit_touchable
	};
    }
    
    
    /**
     * Detects collisions that are about to happen in the x and y direction.
     * This allows you to detect when you're about to get shoved by a moving platform
     * 
     * @param otherObjs: [<object>] A list of objects to test against
     * @param excludedObjs: [<object>] A list of objects to ignore (e.g. the ones you are standing on!)
     * @param delta: Time since last frame (useful for detecting downstream touched events)
     * @return: {
     * 		"x" : [<collision_object>,<collision_object>,], //Collisions to the LEFT
     * 		"-x" : [<collision_object>,<collision_object>,], //Collisions to the RIGHT
     * 		"x" : [<collision_object>,<collision_object>,], //Collisions to the RIGHT
     * }
     * 
     */
    player.quickCollisionPrediction = function(otherObjs, excludedObjsIds, delta){
	//Sanitise inputs
	var target_objects = otherObjs || all_collidables ; //Default to our all_trees obstacle collection
	var origin_point = this.position.clone();
	
	//Prepare outputs
	var collisions = {};
	
	//console.log("Excluded objs:");
	//console.log(excludedObjsIds);
	
	//Do the ray loop
	for(var k in this.flat_plane_points){
	    collisions[k] = []; //Prepare the output
	    var axis_points = this.flat_plane_points[k];
	    var axis_points_names = this.flat_plane_points_names[k];
	    var direction_player = this.flat_plane_points_directions[k];
	    
	    for(var rayIndex=0; rayIndex < axis_points.length; rayIndex++){
		var local_point = axis_points[rayIndex].clone(); //Grab the point on the surface of the player
		var global_point = local_point.applyMatrix4(this.matrixWorld); //Turn into global position
		var direction = direction_player.applyZRotation3(-this.rotation.z);
		this.caster.set(global_point, direction.clone().normalize()); //Set a ray with appropriate direction
		if(DEBUG){
		    drawRay(String(rayIndex)+k, global_point, direction.clone().normalize());
		}
		
		//Check for collisions
		var collisionResults = this.caster.intersectObjects(target_objects); //See what the outgoing rays hit
		if ( collisionResults.length > 0 ) { //Means this ray collided, unsurprising given its infinite length!!
		    var collided_with = collisionResults[0]; //Each collision result contains: { distance, point, face, faceIndex, indices, object }
		    if(collided_with.distance <= this.PLATFORM_GRACE*5){ //Get close enough, that counts as a collision!
			//Now we monkey-patch a property onto the collision_result object to see if the item was moving relative to you:
			var object = collided_with.object;
			if(excludedObjsIds.indexOf(object.id)!=-1){ //Bail if it's an excluded object (e.g. the ones you are standing on)
			    return collisions;
			}
			var object_velocity = object.velocity;
			// A collision occurs when:
			//		ray_direction.x * (player.velocity.x - rot(platform_velocity.x)) > 0		//In which case, set player.velocity.x = rot(platform_velocity.x)
			// or..		ray_direction.y * (player.velocity.y - rot(platform_velocity.y)) > 0		//In which case, set player.velocity.y = rot(platform_velocity.y)
			if(object_velocity){
			    //console.log("Object velocity: "+object_velocity.str());
			    var object_velocity_rel_player = object_velocity.applyZRotation3(this.rotation.z); 	//Convert the platform's velocity into the player's axis (it'll copy it for us)
			    //console.log("Rotated object velocity: "+object_velocity_rel_player.str());
			} else {
			    var object_velocity_rel_player = 0;
			}
			var x_axis_collision = direction_player.x * (player.velocity.x - object_velocity_rel_player.x); 
			if(x_axis_collision > 0){ //That's a collision in the x axis
			    player.velocity.x = object_velocity_rel_player.x;
			    player.standing_on_velocity.x = 0; //Ensures you'll be swiped off if you're also on a moving platform
			}
			var y_axis_collision = direction_player.y * (player.velocity.y - object_velocity_rel_player.y)
			if(y_axis_collision > 0){ //That's a collision in the y axis
			    player.velocity.y = object_velocity_rel_player.y;
			    player.standing_on_velocity.y = 0;
			}
			//Fire the downstream properties of the thing we collided with
			if(typeof object.touched !== "undefined"){
			    object.touched(delta, player, scene);
			}
			
			
			//Store our collision to return
			collisions[k].push(collided_with); //Add this into our collision dict 
			//debugger;
		    }
		}
	    }
	}
	
	return collisions;
    }
    
    
    /**
     * Increases nom score:
     * @param noms_collected: The number of noms just picked up
     */
    player.get_nom = function(noms_collected){
	noms_collected = noms_collected || 1;
	this.noms += 1;
	hud.nomCount.text(this.noms);
    }

    /**
     * Sets the player's power level to pow
     * 
     * @param pow: <int> the power level from 0-3
     */
    player.POWER_COLOURS = ["0xAA0000","0xBB8800","0xE0E000","0xEAEAEA"]
    player.setPower = function(pow){
	pow = Number(pow);
	if(isNaN(pow)){ //Sanity check
	    return this.power_state;
	}
	if(pow > 3 || pow < 0){ //Ignore it
	    return this.power_state;
	}
	this.power_state = pow;
	this.material.color.setHex(this.POWER_COLOURS[pow]);
	console.log("POWER CHANGE "+pow);
	
	//Deactivate shooting if on lowest power
	if(this.power_state < 1){
	    hud.currentBallCount.text("0");
	    hud.maxBallCount.text("0");
	}else{
	    hud.currentBallCount.text(maxBallCount - currentBallCount);
	    hud.maxBallCount.text(maxBallCount);
	}
	
	return this.power_state;
    }
    player.set_power = player.setPower; //ALIAS
    player.power_up = function(increment){ //Powers the player up!!
	increment = increment || 1;
	var old_power = this.power_state;
	
	//+1 to power
	var new_power = this.setPower(this.power_state+increment);
	
	return (old_power < new_power); //Should return true if power up has happened
    }
    
    /**
     * Injures the player, if player loses all hit points, drops down a power level
     * 
     * @param damage: The amount of hitpoints to deduct from this power state
     */
    player.injure = function(damage){
	this.userData.hp -= damage;
	if(this.userData.hp <= 0){
	    if(this.power_state<=0){ //DEATH!!
		// Drop a hilarious boundy dead body
                this.body = dropDeadBody(this);

                // Hide the normal model
                this.visible = false;
                this.userData.sprite.visible = false;

                // Publish death notification
                addNotification(this.userData.nickname + " was killed.");
                deadScreen.show();
	    } else { //Decrement the power state by 1
		this.setPower(this.power_state-1);
		this.userData.hp = 100; //Restore hps for lower power level
	    }
	    
	}
	// Update the remote player's sprite for the HP changes
        updatePlayerSprite(this.userData.id);
    }
    
    /**
     * Boosts the player's health by the life amount
     * 
     * @param life: The amount of hitpoints to recover
     */
    player.heal = function(life){
	this.userData.hp += life;
	if(this.userData.hp > 100.0){
	    this.userData.hp = 100.0;
	}
	// Update the remote player's sprite for the HP changes
        updatePlayerSprite(this.userData.id);
    }
    
    
    /**
     * Respawns the player
     */
    player.respawn = function(){
	this.heal(100);
	this.reset();
    }

    //Now build a movement anticipator:
    /**
     * Checks that the last movement is ok, or has cause a collision / made a collision worse
     * @param x: the amount Left/Right moved
     * @param y: the amount forward/backwards moved
     * @param z: the amount up/down moved
     * 
     * @return: false if movement is ok, decimal for the ray length if it causes a collision
     */
    player.lastMovementCausesCollision = function(x,y,z){
	var ray_collisions = this.detectCollision().rays;
	for(var key in ray_collisions){
	    var coll_length = ray_collisions[key];
	    if(key.indexOf("left") !== -1 && x>0){ //Means a leftward movement is causing a collision at the left
		return coll_length;
	    }
	    if(key.indexOf("right") !== -1 && x<0){ //Means a rightward movement is causing a collision at the right
		return coll_length;
	    }
	    if(key.indexOf("back") !== -1 && y>0){ //Means a backward movement is causing a collision at the back
		return coll_length;
	    }
	    if(key.indexOf("front") !== -1 && y<0){ //Means a forward movement is causing a collision at the front
		return coll_length;
	    }
	    if(key.indexOf("top") !== -1 && z>0){ //Means an upward movement is causing a collision at the top
		return coll_length;
	    }
	    if(key.indexOf("bottom") !== -1 && z<0){ //Means a downward movement is causing a collision at the bottom
		return coll_length;
	    }
	}
	return false; //Otherwise, the movement will not make things worse
    }


    // Bind handler to detect collisions with own balls -- Doesn't work for detecting collision between player and obstacles
    player.addEventListener( 'collision', function( other_object, relative_velocity, relative_rotation, contact_normal ) {
        // FYI, `this` has collided with `other_object` with an impact speed of `relative_velocity` and a rotational force of `relative_rotation` and at normal `contact_normal`
	console.log("Collision detected by PhysiJS");
        // Only handle this collision if the object was sourced from this player
        if (other_object.userData.sourcePlayerId == playerId) {

            // Notify other clients that this ball has been removed from the world
            socket.emit('unfire', {
                playerId: playerId,
                ballId: other_object.userData.ballId
            });

            // Remove the ball from the scene
            deleteBallById(other_object.userData.sourcePlayerId, other_object.userData.ballId);

            // Give the player a ball back in their inventory
            currentBallCount--;
            hud.currentBallCount.text(maxBallCount - currentBallCount);
        }
        
        
        //Detect collisions with platforms and floors etc... HERE we will deal with touching platforms etc:
        console.log("Player #"+player.id+" touched obj #"+other_object.id);
        
    });

    // Player model should cast and receive shadows so they look pretty
    player.castShadow = true;
    player.receiveShadow = true;
    var LOCAL_PLAYER = player; //Just so it's easy to find!
    

    //
    // CAMERA RIG
    //

    // Rig the camera to the player, so that the camera always moves relative to the player
    player.add(camera);

    // Offset the camera from the player
    camera.position.set(0, 3 * chaseScale, 1 * chaseScale + 1);

    // Point the camera at the player
    // FIXME: Change this to point where the player is looking instead of at the player directly
    //camera.lookAt(scene.position);
    camera.lookAt(player.position);

    // Determine the initial rotational offset based on radius, angle and scale
    var cameraOffset = new THREE.Vector3(0,0,0),
        radius = Math.sqrt((3 * chaseScale) * (3 * chaseScale) + (1 * chaseScale) * (1 * chaseScale)),
        normalizedCameraPos = camera.position.clone().sub(cameraOffset).normalize().multiplyScalar(radius);

    // Init the chase angle
    chaseAngle = Math.asin((normalizedCameraPos.z) / radius);

    // Assign collision masks so useless stuff doesn't cause collisions with the player
    player._physijs.collision_type = CollisionTypes.PLAYER;
    player._physijs.collision_masks = CollisionMasks.PLAYER;

    // Add the player to the scene
    scene.add( player );

    // Init the player's sprite
    updatePlayerSprite(playerId);

    // Set initial x/y, given from the server
    player.position.x = data.player.start_pos.x;
    player.position.y = data.player.start_pos.y;

        
    //Start on power 0:
    player.setPower(0);
    
    // Lock the player to the ground
    initPlayerZ();

    // Tell the other clients we moved (to compensate for the z movement)
    broadcastPosition();

    //
    // SERVER PLAYERS
    //

    // Add players that are already in the server to the world
    var names = [];
    for (var i in data.players) {
        var p = data.players[i];
        if (p.player_id != playerId) {
            addPlayer(p);
            names.push(p.nickname);
        }
    }

    // Publish a notification showing who's in the server already
    if (names.length > 0) {
        addNotification('Player'+(names.length == 1 ? '' : 's')+' '+names.join(', ') + ' '+(names.length == 1 ? 'is' : 'are')+' here.');
    } else {
        addNotification('You are all alone in this server. :(');
    }
    
    
        // Start the render loop
        requestAnimationFrame(render);

        // Watch for balls that fall off into the abyss
        setInterval(ballWatcher, 500);

        // Watch for changes in player position and send to the server, if dirty
        setInterval(sendPosition, 25);

        // Watch for notifications that need to filter off the screen
        setInterval(cycleNotifications, 3000);


        //
        // THAT'S IT FOR SETUP - THE REST IS AUTONOMOUS
        //

    });
}


// *********************************************************************************************************************
// ***** RENDER TIME ***************************************************************************************************
// *********************************************************************************************************************


/**
 * Main render loop - executes once every frame
 */
function render() {

    // Get the time delta since last frame
    var delta = clock.getDelta();

    // Animate the frame
    animate(delta);

    // Update metrics
    stats.update();

    // Simulate physics
    scene.simulate(delta);

    // Render the changes made this frame
    renderer.render( scene, camera );

    // Request the next frame (endless)
    requestAnimationFrame( render );
}


/**
 * Core animation - user interactions handler
 * @param delta - Time since last frame
 */
function animate(delta) {

    // If we don't have a pointer lock yet, don't start rendering yet
    // otherwise indicated we have loaded the first frame under the pointer lock overlay
    if (!hasLock && loaded) {
        return;
    } else if (!loaded) {
        loaded = true;
        scene.loaded=true; //Need to monkey-patch the scene to know we are loaded!!
    }

    // Frame flags and speeds based on time delta
    var playerMoved = false,
        playerSpeed = isKeyDown(KEYCODE.SHIFT) ? speed * 2 * delta : speed * delta,
        playerAngleSpeed = Math.PI / 2 * (isKeyDown(KEYCODE.SHIFT) ? 2*angleSpeed : angleSpeed) * delta;

    var mu = 0.5; //default friction
    var traction = 1; //Default traction
    
    // Only handle user interactions if player is alive
    if (player.userData.hp > 0) {
	
	//Smart motion with velocity:
        //playerMoved = moveIfInBounds(player.velocity.x*delta, player.velocity.y*delta, player.velocity.z*delta) || playerMoved; //Original motion conditionals
        mu = moveIfInBounds2(delta); //Improved collision detection. Detects if you have collided with something, if so undoes the movement you just did and resets the velocities to suit. Returns the friction coefficient of what you are standing on!
        playerMoved = player.hasMoved; //Monkey patched property
        if(player.hasMoved){ //Quick detection to ensure we don't touch things until properly init
            player.ready = true;
        }
        
        //Calculate traction. This is linked to friction, but capped by your ability to push off,
        if(mu>0.5 || mu < 0.01){ //Keep traction sensible!
            var traction = 1;
        } else { 
            var traction = mu*2;
        }
	
        // Move forward
        if (
            (isKeyDown(KEYCODE.W) && !isKeyDown(KEYCODE.S)) ||
            (isKeyDown(KEYCODE.UP_ARROW) && !isKeyDown(KEYCODE.DOWN_ARROW)) // FIXME: This should do verical rotation (mouse replacement)
           ) {
            //playerMoved = moveIfInBounds(0, -playerSpeed,0) || playerMoved;
            player.velocity.y -= POWER_STATES.move[player.power_state] * delta * traction;
        }

        // Move backward
        if ((isKeyDown(KEYCODE.S) && !isKeyDown(KEYCODE.W))) {
            //playerMoved = moveIfInBounds(0, playerSpeed,0) || playerMoved;
            player.velocity.y += POWER_STATES.move[player.power_state] * delta * traction;
        }

        // Strafe LEFT
        if (isKeyDown(KEYCODE.A) && !isKeyDown(KEYCODE.D)) {
            player.velocity.x += POWER_STATES.move[player.power_state] * 0.7 * delta * traction; //Strafing is slower than running
        }

        // Strafe RIGHT
        if (isKeyDown(KEYCODE.D) && !isKeyDown(KEYCODE.A)) {
            //playerMoved = moveIfInBounds(-playerSpeed, 0,0) || playerMoved;
            player.velocity.x -= POWER_STATES.move[player.power_state] * 0.7 * delta * traction;
        }

        // Rotate left
        if (isKeyDown(KEYCODE.LEFT_ARROW) && !isKeyDown(KEYCODE.RIGHT_ARROW)) {
            player.rotateOnAxis( new THREE.Vector3(0,0,1), playerAngleSpeed);
            player.__dirtyRotation = true;
            player.__dirtyPosition = true;
            playerMoved = true;
        }

        // Rotate right
        if (isKeyDown(KEYCODE.RIGHT_ARROW) && !isKeyDown(KEYCODE.LEFT_ARROW)) {
            player.rotateOnAxis( new THREE.Vector3(0,0,1), -playerAngleSpeed);
            player.__dirtyRotation = true;
            player.__dirtyPosition = true;
            playerMoved = true;
        }
        
        //Jump!
        if (isKeyDown(KEYCODE.SPACE)){ //Can only jump if not falling or already jumping
            if((player.velocity.z < 0.5) && (player.velocity.z > -0.5) && !player.isJumping){ //You can only launch off 
                player.isJumping = true;
                player.jump_keydown_continuously = JUMP_BOOST_TIME; //Max duration of keypress in seconds
                player.velocity.z = 0.10*POWER_STATES.jump[player.power_state];
                console.log("JUMP!");
                console.log(player);
            }
            if(player.jump_keydown_continuously>0){ //Increase the jump height the longer you press that key for
        	var z_time_factor = delta;
        	if(z_time_factor > player.jump_keydown_continuously){
        	    z_time_factor = player.jump_keydown_continuously;
        	}
        	player.velocity.z = player.velocity.z + (z_time_factor/JUMP_BOOST_TIME)*0.80*POWER_STATES.jump[player.power_state]; //Increment jump by up to 20% if key held by the 0.15s
        	player.jump_keydown_continuously -= z_time_factor;
            }
        }
        if(keys[KEYCODE.SPACE]===false || player.isJumping === false){
            //Means the jump key has been released, or you've hit something
            player.jump_keydown_continuously = false; //Turn this off
        }
        
        if(isKeyDown(KEYCODE['0'])){ //Test if position moves player
            player.position.x = 0;
            player.position.y = 0;
            player.position.z = 60;
            player.standing_on_velocity = new THREE.Vector3(0,0,0);
        }
        
        if(isKeyDown(KEYCODE['1'])){ //Artificial power up
            player.setPower(0);
        }
        if(isKeyDown(KEYCODE['2'])){ //Artificial power up
            player.setPower(1);
        }
        if(isKeyDown(KEYCODE['3'])){ //Artificial power up
            player.setPower(2);
        }
        if(isKeyDown(KEYCODE['4'])){ //Artificial power up
            player.setPower(3);
        }
        
        

    } else {

        //
        // PLAYER IS DEAD
        //

        // Since the player is dead, they need to hit ENTER to respawn
        if (isKeyDown(KEYCODE.ENTER)) {
            // Don't accept another ENTER keystroke until the key has been released
            if (!isWaitRequired(KEYCODE.ENTER)) {

                // Block the ENTER key
                waitRequired(KEYCODE.ENTER);

                // Tell the server the player wants to respawn
                player.respawn();
                socket.emit('respawn');

                // Remove the dead overlay
                deadScreen.hide();
            }
        }
    }

    // If free-look is enabled, update the camera controls
    if (!chaseCamEnabled) {
        controls.update();
    }

    // If sun rotation is active
    if (!pauseRotation) {

        // Update light matricies
        light.updateMatrixWorld();
        light.target.updateMatrixWorld();
        light2.updateMatrixWorld();
        light2.target.updateMatrixWorld();

        // Rotate the lighting rig
        lightRig.rotation.y -= .001; // time of day

        // Vary the lighting and shadow intensity based on time of day (read: rotation)
        light.intensity = Math.abs(lightRig.rotation.y / Math.PI % 2) < 1 ? Math.min(1.3, Math.sin(Math.abs(lightRig.rotation.y / Math.PI % 2) * Math.PI)*2) : 0
        light2.intensity = Math.abs(lightRig.rotation.y / Math.PI % 2) < 1 ? Math.min(1.3, Math.sin(Math.abs(lightRig.rotation.y / Math.PI % 2) * Math.PI)*2) : 0
        light.shadowDarkness = Math.abs(lightRig.rotation.y / Math.PI % 2) < 1 ? Math.min(0.25, Math.sin(Math.abs(lightRig.rotation.y / Math.PI % 2) * Math.PI)/2) : 0

        // If the light rotation has reached one of the edges, toggle the sky underlay on/off
        // The underlay has css transition, so it looks like the sun fades. YOU LIKE?
        if (Math.abs(lightRig.rotation.y / Math.PI % 2) < 1) {
            skyUnderlay.css('opacity', 0);
        } else {
            skyUnderlay.css('opacity', 1);
        }

    }
    
    
    // Animate moving entities:
    for(var k=0; k < moving_entities.length; k++){
	var item = moving_entities[k];
	item.animate(delta); //Call the method on the entity
    }
    for(var k=0; k < all_interactables.length; k++){
	var item = all_interactables[k];
	item.animate(delta); //Call the method on the entity
    }
    
    
    // If the player has moved
    if (playerMoved || 1) {
	// PLayer locking to terrain now handled in the moveIfInBounds2() function
	// Mark the position as dirty and queue for broadcasting
        broadcastPosition();
    }
    
    //Gyro stabilising our player of in mass physijs mode
    if(player.mass>0){
	player.rotation.y = 0;
	player.rotation.x = 0;
    }
}


// *********************************************************************************************************************
// ***** EVENT LISTENERS ***********************************************************************************************
// *********************************************************************************************************************


/**
 * Occurs when the browser window changes sizes
 */
function onWindowResize() {

    // Update the screen width globals
    SCREEN_WIDTH = window.innerWidth;
    SCREEN_HEIGHT = window.innerHeight;

    // Update the camera aspect to accomdate the new size
    camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
    camera.updateProjectionMatrix();

    // Update the renderer resolution
    renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );

    // Update camera controls if free-look is enabled
    if (!chaseCamEnabled) {
        controls.handleResize();
    }
}


/**
 * Occurs when the player presses a key
 * Adapted on code obtained from Adam Vogel / @adambvogel (http://adamvogel.net)
 * @param event - DOM event
 */
function onKeyDown(event) {

    // Disregard if the pointer lock is not been engaged
    if (!hasLock) {
        return;
    }

    // Add/Enable key to the active array
    keys[event.keyCode] = true;
}


/**
 * Occurs when the player releases a key
 * Adapted on code obtained from Adam Vogel / @adambvogel (http://adamvogel.net)
 * @param event - DOM event
 */
function onKeyUp(event) {

    // Disregard if the pointer lock is not been engaged
    if (!hasLock) {
        return;
    }

    // Disable the key code
    keys[event.keyCode] = false;

    // Disable any holds that were active on the key, waiting for the key to be released
    if (toggleWatchers[event.keyCode] != null) {
        toggleWatchers[event.keyCode] = false;
    }
}


/**
 * Occurs when the player moves the mouse
 * Adapted on code obtained from Adam Vogel / @adambvogel (http://adamvogel.net)
 * @param e - DOM event
 */
function onMouseMove(e) {

    // Disregard if the pointer lock has not been engaged
    if (!hasLock || !player) {
        return;
    }

    // Get the X/Y movement, and do a bunch of MATH!
    var movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0,
        movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0,
        playerHorizontalAngleSpeed = Math.PI / 180 * -movementX*0.5,
        radius = Math.sqrt((3 * chaseScale) * (3 * chaseScale) + (1 * chaseScale) * (1 * chaseScale)),
        currAngle = chaseAngle,
        angleDiff = (movementY / 25)*0.5 / radius,
        newAngle = Math.max(-1.5, Math.min(1.5, currAngle + angleDiff)),
        x = Math.cos(newAngle) * radius,
        y = Math.sqrt(radius * radius - x * x);

    // Invert y if angle is negative
    y = newAngle > 0 ? y : -y;

    // Cap x so that the camera cannot go past the center of the player model
    x = Math.max(x, 0.5);

    // Rotate the camera based on any horizontal movement (easy)
    //var p_rot_before = player.rotation.clone();
    player.rotateOnAxis( new THREE.Vector3(0,0,1), playerHorizontalAngleSpeed );
    //var p_rot_after = player.rotation.clone();
    //console.log(p_rot_before.str() + " > " + playerHorizontalAngleSpeed + " > " + p_rot_after.str());
    player.rotateVelocity(playerHorizontalAngleSpeed);
    removeRays();

    // Update camera position for vertical adjustments
    camera.position.set(camera.position.x, x, y);

    // Check if there is terrain in the line-of-sight to the player
    var cameraWorldPos = (new THREE.Vector3()).getPositionFromMatrix(camera.matrixWorld),
        origin = player.position.clone(),
        direction = cameraWorldPos.clone().sub(origin),
        r = new THREE.Raycaster(origin, direction, 0, radius + 1),
        c = r.intersectObjects([ ground, water, hills ], true);

    // CAMERA-LOS-GROUND-PLAYER collision!
    if (c.length > 0) {

        // FIXME: Adjust camera position so it does not collide with terrain
        // I tried to move the camera in to the point where the collision occurs,
        // on the same angle as it exists regularly, but things get janky and weird
        // so it's on the list to fix for another day.

        // Point in which the camera LoS intersects the ground mesh
        var localCamPos = player.worldToLocal(c[0].point) ; //,
            //length = localCamPos.length(),
            //newLength = length - 1,
            //newLocalCamPos = localCamPos.normalize().multiplyScalar(newLength);

        //console.log('in da ground', radius, shortRadius, normalizedCameraPos.length(), currAngle, newAngle/*, c[0].point, player.position.distanceTo(c[0].point)*/);

        //camera.position.copy(c[0].point);
        //camera.position.copy(localCamPos);
        //camera.position.copy(newLocalCamPos);

    }

    // Apply the camera offset to the new position
    camera.position.add(cameraOffset);

    // Look at the player model
    // FIXME: Should change this to look in the direction the player is looking
    camera.lookAt(new THREE.Vector3(0,0,0));

    // Update the new chase angle
    chaseAngle = newAngle;

    // Dirty up the player cuz of the new rotation
    player.__dirtyRotation = true;
    player.__dirtyPosition = true;

    // Dirty the player posiiton to show realtime rotations
    broadcastPosition();
}


/**
 * Occurs when the user plays with the scroll wheel
 * Adapted on code obtained from Adam Vogel / @adambvogel (http://adamvogel.net)
 * @param event - DOM event
 * @param delta - Wheel delta object
 * @param deltaX - Horizontal delta
 * @param deltaY - Vertical delta
 */
function onMouseScroll(event, delta, deltaX, deltaY) {
    
    // Forget this if the pointer lock is not engaged
    if (!hasLock) {
        return;
    }

    // Calculate the camera radius based current angle / scale
    var radius = Math.sqrt((3 * chaseScale) * (3 * chaseScale) + (1 * chaseScale) * (1 * chaseScale));

    // Check direction
    // Change the scale if chase-cam is enabled, or scale the position if free-looking
    if (deltaY > 0) { // scroll up
        if (!chaseCamEnabled) {
            camera.position.multiplyScalar(1.1);
        } else {
            chaseScale = Math.max(0.05, chaseScale - 0.1);
        }
    } else if (deltaY < 0) { // scroll down
        if (!chaseCamEnabled) {
            camera.position.multiplyScalar(0.9);
        } else {
            chaseScale = Math.min(5, chaseScale + 0.1);
        }
    }

    // Calculate the new angle and new radius
    var newAngle = chaseAngle,
        newRadius = Math.sqrt((3 * chaseScale) * (3 * chaseScale) + (1 * chaseScale) * (1 * chaseScale)),
        x = Math.cos(newAngle) * newRadius,
        y = Math.sqrt(newRadius * newRadius - x * x);

    // Invert y if angle is negative
    y = newAngle > 0 ? y : -y;

    // Cap x such that the camera cannot look past the player model
    x = Math.max(x, 0.5);

    // Update the camera position
    camera.position.set(camera.position.x, x, y);

    // Apply the camera offset
    camera.position.add(cameraOffset);

    // Look at the player model
    // FIXME: Should change this to look in the direction the player is looking
    camera.lookAt(new THREE.Vector3(0,0,0));

    event.stopPropagation();
    event.preventDefault();
}


/**
 * Occurs when the user releases a mouse button
 * @param event - DOM event
 */
function onMouseUp(event) {

    // Disregard if the pointer lock has not been obtained
    if (!hasLock) {
        return;
    }

    // Don't propagate this event
    event.preventDefault();

    // Ignore if the player is dead
    if (player.userData.hp > 0) {
        // Throw a ball!
        throwBall();
    }
}


// *********************************************************************************************************************
// ***** HELPERS *******************************************************************************************************
// *********************************************************************************************************************


/**
 * Adds a REMOTE player to the world
 * @param data - Player data
 */
function addPlayer(data) {

    // Apply the player color to the player material
    // and create the model
    var cubeMaterials = new THREE.MeshPhongMaterial( {
            color: data.color,
            ambient: data.color, // should generally match color
            specular: 0x050505,
            shininess: 100
        }),
        cubeGeo = new THREE.CubeGeometry( 1, 1, 2, 1, 1, 1),
            playerPhysMaterials = Physijs.createMaterial(
            cubeMaterials,
            .8, // high friction
            .4 // low restitution
            ),
        player = new Physijs.BoxMesh(
            cubeGeo,
            playerPhysMaterials,
            0
        ); //THIS IS A REMOTE PLAYER!!

    // Apply user properties to the model
    player.userData.hp = data.hp;
    player.userData.id = data.player_id;
    player.userData.start_pos = data.start_pos;
    player.userData.nickname = data.nickname;
    player.velocity = THREE.Vector3(0,0,0);

    // Listen for collisions with the player to detect when the client player hits the remote player
    player.addEventListener( 'collision', function( other_object, relative_velocity, relative_rotation, contact_normal ) {
        // FYI: `this` has collided with `other_object` with an impact speed of `relative_velocity` and a rotational force of `relative_rotation` and at normal `contact_normal`

        // Only handle collisions for balls the local player fired
        if (other_object.userData.sourcePlayerId == playerId) {

            // Only handle if the remote player is not already dead
            if (player.userData.hp > 0) {

                // Update remote player's hp
                player.userData.hp -= relative_velocity.length();

                // Notify server that the player hit the remote player
                socket.emit('hit', {
                    playerId: player.userData.id,
                    playerSourceId: other_object.userData.sourcePlayerId,
                    velocity: relative_velocity.length(),
                    newHp: player.userData.hp
                });

                // Notify that the ball has been removed from the world
                socket.emit('unfire', {
                    playerId: playerId,
                    ballId: other_object.userData.ballId
                });

                // If the player killed the remote player
                if (player.userData.hp <= 0) {

                    // Drop a hilarious boundy dead body
                    dropDeadBody(player);

                    // Hide the normal model
                    player.visible = false;
                    player.userData.sprite.visible = false;

                    // Publish death notification
                    addNotification(window.nickname +' killed ' + player.userData.nickname);
                }

                // Remote the colliding ball from the scene
                deleteBallById(other_object.userData.sourcePlayerId, other_object.userData.ballId);

                // Give the ball back to the player and update the hud
                currentBallCount--;
                hud.currentBallCount.text(maxBallCount - currentBallCount);

                // Update the remote player's sprite for the HP changes
                updatePlayerSprite(player.userData.id);
            }
        }
    });

    // Players cast and receive shadows
    player.castShadow = true;
    player.receiveShadow = true;

    // Apply collision masks such that players collide with specific things
    player._physijs.collision_type = CollisionTypes.PLAYER;
    player._physijs.collision_masks = CollisionMasks.PLAYER;

    // Set initial X/Y position
    player.position.x = data.pos.x;
    player.position.y = data.pos.y;
    if (data.pos.z == null) {
        // Since z was not given, auto-lock to the ground
        initPlayerZ(player);
    } else {
        player.position.z = data.pos.z;
    }

    // Add the new player to the scene
    scene.add( player );

    // Add the player to the global collection
    players[data.player_id] = player;

    // Update the sprite to show nickname and hp
    updatePlayerSprite(data.player_id);
}


/**
 * Moves a remote player to the given location
 * @param id - ID of the player to move
 * @param { x, y, z, zRotation } position - The position object to move to
 */
function updatePlayer(id, position) {

    // Find the player in the collection
    var p = players[id];
    if (p != null) {

        // Update given 2d position
        p.position.x = position.x;
        p.position.y = position.y;

        // Update the 3d location if given, or zlock ourselves if not set
        if (position.z != null) {
            p.position.z = position.z;
        } else {
            initPlayerZ(p);
        }

        // If the rotation was supplied, set that too
        if (position.zRotation != null) {
            p.rotation.z = position.zRotation;
        }

        // Flag dirty for phyisijs to update physics object location
        p.__dirtyPosition = true;
        p.__dirtyRotation = true;
    }
}


/**
 * Removes a remote player from the world
 * @param id - ID of the player to remove
 */
function deletePlayer(id) {

    // Find the player in the collection
    var p = players[id];
    if (p != null) {

        // Remove the player from the scene
        scene.remove(players[id]);

        // Clear out the player object from the collection
        players[id] = null;
        delete players[id];
    }
}


/**
 * Updates the queued location to send during the next server broadcast
 */
function broadcastPosition() {

    // Extrapolate the current player location and rotation
    positionToBroadcast = {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        zRotation: player.rotation.z
    };
}


/**
 * Broadcasts the queued location of the player to the server
 */
function sendPosition() {

    // If the player position is dirty since last iteration, send it
    if (positionToBroadcast != null) {

        // Send location to the server
        socket.emit('move', positionToBroadcast);

        // Mark position as clean
        positionToBroadcast = null;
    }
}


/**
 * Creates a terrain plane from server-given data
 * @param data - Plane vertex height map
 * @param worldWidth - How wide the plane should be
 * @param worldDepth - How deep the plane should be
 * @param width - The number of vertices the plane width should contain
 * @param height - The number of vertices the plane height should contain
 * @param material - The material to assign the plane
 * @param multiplier - How dramatic the terrain elevation should be
 * @param subtractor - How far vertically to offset the terrain
 * @returns {Physijs.HeightfieldMesh}
 */
function createPlaneFromData(data, worldWidth, worldDepth, width, height, material, multiplier, subtractor) {

    // Put the serialized data point array back into a more performant Float32Array
    var floatData = new Float32Array(data.length);
    for (var i = 0; i < data.length; i++) {
        floatData[i] = data[i];
    }

    // Provision a new three-dimensional plane with the given number of vertices
    var terrainGeometry = new THREE.Plane3RandGeometry( width, height, worldWidth - 1, worldDepth - 1 );

    // Apply the height map data, multiplier and subtractor to the plane vertices
    for ( var i = 0, l = terrainGeometry.vertices.length; i < l; i ++ ) {
        terrainGeometry.vertices[ i ].z = floatData[ i ] * multiplier - subtractor;
    }

    // Update normals and centroids because we hacked the plane geometry
    terrainGeometry.computeFaceNormals();
    terrainGeometry.computeVertexNormals();
    terrainGeometry.computeCentroids();

    // Create the terrain physics mesh - heightfield because it's a perfect fit
    var t = new Physijs.HeightfieldMesh(terrainGeometry, material, 0, worldWidth - 1, worldDepth - 1);

    // Terrain should cast and receive shadows
    t.castShadow = true;
    t.receiveShadow = true;

    // Assign physics collison masks and type so it only causes collisions with specific things
    t._physijs.collision_type = CollisionTypes.GROUND;
    t._physijs.collision_masks = CollisionMasks.GROUND;

    // Return the terrain mesh
    return t;
}


/**
 * Adds a ball to the word with the given appearane and trajectory information
 * @param position - The location to start the ball
 * @param force - The initial force to apply on the ball
 * @param restitution - The bounciness of the ball
 * @param playerId - The player who threw the ball
 * @param color - The color to assign the ball
 * @param ballId - The ID of the ball
 */
function addBall(position, force, restitution, playerId, color, ballId) {

    // Create the ball geometry, apply color and restitution to the material and init the mesh
    var ballGeometry = new THREE.SphereGeometry( 0.25, 6, 6),
        ballMaterial = Physijs.createMaterial(
            new THREE.MeshLambertMaterial( { color: color, shading: THREE.FlatShading } ),
            .8, // high friction
            restitution
        ),
        ball = new Physijs.SphereMesh(
            ballGeometry,
            ballMaterial,
            1.1//,
            //{ restitution: Math.random() * 1.5 }
        );

    // Apply the given position
    ball.position.copy(position);

    // Balls can receive shadows but not cast them (performance)
    ball.receiveShadow = true;
    //bumper.castShadow = true;

    // Because I decided to make Z vertical (instead of Y)
    ball.up.x = 0; ball.up.y = 0; ball.up.z = 1;

    // When the ball has been added to the scene and is ready for business
    // apply the force. This makes it fire reliably.
    // Using applyCentralForce was super unreliable for this purpose
    ball.addEventListener( 'ready', function() {
        ball.applyCentralImpulse(force)
    } );

    // Assign ownership and ID
    ball.userData.sourcePlayerId = playerId;
    ball.userData.ballId = ballId;

    // Assign physics collision type and masks, so it collides only with specific things
    ball._physijs.collision_type = CollisionTypes.BALL;
    ball._physijs.collision_masks = CollisionMasks.BALL;

    // Put the ball in the world
    scene.add( ball );

    // Update matrices
    ball.updateMatrixWorld();
    ball.updateMatrix();

    // Add the ball to the balls collection so I can keep track of it
    balls['p'+playerId+'b'+ballId] = ball;
   
}


/**
 * Fired when the client player wishes to throw a ball
 * 
 * TODO: Need to check for powerup status
 */
function throwBall() {

    // Abandon this request if the player has met or exceeded their ball limit
    //TODO: (or has no powerups!)
    if (currentBallCount >= maxBallCount) {
        return;
    }
    if(player.power_state<1){ //Low power state cannot throw ball
	return;
    }

    // Increment the number of balls in use by the player and update the HUD
    currentBallCount++;
    hud.currentBallCount.text(maxBallCount - currentBallCount);

    // Copy the player's position and randomize the bounciness factor
    var position = player.position.clone(),
     restitution = Math.min(1, Math.max(.4, Math.random() * 1.5));

    // Move the firing location to just above the player's head (1-unit)
    position.z += 2;

    // Determine the initial force to apply based on player vertical angle
    // The higher you look, the farther out it will go (faster, harder)
    // The lower you look, the closer it will go (slower, shorter)
    var ball_init_velocity_factor = POWER_STATES.shoot[player.power_state];
    //var force = new THREE.Vector3(0, -50 + (chaseAngle * 10 * ball_init_velocity_factor), 10 + (-chaseAngle) * 10 * ball_init_velocity_factor)
    var force_forwards = (-30 + (chaseAngle * 4)) * ball_init_velocity_factor; //Original: (-30 + (chaseAngle * 10))
    var force_upwards = (0 + (-chaseAngle) * 50) * ball_init_velocity_factor*0.3; //Original: (10 + (-chaseAngle)*10)
    //if(force_forwards > 5 ){force_forwards=5}; //Stops you throwing balls backwards
    var force = new THREE.Vector3(0, force_forwards, force_upwards);
    var rotation = player.rotation.clone();

    // Apply ball rotation based on the player's current horizontal rotation
    // so the ball moves in the direction the player is facing
    force.applyEuler(rotation);

    // Collect the event data for broadcasting
    var eventData = {
        sourcePlayerId: playerId,
        force: force,
        position: position,
        restitution: restitution,
        ballId: ++ballCounter
    };

    // Broadcast the ball to the other clients
    socket.emit('fire', eventData);

    // Add the ball to the world
    addBall(
        position,
        force,
        restitution,
        playerId,
        player.material.color,
        eventData.ballId);
}


/**
 * Adds a tree model to the world
 * @param x - 2d X location
 * @param y - 2d Y location
 * @param z - 3d Z location
 * @param rotation - Optional Rotation to apply to the tree (if none given, rotation will be random)
 */
function addTree(x, y, z, rotation) {

    var created_objects = []; 
    
    // 3rd dimension to drop the tree
    var zPos = null;

    // If no Z was given, z-lock the position to the terrain
    if (z == null) {

        // Find the top-most intersection with any terrain layer for the given 2d coords
        var c = intersectGroundObjs(x, y);

        // Only allow placing a tree if the location is above terrain and the top-most terrain is not water
        if (c.length == 0 || c[0].object == water) {
            return
        }

        zPos = c[0].point.z;
    } else {
        zPos = z;
    }

    // Create a new tree mesh from the stored geometry and materials loaded from the JSON model
    // Notice this is a non-physics-enabled mesh - this mesh will be added to a physics-enabled parent later)
    var tree = new THREE.Mesh( treeGeo, treeMats );

    // Trees should cast and receive shadows
    tree.castShadow = true;
    tree.receiveShadow = true;

    // Apply rotation or generate one if none is given
    var roationAmt = rotation != null ? rotation : Math.random() * Math.PI;

    // Create Container and hit box geometries
    var treeContainerGeo = new THREE.CubeGeometry(1.25, 1.25, .25, 1, 1, 1),
        treeBoxGeo = new THREE.CubeGeometry(.742, .742, 5, 1, 1, 1),
        treeLeafBoxGeo = new THREE.CubeGeometry(1.38 * 2, 1.64 * 2, 2, 1, 1, 1),

        // Invisible hit box material
        treeBoxMat = Physijs.createMaterial(
            new THREE.MeshPhongMaterial( {
                color: 0x996633,
                transparent: true,
                opacity: 0
            }),
            .8, // high friction
            .4 // low restitution
        ),

        // Parent container which holds hit boxes and tree model
        treeContainer = new Physijs.BoxMesh(
            treeContainerGeo,
            treeBoxMat,
            0
        ),

        // Trunk hit box
        treeBox = new Physijs.BoxMesh(
            treeBoxGeo,
            treeBoxMat,
            0
        ),

        // Foliage hit box
        treeLeafBox = new Physijs.BoxMesh(
            treeLeafBoxGeo,
            treeBoxMat,
            0
        );


    // Assign physics collision type and masks to both hit boxes so only specific collisions apply to trees
    treeBox._physijs.collision_type = CollisionTypes.TREE;
    treeBox._physijs.collision_masks = CollisionMasks.TREE;
    treeLeafBox._physijs.collision_type = CollisionTypes.TREE;
    treeLeafBox._physijs.collision_masks = CollisionMasks.TREE;

    // Apply the given location to the tree container
    treeContainer.position = new THREE.Vector3(x, y, zPos);

    // Add the child meshes to the container
    treeContainer.add(treeBox);
    treeContainer.add(treeLeafBox);
    treeContainer.add(tree);

    // Apply the rotation
    treeContainer.rotation.z = roationAmt;

    // Init hit box rotations to model
    treeBox.rotation.y = 0.104719755;
    treeLeafBox.rotation.z = -0.296705973;

    // Init hit box positions to model
    treeBox.position.add(new THREE.Vector3(.25631, .16644, 5.49535 / 2 ));
    treeLeafBox.position.add(new THREE.Vector3(-0.16796, -0.05714, 4.59859));

    // Add the complete tree to the scene
    scene.add(treeContainer);
    
    //Make a note of our trees:
    all_trees.push(treeBox); //Trunk
    all_trees.push(treeLeafBox); //Leaves
}

/**
 * Adds a Platform to the world for playing with
 * @param x - 2d X location, or none for random
 * @param y - 2d Y location, or none for random
 * @param z - 3d Z location, or non for random
 * @param rotation - Optional Rotation to apply to the tree (if none given, rotation will be random)
 * @param ice - <boolean> false for normal platform, true for ice
 */
function addPlatform(x, y, z, rotation, ice) {

    //See if this platform is made of ice:
    var is_ice = ice != null ? ice : (4 == Math.floor(Math.random() * 5)); //If ice not specified, then it is
    
    // 3rd dimension to drop the tree
    var xPos = null;
    var yPos = null;
    var zPos = null;
    
    if(x == null){
	xPos = x + (Math.random() * worldWidth*2) - (worldWidth / 1);
    } else {
	xPos = x;
    }
    if(y == null){
	yPos = y + (Math.random() * worldDepth*2) - (worldDepth / 1);
    } else {
	yPos = y;
    }

    // If no Z was given, z-lock the position to the terrain + random amount
    if (z == null) {

        // Find the top-most intersection with any terrain layer for the given 2d coords
        var c = intersectGroundObjs(xPos, yPos);

        // Only allow placing a tree if the location is above terrain and the top-most terrain is not water
        if (c.length == 0 || c[0].object == water) { //Mike broke this :-S - need to include water in the intersection!
            return
        }

        zPos = c[0].point.z;
        zPos = zPos + Math.random() * 20; //Now randomise the height above ground a bit
    } else {
        zPos = z;
    }


    // Create Container and hit box geometries
    
    if(!is_ice){ //Do a normal platform
	var platformGeo = new THREE.CubeGeometry(5,10,1); //We're using an older version of Three.js here!
	var platformMat = Physijs.createMaterial(
                new THREE.MeshPhongMaterial( {
                    color: 0x1188AA
                }),
                .5, // moderate friction
                .4 // low restitution
            )
    } else { //ICE platform!
	var platformGeo = new THREE.CubeGeometry(10,10,1); //Bigger ICE platform!
	var platformMat = Physijs.createMaterial(
                new THREE.MeshPhongMaterial( {
                    color: 0xAAEEFF,
                    transparent: true,
                    opacity: 0.6,
                }),
                .1, // v low friction
                .4 // low restitution
            )
    }
    
    
    
    //Check our supermega.platform obj works:
    platformObj = new SuperMega.Platform({
	"material":platformMat,
	"geometry":platformGeo,
	"mass" : 0,
	"position" : new THREE.Vector3(xPos, yPos, zPos),
    	"orientation" : "random"
    });
    

    
    // Add the complete tree to the scene
    scene.add(platformObj);
    
    //Make a note of our platforms in the collision list:
    all_platforms.push(platformObj); //platform, abusing trees for now
    
    return platformObj;
    
    
        // Parent container which holds hit boxes and tree model
    var platformObj = new Physijs.BoxMesh(
            platformGeo,
            platformMat,
            0 //Massless i.e. fixed
        );

    
    //Ensure a floating platform starts with no velocity:
    platformObj.velocity = new THREE.Vector3(0,0,0);
    
    // Assign physics collision type and masks to both hit boxes so only specific collisions apply (currently the same as trees)
    platformObj._physijs.collision_type = CollisionTypes.TREE;
    platformObj._physijs.collision_masks = CollisionMasks.TREE;

    // Apply the given location to the tree container
    platformObj.position = new THREE.Vector3(xPos, yPos, zPos);
    
    // Apply the rotation
    if(rotation!=null){
	platformObj.rotation.x = rotation.x;
	platformObj.rotation.y = rotation.y;
	platformObj.rotation.z = rotation.z;
	//console.log("Platform rotation provided: "+rotation.str());
    } else {
	var x_rotation_amt = (Math.random()-0.5) * 0.2 * Math.PI; //Tilt 
	platformObj.rotation.x = x_rotation_amt; //remaining gravity flat
	var y_rotation_amt = (Math.random()-0.5) * 0.2 * Math.PI;
	platformObj.rotation.y = y_rotation_amt; //remaining gravity flat
	var z_rotation_amt = Math.random() * Math.PI;
	platformObj.rotation.z = z_rotation_amt; //remaining gravity flat
	//console.log("Platform rotation randomised: "+platformObj.rotation.str());
    }
    
    //Platforms have shadows (receiving shadows v important for knowing when player above a platform!!)
    platformObj.castShadow = true;
    platformObj.receiveShadow = true;

    // Add the complete tree to the scene
    scene.add(platformObj);
    
    //Make a note of our platforms in the collision list:
    all_platforms.push(platformObj); //platform, abusing trees for now
    
    return platformObj;
}

/**
 * Creates a MOVING platform
 * Options dict:
 * @param object: A Physijs / THREE.js object
 * @param position: <THREE.Vector3> Where the platform's "origin" is in terms of the scene
 * @param orientation: <THREE.Vector3> The rotational orientation of the object.
 * @param angular_momentum: <THREE.Vector3> the rotational movement of the object (Radians per second) 
 * @param translation: <THREE.Vector3> the translational movement of the object (units per second)
 * @param rotation_mode: <str> "oscillating" | "continuous"
 * @param translation_mode: <str> "oscillating" | "continuous" | "orbiting"
 * @param magnitude: <float> how long a path is (in units), or how wide (radius) an orbiting path
 * @param size: <[array]> Array of sizes x,y,z to make the object
 * @param color: <Hex colour> The colour you wish to set it as
 * @param friction: <float> how much friction the platform should have
 * @param restitution: <float> how stiff it should be on collisions
 */
function addMovingPlatform(options) {
    var final_options = {
	    "object" : options.object || null,
	    "position" : options.position || null,
	    "orientation" : options.orientation || new THREE.Vector3(0,0,0),
	    "angular_momentum" : options.angular_momentum || new THREE.Vector3(0,0,0),
	    "translation" : options.translation || new THREE.Vector3(0,0,0),
	    "rotation_mode" : options.rotation_mode || "continuous",
	    "translation_mode" : options.translation_mode || "reciprocating",
	    "magnitude" : options.magnitude || 0,
	    "size" : options.size || [10,10,1],
	    "color" : options.color || 0xAA8833,
	    "friction" : options.friction || .5,
	    "restitution" : options.friction || .4
    };
    
    if(!final_options.object){ //Create a default platform out of PhysiJS
	var platformGeo = new THREE.CubeGeometry(final_options.size[0],final_options.size[1],final_options.size[2]); //We're using an older version of Three.js here!
	var platformMat = Physijs.createMaterial(
                new THREE.MeshPhongMaterial( {
                    color: final_options.color
                }),
                final_options.friction, // moderate friction
                final_options.restitution // low restitution
        );
        var platformObj = new Physijs.BoxMesh(
            platformGeo,
            platformMat,
            0 //Massless i.e. not affected by gravity
        );
    } else {
	var platformObj = final_options.object;
    }
    
    if(!final_options.position){ //If no position is given, randomise
	var x = null;
	var y = null;
	var z = null;
	var xPos = null;
	var yPos = null;
	var zPos = null;
	if(x == null){
		xPos = x + (Math.random() * worldWidth*2) - (worldWidth / 1);
	    } else {
		xPos = x;
	    }
	    if(y == null){
		yPos = y + (Math.random() * worldDepth*2) - (worldDepth / 1);
	    } else {
		yPos = y;
	    }

	    // If no Z was given, z-lock the position to the terrain + random amount
	    if (z == null) {

	        // Find the top-most intersection with any terrain layer for the given 2d coords
	        var c = intersectGroundObjs(xPos, yPos);

	        // Only allow placing a tree if the location is above terrain and the top-most terrain is not water
	        if (c.length == 0 || c[0].object == water) { //Mike broke this :-S - need to include water in the intersection!
	            return
	        }

	        zPos = c[0].point.z;
	        zPos = zPos + Math.random() * 20; //Now randomise the height above ground a bit
	    } else {
	        zPos = z;
	    }
	platformObj.position = new THREE.Vector3(xPos,yPos,zPos);
    } else {
	platformObj.position.copy(final_options.position);
    }

    //Set other properties
    platformObj.rotation = final_options.orientation;
    platformObj.angular_momentum = final_options.angular_momentum;
    platformObj.translation = final_options.translation;
    platformObj.translation_mode = final_options.translation_mode;
    platformObj.rotation_mode = final_options.rotation_mode; //TODO: support oscillating rotations
    platformObj.magnitude = final_options.magnitude;
    
    // Assign physics collision type and masks to both hit boxes so only specific collisions apply (currently the same as trees)
    platformObj._physijs.collision_type = CollisionTypes.TREE;
    platformObj._physijs.collision_masks = CollisionMasks.TREE;
    
    //Create watchers:
    platformObj.amount_moved = new THREE.Vector3(0,0,0);
    platformObj.velocity = new THREE.Vector3(0,0,0); //will be relative to the MAP not to the Player!!
    platformObj.origin = platformObj.position.clone(); //Where we started (or orbit around!)
    platformObj.rotation_matrix = new THREE.Matrix4(); //Necessary to do axis rotations
    
    //Add in shadows
    platformObj.castShadow = true; //Turn off for speed optimisation
    platformObj.receiveShadow = true;
    
    //Now monkey-patch on the animation capabilities:
    /**
     * platformObj.animate - animates the movement of the platform
     * @param delta: The number of seconds between frames
     */
    platformObj.animate = function(delta){
	//Fast abort for non-movers!
	if(this.magnitude == 0 && this.rotation_mode == null && this.translation_mode == null){
	    return;
	}
	
	//Save current position:
	var pos_before = this.position.clone();
	//Angular_momentum applies to rotation on axis
	this.rotateX(this.angular_momentum.x * delta);
	this.rotateY(this.angular_momentum.y * delta);
	this.rotateZ(this.angular_momentum.z * delta);
	
	//Translation along path
	var tx = this.translation.x*delta;
	var ty = this.translation.y*delta;
	var tz = this.translation.z*delta;
	if(this.translation_mode == "continuous" || this.translation_mode == "reciprocating"){
	    //Check if we actually should continue moving (i.e. have we moved up to the limit yet?)
	    if(this.amount_moved.distanceToSquared(new THREE.Vector3(0,0,0)) < Math.pow(this.magnitude,2)){ //Compare squares (computational efficiency)
		//This is just going to start moving and carry on until we reach the limit
		this.position.x += tx;
		this.position.y += ty;
		this.position.z += tz;
		this.amount_moved.x += Math.abs(tx);
		this.amount_moved.y += Math.abs(ty);
		this.amount_moved.z += Math.abs(tz);
	    } else {
		 if(this.translation_mode == "reciprocating"){
		     //So we've exceeded the single throw distance, let's flip it all around:
		     this.translation = new THREE.Vector3(-this.translation.x,-this.translation.y,-this.translation.z)
		     this.amount_moved = new THREE.Vector3(0,0,0); //Reset our counter:
		 }
	    }
	} else if (this.translation_mode == "orbiting" || this.translation_mode == "orbit") {
	    //Now things get exciting!!! We are ORBITING AROUND the original position. Translation means the rate of progression round the orbit in radians
	    //If you only set one axis translation, it'll oscillate, if you set two it'll orbit in a plane, if you set three, it'll corkscrew orbit
	    this.amount_moved.x = (this.amount_moved.x + tx) % (2*Math.PI); //Wrap around  
	    this.amount_moved.y = (this.amount_moved.y + ty) % (2*Math.PI);
	    this.amount_moved.z = (this.amount_moved.z + tz) % (2*Math.PI);
	    this.position.x = this.magnitude * Math.sin(this.amount_moved.x+0) + this.origin.x; //0 degrees
	    this.position.y = this.magnitude * Math.sin(this.amount_moved.y+Math.PI/2) + this.origin.y; //90 degree out of phase
	    this.position.z = this.magnitude * Math.sin(this.amount_moved.z+Math.PI/2) + this.origin.z; //90 degree out of phase too
	}
	//Calculate velocity:
	this.velocity.x = (this.position.x - pos_before.x)/delta;
	this.velocity.y = (this.position.y - pos_before.y)/delta;
	this.velocity.z = (this.position.z - pos_before.z)/delta;
	
	//Update position for physijs;
	this.__dirtyPosition = true;
	this.__dirtyRotation = true;
    }
    
    //Add it to our moving entities register
    moving_entities.push(platformObj);
    all_platforms.push(platformObj); //Will clip like a platform now!
    
    scene.add(platformObj);
    //console.log("Moving platform:");
    //console.log(platformObj);
    return platformObj;
}


/**
 * Checks whether a key is currently being pressed by the player
 * Adapted on code obtained from Adam Vogel / @adambvogel (http://adamvogel.net)
 * @param args - the given key(s) to check are down
 * @returns {*}
 */
function isKeyDown(args) {
    // If just one key is to be checked
    if (typeof args === 'number') { 
        // 'args' is a single key, eg. KEYCODE.A : 65
        if (keys[args] != null) {
            // Return whether the given key is down
            return keys[args];
        } else {
            return false;
        }
    } else if ( (typeof args === 'object' ) && args.isArray ) {
        // 'args' is a an array of keys
        // Verify all are down or fail
        for (var i=0; i<args.length; i++) {
            if ((keys[args[i]] != null) && (keys[args[i]])) {
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


/**
 * Apply dumb gravity
 * 
 * 
 * @param delta: Time since last frame
 * @param specificPlayer
 */
function playerGravity(delta, specificPlayer){
    // Which player to choose
    var p = specificPlayer || player;
    var z = intersectGround(p.position.x, p.position.y); //Gets the position of the terrain at user's X & Y
    if(player.position.z > (z+1)){ //Apply falling
	player.translateZ(-2*delta);
    }
    p.__dirtyPosition = true;
    p.__dirtyRotation = true;
}

/**
 * Ensures the player doesn't fall through the terrain. Corrects minor sinking problems on the terrain
 * @param specificPlayer - Optional, Remote player to use if given or self if not
 */
function jumpingOrFallingPlayerZ(specificPlayer) {
    
    // Which player to lock
    var p = specificPlayer || player;

    // Attempt to intersect the ground
    var z = intersectGround(p.position.x, p.position.y); //Gets the position of the terrain at user's X & Y

    // If there was an intersection, lock the player z to it
    if (z != null) {
        // Apply a 1 unit diff to the position, to accommodate the player model
        var diff = z - p.position.z + 1 + p.PLATFORM_GRACE; //Work out the difference between player and the ground
        //console.log("z:"+z+" diff:"+diff);
        if(p.velocity.z < 0){ //IF player is around abouts on the surface and falling, move to surface and zero falling 
            if(diff > -p.PLATFORM_GRACE && diff < 15.0){ //Only correct if sinking below ground, or almost touching ground 
        	p.translateZ(diff); //Correct onto ground
        	p.velocity.z = 0; //Stop falling
        	p.isJumping = false;
        	p.standing = true;
        	p.standing_on_velocity = new THREE.Vector3(0,0,0); //The ground is static
            }
        }

        // Since players are physics objects, physijs requires this hack
        p.__dirtyPosition = true;
        p.__dirtyRotation = true;
    }
    
    return specificPlayer;
}

/**
 * Initialises player to the surface
 * 
 * @param specificplayer: - Remote player if given, else local player
 */
function initPlayerZ(specificPlayer) {
    var p = specificPlayer || player;
    // Attempt to intersect the ground
    var z = intersectGround(p.position.x, p.position.y); //Gets the position of the terrain at user's X & Y
    if (z != null) {
        // Apply a 1 unit diff to the position, to accommodate the player model
        var diff = z - p.position.z + 1; //Work out the difference between player and the ground
        p.translateZ(diff);
    }
}


/**
 * Finds the z position in which the given 2d location intersects the ground
 * @param x - Given 2d x
 * @param y - Given 2d y
 * @returns {null|float} - The 3d z intersection with the terrain
 */
function intersectGround(x, y) {

    // Intersect the ground for the given coords
    var c = intersectGroundObjs(x, y);

    // If there is an intersection, return the z from the top-most intersect
    if (c.length > 0) {
        return c[0].point.z;
    }

    // No intersection - return null
    return null;
}


/**
 * Finds the intersections with the terrain for the given 2d location
 * Need to modify for platformer function
 * @param x - Given 2d x
 * @param y - Given 2d y
 * @returns {*} - The raw Raycaster result of intersections with the terrain
 */
function intersectGroundObjs(x, y) {

    // Init raycaster
    var rayLength = 1000,           // look for collisions in a 1000 unit span
        upperZ = rayLength / 2,     // start 500 units above origin
        lowerZ = upperZ * -1,       // go 500 units below origin
        origin = new THREE.Vector3(x, y, upperZ), // offset origin at given 2d coords
        direction = new THREE.Vector3( x, y, lowerZ), // ray direction points from top-down

        // Init the ray caster
        r = new THREE.Raycaster(origin.clone(), direction.clone().sub(origin.clone()).normalize());

    // Return the result of the ray casting
    //return r.intersectObjects($.merge([ ground, water, hills ],all_trees), true); //IntersectObjects is an inherent function in THREE.js
    return r.intersectObjects([ ground, hills ], true); //Only treat hills and soil as ground. Water is transparent!
}


var vertex_names = ["leftbacktop","leftbackbottom","leftfronttop","leftfrontbottom", "rightbackbottom", "rightbacktop", "rightfrontbottom", "rightfronttop"] //xyz in order
/**
 * An improved collision detection engine which reports what bits of the character collided and how deep in
 * @param specificPlayer
 */
function playerBoxTouchingObjs(specificPlayer){
    var p = specificPlayer || player;
    var vertices = {};
    
    //Turn vertices into named points:
    for (var vertexIndex = 0; vertexIndex < player.geometry.vertices.length; vertexIndex++){
	vertices[vertex_names[vertexIndex]] = player.geometry.vertices[vertexIndex];
	
    }
    
    //Create rays  
    
}




/**
 * Determines via rays what you are touching
 * We set rays from player centre out to each vertex. You can use the combination of rays which touch something to determine what bit of the player hit what
 * 
 * There is some grace space at the bottom of the character allowing you to land on objects. We achieve this by "allowing"
 * 
 * @param specificPlayer
 * 
 * @TODO: Calculate the gradient for sliding??
 */
function playerTouchingObjs(specificPlayer){
    // Which player to lock NOW OBSOLETE
    var p = specificPlayer || player;
    
    
    
    var rayLength = 3;
    
    //player.vertices gives a sequence of vertices!
    var named_vertices = {}; //Turn them into vertex names for SANITY!!
    
    //Create rays:
    var vertices_hit = {}
    var originPoint = player.position.clone();
    var collision_detected = false; //Determines if one collision of any kind has happened
    var stepup = false; //Determines if the collisions are consistent with "stepping up"
    
    if(0){
        //First try the ray collision engine
        for (var vertexIndex = 0; vertexIndex < player.geometry.vertices.length; vertexIndex++){		
        	var vertex_collision = false;
        	var this_vertex_name = vertex_names[vertexIndex]; //Human readable name
        	var localVertex = player.geometry.vertices[vertexIndex].clone();
        	var globalVertex = localVertex.applyMatrix4( player.matrix );
        	var directionVector = globalVertex.sub( player.position );
        	
        	var ray = new THREE.Raycaster( originPoint, directionVector.clone().normalize() );
        	var collisionResults = ray.intersectObjects( all_trees );
        	if ( collisionResults.length > 0 && collisionResults[0].distance < directionVector.length() ) {
        	    var closest_hit_to_centre = collisionResults[0].distance; //The closest point on the ray from origin which hit the object
        	    var percentage_distance_hit = closest_hit_to_centre/directionVector.length(); //The percentage distance along the ray to the vertex where contact happened 
        	    //console.log(" Hit Tree: " + this_vertex_name + " @ dist " + closest_hit_to_centre + " ("+percentage_distance_hit+")");
        	    vertex_collision = percentage_distance_hit;
        	    collision_detected = true;
        	    vertices_hit[this_vertex_name] = vertex_collision; //Our output dict
        	} else { //Ray did not collide
            }
        }
    }else{
	vertices_hit = p.detectCollisions(); //Returns false if no collision, or true if collision!
	if(vertices_hit!==false){
	    collision_detected=true;
	}
    }
        
    
    //Now process this to come to a conclusion
    var contact_type = false;
    var stepup_amount = 0; //The amount we'll correct the player's Z by if stepping up.
    var percent_from_end = 0; //The amount from the end of a vector a stepup collision is
    if(collision_detected){
	stepup = true; //Assume it's a stepup
	contact_type = "stepup";
	for(var key in vertices_hit){
	    if(key.indexOf("top") !== -1 || vertices_hit[key]<STEPUP_THRESHOLD){ //Means that this is a top point, or its too central
		var stepup = false;
		contact_type = "collision";
		break;
	    }
	    var percent_from_end = (1-vertices_hit[key]); 
	    if(stepup_amount < percent_from_end){ //The largest amount from the far end is our stepup amount 
		stepup_amount = percent_from_end * (PLAYER_HEIGHT/2); //Multiply it by half the player's height to get units stepup required!!
	    }
	}
	//console.log(contact_type);
    }
    
    return { 
		"vertices_hit" : vertices_hit,
		"contact_type" : contact_type,
		"stepup_amount" : stepup_amount
    }
}





/**
 * Checks to see if a key is available to be pressed again.
 * @param key - Keycode to check
 * @returns {*} - Returns true if the key is already down and should block until it is released,
 *                or false if the key is available for use
 */
function isWaitRequired(key) {
    // Check if there is a hold placed on this key
    if (toggleWatchers[key] != null) {

        // Return the status of the hold
        return toggleWatchers[key];
    } else {

        // No hold - so it's available
        return false;
    }
}


/**
 * Blocks a key, marking it not to be used until it is released
 * @param key - Key to block
 * @param timeout - Optional - How long to wait to automatically release the lock if the player doesn't get off the keyboard
 */
function waitRequired(key, timeout) {

    // Add a hold on the key
    toggleWatchers[key] = true;

    // If a timeout was specified, automatically release the lock after the timeout
    if (timeout != null && timeout > 0) {
        setTimeout(function() { toggleWatchers[key] = false; }, timeout);
    }
}


/**
 * Helper to debug where a player is facing by drawing a line in the forward direction
 */
function drawPlayerLazer() {

    // Extrapolate player position and direction
    var origin = (new THREE.Vector3()).getPositionFromMatrix(camera.matrixWorld),
        target = player.position.clone(),
        direction = target.clone().sub(origin),
        dest = target.clone().add(direction);

    // Offset to the top of the player model
    target.z += 1;
    dest.z += 1;

    // Draw a line
    drawLine(target, dest);
}


/**
 * Helper to debug raycasting by drawing the rays
 */
function drawRay(id, origin, direction) {
    return;
    var pointA = origin;
    var direction = direction;
    direction.normalize();

    var distance = 100; // at what distance to determine pointB

    var pointB = new THREE.Vector3();
    pointB.addVectors ( pointA, direction.multiplyScalar( distance ) );
    
    var ray = debug_rays[id];
    if(typeof ray == "undefined" || !ray){
	var geometry = new THREE.Geometry();
	geometry.vertices.push( pointA );
	geometry.vertices.push( pointB );
	var material = new THREE.LineBasicMaterial( { color : 0xff0000 } );
	var line = new THREE.Line( geometry, material );
	scene.add( line );
	debug_rays[id] = line;
    } else {
	ray.geometry.vertices[0] = pointA;
	ray.geometry.vertices[1] = pointB;
	ray.geometry.verticesNeedUpdate = true;
    }
    
}
//Removes the rays again
function removeRays(){
    return;
}


/**
 * Helper to debug where an object is facing by drawing a line in the forward direction
 * @param mesh - Mesh to debug (e.g. ball)
 */
function drawLazer(mesh) {

    // Extrapolate meshes position and direction
    var origin = mesh.position.clone(),
        originMatrix = mesh.matrix,
        direction = new THREE.Vector3(0, -10, 0),
        target = direction.applyMatrix4(originMatrix);

    // Draw a line
    drawLine(origin, target);
}


/**
 * Draws a line between two vectors
 * @param v1 - Starting vector
 * @param v2 - Ending vector
 */
function drawLine(v1, v2) {

    // Generic blue line
    var lineMat = new THREE.LineBasicMaterial({ color: 0x0000ff }),
        lineGeo = new THREE.Geometry();

    // Push start and end vectors to the line's geometry
    lineGeo.vertices.push(v1);
    lineGeo.vertices.push(v2);

    // Create the line mesh
    var line = new THREE.Line(lineGeo, lineMat);

    // Add the line to the scene
    scene.add(line);
}


/**
 * Debug function to remove all balls from the scene
 */
function deleteBalls() {
    for(var i in balls) {
        scene.remove(balls[i]);
        balls[i] = null;
        delete balls[i];
    }
}


/**
 * Removes a specific ball from the scene
 * @param playerId - The ball's owner
 * @param ballId - The ball's id
 */
function deleteBallById(playerId, ballId) {

    // Assemble the unique ball id key
    var key = 'p'+playerId+'b'+ballId;

    // Check if the ball exists and remove it if it exists
    if (balls[key] != null) {
        scene.remove(balls[key]);
        balls[key] = null;
        delete balls[key];
    }
}


/**
 * Deletes all of the given player's balls from the scene
 * @param targetPlayerId - The ID of the player to purge balls from
 */
function deletePlayerBalls(targetPlayerId) {

    // Assemble the ball key starting pattern
    var keyPrefix = 'p'+targetPlayerId+'b';

    // Find balls that belong to the player
    for(var i in balls) {

        // If the ball's id matches the starting pattern, delete the ball
        if (i.substr(0, keyPrefix.length) == keyPrefix) {
            scene.remove(balls[i]);
            balls[i] = null;
            delete balls[i];

            // If the ball was owned by the client player, give the ball back in the inventory
            if (playerId == targetPlayerId) {
                currentBallCount--;
            }
        }
    }

    // Update the ball counter HUD cuz the player count might have changed
    hud.currentBallCount.text(maxBallCount - currentBallCount);
}


/**
 * Generates the player nameplate and hp bar
 * @param nickname - Player nickname
 * @param hp - Player HP
 * @returns {THREE.Sprite} - Shiny new sprite
 */
function makePlayerSprite( nickname, hp ) {

    // Init canvas and drawing sizes, offsets, etc
    var canvas = document.createElement('canvas'),
        context = canvas.getContext('2d'),
        size = 512,
        hpSize = 100,
        hpOffset = 20,
        hpWidth = Math.max(0, Math.round(hp)),
        hpHeight = 10,
        fontSize = 24,
        paddingHeight = 10,
        paddingWidth = 10;

    // Assign height/width from setup
    canvas.width = size;
    canvas.height = size;

    //
    // DRAW NAME BACKGROUND AND NAME
    //

    context.textAlign = 'center';
    context.font = fontSize+'px Arial';
    context.fillStyle = "rgba(50, 50, 50, 0.25)";
    var textWidth = context.measureText(nickname).width;

    // Text background should be semi-transparent
    context.fillRect(
        size/2 - textWidth/2 - paddingWidth,
        size/2 - (fontSize*1.6) / 2 - paddingHeight,
        textWidth + paddingWidth*2,
        fontSize + paddingHeight*2
    );

    // Draw text
    context.fillStyle = '#ffffff';
    context.fillText(nickname, size / 2, size / 2);

    //
    // DRAW HP BARS
    //

    // Red underlay
    context.fillStyle = "rgba(204, 31, 31, 1)";
    context.fillRect(
        size/2 - hpSize/2,
        size/2 - hpHeight/2 + hpOffset,
        hpSize,
        hpHeight
    );

    // Green overlay
    context.fillStyle = "rgba(16, 189, 0, 1)";
    context.fillRect(
        size/2 - hpSize/2,
        size/2 - hpHeight/2 + hpOffset,
        hpWidth,
        hpHeight
    );

    // Create a new texture from the canvas drawing
    var canvasTexture = new THREE.Texture(canvas);
    canvasTexture.needsUpdate = true;

    // Assign the texture to a new material
    var spriteMaterial = new THREE.SpriteMaterial({
        map: canvasTexture,
        transparent: false,
        useScreenCoordinates: false,
        color: 0xffffff // CHANGED
    });

    // Create and return a fancy new player sprite
    var sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set( 10, 10, 1 );
    return sprite;
}


/**
 * Updates the sprite for a given player
 * @param id - ID of the player to update
 */
function updatePlayerSprite(id) {

    // Get he player object being referenced (local or remote)
    var p = id == playerId ? player : players[id];

    // If the target player still exists
    if (p != null) {

        // Remove the old sprite
        if (p.userData.sprite != null) {
            p.remove(p.userData.sprite);
        }

        // Create a new sprite
        p.userData.sprite = makePlayerSprite(p.userData.nickname, p.userData.hp );

        // Offset the sprite above the player
        p.userData.sprite.position.set(0, 0, 2);

        // Add the sprite to the player
        p.add( p.userData.sprite );

    } else {
        console.error('cannot update sprite cuz player is missing?');
    }
}


/**
 * Checks whether the given value is between the given min and max values
 * @param n - Given value
 * @param min - Minimum range value
 * @param max - Maximum range value
 * @returns {boolean} - True if within the given range, False if not
 */
function isBetween(n, min, max) {
    return (min < n) && (n < max);
}


/**
 * Moves a player if still within the bounds of the world
 * @param xTranslation - How much to move the player in the X direction
 * @param yTranslation - How much to move the player in the Y direction
 * @param zTranslation - How much to move the player in the Y direction
 * @returns {boolean} - True if the player moved, False if not
 */
function moveIfInBounds(xTranslation, yTranslation, zTranslation) {

    // Copy the current player position and get the world bounds
    var oldPos = player.position.clone(),
        width = worldWidth * 2,
        depth = worldDepth * 2;

    if(player.mass==0){
        // Apply the given translations to the player position
        player.translateX(xTranslation);
        player.translateY(yTranslation);
        player.translateZ(zTranslation); //Jumping
    }else{
	//Player has mass, so apply a force to centre of gravity 
	var force = new THREE.Vector3(xTranslation, yTranslation, zTranslation);
	player.applyCentralImpulse(force);
    }
    
   

    // If the new location is outside the boundaries of the world, undo the movement
    if (!isBetween(player.position.x, -width, width) ||
        !isBetween(player.position.y, -depth, depth)) {
        // Revert and report movement failure
        player.position.copy(oldPos);
        return false;
    }
    
    // Flag to physijs as dirty, so physics objects can move
    player.__dirtyPosition = true;
    player.__dirtyRotation = true;

    // Return movement was successful
    return true;
}

/**
 * Moves the player by their internal velocities.
 * If a collision results, undo the movement and zero the velocities.
 * 
 * @param player: The player we're moving
 * @param delta: The time period between frames
 */
function moveIfInBounds2(delta, specificPlayer){
    //The big gotcha here is that player.position.y is aligned to the map grid
    //player.velocity.y is aligned to the player!! 
    //So we resolve this by using translateX, which works out your new position depending on your direction.
    //So we must recalculate the oldPos for every dimension and reset all three axes if collisions occur
    
    var p = specificPlayer || player; //Force using global player
    
    var oldPos = p.position.clone();
    var preMovePos = p.position.clone();
    
    var width = worldWidth * 2,
        depth = worldDepth * 2;
    
    var to_move = 0; //Throwaway var to remember how much you moved
    var z_grad_move = 0; //Adjustments of Z in response to a gradient
    var MAX_GRAD = 0.6; //You can manage up to a 60% slope!
    
    var x_collide = "",
    	y_collide = "",
    	z_collide = "";
    
    //When it comes to the flat plane, maximum gradients apply:
    var max_grad = POWER_STATES.max_gradient[p.power_state]; //The max gradient you can tolerate depends on your power!
	
    
    //Move player to new position:
    p.hasMoved = false;
    if(p.mass==0){ //Use Mike's translations engine
	
	
	//UP/DOWN: Z - First deal with the more complex up/down direction
        oldPos = p.position.clone() //We need to update this with every movement
        p.standing = false;
        var x_move_slipping = 0;
        var y_move_slipping = 0;
        to_move = (p.velocity.z + p.standing_on_velocity.z)*delta; //Standing_on_velocity is the platform velocity you are on
        //Use the upwards and downwards rays to see if you are going to hit something between frames, and stop short of it
        var dist_to_hit = p.zCollisionPrediction(); //Determine when we're gonna hit something. dist_to_hit.shortest is infinity if no collision imminent
        if(p.velocity.z>0){ //Jumping
            if(to_move > dist_to_hit.shortest){ //You're gonna hit your head.
        	to_move = dist_to_hit.shortest; //Stop at head impact
        	p.velocity.z = 0; //Set velocity to zero
        	player.jump_keydown_continuously = false; //Null off the persistent space press
        	p.standing = false;
        	if(dist_to_hit.hit_touchable){
        	    dist_to_hit.hit_touchable.touched(delta, p, scene); //Detect whacking head on trap
        	}
            }//Z
        } else { //Falling or walking
            if(-to_move > (dist_to_hit.shortest - p.PLATFORM_GRACE)){ //You're gonna land on your feet (NB to_move is vector, dist_to_hit is scalar!)
        	//LANDING ON A PLATFORM
        	to_move = -1 * (dist_to_hit.shortest - p.PLATFORM_GRACE); //Stop just a smidgen before your feet touch the platform
        	p.standing=true;
        	p.isJumping = false;
        	player.jump_keydown_continuously = false; //Null off the persistent space press
        	if(dist_to_hit.hit_touchable){
        	    dist_to_hit.hit_touchable.touched(delta, p, scene); //Detect whacking head on trap
        	}
            }// Z
            if(dist_to_hit <= p.PLATFORM_GRACE){ //The definition of standing is if you are perched at the grace distance above a platform
        	//STANDING ON A PLATFORM
        	p.standing = true;
        	//p.adjustStandingOnVelocity(dist_to_hit.standing_on); //Adjust our standing velocity
        	p.isJumping = false;
        	if(dist_to_hit.hit_touchable){
        	    dist_to_hit.hit_touchable.touched(delta, p, scene); //Detect whacking head on trap
        	}
            }
            //SLIPPING CODE: Now, check to see if our gradient is actually safe:
            if(p.standing && (Math.abs(dist_to_hit.x_gradient) > max_grad || Math.abs(dist_to_hit.y_gradient) > max_grad) ){ //Sorry, you're just too slippy!
        	//if(Math.abs(dist_to_hit.x_gradient) > 0 && Math.abs(dist_to_hit.x_gradient) < 100 && !isNaN(dist_to_hit.x_gradient)){var x_move_slipping = to_move * dist_to_hit.x_gradient;}
        	//if(Math.abs(dist_to_hit.y_gradient) > 0 && Math.abs(dist_to_hit.y_gradient) < 100 && !isNaN(dist_to_hit.y_gradient)){var y_move_slipping = to_move * dist_to_hit.y_gradient;}
        	//console.log(dist_to_hit.x_gradient+"/"+dist_to_hit.y_gradient);
        	p.standing = false; //This will just boost the z velocity,
            } else if(p.standing) { //We've hit a platform, Gradient is ok, so we can arrest the fall on this platform
        	//LANDING ON A PLATFORM which is not too steep
        	p.velocity.z = 0; //Set velocity to zero
        	p.adjustStandingOnVelocity(dist_to_hit.standing_on); //Adjust our standing velocity to match the platform if the platform is moving
            }
            //console.log(dist_to_hit.x_gradient+"/"+dist_to_hit.y_gradient+" max:"+max_grad);
        }
        p.translateZ(to_move); //Jumping (+) / falling (-)
        //var collision = playerTouchingObjs(p); //Checks collision against non-ground objects
        if(p.lastMovementCausesCollision(0,0,to_move)!==false){ //Collided in the z direction
            z_collide = "collision";
            //p.position.copy(oldPos); //Reset position
            p.translateZ(-to_move);
            p.velocity.z = 0; //Kill movement
            p.isJumping = false; //Allows player to use space again!
            //p.standing = false;
        }else{
            p.hasMoved=true;
        }// Z
        
        
        //Now detect any imminent collisions in the left/right/forwards/backwards plane
        var horizontal_collisions = player.quickCollisionPrediction(all_collidables, dist_to_hit.standing_on_ids, delta); //Second property is the stuff you are standing on
        
	//LEFT/RIGHT: X, did they collide?
	oldPos = p.position.clone() //We need to update this with every movement
	to_move = (p.velocity.x + p.standing_on_velocity.x)*delta + x_move_slipping; //Player_velocity + platform_velocity + velocity from slope slippage
	z_grad_move = 0; //Default to nil movement
	if(dist_to_hit.x_gradient > -3 && dist_to_hit.x_gradient < 3){ //We have a legit gradient here
	    if(Math.abs(dist_to_hit.x_gradient) >= max_grad){ //Too steep, SLIDE!!
		p.standing=false;
	    }
	    z_grad_move = to_move * dist_to_hit.x_gradient; 
	}
	p.translateX(to_move); //Principle movement
	p.translateZ(z_grad_move); //adjustment for gradient
	//var collision = playerTouchingObjs(p); //Checks collision against non-ground objects
        if(p.lastMovementCausesCollision(to_move,0,0)!==false){ //You collided with something in the x direction
            x_collide = "collision";
            //p.position.copy(oldPos); //Reset position
            p.translateX(-to_move); //Undo the movement
            p.translateZ(-z_grad_move); //Undo adjustment for gradient
            p.velocity.x = 0; //Kill movement in that direction
        } else {
            p.hasMoved = true;
        }
        
        //Now Y (forwards, backwards)
        oldPos = p.position.clone() //We need to update this with every movement
        to_move = (p.velocity.y + p.standing_on_velocity.y)*delta + y_move_slipping;
        z_grad_move = 0; //Default to nil movement
	if(dist_to_hit.y_gradient > -3 && dist_to_hit.y_gradient < 3){ //We have a legit gradient here
	    if(Math.abs(dist_to_hit.y_gradient) >= max_grad){ //Too steep, SLIDE!!
		p.standing=false;
	    }
	    z_grad_move = to_move * dist_to_hit.y_gradient;
	}
        p.translateY(to_move); //Forwards (-), Backwards (+)
        p.translateZ(z_grad_move); //adjustment for gradient
        //var collision = playerTouchingObjs(p); //Checks collision against non-ground objects
        if(p.lastMovementCausesCollision(0,to_move,0)!==false){ //Collided in the y direction
            y_collide = "collision";
            //p.position.copy(oldPos); //Reset position
            p.translateY(-to_move);
            p.translateZ(-z_grad_move); //Undo adjustment for gradient
            p.velocity.y = 0; //Kill movement in that direction
        } else {
            p.hasMoved = true;
        }
        
        //TODO: add support for stepup
        //if(collision=="stepup"){ //Only the bottom of your character collided gently with a platform, so step onto it
        if(0){
            p.velocity.z = 0; //Kill movement in that direction
            z_collide = collision.contact_type;
            p.translateZ(1*collision.stepup_amount); //Do not undo the movement, just adjust the z position
    	    p.isJumping = false;
    	    p.standing = true;
    	    p.hasMoved = true;
    	}
    }else{ //Mass > 0 
	//Use Physijs forces. This will do all the collision and rebound detection for us
	//Player has mass, so apply a force to centre of gravity 
	var force = new THREE.Vector3(xTranslation, yTranslation, zTranslation);
	p.applyCentralImpulse(force);
    }
    
    
    //Have you moved out of bounds?
    if (!isBetween(p.position.x, -width, width) ||
        !isBetween(p.position.y, -depth, depth)) {
        // Revert and report movement failure
        p.standing_on_velocity = new THREE.Vector3(0,0,0); //Null movement
	p.velocity.x = 0;
	p.velocity.y = 0;
        p.position.x = preMovePos.x;
        p.position.y = preMovePos.y;
        //p.velocity.z = 0;
        p.hasMoved = false;
    }

    
    //Update physi.js
    p.__dirtyPosition = true;
    p.__dirtyRotation = true;
   
    //If you have moved, are you still on the ground?
    jumpingOrFallingPlayerZ(p); //This will soon be replaced by our clever vertical rays
    
    //Collect any collectables you are touching:
    var hit_collectables = p.detectCollision(all_interactables);
    if(hit_collectables && scene.loaded && player.ready){
	console.log("Hit pickup!!")
	var already_hit = [];
	$.each(hit_collectables.other_objects, function(){
	    if(already_hit.indexOf(this)==-1){ //Prevent double-collision issues
		this.collect(delta, player, scene); //Collect this object!
		already_hit.push(this);
	    }
        });
    }
    
    
    //Horizontal velocity decay: //TODO: decay according to the friction against the player (slides on ice, drags through water)
    var mu = 0.5; //Standard friction of ground
    if(dist_to_hit.shortest < 2*p.PLATFORM_GRACE) { //Only apply friction if we're actually standing on the platform!!
        var mu = dist_to_hit.floor_properties.friction; //Returned from our player.zCollisionPrediction()
        if(mu<=0 || mu > 10){
    		mu = 0.5;
        }
    }
    //Perform self-initiated velocity decay
    p.velocity.x = p.velocity.x - (p.velocity.x * 20.0 * mu * delta);
    p.velocity.y = p.velocity.y - (p.velocity.y * 20.0 * mu * delta);

    //Gravity!! - only if not standing
    if(!p.standing){
	p.velocity.z -= 9.8 * 10.0 * delta; // 10.0 = mass
    }

   
    
    //Debug stats:
    var collisiondata = "Clip X:"+x_collide+", Y:"+y_collide+", Z:"+z_collide+""
    var playerrot = "Player rot: "+p.rotation.x.toFixed(2)+","+p.rotation.y.toFixed(2)+","+p.rotation.z.toFixed(2)+"("+(p.rotation.z*(180/Math.PI)).toFixed(1)+")";
    var playerpos = "Player pos: "+p.position.x.toFixed(2)+","+p.position.y.toFixed(2)+","+p.position.z.toFixed(2);
    var playervel = "Player vel: "+p.velocity.x.toFixed(2)+","+p.velocity.y.toFixed(2)+","+p.velocity.z.toFixed(2);
    $('#debug-stats').html(collisiondata+"<br/>"+playerrot+"<br/><br/>"+playerpos+"<br/>"+playervel+"<br/>µ:"+mu+", PlatformVel: "+p.standing_on_velocity.x+","+p.standing_on_velocity.y+","+p.standing_on_velocity.z);
    
    //Return the friction so the rest of our engine can use it.
    return mu;
}


/**
 * Drops a dead body where the target player is standing, and hides the target player model
 * @param targetPlayer - Player object to drop a body for
 */
function dropDeadBody(targetPlayer) {

    // Clone the target player's material color
    var bodyMaterials = new THREE.MeshPhongMaterial( {
            color: targetPlayer.material.color,
            ambient: targetPlayer.material.color, // should generally match color
            specular: 0x050505,
            shininess: 100
        }),

        // Create body geometry and physics material
        bodyGeometry = new THREE.CubeGeometry( 1, 1, 2, 1, 1, 1),
        bodyPhysicsMaterial = Physijs.createMaterial(
            bodyMaterials,
            .8, // high friction
            .4 // low restitution
        ),

        // Create the body mesh
        body = new Physijs.BoxMesh(
            bodyGeometry,
            bodyPhysicsMaterial,
            0.5
        );

    // Of course bodies cast and receive shadows...
    body.castShadow = true;
    body.receiveShadow = true;

    // Apply collision masks such that bodys only collide with limited things
    body._physijs.collision_type = CollisionTypes.BODY;
    body._physijs.collision_masks = CollisionMasks.BODY;

    // Apply current target player's position and rotation matrices
    body.matrix.copy(targetPlayer.matrix);
    body.matrixWorld.copy(targetPlayer.matrixWorld);
    body.position.copy(targetPlayer.position);

    // Add the body to the world and let the hilarity commence
    scene.add( body );
    
    return body;
}


/**
 * Publishes a notification to the notification HUD
 * @param message - HTML message to display
 */
function addNotification(message) {
    // Create a new unordered list element with the message
    // Apply the current date timestamp to the element so that it doesn't get wiped until
    // it has been on screen for a minimum amount of time
    $('<li>'+message+'</li>').data('added', Date.now()).appendTo(notificationHud);
}


/**
 * Checks for stale notifications and removes them
 */
function cycleNotifications() {

    // Find active notifications
    var activeNotifications = $('li', notificationHud);

    // If there is at least one visible notification
    if (activeNotifications.length > 0) {

        // Check the date stamp on the notification
        // If it hasn't been visibile for at least three seconds, ignore this cycle request
        var n = $(activeNotifications[0]);
        if (Date.now() - n.data('added') > 3000) {

            // Remove with CSS transition of movement off the top of the screen
            n.css('margin-top', -38);
            setTimeout(function() {
                // After the CSS transition finishes, purge the element off the dom
                n.remove();
            }, 1000);
        }
    }
}


/**
 * Checks for balls that may have fallen off the world
 */
function ballWatcher() {

    // Check each ball
    for(var i in balls) {

        // If the ball belongs to the current player and has moved 50 units below origin - PURGE IT!
        if (balls[i].userData.sourcePlayerId == playerId &&
            balls[i].position.z < -50) {

            // Notify other players the ball has been recycled
            socket.emit('unfire', {
                playerId: playerId,
                ballId: balls[i].userData.ballId
            });

            // Remove the ball from the world
            deleteBallById(balls[i].userData.sourcePlayerId, balls[i].userData.ballId);

            // Give the player back their ball and update their HUD
            currentBallCount--;
            hud.currentBallCount.text(maxBallCount - currentBallCount);
        }
    }
}


// *********************************************************************************************************************
// ***** RUN TIME ******************************************************************************************************
// *********************************************************************************************************************

// COMMENCE THE FUN
$(document).ready(function() {
    init();
});