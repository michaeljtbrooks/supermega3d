'use strict';

/**
 * WebGL Ball Game Client
 *
 * @author Kevin Fitzgerald / @kftzg / http://kevinfitzgerald.net
 * @author Dr Michael Brooks / @michaeljtbrooks
 * Last Updated: 2017-06-04 19:59 UTC 
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
 * 
 * 
 * Edit the var level_number to explore levels 1-4!
 * 
 */
var level_number = 4; //What level to start on (overridden by Sandbox if on. 1 to 4)

var DEBUG = true; //Debug mode
var level; //Where we'll store our level
var sandbox = false; //Whether to build our debug environment instead of levels


//Add in smart print declaration of values to Vector3
THREE.Vector3.prototype.str = function(){
    return "x:"+this.x.toFixed(3)+", y:"+this.y.toFixed(3)+", z:"+this.z.toFixed(3);
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
    return "x:"+this.x.toFixed(3)+", y:"+this.y.toFixed(3)+", z:"+this.z.toFixed(3);
}


// Set physijs's Web Worker script path
Physijs.scripts.worker = 'js/libs/physijs_worker-r85.js';

// Use Detector.js to display the "womp womp" screen if browser sux
if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

// *********************************************************************************************************************
// ***** GLOBAL VARS ***************************************************************************************************
// *********************************************************************************************************************

var DEG5 = Math.PI/36;
var DEG10 = Math.PI/18;
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

