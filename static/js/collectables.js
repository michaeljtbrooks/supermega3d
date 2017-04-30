'use strict';

/**
 * Supermega3D
 * 	Collectables and Interactables
 * 	
 * 	These are items you can touch and interact with
 * 
 * @author Dr Michael Brooks / @michaeljtbrooks
 * Last Updated: 2017-04-28 20:12 UTC 
 */


//Namespace
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
     * 	@param x_or_vector: <THREE.Vector3>
     *  @param x_or_vector: Array(<float>,<float>,<float>)
     *  @params x_or_vector: <float>
     *  	y: <float>
     *  	z: <float>
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
 * Level: A wrapper around scene to hold our global objects in
 * 
 * Level.scene:  Our scene
 * Level.scene:  Our clock
 * 
 */
SuperMega.Level = function( scene, level_number ){
    /** Level Constructor
     * @param scene: The Physijs scene we are using
     * @keyword level_number: Will load the specified level number into the scene
     */
    var self=this; //In case I slip into python mode!
    
    //Resolve scene
    scene = scene || null;
    if(scene == null){ //Create new scene
	scene = new Physijs.Scene({ fixedTimeStep: 1 / 120 });
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
    terrain: [], 	//Surface terrain that we can collide with (ground / hills)
    liquid_terrain: [], //Surface we can pass through (but balls cant)
    //The dict items
    lighting: {}, //The lights
    players: {},
    
    //Single properties
    player: null, //The local player object
    nickname: "SuperMega", //The player's name
    
    
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
	if(category_name){
	    var allowed_categories = ["lighting","collidables","interactables","terrain","terrain_liquid"];
	    if(allowed_categories.indexOf(category_name)!=-1){
		var tracker = this[category_name];
		if(typeof tracker.push !== "undefined"){ //It's an array
		    tracker.push(obj); //Add the object to our tracking vars
		} else { //It's a dict
		    if(index_name){ //Add to tracker
			tracker[index_name] = obj;
		    }else{
			console.log("WARNING: '"+category_name+"' is dict-based and requires an index name as well as a category_name. No index_supplied.");
			this.unsorted.push(obj);
		    }
		}
	    }else{
		console.log("WARNING: '"+category_name+"' is not a valid SuperMega scene category name, choose one of: "+allowed_categories.toString());
		this.unsorted.push(obj);
	    }
	}else{
	    console.log("WARNING: item #"+obj.id+" '"+obj.name+"' has not been added to a tracking category.");
	    this.unsorted.push(obj);
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
	 * 	terrain: [
	 * 		{
	 *			data: [<the matrix heights>],
	 *			height: <float>, //max height,
	 *			multiplier: <float>, //?how rugged the terrain is
	 *			subtractor: <float>, //??
	 *			width: <int>, //Terrain width??
	 *			worldHeight: <int>, //World depth terrain is in (front to back)
	 *			worldWidth: <int>, //World width terrain is in (left to right)
	 *		}
	 *	],
	 *	platforms: [ //The platforms
	 *		{ //All params optional
	 *			position: <THREE.Vector3> Where the platform's "origin" is in terms of the scene
	 *			geometry: <THREE.geometry> OR <Array>([<int>,<int>,<int>]) array of sizes,  The geometry object to base this on, (default cube 10x10x2).
         *  	  		material: <Physijs.Material> Material to coat this object with, (default pink Phong)
         *  	  		contains: [<Mesh1>,<Mesh2>] A list of sub objects which will reside inside this
         * 	  		orientation: <THREE.Vector3> The rotational orientation of the object on initialisation.
         *        		angular_momentum: <THREE.Vector3> the rotational movement of the object (Radians per second) 
         * 	  		translation: <THREE.Vector3> the translational movement of the object (units per second)
         * 	  		rotation_mode: <str> "oscillating" | "continuous"
         * 	  		translation_mode: <str> "oscillating" | "continuous" | "orbiting"
         * 	  		magnitude: <float> how long a path is (in units), or how wide (radius) an orbiting path
         * 	  		size: <[array]> Array of sizes x,y,z to make the object
         * 	  		color: <Hex colour> The colour you wish to set it as
         * 	  		friction: <float> how much friction the platform should have
         * 	  		restitution: <float> how stiff it should be on collisions
         * 			preset: <str> A preset to use!
	 *		}
	 *		
	 *	],
	 *	powerups: [ //The powerups
	 *		{
	 *			position: <THREE.Vector3> Where the platform's "origin" is in terms of the scene
	 *			angular_momentum: <THREE.Vector3> the rotational movement of the object (Radians per second) 
         * 	  		translation: <THREE.Vector3> the translational movement of the object (units per second)
         * 	  		rotation_mode: <str> "oscillating" | "continuous"
         * 	  		translation_mode: <str> "oscillating" | "continuous" | "orbiting"
         * 	  		magnitude: <float> how long a path is (in units), or how wide (radius) an orbiting path
         * 		}
	 *	],
	 *	noms: [ //The noms
	 *			position: <THREE.Vector3> Where the platform's "origin" is in terms of the scene
	 *			angular_momentum: <THREE.Vector3> the rotational movement of the object (Radians per second) 
         * 	  		translation: <THREE.Vector3> the translational movement of the object (units per second)
         * 	  		rotation_mode: <str> "oscillating" | "continuous"
         * 	  		translation_mode: <str> "oscillating" | "continuous" | "orbiting"
         * 	  		magnitude: <float> how long a path is (in units), or how wide (radius) an orbiting path
	 *	],
	 *	static_objects: [ //Other arbitrary shit that is solid (like trees)
	 *		{
	 *			position: <THREE.Vector3> Where the platform's "origin" is in terms of the scene
	 *			geometry: <THREE.geometry> OR <Array>([<int>,<int>,<int>]) array of sizes,  The geometry object to base this on, (default cube 10x10x2).
         *  	  		material: <Physijs.Material> Material to coat this object with, (default pink Phong)
         *  	  		contains: [<Mesh1>,<Mesh2>] A list of sub objects which will reside inside this
         * 	  		orientation: <THREE.Vector3> The rotational orientation of the object on initialisation.
         * 	  		size: <[array]> Array of sizes x,y,z to make the object
         * 	  		color: <Hex colour> The colour you wish to set it as
         * 	  		friction: <float> how much friction the object should have
         * 	  		restitution: <float> how stiff it should be on collisions
         * 			load_from: 
         * 			preset: <str> A preset to use! (can include building a bloody tree!
	 *		}
	 *	}
	 *	ends: [ //Level ends
	 *		{
	 *			position: <THREE.Vector3> Where the platform's "origin" is in terms of the scene
         * 	  		orientation: <THREE.Vector3> The rotational orientation of the object on initialisation.
         * 			noms_required: <int> The number of noms required for it to become activated
         * 			preset: <str> A preset to use! (can include building a bloody tree!
	 *		}
	 *	}
	 *
	 * }
	 */
	data.terrain = data.terrain || [];
	data.platforms = data.platforms || []; 
	data.powerups = data.powerups || [];
	data.noms = data.noms || [];
	data.static_objects = data.static_objects || [];
	data.ends = data.ends || [];
    }
    
}); //JS inheritance hack part 2



/**
 * Interactable: An object you can play with, which can move
 * 
 * If no geometry and material supplied, creates a transparent container object (cube) which can contain objects inside
 * We do simple cube collision detection against this container object 
 * It gains a load of extra methods to deal with the interaction
 * 
 * @param options: The keywords for creating a supermega item. all are optional
 *     {
 *  	  geometry: <THREE.geometry> The geometry object to base this on, (default cube)
 *  	  material: <Physijs.Material> Material to coat this object with, (default transparent)
 *  	  contains: [<Mesh1>,<Mesh2>] A list of sub objects which will reside inside this
 * 	  position: <THREE.Vector3> Where the platform's "origin" is in terms of the scene
 * 	  orientation: <THREE.Vector3> The rotational orientation of the object.
 *        angular_momentum: <THREE.Vector3> the rotational movement of the object (Radians per second) 
 * 	  translation: <THREE.Vector3> the translational movement of the object (units per second)
 * 	  rotation_mode: <str> "oscillating" | "continuous"
 * 	  translation_mode: <str> "oscillating" | "continuous" | "orbiting"
 * 	  magnitude: <float> how long a path is (in units), or how wide (radius) an orbiting path
 * 	  size: <[array]> Array of sizes x,y,z to make the object (ignored if geometry set)
 * 	  color: <Hex colour> The colour you wish to set it as (default pinkish red)
 * 	  friction: <float> how much friction the platform should have (default mid .5)
 * 	  restitution: <float> how stiff it should be on collisions (default low-mid .4)
 * 	  preset: <str> replaces any of the above values with a defined preset dict (e.g. useful for ice platforms)
 *     }
 * 
 * Internal properties:
 * 	this.geometry
 *	this.material
 *	this.mass
 *	this.ops	A copy of the input options
 *	this.position	Where it is in space
 *	this.orientation
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
	    "scene" : options.scene || null, //Can pass the scene in for manipulating pickups
	    "preset" : options.preset || null //Can pass the scene in for manipulating pickups
    };
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
    if(ops.contains==null){
	for(var i=0; i<ops.contains.length; i++){
	    var obj = ops.contains[i]; 
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
     *   	A single Vector3
     *   	or, a triple array
     *   	or, x,y,z as separate entities
     *   	or "random" for a random rotation
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

SuperMega.Interactable.prototype.pickup = function(delta, player, scene){
    /**
     * "Collects" this object if it is collectable. Will start it regenerating if regeneratable
     * @param delta: The time since last frame
     * @param player: The player who is collecting this
     * @keyword scene: The scene we are operating in (for removing when collected) if not passed in via options
     */
    
    if(!this.is_collectable()){
	return false;
    }
    
    scene = scene || null;
    
    //Now deactivate the item:
    this.refractory_clock = 0;
    
    //If scene provided, remove from scene or fade depending on mode:
    if(this.regenerates){ //Fade
	this.material.transparent = true;
	this.material.opacity = 0.5;
    } else { //Does NOT regenerate, ttfo
	if(scene){ //Remove from scene
	    scene.remove(this);
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

SuperMega.Interactable.prototype.collect = function(delta, player, scene){
    /**
     * Alias to ensure collect() works consistently
     * @param delta: The time since last frame
     * @param player: The player who is collecting this
     * @keyword scene: The scene we are operating in (for removing when collected) if not passed in via options
     */
    return this.pickup(delta, player,scene);
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
    touched : function(delta, player, scene){
	    /**
	     * Injures the player
	     * @param delta: The time since last frame
	     * @param player: The player who is collecting this
	     * @keyword scene: The scene we are operating in (for removing when collected) if not passed in via options
	     */
	    scene = scene || this.ops.scene || null;
	    
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
    collect : function(delta, player, scene){
	    /**
	     * "Collects" this item
	     * @param delta: The time since last frame
	     * @param player: The player who is collecting this
	     * @keyword scene: The scene we are operating in (for removing when collected) if not passed in via options
	     */
	    scene = scene || this.ops.scene || null;
	    
	    //Power up the player:
	    if(this.is_collectable()){ //Means the thing can be picked up 
		//this.active=false;
    		//Pick up the item (remove from scene):
    		this.pickup(delta, player, scene);
		player.power_up(1); //Returns true if player has more power headroom
		player.heal(100); //Ensure player gets their health up
	    }
    }
});


/**
 * Creates a Nom (a collectable)
 * 	Player needs to collect a certain number of noms in order to activate the end
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
    collect : function(delta, player, scene){
	    /**
	     * "Collects" this item
	     * @param delta: The time since last frame
	     * @param player: The player who is collecting this
	     * @keyword scene: The scene we are operating in (for removing when collected) if not passed in via options
	     */
	    scene = scene || this.ops.scene || null;
	    
	    //+1 to the nom
	    if(this.is_collectable()){ //Means the thing can be picked up 
		//this.active=false;
		//Pick up the item (remove from scene):
		this.pickup(delta, player, scene);
		player.get_nom(1); //+1 to noms
	    }
    }
});



