'use strict';

/**
 * Supermega3D
 *     Collectables and Interactables
 *     
 *     These are items you can touch and interact with
 * 
 * @author Dr Michael Brooks / @michaeljtbrooks
 * Last Updated: 2017-04-28 20:12 UTC 
 */

//Expanding on THREEjs:
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



//SuperMega Namespace
window.SuperMega = {};

//Our default colours in 0xHEX
SuperMega.DEFAULT_COLOURS = {
    "trap" : 0x2222FF,
    "platform" : 0xF762A8,
    "powerup" : 0xFFF022,
    "switch" : 0x444444,
    "magic_switch" : 0xDDDDDD,
    "the_end" : 0x8316FF,
    "nom" : 0x33EEFF,
}

//Our presets:
SuperMega.OBJECT_PRESETS = {
    "ice_platform" : {
        "color": 0xAAEEFF,
            "transparent": true,
            "opacity": 0.6,
            "friction": .1, //v low friction
            "restitution": .4 //low restitution
    }
}


SuperMega.resolve_vector = function(x_or_vector, y, z){
    /**
     * Turns the supplied arguments into a THREE.Vector3 object.
     * Acceptable inputs:
     * 
     *     @param x_or_vector: <THREE.Vector3>
     *  @param x_or_vector: Array(<float>,<float>,<float>)
     *  @params x_or_vector: <float>
     *      y: <float>
     *      z: <float>
     *  
     *  @return: <THREE.Vector3>
     *  
     */
    if(typeof x_or_vector.clone !== "undefined"){ //Has been given a vector to define rotation
        var x_amt = x_or_vector.x;
        var y_amt = x_or_vector.y;
        var z_amt = x_or_vector.z;
    }else if(typeof x_or_vector == "Array"){ //Has been given an array to define rotation
        var x_amt = x_or_vector[0] || 0;
        var y_amt = x_or_vector[1] || 0;
        var z_amt = x_or_vector[2] || 0;
    }else if(x_or_vector == "random" || x_or_vector == "Random" || typeof x_or_vector=="undefined"){ //Means randomise me!!
        amount = y || 0.2*Math.PI;
        var x_amt = (Math.random()-0.5) * amount; //Tilt 
        var y_amt = (Math.random()-0.5) * amount;
        var z_amt = (Math.random()-0.5) * amount;
    }else{
        var x_amt = x_or_vector || 0;
        var y_amt = y || 0;
        var z_amt = z || 0;
    }
    return new THREE.Vector3(x_amt, y_amt, z_amt);
}



/**
 * Screen: What we actually show on the screen
 * 
 * Contains the level, HUD notifications, overlays etc
 * 
 * @keyword level: The SuperMega.Level scene
 */
SuperMega.Screen = function(level){
    
    //If level, add it
    this.level = level || null;
    
    //Identify our overlays 
    this.overlays = { //Contains our various overlay screens
        "skyUnderlay" : $('#pagewrapper'),
        "deadScreen" : $('#respawn')
    }
    
    //Indentify our head-up-displays (huds)
    this.hud = {
        "currentBallCount" : $('#hud-ammo .current'),
        "maxBallCount" : $('#hud-ammo .max'),
        "nomCount" : $('#hud-noms .current'),
        "notificationHud" : $('#hud-notifications ul')
    }

}
SuperMega.Screen.prototype = Object.assign( {}, {
    constructor: SuperMega.Screen
});










/**
 * Level: A wrapper around scene to hold our global scene objects in
 * 
 * Level.scene:  Our scene
 * Level.scene:  Our clock
 * 
 */