var level_contents = {
        1:{ //Our first level
            "platforms" : [
                {"size":[10,30,2], "position":[0,10,-5]}, //Flat start
                {"size":[10,20,2], "position":[0,33,-0.5], "orientation":[DEG30,0,0]}, //Ramp up
                {"size":[3,3,10], "position":[-10,15,-0.5], "orientation":[0,0,0], "translation":[10,5,0], "translation_mode":"reciprocating", "magnitude":20}, //Moving pillar
                {"size":[20,10,2], "position":[5,46.5,4.5], "orientation":[0,0,0]}, //Higher horizontal
                {"size":[10,10,2], "position":[30,46.5,-0.5], "orientation":[0,0,0], "translation":[0,0,10], "translation_mode":"reciprocating", "magnitude":50}, //Vertical lift
                {"size":[20,10,2], "position":[5,46.5,40], "orientation":[0,0,0]}, //Upper storey horizontal
                {"size":[10,10,2], "position":[-10,56.5,40], "orientation":[0,0,0], "translation":[0,-10,0], "translation_mode":"reciprocating", "magnitude":20}, //Upper storey sideways moving platform
                {"size":[10,10,2], "position":[-20,36.5,40], "orientation":[0,0,0], "translation":[0,10,0], "translation_mode":"reciprocating", "magnitude":20}, //Upper storey sideways moving platform #2
                {"size":[40,10,2], "position":[-50,46.5,40], "orientation":[0,0,0]}, //Upper storey horizontal to end
            ],
            "traps" : [
                {"size":[10,10,2], "position":[20,46.5,4.5], "orientation":[0,0,0]}
            ],
            "noms" : [
                {"position":[-10,56.5,42]}, //Nom on upper platform sideways mover #1 
                {"position":[-20,36.5,42]} //Nom on upper platform sideways  mover #2
            ],
            "powerups" : [
                {"position":[-9.0,15.5,6.0]} //Can only get this by standing on pillar! 
            ],
            "ends" : [
                {"position":[-68,46.5,42], "orientation":[0,0,DEG90], "noms_required":2}, //The end  
            ],
            "start_position": new THREE.Vector3(0,0,2), //Where player starts
            "start_orientation" : new THREE.Euler(0,0,Math.PI) //Turn around!!
        },
        
        2:{ //Level 2 = ice bridge
            "platforms" : [
                {"size":[10,10,2], "position":[0,0,1]}, //Flat start
                {"size":[10,100,2], "position":[0,55,1], "preset":"ice_platform"}, //Long central ice platform
                {"size":[7,7,2], "position":[-15,20,1]}, //Flanker L1
                {"size":[7,7,2], "position":[-15,60,1]}, //Flanker L2
                {"size":[7,7,2], "position":[-15,100,1]}, //Flanker L3
                {"size":[7,7,2], "position":[15,40,1]}, //Flanker R1
                {"size":[7,7,2], "position":[15,80,1]}, //Flanker R2
                {"size":[10,10,2], "position":[0,129,1]}, //Flat start
            ],
            "traps" : [
                {"size":[4,4,10], "position":[0,40,7], "orientation":[0,0,0], "translation":[Math.PI/3,Math.PI/3,0], "translation_mode":"orbiting", "magnitude":20}, //Moving pillar 1
                {"size":[4,4,10], "position":[0,80,7], "orientation":[0,0,0], "translation":[-Math.PI/3,-Math.PI/3,0], "translation_mode":"orbiting", "magnitude":20} //Moving pillar 2
            ],
            "noms" : [
                {"position":[15,40,4]}, // On flanker R1
                {"position":[15,80,4]}, // On flanker R2
                {"position":[-15,60,4]}, // On flanker L2
            ],
            "powerups" : [
                {"position":[-15,20,4]}, // On flanker L1
                {"position":[-15,100,4]} // On flanker L2
            ],
            "ends" : [
                {"position":[0,130,3.5], "orientation":[0,0,0], "noms_required":3}, //The end  
            ],
            "start_position": new THREE.Vector3(0,0,6), //Where player starts
            "start_orientation" : new THREE.Euler(0,0,Math.PI) //Turn around!!
        },
        
        //Level 3 is defined below (has some randomisation on each run
        
        4:{ //Level 4 = Castle Park. A central castle tower with castle gardens 
            "terrain":[
                {"width":160, "depth":160, "width_vertices":32, "depth_vertices":32, "multiplier":0.25, "subtractor":0}
            ],
            "platforms":[
                {"size":[3,160,14], "position":[-80,0,-2], "colour":0xE0B5A8, "transparent":true, "opacity":0.4}, //Wall1
                {"size":[3,160,14], "position":[80,0,-2], "colour":0xE0B5A8, "transparent":true, "opacity":0.4}, //Wall2
                {"size":[160,3,14], "position":[0,-80,-2], "colour":0xE0B5A8, "transparent":true, "opacity":0.4}, //Wall3
                {"size":[160,3,14], "position":[0,80,-2], "colour":0xE0B5A8, "transparent":true, "opacity":0.4}, //Wall4
                {"size":[3,160,14], "position":[-80,0,12], "colour":0xEBAED3, "transparent":true, "opacity":0.4}, //Wall1 top
                {"size":[3,160,14], "position":[80,0,12], "colour":0xEBAED3, "transparent":true, "opacity":0.4}, //Wall2 top
                {"size":[160,3,14], "position":[0,-80,12], "colour":0xEBAED3, "transparent":true, "opacity":0.4}, //Wall3 top
                {"size":[160,3,14], "position":[0,80,12], "colour":0xEBAED3, "transparent":true, "opacity":0.4}, //Wall4 top
                //Central tower
                {"mesh_shape":"cylinder", "size":[30,30,150], "colour":0xF0F0E0, "position":[0,0,67], "orientation":[DEG90,0,0]}, //Big F/O cylinder
                {"mesh_shape":"cylinder", "size":[38,38,3], "position":[0,0,148], "orientation":[DEG90,0,0]},  //Big F/O cylinder topper
                //Ground orbiter cw
                {"size":[16,16,4], "position":[0,0,-3], "orientation":[0,0,0], "translation":[1,1,0], "translation_mode":"orbiting", "magnitude":41, "colour": 0xAA8833}, //First moving platform
                //Orbiter acw
                {"size":[12,12,4], "position":[0,0,3], "orientation":[0,0,DEG45], "translation":[-1.2,-1.2,0], "translation_mode":"orbiting", "magnitude":38, "colour": 0xAA8833},
                //Solitary stable platform floor 2
                {"size":[20,20,2], "position":[-50,50,10], "orientation":[0,0,DEG45]},
                //Slope to floor 3
                {"size":[8,20,2], "position":[-32,26,16], "orientation":[-DEG45/2,0,DEG45,"ZXY"]},
                //Floor 3 spokes
                {"size":[12,12,2], "position":[Math.sin(0)*35,Math.cos(0)*35,19], "orientation":[0,0,-0,"ZXY"]},
                {"size":[12,12,2], "position":[Math.sin(DEG45)*35,Math.cos(DEG45)*35,19], "orientation":[0,0,-DEG45,"ZXY"]},
                {"size":[12,12,2], "position":[Math.sin(DEG90)*35,Math.cos(DEG90)*35,19], "orientation":[0,0,-DEG90,"ZXY"]},
                {"size":[12,12,2], "position":[Math.sin(DEG135)*35,Math.cos(DEG135)*35,19], "orientation":[0,0,-DEG135,"ZXY"]},
                {"size":[12,12,2], "position":[Math.sin(DEG180)*35,Math.cos(DEG180)*35,19], "orientation":[0,0,-DEG180,"ZXY"]},
                //Step up to floor 4
                {"size":[10,24,2], "position":[Math.sin(DEG180+DEG15)*40,Math.cos(DEG180+DEG15)*40,25], "orientation":[0,0,-(DEG180+DEG15),"ZXY"]},
                //Floor 4 - Bobbing platforms:
                {"size":[8,10,2], "position":[-18.0,-72, 22], "translation":[0,0,15], "translation_mode":"reciprocating", "magnitude":15, "colour": 0xAA8833},
                {"size":[8,10,2], "position":[-35.0,-72, 22], "translation":[0,0,10], "translation_mode":"reciprocating", "magnitude":15, "colour": 0xAA8833},
                {"size":[10,15,2], "position":[-52.0,-69, 29], "translation":[0,15,5], "translation_mode":"reciprocating", "magnitude":30, "colour": 0xAA8833}, //Diagonal slider
                //Floor 5 mini-tower breather with switch to activate shortcut lift
                {"mesh_shape":"cylinder","size":[4,4,45],"position":[-52,-12,15],"colour":0xF0F0E0,  "orientation":[DEG90,0,0]}, //Shaft
                {"mesh_shape":"cylinder","size":[14,14,2],"position":[-52,-12,38], "orientation":[DEG90,0,0]}, //Lid
                {"mesh_shape":"cylinder","size":[6,6,2],"position":[-52,-12,31], "orientation":[DEG90,0,0]}, //Hidden Lid
                {"size":[16,3,2], "position":[-45,-12,31]}, //Platform to hidden power up platform underneath the smaller tower lid
                //Floor 2 > Floor 5 shortcut lift
                {"name":"two_to_five_shortcut_lift", "size":[8,8,2], "position":[-63,63,9], "orientation":[0,0,DEG45], "translation":[-4,-20,10], "translation_mode":"switched_off_reciprocating", "magnitude":80, "colour": 0xAA8833}, //Diagonal slider
                //Floor 5 bracket-fungus like stairs to floor 6
                {"mesh_shape":"cylinder","segments":[10,1],"size":[5,5,2],"position":[-26,-12,37], "orientation":[DEG90,0,0]}, //Bracket 1
                {"mesh_shape":"cylinder","segments":[10,1],"size":[5,5,2],"position":[Math.sin(DEG225-DEG5)*28.5,Math.cos(DEG225-DEG5)*28.5,41], "orientation":[DEG90,0,0]}, //Bracket 2
                {"mesh_shape":"cylinder","segments":[10,1],"size":[5,5,2],"position":[Math.sin(DEG180+DEG10)*31,Math.cos(DEG180+DEG10)*31,45], "orientation":[DEG90,0,0], "translation":[2,3.5,0], "translation_mode":"reciprocating", "magnitude":8, "colour": 0xAA8833}, //Bracket 3
                {"mesh_shape":"cylinder","segments":[10,1],"size":[5,5,2],"position":[Math.sin(DEG225-DEG10)*28.5,Math.cos(DEG225-DEG10)*28.5,53], "orientation":[DEG90,0,0]}, //Bracket 3a (hidden one with power up)
                {"mesh_shape":"cylinder","segments":[10,1],"size":[5,5,2],"position":[Math.sin(DEG225+DEG10)*27,Math.cos(DEG225+DEG10)*27,61], "orientation":[DEG90,0,0], "colour": 0xF0F0E0}, //Bracket 3b (hidden WHITE one)
                {"mesh_shape":"cylinder","segments":[10,1],"size":[5,5,2],"position":[Math.sin(DEG180-DEG10)*28.5,Math.cos(DEG180-DEG10)*28.5,49], "orientation":[DEG90,0,0]}, //Bracket 4
                //Floor 6 
                {"size":[16,8,2], "position":[31,-31,50]}, //Rest 
                {"size":[2,48,2], "position":[40,-11,50], "preset":"ice_platform"}, //Ice bar 1
                {"size":[12,12,2], "position":[40,33,51], "preset":"ice_platform"}, //Ice rest between bars
                {"size":[48,2,2], "position":[20,39,57], "preset":"ice_platform", "orientation":[0,DEG15,0]}, //Ice bar 2, ramping up
                
            ],
            "traps":[
                //Anti-climb paint
                {"size":[3,160,1], "position":[-80,0,19.5]}, //Wall1
                {"size":[3,160,1], "position":[80,0,19.5]}, //Wall2
                {"size":[160,3,1], "position":[0,-80,19.5]}, //Wall3
                {"size":[160,3,1], "position":[0,80,19.5]}, //Wall4
                //Spinning jump bar floor 3
                {"size":[80,2,4], "position":[0,0,22], "angular_momentum":[0,0,DEG45], "rotation_mode":"continuous"},
                //Floor 4 - fence between bobbing platforms 1 and 2
                {"size":[2,12,4], "position":[-25.5, -72, 29]},
                //Floor 4 - moving fence between bobbing platforms 2 and 3
                {"size":[2,8,4], "position":[-43,-57,32],"translation_mode":"orbiting", "translation":[0,2,2], "magnitude":8},
                //Floor 6 ice bar 1: orbiting around middle
                {"name":"trap_ice_bar_slider1", "size":[2,2,6],"position":[38,-19,54],"translation_mode":"reciprocating","translation":[6,0,0], "magnitude":6},
                {"name":"trap_ice_bar_orbiter", "size":[5,2,5],"position":[40,-11,50],"translation_mode":"orbiting","translation":[2,0,2], "magnitude":5},
                {"name":"trap_ice_bar_slider2", "size":[2,2,6],"position":[43,5,54],"translation_mode":"reciprocating","translation":[-6,0,0], "magnitude":6},
                //Barrel rolling down ice bar 2:
                {"name":"trap_ice_bar2_barrel", "mesh_type":"cylinder", "size":[1,1,3],"position":[-3,39,65],"translation_mode":"reciprocating","translation":[15.455,0,-4.141], "magnitude":38},
            ],
            "noms":[
                {"position":[0,0,5.5], "translation":[-1.2,-1.2,0], "translation_mode":"orbiting", "magnitude":35}, //Sits on first floor acw
                {"position":[Math.sin(DEG180)*35,Math.cos(DEG180)*35,22]}, //On the last Floor 3 spoke
                {"position":[-39,-12,32.5]}, //Sitting on the hidden bar under the small tower
                {"position":[26,-31,52.5]}, //Sitting on the hidden bar under the small tower
            ],
            "powerups":[
                {"position":[-55,55,13]}, //On the static breather platform floor 2
                {"position":[-57.5,-12,34]}, //Hidden on ledge under smaller tower
                {"position":[Math.sin(DEG225-DEG10)*31.5,Math.cos(DEG225-DEG10)*31.5,55.5]}, //Hidden on ledge under smaller tower
            ],
            "switchers":[ //Switches are known as "switcheRs". They need a target and a toggle_on and toggle_off action
                { //Floor-5 mini tower, activates the shortcut lift
                    "position":[-58,-12,42], "target":"two_to_five_shortcut_lift",
                    "toggle_on": {"translation_mode":"reciprocating"},
                    "toggle_off": {"translation_mode":"switched_off_reciprocating"},
                },
                { //Floor-6 rest ice platform after the bar
                    "position":[44,36,53.5], "targets": ["trap_ice_bar_slider1", "trap_ice_bar_slider2", "trap_ice_bar_orbiter"],
                    "toggle_on": {"translation_mode":"switched_off"}, //Applies to all
                    "target_specific_toggle_off": { //The three platforms have different translation modes when turned back on
                        "trap_ice_bar_slider1": {"translation_mode":"reciprocating"},
                        "trap_ice_bar_orbiter": {"translation_mode":"orbiting"},
                        "trap_ice_bar_slider2": {"translation_mode":"reciprocating"},
                     },
                },
            ],
            "ends":[],
            "world_width":32,
            "world_depth":32,
            "start_position": new THREE.Vector3(40,50,12), //Where player starts
            //"start_position": new THREE.Vector3(44,33,55), //tEST
            "start_orientation" : new THREE.Euler(0,0,-DEG45) //Face the cylinder
        }
        
};

