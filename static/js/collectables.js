'use strict';

/**
 * Supermega3D
 *     Main classes defining the level wrapper, level objects and their behaviour 
 *     
 *     SuperMega.Level: Level wrapper which contains the Physijs scene, and pointers to scene objects
 *     
 *     SuperMega.Player: The player and their behaviour
 *     
 *     SuperMega.Interactable: Abstract class which defines how objects move and behave
 *     SuperMega.Nom: A collectable item. You need to get enough of these in order for the level End to be active
 *     SuperMega.Platform: A platform. The thing you can stand on!
 *     SuperMega.Powerup: A power up. Reheals you, improves your speed, jump height, slope tolerance, ball chucking (lowest power cannot chuck balls)
 *     SuperMega.Switcher: A switch. When you touch it, or hit it with a ball, it turns on and stuff happens
 *     SuperMega.TheEnd: Level end. If you touch this, you win the level.
 *     SuperMega.Trap: Blue platform which saps your life if touched. Nasty. Avoid it!
 *        
 * 
 * @author Dr Michael Brooks / @michaeljtbrooks
 * Last Updated: 2017-06-04 19:59 UTC 
 */

var DEBUG = true;

//Useful constants
var DEG15 = Math.PI/12;
var DEG30 = Math.PI/6;
var DEG45 = Math.PI/4;
var DEG60 = Math.PI/3;
var DEG90 = Math.PI/2;
var DEG135 = DEG90+DEG45;
var DEG180 = Math.PI;
var DEG225 = Math.PI+DEG45;
var DEG270 = Math.PI*3/2;
var DEG315 = Math.PI+DEG45;
var DEG360 = Math.PI*2;

//Sorting out the deepcopy issue:
function clone(obj, arr, i ,j){
    if (typeof obj !== "object") {
        return obj;
    }
    
    var result = Object.create(Object.getPrototypeOf(obj)); //inherit the prototype of the original object
    if(result instanceof Array){
        result.length = Object.keys(obj).length;
    }

    i++; //depth is increased because we entered an object here
    j = Object.keys(obj).length; //native method to get the number of properties in 'obj'
    arr[i] = new Array(); //this is the x-axis, each index here is the depth
    arr[i][j] = new Array(); //this is the y-axis, each index is the length of the object (aka number of props)
    //start the depth at current and go down, cyclic structures won't form on depths more than the current one
    for(var depth = i; depth >= 0; depth--){
        //loop only if the array at this depth and length already have elements
        if(arr[depth][j]){
            for(var index = 0; index < arr[depth][j].length; index++){
                if(obj === arr[depth][j][index]){
                    return obj;
                }
            } 
        }
    }

    arr[i][j].push(obj); //store the object in the array at the current depth and length
    for (var prop in obj) {
        result[prop] = clone(obj[prop], arr, i, j);
    }

    return result;
}
function deepclone(obj) {
    var i = -1, //depth of the current object relative to the passed 'obj'
        j = 0;  //number of the object's properties
    var arr = new Array(); //3D array to store the references to objects
    return clone(obj, arr, i, j);
}
Object.deepclone = function(){
    return deepclone(this);
};



//Expanding on THREEjs:
//Add in smart print declaration of values to Vector3
THREE.Vector3.prototype.str = function(){
    return "x:"+this.x.toFixed(3)+", y:"+this.y.toFixed(3)+", z:"+this.z.toFixed(3);
};

/**
 * Applies a rotation to a vector in the Z axis to give that vector in terms of the rotated object
 * @param a: <radians> the amount our Z axis has rotated by
 * @return: <THREE.Vector3> with the new values
 */
THREE.Vector3.prototype.applyZRotation3 = function(a){
    var x,y,z;
    x = this.x * Math.cos(a) + this.y * Math.sin(a); //Rotational matrix
    y = this.y * Math.cos(a) + -this.x * Math.sin(a); //For rotational matrices we use -(sin A)  on the second axis
    z = this.z; //Yep, it's simply (0,0,1) for that rotational matrix!
    
    return new THREE.Vector3(x,y,z);
};

THREE.Euler.prototype.str = function(){
    return "x:"+this.x.toFixed(3)+", y:"+this.y.toFixed(3)+", z:"+this.z.toFixed(3);
};
var ZERO_VECTOR3 = new THREE.Vector3(0,0,0); //Zero vector for resetting vectors
var ZERO_EULER = new THREE.Euler(0,0,0); //Zero Euler for resetting rotations

//Since upgrading THREE to v85.2, there have been some changes!
THREE.CubeGeometry = THREE.BoxGeometry;


var D = function(str_msg){
	/**
	 * Debug messages
	 */
	if(DEBUG){
		console.log(str_msg);
	}
};


//Central physics constants:
var phys = {
        //Player
        "TOP_SPEED" : 25.0, //Players top speed (m/s) at basic power
        "ACCELERATION_CONST" : 120.0, //How fast a player accelerates (m per second per second) 
        
        //Friction
        "SURFACE_DRAG_COEFF" : 8, //How rapidly velocity decays when on a surface
        "AIR_DRAG_COEFF" : 0.05, //How rapidly velocity decays from the air resistance
        "PLATFORM_STANDARD_FRICTION" : 0.91, //What our normal friction is
        "TERRAIN_STANDARD_FRICTION" : 0.91, //What our normal terrain friction is
        
        //Other behaviour
        "PLAYER_CAN_ACCELERATE_IN_AIR" : true //Will be used by our animation engine
};
var USE_PHYSIJS_FOR_PLAYER = false;


//SuperMega Namespace
window.SuperMega = window.SuperMega || {};


//Name spaced constants:
SuperMega.CollisionTypes = {
    NOTHING: 0,
    BALL: 1,
    PLAYER: 2,
    TREE: 4,
    BODY: 8,	//Means a dead body
    GROUND: 16
};
SuperMega.CollisionMasks = {
    BALL:   SuperMega.CollisionTypes.PLAYER |
    		SuperMega.CollisionTypes.TREE |
    		SuperMega.CollisionTypes.GROUND,

    PLAYER: SuperMega.CollisionTypes.BALL |
    		SuperMega.CollisionTypes.BODY |
    		SuperMega.CollisionTypes.TREE |
    		SuperMega.CollisionTypes.GROUND,

    TREE:   SuperMega.CollisionTypes.BALL |
    		SuperMega.CollisionTypes.PLAYER, //Cannot walk into trees

    BODY:   SuperMega.CollisionTypes.PLAYER |
    		SuperMega.CollisionTypes.GROUND,

    GROUND: SuperMega.CollisionTypes.BALL |
    		SuperMega.CollisionTypes.BODY |
    		SuperMega.CollisionTypes.PLAYER //Allowing ground to collide with player
};


//Our default colours in 0xHEX
SuperMega.DEFAULT_COLOURS = {
    "trap" : 0x2222FF,
    "platform" : 0xF762A8,
    "powerup" : 0xFFF022,
    "switcher" : 0x444444, //Called "switcher" because "switch" is already a js keyword
    "magic_switcher" : 0xDDDDDD,
    "the_end" : 0x8316FF,
    "nom" : 0x33EEFF,
};

//Our presets:
SuperMega.OBJECT_PRESETS = {
    "ice_platform" : {
        "color": 0xAAEEFF,
        "transparent": true,
        "opacity": 0.6,
        "friction": 0.14, //v low friction
        "restitution": 0.4 //low restitution
    },
    "ground_terrain" : {
        "color": 0x557733,
        "transparent": false,
        "opacity": 1,
        "liquid": false,
        "multiplier": 0.25,
        "subtractor": 6,
    },
    "hills_terrain" : {
        "color": 0x557733,
        "transparent": false,
        "opacity": 1,
        "liquid": false,
        "multiplier": 0.75,
        "subtractor": 35,
    },
    "water_terrain" : {
        "color": 0x4D708A,
        "ambient": 0xAFCADE,
        "specular": 0xf5f5f5,
        "transparent": true,
        "opacity": 0.5,
        "liquid": true,
        "multiplier": 0.1,
        "subtractor": 4,
    },
    "moving_platform" : {
    	"color" : 0xAA8833
    }
};


//Collisions:
//Constants:
// Bitwise flags for elements that can collide (for ammo.js / bullet)
SuperMega.CollisionTypes = {
    NOTHING: 0,
    BALL: 1,
    PLAYER: 2,
    TREE: 4,
    BODY: 8,    //Means a dead body
    GROUND: 16,
    PLATFORM: 32,
};

// Collision masks for ammo.js / bullet
// Masks must reference each other to be effective
// e.g. ball -> player ; player -> ball
// http://www.bulletphysics.org/mediawiki-1.5.8/index.php?title=Collision_Filtering
SuperMega.CollisionMasks = {
    BALL:   SuperMega.CollisionTypes.PLAYER |
            SuperMega.CollisionTypes.TREE |
            SuperMega.CollisionTypes.GROUND |
            SuperMega.CollisionTypes.PLATFORM,

    PLAYER: SuperMega.CollisionTypes.BALL |
            SuperMega.CollisionTypes.BODY |
            SuperMega.CollisionTypes.TREE |
            SuperMega.CollisionTypes.GROUND |
            SuperMega.CollisionTypes.PLATFORM,

    TREE:   SuperMega.CollisionTypes.BALL |
            SuperMega.CollisionTypes.PLAYER, //Cannot walk into trees

    BODY:   SuperMega.CollisionTypes.PLAYER |
            SuperMega.CollisionTypes.GROUND |
            SuperMega.CollisionTypes.PLATFORM,

    GROUND: SuperMega.CollisionTypes.BALL |
            SuperMega.CollisionTypes.BODY |
            SuperMega.CollisionTypes.PLAYER //Allowing ground to collide with player
};


//--- Stand alone functions ---
SuperMega.resolve_3d_entity = function(entity, x_or_vector, y, z, order){
    /**
     * Turns the supplied arguments into a THREE.Vector3 object.
     * 
     * 
     * @memberOf: SuperMega
     * 
     * Acceptable inputs:
     * 
     *  @param entity: <str> "vector" or "euler"
     *  @param x_or_vector: <THREE.Vector3>
     *  @param x_or_vector: Array(<float>,<float>,<float>)
     *  @params x_or_vector: <float>
     *      y: <float>
     *      z: <float>
     *  
     *  
     *  @return: <THREE.Vector3>
     *  
     */
    
    //Resolve the entity
    entity = entity || "vector";
    
    if(x_or_vector === null || typeof x_or_vector == "undefined"){ //Don't bother doing any calculations
        return null;
    }
    
    console.log("Given "+(typeof x_or_vector));
    console.log(x_or_vector);
    
    var x_amt = 0;
    var y_amt = 0;
    var z_amt = 0;
    var amount = 0;
    order = order || "XYZ";
    if(typeof x_or_vector.clone !== "undefined"){ //Has been given a vector to define rotation
        x_amt = x_or_vector.x;
        y_amt = x_or_vector.y;
        z_amt = x_or_vector.z;
        order = x_or_vector.order || order;
    }else if(typeof x_or_vector.push !== "undefined"){ //Has been given an array to define rotation
        x_amt = x_or_vector[0] || 0;
        y_amt = x_or_vector[1] || 0;
        z_amt = x_or_vector[2] || 0;
        order = x_or_vector[3] || order;
    }else if(x_or_vector == "random" || x_or_vector == "Random" || typeof x_or_vector=="undefined"){ //Means randomise me!!
        amount = y || 0.2*Math.PI;
        x_amt = (Math.random()-0.5) * amount; //Tilt 
        y_amt = (Math.random()-0.5) * amount;
        z_amt = (Math.random()-0.5) * amount;
    }else{
        x_amt = x_or_vector || 0;
        y_amt = y || 0;
        z_amt = z || 0;
    }
    //D("Resolved "+entity+": "+x_amt+","+y_amt+","+z_amt+" ("+order+")");
    
    if(entity=="euler"){ //Return a euler
        return new THREE.Euler(x_amt, y_amt, z_amt, order);
    } else { //Return a Vector3 by default
        return new THREE.Vector3(x_amt, y_amt, z_amt);
    }
}
SuperMega.resolve_vector = function(x_or_vector, y, z){
    return SuperMega.resolve_3d_entity("vector", x_or_vector, y, z);
}
SuperMega.resolve_euler = function(x_or_vector, y, z){
    return SuperMega.resolve_3d_entity("euler", x_or_vector, y, z);
}



/**
 * Screen: What we actually show on the screen
 * 
 * Contains the level, HUD notifications, overlays etc
 * 
 */
SuperMega.Screen = function(){
    
    //If level, add it
    this.play_window = $();
    
    //Identify our overlays 
    this.overlays = { //Contains our various overlay screens
        "skyUnderlay" : $('#pagewrapper'),
        "deadScreen" : $('#respawn')
    };
    
    //Indentify our head-up-displays (huds)
    this.hud = {
        "currentBallCount" : $('#hud-ammo .current'),
        "maxBallCount" : $('#hud-ammo .max'),
        "nomCount" : $('#hud-noms .current'),
        "notificationHud" : $('#hud-notifications ul')
    };

};
SuperMega.Screen.prototype = Object.assign( {}, {
    constructor: SuperMega.Screen
});



SuperMega.Camera = function(play_window){
    /**
     * Creates a camera with the correct presets for the game
     * Inherits <THREE.PerspectiveCamera>
     * 
     * @keyword play_window: The HTML element containing the game element. Defaults to window
     */
    play_window = play_window || window;

    
    //Settings:
    var screen_WIDTH = window.innerWidth;
    var screen_HEIGHT = window.innerHeight;
    var camera_NEAR = 1;
    var camera_FAR = 2000;
    var cameraOffset = new THREE.Vector3(0,0,4);
    var chase_angle = 0; //What direction the camera is shooting at
    var chase_scale = 5.5; //How Zoomed in the player is
    
    //Super to create camera:
    THREE.PerspectiveCamera.call(this, 45, screen_WIDTH / screen_HEIGHT, camera_NEAR, camera_FAR);
    var camera = this; //we can now call it a camera!
    
    // I'm being "that guy" and changing the world orientation such that
    // X,Y are the top-down coordinates, and Z is the height off the ground
    // Sorry in advance.
    camera.up.y = 0;
    camera.up.z = 1;
};
SuperMega.Camera.prototype = Object.assign( Object.create(Physijs.Scene.prototype), {
    constructor: SuperMega.Camera,
    _local_player: null, //Where we store our local player
    LOOK_AT_RELATIVE: new THREE.Vector3(0,0,3), //Where the camera is pointing relative to what it is rigged to
    chaseCamEnabled: false  //Whether the camera is chasing the player (??)
});
SuperMega.Camera.prototype.resize = function(play_window){
    /**
     * Handles resizing of the screen
     * 
     * @keyword play_window: The HTML element containing the game element. Defaults to window
     */
    play_window = play_window || window;
    var screen_WIDTH = play_window.innerWidth;
    var screen_HEIGHT = play_window.innerHeight;
    this.aspect = screen_WIDTH / screen_HEIGHT;
    this.updateProjectionMatrix();
};
SuperMega.Camera.prototype.rig_to_player = function(player){
    /**
     * Rigs the camera to the specified player.
     * 
     *  @param player: <SuperMega.Player> The Local player
     */
    var camera = this; //Alias, makes it quicker to port code
    if(camera._local_player){
        camera.unrig(); //Removes it from the existing player
    }
    
    // Rig the camera to the player, so that the camera always moves relative to the player
    player.add_camera(camera);
    
    // Point the camera at the player
    // FIXME: Change this to point where the player is looking instead of at the player directly
    camera.lookAt(player.position);
    
    // Determine the initial rotational offset based on radius, angle and scale
    var cameraOffset = new THREE.Vector3(0,0,0);
    var radius = Math.sqrt((3 * camera.chase_scale) * (3 * camera.chase_scale) + (1 * camera.chase_scale) * (1 * camera.chase_scale));
    var normalizedCameraPos = camera.position.clone().sub(cameraOffset).normalize().multiplyScalar(radius);
    var chaseAngle = Math.asin((normalizedCameraPos.z) / radius);
    camera.chase_angle = chaseAngle; //Store obj wide
    camera.chaseCamEnabled = true;
};
SuperMega.Camera.prototype.unrig = function(){
    /**
     * Removes the camera from the local player it is currently
     * rigged to
     */
    var camera = this;
    var player = camera._local_player;
    player.remove_camera(camera);
    camera.chaseCamEnabled = false;
};


/**
 * Level: A wrapper around scene to hold our global scene objects in
 * 
 * Level.scene:  Our scene
 * Level.scene:  Our clock
 * 
 */