SuperMega.Level = function( scene, level_number, options){
    /** Level Constructor
     * @param scene: The Physijs scene we are using
     * @keyword level_number: Will load the specified level number into the scene
     * @keyword options: {} properties of the level (e.g. world width etc)
     */
    var self=this; //In case I slip into python mode!
    
    //Resolve inputs:
    this.world_width = options.world_width || 64;
    this.world_depth = options.world_depth || 64;
    
    //Resolve scene
    scene = scene || null;
    if(scene === null){ //Create new scene
        scene = new Physijs.Scene({ fixedTimeStep: 1 / 60 }); //60 fps is sufficient!
    }
    scene.loaded = false;
    this.scene = scene;
    
    //Create clock
    this.clock = new THREE.Clock(); //Clock to watch our frames
    
}
SuperMega.Level.prototype = Object.assign( Object.create(Physijs.Scene.prototype), {
    constructor: SuperMega.Level,
    
    //Tracked scene items
    unsorted: [], //Tracks all unsorted items that don't end up elsewhere
    //The list items
    collidables: [], //The things we can collide with
    interactables: [], //The things which move or we can interact with
    terrain: [],     //Surface terrain that we can collide with (ground / hills)
    liquid_terrain: [], //Surface we can pass through (but balls cant)
    debris: [],    //Other items which may exist on the scene but won't be tested in our collision detection
    the_ends:[], //Easy way of tracking the ends
    //The dict items
    lighting: {}, //The lights
    players: {}, //Players in the scene
    balls : {},
    
    //Single properties
    player: null, //The local player object
    nickname: "SuperMega", //The default player's name
    ball_counter: 0, //The number of balls in the scene
    
    
    
    
    //Now we override add() to allow us to add it to a category for easy tracking:
    _scene_action : function(action, obj, category_name, index_name){
        /**
         * SuperMega.Scene._scene_action: adds or removes the specified item
         * @param action: The scene function to perform with the obj as an argument (e.g. add(obj))
         * @param obj: The THREE.js or Physijs object to add / remove
         * @keyword category_name: The category this object belongs to e.g. "liquid_terrain"
         * @keyword index_name: For trackers based on dicts e.g. "lighting" 
         */
        category_name = category_name || null;
        index_name = index_name || null;
        
        //First resolve the tracking object
        var tracker = []; //Blank
        if(category_name){
            var allowed_categories = ["lighting","collidables","interactables","terrain","liquid_terrain","debris","balls","players"];
            if(allowed_categories.indexOf(category_name)!=-1){
                tracker = this[category_name]; //It's a recognised category
            }else{
                tracker = this.unsorted; //Default to unsorted category 
                console.log("WARNING: '"+category_name+"' is not a valid SuperMega scene category name, choose one of: "+allowed_categories.toString());
            }
        } else {
            console.log("WARNING: item #"+obj.id+" '"+obj.name+"' has not been added to a tracking category.");
            tracker = this.unsorted;
        }
        
        //Now perform the relevant action on it:
        if(typeof tracker.push !== "undefined"){ //It's an array
            var obj_index = null;
            if(action=="remove"){ //Grab the index if we are wanting to remove this object
                if(obj){ //If you have supplied the object, look up its index
                    obj_index = tracker.indexOf(obj);
                } else if(index_name){ //Else you can just supply its index if you know it!
                    obj_index = index_name;
                } else {
                    console.log("WARNING: Level."+action+"(obj,"+category_name+",index_name) has not been given a valid object or index_name. Ignoring.");
                    return false;
                }
                
            }
            if(action=="add"){
                if(!obj){
                    console.log("WARNING: Level."+action+"(obj,"+category_name+") has not been given a valid object to add. Ignoring.");
                    return false;
                }
            tracker.push(obj); //Add the object to our tracking vars
            } else if(action=="remove"){
                if (obj_index > -1) {
                    tracker.splice(obj_index, 1); //Remove the item
                }
            }
        } else { //It's a dict
            if(action=="add"){
            if(!obj){
                    console.log("WARNING: Level."+action+"(obj,"+category_name+","+index_name+") has not been given a valid object to add. Ignoring.");
                    return false;
                }
            if(index_name){ //Add to tracker
                    tracker[index_name] = obj;
                } else { //Failed to supply an index_name, so it's going in the unsorted bin
                    console.log("WARNING: '"+category_name+"' is dict-based and requires an index name as well as a category_name. No index_supplied, adding to unsorted.");
                    this.unsorted.push(obj);
                }
            } else if(action=="remove") {
                if(index_name){ //Remove from tracker
                    var obj = tracker[index_name];
                    delete tracker[index_name];
                } else {  //Failed to supply an index_name, so it's being removed from the unsorted bin
                    var obj_index = this.unsorted.indexOf(obj);
                    console.log("WARNING: '"+category_name+"' is dict-based and requires an index name as well as a category_name. No index_supplied, removing item from unsorted.");
                    if(obj_index > -1){
                        this.unsorted.splice(obj_index, 1); //Remove it!
                    } else {
                        console.log("WARNING: attempted to remove item from unsorted items failed (unable to find in unsorted). Please provide an index_name");
                    }
                }
            }
        }
        
        //And add to / remove from the scene:
        this.scene[action](obj);
    },
    add : function(obj,category_name,index_name){
        /**
         * SuperMega.Scene.add: adds the specified item to the scene
         * @param action: The scene function to perform with the obj as an argument (e.g. add(obj))
         * @param obj: The THREE.js or Physijs object to ADD
         * @keyword category_name: The category this object belongs to e.g. "liquid_terrain"
         * @keyword index_name: For trackers based on dicts e.g. "lighting" 
         */
        return this._scene_action("add",obj,category_name,index_name);
    },
    remove : function(obj,category_name,index_name){
        /**
         * SuperMega.Scene.remove: removes the specified item to the scene
         * @param action: The scene function to perform with the obj as an argument (e.g. remove(obj))
         * @param obj: The THREE.js or Physijs object to ADD
         * @keyword category_name: The category this object belongs to e.g. "liquid_terrain"
         * @keyword index_name: For trackers based on dicts e.g. "lighting" 
         */
        return this._scene_action("remove",obj,category_name,index_name);
    },
    
    build : function(data){
        /**
         * Constructs a level from the given data
         * 
         * @param data: { //Object defining the levels
         *     terrain: [
         *         {
         *            data: [<the matrix heights>],
         *            height: <float>, //max height,
         *            multiplier: <float>, //?how rugged the terrain is
         *            subtractor: <float>, //??
         *            width: <int>, //Terrain width??
         *            worldHeight: <int>, //World depth terrain is in (front to back)
         *            worldWidth: <int>, //World width terrain is in (left to right)
         *        }
         *    ],
         *    platforms: [ //The platforms
         *        { //All params optional
         *            position: <THREE.Vector3> Where the platform's "origin" is in terms of the scene
         *            geometry: <THREE.geometry> OR <Array>([<int>,<int>,<int>]) array of sizes,  The geometry object to base this on, (default cube 10x10x2).
         *                material: <Physijs.Material> Material to coat this object with, (default pink Phong)
         *                contains: [<Mesh1>,<Mesh2>] A list of sub objects which will reside inside this
         *               orientation: <THREE.Vector3> The rotational orientation of the object on initialisation.
         *                angular_momentum: <THREE.Vector3> the rotational movement of the object (Radians per second) 
         *               translation: <THREE.Vector3> the translational movement of the object (units per second)
         *               rotation_mode: <str> "oscillating" | "continuous"
         *               translation_mode: <str> "oscillating" | "continuous" | "orbiting"
         *               magnitude: <float> how long a path is (in units), or how wide (radius) an orbiting path
         *               size: <[array]> Array of sizes x,y,z to make the object
         *               color: <Hex colour> The colour you wish to set it as
         *               friction: <float> how much friction the platform should have
         *               restitution: <float> how stiff it should be on collisions
         *             preset: <str> A preset to use!
         *        }
         *        
         *    ],
         *    powerups: [ //The powerups
         *        {
         *            position: <THREE.Vector3> Where the platform's "origin" is in terms of the scene
         *            angular_momentum: <THREE.Vector3> the rotational movement of the object (Radians per second) 
         *               translation: <THREE.Vector3> the translational movement of the object (units per second)
         *               rotation_mode: <str> "oscillating" | "continuous"
         *               translation_mode: <str> "oscillating" | "continuous" | "orbiting"
         *               magnitude: <float> how long a path is (in units), or how wide (radius) an orbiting path
         *         }
         *    ],
         *    noms: [ //The noms
         *            position: <THREE.Vector3> Where the platform's "origin" is in terms of the scene
         *            angular_momentum: <THREE.Vector3> the rotational movement of the object (Radians per second) 
         *               translation: <THREE.Vector3> the translational movement of the object (units per second)
         *               rotation_mode: <str> "oscillating" | "continuous"
         *               translation_mode: <str> "oscillating" | "continuous" | "orbiting"
         *               magnitude: <float> how long a path is (in units), or how wide (radius) an orbiting path
         *    ],
         *    static_objects: [ //Other arbitrary shit that is solid (like trees)
         *        {
         *            position: <THREE.Vector3> Where the platform's "origin" is in terms of the scene
         *            geometry: <THREE.geometry> OR <Array>([<int>,<int>,<int>]) array of sizes,  The geometry object to base this on, (default cube 10x10x2).
         *                material: <Physijs.Material> Material to coat this object with, (default pink Phong)
         *                contains: [<Mesh1>,<Mesh2>] A list of sub objects which will reside inside this
         *               orientation: <THREE.Vector3> The rotational orientation of the object on initialisation.
         *               size: <[array]> Array of sizes x,y,z to make the object
         *               color: <Hex colour> The colour you wish to set it as
         *               friction: <float> how much friction the object should have
         *               restitution: <float> how stiff it should be on collisions
         *             load_from: 
         *             preset: <str> A preset to use! (can include building a bloody tree!
         *        }
         *    }
         *    ends: [ //Level ends
         *        {
         *            position: <THREE.Vector3> Where the platform's "origin" is in terms of the scene
         *               orientation: <THREE.Vector3> The rotational orientation of the object on initialisation.
         *             noms_required: <int> The number of noms required for it to become activated
         *             preset: <str> A preset to use! (can include building a bloody tree!
         *        }
         *    }
         *
         * }
         */
        data.terrain = data.terrain || [];
        data.platforms = data.platforms || []; 
        data.powerups = data.powerups || [];
        data.noms = data.noms || [];
        data.static_objects = data.static_objects || [];
        data.ends = data.ends || [];
    },
    
    add_ball : function(position, force, restitution, playerId, color, ballId) {
        /**
         * Adds a ball to the word with the given appearance and trajectory information
         * @param position - The location to start the ball
         * @param force - The initial force to apply on the ball
         * @param restitution - The bounciness of the ball
         * @param playerId - The player who threw the ball
         * @param color - The color to assign the ball
         * @param ballId - The ID of the ball
         */

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
        ball.sourcePlayerId = playerId;
        ball.ballId = ballId;

        // Assign physics collision type and masks, so it collides only with specific things
        ball._physijs.collision_type = CollisionTypes.BALL;
        ball._physijs.collision_masks = CollisionMasks.BALL;

        // Put the ball in the world
        this.add( ball, "balls", 'p'+playerId+'b'+ballId);

        // Update matrices
        ball.updateMatrixWorld();
        ball.updateMatrix();

        // Add the ball to the balls collection so I can keep track of it
        //this.balls['p'+playerId+'b'+ballId] = ball;
    },
    
    
    delete_ball_by_id : function(playerId, ballId){
        /**
         * Removes the specified ball from the scene (doesn't require a valid player object!)
         * @param playerId: <int> The player's id
         * @param ballId: <int> The ball's id
         */
        // Assemble the unique ball id key
        var key = 'p'+playerId+'b'+ballId;

        // Check if the ball exists and remove it if it exists
        if (this.balls[key] != null) {
            this.remove(this.balls[key], "balls", key); //Syntax is (obj, category, key)
        }
    },
    
    ball_watcher : function(socket){
        /**
         * Watches all the balls in a scene, removes ones which have fallen off
         * 
         * @param socket: <WebSocket> Which transmits player events
         */
    
	// Check each ball
	var level = this;
	for(var i in level.balls) {
        
        var ball_obj = level.balls[i];
            // If the ball belongs to the current player and has moved 50 units below origin - PURGE IT!
            if (ball_obj.sourcePlayerId == playerId &&
                ball_obj.position.z < -50) {

                // Notify other players the ball has been recycled
                socket.emit('unfire', {
                    playerId: playerId,
                    ballId: ball_obj.ballId
                });

                // Remove the ball from the world
                //deleteBallById(balls[i].sourcePlayerId, balls[i].ballId);
                var source_player_id = level.balls[i].sourcePlayerId;
                var ball_id = level.balls[i].ballId;
                level.delete_ball_by_id(ball_obj.sourcePlayerId, ball_obj.ballId); //Actually removes it from the scene
                console.log("Ball #"+ball_id+" from player #"+source_player_id+" has been removed!");

                // Give the player back their ball and update their HUD
                var player_obj = level.players[source_player_id];
                console.log(player_obj);
                player_obj.currentBallCount--; 
                player_obj.hud.currentBallCount.text(maxBallCount - currentBallCount);
            }
    	}
    },
    
    add_tree : function(){
	//##HERE##
    }

    
}); //JS inheritance hack part 2



/**
 * Player: A supermega player, including the local player
 * Contains all the relevant movement, collision detection, scorekeeping routines etc
 * 
 * @param options: {} Various options for the player
 * @param scene: <Physijs.scene> Allows us to remove balls etc from the scene
 * @param hud: <jQuery Element> The head-up-display
 */
