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
	"end" : 0x8316FF
}


/**
 * Interactable: An object you can play with, which can move
 * 
 * If no geometry and material supplied, creates a transparent container object (cube) which can contain objects inside
 * We do simple cube collision detection against this container object 
 * It gains a load of extra methods to deal with the interaction
 * 
 * @param options: The keywords for creating a supermega item
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
	    "friction" : options.friction || .5,
	    "restitution" : options.friction || .4,
	    "orientation" : options.orientation || new THREE.Vector3(0,0,0),
	    "angular_momentum" : options.angular_momentum || new THREE.Vector3(0,0,0),
	    "translation" : options.translation || new THREE.Vector3(0,0,0),
	    "rotation_mode" : options.rotation_mode || null,
	    "translation_mode" : options.translation_mode || null,
	    "magnitude" : options.magnitude || 0,
	    "scene" : options.scene || null //Can pass the scene in for manipulating pickups
    };
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
    this.orientation = this.orientate(ops.orientation);
    
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
    options = options || {};
    //Fix the geometry etc
    options.geometry = options.geometry || new THREE.CubeGeometry(10, 10, 2);
    options.material = options.material || Physijs.createMaterial(
                            new THREE.MeshPhongMaterial( {
                                color: SuperMega.DEFAULT_COLOURS.platform, //Yellow
                                transparent: false
                            }),
                            .5, // normal friction
                            .4 // lowish restitution
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
    options.geometry = new THREE.SphereGeometry(2, 64, 64);
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
		player.powerUp(1); //Returns true if player has more power headroom
		player.heal(100); //Ensure player gets their health up
	    }
    }
});