SuperMega.Level = function( scene, level_number, options){
    /** Level Constructor
     * 
     * This creates the arena capable of holding a level. The *contents* of the
     * level are not built until you call level.build()
     * 
     * You should only put stuff here that is not going to change from level
     * to level.
     * 
     * @param scene: The Physijs scene we are using
     * @keyword level_number: Will load the specified level number into the scene
     * @keyword options: {} properties of the level (e.g. world width etc)
     */
    var self=this; //In case I slip into python mode!
    
    //Resolve inputs:
    this.world_width = options.world_width || 64;
    this.world_depth = options.world_depth || 64;
    this.socket = this.socket || null;
    
    //Resolve scene
    scene = scene || null;
    if(scene === null){ //Create new scene
        scene = new Physijs.Scene({ fixedTimeStep: 1 / 60 }); //60 fps is sufficient!
    }
    scene.loaded = false;
    this.scene = scene;
    
    //Default to no fog:
    this.scene.fog = new THREE.Fog( 0xFFFFFF, 1000, 2000);
    
    //Generate background:
    this.create_background(options.background || {});
    
    //Let there be light:- This will need to be moved if we want to change lighting between levels
    this.build_lighting(options.day_night || false);
   
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
    switchers:[], //Easy way of tracking the switchers
    terrain_and_collidables: [],  //Automated bin of both the collidables and the terrain, saves recalculating the list each animate loop
    named_objects: {}, //Convenient way of collecting anything carrying a name for later reference to (e.g. in the case of switches)
    //The dict items
    lighting: {}, //The lights
    players: {}, //Players in the scene
    balls : {},
    level_data : {}, //A copy of what's in the level
    
    //Single properties
    player: null, //The local player object
    nickname: "SuperMega", //The default player's name
    ball_counter: 0,  //The number of balls in the scene
    background_scene: null, //The background
    complete: false, //Whether the level has been completed or not
    loaded: false	//Whether the level is loaded or not
    
    
}); //JS inheritance hack part 2
SuperMega.Level.prototype.create_background = function(options){
    /**
     * Create Background
     * Creates a scene background, which can be an image or colour
     * 
     * Populates this.background_scene
     * 
     * @param options: { //Allowable options
     *     color: <THREE.Color>, //The colour of the background
     *     image: <url>, //The image to render onto the background
     * } 
     */
    //Process inputs
    options = options || {};
    options.image = options.image || null;
    //Colour may legitimately be black! (0)
    if(typeof options.colour == "undefined" && typeof options.color == "undefined"){
        options.colour = "sky"; //Default to sky blue
    }else{
        options.colour = options.colour || options.color;
    }
    
    
    //Parse options
    var texture = null;
    var bg_material = null;
    if(options.image){  //An image is required
        texture = THREE.ImageUtils.loadTexture( options.image );
        bg_material = new THREE.MeshBasicMaterial({
            map: texture,
            color: options.colour
        });
    } else { //Just do a colour
        if(options.colour=="sky"){
            //Create a background texture (skyblue gradient):
            var size = 512;
            // create canvas
            var canvas = document.createElement( 'canvas' );
            canvas.width = size;
            canvas.height = size;
            // get context
            var context = canvas.getContext( '2d' );
            // draw gradient
            context.rect( 0, 0, size, size );
            var gradient = context.createLinearGradient( 0, 0, 0, size );
            gradient.addColorStop(0, '#87CEEB'); // light blue 
            gradient.addColorStop(1, '#EDF9FE'); // Almost white
            context.fillStyle = gradient;
            context.fill();
            // material texture
            var texture = new THREE.Texture( canvas );
            texture.needsUpdate = true; // important!
        } else {
            var texture = null;
        }
        bg_material = new THREE.MeshBasicMaterial({
            color: options.colour,
            map: texture
        });
    }
    
    //Create the mesh
    var background_mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2, 0),
        bg_material
    );
    background_mesh.material.depthTest = false;
    background_mesh.material.depthWrite = false;
    
    
    // Create your background scene
    this.background_scene = new THREE.Scene();
    this.background_camera = new THREE.Camera();
    this.background_scene.add(this.background_camera);
    this.background_scene.add(background_mesh);
    
};
//Now we override add() to allow us to add it to a category for easy tracking:
SuperMega.Level.prototype._scene_action = function(action, obj, category_name, index_name){
        /**
         * SuperMega.Scene._scene_action: adds or removes the specified item
         * 
         * @name _scene_action
         * @function _scene_action
         * 
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
                    if(!obj){
                        obj = tracker[index_name];
                    };
                } else {
                    console.log("WARNING: Level."+action+"(obj,"+category_name+",index_name) has not been given a valid object or index_name. Ignoring.");
                    D(obj);
                    return false;
                }
                if (obj_index > -1) {
                    try{
                        D("Removing: "+obj.uuid); //some objects don't have such id 
                    }catch(err){
                    }
                    tracker.splice(obj_index, 1); //Remove the item
                }
            }
            if(action=="add"){
                if(!obj){
                    console.log("WARNING: Level."+action+"(obj,"+category_name+") has not been given a valid object to add. Ignoring.");
                    return false;
                }
                tracker.push(obj); //Add the object to our tracking vars
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
                    obj = tracker[index_name];
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
        
        if(category_name=="collidables" || category_name=="debris"){
            this.recompile_obstacles();
        }
        
        //And add to / remove from the scene:
        if(obj){
            if(action=="add"){
                this.scene.add(obj);
            }else if(action=="remove"){
                D(obj);
                D("Cat:"+category_name+" Index:"+index_name);
                this.scene.remove(obj);
            }
            //And add to /remove from the named_objects global var:
            if(obj.name){ //Only applies to objects with names:
                if(action=="add"){
                    this.named_objects[obj.name] = obj;
                } else if(action=="remove"){
                    delete this.named_objects[obj.name];
                }
            }
        }
};
SuperMega.Level.prototype.add = function(obj,category_name,index_name){
        /**
         * SuperMega.Scene.add: adds the specified item to the scene
         * @param action: The scene function to perform with the obj as an argument (e.g. add(obj))
         * @param obj: The THREE.js or Physijs object to ADD
         * @keyword category_name: The category this object belongs to e.g. "liquid_terrain"
         * @keyword index_name: For trackers based on dicts e.g. "lighting" 
         */
        return this._scene_action("add",obj,category_name,index_name);
};
SuperMega.Level.prototype.remove = function(obj,category_name,index_name){
        /**
         * SuperMega.Scene.remove: removes the specified item to the scene
         * @param action: The scene function to perform with the obj as an argument (e.g. remove(obj))
         * @param obj: The THREE.js or Physijs object to ADD
         * @keyword category_name: The category this object belongs to e.g. "liquid_terrain"
         * @keyword index_name: For trackers based on dicts e.g. "lighting" 
         */
        return this._scene_action("remove",obj,category_name,index_name);
};
SuperMega.Level.prototype.build_lighting = function(day_night){
    /**
     * Creates the lighting for the level
     * 
     * @param day_night: <Boolean> Whether day_night cycles or not
     */
    //Resolve inputs:
    if(typeof day_night == "undefined"){
        day_night = false; //default to no cycling
        this.day_night = day_night; //Store as object var so we can animate lighting rotation
    }
    
    
    //Background general ambient light
    ambient = new THREE.AmbientLight( 0x909090, 0.6 );
    this.add(ambient,"lighting","ambient");
    
    //Main directional sunlight
    light = new THREE.DirectionalLight( 0xffe0bb, 0.6 );
    light2 = new THREE.DirectionalLight( 0xffe0bb, 0.6 );
    light.castShadow = true;
    light2.castShadow = false;
    
    // Update the shadow cameras
    light.shadow.camera.near = -256;
    light.shadow.camera.far = 256;
    light.shadow.camera.left = -128;
    light.shadow.camera.right = 128;
    light.shadow.camera.top = 128;
    light.shadow.camera.bottom = -128;
    // Other shadow settings:
    light.shadow.bias = .0001;  // 0.0001
    light.shadow.mapSize.width = 512; //Fixed constants
    light.shadow.mapSize.height = 512;
    
    //Attach lights to lighting rig:
    lightRig = new THREE.Object3D();
    lightRig.boundRadius = 10;
    lightRig.add(light);
    lightRig.add(light2);
    
    //Start at noon if lights not rotating
    if(!this.day_night){
        lightRig.rotation.y = 0-DEG90; //90deg
    }
    
    // Offset the lights in the rig
    light.position.set( 10, 0, 0 );
    light2.position.set(0, 0, 10 );
    lightRig.rotation.x = 0.6807; // Emulate middle of northern hemisphere ~39deg N latitude
    
    // Add the lights to the scene
    this.add( lightRig, "lighting", "rig" );
    
    //Add the moon (if required)
    if(this.day_night){
        this.add_moon();
    }
}
SuperMega.Level.prototype.add_moon = function(){
    /**
     * Adds a moon to the scene. Should only be used if day_night cycling is operational
     * Moon light to make the "night time" not totally unplayable
     * Stays active during the day too, so essentialyl 3 lights are active 
     * during they day cycle
     */
    moon = new THREE.DirectionalLight( 0x999999, 0.2 );
    
    //Configure shadows
    moon.castShadow = true;
    moon.shadow.camera.near = -256;
    moon.shadow.camera.far = 256;
    moon.shadow.camera.left = -128;
    moon.shadow.camera.right = 128;
    moon.shadow.camera.top = 128;
    moon.shadow.camera.bottom = -128;
    
    // Set the moon overhead position
    moon.position.set(0, 0, 10 );
    moon.lookAt(0, 0, 0);
    
    this.add( moon, "lighting", "moon" );
}
SuperMega.Level.prototype.recompile_obstacles = function(){
    /**
     * Simply compounds collidables and terrain into same array:
     */
    //Recalculate our combined collidables:
    this.terrain_and_collidables = $.merge($.merge([], this.terrain), this.collidables);
    return this.terrain_and_collidables;
};
SuperMega.Level.prototype.init_switchers = function(){
    /**
     * Turns on vulnerable switchers to ensure they respond to ball strikes
     */
    //Recalculate our combined collidables:
    var self = this;
    $.each(self.switchers, function(index,switcher){
        if(switcher.ops.affected_by_balls){ //Restricted only to switches which are ball sensitive
            switcher.on_collision(self, "ball_strike"); //Dirty way of passing in the level object down to the switcher!
        }
    });
};
SuperMega.Level.prototype.get_object = function(name){
    /**
     * Fetches an object by its name from level.named_objects
     * @param name: <str> the object name you gave it e.g. "bouncing_platform_1"
     * 
     * @return: <SuperMega.Interactable> The object you asked for if it exists
     */
    return this.named_objects[name];
};
SuperMega.Level.prototype.build = function(data){
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
         *    debris: [ //Other arbitrary shit that is solid (like trees)
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
        data.trees = data.trees || [];
        data.platforms = data.platforms || [];
        data.traps = data.traps || [];
        data.powerups = data.powerups || [];
        data.noms = data.noms || [];
        data.debris = data.debris || [];
        data.switchers = data.switchers || data.switches || [];
        data.ends = data.ends || data.end || [];
        data.day_night = data.day_night || false; //Day-night cycles
        
        //Store a deepcopy:
        var self = this; //Allows us to reference this in the jQuery each loops
        this.level_data = deepclone(data);
        console.log("level_data");
        console.log(this.level_data);
        
        //Update the day_night rule with the level settings:
        this.day_night = data.day_night;
        if(this.day_night && !this.lighting["moon"]){
            this.add_moon();
        }
        
        //Build terrains
        $.each(data.terrain, function(index,options){
            self.add_terrain(options);
        });
        
        //Build platforms
        $.each(data.platforms, function(index,options){
            self.add_platform(options);
        });
        
        //Build traps
        $.each(data.traps, function(index,options){
            self.add_trap(options);
        });
        
        //Build trees
        $.each(data.trees, function(index,options){
            self.add_tree(options);
        });
        
        //Build powerups
        $.each(data.powerups, function(index,options){
            self.add_powerup(options);
        });
        
        //Build noms
        $.each(data.noms, function(index,options){
            self.add_nom(options);
        });
        
        //Build Switchers
        $.each(data.switchers, function(index,options){
            self.add_switchers(options);
        });
        
        //Build Ends
        $.each(data.ends, function(index,options){
            self.add_end(options);
        });
        
        //Load static debris items (does NOT get animated)
        $.each(data.debris, function(index,options){
            var item = SuperMega.Interactable(options);
            self.add(item, "debris");
        });
        
        
        //Apply fog to the scene:
        if(data.fog){
            if(data.fog.density){ //Use exponential fog
                this.scene.fog = new THREE.FogExp2(data.fog.color || data.fog.colour || 0xFFFFFF, data.fog.density);
            }else{ //Use flat fog
                this.scene.fog = new THREE.Fog( data.fog.color || data.fog.colour || 0xFFFFFF, data.fog.near || 1000, data.fog.far || 2000);
            }
            if(this.background_scene){ //Apply the fog to the BG too
                this.background_scene.fog = this.scene.fog;
            }
        }
        
        //Apply any background colours:
        if(data.background){
            self.create_background(data.background);
        }
       
        //Recompile:
        this.recompile_obstacles();
        this.init_switchers();
        
        //Fix start position and rotation:
        this.start_position = data.start_position || ZERO_VECTOR3;
        this.start_orientation = data.start_orientation || ZERO_EULER;
        
        //Flag level as loaded:
        this.loaded = true;
};
SuperMega.Level.prototype.tear_down = function(){
    /*
     * Tears the level down, including all players
     * 
     * Calls scene.remove, thus freeing memory
     */
    var self = this;
    this.loaded = false;
    var object_cats = ["lighting","collidables","interactables","terrain","liquid_terrain","debris","players"];
    $.each(object_cats, function(index,object_cat){ //Iterate the categories
        var category_items = self[object_cat].slice(); //Shallow-copy array so manipulating it in the loop won't fark it
        $.each(category_items, function(obj_index,obj){ //Iterate the actual object!
            self.remove(obj, object_cat, obj_index); //Deletes it from scene
        });
    });
};
SuperMega.Level.prototype.respawn = function(){
    /*
     * Rebuilds the power ups in the level
     */
    
    //Remove existing power ups so we don't end up with duplicates:
    var self = this;
    var interactable_positions = {};
    //In JS you cannot fiddle around with the entity you're iterating over!
    //Resolve the location of each power up
    $.each(self.interactables, function(index,obj){
        if(obj instanceof SuperMega.Powerup){
            interactable_positions[index] = obj;
        }
    });
    //Remove the power up from the scene:
    $.each(interactable_positions, function(index,obj){
        self.remove(obj,"interactables",index);
    });
    
    //Build powerups
    $.each(this.level_data.powerups, function(index,options){
        self.add_powerup(options);
    });
};
SuperMega.Level.prototype.animate = function(delta){
        /**
         * Animates all contents of the level!
         * 
         * @param delta: <float> time (s) since last frame
         */
        var self = this;
        $.each(self.interactables, function(index,item){
            try{
                item.animate(delta);
            }catch(err){ //Item not animatable
                //console.log(err);
            }
        });
        $.each(self.collidables, function(index,item){
            try{
                item.animate(delta);
            }catch(err){ //Can't animate it
                //console.log(err);
            }
        });
};
SuperMega.Level.prototype.add_ball = function(position, force, restitution, playerId, color, ballId) {
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
                0.8, // high friction
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
            ball.applyCentralImpulse(force);
        } );

        // Assign ownership and ID
        ball.sourcePlayerId = playerId;
        ball.ballId = ballId;

        // Assign physics collision type and masks, so it collides only with specific things
        ball._physijs.collision_type = SuperMega.CollisionTypes.BALL;
        ball._physijs.collision_masks = SuperMega.CollisionMasks.BALL;

        // Put the ball in the world
        var ball_id = 'p'+playerId+'b'+ballId;
        ball.supermega_ball_id = ball_id; //Let the ball know who it is!
        this.add( ball, "balls", ball_id);

        // Update matrices
        ball.updateMatrixWorld();
        ball.updateMatrix();

};
SuperMega.Level.prototype.delete_ball_by_id = function(playerId, ballId){
        /**
         * Removes the specified ball from the scene (doesn't require a valid player object!)
         * @param playerId: <int> The player's id
         * @param ballId: <int> The ball's id
         */
        // Assemble the unique ball id key
        var key = 'p'+playerId+'b'+ballId;

        // Check if the ball exists and remove it if it exists
        if (this.balls[key] !== null) {
            this.remove(this.balls[key], "balls", key); //Syntax is (obj, category, key)
        }
};
SuperMega.Level.prototype.ball_watcher = function(socket, player){
        /**
         * Watches all the balls in a scene, removes ones which have fallen off
         * 
         * @param socket: <WebSocket> Which transmits player events
         * @keyword player: <SuperMega.Player> The player to operate on (if omitted will use local player)
         */
    
    var player = player || this.player; //Default to local player
    var socket = socket || this.socket; //Comms socket
    
    // Check each ball
    var level = this;
    for(var i in level.balls) {
        
        var ball_obj = level.balls[i];
            // If the ball belongs to the current player and has moved 50 units below origin - PURGE IT!
            if (ball_obj.sourcePlayerId == player.player_id &&
                ball_obj.position.z < -50) {
                this.unfire_ball(socket, ball_obj, player);
            }
        }
};
SuperMega.Level.prototype.unfire_ball = function(socket, ball, player){
    /**
     * Removes a ball from the game
     * 
     * @param socket: <WebSocket> Used to transmit notices to player
     * @param ball: <Object> The ball we wish to bin
     */
    var player = player || this.player; //Default to local player
    var socket = socket || this.socket; //Comms socket
    
    // Notify other players the ball has been recycled
    if(socket){
        socket.emit('unfire', {
            playerId: player.player_id,
            ballId: ball.ballId
        });
    } else {
        D("No socket to communicate Level.unfire_ball!");
    }
    

    // Remove the ball from the world
    //deleteBallById(balls[i].sourcePlayerId, balls[i].ballId);
    var source_player_id = ball.sourcePlayerId;
    var ball_id = ball.ballId;
    this.delete_ball_by_id(ball.sourcePlayerId, ball.ballId); //Actually removes it from the scene
    D("Ball #"+ball_id+" from player #"+source_player_id+" has been removed!");

    // Give the player back their ball and update their HUD
    var player_obj = this.players[source_player_id];
    //D(player_obj);
    player.currentBallCount--; 
    player.hud.currentBallCount.text(player.maxBallCount - player.currentBallCount);
};
SuperMega.Level.prototype.get_terrain_z = function(x, y, liquids){
        /**
         * Returns the terrain z position at x,y
         * 
         *  @param x: <float> x-coordinate
         *  @param y: <float> y-coordinate
         *  @param liquids: <Bool> Whether to include liquids or not (default False)
         *  
         *  @return z: <float> or <null> If the Z position is viable (i.e. not water)
         */
        liquids = liquids || false;
        var terrain_objs = this.terrain; //Assume solid terrain only
        if(liquids){ //Add in our liquid terrain
            terrain_objs = $.merge(this.terrain,this.liquid_terrain);
        }
        
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
        var collisions = r.intersectObjects(terrain_objs, true);
        if(collisions.length === 0){ //Bail if there is no collision
            return null;
        }
        return collisions[0].point.z; //Return the topmost terrain layer z
};
SuperMega.Level.prototype.random_terrain_position = function(){
        /**
         * Returns a random position in the world which is guaranteed to be sitting on the topmost terrain
         *
         * @return: <THREE.Vector3> The position
         */
        var x = (Math.random() * this.world_width*2) - (this.world_width / 1);
        var y = (Math.random() * this.world_depth*2) - (this.world_depth / 1);
        var z = this.get_terrain_z(x,y,false);
        return new THREE.Vector3(x,y,z);
};
SuperMega.Level.prototype.add_tree = function(options){
    /**
     * Adds a tree to the level
     * 
     * @param options: {
     *     position: <THREE.Vector3> The position of the tree
     *     rotation: <THREE.Euler> The orientation of the tree (ZAxis is the only one you want to rotate on!)
     * }
     * @return: <SuperMega.Interactable> The Tree!
     */
        
        var x = options.position.x;
        var y = options.position.y;
        var z = options.position.z;
        var rotation = options.rotation;
        
        var created_objects = []; 
        // 3rd dimension to drop the tree
        var zPos = null;
        
        // If no Z was given, z-lock the position to the terrain
        if (z === null) {
            // Find the top-most intersection with any terrain layer for the given 2d coords
            zPos = this.get_terrain_z(x, y);
            if(zPos === null){
                console.log("SuperMega.Level.add_tree(): No suitable terrain at x="+x.toFixed(2)+", y="+y.toFixed(2));
                return null;
            }
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
        var rnd_rotation_z = rotation !== null ? rotation : Math.random() * Math.PI;
    
        // Create Container and hit box geometries
        var treeContainerGeo = new THREE.CubeGeometry(1.25, 1.25, 0.25, 1, 1, 1),
            treeBoxGeo = new THREE.CubeGeometry(0.742, 0.742, 5, 1, 1, 1),
            treeLeafBoxGeo = new THREE.CubeGeometry(1.38 * 2, 1.64 * 2, 2, 1, 1, 1),
    
            // Invisible hit box material
            treeBoxMat = Physijs.createMaterial(
                new THREE.MeshPhongMaterial( {
                    color: 0x996633,
                    transparent: true,
                    opacity: 0
                }),
                0.95, // high friction
                0.4 // low restitution
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
            treeBox._physijs.collision_type = SuperMega.CollisionTypes.TREE;
            treeBox._physijs.collision_masks = SuperMega.CollisionMasks.TREE;
            treeLeafBox._physijs.collision_type = SuperMega.CollisionTypes.TREE;
            treeLeafBox._physijs.collision_masks = SuperMega.CollisionMasks.TREE;
    
            // Apply the given location to the tree container
            treeContainer.position.set(x, y, zPos);
    
            // Add the child meshes to the container
            treeContainer.add(treeBox);
            treeContainer.add(treeLeafBox);
            treeContainer.add(tree);
    
            // Apply the rotation
            if(rotation){
                treeContainer.rotation.z = rotation.z;
            }else{
                treeContainer.rotation.z = rnd_rotation_z;
            }
    
            // Init hit box rotations to model
            treeBox.rotation.y = 0.104719755;
            treeLeafBox.rotation.z = -0.296705973;
    
            // Init hit box positions to model
            treeBox.position.add(new THREE.Vector3(0.25631, 0.16644, 5.49535 / 2 ));
            treeLeafBox.position.add(new THREE.Vector3(-0.16796, -0.05714, 4.59859));
    
            // Add the complete tree to the scene
            this.collidables.push(treeBox); //We have to add the tree collision boxes separately to the container
            this.collidables.push(treeLeafBox); //If you don't like this, then make it a new class
            this.scene.add(treeContainer, "debris"); //We don't want the object container to be collidable
};
SuperMega.Level.prototype.add_platform = function(options){
        /**
         * Creates a platform, which can be moving
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
        D("Making platform");
        options.level = self;
        var platform = new SuperMega.Platform(options); //It's rather easy when you've got a class!!
        D(platform);
        this.add(platform, "collidables");
};
SuperMega.Level.prototype.add_trap = function(options){
        /**
         * Creates a trap, which can be moving
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
        options.level = self;
        var trap_platform = new SuperMega.Trap(options); //It's rather easy when you've got a class!!
        this.add(trap_platform, "collidables");
};
SuperMega.Level.prototype.add_powerup = function(options){
        /**
         * Creates a power_up, which can be moving
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
        options.level = self;
        var pow_up = new SuperMega.Powerup(options); //It's rather easy when you've got a class!!
        this.add(pow_up, "interactables");
};
SuperMega.Level.prototype.add_nom = function(options){
        /**
         * Creates a power_up, which can be moving
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
        options.level = self;
        var nom = new SuperMega.Nom(options); //It's rather easy when you've got a class!!
        this.add(nom, "interactables");
};
SuperMega.Level.prototype.add_switchers = function(options){
    /**
     * Creates a switch (which itself can move!!)
     * Options dict:
     * 
     *         position: <[x,y,z]> or <THREE.Vector3>
     *         initialy_on: <boolean> false (whether this switch is "on" to start with)
     *         target: <SuperMega.Interactable> If this acts upon just one Interactable, you can input it here
     *         targets: [] List of interactables the switch acts on (the targets)
     *         regenerates: <boolean> Whether this regenerates or not
     *         toggle_on: {} The properties set for ALL targets when switch turned on
     *         toggle_off: {} The properties set for ALL targets when switch turned off
     *         target_specific_toggle_on: {} The properties of the targets that get changed when switch is activated (value represent the states of those properties)
     *                     e.g. {
     *                          "bobbing_platform_1" : {"translation":"reciprocating",} //Would alter the platform's motion to a reciprocating motion
     *                     }
     *         target_specific_toggle_off: {} The properties of the targets that get changed when switch is deactivated
     *         affected_by_balls: <boolean> whether the switch can be adjusted by a ball (default true), 
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
    options.level = self;
    var switcher = new SuperMega.Switcher(options);
    this.add(switcher, "interactables");
    this.switchers.push(switcher); //Keep easy track of this
};
SuperMega.Level.prototype.add_end = function(options){
        /**
         * Creates a power_up, which can be moving
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
        options.level = self;
        var the_end = new SuperMega.TheEnd(options); //It's rather easy when you've got a class!!
        this.add(the_end, "interactables");
        this.the_ends.push(the_end); //Allows our Noms to update the ends when they are collected
};
SuperMega.Level.prototype.add_terrain = function(options){
        /**
         * Creates a plane to act as terrain
         * 
         * @param height_data: [] Array of height data
         * @param material: <PhysiJS.Material> What this plane is made out of
         * @param width: <float> how wide this should be
         * @param depth: <float> how deep this should be
         * @param width_vertices: <int> the number of vertices to fit into the width
         * @param depth_vertices: <int> the numbewr of vertices to fit into the depth
         * @param multiplier: <float> how undulating the hills should be (0 to 1)
         * @param subtractor: <float> how far to vertically offset the plane
         * @param liquid: <str> Whether this is a liquid terrain or not [default = false]
         * @param colour: <str> The colour to make the terrain
         * @param preset: <str> Which preset to use (will override multiple other settings)
         * 
         * @adds: The plane mesh to the level
         * 
         * @return: <Plane Mesh> The terrain
         */
        //Handle presets
        if(options.preset !== null){
            //Means replace our objects with the present values
            var preset = SuperMega.OBJECT_PRESETS[options.preset] || null;
            if(preset){ //Update our options with values from the preset --- Should we do it the other way round??
                options = $.extend(options, preset);
            }else{
                console.log("WARNING: Preset '"+options.preset+"' is not a known valid preset name!");
            }
        }
        
        //Deal with the slight name variances between the node.js server and this function
        var data = options.height_data || false; //This is mandatory!
        if(!data){ //Generate some random heightmatrix data
            var data = []; //Empty array
            noise.seed(Math.random());
            for (var y = 0; y<=options.depth_vertices; y++) { //Y decreases FFS
                for (var x = 0; x <= options.width_vertices; x++) {
                    var z_value = noise.simplex2(x+1 / 100, y+1 / 100); //Generates value in range -1 to 1
                    data.push(z_value); //Simply add it on!
                }
            }
            D(data);
        }
        if(!data){
            console.log("ERROR: SuperMega.Level.add_terrain - you must supply an array of vertex heights in order to generate a terrain!!");
            return false;
        }
        
        options.width = options.width || options.worldWidth || this.world_width;
        options.depth = options.depth || options.worldDepth || this.world_depth;
        options.width_vertices = options.width_vertices || Math.round(options.width*0.25); //Defaults to a quarter of world width
        options.depth_vertices = options.depth_vertices || Math.round(options.depth*0.25); //Defaults to a quarter world depth
        options.multiplier = options.multiplier || 0.25; //Defaults to gently undulating green ground
        options.subtractor = options.subtractor || 6; //Defaults to rather central average height (just like ground)
        options.liquid = options.liquid || false; //Normally not a liquid
        //console.log("Imported options");
        //console.log(options);
        
        //Handle material
        if(!options.material || typeof options.material == "undefined"){
            if(!options.liquid){ //Is NOT a liquid - Create something which looks like grassy ground
                options.material = Physijs.createMaterial(
                    new THREE.MeshLambertMaterial( { 
                            color: options.colour || options.color || 0x557733,
                            shading: THREE.FlatShading
                        }),
                    phys.TERRAIN_STANDARD_FRICTION, // high friction
                    0.4 // low restitution
                );
            } else { //Is a liquid - Create something which looks like water (and has no PhysiJS power)
                options.material = new THREE.MeshPhongMaterial({
                    color: options.colour || options.color || 0x4D708A,
                    ambient: options.ambient || 0xAFCADE,
                    specular: options.specular || 0xf5f5f5,
                    shininess: 100,
                    transparent: true,
                    opacity: options.opacity || 0.5,
                    shading: THREE.FlatShading
                });
            }
        }
        
        //Generate plane:
        var floatData = new Float32Array(data.length);
        for (var i = 0; i < data.length; i++) {
            floatData[i] = data[i];
        }

        // Provision a new three-dimensional plane with the given number of vertices
        var terrainGeometry = new THREE.Plane3RandGeometry(options.width, options.depth, options.width_vertices-1, options.depth_vertices-1); //Seems to swap worldwidth for vertices??

        // Apply the height map data, multiplier and subtractor to the plane vertices
        var l = terrainGeometry.vertices.length;
        for ( i = 0, l = terrainGeometry.vertices.length; i < l; i ++ ) {
            terrainGeometry.vertices[ i ].z = floatData[ i ] * options.multiplier - options.subtractor;
        }

        // Update normals and centroids because we hacked the plane geometry
        terrainGeometry.computeFaceNormals();
        terrainGeometry.computeVertexNormals();
        terrainGeometry.computeCentroids();

        // Create the terrain physics mesh - heightfield because it's a perfect fit
        var t = new Physijs.HeightfieldMesh(terrainGeometry, options.material, 0, options.width_vertices-1, options.depth_vertices-1);

        // Terrain Behaviour
        if(!options.liquid){
            //Shadows
            t.castShadow = true;
            t.receiveShadow = true;
        } else { //Water doesn't cast a shadow
            t.castShadow = false;
            t.receiveShadow = true;
        }

        // Assign physics collision masks and type so it only causes collisions with specific things
        t._physijs.collision_type = SuperMega.CollisionTypes.GROUND;
        t._physijs.collision_masks = SuperMega.CollisionMasks.GROUND;
        
        
        //Add to level:
        if(!options.liquid){
            this.add(t,"terrain");
        } else {
            this.add(t,"liquid_terrain");
        }
        
        //Debug terrain:
        D(t);
        
        // Return the terrain mesh
        return t;
        
};
SuperMega.Level.prototype.completed = function(player, end_obj){
    /**
     * Completes the level!
     * 
     * @param player: <SuperMega.Player> The player completing the level (will take local player as default)
     * @param end_obj: <SuperMega.TheEnd> The end object that was hit
     */
    
    //Do a little animation to spin the world around:
    var self = this;
    var object_cats = ["collidables","interactables","terrain","liquid_terrain","debris"];
    $.each(object_cats, function(index,object_cat){ //Iterate the categories
        var category_items = self[object_cat].slice(); //Shallow-copy array so manipulating it in the loop won't fark it
        $.each(category_items, function(obj_index,obj){ //Iterate the actual object!
            try{
                if(end_obj){
                    if(end_obj._physijs.id == obj._physijs.id){ //Means we're hitting this end!
                        return; //Skip removing this end!
                    }
                }
            }catch(err){ //Occurs when a .id doesn't exist on the object
                //pass
            }
            self.remove(obj, object_cat); //Deletes it from scene
        });
    });
    
    // Flag as complete (tells the outer engine that we're done!)
    this.complete = true;
}



/**
 * Player: A supermega player, including the local player
 * Contains all the relevant movement, collision detection, scorekeeping routines etc
 * 
 * @param options: {} Various options for the player
 * @param scene: <Physijs.scene> Allows us to remove balls etc from the scene
 * @param hud: <jQuery Element> The head-up-display
 */
SuperMega.Player = function (options, level, hud){
    //Construction
    var default_mass = 0;
    if(USE_PHYSIJS_FOR_PLAYER){
        default_mass = 10;
    }
    
    
    //Resolve options:
    options = options || {};
    options.local = options.local || true; //If this is the local player or not
    options.color = options.color || options.colour || this.POWER_COLOURS[0];
    options.mass = options.mass || default_mass; //Physijs doesn't work without mass, but is jerking us around
    options.player_id = options.player_id || Math.round(Math.random()*99999); //Give random ID
    options.nickname = options.nickname || "SuperMega #"+options.player_id;
    
    
    //Create material
    var player_material = new THREE.MeshPhongMaterial({
        color: options.color,
        specular: 0x050505,
        shininess: 100
    });
    //Create geometry
    var player_geometry = new THREE.CubeGeometry( 1, 1, 2, 1, 1, 1 );
    
    //Super to create the player mesh:
    Physijs.BoxMesh.call(this, player_geometry, player_material, options.mass);
    
    //Set variable param-derived properties
    this.level = level;
    this.scene = level.scene;
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
    
    //Bin gravity
    if(USE_PHYSIJS_FOR_PLAYER){
        this.applyMeshGravity(0); //Turn off gravity so player isn't jerking around
        this._physijs.collision_flags = 2; //Bitwise to mean "kinematic" body
        this.on_collision(level, function(other_object, relative_velocity, relative_rotation, contact_normal){
            D("Collided:");
            D(other_object);
            D(relative_velocity);
            D(relative_rotation);
            D(contact_normal);
        })
    }
    
};
SuperMega.Player.prototype = Object.assign( Object.create(Physijs.BoxMesh.prototype), {
    constructor: SuperMega.Player,
    
    //Constants:
    POWER_COLOURS: [0xAA0000,0xBB8800,0xE0E000,0xEAEAEA],
    PLATFORM_GRACE: 0.15, //How close you need to be to the platform to be regarded as "standing on it"
    STEPUP_AMOUNT: 0.4, //What size of z can your character step up onto (NB your height is 2) 
    POWER_STATES: {
        "jump" : [50,55,60,65],
        "top_speed" : [phys.TOP_SPEED*1.0, phys.TOP_SPEED*1.2, phys.TOP_SPEED*1.4, phys.TOP_SPEED*1.6],
        "acceleration" : [phys.ACCELERATION_CONST*1.0, phys.ACCELERATION_CONST*1.1, phys.ACCELERATION_CONST*1.2, phys.ACCELERATION_CONST*1.3],
        "shoot" : [1,2,3,4],
        "max_gradient" : [1.0,1.3,1.6,1.9],
    },
    JUMP_BOOST_TIME: 0.20, //Time in seconds where you can depress space up to to boost jump speed
    MAX_RAY_LENGTH: 40.0, //Optimisation
    CAN_ACCELERATE_IN_AIR: phys.PLAYER_CAN_ACCELERATE_IN_AIR, //Says whether we can change dir with WSAD keys in air
    BASE_SPEED: 8,
    MOVE_SPEED: 8.0*25, //How fast this player moves ??obsolete
    ANGLE_SPEED: 1.25,  //How fast you rotate
    
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
    camera: null,   //Where we rig the camera to (if the local player)
    
    
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
    debug_rays: {}
});
//Methods:
SuperMega.Player.prototype.add_camera = function(camera){
    /**
     * Adds the camera to this player
     */
    if(this.camera){ //Remove the old camera first
        this.remove_camera();
    }
    this.camera = camera; //Store a pointer to it
    this.add(camera);
};
SuperMega.Player.prototype.remove_camera = function(){
    /**
     * Removes the camera from this player
     */
    var old_camera = this.camera;
    this.remove(this.camera);
    this.camera = null;
    return old_camera;
}
SuperMega.Player.prototype.mouse_move = function(e){
    /**
     * Updates the player's orientation according to the mouse movement.
     * Requires a camera to be rigged to the player.
     * 
     * It is assumed that you have already checked whether the pointer
     * has its lock before calling this!
     * 
     * @param e: The mouse movement event
     */
    if(!this.camera){ //Do nothing if no camera
        return false;
    }
    
    var player = this;
    var camera = player.camera;
    // Get the X/Y movement, and do a bunch of MATHS!
    var movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
    var movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
    var playerHorizontalAngleSpeed = Math.PI / 180 * -movementX*0.5;
    var radius = Math.sqrt((3 * camera.chase_scale) * (3 * camera.chase_scale) + (1 * camera.chase_scale) * (1 * camera.chase_scale));
    var currAngle = camera.chase_angle;
    var angleDiff = (movementY / 25)*0.5 / radius;
    var newAngle = Math.max(-1.5, Math.min(1.5, currAngle + angleDiff));
    var x = Math.cos(newAngle) * radius;
    var y = Math.sqrt(radius * radius - x * x);
    
    // Invert y if angle is negative
    y = newAngle > 0 ? y : -y;
    // Cap x so that the camera cannot go past the centre of the player model
    x = Math.max(x, 0.5);
    
    // Rotate the camera based on any horizontal movement (easy)
    player.rotateOnAxis( new THREE.Vector3(0,0,1), playerHorizontalAngleSpeed ); //Physically turns the player box
    player.rotateVelocity(playerHorizontalAngleSpeed); //Shifts existing velocity so you carry on sliding in same absolute direction
    
    // Update camera position for vertical adjustments
    camera.position.set(camera.position.x, x, y);
    camera.position.add(camera.cameraOffset);
    camera.lookAt(camera.LOOK_AT_RELATIVE); //Ensure we keep looking above player
    
    //Update my existing position and trackers:
    camera.chase_angle = newAngle;
    player.__dirtyRotation = true; //Ensure new position is seen
    player.__dirtyPosition = true;
    
    //You should broadcast the new position of the player!!
    return player.get_broadcast_position();
}
SuperMega.Player.prototype.mouse_scroll = function(event, delta, deltaX, deltaY){
    /**
     * Updates the camera's position so it is zooming in or out.
     * Requires a camera to be rigged to the player.
     * 
     * It is assumed that you have already checked whether the pointer
     * has its lock before calling this!
     * 
     * @param event: The mouse scroll event
     * @param delta - Wheel delta object
     * @param deltaX - Horizontal delta
     * @param deltaY - Vertical delta
     */
    if(!this.camera){ //Do nothing if no camera
        return false;
    }
    var player = this;
    var camera = player.camera;
    
    // Calculate the camera radius based current angle / scale
    var radius = Math.sqrt((3 * camera.chase_scale) * (3 * camera.chase_scale) + (1 * camera.chase_scale) * (1 * camera.chase_scale));

    // Check direction
    // Change the scale if chase-cam is enabled, or scale the position if free-looking
    if (deltaY > 0) { // scroll up
        if (!camera.chaseCamEnabled) {
            camera.position.multiplyScalar(1.1);
        } else {
            camera.chase_scale = Math.max(0.05, camera.chase_scale - 0.1);
        }
    } else if (deltaY < 0) { // scroll down
        if (!camera.chaseCamEnabled) {
            camera.position.multiplyScalar(0.9);
        } else {
            camera.chase_scale = Math.min(5, camera.chase_scale + 0.1);
        }
    }

    // Calculate the new angle and new radius
    var newAngle = camera.chase_angle,
        newRadius = Math.sqrt((3 * camera.chase_scale) * (3 * camera.chase_scale) + (1 * camera.chase_scale) * (1 * camera.chase_scale)),
        x = Math.cos(newAngle) * newRadius,
        y = Math.sqrt(newRadius * newRadius - x * x);

    // Invert y if angle is negative
    y = newAngle > 0 ? y : -y;

    // Cap x such that the camera cannot look past the player model
    x = Math.max(x, 0.5);

    // Update the camera position
    camera.position.set(camera.position.x, x, y);
    camera.position.add(camera.cameraOffset);     // Apply the camera offset
    camera.lookAt(camera.LOOK_AT_RELATIVE); // Look at the player model (just above it!)
    
    //Ensure we don't try to scroll the bloody page!
    event.stopPropagation();
    event.preventDefault();
};
SuperMega.Player.prototype.broadcast_position = function(){
    /**
     * Returns the data this player needs to send back to the server
     * 
     * @return {x,y,z,angle_z}: The position and z-rotation
     */
    return {
        "x" : this.position.x,
        "y" : this.position.y,
        "z" : this.position.z,
        "zRotation" : this.rotation.z
    }
}
SuperMega.Player.prototype.on_collision = function(level, callback){
    /**
     * Adds a collision listener to the player which will call the callback function
     * with the arguments callback(other_object, relative_velocity, relative_rotation, contact_normal)
     * 
     * @param level: <SuperMega.Level> The level in which our collision happened
     * @param callback: <Function> The function which will be called on collision
     * 
     */
    console.log("Collision event loaded");
    var player = this;
    this.addEventListener( 'collision', function( other_object, relative_velocity, relative_rotation, contact_normal ) {
        console.log("Hit something: "+other_object.uuid);
        
        if(other_object.supermega_ball_id){
            //You got hit by a ball!!
            if(other_object.sourcePlayerId == player.player_id){ //It's your own ball
                //collect your own ball
                level.unfire_ball(null, other_object, player); //The level can retrieve its own socket
            }
        }
        
        //Fire our callback!
        try{
            callback(other_object, relative_velocity, relative_rotation, contact_normal);
        }catch(err){
            console.log("Collision event callback error:");
            console.log(err);
        }
    });
};
SuperMega.Player.prototype.state = function(prop){
    /**
     * Returns the appropriate power state for this player
     * 
     * @param prop: <str> the property to access
     */
    prop = prop || null;
    if(prop){ //Return the requested property
        return this.POWER_STATES[prop][this.power_state];
    }  
};
SuperMega.Player.prototype.build_rays = function(){
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
        };
        this.flat_plane_points_names = {
            "x" : this.left_vertices_names,
            "-x" : this.right_vertices_names,
            "y" : this.back_vertices_names,
            "-y" : this.front_vertices_names
        };
        this.flat_plane_points_directions = {
            "x" : new THREE.Vector3(1,0,0),
            "-x" : new THREE.Vector3(-1,0,0),
            "y" : new THREE.Vector3(0,1,0),
            "-y" : new THREE.Vector3(0,-1,0)
        };
        
        
        this.caster = new THREE.Raycaster(); //Use one raycaster, save memory!
        this.caster.far = this.MAX_RAY_LENGTH || Infinity; //Optimisation
        
        /**
         * Second attempt at collision detection, using predictive mechanisms only;
         * 
         *     Platforms will be moved FIRST.
         *     
         *     Each axis taken separately
         *     
         *     Collisions that are about to happen go first to see if the character can actually make
         *     the movement it wants to make.
         *     Then collisions that have happened go second
         *          
         *          Determine the gradient of the platform you are already standing on (z_gradient_stepup)
         *          
         *          
         *          x-axis) then y-axis)
         *              a) Detect collisions from middle of character outwards (left-right) in that plane
         *              
         *              b) Examine collisions OUTSIDE the player in intended direction of travel only:
         *                 i) If a collision is going to happen before the end of the movement
         *                      If the collision is affecting the bottom rays only:
         *                          Allow the full horizontal move
         *                          Step-up by the bottom ray to step-up ray separation (z=z+0.5) = z_already_accounted_for
         *                      if the collision is affecting the bottom rays and stepup rays only:
         *                          Calculate the gradient of the thing you're colliding into
         *                          If the gradient <= max character can handle:
         *                              Allow the full horizontal move
         *                              Step-up by the amount indicated by the gradient (z=delta*x*grad) = z_already_accounted_for
         *                              
         *                          if the gradient > max character can handle:
         *                              Modify the horizontal move by the shortest ray (move up to object)
         *              
         *              c) Calculate any gradient-related z-move:
         *                  if z_already_accounted_for: //Step up by the max of the two
         *                      z_to_move = Max(z_gradient_stepup, z_already_accounted_for)
         *                  else:
         *                      z_to_move = z_gradient_stepup
         *                  
         *                  Is this z move going to CAUSE a collision? 
         *                      Yes:
         *                          Reduce z_to_move to the shortest ray
         *                          Reduce x_to_move by the same amount proportionally
         *                   
         *              d) Make the horizontal move
         *              e) Make the vertical correction move   
         *              
         *              //Should we do the internal collision detection in all axes at the end??
         *              f) Examine collisions inside the player, (that means a platform has driven into the player)
         *                  If a ray is colliding internally:
         *                      Nudge the player along in the opposite direction by (player_width/2 - collision_dist) so player is now at the edge of the object
         *                      (If a new internal collision has occurred in the direction you've moved, then that's a squish, and you're dead)
         *                      Set player's velocity in that axis (x or y) to the velocity of that platform
         *                  
         *                 
         *  
         * 
         */
        
        //Declare our new ray points
        this.new_rays = {
            "x" : {
                "top" : [new THREE.Vector3(0,0.5,1), new THREE.Vector3(0,-0.5,1)],
                "centre" : [new THREE.Vector3(0,0,0)],
                "stepup" : [new THREE.Vector3(0,0.5,(-1*(this.STEPUP_AMOUNT))), new THREE.Vector3(0,-0.5,(-1*(this.STEPUP_AMOUNT)))],
                "bottom" : [new THREE.Vector3(0,0.5,-1), new THREE.Vector3(0,-0.5,-1)]
            }, //The direction is given by THREE.Vector3(to_move_x,0,0).normalize()
            "y" : {
                "top" : [new THREE.Vector3(0.5,0,1), new THREE.Vector3(-0.5,0,1)],
                "centre" : [new THREE.Vector3(0,0,0)],
                "stepup" : [new THREE.Vector3(0.5,0,(-1*(this.STEPUP_AMOUNT))), new THREE.Vector3(-0.5,0,(-1*(this.STEPUP_AMOUNT)))],
                "bottom" : [new THREE.Vector3(0.5,0,-1), new THREE.Vector3(-0.5,0,-1)]
            }, //The direction is given by THREE.Vector3(0,to_move_y,0).normalize()
            "z" : {
                //           0=Leftback                       1=Leftfront               2=rightback                 3=rightfront
                "axial" : [new THREE.Vector3(0.5,0.5,0),new THREE.Vector3(0.5,-0.5,0),new THREE.Vector3(-0.5,0.5,0),new THREE.Vector3(-0.5,-0.5,0)],
            } //The direction is given by THREE.Vector3(0,0,to_move_z).normalize()
        };
        this.new_rays["x_minus"] = this.new_rays["x"]; //Uses same ray points
        this.new_rays["y_minus"] = this.new_rays["y"]; //Uses same ray points
        this.new_rays["z_minus"] = this.new_rays["z"]; //Uses same ray points
        this.axis_directions = {
            "x" : new THREE.Vector3(1,0,0),
            "y" : new THREE.Vector3(0,1,0),
            "z" : new THREE.Vector3(0,0,1),
            "x_minus" : new THREE.Vector3(-1,0,0),
            "y_minus" : new THREE.Vector3(0,-1,0),
            "z_minus" : new THREE.Vector3(0,0,-1)
        };
        this.axis_point_to_edge_distances = { //Must change this if we alter character dims
            "x" : 0.5,
            "y" : 0.5,
            "z" : 1,
            "x_minus" : 0.5,
            "y_minus" : 0.5,
            "z_minus" : 1
        };
};
SuperMega.Player.prototype.drawRay = function(level, id, origin, direction, distance) {
    var pointA = origin;
    direction.normalize();

    distance = distance || 10; // at what distance to determine pointB

    var pointB = new THREE.Vector3();
    pointB.addVectors ( pointA, direction.multiplyScalar( distance ) );
    
    var ray = this.debug_rays[id];
    if(typeof ray == "undefined" || !ray){
        var geometry = new THREE.Geometry();
        geometry.vertices.push( pointA );
        geometry.vertices.push( pointB );
        var material = new THREE.LineBasicMaterial( { color : 0xff0000, linewidth:3 } );
        var line = new THREE.Line( geometry, material );
        level.scene.add( line );
        this.debug_rays[id] = line;
    } else {
        ray.geometry.vertices[0] = pointA;
        ray.geometry.vertices[1] = pointB;
        ray.geometry.verticesNeedUpdate = true;
    }
};
   
SuperMega.Player.prototype.get_directional_collisions = function(vector_to_move, axis, target_objects, input, is_terrain, delta){
    /**
     * Returns the collisions in the direction given, for the axis given, assuming the player's position
     * 
     * NO interpretation is done on the consequences of the player's position or velocity. That's for the outer
     * loop to sort out.
     * 
     * @param to_move: <float> The amount we are intending to move by (sets ray length)
     * @param axis: <str> Which axis we are looking at
     *     "x"|"y"|"z" Movements in the positive axis direction
     *     "x_minus"|"y_minus"|"z_minus" Movements in the negative axis direction 
     *     If the proposed movement is opposite to the axis direction, then the output movement will be zero 
     * @param included_objects: [<array>collidables,debris] the list of items to test against
     * @param input: {} A dict from a previous run of this function
     * @param is_terrain: <boolean> Should the higher-efficiency lower accuracy terrain distance finding method be used?
     * @param delta: <float> The frame time in ms (now necessary to support punting)
     * 
     * 
     * @return: { //Collision summary:
     *      collisions: {
     *          <ray_group_1> : [<nearest_collision> || null, <nearest_collision>||null]
     *          <ray_group_2> : [<nearest_collision> || null, <nearest_collision>||null]
     *      },
     *      min_collision: <collisionobj> The collision which will happen first
     *      collision_distances: { //The player-edge-corrected distances of the collisions
     *          <ray_group_1> : [<float> || null, <float>||null]
     *          <ray_group_2> : [<float> || null, <float>||null]
     *      },
     *      min_collision_distance: <float> The player-edge-corrected distance until the first collision will occur (excluding stepup)
     *      will_collide: <float> //If the player will hard-collide with something, the max distance they can move until collision happens
     *      will_stepup: <float> //If the player will stepup, the adjustment in the Z-axis required to prevent collision
     *      stepup_gradient: <float> //The detected gradient (z/axis) between bottom and stepup rays. Uses the shortest ray of each  
     * }
     */
    //Sanitise inputs:
    var thisplayer = this; //Allows us to get back to obj when inside a jquery loop
    vector_to_move = vector_to_move || 0.0;
    target_objects = target_objects || this.level.collidables;
    var output = input || {
        "collisions" : {}, //Collision objects, sorted into their group_names. collision.distance is uncorrected.
        "min_collision" : null, //The closest collision object. Collision.distance is uncorrected
        "collided_with": false, //Closest object you have been deemed to have collided with
        "collision_distances" : {}, //Corrected collision distances, organised by group_name
        "min_collision_distance" : Infinity, //The closest collision distance (corrected)
        "stepup_begins_distance" : Infinity, //When you will touch the bottom of a slope
        "stepup_gradient" : 0.0, //Default to "don't adjust Z" please!
        "x_gradient" : 0.0, //For z-axis rays, what is the tilt of the floor in the x-axis?
        "y_gradient" : 0.0, //For z-axis rays, what is the tilt of the floor in the y-axis?
        "axis_move":Math.abs(vector_to_move), //Adjusted movement distance in-dimension (x or y axis) recommended, negative means opposite your direction
        "z_move":0.0, //Adjusted movement distance in Z-coordinates recommended (calculated from stepup gradient etc)
        "hit_touchables": [], //Touchable objects you have come into contact with
        "vector_to_move" : vector_to_move,
        "ray_direction" : null
    };
    var is_terrain = is_terrain || false; //Assume its not terrain
    
    //Don't check terrain in any direction other than down
    if(is_terrain && axis!="z_minus"){
        return output;
    }
    
    //Resolve beam direction    
    var internal = true;
    var direction = thisplayer.axis_directions[axis].clone();
    var axis_dimension = axis.charAt(0); //The first letter of our input axis name
    var direction_component = direction[axis_dimension]; //Quick way of seeing which way we are moving by taking the first letter of the axis declaration (z_minus > z)


    
    var ray_points = thisplayer.new_rays[axis]; //Where the rays will originate from
    var point_to_edge_distance = thisplayer.axis_point_to_edge_distances[axis]; //Distance from point to edge of character
    var relative_to_move = vector_to_move*direction_component; //The movement relative to the ray direction
    var normalised_relative_to_move = relative_to_move / Math.abs(relative_to_move) || 0.0;
    var to_move = 0.0;
    if(relative_to_move<0.0){ //This means we are moving in an OPPOSITE direction to the ray. We will NOT allow a translation in that axis for this direction
        to_move = 0;
        if(is_terrain){ //Optimising: Terrain doesn't move. So stop checking rays in the direction opposite our movement! 
            return output;
        }
    }else{
        to_move = Math.abs(vector_to_move); //Get a scalar of the movement, because rays have outwards as positive
    } 
    
    if(!direction || !ray_points){
        var msg = "ERROR: SuperMega.Player.get_directional_collisions was passed an invalid axis term: "+axis;
        throw new Error(msg);
    }
    var global_direction = direction.clone().applyZRotation3(-thisplayer.rotation.z);
    
    //Set our total caster properties once
    if(internal){
        thisplayer.caster.near = 0; //We are interested in internal collisions
    }else{
        thisplayer.caster.near = point_to_edge_distance; //We are NOT interested in internal collisions
    }
    
    
    //The default behaviour is for the output to match the to_move:
    output.axis_move = to_move; //Will be flipped to negative later
    
    
    
    //Create rays and log collisions
    $.each(ray_points, function(group_name, ray_group){
        var ray_length_multiplier = 6;
        if(is_terrain){ //Raycast testing versus a heightmap is proper slow, so bin rays we don't care about
            if(group_name=="top" || group_name=="centre"){ //Bin top and central rays
                return true; //This is a continue
            }
            ray_length_multiplier = 6; //Optimisation, use only short rays
        }
        //Set up loop vars:
        output.collisions[group_name] = output.collisions[group_name] || []; //Permits concatenation from earlier runs
        output.collision_distances[group_name] = output.collision_distances[group_name] || [];
        //Modify the max distance of the ray for the stepup rays only:
        if(group_name=="stepup"){
            thisplayer.caster.far = ray_length_multiplier*thisplayer.STEPUP_AMOUNT + to_move + point_to_edge_distance; //Means we won't miss v shallow gradients ahead of you 
        } else { //Everything else has a decent look about but with to_move added just in case the char is moving very fast
            thisplayer.caster.far = ray_length_multiplier*thisplayer.STEPUP_AMOUNT + to_move + point_to_edge_distance; //I've set this as fixed now
        }
        
        $.each(ray_group, function(ray_index, ray_point){
            var local_point = ray_point.clone(); //Grab the point on the surface of the player
            var global_point = local_point.applyMatrix4(thisplayer.matrixWorld); //Turn into global position
            thisplayer.caster.set(global_point, global_direction.clone().normalize()); //Set a ray with appropriate direction ??WHAT ABOUT SIZE of Ray??
            //thisplayer.drawRay(thisplayer.level, axis+"_"+ray_group+"_"+ray_index, global_point, global_direction, thisplayer.caster.far); //DEBUG
            
            //Check for collisions
            var collision_results = null;
            if(!is_terrain){ //Objects are not terrain. The most efficient algorithm will be intersectObjects
                collision_results = thisplayer.caster.intersectObjects(target_objects); //See what the outgoing rays hit
            } else { //Objects ARE terrain. The most efficient algorithm will be my manual "get_z" function;
                collision_results = []; //An array which we will sort by distance later!
                $.each(target_objects, function(index,terrain){
                    var terrain_z = terrain.geometry.get_z(global_point.x, global_point.y); //This uses a "what is your height at x,y" algorithm which I've put onto THREE.Plane3RandGeometry
                    var this_distance = thisplayer.position.z - terrain_z;
                    var this_collision = {
                        "distance" : this_distance,
                        "object" : terrain,
                        "point" : new THREE.Vector3(global_point.x, global_point.y, terrain_z) //Straight down
                    }
                    //We will ignore any terrain that's above you:
                    if(this_distance >= 0){
                        collision_results.push(this_collision);
                    }
                });
                //Now sort collision_results by distance ascending:
                collision_results.sort(function(a,b) {return (a.distance > b.distance) ? 1 : ((b.distance > a.distance) ? -1 : 0);} );
            }
            
            //Process collisions
            if ( collision_results.length > 0 ) { //Means this ray collided
                $.each(collision_results, function(index, collision){ //Iterate through all the collisions, deliberately ignore the player
                    if(collision.object.geometry.uuid == thisplayer.geometry.uuid){ //Skip this own player object!!
                        return true; //This acts as a $.each loop continue;
                    }
                    //Calculate collision distance
                    var corrected_collision_distance = collision.distance - point_to_edge_distance;
                    //Resolve the minimum collision
                    if(corrected_collision_distance <= relative_to_move){ //You will be touching this object after this move
                        if(output.min_collision_distance!==null && output.min_collision_distance > corrected_collision_distance){
                            output.min_collision_distance = corrected_collision_distance; //Set this new smaller collision distance
                            output.min_collision = collision;
                            output.collided_with = collision.object;
                        }
                    }
                    //Store all valid collisions
                    output.collisions[group_name].push(collision);
                    output.collision_distances[group_name].push(corrected_collision_distance);
                    //Seeing as we have the closest collision for this ray, we can stop processing now!
                    return false; //AKA break;
                });
            }else{ //The beam has collided with NOTHING
                output.collisions[group_name].push(null);
                output.collision_distances[group_name].push(Infinity); //Default distance is always infinity
            }
        });
    });
    
    //Now lets make some sense out of our output
    if(axis_dimension=="x" || axis_dimension=="y"){
        var min_top_collisions = null;
        var min_centre_collisions = null;
        var min_stepup_collisions = null;
        var min_bottom_collisions = null;
        if(output.collision_distances["top"]) {min_top_collisions = Math.min.apply(null, output.collision_distances["top"]);} 
        if(output.collision_distances["centre"]) {min_centre_collisions = Math.min.apply(null, output.collision_distances["centre"]);}
        if(output.collision_distances["stepup"]) {min_stepup_collisions = Math.min.apply(null, output.collision_distances["stepup"]);} 
        if(output.collision_distances["bottom"]) {min_bottom_collisions = Math.min.apply(null, output.collision_distances["bottom"]);}
        //First is the whole movement illegal? (if Min(top_dist), or Min(centre) < to_move, then it is)
        if(min_top_collisions < relative_to_move || min_centre_collisions < relative_to_move){ //Means you've hit your head or body
            output.axis_move = Math.min(min_top_collisions, min_centre_collisions); //Move up to the nearest moment you hit your head (might even be backwards!)
            output.collided_with = output.min_collision.object; //Snap the closest object you hit
        } else if(min_stepup_collisions < relative_to_move || min_bottom_collisions < relative_to_move){ //Means we need to do futher work
            //We will at some point in the path, hit an edge or a slope.
            var slope_horizontal = min_stepup_collisions - min_bottom_collisions; //This is where having extra long stepup rays matter
            var slope_vertical = thisplayer.STEPUP_AMOUNT; //Distance up your body from the bottom!
            var slope_grad = slope_vertical/slope_horizontal; //Get our gradient (using the point at the START of the slope!!)
            output.stepup_gradient = slope_grad;
            output.stepup_begins_distance = min_bottom_collisions;
            if(slope_grad > thisplayer.POWER_STATES["max_gradient"][thisplayer.power_state]){
                //Sorry chump, slope too steep, you can only move up to start of the slope
                output.axis_move = Math.min(min_bottom_collisions,min_stepup_collisions); //Takes care of NEGATIVE gradients too (i.e. overhangs)
                output.collided_with = output.min_collision.object; //Snap the closest object you hit
                console.log("Too steep!");
            }else{
                //Not too steep, you can ascend the slope
                output.axis_move = to_move; //Full horizontal movement
                var z_move = slope_grad*(to_move-min_bottom_collisions); //Ascend by the amount you'll move BEYOND the start of the slope
                if(!isNaN(z_move)){
                    output.z_move = z_move; //Why is this happening?? double X translation??
                }else{
                    //D("NaN!! "+slope_vertical+"/"+slope_horizontal+"");
                    output.z_move = thisplayer.STEPUP_AMOUNT;
                }
                //TODO: Check knock-on head-hitting here.
            }
        }
        
        //PUNTING! Has an object encroached into the player's space such that we'll get a collision imminently?
        if(min_top_collisions!==null || min_centre_collisions!==null){ //Yes this has the velocity!
            //First we need to deduce which ray struck this object first
            var min_coll = null;
            //Check if it was the top rays
            if(min_top_collisions!==null && (min_top_collisions < min_centre_collisions || min_centre_collisions===null)){
                //min_top_collisions is the dominant collision here
                var min_coll_distance = min_top_collisions;
                var min_coll_index = output.collision_distances["top"].indexOf(min_top_collisions); //Which ray caused the collision event
                var min_coll = output.collisions["top"][min_coll_index]; //What collision event this is
            }
            //Now check the centre rays for punting
            if(min_centre_collisions!==null && (min_centre_collisions < min_top_collisions || min_top_collisions===null)){
                //min_top_collisions is the dominant collision here
                var min_coll_distance = min_centre_collisions;
                var min_coll_index = output.collision_distances["centre"].indexOf(min_top_collisions); //Which ray caused the collision event
                var min_coll = output.collisions["centre"][min_coll_index]; //What collision event this is
            }
            
            //Only bother to process this if there is a registered collision.
            if(min_coll){
                var min_coll_obj = min_coll.object; //What object you collided with
                //Will may collide... Is the velocity of the object in that plane + player velocity greater than the ray dist?
                if(min_coll_obj){
                    if(min_coll_obj.velocity){ //Only process if this has a velocity
                        //NB: a collision object returns: { distance, point, face, faceIndex, indices, object }
                        //We can use the {point} var to get the world collision point
                        var collider_velocity_world = min_coll_obj.velocity_at_point_simplified(min_coll.point); //Gets the velocity conferred by both rotation and linear velocities of the platform
                        //D(collider_velocity_world);
                        var collider_velocity_player = thisplayer.get_player_centric_velocity(null, collider_velocity_world); //Turns platform velocity into player's velocity
                        //Calculate the impact distance necessary
                        var combined_distance_travelled = (thisplayer.velocity[axis_dimension] + collider_velocity_player[axis_dimension])*delta 
                        var combined_distance_travelled_corrected = combined_distance_travelled*normalised_relative_to_move; //Don't need this
                        //if(combined_distance_travelled >= (min_coll_distance*normalised_relative_to_move)){ //This is a collision worthy of punting!
                        //D("Combined distance: "+combined_distance_travelled+" min_coll_dist: "+min_coll_distance);
                        //D("combined_distance_travelled="+combined_distance_travelled+"  min_coll_distance="+min_coll_distance);
                        //D("["+axis_dimension+"] comb_dist="+combined_distance_travelled + " norm_rel="+normalised_relative_to_move+" min_coll_dist="+min_coll_distance);
                        
                        //Is this a collision worthy of a punt? #THE BASTARD LINE# - Get it wrong, collisions either don't happen, or you get "sucked behind" moving platforms!!
                        if((combined_distance_travelled_corrected >= 0 && combined_distance_travelled_corrected >= min_coll_distance) || (combined_distance_travelled_corrected < 0 && (0-combined_distance_travelled_corrected) > min_coll_distance)){ //This ensures we consider direction
                            output.axis_move = collider_velocity_player[axis_dimension]*delta; //This is the vector displacement to punt the player
                            if(direction_component<0){ //It's gonna get flipped from a scalar to a vector so lets flip it first, so the flip back corrects it!!
                                output.axis_move = output.axis_move * -1; 
                            }
                            //Transfer momentum to player
                            thisplayer.velocity[axis_dimension] = thisplayer.velocity[axis_dimension] + collider_velocity_player[axis_dimension]; 
                            D("PUNT! ["+axis_dimension+"] SM:"+thisplayer.velocity.str()+" Pltf:"+collider_velocity_player.str());
                            
                            //Call the object's touched method:
                            try{
                                min_coll_obj.touched(delta, thisplayer);
                            }catch(err){ //When there is no .touched() method!
                            }
                        }
                    }
               }
            }
        }
        
        //Now detect contact with a trap (we'll pick the nearest obj only
        if(min_top_collisions < relative_to_move || min_centre_collisions < relative_to_move || min_bottom_collisions < relative_to_move){
            if(typeof output.min_collision.object !== "undefined"){
                if(typeof output.min_collision.object.touched !== "undefined"){
                    output.hit_touchables.push(output.min_collision.object); //Add our touchable object to the output dict
                }
            }
        }
    } 
    else if(axis_dimension=="z") 
    { //Different behaviour here (NB: you could use similar gradient logic to implement sliding!!)
        //Calculate gradient at your feet - NB we do not bother with the PLATFORM_GRACE as it would apply to both
        var shortest_dist = output.min_collision_distance;
        var shortest_vertex_index = output.collision_distances["axial"].indexOf(shortest_dist); //Finds which vertex has the shortest path to the object
        var vertex_collisions = output.collision_distances["axial"];
        if(shortest_dist <= to_move+1*thisplayer.PLATFORM_GRACE){ //Only return gradients if the surface is close
            if(shortest_vertex_index==0){ //Depth of the player is flipped with height, remember? (Y -> Z)
                output.x_gradient = (vertex_collisions[2] - shortest_dist)/this.geometry.width;
                output.y_gradient = (vertex_collisions[1] - shortest_dist)/this.geometry.height;
            } else if(shortest_vertex_index==1){ 
                output.x_gradient = (vertex_collisions[3] - shortest_dist)/this.geometry.width;
                output.y_gradient = (0-(vertex_collisions[0] - shortest_dist))/this.geometry.height;
            } else if(shortest_vertex_index==2){ 
                output.x_gradient = (0-(vertex_collisions[0] - shortest_dist))/this.geometry.width;
                output.y_gradient = (vertex_collisions[3] - shortest_dist)/this.geometry.height;
            } else if(shortest_vertex_index==3){ 
                output.x_gradient = (0-(vertex_collisions[1] - shortest_dist))/this.geometry.width;
                output.y_gradient = (0-(vertex_collisions[2] - shortest_dist))/this.geometry.height;
            }
            if(output.x_gradient<=-Infinity || output.x_gradient>=Infinity || isNaN(output.x_gradient)){output.x_gradient=0;} //Ignore nonsense values
            if(output.y_gradient<=-Infinity || output.y_gradient>=Infinity || isNaN(output.y_gradient)){output.y_gradient=0;} //Ignore nonsense values
        }
        
        
        //Use the closest to touching floor item to deduce friction:
        var standing_on = null; //Default to not standing on stuff
        var hit_touchable = null;
        if(shortest_dist <= (to_move+1*this.PLATFORM_GRACE)){ //Just come into contact with a platform
            //Correct the movement to limit it to touching the platform
            //TODO: Rising platform jiggery. Fix the annoying bug where you jiggle about on a platform if its rising
            output.axis_move = shortest_dist; //Update the z axis movement so you rise to the top of a platform if half sunk in it, or bash your head if jumping
            output.collided_with = output.min_collision.object; //Ensure we log this as a bonafide collision
            //Add in any traps etc with "touched" methods
            if(typeof output.min_collision !== "undefined"){
                if(typeof output.min_collision.object.touched !== "undefined"){
                    output.hit_touchables.push(output.min_collision.object); //Add our touchable object to the output dict
                }
            }
        }else{ //No contact with a platform
            
        }
        output.z_move = output.axis_move;
    }
    
    //Make our signs consistent (e.g. if moving -y, the to_move should be -y if not colliding)
    if(direction_component<0){
        output.axis_move = output.axis_move * -1;
    }
    
    //Reset our ray caster
    thisplayer.caster.near = 0;
    thisplayer.caster.far = this.MAX_RAY_LENGTH || Infinity; //Reset for others to use
    return output;
}
SuperMega.Player.prototype.move_according_to_velocity2 = function(delta, level){
    /**
     * Smarter collision detection which can account for internal and imminent collisions all in one go!!
     * @param delta: The time since last frame
     * @param level: The level, from which the terrain and collidables are extracted 
     * 
     * @return: <float> mu, the coefficient of friction for the platform you are standing on
     */
    
    var player = this;
    
    //First, iterate through the horizontal axes (aligned to player)
    var verdict = {
            "z":{},
            "z_minus":{},
            "x":{},
            "x_minus":{},
            "y":{},
            "y_minus":{},
    }
    
    //Z-axis goes first:
    //var vector_to_move = (player.velocity.z + player.standing_on_velocity.z) * delta;
    //verdict["z"] = player.get_directional_collisions(vector_to_move, "z", level.collidables, 1); //to_move, axis_name, target_objects, relative_direction (if vector zero)
    var standing_on = false; //Assume you are NOT standing on something
    var standing_on_point = ZERO_VECTOR3 //Not standing on owt.
    
    //Start with the Z axis... this plays totally differently, we make it absolute:
    //var vector_to_move = (player.velocity[axis] + player.standing_on_velocity[axis]) * delta;
    //verdict["z"] = player.get_directional_collisions(vector_to_move, axis, level.collidables, 1); //to_move, axis_name, target_objects, relative_direction (if vector zero)
    var axis_list = ["z_minus","z","x","x_minus","y","y_minus"];
    var side_axis_list = ["x","x_minus","y","y_minus"];
    $.each(axis_list, function(index,axis){

        //First, check collisions that are likely to happen
        var axis_dimension = axis.charAt(0);
        var vector_to_move = (player.velocity[axis_dimension] + player.standing_on_velocity[axis_dimension]) * delta;
        //Put them into our collision function. Will only return an output movement in the current axis IF movement congruent with direction of axis
        verdict[axis] = player.get_directional_collisions(vector_to_move, axis, level.collidables, null, false, delta); //to_move, axis_name, target_objects
        verdict[axis] = player.get_directional_collisions(vector_to_move, axis, level.terrain, verdict[axis], true, delta); //More efficient check vs terrain (uses get_z function)
        
        //Check for collisions in the direction of movement 
        if(axis_dimension=="z"){
            player.translateZ(verdict[axis].axis_move);
        }else if(axis_dimension=="x"){
            player.translateX(verdict[axis].axis_move);
            //Need to do a "furthest from zero of [x].z_move and [z].x_grad*x_move
            var resolved_z_move = Math.max(verdict["z"].x_gradient*verdict["x"].axis_move, verdict["x"].z_move); //Take the first non-zero amount
            player.translateZ(resolved_z_move); //X may have an affect on Z (gradient ascent)
        }else if(axis_dimension=="y"){
            player.translateY(verdict[axis].axis_move);
            var resolved_z_move = Math.max(verdict["z"].y_gradient*verdict["y"].axis_move, verdict["y"].z_move); //Take the first non-zero amount
            player.translateZ(resolved_z_move); //Y may have an affect on Z (gradient ascent)
        }
        
        
        if(verdict[axis].axis_move){
            player.hasMoved = true;
        }
    });
    //console.log(verdict["z"]);
    
    //Resolve falling
    if(verdict["z_minus"].collided_with){ //You have an object at your feet!
        standing_on = verdict["z_minus"].collided_with;
        standing_on_point = verdict["z_minus"].min_collision.point;
        player.velocity.z=0; //Stop moving up or down
    } 
    if(verdict["z"].collided_with){ //Hit your head!
        player.velocity.z=0; //Stop rising
    }
    
    
    
    //Resolve touchables (traps etc):
    var all_touched = [];
    $.each(verdict, function(axis,axis_verdict){
        $.merge(all_touched,axis_verdict.hit_touchables);
    });
    //Now perform all touch events:
    var touched_this_round = [];
    $.each(all_touched, function(index,obj){
        //We need to deduplicate repeat touches in the same delta round (where multiple axis rays touch object)
        if(touched_this_round.indexOf(obj)<0){
            obj.touched(delta,player,level);
            touched_this_round.push(obj);
        }
    });
    
    
    //Collect any collectables you are touching:
    var hit_collectables = this.detectCollision(level.interactables);
    if(hit_collectables && level.loaded && player.ready){
        console.log("Hit pickup!!");
        var already_hit = [];
        $.each(hit_collectables.other_objects, function(index, obj){
            if(already_hit.indexOf(obj)<0){ //Prevent double-collision issues
                this.collect(delta, player, level); //Collect this object!
                already_hit.push(obj);
                console.log(obj);
            }
        });
    }
    
    //Velocity decay (phys. is just my dict of useful constants)
    //Friction
    var mu = 0.05; //Minimal friction in air
    if(standing_on) { //Only apply friction if we're actually standing on the platform!!
        var mu = standing_on.material._physijs.friction; //[z].standing_on is the floor object we are colliding with
        if(mu<=0 || mu > 10){
            mu = 0.5;
        }
    }
    this.mu = mu;

    //Gravity!! - only if not standing
    if(!standing_on){ //Player not standing on the platform
        var x_surface_decay_amount = 0; //Not standing on anything!!
        var y_surface_decay_amount = 0; //Not standing on anything!!
        player.velocity.z -= 9.8 * 10.0 * delta; // 10.0 = mass
        player.standing = false;
    }else{ //Player IS standing on the platform
        var x_surface_decay_amount = this.velocity.x * phys.SURFACE_DRAG_COEFF * mu * delta;
        var y_surface_decay_amount = this.velocity.y * phys.SURFACE_DRAG_COEFF * mu * delta;
        player.standing = true;
        player.isJumping = false;
        //Adjust the player's velocity to match the platform
        //player.adjustStandingOnVelocity(standing_on); //Old method
        player.adjust_standing_on_velocity_inc_rotation(standing_on, standing_on_point); //Takes into account the rotational velocity of the object
    }
    
    //Perform velocity decay (from friction and air resistance)
    //NB f=ma so a=f/m. The number 5 details the relationship of opposing force vs driving force
    this.velocity.x = this.velocity.x - x_surface_decay_amount - (this.velocity.x * phys.AIR_DRAG_COEFF * delta);
    this.velocity.y = this.velocity.y - y_surface_decay_amount - (this.velocity.y * phys.AIR_DRAG_COEFF * delta);
    
    //Update position:
    if(!USE_PHYSIJS_FOR_PLAYER){
        player.__dirtyPosition = true;
        player.__dirtyRotation = true;
    } else {
        player.setLinearVelocity(this.velocity.x, this.velocity.y, this.velocity.z);
    }
    
    //Show debug info
    this.update_debug_stats(verdict["x"].axis_move.toFixed(2), verdict["y"].axis_move.toFixed(2), verdict["z"].axis_move.toFixed(2)+" S:"+player.standing);    
    
    //Return the friction so the rest of our engine can use it.
    return mu;
    
    
    //Let's just see what comes out:
    //console.log("x:"+verdict.x.axis_move.toFixed(2)+" y:"+verdict.y.axis_move.toFixed(2)+" z:"+(verdict.x.z_move+verdict.y.z_move).toFixed(2)+" grad_x:"+verdict.x.stepup_gradient+" grad_y:"+verdict.y.stepup_gradient);
}
SuperMega.Player.prototype.reset = function(options, scene, hud){
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
            this.body = null; //Reset body
        }
        
        //Show player!
        this.visible = true;
        if(!USE_PHYSIJS_FOR_PLAYER){
            this.__dirtyPosition = true;
            this.__dirtyRotation = true;
        }
};
SuperMega.Player.prototype.rotateVelocity = function(z_rotation_speed){
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
};
SuperMega.Player.prototype.get_player_centric_velocity = function(entity, velocity){
    /**
     * Takes a platform or other SuperMega entity, converts its world-velocity into a player-centric
     * velocity
     * 
     * @param entity: <SuperMega.Interactable> Something which we expect to have a velocity
     * @param velocity: <THREE.js> You can pass in a velocity directly too
     * 
     * @return: <THREE.Velocity3> The same velocity applied to player's local axes
     */
    entity = entity || null;
    velocity = velocity || null;
    
    //Check that this platform has velocity:
    if (!entity){
        //Assume a velocity provided
        var plat_vel = velocity;
    } else if(typeof entity.object != "undefined"){
        var plat_vel = velocity || entity.object.velocity; //ensure than an explicit velocity always overrides the derived-from-object
    }
    else{
        var plat_vel = velocity || entity.velocity;
    }
    
    //Default to Zero if not supplied
    if(typeof plat_vel == "undefined" || plat_vel === null){ //No velocity stated
        plat_vel = ZERO_VECTOR3; //It has ZERO velocity.
    } else { //Convert to velocity in terms of player's orientation
        plat_vel = plat_vel.clone(); //Copy to thing
        plat_vel = plat_vel.applyZRotation3(this.rotation.z);
        //D("Rotated velocity to match player: "+plat_vel.str());
    }
    
    return plat_vel;
};
SuperMega.Player.prototype.adjustStandingOnVelocity = function (platformObj){
        /**
         * Adjusts the player's base velocity to the platform you are standing on
         * @param platformObj: The object you are standing on
         * @return: <THREE.Vector3> Final velocity
         */
    if(!platformObj){
        return this.standing_on_velocity.clone();
    }
    var plat_vel = this.get_player_centric_velocity(platformObj);
    this.standing_on_velocity = plat_vel;
    return plat_vel;
};
SuperMega.Player.prototype.adjust_standing_on_velocity_inc_rotation = function (platform_obj, contact_vertex_position){
    /**
     * Adjusts the player's base velocity to the platform you are standing on
     * @param platformObj: The object you are standing on
     * @param contact_vertex_position: The vertex in touch with the platform
     * @return: <THREE.Vector3> Final velocity
     */
    if(!platform_obj){
        return this.standing_on_velocity.clone();
    }
    try{
        var plat_vel_world = platform_obj.velocity_at_point_simplified(contact_vertex_position);
    }catch(e){
        var plat_vel_world = platform_obj.velocity; //Terrain doesn't have velocity_at_point      
    }
    var plat_vel_player = this.get_player_centric_velocity(null, plat_vel_world);
    this.standing_on_velocity = plat_vel_player;
    return plat_vel_player;
};
SuperMega.Player.prototype.detectCollision = function(otherObjs){
        /**
         * Internal collision detection, uses rays which pass from object centre to vertices. Useful for "after the fact" collision detection
         * This is buggy and is what is causing the player to "get stuck" if one axis move being negated causes the player to collide in another
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
                if(other_objects.indexOf(collisionResults[0].object)<0){ //Deduplication at source
                    other_objects.push(collisionResults[0].object);
                    var closest_hit_to_centre = collisionResults[0].distance; //The closest point on the ray from origin which hit the object
                    var percentage_distance_hit = closest_hit_to_centre/directionVector.length(); //The percentage distance along the ray to the vertex where contact happened 
                    collision_detected = true;
                    rays_hit[ray_name] = percentage_distance_hit; //Our output dict
                }
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
};
SuperMega.Player.prototype.detectCollisions = function(otherObjs){return this.detectCollision(otherObjs);}; //ALIAS
SuperMega.Player.prototype.zCollisionPrediction = function(otherObjs){
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
                all_floor_properties.push(collided_with.object.material._physijs); //Allows us to get the friction and restitution of the object!
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
};
SuperMega.Player.prototype.quickCollisionPrediction = function(otherObjs, excludedObjsIds, delta){
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
                if(collided_with.distance <= this.PLATFORM_GRACE*1){ //Get close enough, that counts as a collision!
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
};
SuperMega.Player.prototype.lastMovementCausesCollision = function(x,y,z,objs){
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
};
SuperMega.Player.prototype.intersects_terrain = function(terrain_objs){
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
};
SuperMega.Player.prototype.adjust_to_stand_on_terrain = function(terrain_objs){
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
            if(!USE_PHYSIJS_FOR_PLAYER){
                this.__dirtyPosition = true;
                this.__dirtyRotation = true;
            }
        }
        
        return this; //For chaining        
};
SuperMega.Player.prototype.move_according_to_velocity = function(delta, level){
        /**
         * Moves this player according to their internal velocities
         * It's essentially the .animate() function for player!!
         * 
         * @param delta: The time since last frame
         * @param level: The level, from which the terrain and collidables are extracted 
         */
    //Experimental
    this.move_according_to_velocity2(delta,level);
    
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
                    p.jump_keydown_continuously = false; //Null off the persistent space press
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
                    p.jump_keydown_continuously = false; //Null off the persistent space press
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
            //var horizontal_collisions = this.quickCollisionPrediction(all_collidables, dist_to_hit.standing_on_ids, delta); //Second property is the stuff you are standing on //TEMPOFF
            
            //LEFT/RIGHT: X, did they collide?
            oldPos = this.position.clone() //We need to update this with every movement
            to_move = (this.velocity.x + this.standing_on_velocity.x)*delta + x_move_slipping; //Player_velocity + platform_velocity + velocity from slope slippage
            z_grad_move = 0; //Default to nil movement
            if(dist_to_hit.x_gradient > -3 && dist_to_hit.x_gradient < 3){ //We have a legit gradient here
                if(Math.abs(dist_to_hit.x_gradient) >= max_grad){ //Too steep, SLIDE!!
                    this.standing=false;
                    //TODO: Implement sliding
                }
                //z_grad_move = to_move * dist_to_hit.x_gradient; //TEMPOFF
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
                //z_grad_move = to_move * dist_to_hit.y_gradient; //TEMPOFF
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
        if(!USE_PHYSIJS_FOR_PLAYER){
            this.__dirtyPosition = true;
            this.__dirtyRotation = true;
        }
       
            
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
        this.mu = mu;
        //Perform self-initiated velocity decay
        this.velocity.x = this.velocity.x - (this.velocity.x * 20.0 * mu * delta);
        this.velocity.y = this.velocity.y - (this.velocity.y * 20.0 * mu * delta);
    
        //Gravity!! - only if not standing
        if(!this.standing){
            this.velocity.z -= 9.8 * 10.0 * delta; // 10.0 = mass
        }
        
        //Show debug info
        this.update_debug_stats(x_collide, y_collide, z_collide);
        
        //Return the friction so the rest of our engine can use it.
        return mu;
};
SuperMega.Player.prototype.update_debug_stats = function(x_collide, y_collide, z_collide){
    //Debug stats:
    var collisiondata = "Clip X:"+x_collide+", Y:"+y_collide+", Z:"+z_collide+""
    var playerrot = "Player rot: "+this.rotation.x.toFixed(2)+","+this.rotation.y.toFixed(2)+","+this.rotation.z.toFixed(2)+"("+(this.rotation.z*(180/Math.PI)).toFixed(1)+")";
    var playerpos = "Player pos: "+this.position.x.toFixed(2)+","+this.position.y.toFixed(2)+","+this.position.z.toFixed(2);
    var playervel = "Player vel: "+this.velocity.x.toFixed(2)+","+this.velocity.y.toFixed(2)+","+this.velocity.z.toFixed(2);
    $('#debug-stats').html(collisiondata+"<br/>"+playerrot+"<br/><br/>"+playerpos+"<br/>"+playervel+"<br/>µ:"+this.mu+", PlatformVel: "+this.standing_on_velocity.x+","+this.standing_on_velocity.y+","+this.standing_on_velocity.z);
};
SuperMega.Player.prototype.make_sprite = function(options){
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
        
        if(!this.local){ //Only show the name if a remote player
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
        }

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
};
SuperMega.Player.prototype.update_sprite = function(){
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
};
SuperMega.Player.prototype.delete_balls = function(scene, hud, options) {
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
};
SuperMega.Player.prototype.set_power = function(pow){
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
};
SuperMega.Player.prototype.setPower = function(pow){return this.set_power(pow);}; //ALIAS
SuperMega.Player.prototype.power_up = function(increment){ 
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
};
SuperMega.Player.prototype.respawn = function(level, position){
        /*
         * Respawns the player at the given position:
         * 
         * @param level: <SuperMega.level> If provided, will seek out the levels start position
         * @param position: <THREE.Vector3> If provided, will use this as the start point
         */
        this.heal(100);
        this.reset();
        
        
        //And place the player back at the starting point:
        var start_position = position || level.start_position || ZERO_VECTOR3;
        if(level){
        	console.log("Respawning");
        	var start_position = level.start_position;
        } 
    	if(!start_position){
    	    start_position = {
    	            "x" : (0.5-Math.random())*level.world_width*4,
    	            "y" : (0.5-Math.random())*level.world_depth*4
    	    };
    	    start_position["z"] = level.get_terrain_z(start_position.x,start_position.y)
    	}
    	this.position.set(start_position.x, start_position.y, start_position.z);
    	this.rotation.setFromVector3(level.start_orientation || ZERO_EULER);
};
SuperMega.Player.prototype.injure = function(damage){
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
};
SuperMega.Player.prototype.heal = function(life){
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
};
SuperMega.Player.prototype.get_nom = function(noms_collected){
        /**
         * Increases nom score:
         * @param noms_collected: The number of noms just picked up
         */
        noms_collected = noms_collected || 1;
        this.noms += 1;
        this.hud.nomCount.text(this.noms);
};
SuperMega.Player.prototype.throw_ball = function(socket, level){
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
};
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
 *       orientation: <THREE.Euler> The rotational orientation of the object.
 *        angular_momentum: <THREE.Euler> the rotational movement of the object (Radians per second) 
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
    
    
    //Ensure we have valid Vectors and Eulers coming in: 
    if(options.position){options.position = SuperMega.resolve_vector(options.position);}
    if(options.translation){options.translation = SuperMega.resolve_vector(options.translation);}
    if(options.angular_momentum){options.angular_momentum = SuperMega.resolve_vector(options.angular_momentum);} //Yes this SHOULD be a vector!!
    if(options.orientation){options.orientation = SuperMega.resolve_euler(options.orientation);}

    
    //Resolve options:
    var ops = {
        "geometry" : options.geometry || null, //Will use a blank cube to contain everything
        "material" : options.material || null, //Will be transparent cube
        "mesh_shape" : options.mesh_shape || options.mesh_type || "box", //What shape the bouding box has
        "mass" : options.mass || 0,
        "contains" : options.contains || [], //Sub objects, contained within
        "position" : options.position || null,
        "size" : options.size || [1,1,1],
        "segments" : options.segments || [32,32,32],
        "color" : options.color || options.colour || 0xA0A0A0,
        "opacity" : options.opacity || 1,
        "friction" : options.friction || .5,
        "restitution" : options.friction || .4,
        "orientation" : options.orientation || new THREE.Vector3(0,0,0),
        "angular_momentum" : options.angular_momentum || new THREE.Euler(0,0,0),
        "translation" : options.translation || new THREE.Vector3(0,0,0),
        "rotation_mode" : options.rotation_mode || null,
        "translation_mode" : options.translation_mode || null,
        "magnitude" : options.magnitude || 0,
        "level" : options.level || null, //Can pass the level in for manipulating pickups
        "preset" : options.preset || null, //Can pass the scene in for manipulating pickups 
        "name" : options.name || "" //For addressing with switches etc
    };
    
    //Alias level
    this.level = ops.level; //Track level if passed in at start
    
    //Apply presets
    if(ops.preset!=null){
        //Means replace our objects with the present values
        var preset = SuperMega.OBJECT_PRESETS[ops.preset] || null;
        if(preset){ //Update our options with values from the preset
            ops = $.extend(ops, preset);
        }else{
            console.log("WARNING: Preset '"+ops.preset+"' is not a known valid preset name!");
        }
    }
    
    //Resolve sizes and segments:
    if(!(ops.geometry instanceof THREE.Geometry)){ //User has supplied an array [x,y,z] sizes instead of a geometry object, so create
        var sizes = ops.size || ops.sizes || [1,1,1];
        var width_geo = sizes[0];
        var depth_geo = sizes[1] || width_geo;
        var height_geo = sizes[2] || width_geo;
        
        var segments = ops.segments || [32,32];
        var width_segments = segments[0];
        var height_segments = segments[1] || width_segments;
    }
    
    //Resolve geometry and material
    if(ops.geometry==null){
        //Create default geometry:
        if(ops.mesh_shape=="box" || ops.mesh_shape=="cube"){
            ops.geometry = new THREE.CubeGeometry(width_geo, depth_geo, height_geo);
        }else if(ops.mesh_shape=="sphere"){
            //Spheres take their size as [radius,] and their segments as [width_seg, height_seg]
            ops.geometry = new THREE.SphereGeometry(width_geo, width_segments, height_segments); 
        }else if(ops.mesh_shape=="cylinder" || ops.mesh_shape=="cone" || ops.mesh_shape=="capsule"){
            //Cylinders take their size as [radius_top, radius_bottom, height]
            ops.geometry = new THREE.CylinderGeometry(width_geo, depth_geo, height_geo, width_segments, height_segments); 
        } else {
            throw Error("SuperMega.Interactables: Sorry, "+mesh_shape+" mesh shape requires you to supply the geometry yourself. Set 'geometry' in the options.");
        }
    }
    if(ops.material==null){ //Default to invisible material
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
    this.ops = ops;     //Store our options globally
    
    //Now we have enough to create our object:
    Physijs.Mesh.call(this, ops.geometry, ops.material, ops.mass ); //JS inheritance hack part 1
    //This is where we'll add the shape options:
    this.generate_shape_specific_properties(ops.mesh_shape, ops.geometry, ops.material, ops.mass);
    
    //Set name:
    this.name = ops.name; //Also happens under the hood in THREE.js!
    
    //Set up physical location
    this.position.set(ops.position.x,ops.position.y,ops.position.z); //Since r85.2, position is read-only, so call position.set
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
    
    //Set clock properties:
    this.active = true; //Whether you can interact this
    if(typeof this.ops.state === "undefined"){
        this.state = false; //Tracks the state of this object. If not given, defaults to false
    } else {
        this.state = this.ops.state; //Set it to its starting state. This.state can be anything and can vary on the type of object
    }
    this.refractory_period = options.refractory_period || 15.0; //The time in seconds to when this stops being refractory
    this.refractory_clock = this.refractory_period; //Clock watcher, must be >= this.refractory_period to be considered active
    this.regenerates = false; //Whether this regenerates after the refractory period or not
    
    //Other default properties
    this.collectable = false; //Can store whatever you want here. Will depend on the type of object
    
    //Create movement watchers:
    this.amount_moved = new THREE.Vector3(0,0,0);
    this.velocity = new THREE.Vector3(0,0,0); //will be relative to the MAP not to the Player!!
    this.origin = this.position.clone(); //Where we started (or orbit around!)
    this.rotation_matrix = new THREE.Matrix4(); //Necessary to do axis rotations

}
SuperMega.Interactable.prototype = Object.assign( Object.create(Physijs.Mesh.prototype), {
    constructor: SuperMega.Interactable
}); //JS inheritance hack part 2
SuperMega.Interactable.prototype.generate_shape_specific_properties = function(mesh_shape, geometry, material, mass){
    /**
     * Generates the special geometry vars for the shape (this is an implementation of the
     * logic of the PhysiJS applied mesh constructors.
     * 
     * @param mesh_shape: <str> the mesh shape to init
     *  
     *      Choices:
     *          plane
     *          box
     *          sphere
     *          cylinder
     *          capsule
     *          cone
     *          concave
     *          convex
     */
    //Sanitise inputs
    geometry = geometry || this.ops.geometry;
    material = material || this.ops.material;
    mass = mass || this.ops.mass;
    
    //Ensure bounding box computed
    if ( !geometry.boundingBox ) {
        geometry.computeBoundingBox();
    }
    
    var i, width, height, depth, vertices, face, triangles=[], points=[];
    
    //Build shape-specific vars:
    if(mesh_shape == "plane"){
        width = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
        height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;

        this._physijs.type = 'plane';
        this._physijs.normal = geometry.faces[0].normal.clone();
        this._physijs.mass = (typeof mass === 'undefined') ? width * height : mass;
    } else if(mesh_shape == "box" || mesh_shape=="cube"){
        width = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
        height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
        depth = geometry.boundingBox.max.z - geometry.boundingBox.min.z;

        this._physijs.type = 'box';
        this._physijs.width = width;
        this._physijs.height = height;
        this._physijs.depth = depth;
        this._physijs.mass = (typeof mass === 'undefined') ? width * height * depth : mass;
    
    } else if(mesh_shape == "sphere"){
        this._physijs.type = 'sphere';
        this._physijs.radius = geometry.boundingSphere.radius;
        this._physijs.mass = (typeof mass === 'undefined') ? (4/3) * Math.PI * Math.pow(this._physijs.radius, 3) : mass;
    
    } else if(mesh_shape == "cylinder"){
        width = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
        height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
        depth = geometry.boundingBox.max.z - geometry.boundingBox.min.z;

        this._physijs.type = 'cylinder';
        this._physijs.width = width;
        this._physijs.height = height;
        this._physijs.depth = depth;
        this._physijs.mass = (typeof mass === 'undefined') ? width * height * depth : mass;
    
    } else if(mesh_shape == "capsule"){
        width = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
        height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
        depth = geometry.boundingBox.max.z - geometry.boundingBox.min.z;

        this._physijs.type = 'capsule';
        this._physijs.radius = Math.max(width / 2, depth / 2);
        this._physijs.height = height;
        this._physijs.mass = (typeof mass === 'undefined') ? width * height * depth : mass;
    
    } else if(mesh_shape == "cone"){
        width = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
        height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;

        this._physijs.type = 'cone';
        this._physijs.radius = width / 2;
        this._physijs.height = height;
        this._physijs.mass = (typeof mass === 'undefined') ? width * height : mass;
    
    } else if(mesh_shape == "concave"){
        vertices = geometry.vertices;

        for ( i = 0; i < geometry.faces.length; i++ ) {
            face = geometry.faces[i];
            if ( face instanceof THREE.Face3) {

                triangles.push([
                    { x: vertices[face.a].x, y: vertices[face.a].y, z: vertices[face.a].z },
                    { x: vertices[face.b].x, y: vertices[face.b].y, z: vertices[face.b].z },
                    { x: vertices[face.c].x, y: vertices[face.c].y, z: vertices[face.c].z }
                ]);

            } else if ( face instanceof THREE.Face4 ) {

                triangles.push([
                    { x: vertices[face.a].x, y: vertices[face.a].y, z: vertices[face.a].z },
                    { x: vertices[face.b].x, y: vertices[face.b].y, z: vertices[face.b].z },
                    { x: vertices[face.d].x, y: vertices[face.d].y, z: vertices[face.d].z }
                ]);
                triangles.push([
                    { x: vertices[face.b].x, y: vertices[face.b].y, z: vertices[face.b].z },
                    { x: vertices[face.c].x, y: vertices[face.c].y, z: vertices[face.c].z },
                    { x: vertices[face.d].x, y: vertices[face.d].y, z: vertices[face.d].z }
                ]);

            }
        }

        width = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
        height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
        depth = geometry.boundingBox.max.z - geometry.boundingBox.min.z;

        this._physijs.type = 'concave';
        this._physijs.triangles = triangles;
        this._physijs.mass = (typeof mass === 'undefined') ? width * height * depth : mass;
    
    } else if(mesh_shape == "convex"){
        for ( i = 0; i < geometry.vertices.length; i++ ) {
            points.push({
                x: geometry.vertices[i].x,
                y: geometry.vertices[i].y,
                z: geometry.vertices[i].z
            });
        }


        width = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
        height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
        depth = geometry.boundingBox.max.z - geometry.boundingBox.min.z;

        this._physijs.type = 'convex';
        this._physijs.points = points;
        this._physijs.mass = (typeof mass === 'undefined') ? width * height * depth : mass;
    }
};
SuperMega.Interactable.prototype.animate = function(delta){
    /**
     * Animates the object if applicable
     * @param delta: Time since last frame
     */
    
    if(this.refractory_clock < this.refractory_period && this.regenerates && this.active){
        this.refractory_clock += delta; //Increment by delta
        
        //Reactivate the item when the refractory_clock exceeds the refractory period:
        if(this.refractory_clock >= this.refractory_period){ //Unfade
            this.material.opacity = this.ops.opacity || 1; //Make opaque again
        } 
    }
    
    
    //Fast abort for non-movers!
    if(this.ops.magnitude == 0 && this.ops.rotation_mode == null && this.ops.translation_mode == null){
        return;
    }
    
    //Now deal with motion
        //Save current position:
    var pos_before = this.position.clone();
    
    //Angular_momentum applies to rotation on axis
    if(this.ops.rotation_mode == "continuous" || this.ops.rotation_mode == "oscillating"){
        this.rotateX(this.ops.angular_momentum.x * delta);
        this.rotateY(this.ops.angular_momentum.y * delta);
        this.rotateZ(this.ops.angular_momentum.z * delta);
        //Tell PhysiJS that we're rotating, this allows us to pull on the PhysiJS methods for calculating stuff 
        //this.setAngularVelocity(this.ops.angular_momentum);
    } else {
       //Tell PhysiJS that we're not rotating.
        this.setAngularVelocity(ZERO_EULER);
    }
    
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
        //This needs fixing... how do we do an inclined plane?
        var phase_offset_z = 0;
        if(this.ops.translation.x!=0 && this.ops.translation.z!=0){ //We put Z 90 degrees out of phase with x for a vertical circular
            phase_offset_z = Math.PI/2;
        }    
        this.position.z = this.ops.magnitude * Math.sin(this.amount_moved.z+phase_offset_z) + this.origin.z; //90 degree out of phase too
    }
    //Calculate velocity:
    this.velocity.set((this.position.x - pos_before.x)/delta, (this.position.y - pos_before.y)/delta, (this.position.z - pos_before.z)/delta);
    //Tell Physijs about our linear velocity
    this.setLinearVelocity(this.velocity);
    
    //Update position for physijs, this means PhysiJS won't attempt to move the object for us.
    this.__dirtyPosition = true;
    this.__dirtyRotation = true;
};
SuperMega.Interactable.prototype.get_angular_velocity = function(){
    /**
     * Returns the actual angular velocity (taking into account flags etc)
     * 
     * @return: <THREE.Vector3> The angular velocity (yes it can be more than 2PI for fast spinning things!)
     */
    if(this.ops.rotation_mode == "continuous" || this.ops.rotation_mode == "oscillating"){
        //Need to rotate this by its initial orientation!
        var resolved_angular_momentum = this.ops.angular_momentum.clone().applyEuler(this.ops.orientation);
        return resolved_angular_momentum;
    }
    return ZERO_VECTOR3;
};
SuperMega.Interactable.prototype.velocity_at_point_simplified = function(pos){
    /**
     *  Works out what the velocity (in world vectors) will be at the
     *  point (pos) on the object if contact occurs. Assumes you have already
     *  detected a collision and this has happened now
     *  
     *  @param pos: <THREE.Vector3> in world coordinates of the collision point
     *  
     *  @return velocity: <THREE.Vector3> The velocity of the object (translational velocity + rotational velocity)
     */
    
   /*
    * I've been over complicating this!!
    * 
    * See: http://emweb.unl.edu/NEGAHBAN/EM373/note15/note.htm
    * 
    *  For a rigid body which is rotating about point O, Point A on the same rigid body has:
    *  
    *  Relative position = Ra = A-O //??check this assumption
    *  
    *  Relative velocity of A = Va = w x(cross product) Ra
    *  
    *  Total velocity of point A = Vo_linear + Va
    * 
    */
    //Quick escapes
    if(!pos){
        return this.velocity;
    }
    if(this.ops.angular_momentum.x==0 && this.ops.angular_momentum.y==0 && this.ops.angular_momentum.z==0){
        return this.velocity;
    }
    
    var this_angular_momentum = this.get_angular_velocity(); //Ensures we don't ignore non-rotating items!!
    
    try{
        var rel_pos_collision_point = this.position.clone().sub(pos); //Subtract the origin to get position of contact point relative to origin
        var rel_velocity_collision_point = rel_pos_collision_point.clone().cross(this_angular_momentum); //Cross-product of w x Ra gives the RELATIVE velocity (does this indeed causes a perpendicular shift?? Doesn't seem to!)
        //var world_velocity_collision_point = rel_velocity_collision_point.clone().applyEuler(-this.rotation); //Now rotate the velocity back to world (according to the current orientation of the platform) - flawed logic!!
        var world_velocity_collision_point = rel_velocity_collision_point.add(this.velocity); //Add back in the linear velocity 
        //D("abs_pos_coll_point = "+pos.str());
        //D("rel_pos_coll_point = "+rel_pos_collision_point.str());
        //D("rel_vel_coll_point = "+rel_velocity_collision_point.str());
        //D("world_vel_coll_pnt = "+world_velocity_collision_point.str());
        return world_velocity_collision_point;
    }catch(err){
        throw err;
        console.log("Interactable.velocity_at_point_simplified: Cannot calculate velocity at collision point.");
        return this.velocity; //Get out if fail
    }
    
}
SuperMega.Interactable.prototype.velocity_at_point = function(pos){
    /**
     *  Works out what the velocity (in world vectors) will be at the
     *  point (pos) on the object if contact occurs
     *  
     *  @TODO: Make smarter so it can check if a collision would actually have occurred!!
     *  @TODO: handle rotations in x and y
     *  
     *  @param pos: <THREE.Vector3> in world coordinates of the collision point
     *  
     *  @return velocity: <THREE.Vector3> The velocity of the object (translational velocity + rotational velocity)
     */
    //Turn strike position into correct linear velocity
    if(!pos){ //Get out quick if invalid
        return this.velocity;
    }
    
    
    /*
     * I had a revelation:
     * We don't need to "prove" that you have collided with the object because that's already known.
     * So we don't need to bother working out where a point in space is now versus where it was in
     * time = 0.
     * 
     * Rather, since a collision has happened when we enter this method, we can simply assume that
     * some point somewhere on the object has been hit. And it doesn't matter which precise point
     * was hit, just it's distance of contact point from the axis of rotation which matters!!
     * 
     * Let Sx = distance between collision point (Ax) and (origin axis Ox) = Ax - Ox
     * Let Sy = distance between collision point (Ay) and (origin axis Oy) = Ay - Oy  
     * 
     * VRZx =  (Sy/Sx) * w * sqrt(Sx^2 + Sy^2) / sqrt((Sy/Sx)^2+1)
     * VRZy =  w * sqrt(Sx^2 + Sy^2) / sqrt((Sy/Sx)^2+1) 
     * 
     */
    
    
    var dir,w_xyz, w, wt, Sx, Sy, Sz, r, VRXy=0, VRXz=0, VRYx=0, VRYz=0, VRZx=0, VRZy=0;
    
    //----- Z-axis rotations -----
    
    //Precompute the reusable stuff
    wt = this.rotation.z;
    w_xyz = this.get_angular_velocity();
    if(w_xyz.z==0){ //Bail if not rotating in z plane
        VRZx = 0;
        VRZy = 0;
    } else {
        w = w_xyz.z;
        Sx = pos.x - this.position.x;
        Sy = pos.y - this.position.y;
        var Sy_div_Sx = Sy/Sx;
        D("Sy/Sx: "+Sy_div_Sx);
        var Sy_div_Sx_pow2 = Math.pow(Sy_div_Sx, 2);
        D("(Sy/Sx)^2: "+Sy_div_Sx_pow2);
        var sqrt_Sx2_plus_Sy2 = Math.sqrt(Math.pow(Sx,2) + Math.pow(Sy,2));
        D("_/(Sy^2 + Sx^2): "+sqrt_Sx2_plus_Sy2);
        var inv_sqrt_Sy_div_Sx_pow2_plus_1 = 1/(Math.sqrt(Sy_div_Sx_pow2+1.0));
        D("1/(_/(Sy/Sx)^2+1): "+inv_sqrt_Sy_div_Sx_pow2_plus_1);
        var meat = w * sqrt_Sx2_plus_Sy2 * inv_sqrt_Sy_div_Sx_pow2_plus_1;   
        
        VRZx = Sy_div_Sx * meat;
        VRZy = meat;
    }
    
    
    
    
    
    //-------- Old method ------
    /*
    wt = this.rotation.z;
    w_xyz = this.get_angular_velocity();
    if(w_xyz.z==0){ //Bail if not rotating in z plane
        VRZx = 0;
        VRZy = 0;
    } else {
        w = w_xyz.z;
        Sx = this.position.x - pos.x;
        Sy = this.position.y - pos.y;
        r = Math.sqrt(Math.pow(Sx,2) + Math.pow(Sy,2)); //Expensive
        VRZx = -Sx*w*Math.sin(wt);
        VRZy = Sy*w*Math.cos(wt);
    }
    
    //----- X-axis rotations ----
    wt = this.rotation.x;
    D(wt);
    w_xyz = this.get_angular_velocity();
    if(w_xyz.x==0){ //Bail if not rotating in z plane
        VRXz = 0;
        VRXy = 0;
    } else {
        w = w_xyz.x;
        Sz = this.position.z - pos.z;
        Sy = this.position.y - pos.y;
        D("Sz: "+Sz+" Sy: "+Sy);
        r = Math.sqrt(Math.pow(Sz,2) + Math.pow(Sy,2)); 
        //VRXy = r*w*Math.sin(w);
        //VRXz = -r*w*Math.cos(w);
        VRXy = r*w*Math.sin(w);
        VRXz = -r*w*Math.cos(w);
    }
    
    //----- Y-axis rotations -----
    wt = this.rotation.y;
    w_xyz = this.get_angular_velocity();
    if(w_xyz.y==0){ //Bail if not rotating in z plane
        VRYx = 0;
        VRYz = 0;
    } else {
        w = w_xyz.y;
        Sx = this.position.x - pos.x;
        Sz = this.position.y - pos.z;
        r = Math.sqrt(Math.pow(Sx,2) + Math.pow(Sz,2)); //Expensive
        VRYx = -r*w*Math.sin(w);
        VRYz = r*w*Math.cos(w);
    }
    D("VRXz: "+VRXz+" VRXy: "+VRXy);
    
    */
    
    //Now add the linear velocity from rotation onto the platform's existing linear velocity:
    var Vx = this.velocity.x + VRYx + VRZx;
    var Vy = this.velocity.y + VRXy + VRZy;
    var Vz = this.velocity.z + VRXz + VRYz;
    var vout = new THREE.Vector3(Vx,Vy,Vz);
    D("Vpoint: "+vout.str())
    return vout;
};
SuperMega.Interactable.prototype.on_collision = function(level, callback){
    /**
     * Adds a collision listener to the object which will call the callback function
     * with the arguments callback(other_object, relative_velocity, relative_rotation, contact_normal).
     * This adds overhead every single .simulate() call, so don't activate this unless you really 
     * need it!!
     * 
     * @param level: <SuperMega.Level> The level in which our collision happened
     * @param callback: <Function> The function which will be called on collision
     * 
     */
    console.log("Collision event loaded");
    this.addEventListener( 'collision', function( other_object, relative_velocity, relative_rotation, contact_normal ) {
        //Fire our callback if it's a legit function
        try{
            if(typeof callback == "function"){ //A function has been supplied.
                callback(level, other_object, relative_velocity, relative_rotation, contact_normal);
            } else if(typeof callback == "string"){ //Assume we're asking for a method on this
                this[callback](level, other_object, relative_velocity, relative_rotation, contact_normal);
            }
        }catch(err){
            console.log("Collision event callback error:");
            console.log(err);
        }
    });
};
SuperMega.Interactable.prototype.resolve_vector = function(x_or_vector, y, z){
    /**
     * Turns the supplied arguments into a true vector3 for use 
     */
    return SuperMega.resolve_vector(x_or_vector, y, z);
};
SuperMega.Interactable.prototype.orientate = function(x_or_vector, y, z, amount, order){
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
    order = order || "XYZ"
    if(typeof x_or_vector.clone !== "undefined"){ //Has been given a vector to define rotation
        var x_rotation_amt = x_or_vector.x;
        var y_rotation_amt = x_or_vector.y;
        var z_rotation_amt = x_or_vector.z;
        order = x_or_vector.order || order;
    }else if(x_or_vector.constructor === Array){ //Has been given an array to define rotation
        var x_rotation_amt = x_or_vector[0] || 0;
        var y_rotation_amt = x_or_vector[1] || 0;
        var z_rotation_amt = x_or_vector[2] || 0;
        order = x_or_vector[3] || order;
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
    this.rotation.set(x_rotation_amt, y_rotation_amt, z_rotation_amt, order);
    this.__dirtyRotation = true;
    this.geometry.verticesNeedUpdate = true;
    return this;
}
SuperMega.Interactable.prototype.reposition = function(x_or_vector, y, z){
    /**
     * Changes the position of the object to a new position
     * 
     *  @param x,y,z
     *       A single Vector3
     *       or, a triple array
     *       or, x,y,z as separate entities
     *      
     */
	var vector_val = SuperMega.resolve_3d_entity("vector",x_or_vector,y,z);
	D("Position changed to: "+vector_val.str());
	this.position.set(vector_val.x, vector_val.y, vector_val.z);
	this.__dirtyPosition = true;
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
        this.active = false; //Non-regenerating ones always deactivate
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
    options.size = options.size || [10,10,2];
    if(options.preset!=null){
        //Means replace our objects with the present values
        var preset = SuperMega.OBJECT_PRESETS[options.preset] || null;
        if(preset){ //Update our options with values from the preset
            options = $.extend(options, preset);
        }else{
            console.log("WARNING: Preset '"+options.preset+"' is not a known valid preset name!");
        }
    }
    options.geometry = options.geometry || null; //Geometry is now done in the parent Interactables if not supplied
    options.material = options.material || Physijs.createMaterial(
                            new THREE.MeshPhongMaterial( {
                                color: options.color || SuperMega.DEFAULT_COLOURS.platform, 
                                transparent: (options.opacity < 1),
                                opacity: options.opacity,
                            }),
                            options.friction || phys.PLATFORM_STANDARD_FRICTION, // normal friction
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
        
        try{
        	var level_is_loaded = level.loaded
        }catch(err){ //Happens if level not passed in!
        	console.log("Platform.touched() missing level param");
        	var level_is_loaded = false;
        }
        
        //Injure the player (if the level is loaded!):
        if(this.inflicts_damage>0 && level_is_loaded){
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
    options.material = options.material || Physijs.createMaterial(
                            new THREE.MeshPhongMaterial( {
                                color: SuperMega.DEFAULT_COLOURS.trap, //Yellow
                                transparent: false
                            }),
                            .9, // v high friction
                            .2 // low restitution
                        );
    
    //Create the thing:
    SuperMega.Platform.call( this, options ); //Calls platform with already-specified params
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
    this.regenerates = false;
    
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
    
    //Handle the special "noms_required" value which may be NONE
    this.nom_threshold = options.noms_required;
    if(typeof this.nom_threshold === "undefined"){
        this.nom_threshold = options.nom_threshold;
    }
    if(typeof this.nom_threshold === "undefined"){ //Only default to 5 if not provided!
        this.nom_threshold = 5;
        D("No noms required specified!!!")
    }
    
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
    this.collectable = false; //Can't be collected (removed from scene on contact)
    
    //Jubb up the geometry
    this.geometry.dynamic = true; //We're going to dick about with this
    this.geometry.__dirtyVertices = true;
    //   0        1        2         3            4        5        6          7    
    //"leftbacktop", "leftbackbottom","leftfronttop","leftfrontbottom", "rightbackbottom", "rightbacktop", "rightfrontbottom", "rightfronttop"
    
    //End have shadows
    this.castShadow = true;
    this.receiveShadow = false;
    
    //Ends may have zero noms_required, meaning active at start
    if(this.nom_threshold<1){ //Make solid
        this.state = true; //Active
        this.material.opacity = 1;
        this.material.wireframe = false;
        var the_end_container = this; //Allows us to grab this in our loop of daughter meshes.
        $.each(this.contains, function(index, obj){ //Iterate the daughter meshes (cylinder)
            obj.material.opacity = the_end_container.material.opacity;
            obj.material.wireframe = the_end_container.material.wireframe;
            obj.material.needsUpdate;
        });
    }
    
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
            console.log("LEVEL FINISHED!! W00T!!");
            level.completed(player, this); //Run the level complete sequence
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
            D("End still inactive");
        }
        var the_end_container = this; //Allows us to grab this in our loop of daughter meshes.
        $.each(this.contains, function(index, obj){ //Iterate the daughter meshes (cylinder)
            obj.material.opacity = the_end_container.material.opacity;
            obj.material.wireframe = the_end_container.material.wireframe;
            obj.material.needsUpdate;
        });
        D("Player noms: "+player.noms+"/"+this.nom_threshold);
        
        this.material.needsUpdate = true; //Ensures the object is re-rendered
    },
});