SuperMega.Player = function (options, scene, hud){
    //Construction
    
    //Resolve options:
    options = options || {};
    options.local = options.local || true; //If this is the local player or not
    options.color = options.color || options.colour || this.POWER_COLOURS[0];
    options.mass = options.mass || 0;
    options.player_id = options.player_id || Math.round(Math.random()*99999); //Give random ID
    options.nickname = options.nickname || "SuperMega #"+options.player_id;
    
    
    //Create material
    var player_material = new THREE.MeshPhongMaterial({
        color: options.color,
        ambient: options.color,
        specular: 0x050505,
        shininess: 100
    });
    //Create geometry
    var player_geometry = new THREE.CubeGeometry( 1, 1, 2, 1, 1, 1 );
    
    //Super to create the player mesh:
    Physijs.BoxMesh.call(this, player_geometry, player_material, options.mass);
    
    //Set variable param-derived properties
    this.scene = scene;
    this.hud = hud;
    this.nickname = options.nickname;
    this.player_id = options.player_id;
    this.local = options.local;
    
    //Set post-super constants:
    this.up.x = 0; this.up.y = 0; this.up.z = 1; //Turns Z into the up-down axis (y swapped to z)
    this.castShadow = true;
    this.receiveShadow = true;
    
    //Initialise the collision rays
    this.build_rays();
    
    //Initialise a fresh life:
    this.reset(scene, hud);
    
}
SuperMega.Player.prototype = Object.assign( Object.create(Physijs.BoxMesh.prototype), {
    constructor: SuperMega.Player,
    
    //Constants:
    POWER_COLOURS: ["0xAA0000","0xBB8800","0xE0E000","0xEAEAEA"],
    PLATFORM_GRACE: 0.15, //How close you need to be to the platform to be regarded as "standing on it"
    
    POWER_STATES: {
        "jump" : [50,55,60,65],
        "move" : [MOVE_SPEED*1.0, MOVE_SPEED*1.2, MOVE_SPEED*1.4, MOVE_SPEED*1.6],
        "shoot" : [1,2,3,4],
        "max_gradient" : [1.0,1.3,1.6,1.9],
    },
    
    //Initialise variables:
    body: false, //When the patient dies adds a dead body to the scene
    noms: 0, //Number of noms collected
    hp: 0, //Hitpoints
    sprite: null, //The nameplate and hp bar
    balls: {}, //Tracking the player's balls which are in the scene
    currentBallCount: 0, //Number of balls in play
    maxBallCount: 0, //Number of balls allowed in play in total
    standing_on_velocity: null, //The velocity of the platform you are standing on
    mu: 0.5, //The friction of the surface you are standing on
    
    
    //Ray storers
    ray_names: [],
    ray_dirvectors: [],
    bottom_vertices: [],
    bottom_vertices_names: [],
    top_vertices: [],
    top_vertices_names: [],
    front_vertices: [],
    front_vertices_names: [],
    back_vertices: [],
    back_vertices_names: [],
    left_vertices: [],
    left_vertices_names: [],
    right_vertices: [],
    right_vertices_names: [],
    

    //Methods:
    build_rays : function(){
        /**
         * Creates the collision detection rays
         */
        
        //Create collision ray LocalVectors - these are the directions we'll send the rays off in
        this.ray_dirvectors = [];
        var dirs = [[0, 0, -1], [0, 0, 1], [0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0]];
        for (var i = 0; i < dirs.length; i++) {
            this.ray_dirvectors.push(new THREE.Vector3(dirs[i][0]*(this.geometry.width/2),dirs[i][1]*this.geometry.depth/2,dirs[i][2]*this.geometry.height/2));
        }
        for (var vertexIndex = 0; vertexIndex < this.geometry.vertices.length; vertexIndex++){
            this.ray_dirvectors.push(this.geometry.vertices[vertexIndex]); //Add the rays off to the vertices
        }
        //Index numbers:       0        1       2        3       4       5           6              7                8                 9                  10               11                12              13
        this.ray_names = ["bottom", "top", "front", "back", "left", "right", "leftbacktop", "leftbackbottom","leftfronttop","leftfrontbottom", "rightbackbottom", "rightbacktop", "rightfrontbottom", "rightfronttop"]; //Let's hope the THREE vertex order never changes!!
        //z axis perpendicular
        this.bottom_vertices = [this.ray_dirvectors[7], this.ray_dirvectors[9], this.ray_dirvectors[10], this.ray_dirvectors[12]]; //Store our vectors with "bottom" in them
        this.bottom_vertices_names = [this.ray_names[7], this.ray_names[9], this.ray_names[10], this.ray_names[12]];
        this.top_vertices = [this.ray_dirvectors[6], this.ray_dirvectors[8], this.ray_dirvectors[11], this.ray_dirvectors[13]]; //Store our vectors with "top" in them
        this.top_vertices_names = [this.ray_names[6], this.ray_names[8], this.ray_names[11], this.ray_names[13]];
        
        //x axis perpendicular
        this.left_vertices = [this.ray_dirvectors[4], this.ray_dirvectors[6], this.ray_dirvectors[7], this.ray_dirvectors[8], this.ray_dirvectors[9]]; //Store our vectors with "left" in them, INCLUDING THE CENTRAL VECTOR (it's a large face!)
        this.left_vertices_names = [this.ray_names[4], this.ray_names[6], this.ray_names[7], this.ray_names[8], this.ray_names[9]];
        this.right_vertices = [this.ray_dirvectors[5], this.ray_dirvectors[10], this.ray_dirvectors[11], this.ray_dirvectors[12], this.ray_dirvectors[13]]; //Store our vectors with "top" in them
        this.right_vertices_names = [this.ray_names[5], this.ray_names[10], this.ray_names[11], this.ray_names[12], this.ray_names[13]];
        
        //y axis perpendicular
        this.front_vertices = [this.ray_dirvectors[2], this.ray_dirvectors[8], this.ray_dirvectors[9], this.ray_dirvectors[12], this.ray_dirvectors[13]]; //Store our vectors with "front" in them, INCLUDING THE CENTRAL VECTOR (it's a large face!)
        this.front_vertices_names = [this.ray_names[2], this.ray_names[8], this.ray_names[9], this.ray_names[12], this.ray_names[13]];
        this.back_vertices = [this.ray_dirvectors[3], this.ray_dirvectors[6], this.ray_dirvectors[7], this.ray_dirvectors[10], this.ray_dirvectors[11]]; //Store our vectors with "back" in them
        this.back_vertices_names = [this.ray_names[3], this.ray_names[6], this.ray_names[7], this.ray_names[10], this.ray_names[11]];
        
        //Organise into dict:
        this.flat_plane_points = {
            "x" : this.left_vertices,
            "-x" : this.right_vertices,
            "y" : this.back_vertices,
            "-y" : this.front_vertices
        }
        this.flat_plane_points_names = {
            "x" : this.left_vertices_names,
            "-x" : this.right_vertices_names,
            "y" : this.back_vertices_names,
            "-y" : this.front_vertices_names
        }
        this.flat_plane_points_directions = {
            "x" : new THREE.Vector3(1,0,0),
            "-x" : new THREE.Vector3(-1,0,0),
            "y" : new THREE.Vector3(0,1,0),
            "-y" : new THREE.Vector3(0,-1,0)
        }
            
        
        this.caster = new THREE.Raycaster(); //Use one raycaster, save memory!
        
    },
    
    
    reset : function(options, scene, hud){
        /**
         * Resets the player's position and score etc.
         * 
         * @param options: {} currently not used.
         * @param scene: <Physijs.scene> the scene
         * @param hud: <jQuery Element> the head up display
         */
        options = options || {};
        scene = scene || this.scene;
        hud = hud || this.hud;
        
        this.ready = false; //Flag to turn off the collision detection until everything rendered
        
        // Assign starting properties
        this.hp = 100.0;
        this.power_state = 0; //Start off at nowt power
        this.isJumping = false; //Not used
        this.velocity = new THREE.Vector3(0,0,0); //Actual velocity relative to player
        this.standing_on_velocity = new THREE.Vector3(0,0,0); //The velocity of the last thing you stood on!
        this.jump_keydown_continuously = false; //Space is not being pressed
        this.balls = [];
        this.currentBallCount = 0;
        this.maxBallCount = 0;
        
        //Set up the sprite:
        this.update_sprite();
        this.delete_balls(this.scene, this.hud); //Bin the balls
        
        //Remove any straggling bodies:
        if(this.body){
            scene.remove(this.body);
        }
        
        //Show player!
        this.visible = true;
        this.__dirtyPosition = true;
        this.__dirtyRotation = true;
    },
    
    rotateVelocity : function(z_rotation_speed){
        /**
         * Adjusts the player's velocity for conservation of momentum if player rotates while moving (most noticable on ice sliding)
         * @param z_rotation_speed: <float> The angular momentum player is rotating by
         */
        //Capture old velocities:
        var old_vel = this.velocity.clone();
        //Convert to new velocity. NB if we rotate the player clockwise, our velocities are moving ANTICLOCKWISE relatively, hence an inverse angular momentum
        this.velocity.x = old_vel.x * Math.cos(z_rotation_speed) + old_vel.y * Math.sin(z_rotation_speed); //Rotational matrix. 
        this.velocity.y = old_vel.y * Math.cos(z_rotation_speed) + -old_vel.x * Math.sin(z_rotation_speed); //For rotational matrices we use -(sin A)  on the second axis
        this.velocity.z = old_vel.z; //Yep, it's simply (0,0,1) for that rotational matrix!
    },
    
    adjustStandingOnVelocity : function (platformObj){
        //Sanity check the platform has returned its velocity (we have to be nearly in contact with it)
        /**
         * Adjusts the player's base velocity to the platform you are standing on
         * @param platformObj: The object you are standing on
         * @return: <THREE.Vector3> Final velocity
         */
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
            this.standing_on_velocity = plat_vel.applyZRotation3(this.rotation.z); //My own function which does the above
        } else {
            this.standing_on_velocity = plat_vel; //Means we're setting it to Zero
        }
        return plat_vel;
    },
    
    detectCollision: function(otherObjs){
        /**
         * Internal collision detection, uses rays which pass from object centre to vertices. Useful for "after the fact" collision detection
         * 
         * @param otherObjs: The list of objects we are testing a collision for
         * 
         * @return {
         *         "other_objects" : other_objects we collided with
         *        "rays" : dict of ray:distance to contact
         *    }
         */
        var target_objects = otherObjs || []; //TODO: default to scene collidables
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
    },
    detectCollisions : this.detectCollision,
    
    
    
    zCollisionPrediction: function(otherObjs){
        /**
         * Detects when you'll collide with something if jumping or falling, so that we can arrest the Z movement by the specified amount
         * This stops you jumping and falling through platforms. It'll also ensure you "hover" just over objects rather than collide with them all the time
         * Uses rays extending from the object above and below
         * 
         * @param otherObjs: The list of objects we are testing a collision for
         * 
         * @return: {
         *             direction: 1 (up) / -1 (down),
         *             shortest: <float>, (the distance down or up (depending on standing/falling or jumping) to the nearest object)
         *             x_gradient: <x_gradient fraction>,
                    z_gradient: <z_gradient fraction>,
         *             distances: [<float_dist1>,<float_dist2>,<float_dist3>,<float_dist4>],
         *             vertices: [<vertex1>,<vertex2>,<vertex3>,<vertex4>]
         *             vertices_names: [<vertexname1>,<vertexname2>,<vertexname3>,<vertexname4>]
         *             floor_properties: [<vertex1properties>,<vertex2properties>,<vertex3properties>,<vertex4properties>]
         * }
         */

        //Order: leftbackbottom, leftfrontbottom, rightbackbottom, rightfrontbottom
        //Sanitise inputs
        var target_objects = otherObjs || []; //TODO: Default to scene collidables
        
        //Determine direction to use
        var zVertices = this.bottom_vertices; //Default to looking down
        var direction = new THREE.Vector3(0,0,-1); //Downwards
        var vertex_names = this.bottom_vertices_names;
        if(this.velocity.z>0){ //Player is jumping up
            zVertices = this.top_vertices; //Look up instead
            direction = new THREE.Vector3(0,0,1); //upwards
            vertex_names = this.top_vertices_names;
        } else { //Standing or falling
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
        if(Math.abs(shortest_dist) < 2*this.PLATFORM_GRACE){ //Just come into contact with a platfornm
            if(this.velocity.z<=0){ //Standing on it
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
    },
    
    quickCollisionPrediction: function(otherObjs, excludedObjsIds, delta){
        /**
         * Detects collisions that are about to happen in the x and y direction.
         * This allows you to detect when you're about to get shoved by a moving platform
         * 
         * @param otherObjs: [<object>] A list of objects to test against
         * @param excludedObjs: [<object>] A list of objects to ignore (e.g. the ones you are standing on!)
         * @param delta: Time since last frame (useful for detecting downstream touched events)
         * @return: {
         *         "x" : [<collision_object>,<collision_object>,], //Collisions to the LEFT
         *         "-x" : [<collision_object>,<collision_object>,], //Collisions to the RIGHT
         *         "x" : [<collision_object>,<collision_object>,], //Collisions to the RIGHT
         * }
         */
        //Sanitise inputs
        var target_objects = otherObjs || []; //TODO: default to scene collidables. Should pass in all collidables 
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
                //        ray_direction.x * (this.velocity.x - rot(platform_velocity.x)) > 0        //In which case, set this.velocity.x = rot(platform_velocity.x)
                // or..        ray_direction.y * (this.velocity.y - rot(platform_velocity.y)) > 0        //In which case, set this.velocity.y = rot(platform_velocity.y)
                if(object_velocity){
                    //console.log("Object velocity: "+object_velocity.str());
                    var object_velocity_rel_player = object_velocity.applyZRotation3(this.rotation.z);     //Convert the platform's velocity into the player's axis (it'll copy it for us)
                    //console.log("Rotated object velocity: "+object_velocity_rel_player.str());
                } else {
                    var object_velocity_rel_player = 0;
                }
                var x_axis_collision = direction_player.x * (this.velocity.x - object_velocity_rel_player.x); 
                if(x_axis_collision > 0){ //That's a collision in the x axis
                    this.velocity.x = object_velocity_rel_player.x;
                    this.standing_on_velocity.x = 0; //Ensures you'll be swiped off if you're also on a moving platform
                }
                var y_axis_collision = direction_player.y * (this.velocity.y - object_velocity_rel_player.y)
                if(y_axis_collision > 0){ //That's a collision in the y axis
                    this.velocity.y = object_velocity_rel_player.y;
                    this.standing_on_velocity.y = 0;
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
    },
    
    lastMovementCausesCollision: function(x,y,z,objs){
        /**
         * Checks that the last movement is ok, or has cause a collision / made a collision worse
         * @param x: the amount Left/Right moved
         * @param y: the amount forward/backwards moved
         * @param z: the amount up/down moved
         * @param objs: the objects to test collision against
         * 
         * @return: false if movement is ok, decimal for the ray length if it causes a collision
         */
        var ray_collisions = this.detectCollision(objs).rays;
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
    },
    
    intersects_terrain : function(terrain_objs){
        /**
         * Determines if the player is intersecting the terrain, if
         * so return the z (height) below the player where intersection
         * occurs
         * 
         * @param terrain_objs: The list of the solid terrain objects to test against
         * 
         * @return: <float> The z coordinate where the intersection is
         */
        terrain_objs = terrain_objs || []; //TODO: pull in from the level
        
        // Init raycaster
        var rayLength = 1000,           // look for collisions in a 1000 unit span
            upperZ = rayLength / 2,     // start 500 units above origin
            lowerZ = upperZ * -1,       // go 500 units below origin
            origin = new THREE.Vector3(this.position.x, this.position.y, upperZ), // offset origin at given 2d coords
            direction = new THREE.Vector3(this.position.x, this.position.y, lowerZ), // ray direction points from top-down

            // Init the ray caster
            r = new THREE.Raycaster(origin.clone(), direction.clone().sub(origin.clone()).normalize());

        //return r.intersectObjects($.merge([ ground, water, hills ],all_trees), true); //IntersectObjects is an inherent function in THREE.js
        var intersects = r.intersectObjects(terrain_objs, true);
        if(intersects.length>0){
            return intersects[0].point.z; //Return the Z coordinate of intersect
        }
        return null;
    },
    
    adjust_to_stand_on_terrain : function(terrain_objs){
        /**
         * Sticks the player to the terrain if they are just about standing on it.
         * Because the terrain is a convoluted mesh (lots of triangles), collision detection
         * involving 4 rays is expensive, so we do it with one.
         * 
         * @param terrain_objs: [] The terrain meshes
         */
        
        // Attempt to intersect the ground
        var z = this.intersects_terrain(terrain_objs); //Gets the position of the terrain at player's X & Y

        // If there was an intersection, lock the player z to it
        if (z != null) {
            // Apply a 1 unit diff to the position, to accommodate the player model
            var diff = z - this.position.z + 1 + this.PLATFORM_GRACE; //Work out the difference between player and the ground
            //console.log("z:"+z+" diff:"+diff);
            if(this.velocity.z < 0){ //IF player is around abouts on the surface and falling, move to surface and zero falling 
                if(diff > -this.PLATFORM_GRACE && diff < 15.0){ //Only correct if sinking below ground, or almost touching ground 
                    this.translateZ(diff); //Correct onto ground
                    this.velocity.z = 0; //Stop falling
                    this.isJumping = false; //By definition you are not jumping!
                    this.standing = true;
                    this.standing_on_velocity = new THREE.Vector3(0,0,0); //The ground is static
                }
            }

            // Since players are physics objects, physijs requires this hack
            this.__dirtyPosition = true;
            this.__dirtyRotation = true;
        }
        
        return this; //For chaining        
    },
    
    
    move_according_to_velocity : function(delta, level){
        /**
         * Moves this player according to their internal velocities
         * It's essentially the .animate() function for player!!
         * 
         * @param delta: The time since last frame
         * @param level: The level, from which the terrain and collidables are extracted 
         */
        var p = this; //Quick alias
        var width = level.world_width*2;
        var depth = level.world_depth*2;
        var all_collidables = level.collidables; //Things you clip to (can collide with)
        var all_interactables = level.interactables; //Things you can pick up
        var all_terrain = level.terrain; //The terrain we can interact with
        
        var to_move = 0; //Throwaway var to remember how much you moved
        var z_grad_move = 0; //Adjustments of Z in response to a gradient
        
        //Tracking old positions
        var oldPos = p.position.clone() //We need to update this with every movement
        var preMovePos = p.position.clone() //We need to update this with every movement
        
        var x_collide = "",
            y_collide = "",
            z_collide = "";
        
        //When it comes to the flat plane, maximum gradients apply:
        var max_grad = this.POWER_STATES.max_gradient[this.power_state]; //The max gradient you can tolerate depends on your power!
        
        
        //Move player to new position:
        this.hasMoved = false;
        if(this.mass==0){ //Use Mike's translations engine
            //UP/DOWN: Z - First deal with the more complex up/down direction
            this.standing = false;
            var x_move_slipping = 0;
            var y_move_slipping = 0;
            to_move = (this.velocity.z + this.standing_on_velocity.z)*delta; //Standing_on_velocity is the platform velocity you are on
            //Use the upwards and downwards rays to see if you are going to hit something between frames, and stop short of it
            var dist_to_hit = this.zCollisionPrediction(all_collidables); //Determine when we're gonna hit something. dist_to_hit.shortest is infinity if no collision imminent
            if(this.velocity.z>0){ //Jumping
                if(to_move > dist_to_hit.shortest){ //You're gonna hit your head.
                    to_move = dist_to_hit.shortest; //Stop at head impact
                    this.velocity.z = 0; //Set velocity to zero
                    player.jump_keydown_continuously = false; //Null off the persistent space press
                    this.standing = false;
                    if(dist_to_hit.hit_touchable){
                        dist_to_hit.hit_touchable.touched(delta, p, level); //Detect whacking head on trap
                    }
                }//Z
            } else { //Falling or walking
                if(-to_move > (dist_to_hit.shortest - this.PLATFORM_GRACE)){ //You're gonna land on your feet (NB to_move is vector, dist_to_hit is scalar!)
                    //LANDING ON A PLATFORM
                    to_move = -1 * (dist_to_hit.shortest - this.PLATFORM_GRACE); //Stop just a smidgen before your feet touch the platform
                    this.standing=true;
                    this.isJumping = false;
                    player.jump_keydown_continuously = false; //Null off the persistent space press
                    if(dist_to_hit.hit_touchable){
                        dist_to_hit.hit_touchable.touched(delta, p, level); //Detect whacking head on trap
                    }
                }// Z
                if(dist_to_hit <= this.PLATFORM_GRACE){ //The definition of standing is if you are perched at the grace distance above a platform
                    //STANDING ON A PLATFORM
                    this.standing = true;
                    //this.adjustStandingOnVelocity(dist_to_hit.standing_on); //Adjust our standing velocity
                    this.isJumping = false;
                    if(dist_to_hit.hit_touchable){
                        dist_to_hit.hit_touchable.touched(delta, p, level); //Detect whacking head on trap
                    }
                }
                //SLIPPING CODE: Now, check to see if our gradient is actually safe:
                if(this.standing && (Math.abs(dist_to_hit.x_gradient) > max_grad || Math.abs(dist_to_hit.y_gradient) > max_grad) ){ //Sorry, you're just too slippy!
                    this.standing = false; //This will just boost the z velocity,
                } else if(this.standing) { //We've hit a platform, Gradient is ok, so we can arrest the fall on this platform
                    //LANDING ON A PLATFORM which is not too steep
                    this.velocity.z = 0; //Set velocity to zero
                    this.adjustStandingOnVelocity(dist_to_hit.standing_on); //Adjust our standing velocity to match the platform if the platform is moving
                }
                //console.log(dist_to_hit.x_gradient+"/"+dist_to_hit.y_gradient+" max:"+max_grad);
            }
            this.translateZ(to_move); //Jumping (+) / falling (-)
            //Check that this move has not caused a collision with a collidable
            if(this.lastMovementCausesCollision(0,0,to_move,all_collidables)!==false){ //Collided in the z direction
                z_collide = "collision";
                //this.position.copy(oldPos); //Reset position
                this.translateZ(-to_move);
                this.velocity.z = 0; //Kill movement
                this.isJumping = false; //Allows player to use space again!
                //this.standing = false;
            }else{
                this.hasMoved=true;
            }// Z
            
            
            //Now detect any imminent collisions in the left/right/forwards/backwards plane
            var horizontal_collisions = player.quickCollisionPrediction(all_collidables, dist_to_hit.standing_on_ids, delta); //Second property is the stuff you are standing on
            
            //LEFT/RIGHT: X, did they collide?
            oldPos = this.position.clone() //We need to update this with every movement
            to_move = (this.velocity.x + this.standing_on_velocity.x)*delta + x_move_slipping; //Player_velocity + platform_velocity + velocity from slope slippage
            z_grad_move = 0; //Default to nil movement
            if(dist_to_hit.x_gradient > -3 && dist_to_hit.x_gradient < 3){ //We have a legit gradient here
                if(Math.abs(dist_to_hit.x_gradient) >= max_grad){ //Too steep, SLIDE!!
                    this.standing=false;
                    //TODO: Implement sliding
                }
                z_grad_move = to_move * dist_to_hit.x_gradient; 
            }
            this.translateX(to_move); //Principle movement
            this.translateZ(z_grad_move); //adjustment for gradient
            //Checks collision against non-ground objects
            if(this.lastMovementCausesCollision(to_move,0,0,all_collidables)!==false){ //You collided with something in the x direction
                x_collide = "collision";
                //this.position.copy(oldPos); //Reset position
                this.translateX(-to_move); //Undo the movement
                this.translateZ(-z_grad_move); //Undo adjustment for gradient
                this.velocity.x = 0; //Kill movement in that direction
            } else {
                this.hasMoved = true;
            }
            
            //FORWARDS/BACKWARDS: Y
            oldPos = this.position.clone() //We need to update this with every movement
            to_move = (this.velocity.y + this.standing_on_velocity.y)*delta + y_move_slipping;
            z_grad_move = 0; //Default to nil movement
            if(dist_to_hit.y_gradient > -3 && dist_to_hit.y_gradient < 3){ //We have a legit gradient here
                if(Math.abs(dist_to_hit.y_gradient) >= max_grad){ //Too steep, SLIDE!!
                    this.standing=false;
                }
                z_grad_move = to_move * dist_to_hit.y_gradient;
            }
            this.translateY(to_move); //Forwards (-), Backwards (+)
            this.translateZ(z_grad_move); //adjustment for gradient
            //var collision = playerTouchingObjs(p); //Checks collision against non-ground objects
            if(this.lastMovementCausesCollision(0,to_move,0, all_collidables)!==false){ //Collided in the y direction
                y_collide = "collision";
                //this.position.copy(oldPos); //Reset position
                this.translateY(-to_move);
                this.translateZ(-z_grad_move); //Undo adjustment for gradient
                this.velocity.y = 0; //Kill movement in that direction
            } else {
                this.hasMoved = true;
            }
            
            //TODO: add support for stepup = catching the very bottom of your foot on a platform is as good as stepping onto it
            //if(collision=="stepup"){ //Only the bottom of your character collided gently with a platform, so step onto it
            if(0){
                this.velocity.z = 0; //Kill movement in that direction
                z_collide = collision.contact_type;
                this.translateZ(1*collision.stepup_amount); //Do not undo the movement, just adjust the z position
                this.isJumping = false;
                this.standing = true;
                this.hasMoved = true;
            }
        }else{ //Mass > 0 
            //Use Physijs forces. This will do all the collision and rebound detection for us
            //Player has mass, so apply a force to centre of gravity 
            var force = new THREE.Vector3(xTranslation, yTranslation, zTranslation);
            this.applyCentralImpulse(force);
        }
        
        
        //Have you moved out of bounds?
        if (!isBetween(this.position.x, -width, width) ||
            !isBetween(this.position.y, -depth, depth)) {
            // Revert and report movement failure
            this.standing_on_velocity = new THREE.Vector3(0,0,0); //Null movement
            this.velocity.x = 0;
            this.velocity.y = 0;
            this.position.x = preMovePos.x;
            this.position.y = preMovePos.y;
            this.hasMoved = false;
            //NB: do not zero the z velocity!!
        }
    
        
        //Update physi.js
        this.__dirtyPosition = true;
        this.__dirtyRotation = true;
       
        //If you have moved, are you still on the ground?
        //jumpingOrFallingPlayerZ(p); //This will soon be replaced by our clever vertical rays
        this.adjust_to_stand_on_terrain(all_terrain); //Player intrinsic method
        
        //Collect any collectables you are touching:
        var hit_collectables = this.detectCollision(all_interactables);
        if(hit_collectables && level.loaded && player.ready){
            console.log("Hit pickup!!")
            var already_hit = [];
            $.each(hit_collectables.other_objects, function(){
                if(already_hit.indexOf(this)==-1){ //Prevent double-collision issues
                    this.collect(delta, player, level); //Collect this object!
                    already_hit.push(this);
                }
            });
        }
        
        
        //Horizontal velocity decay: //TODO: viscous fluids - e.g. drags through water
        var mu = 0.5; //Standard friction of ground
        if(dist_to_hit.shortest < 2*this.PLATFORM_GRACE) { //Only apply friction if we're actually standing on the platform!!
            var mu = dist_to_hit.floor_properties.friction; //Returned from our player.zCollisionPrediction()
            if(mu<=0 || mu > 10){
                mu = 0.5;
            }
        }
        //Perform self-initiated velocity decay
        this.velocity.x = this.velocity.x - (this.velocity.x * 20.0 * mu * delta);
        this.velocity.y = this.velocity.y - (this.velocity.y * 20.0 * mu * delta);
    
        //Gravity!! - only if not standing
        if(!this.standing){
            this.velocity.z -= 9.8 * 10.0 * delta; // 10.0 = mass
        }
    
        //Debug stats:
        var collisiondata = "Clip X:"+x_collide+", Y:"+y_collide+", Z:"+z_collide+""
        var playerrot = "Player rot: "+this.rotation.x.toFixed(2)+","+this.rotation.y.toFixed(2)+","+this.rotation.z.toFixed(2)+"("+(this.rotation.z*(180/Math.PI)).toFixed(1)+")";
        var playerpos = "Player pos: "+this.position.x.toFixed(2)+","+this.position.y.toFixed(2)+","+this.position.z.toFixed(2);
        var playervel = "Player vel: "+this.velocity.x.toFixed(2)+","+this.velocity.y.toFixed(2)+","+this.velocity.z.toFixed(2);
        $('#debug-stats').html(collisiondata+"<br/>"+playerrot+"<br/><br/>"+playerpos+"<br/>"+playervel+"<br/>µ:"+mu+", PlatformVel: "+this.standing_on_velocity.x+","+this.standing_on_velocity.y+","+this.standing_on_velocity.z);
        
        //Return the friction so the rest of our engine can use it.
        this.mu = mu;
        return mu;
    },
    
    make_sprite: function(options){
        /**
         * Creates the "sprite" = Player's nameplate and hitpoint bar
         * 
         * @param options: {
         *         nickname: <string> the player's nickname>
         *         hp: <int> the player's hitpoints
         * @return: <object> The sprite
         */
        options = options || {};
        options.nickname = options.nickname || this.nickname;
        options.hp = options.hp || this.hp;
        
            // Init canvas and drawing sizes, offsets, etc
            var canvas = document.createElement('canvas'),
                context = canvas.getContext('2d'),
                size = 512,
                hpSize = 100,
                hpOffset = 20,
                hpWidth = Math.max(0, Math.round(options.hp)),
                hpHeight = 10,
                fontSize = 24,
                paddingHeight = 10,
                paddingWidth = 10;
    
            // Assign height/width from setup
            canvas.width = size;
            canvas.height = size;
            
            // DRAW NAME BACKGROUND AND NAME
            context.textAlign = 'center';
            context.font = fontSize+'px Arial';
            context.fillStyle = "rgba(50, 50, 50, 0.25)";
            var textWidth = context.measureText(options.nickname).width;
    
            // Text background should be semi-transparent
            context.fillRect(
                size/2 - textWidth/2 - paddingWidth,
                size/2 - (fontSize*1.6) / 2 - paddingHeight,
                textWidth + paddingWidth*2,
                fontSize + paddingHeight*2
            );
    
            // Draw text
            context.fillStyle = '#ffffff';
            context.fillText(options.nickname, size / 2, size / 2);

            // DRAW HP BARS
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
            var sprite_material = new THREE.SpriteMaterial({
                map: canvasTexture,
                transparent: false,
                useScreenCoordinates: false,
                color: 0xffffff // CHANGED
            });
    
            // Create and return a fancy new player sprite
            var sprite = new THREE.Sprite(sprite_material);
            sprite.scale.set( 10, 10, 1 );
            this.sprite = sprite; //Store in object
            return sprite;
    },
    
    update_sprite : function(){
        /**
         * Updates the player's name and hitpoint bar (called the "sprite")
         * 
         * @return: <object> Updated sprite
         */
        var p = this;
        // Remove the old sprite
        if (this.sprite != null) {
            this.remove(this.sprite);
        }
        this.sprite = this.make_sprite({"nickname":this.nickname, "hp":this.hp}); // Create a new sprite
        this.sprite.position.set(0, 0, 2); // Offset the sprite above the player
        this.add( this.sprite );  // Add the sprite to the player object
        return this.sprite;
    },
    
    
    delete_balls : function(scene, hud, options) {
        /**
         * Deletes all of the given player's balls from the scene
         * @param scene: <Physijs.scene> to remove balls from
         * @param hud: <jQuery HUD element> to update ball count
         * @param options: {} Not currently used
         */
        //Resolve inputs
        scene = scene || this.scene || null;
        hud = hud || this.hud || null
        if(scene==null){
            console.log("ERROR: Player.delete_balls(scene, hud) requires a valid scene as argument.");
        }
        if(hud == null){
            console.log("WARNING: Player.delete_balls(scene, hud) cannot update the hud without a valid hud passed in!!");
        }
        
        // Assemble the ball key starting pattern
        var keyPrefix = 'p'+this.player_id+'b';

        // Find balls that belong to the player
        for(var i in this.balls) {

            // If the ball's id matches the starting pattern, delete the ball
            if (i.substr(0, keyPrefix.length) == keyPrefix) {
                scene.remove(this.balls[i]);
                this.balls[i] = null;
                delete this.balls[i];

                // If the ball was owned by the client player, give the ball back in the inventory
                if (this.playerId == targetPlayerId) {
                    this.currentBallCount--;
                }
            }
        }

        // Update the ball counter HUD cuz the player count might have changed
        hud.currentBallCount.text(this.maxBallCount - this.currentBallCount);
    },
    
    set_power : function(pow){
        /**
         * Sets the player's power level to pow
         * 
         * @param pow: <int> the power level from 0-3
         */
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
            this.maxBallCount = 0;
        }else{
            this.maxBallCount = 10;
        }
        this.hud.currentBallCount.text(this.maxBallCount - this.currentBallCount);
        this.hud.maxBallCount.text(this.maxBallCount);
        
        return this.power_state;
    },
    setPower : function(pow){return this.set_power(pow)}, //ALIAS
    
    power_up : function(increment){ 
        /**
         * Increases the player's full power state by n
         * 
         * @param increment: Number of power steps to jump by, default = 1
         */
        increment = increment || 1;
        var old_power = this.power_state;
        //+1 to power
        var new_power = this.set_power(this.power_state+increment);
        var outcome = (old_power < new_power); //Should return true if power up has happened
        if(outcome){ //You get all your balls back
            this.currentBallCount = 0;
        }
        return outcome;
    },
    
    respawn : function(){
        this.heal(100);
        this.reset();
    },
    
    injure : function(damage){
        /**
        * Injures the player, if player loses all hit points, drops down a power level
        * 
        * @param damage: The amount of hitpoints to deduct from this power state
        */
        this.hp -= damage;
        if(this.hp <= 0){
            if(this.power_state<=0){ //DEATH!!
            // Drop a hilarious boundy dead body
                    this.body = dropDeadBody(this);
    
                    // Hide the normal model
                    this.visible = false;
                    this.sprite.visible = false;
    
                    // Publish death notification //TODO: Put into the Level obj
                    addNotification(this.nickname + " was killed.");
                    deadScreen.show();
            } else { //Decrement the power state by 1
                this.setPower(this.power_state-1);
                this.hp = 100; //Restore hps for lower power level
            }
            
        }
        // Update the remote player's sprite for the HP changes
        this.update_sprite();
    },
    
    heal : function(life){
        /**
         * Boosts the player's health by the life amount
         * 
         * @param life: The amount of hitpoints to recover
         */
        this.hp += life;
        if(this.hp > 100.0){
            this.hp = 100.0;
        }
        //Update the remote player's sprite for the HP changes
        this.update_sprite();
    },
    
    get_nom : function(noms_collected){
        /**
         * Increases nom score:
         * @param noms_collected: The number of noms just picked up
         */
        noms_collected = noms_collected || 1;
        this.noms += 1;
        this.hud.nomCount.text(this.noms);
    },
    
    throw_ball : function(socket, level){
    /**
     * When player throws a ball
     * 
     * @param socket: <WebSocket> The web socket used to receive and send events
     * @keyword level: <SuperMega.Level> The level. Will catch from central object if not supplied
     * @return: <Physijs.Mesh> The ball thrown
     */

    // Abandon this request if the player has met or exceeded their ball limit
    var player = this;
    level = level || this.level;
    
        if (player.currentBallCount >= player.maxBallCount) {
            console.log("CurrentBallCount "+player.currentBallCount+" >= maxBallCount "+player.maxBallCount);
            return;
        }
        if(player.power_state<1){ //Low power state cannot throw ball
            console.log("Player power state "+player.power_state+" < 1");
            return;
        }

        // Increment the number of balls in use by the player and update the HUD
        player.currentBallCount++;
        player.hud.currentBallCount.text(player.maxBallCount - player.currentBallCount);

        // Copy the player's position and randomize the bounciness factor
        var position = player.position.clone(),
         restitution = Math.min(1, Math.max(.4, Math.random() * 1.5));

        // Move the firing location to just above the player's head (1-unit)
        position.z += 2;

        // Determine the initial force to apply based on player vertical angle
        // The higher you look, the farther out it will go (faster, harder)
        // The lower you look, the closer it will go (slower, shorter)
        var ball_init_velocity_factor = player.POWER_STATES.shoot[player.power_state];
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
            sourcePlayerId: player.player_id,
            force: force,
            position: position,
            restitution: restitution,
            ballId: ++level.ball_counter
        };

        // Broadcast the ball to the other clients
        socket.emit('fire', eventData);

        // Add the ball to the world
        level.add_ball(
            position,
            force,
            restitution,
            this.player_id,
            player.material.color,
            eventData.ballId);
    }
    
}); 
Object.defineProperty(SuperMega.Player.prototype, 'userData', {
    /**
     * Allows us to fall back to the old userData property
     */
    get: function() {
        return {
            "hp" : this.hp,
            "id" : this.player_id,
            "player_id" : this.player_id,
            "nickname" : this.nickname,
            "sprite" : this.sprite
        };
    }
});


/**
 * Interactable: An object you can play with, which can move
 * 
 * If no geometry and material supplied, creates a transparent container object (cube) which can contain objects inside
 * We do simple cube collision detection against this container object 
 * It gains a load of extra methods to deal with the interaction
 * 
 * @param options: The keywords for creating a supermega item. all are optional
 *     {
 *        geometry: <THREE.geometry> The geometry object to base this on, (default cube)
 *        material: <Physijs.Material> Material to coat this object with, (default transparent)
 *        contains: [<Mesh1>,<Mesh2>] A list of sub objects which will reside inside this
 *       position: <THREE.Vector3> Where the platform's "origin" is in terms of the scene
 *       orientation: <THREE.Vector3> The rotational orientation of the object.
 *        angular_momentum: <THREE.Vector3> the rotational movement of the object (Radians per second) 
 *       translation: <THREE.Vector3> the translational movement of the object (units per second)
 *       rotation_mode: <str> "oscillating" | "continuous"
 *       translation_mode: <str> "oscillating" | "continuous" | "orbiting"
 *       magnitude: <float> how long a path is (in units), or how wide (radius) an orbiting path
 *       size: <[array]> Array of sizes x,y,z to make the object (ignored if geometry set)
 *       color: <Hex colour> The colour you wish to set it as (default pinkish red)
 *       friction: <float> how much friction the platform should have (default mid .5)
 *       restitution: <float> how stiff it should be on collisions (default low-mid .4)
 *       preset: <str> replaces any of the above values with a defined preset dict (e.g. useful for ice platforms)
 *     }
 * 
 * Internal properties:
 *     this.geometry
 *    this.material
 *    this.mass
 *    this.ops    A copy of the input options
 *    this.position    Where it is in space
 *    this.orientation
 *    
 */
SuperMega.Interactable = function (options){
    
    //Resolve options:
    var ops = {
        "geometry" : options.geometry || null, //Will use a blank cube to contain everything
        "material" : options.material || null, //Will be transparent cube
        "mass" : options.mass || 0,
        "contains" : options.contains || [], //Sub objects, contained within
        "position" : options.position || null,
        "size" : options.size || [1,1,1],
        "color" : options.color || options.colour || 0xA0A0A0,
        "opacity" : options.opacity || 1,
        "friction" : options.friction || .5,
        "restitution" : options.friction || .4,
        "orientation" : options.orientation || new THREE.Vector3(0,0,0),
        "angular_momentum" : options.angular_momentum || new THREE.Vector3(0,0,0),
        "translation" : options.translation || new THREE.Vector3(0,0,0),
        "rotation_mode" : options.rotation_mode || null,
        "translation_mode" : options.translation_mode || null,
        "magnitude" : options.magnitude || 0,
        "level" : options.level || null, //Can pass the level in for manipulating pickups
        "preset" : options.preset || null //Can pass the scene in for manipulating pickups
    };
    
    this.level = ops.level; //Track level if passed in at start
    
    if(ops.preset!=null){
        //Means replace our objects with the present values
        var preset = SuperMega.OBJECT_PRESETS[ops.preset] || null;
        if(preset){ //Update our options with values from the preset
            ops = $.extend(ops, preset);
        }else{
            console.log("WARNING: Preset '"+ops.preset+"' is not a known valid preset name!");
        }
    }
    
    if(ops.geometry==null){
        //Create default geometry:
        ops.geometry = new THREE.CubeGeometry(1, 1, 1, 1, 1, 1);
    }
    if(ops.material==null){
        ops.material = Physijs.createMaterial(
                                    new THREE.MeshPhongMaterial( {
                                        color: ops.color,
                                        transparent: true,
                                        opacity: 0
                                    }),
                                    ops.friction, // high friction
                                    ops.restitution // low restitution
                                );
    }
    
    //Now we have enough to create our object:
    Physijs.BoxMesh.call(this, ops.geometry, ops.material, ops.mass ); //JS inheritance hack part 1
    this.ops = ops;     //Store our options globally
    
    //Set up physical location
    this.position = ops.position;
    this.orientate(ops.orientation);
    
    //Add the sub objects to it:
    this.contains = [];
    if(ops.contains!==null){
        for(var i=0; i<ops.contains.length; i++){
            var obj = ops.contains[i];
            obj.castShadow = false;
            obj.receiveShadow = false;
            this.add(obj);
            this.contains.push(obj);
        }
    }
    
    //Set default properties:
    this.active = true; //Whether you can interact this
    this.state = false; //Can store whatever you want here. Will depend on the type of object
    this.collectable = false; //Can store whatever you want here. Will depend on the type of object
    
    //Add any extra properties - this is for any items which are pickups
    this.refractory_period = options.refractory_period || 15.0; //The time in seconds to when this stops being refractory
    this.refractory_clock = this.refractory_period; //Clock watcher, must be >= this.refractory_period to be considered active
    this.regenerates = false; //Whether this regenerates after the refractory period or not
    
    //Create movement watchers:
    this.amount_moved = new THREE.Vector3(0,0,0);
    this.velocity = new THREE.Vector3(0,0,0); //will be relative to the MAP not to the Player!!
    this.origin = this.position.clone(); //Where we started (or orbit around!)
    this.rotation_matrix = new THREE.Matrix4(); //Necessary to do axis rotations

}
SuperMega.Interactable.prototype = Object.assign( Object.create(Physijs.BoxMesh.prototype), {
    constructor: SuperMega.Interactable
}); //JS inheritance hack part 2

SuperMega.Interactable.prototype.animate = function(delta){
    /**
     * Animates the object if applicable
     * @param delta: Time since last frame
     */
    if(this.refractory_clock < this.refractory_period && this.regenerates && this.active){
        this.refractory_clock += delta; //Increment by delta
    }
    
    //Fast abort for non-movers!
    if(this.ops.magnitude == 0 && this.ops.rotation_mode == null && this.ops.translation_mode == null){
        return;
    }
    
    //Now deal with motion
        //Save current position:
    var pos_before = this.position.clone();
    //Angular_momentum applies to rotation on axis
    this.rotateX(this.ops.angular_momentum.x * delta);
    this.rotateY(this.ops.angular_momentum.y * delta);
    this.rotateZ(this.ops.angular_momentum.z * delta);
    
    //Translation along path
    var tx = this.ops.translation.x*delta;
    var ty = this.ops.translation.y*delta;
    var tz = this.ops.translation.z*delta;
    if(this.ops.translation_mode == "continuous" || this.ops.translation_mode == "reciprocating"){
        //Check if we actually should continue moving (i.e. have we moved up to the limit yet?)
        if(this.amount_moved.distanceToSquared(new THREE.Vector3(0,0,0)) < Math.pow(this.ops.magnitude,2)){ //Compare squares (computational efficiency)
        //This is just going to start moving and carry on until we reach the limit
        this.position.x += tx;
        this.position.y += ty;
        this.position.z += tz;
        this.amount_moved.x += Math.abs(tx);
        this.amount_moved.y += Math.abs(ty);
        this.amount_moved.z += Math.abs(tz);
        } else {
         if(this.ops.translation_mode == "reciprocating"){
             //So we've exceeded the single throw distance, let's flip it all around:
             this.ops.translation = new THREE.Vector3(-this.ops.translation.x,-this.ops.translation.y,-this.ops.translation.z)
             this.amount_moved = new THREE.Vector3(0,0,0); //Reset our counter:
         }
        }
    } else if (this.ops.translation_mode == "orbiting" || this.ops.translation_mode == "orbit") {
        //Now things get exciting!!! We are ORBITING AROUND the original position. Translation means the rate of progression round the orbit in radians
        //If you only set one axis translation, it'll oscillate, if you set two it'll orbit in a plane, if you set three, it'll corkscrew orbit
        this.amount_moved.x = (this.amount_moved.x + tx) % (2*Math.PI); //Wrap around  
        this.amount_moved.y = (this.amount_moved.y + ty) % (2*Math.PI);
        this.amount_moved.z = (this.amount_moved.z + tz) % (2*Math.PI);
        this.position.x = this.ops.magnitude * Math.sin(this.amount_moved.x+0) + this.origin.x; //0 degrees
        this.position.y = this.ops.magnitude * Math.sin(this.amount_moved.y+Math.PI/2) + this.origin.y; //90 degree out of phase
        this.position.z = this.ops.magnitude * Math.sin(this.amount_moved.z+Math.PI/2) + this.origin.z; //90 degree out of phase too
    }
    //Calculate velocity:
    this.velocity.x = (this.position.x - pos_before.x)/delta;
    this.velocity.y = (this.position.y - pos_before.y)/delta;
    this.velocity.z = (this.position.z - pos_before.z)/delta;
    
    //Update position for physijs;
    this.__dirtyPosition = true;
    this.__dirtyRotation = true;
};

SuperMega.Interactable.prototype.resolve_vector = function(x_or_vector, y, z){
    /**
     * Turns the supplied arguments into a true vector3 for use 
     */
    return SuperMega.resolve_vector(x_or_vector, y, z);
}

SuperMega.Interactable.prototype.orientate = function(x_or_vector, y, z, amount){
    /**
     * Changes the orientation of this object to what you specify
     * 
     *  @param x,y,z
     *       A single Vector3
     *       or, a triple array
     *       or, x,y,z as separate entities
     *       or "random" for a random rotation
     *  @param amount: The proportion of 90 degrees you wish to rotate by if using "random"
     *      
     */
    
    if(typeof x_or_vector.clone !== "undefined"){ //Has been given a vector to define rotation
    var x_rotation_amt = x_or_vector.x;
    var y_rotation_amt = x_or_vector.y;
    var z_rotation_amt = x_or_vector.z;
    }else if(typeof x_or_vector == "Array"){ //Has been given an array to define rotation
    var x_rotation_amt = x_or_vector[0] || 0;
    var y_rotation_amt = x_or_vector[1] || 0;
    var z_rotation_amt = x_or_vector[2] || 0;
    }else if(x_or_vector == "random" || x_or_vector == "Random" || typeof x_or_vector=="undefined"){ //Means randomise me!!
    amount = amount || y || 0.2;
    var x_rotation_amt = (Math.random()-0.5) * amount * Math.PI; //Tilt 
    var y_rotation_amt = (Math.random()-0.5) * amount * Math.PI;
    var z_rotation_amt = Math.random() * Math.PI;
    }else{
    var x_rotation_amt = x_or_vector || 0;
    var y_rotation_amt = y || 0;
    var z_rotation_amt = z || 0;
    }
    this.rotation.x = x_rotation_amt;
    this.rotation.y = y_rotation_amt;
    this.rotation.z = z_rotation_amt;
    this.__dirtyRotation = true;
    this.geometry.verticesNeedUpdate = true;
    return this;
}

SuperMega.Interactable.prototype.is_collectable = function(){
    /**
     * Tells you if you can pick this up or not
     * 
     * @return: <Boolean>
     */
    if(this.refractory_clock <= this.refractory_period && this.active && this.collectable){
        return true;
    }
    return false;
}

SuperMega.Interactable.prototype.pickup = function(delta, player, level){
    /**
     * "Collects" this object if it is collectable. Will start it regenerating if regeneratable
     * @param delta: The time since last frame
     * @param player: The player who is collecting this
     * @keyword level: The level we are operating in (for removing item when collected) if not passed in via options
     */
    
    if(!this.is_collectable()){
        return false;
    }
    
    level = level || null;
    
    //Now deactivate the item:
    this.refractory_clock = 0;
    
    //If scene provided, remove from scene or fade depending on mode:
    if(this.regenerates){ //Fade
        this.material.transparent = true;
        this.material.opacity = 0.5;
    } else { //Does NOT regenerate, ttfo
    if(level){ //Remove from scene
        level.remove(this, "interactables");
    } else {
        //Otherwise just make contents transparent and deactivate animations etc
        this.material.opacity = 0;
        for(var i=0; i<this.contains.length; i++){
        this.contains[i].material.opacity=0;
        this.contains[i].material.transparent=true;
        }
    }
        this.active = false; //Non-regenerating ones always deactivate
    }
}

SuperMega.Interactable.prototype.collect = function(delta, player, level){
    /**
     * Alias to ensure collect() works consistently
     * @param delta: The time since last frame
     * @param player: The player who is collecting this
     * @keyword level: The level we are operating in (for removing when collected) if not passed in via options
     */
    return this.pickup(delta, player, level);
}




/**
 * Creates a PLATFORM!!!
 * 
 * @param options: The usual set of options
 */
SuperMega.Platform = function(options){
    //Constructor
    options = options || {};
    options.opacity = options.opacity || 1;
    options.color = options.color || options.colour || SuperMega.DEFAULT_COLOURS.platform;
    options.preset = options.preset || null;
    if(options.preset!=null){
        //Means replace our objects with the present values
        var preset = SuperMega.OBJECT_PRESETS[options.preset] || null;
        if(preset){ //Update our options with values from the preset
            options = $.extend(options, preset);
        }else{
            console.log("WARNING: Preset '"+options.preset+"' is not a known valid preset name!");
        }
    }
    

    //Fix the geometry etc. DEfaults to 10,10,2
    options.geometry = options.geometry || null;
    if(!(options.geometry instanceof THREE.Geometry)){ //User has supplied an array [x,y,z] sizes instead of a geometry object, so create
        var sizes = options.geometry || options.sizes || [];
        options.geometry = new THREE.CubeGeometry(sizes[0] || 10, sizes[1] || 10, sizes[2] || 2);
    }
    options.material = options.material || Physijs.createMaterial(
                            new THREE.MeshPhongMaterial( {
                                color: options.color || SuperMega.DEFAULT_COLOURS.platform, 
                                transparent: (options.opacity < 1),
                                opacity: options.opacity,
                            }),
                            options.friction || .5, // normal friction
                            options.restitution || .4 // lowish restitution
                        );
    
    //Create the thing:
    SuperMega.Interactable.call( this, options ); //JS inheritance hack part 1
    this.collectable = false; //This is not a collectable!!
    this.inflicts_damage = 0; //How much damage is inflicted on touching for every second of contact:
    //Platforms need decent shadows!!
    this.castShadow = true;
    this.receiveShadow = true;
}
SuperMega.Platform.prototype = Object.assign( Object.create(SuperMega.Interactable.prototype), {
    constructor : SuperMega.Platform,
    touched : function(delta, player, level){
        /**
         * Injures the player
         * @param delta: The time since last frame
         * @param player: The player who is collecting this
         * @keyword level: The level we are operating in (for removing when collected) if not passed in via options
         */
        level = level || this.ops.level || null;
        
        //Injure the player:
        if(this.inflicts_damage>0){
            player.injure(this.inflicts_damage*delta);
        }
    }
});


/**
 * Creates a TRAP!!!
 * 
 * @param options: The usual set of options
 */
SuperMega.Trap = function(options){
    options = options || {};
    //Fix the geometry etc
    options.geometry = options.geometry || new THREE.CubeGeometry(10, 5, 2);
    options.material = options.material || Physijs.createMaterial(
                            new THREE.MeshPhongMaterial( {
                                color: SuperMega.DEFAULT_COLOURS.trap, //Yellow
                                transparent: false
                            }),
                            .9, // v high friction
                            .2 // low restitution
                        );
    
    //Create the thing:
    SuperMega.Platform.call( this, options ); //JS inheritance hack part 1
    this.collectable = false; //This is not a collectable!!
    this.inflicts_damage = 1000; //How much damage is inflicted on touching for every second of contact:
}
SuperMega.Trap.prototype = Object.assign( Object.create(SuperMega.Platform.prototype), {
    constructor : SuperMega.Trap
    //Touched method now defined above
});


/**
 * Creates a powerup
 * @param options
 */
SuperMega.Powerup = function(options){
    options = options || {};
    
    //Fix the geometry etc
    options.geometry = new THREE.SphereGeometry(1, 64, 64);
    options.material = Physijs.createMaterial(
                            new THREE.MeshPhongMaterial( {
                                color: SuperMega.DEFAULT_COLOURS.powerup, //Yellow
                                transparent: false
                            }),
                            .8, // high friction
                            .4 // low restitution
                        );
    
    
    //Create the thing:
    SuperMega.Interactable.call( this, options ); //JS inheritance hack part 1
    this.collectable = true; //Can be collected
    
    //Pickups have shadows
    this.castShadow = true;
    this.receiveShadow = false;
}
SuperMega.Powerup.prototype = Object.assign( Object.create(SuperMega.Interactable.prototype), {
    constructor : SuperMega.Powerup,
    collect : function(delta, player, level){
        /**
         * "Collects" this item
         * @param delta: The time since last frame
         * @param player: The player who is collecting this
         * @keyword scene: The level we are operating in (for removing when collected) if not passed in via options
         */
        level = level || this.ops.level || null;
        
        //Power up the player:
        if(this.is_collectable()){ //Means the thing can be picked up 
        //this.active=false;
            //Pick up the item (remove from scene):
            this.pickup(delta, player, level);
            player.power_up(1); //Returns true if player has more power headroom
            player.heal(100); //Ensure player gets their health up
        }
    }
});


/**
 * Creates a Nom (a collectable)
 *     Player needs to collect a certain number of noms in order to activate the end
 * @param options
 */
SuperMega.Nom = function(options){
    options = options || {};
    
    //Fix the geometry etc
    options.geometry = new THREE.SphereGeometry(0.6, 64, 64);
    options.material = Physijs.createMaterial(
                            new THREE.MeshPhongMaterial( {
                                color: SuperMega.DEFAULT_COLOURS.nom, //Cyan
                                transparent: true,
                                opacity: .8,
                            }),
                            .8, // high friction
                            .4 // low restitution
                        );
    //Create the thing:
    SuperMega.Interactable.call( this, options ); //JS inheritance hack part 1
    this.collectable = true; //Can be collected
    
    //Noms have shadows
    this.castShadow = true;
    this.receiveShadow = false;
}
SuperMega.Nom.prototype = Object.assign( Object.create(SuperMega.Interactable.prototype), {
    constructor: SuperMega.Nom,
    collect : function(delta, player, level){
        /**
         * "Collects" this item
         * @param delta: The time since last frame
         * @param player: The player who is collecting this
         * @keyword level: The level we are operating in (for removing when collected) if not passed in via options
         */
        level = level || this.ops.level || null;
        
        //+1 to the nom
        if(this.is_collectable()){ //Means the thing can be picked up 
            //this.active=false;
            //Pick up the item (remove from scene):
            this.pickup(delta, player, level);
            player.get_nom(1); //+1 to noms
        }
        
        //Update all ends in the level, so that they become active once you have eaten enough noms:
        $.each(level.the_ends, function(index, obj){
            obj.update_state(player, level);
        });
        
    }
});



/**
 * Creates the The End target of a level
 * @param options {
 *         <All the usual above options, plus>
 *         nom_threshold: <int> The number of noms which must be collected until this end activates!
 * }
 * 
 * NB: You can build a more original-like End (i.e. trapezium with a hole in it) by using cgs.js
 * http://evanw.github.io/csg.js/
 */
SuperMega.TheEnd = function(options){
    options = options || {};
    this.nom_threshold = options.nom_threshold || 5; //Default 5 noms
    
    //Build the shape
    var trapezium_geo = new THREE.CubeGeometry(6, 3, 3); //A flat large thing on its side
    var trapezium_mat = Physijs.createMaterial(
                            new THREE.MeshPhongMaterial( {
                                color: SuperMega.DEFAULT_COLOURS.the_end, //Purple
                                transparent: true,
                                opacity: 0.5, //Starts deactivated
                                wireframe: true,
                                wireframeLinewidth: 2.0
                            }),
                            .95, // v high friction
                            .4 // low restitution
                        );
    trapezium_geo.vertices[0].x = 2; //Left back top
    trapezium_geo.vertices[2].x = 2; //Left front top
    trapezium_geo.vertices[5].x = -2; //Right back top
    trapezium_geo.vertices[7].x = -2; //Right front top
    var trapezium_mesh = new Physijs.BoxMesh(trapezium_geo, trapezium_mat, 0);
    
    var circle_geo = new THREE.CylinderGeometry(1,1,3.05,12);
    var circle_mat = Physijs.createMaterial(
                            new THREE.MeshPhongMaterial( {
                                color: 0xFFFFFF, //Purple
                                transparent: true,
                                opacity: 0.6, //Starts deactivated
                                wireframe: true,
                                wireframeLinewidth: 2.0
                            }),
                            .95, // v high friction
                            .4 // low restitution
                        );
    var circle_mesh = new Physijs.BoxMesh(circle_geo, circle_mat, 0);
    circle_mesh.rotation.y = Math.PI; //Cylinder on its side
    
    options.contains = [circle_mesh]; //Pass onto the parent mesh which will contain both
    options.geometry = trapezium_geo; //The bounding container
    options.material = trapezium_mat; //The bounding container
    
    
    //Create the thing:
    SuperMega.Interactable.call( this, options ); //JS inheritance hack part 1
    this.collectable = false; //Can't be collected (removed from scene)
    
    //Jubb up the geometry
    this.geometry.dynamic = true; //We're going to dick about with this
    this.geometry.__dirtyVertices = true;
    //   0        1        2         3            4        5        6          7    
    //"leftbacktop", "leftbackbottom","leftfronttop","leftfrontbottom", "rightbackbottom", "rightbacktop", "rightfrontbottom", "rightfronttop"
    
    //End have shadows
    this.castShadow = true;
    this.receiveShadow = false;
}
SuperMega.TheEnd.prototype = Object.assign( Object.create(SuperMega.Interactable.prototype), {
    constructor: SuperMega.TheEnd,
    touched : function(delta, player, level){
        /**
         * Called when you collide with the END
         * @param delta: The time since last frame
         * @param player: The player who is collecting this
         * @keyword level: The level we are operating in (for removing when collected) if not passed in via options
         */
        level = level || this.ops.level || null;
        
        //Call the end if done
        if(player.noms >= this.nom_threshold){ //Means it's active 
            //TODO: Level End routine
            console.log("LEVEL FINISHED!!");
        }
    },
    collect : function(delta, player, level){return this.touched(delta,player,level);},
    update_state : function(player, level){
        /**
         * Should be called whenever you collect a nom to update the state
         * @param delta: The time since last frame
         * @param player: The player who is collecting this
         * @keyword level: The level we are operating in (for removing when collected) if not passed in via options
         */
        level = level || this.ops.level || null;
        //Call the end if done
        if(player.noms >= this.nom_threshold){ //Means it's active 
            this.state = true; //Active
            this.material.opacity = 1;
            this.material.wireframe = false;
        }else{
            this.state = false; //Inactive
            this.material.opacity = 0.4;
            this.material.wireframe = true;
            console.log("End still inactive");
        }
        var the_end_container = this; //Allows us to grab this in our loop of daughter meshes.
        $.each(this.contains, function(index, obj){ //Iterate the daughter meshes (cylinder)
            obj.material.opacity = the_end_container.material.opacity;
            obj.material.wireframe = the_end_container.material.wireframe;
            obj.material.needsUpdate;
        });
        console.log("Player noms: "+player.noms+"/"+this.nom_threshold);
        
        this.material.needsUpdate = true; //Ensures the object is re-rendered
    },
});