/**
 * Creates the The End target of a level
 * @param options
 */
SuperMega.TheEnd = function(options){
    options = options || {};
    this.nom_threshold = options.nom_threshold || 5; //Default 5 noms
    
    //Fix the geometry etc
    options.geometry = new THREE.CubeGeometry(4, 2, 2); //A flat large thing on its side
    options.material = Physijs.createMaterial(
                            new THREE.MeshPhongMaterial( {
                                color: SuperMega.DEFAULT_COLOURS.the_end, //Purple
                                transparent: true,
                                opacity: 0.4 //Starts deactivated
                            }),
                            .95, // v high friction
                            .4 // low restitution
                        );
    //Create the thing:
    SuperMega.Interactable.call( this, options ); //JS inheritance hack part 1
    this.collectable = false; //Can't be collected (removed from scene)
    
    //Jubb up the geometry
    this.geometry.dynamic = true; //We're going to dick about with this
    this.geometry.__dirtyVertices = true;
    //   0		1		2		 3			4		5		6		  7	
    //"leftbacktop", "leftbackbottom","leftfronttop","leftfrontbottom", "rightbackbottom", "rightbacktop", "rightfrontbottom", "rightfronttop"
    console.log("The End");
    console.log(this);
    this.geometry.vertices[0].x = 1.5; //Left back top
    this.geometry.vertices[2].x = 1.5; //Left front top
    this.geometry.vertices[5].x = -1.5; //Right back top
    this.geometry.vertices[7].x = -1.5; //Right front top
    
    
    //End have shadows
    this.castShadow = true;
    this.receiveShadow = false;
}
SuperMega.TheEnd.prototype = Object.assign( Object.create(SuperMega.Interactable.prototype), {
    constructor: SuperMega.TheEnd,
    touched : function(delta, player, scene){
	    /**
	     * Called when you collide with the END
	     * @param delta: The time since last frame
	     * @param player: The player who is collecting this
	     * @keyword scene: The scene we are operating in (for removing when collected) if not passed in via options
	     */
	    scene = scene || this.ops.scene || null;
	    
	    //Call the end if done
	    if(player.noms >= this.nom_threshold){ //Means it's active 
		//TODO: Level End routine
	    }
    },
    update_state : function(player, scene){
	    /**
	     * Should be called whenever you collect a nom to update the state
	     * @param delta: The time since last frame
	     * @param player: The player who is collecting this
	     * @keyword scene: The scene we are operating in (for removing when collected) if not passed in via options
	     */
	    scene = scene || this.ops.scene || null;
	    //Call the end if done
	    if(player.noms >= this.nom_threshold){ //Means it's active 
		this.state = true; //Active
		this.material.opacity = 1;
	    }else{
		this.state = false; //Inactive
		this.material.opacity = 0.4;
	    }
    },
});