/**
 * Switches!!
 * Creates a switch = an object which if touched will alter the state of other things in the level 
 * @param options {
 *         position: <[x,y,z]> or <THREE.Vector3>
 *         initialy_on: <boolean> false (whether this switch is "on" to start with)
 *         target: <SuperMega.Interactable> If this acts upon just one Interactable, you can input it here
 *         targets: [] List of interactables the switch acts on (the targets)
 *         regenerates: <boolean> Whether this regenerates or not
 *         toggle_on: {} The properties set for ALL targets when switch turned on
 *         toggle_off: {} The properties set for ALL targets when switch turned off
 *         target_specific_toggle_on: {} The properties of the targets that get changed when switch is activated (value represent the states of those properties)
 *                     e.g. {
 *                          "bobbing_platform_1" : {"translation":"reciprocating",} //Would alter the platform's motion to a reciprocating motion
 *                     }
 *         target_specific_toggle_off: {} The properties of the targets that get changed when switch is deactivated
 *         affected_by_balls: <boolean> Whether this can be switched by balls or not, default = true
 * }
 * 
 * NB: You can build a more original-like End (i.e. trapezium with a hole in it) by using cgs.js
 * http://evanw.github.io/csg.js/
 */
SuperMega.Switcher = function(options){
    //Sanitise inputs:
    options = options || {};
    options.geometry = new THREE.CylinderGeometry(0,1.7,2.0,8,1); //Cone 0 top, 1.7 bottom, 2.0 height, 8 radial segments
    options.material = Physijs.createMaterial(
        new THREE.MeshPhongMaterial( {
            color: SuperMega.DEFAULT_COLOURS.switcher, //Cyan
        }),
        .8, // high friction
        .4 // low restitution
    );
    options.refractory_period = options.refractory_period || 2.0; //Default 2 second
    options.toggle_on = options.toggle_on || {}; //Toggle on
    options.toggle_off = options.toggle_off || {}; //Toggle off 
    options.target_specific_toggle_on = options.target_specific_toggle_on || {}; //Toggle on
    options.target_specific_toggle_off = options.target_specific_toggle_off || {}; //Toggle off
    if(typeof options.affected_by_balls == "undefined"){
        options.affected_by_balls = true;
    }
    
    //Switches gently spin on Z-axis unless told otherwise
    options.rotation_mode = options.rotation_mode || "continuous";
    options.angular_momentum = options.angular_momentum || [0,DEG90,0,"XYZ"]; //Angular rotation per second (we use y because we've turned it on its end!)
    
    //Create the thing:
    SuperMega.Interactable.call( this, options ); //JS inheritance hack part 1
    this.orientate(DEG90,0,0,"XYZ"); //Sits on its base by default
    
    //Set mandatory behaviours
    this.collectable = false; //Cannot be collected!
    if(typeof options.regenerates == "undefined"){ //Overrides the Interactables behaviour of false
        this.regenerates = true;
    }
    if(this.state){ //Set from options in interactables. If we're active, flip!!
        this.orientate(DEG270,0,0,"XYZ");
    }
    
    //Switches have shadows
    this.castShadow = true;
    this.receiveShadow = false;
    
    //Set targets:
    this.ops.targets = options.targets || [];
    var first_target = options.target || null;
    if(first_target){ //Add this into the top of the targets list:
        this.ops.targets.unshift(first_target);
    }
    //Append our extra properties to ops (this.ops gets created in the super() call)
    this.ops.toggle_on = options.toggle_on;
    this.ops.toggle_off = options.toggle_off;
    this.ops.target_specific_toggle_on = options.target_specific_toggle_on;
    this.ops.target_specific_toggle_off = options.target_specific_toggle_off;
    this.ops.affected_by_balls = options.affected_by_balls;
    
    //Debug
    D(this);
};
SuperMega.Switcher.prototype = Object.assign( Object.create(SuperMega.Interactable.prototype),{
    constructor: SuperMega.Switch
});
SuperMega.Switcher.prototype.collect = function(delta, player, level){
    //Ensures we activate the switch on touching 
    return this.touched(delta,player,level);
};
SuperMega.Switcher.prototype.touched = function(delta,player,level){
    /**
     * Do something when this switch is touched!!
     * Iterates through all targets, and updates their properties accordingly
     */
    level = level || null;
    
    //Bail if the switch ain't active: (animate will return this to normal after the appropriae time)
    if(this.refractory_clock < this.refractory_period || !this.active){
        D("Switch inactive: rc("+this.refractory_clock+") < rp("+this.refractory_period+")");
        return false;
    }

    //Flip the state:
    D("Switch active: targets="+this.ops.targets.toString());
    this.state = !this.state;

    //Now deactivate the item:
    this.refractory_clock = 0;
    
    //Fade until it's regenerated (forever if not regenerating)
    if(this.regenerates){ //Fade
        this.material.transparent = true;
        this.material.opacity = 0.5;
    }else{ //Pseudo-remove from level
        this.material.transparent = true;
        this.material.opacity = 0;
        this.active=false;
    }    
    
    //Apply its action to its targets (iterate through its list of targets)
    var to_apply = this.ops.toggle_off;
    var target_specific_to_apply = this.ops.target_specific_toggle_off;
    if(this.state){ //If we're now active, apply the "on" behaviours
        D("Turning on");
        to_apply = this.ops.toggle_on;
        target_specific_to_apply = this.ops.target_specific_toggle_on;
        this.orientate(DEG270,0,0); //Upside down
    } else {
        D("Turning off");
        this.orientate(DEG90,0,0); //Right way up
    }
    var self = this;
    $.each(self.ops.targets, function(index,target_name){
        //Check that such a named object exists
        var target = level.get_object(target_name); //grabs it from the level
        D("Switcher Looking for '"+target_name+"'");
        D(target);
        if(!target && target_name != "__all__"){ //Bail if no named target matches (can use the all operator
            D(target_name + " not found!");
        	return true; //aka continue 
        };
        
        //Apply the "all objects" self.target_on / self.targed_off
        $.each(to_apply, function(key,value){
            //Key is the target property, value is what we're setting it to:
            if(typeof target.ops[key] != "function"){ //Ensure we don't overwrite a function!
                D("BEFORE SWITCH: "+target_name+".ops."+key+"="+target.ops[key]);
                target.ops[key] = value; //Possible future upgrade: allow calling method target.key() with value as argument
                //Deal with special properties which require special setting
                if(key=="orientation"){target.orientate(value);} //Spin round
                if(key=="position"){target.reposition(value);} //Move to new location
                D("AFTER SWITCH: "+target_name+".ops."+key+"="+target.ops[key]);
            }
        });
        
        //Apply the object-specific properties
        var spec_to_apply = target_specific_to_apply[target_name];
        if(spec_to_apply){
            $.each(spec_to_apply, function(key,value){
                if(typeof target.ops[key] != "function"){
                	D("BEFORE SWITCH: "+target_name+".ops."+key+"="+target.ops[key]);
                    target.ops[key] = value; //Possible future upgrade: allow calling method target.key() with value as argument
                    if(key=="orientation"){target.orientate(value);} //Spin round
                    if(key=="position"){target.reposition(value);} //Move to new location
                    D("AFTER SWITCH: "+target_name+".ops."+key+"="+target.ops[key]);
                }
            });
        }
    });
    
    //Tell everyone what the state is
    return this.state;
};
SuperMega.Switcher.prototype.ball_strike = function(level, other_object, relative_velocity, relative_rotation, contact_normal){
    /**
     * Detects when an object has hit it.  This is set up by Level.init_switchers()
     * NB: there is no guarantee that the striking object is a ball 
     * 
     */
    console.log("Something touched the switch!");
    var self = this;
    //Check this is indeed a ball (should have a supermega_ball_id)
    if(level.balls[other_object.supermega_ball_id]){
        //Yep, it's a ball. Flip the switch!!
        return self.touched(0.01, level.player, level); //No delta in this one!
    }
};