//Level 3 = Tubular hell
/*
 * This is a cracking level. There are four vertical tubes going down to a variable fate
 * (one of two noms, the level end, or a trap). The order of them varies between runs
 * Once down the bottom, you have to work your way back up to the top to try another tube.
 * 
 */
var tubular_hell = {
   "platforms" : [
       {"size":[10,10,2], "position":[0,0,109]}, //Flat start
       {"size":[4,50,2], "position":[-6,25,109]}, //Left side strip
       {"size":[4,50,2], "position":[6,25,109]}, //Right side strip
       //Tube 1
       {"size":[2,10,80], "position":[-4,10,70]}, //1L
       {"size":[2,10,80], "position":[4,10,70]}, //1R
       {"size":[10,2,80], "position":[0,6,70]}, //1B
       {"size":[10,4,80], "position":[0,15,70]}, //1F
       //Tube 2
       {"size":[2,10,80], "position":[-4,20,70]}, //2L
       {"size":[2,10,80], "position":[4,20,70]}, //2R
       {"size":[10,4,80], "position":[0,25,70]}, //2F
       //Tube 3
       {"size":[2,10,80], "position":[-4,30,70]}, //3L
       {"size":[2,10,80], "position":[4,30,70]}, //3R
       {"size":[10,4,80], "position":[0,35,70]}, //3F
       //Tube 4
       {"size":[2,10,80], "position":[-4,40,70]}, //4L
       {"size":[2,10,80], "position":[4,40,70]}, //4R
       {"size":[10,4,80], "position":[0,45,70]}, //4F
       //End platform taking you off to the viewpoint
       {"size":[10,20,2], "position":[0,55,109]}, //Flat top end
       {"size":[10,10,2], "position":[0,80,109], "translation":[15,0,0], "translation_mode":"reciprocating", "magnitude":60, "colour": 0xAA8833}, //Transporter at top end carrying you to the loop da loop lifts
       {"size":[10,40,2], "position":[55,45,109]}, //Boarding strip for the big circular lift
       {"size":[20,10,2], "position":[50,38,59], "translation":[0,0.8,0.8], "translation_mode":"orbiting", "magnitude":48, "colour": 0xAA8833}, //Transporter at top end carrying you to the loop da loop lifts
       
       //Underparts
       {"size":[40,40,2], "position":[-25,25,20]}, //Tube collector plane
       {"size":[60,2,20], "position":[-25,15,30]}, //Separates 1 from 2
       {"size":[60,2,20], "position":[-25,25,30]}, //Separates 2 from 3
       {"size":[60,2,20], "position":[-25,35,30]}, //Separates 3 from 4
       {"size":[2,40,20], "position":[-6,25, 10]}, //Curtain to hide tube ends from collector system
       {"size":[20,50,2], "position":[-55,25,0]}, //Underparts collector
       {"size":[8,8,2], "position":[-50,-5,-4], "orientation":[0,0,0], "translation":[0,0,15], "translation_mode":"reciprocating", "magnitude":150, "colour": 0xAA8833}, //Underparts lift #1
       {"size":[8,8,2], "position":[-60,-5,140], "orientation":[0,0,0], "translation":[0,0,-15], "translation_mode":"reciprocating", "magnitude":150, "colour": 0xAA8833}, //Underparts lift #2
       
       //Lift exit Returner strip to start
       {"size":[40,6,2], "position":[-25,-5,130], "orientation":[0,0,0]}, //Roof strip
       {"size":[2,10,2], "position":[-4,0,130]}, //TL
       {"size":[2,10,2], "position":[4,0,130]}, //TR
       {"size":[10,5,2], "position":[0,-6,130]}, //TB - fatter
       {"size":[10,2,2], "position":[0,4,130]} //TF
       
   ],
   "traps" : [
       {"size":[40,50,2], "position":[-25,25,40]}, //protects tube collector
   ],
   "noms" : [
       {"position":[0,0,132]}, //At the fall back down to start
       {"position":[0,58,112]} //Right at the very end of the level
   ],
   "powerups" : [
   ],
   "ends" : [ //Defined by the random config
   ],
   "start_position": new THREE.Vector3(0,0,115), //Where player starts
   "start_orientation" : new THREE.Euler(0,0,Math.PI), //Turn around!!
   "fog" : { "color" : 0xFFFFFF, "density" : 0.025}, //Thick ExpFog
   "background" : { "color" : 0xFFFFFF} //White clouds
};
var tubular_hell_mode = Math.floor(Math.random()*6); //There are 4 configurations of the variable platforms 
var tubular_variable_configs = [ //A different config for each possible mode!
    { //Mode 0: nom, nom, trap, end
        "platforms":[
             {"size":[6,6,2], "position":[0,10,20]},
             {"size":[6,6,2], "position":[0,20,20]},
             {"size":[6,6,2], "position":[0,40,20]},
        ],
        "traps":[
             {"size":[6,6,2], "position":[0,30,20]},
        ],
        "noms":[
             {"position":[0,10,23]},
             {"position":[0,20,23]},
        ],
        "ends":[
             {"position":[0,40,23], "noms_required":4},
        ],
    },
    { //Mode 1: trap, nom, end, nom
        "platforms":[
             {"size":[6,6,2], "position":[0,20,20]},
             {"size":[6,6,2], "position":[0,30,20]},
             {"size":[6,6,2], "position":[0,40,20]},
        ],
        "traps":[
             {"size":[6,6,2], "position":[0,10,20]},
        ],
        "noms":[
             {"position":[0,20,23]},
             {"position":[0,40,23]},
        ],
        "ends":[
             {"position":[0,30,23], "noms_required":4},
        ],
    },
    { //Mode 2: end (without platform!!), nom, nom, trap
        "platforms":[
             //{"size":[6,6,2], "position":[0,20,20]}, //End has NO PLATFORM (i.e. hit it when active or die!
             {"size":[6,6,2], "position":[0,20,20]},
             {"size":[6,6,2], "position":[0,30,20]},
        ],
        "traps":[
             {"size":[6,6,2], "position":[0,40,20]},
        ],
        "noms":[
             {"position":[0,20,23]},
             {"position":[0,30,23]},
        ],
        "ends":[
             {"position":[0,10,23], "noms_required":4, "orientation":[0,0,DEG45]},
        ],
    },
    { //Mode 3: nom, trap, nom, end
        "platforms":[
             {"size":[6,6,2], "position":[0,10,20]}, //End has NO PLATFORM (i.e. hit it when active or die!
             {"size":[6,6,2], "position":[0,30,20]},
             {"size":[6,6,2], "position":[0,40,20]},
        ],
        "traps":[
             {"size":[6,6,2], "position":[0,20,20]},
        ],
        "noms":[
             {"position":[0,10,23]},
             {"position":[0,30,23]},
        ],
        "ends":[
             {"position":[0,40,23], "noms_required":4},
        ],
    },
    { //Mode 4: nom, trap, nom, end (without platform!)
        "platforms":[
             {"size":[6,6,2], "position":[0,10,20]}, 
             {"size":[6,6,2], "position":[0,30,20]},
             //{"size":[6,6,2], "position":[0,40,20]}, //No platform under end!
        ],
        "traps":[
             {"size":[6,6,2], "position":[0,20,20]},
        ],
        "noms":[
             {"position":[0,10,23]},
             {"position":[0,30,23]},
        ],
        "ends":[
             {"position":[0,40,23], "noms_required":4, "orientation":[0,0,DEG45]},
        ],
    },
    { //Mode 5: end (without platform)+nom, nom, trap, trap
        "platforms":[
             {"size":[6,6,2], "position":[0,20,20]}, 
             //{"size":[6,6,2], "position":[0,30,20]},
             //{"size":[6,6,2], "position":[0,40,20]}, //No platform under end!
        ],
        "traps":[
             {"size":[6,6,2], "position":[0,30,20]},
             {"size":[6,6,2], "position":[0,40,20]},
        ],
        "noms":[
             {"position":[0,10,28]},
             {"position":[0,20,23]},
        ],
        "ends":[
             {"position":[0,10,23], "noms_required":4, "orientation":[0,0,DEG45]},
        ],
    },
]
//Merge in level 3s randomised item positions
$.merge(tubular_hell.platforms, tubular_variable_configs[tubular_hell_mode].platforms); //Add in platforms
$.merge(tubular_hell.traps, tubular_variable_configs[tubular_hell_mode].traps); //Add in traps
$.merge(tubular_hell.noms, tubular_variable_configs[tubular_hell_mode].noms); //Add in ends
$.merge(tubular_hell.ends, tubular_variable_configs[tubular_hell_mode].ends); //Add in ends
level_contents[3] = tubular_hell;



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
        
        if(level){
            level.socket = socket; //Necessary to ensure the level knows its socket
        }
        
    });

    // Update the ball counter hud
    hud.currentBallCount.text(maxBallCount - currentBallCount);
    hud.maxBallCount.text(maxBallCount);

    //
    // SCENE SETUP
    //
    // Scene has to be a Physijs Scene, not a THREE scene so physics work
    scene = new Physijs.Scene({ fixedTimeStep: 1 / 60 });
    level = new SuperMega.Level(scene, 1, {"world_width":worldWidth, "world_depth":worldDepth, "socket":socket}); //Scene now held in level too
    scene.loaded = false;
    level.loaded = false; //Holds off events and collision detection until loaded

    // Physics - set gravity and update listener
    level.scene.setGravity(new THREE.Vector3( 0, 0, -30 ));
    level.scene.addEventListener(
        'update',
        function() {
            level.scene.simulate( undefined, 1 );
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

    // Ambient light is 60%
    ambient = new THREE.AmbientLight( 0x909090, 0.6 );
    level.add(ambient,"lighting","ambient"); //Adds to the level therefore the scene

    // Sun lights (two of them for fun reflective patterns
    // This achieves the appearance/art style I'm going for
    light = new THREE.DirectionalLight( 0xffe0bb, 0.6 );
    light2 = new THREE.DirectionalLight( 0xffe0bb, 0.6 );

    // Moon light to make the "night time" not totally unplayable
    // Stays active during the day too, so essentialyl 3 lights are active
    // during they day cycle
    moon = new THREE.DirectionalLight( 0x999999, 0.2 );

    // Only the main daylight and moon cast shadows
    light.castShadow = true;
    light2.castShadow = false;
    moon.castShadow = true;

    // Update the shadow cameras
    light.shadow.camera.near = -256;
    light.shadow.camera.far = 256;
    light.shadow.camera.left = -128;
    light.shadow.camera.right = 128;
    light.shadow.camera.top = 128;
    light.shadow.camera.bottom = -128;

    moon.shadow.camera.near = -256;
    moon.shadow.camera.far = 256;
    moon.shadow.camera.left = -128;
    moon.shadow.camera.right = 128;
    moon.shadow.camera.top = 128;
    moon.shadow.camera.bottom = -128;

    // Don't show the wire lines of the lights
    // Good for debugging, though (now defaults to absence in r85.2)
    //light.shadowCameraVisible = false;
    //light2.shadowCameraVisible = false;
    //moon.shadowCameraVisible = false;

    // More shadow configs
    light.shadow.bias = .0001;  // 0.0001
    //light.shadowDarkness = 0.25; // 0.5
    //moon.shadowDarkness = 0.2;
    light.shadow.mapSize.width = SHADOW_MAP_WIDTH;
    light.shadow.mapSize.height = SHADOW_MAP_HEIGHT;

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
    level.add( lightRig, "lighting", "rig" );
    level.add( moon, "lighting", "moon" );

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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.soft =  true;
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
        players[data.playerId].nickname = data.nickname;

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
            var sourceName = data.playerSourceId == playerId ? nickname : players[data.playerSourceId].nickname,
                victimName = '';

            // Check if the client is the victim
            if (data.playerId == playerId) {
                // THIS PLAYER IS NOW DEAD
                player.hp = data.newHp;
                victimName = nickname;

                // Show the dead screen
                deadScreen.show();

                // Drop a hilarious dead body clone and hide the original
                dropDeadBody(player);
                player.visible = false;
                player.sprite.visible = false;
                
                // Update victim player sprite (hp changes)
                updatePlayerSprite(data.playerId);
            } else {

                // A REMOTE PLAYER IS DEAD
                players[data.playerId].hp = data.newHp;
                victimName = players[data.playerId].nickname;

                // Drop a hilarious dead body clone and hide the original
                dropDeadBody(players[data.playerId]);
                players[data.playerId].visible = false;
                players[data.playerId].sprite.visible = false;
            }

            // Publish a death notification
            addNotification(sourceName +' killed ' + victimName);

        } else {

            //
            // STILL ALIVE
            //

            // Update the target player's HP
            if (data.playerId == playerId) {
                player.hp = data.newHp;
            } else {
                players[data.playerId].hp = data.newHp;
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
            player.hp = data.hp;
            player.position.x = data.pos.x;
            player.position.y = data.pos.y;
            player.rotation.z = 0;
            initPlayerZ();
            player.__dirtyPosition = true;
            player.__dirtyRotation = true;

            // Show the player model and sprite again (i hide them on death for the bouncy body)
            player.visible = true;
            player.sprite.visible = true;

        } else {
            // REMOTE PLAYER RESPAWN

            // Update HP and position
            players[data.player_id].hp = data.hp;
            updatePlayer(data.player_id, data.pos);

            // Show the player model and sprite again (i hide them on death for the bouncy body)
            players[data.player_id].visible = true;
            players[data.player_id].sprite.visible = false;
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
        var name = data == playerId ? nickname : players[data].nickname;

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
    
    //Player gets created first (this doesn't make a difference to the 
    player = new SuperMega.Player({player_id : data.player.player_id, nickname : nickname}, scene, hud);
    var LOCAL_PLAYER = player; //Just so it's easy to find!
    
    console.log(data);
    var start_position = new THREE.Vector3(0,0,10);
    var start_orientation = new THREE.Euler(0,0,0);
    if(!sandbox){ //We wish to load a level from data
        level.build(level_contents[level_number || 0]); //Load level
        start_position = level.start_position || level_contents[0].start_position || start_position;
        start_orientation = level.start_orientation || level_contents[0].start_orientation || start_orientation;
    }else{
        //Sandbox! 
        /**
         * Build our sandbox level
         */
        
            //
            // WATER
            //
           
            
        // Setup the water material, blue, semi-reflective, semi-transparent
        var planeMaterial = new THREE.MeshPhongMaterial({
            color: 0x4D708A,
            //ambient: 0xAFCADE,
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
        //level.add(water,"liquid_terrain");
        
        
        //Replace with our new Level.add_terrain methods
        console.log(data.water.data);
        level.add_terrain({
            "height_data" : data.water.data, //Mandatory
            "preset" : "water_terrain",
            "width" : data.water.worldWidth,
            "depth" : data.water.worldHeight,
            "width_vertices" : data.water.width,
            "depth_vertices" : data.water.height,
            "multiplier" : data.water.multiplier,
            "subtractor" : data.water.subtractor
        });
    
    
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
        level.add(ground, "terrain");
    
    
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
        level.add(hills, "terrain");
    
    
        
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
        level.add_platform({
    	"translation" : new THREE.Vector3(20,20,0),
    	"translation_mode" : "reciprocating",
    	"magnitude" : 60,
    	"size" : [30,30,100],
    	"position" : "random"
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
            level.add(pup, "interactables");
        }
        
        
        //
        // PLATFORMS AND TRAPS!!!!!
        //
        for(var tp=0; tp<8; tp++) {
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
            all_platforms.push(thing); //Ensures we can collect them
            moving_entities.push(thing); //Ensures they get animated
            level.add(thing, "collidables");
        }
        
        //Add vertical platforms for debugging
        for(var tp=0; tp<4; tp++) {
            level.add_platform({
                "position": level.random_terrain_position(),
                "translation": [0,0,10],
                "translation_mode": "reciprocating",
                "magnitude": 40,
            });
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
            all_interactables.push(nom); //Ensures we can collect them
            moving_entities.push(nom); //Ensures they get animated
            level.add(nom, "interactables");
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
            "nom_threshold" : 1 //For resting
        });
        all_interactables.push(the_end); //Ensures we can touch it
        moving_entities.push(the_end); //Ensures they get animated
        level.add(the_end, "interactables");
        level.the_ends.push(the_end);
        
        
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
                level.add_tree({
                        "position" : {"x":data.trees[i].x, "y":data.trees[i].y, "z":null},
                        "rotation" : {"x":null, "y":null, "z":data.trees[i].rotation}
                });
            }
            
        });
        
        //Compile all collidables
        level.recompile_obstacles();
        all_collidables = $.merge(all_platforms, all_trees);
        
        
        //Now resolve the starting position
        var x_start = data.player.start_pos.x;
        var y_start = data.player.start_pos.y;
        var z_start = level.get_terrain_z(x_start, y_start, false)+3; //Gets the position of the terrain at user's X & Y (false means no liquids)
        start_position = new THREE.Vector3(x_start,y_start,z_start);
        
    }
    
    //
    // PLAYER
    //
    //Player creation and addition to scene has been moved up to before other items created (will this cause Physijs collision to work??
    //player = new SuperMega.Player({player_id : data.player.player_id, nickname : nickname}, scene, hud);
    //var LOCAL_PLAYER = player; //Just so it's easy to find!

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
    level.add( player, "players", player.player_id ); //Player finally added to scene here
    level.player = player; //Special way to keep track of the local player!
    player.on_collision(level, function(){}); //What happens when the player collides with stuff

    // Init the player's sprite
    updatePlayerSprite(playerId);

    // Set initial x/y, given from the server (or level config)
    player.position.x = start_position.x;
    player.position.y = start_position.y;
    player.position.z = start_position.z;
    player.rotation.z = start_orientation.z;
        
    //Start on power 0:
    player.setPower(0);
    


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
        setInterval(function(){level.ball_watcher(socket)}, 500);

        // Watch for changes in player position and send to the server, if dirty
        setInterval(sendPosition, 25);

        // Watch for notifications that need to filter off the screen
        setInterval(cycleNotifications, 3000);


        //
        // THAT'S IT FOR SETUP - THE REST IS AUTONOMOUS
        //

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

    
    // Render the background
    if(level.background_scene){
        renderer.render( level.background_scene, level.background_camera);
    }

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
        level.loaded=true;
    }

    // Frame flags and speeds based on time delta
    var playerMoved = false,
        playerSpeed = isKeyDown(KEYCODE.SHIFT) ? speed * 2 * delta : speed * delta,
        playerAngleSpeed = Math.PI / 2 * (isKeyDown(KEYCODE.SHIFT) ? 2*angleSpeed : angleSpeed) * delta;

    var mu = 0.5; //default friction
    var traction = 1; //Default traction
    
    // Only handle user interactions if player is alive
    if (player.hp > 0) {
	
	//Smart motion with velocity:
        //playerMoved = moveIfInBounds(player.velocity.x*delta, player.velocity.y*delta, player.velocity.z*delta) || playerMoved; //Original motion conditionals
        //mu = moveIfInBounds2(delta); //Improved collision detection. Detects if you have collided with something, if so undoes the movement you just did and resets the velocities to suit. Returns the friction coefficient of what you are standing on!
        mu = player.move_according_to_velocity2(delta, level); //Try out our new player object method...
    	
        
        //Fallen off the world? You're DEAD!!
        if(player.position.z < -50){
            // Show the dead screen
            player.injure(1000);
        }
        
    	playerMoved = player.hasMoved; //Monkey patched property
        if(player.hasMoved){ //Quick detection to ensure we don't touch things until properly init
            player.ready = true;
        }
        
        //Calculate traction. This is linked to friction, but capped by your ability to push off,
        if(mu>0.5 || mu < 0.01){ //Keep traction sensible! NB traction = mu*2, thus mu of 0.5 or more gives full traction
            traction = 1;
        } else { 
            traction = mu*2;
        }
	
        // Move forward
        if (
                (player.CAN_ACCELERATE_IN_AIR || player.standing) &&
                ((isKeyDown(KEYCODE.W) && !isKeyDown(KEYCODE.S)) || (isKeyDown(KEYCODE.UP_ARROW) && !isKeyDown(KEYCODE.DOWN_ARROW))) // FIXME: This should do vertical rotation (mouse replacement)
           ){
            //playerMoved = moveIfInBounds(0, -playerSpeed,0) || playerMoved;
            player.velocity.y -= player.state("acceleration") * delta * traction; //v = u + at
        }

        // Move backward
        if (    
                (player.CAN_ACCELERATE_IN_AIR || player.standing) &&
                ((isKeyDown(KEYCODE.S) && !isKeyDown(KEYCODE.W)) || (isKeyDown(KEYCODE.DOWN_ARROW) && !isKeyDown(KEYCODE.UP_ARROW)))
           ) {
            //playerMoved = moveIfInBounds(0, playerSpeed,0) || playerMoved;
            player.velocity.y += player.state("acceleration") * delta * traction;
        }

        // Strafe LEFT
        if ((player.CAN_ACCELERATE_IN_AIR || player.standing) && (isKeyDown(KEYCODE.A) && !isKeyDown(KEYCODE.D))) {
            player.velocity.x += player.state("acceleration") * 0.7 * delta * traction; //Strafing is slower than running
        }

        // Strafe RIGHT
        if ((player.CAN_ACCELERATE_IN_AIR || player.standing) && 
            (isKeyDown(KEYCODE.D) && !isKeyDown(KEYCODE.A))){
            //playerMoved = moveIfInBounds(-playerSpeed, 0,0) || playerMoved;
            player.velocity.x -= player.state("acceleration") * 0.7 * delta * traction;
        }
        
        //Cap out our max velocity (NB: doesn't affect standing_on_velocity!!
        if(player.velocity.x > player.state("top_speed")){player.velocity.x = player.state("top_speed");}
        if(player.velocity.x < -player.state("top_speed")){player.velocity.x = -player.state("top_speed");}
        if(player.velocity.y > player.state("top_speed")){player.velocity.y = player.state("top_speed");}
        if(player.velocity.y < -player.state("top_speed")){player.velocity.y = -player.state("top_speed");}

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
            if((player.velocity.z < 0.5) && (player.velocity.z > -0.5) && !player.isJumping && player.jump_keydown_continuously===false){ //You can only launch off 
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
        if(!isKeyDown(KEYCODE.SPACE)){
            //Means the jump key has been released
            player.jump_keydown_continuously = false; //Turn this off
        }
        
        if(isKeyDown(KEYCODE['0'])){ //Test if position moves player
            var start_pos = level.start_position || new THREE.Vector3(0,0,60);
        	player.position.set(start_pos.x, start_pos.y, start_pos.z);
        	player.rotation.setFromVector3(level.start_orientation || new THREE.Euler(0,0,0));
            player.standing_on_velocity = new THREE.Vector3(0,0,0);
        }
        if(isKeyDown(KEYCODE['9'])){ //Boost up
            player.position.z = 60;
            player.velocity.z = 0;
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
                player.respawn(level);
                level.respawn(); //Rebuilds life-based collectables
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
    level.animate(delta);
    //for(var k=0; k < moving_entities.length; k++){
	//var item = moving_entities[k];
	//item.animate(delta); //Call the method on the entity
    //}
    //for(var k=0; k < all_interactables.length; k++){
	//var item = all_interactables[k];
	//item.animate(delta); //Call the method on the entity
    //}
    
    
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
    
    
    //---- Avoiding camera collision with ground ----
    // Check if there is terrain in the line-of-sight to the player
    //var cameraWorldPos = (new THREE.Vector3()).getPositionFromMatrix(camera.matrixWorld),
        //origin = player.position.clone(),
        //direction = cameraWorldPos.clone().sub(origin),
        //r = new THREE.Raycaster(origin, direction, 0, radius + 1),
        //c = r.intersectObjects([ ground, water, hills ], true);

    // CAMERA-LOS-GROUND-PLAYER collision!
    //if (c.length > 0) {

        // FIXME: Adjust camera position so it does not collide with terrain
        // I tried to move the camera in to the point where the collision occurs,
        // on the same angle as it exists regularly, but things get janky and weird
        // so it's on the list to fix for another day.

        // Point in which the camera LoS intersects the ground mesh
        //var localCamPos = player.worldToLocal(c[0].point) ; //,
            //length = localCamPos.length(),
            //newLength = length - 1,
            //newLocalCamPos = localCamPos.normalize().multiplyScalar(newLength);

        //console.log('in da ground', radius, shortRadius, normalizedCameraPos.length(), currAngle, newAngle/*, c[0].point, player.position.distanceTo(c[0].point)*/);

        //camera.position.copy(c[0].point);
        //camera.position.copy(localCamPos);
        //camera.position.copy(newLocalCamPos);

    //}

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
    if (player.hp > 0) {
        // Throw a ball!
        player.throw_ball(socket,level); //Need to transmit the socket in!
    }
}


// *********************************************************************************************************************
// ***** HELPERS *******************************************************************************************************
// *********************************************************************************************************************


/**
 * Adds a REMOTE player to the world
 * TODO: Convert to using the SuperMega.player object
 * 
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
    player.hp = data.hp;
    player.player_id = data.player_id;
    player.start_pos = data.start_pos;
    player.nickname = data.nickname;
    player.velocity = THREE.Vector3(0,0,0);

    // Listen for collisions with the player to detect when the client player hits the remote player
    player.addEventListener( 'collision', function( other_object, relative_velocity, relative_rotation, contact_normal ) {
        // FYI: `this` has collided with `other_object` with an impact speed of `relative_velocity` and a rotational force of `relative_rotation` and at normal `contact_normal`

        // Only handle collisions for balls the local player fired
        if (other_object.sourcePlayerId == playerId) {

            // Only handle if the remote player is not already dead
            if (player.hp > 0) {

                // Update remote player's hp
                player.hp -= relative_velocity.length();

                // Notify server that the player hit the remote player
                socket.emit('hit', {
                    playerId: player.player_id,
                    playerSourceId: other_object.sourcePlayerId,
                    velocity: relative_velocity.length(),
                    newHp: player.hp
                });

                // Notify that the ball has been removed from the world
                socket.emit('unfire', {
                    playerId: playerId,
                    ballId: other_object.ballId
                });

                // If the player killed the remote player
                if (player.hp <= 0) {

                    // Drop a hilarious boundy dead body
                    dropDeadBody(player);

                    // Hide the normal model
                    player.visible = false;
                    player.sprite.visible = false;

                    // Publish death notification
                    addNotification(window.nickname +' killed ' + player.nickname);
                }

                // Remote the colliding ball from the scene
                deleteBallById(other_object.sourcePlayerId, other_object.ballId);

                // Give the ball back to the player and update the hud
                currentBallCount--;
                player.currentBallCount = (maxBallCount - currentBallCount);

                // Update the remote player's sprite for the HP changes
                updatePlayerSprite(player.player_id);
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
    level.add( player, "players", data.player_id);

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
        level.remove(players[id], "players", id);

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
    //var terrainGeometry = new THREE.Plane3RandGeometry( width, height, worldWidth - 1, worldDepth - 1 ); //Comes from Plane3Geometry.js
    var terrainGeometry = new THREE.Plane3RandGeometry( width, height, worldWidth - 1, worldDepth - 1 ); //Comes from Plane3Geometry.js
    
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
    ball.sourcePlayerId = playerId;
    ball.ballId = ballId;

    // Assign physics collision type and masks, so it collides only with specific things
    ball._physijs.collision_type = CollisionTypes.BALL;
    ball._physijs.collision_masks = CollisionMasks.BALL;

    // Put the ball in the world
    level.add( ball, "debris");

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
    treeContainer.position.set(x, y, zPos);

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
    level.scene.add(treeContainer, "collidables");
    
    //Make a note of our trees:
    all_trees.push(treeBox); //Trunk
    all_trees.push(treeLeafBox); //Leaves
    //Manually add the tree hit boxes for collision testing
    level.collidables.push(treeBox); //Trunk
    level.collidables.push(treeLeafBox); //Leaves
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
    var platformObj = new SuperMega.Platform({
	"material":platformMat,
	"geometry":platformGeo,
	"mass" : 0,
	"position" : new THREE.Vector3(xPos, yPos, zPos),
    	"orientation" : "random"
    });
    

    
    // Add the complete platform  to the scene
    level.add(platformObj, "collidables");
    
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
	platformObj.position.set(xPos,yPos,zPos);
    } else {
	platformObj.position.copy(final_options.position);
    }

    //Set other properties
    platformObj.rotation.setFromVector3(final_options.orientation);
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
    
    level.add(platformObj, "collidables");
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
    var z = level.get_terrain_z(p.position.x, p.position.y, false); //Gets the position of the terrain at user's X & Y
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
        level.remove(balls[i], "debris");
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
        level.remove(balls[key], "debris");
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
            level.remove(balls[i], "debris");
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
        if (p.sprite != null) {
            p.remove(p.sprite);
        }

        // Create a new sprite
        p.sprite = makePlayerSprite(p.nickname, p.hp );

        // Offset the sprite above the player
        p.sprite.position.set(0, 0, 2);

        // Add the sprite to the player
        p.add( p.sprite );

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
    console.log("OBSOLETED!!!! :-[");
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
        var dist_to_hit = p.zCollisionPrediction(all_collidables); //Determine when we're gonna hit something. dist_to_hit.shortest is infinity if no collision imminent
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
        if(p.lastMovementCausesCollision(to_move,0,0,all_collidables)!==false){ //You collided with something in the x direction
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
        if(p.lastMovementCausesCollision(0,to_move,0, all_collidables)!==false){ //Collided in the y direction
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
    //jumpingOrFallingPlayerZ(p); //This will soon be replaced by our clever vertical rays
    p.adjust_to_stand_on_terrain([ground, hills]); //Player intrinsic method
    
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
    
    //If the player already has a body, then bail
    if(targetPlayer.body){
        return targetPlayer.body;
    }
    
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
    targetPlayer.body = body; //Ensures we only have one
    level.add( body, "debris" );
    
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
}


// *********************************************************************************************************************
// ***** RUN TIME ******************************************************************************************************
// *********************************************************************************************************************

// COMMENCE THE FUN
$(document).ready(function() {
    init();
});