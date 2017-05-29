
/**
 * @author Kevin Fitzgerald / @kftzg / http://kevinfitzgerald.net
 * Git: https://github.com/kfitzgerald/webgl-ball-game
 * based on http://threejsdoc.appspot.com/doc/three.js/src.source/extras/geometries/PlaneGeometry.js.html by mr.doob / http://mrdoob.com/
 * which is based on http://papervision3d.googlecode.com/svn/trunk/as3/trunk/src/org/papervision3d/objects/primitives/Plane.as
 */

// Copyright 2013 Kevin Fitzgerald
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

THREE.Geometry.prototype.computeCentroids = function(mesh){
    /**
     * Replacing the computeCentroids function which was removed in r68
     * see: https://stackoverflow.com/questions/25267003/three-js-r68-cant-get-centroids-of-geometries-using-objmtlloader
     * 
     * @param mesh: <THREE.Mesh> If supplied will provide centroids in terms of the world
     * 
     * @return: <THREE.Vector3> Centroids
     */
    mesh = mesh || false;
    
    this.computeBoundingBox();
    var centroid = new THREE.Vector3();
    centroid.addVectors( this.boundingBox.min, this.boundingBox.max );
    centroid.multiplyScalar( -0.5 );
    
    //If mesh supplied, convert to world coordinates
    if(mesh){
        centroid.applyMatrix4(mesh.matrixWorld);
    }
    
    //Store in object
    this.centroid = centroid;
    return centroid;
}


THREE.Plane3RandGeometry = function ( width, height, widthSegments, heightSegments ) {
    /*
     * Plane 3RandGeometry
     * 
     * Generates a randomised heightmap
     * 
     * @param width: the heightmap width
     * @param height: the heightmap depth
     * @param widthSegments: the number of segments along the width (n vertices - 1)
     * @param heightSegments: the number of segments along the depth (n vertices - 1)
     */

    THREE.Geometry.call( this );
    
    //Hold the creation settings in a var as we'll need these to fast-search vertices
    this.creation_settings = {
            "width" : width,
            "height" : height,
            "depth" : height, //Alias
            "widthSegments" : widthSegments,
            "heightSegments" : heightSegments,
            "width_segments" : widthSegments,
            "height_segments" : heightSegments,
            "x_spacing" : width/widthSegments,
            "y_spacing" : height/heightSegments,
    };

    var ix, iz,
        width_half = width / 2,
        height_half = height / 2,
        gridX = widthSegments || 1,
        gridZ = heightSegments || 1,
        gridX1 = gridX + 1,
        gridZ1 = gridZ + 1,
        segment_width = width / gridX,
        segment_height = height / gridZ,
        normal = new THREE.Vector3( 0, 0, 1 );

    for ( iz = 0; iz < gridZ1; iz ++ ) {

        for ( ix = 0; ix < gridX1; ix ++ ) {

            var x = ix * segment_width - width_half;
            var y = iz * segment_height - height_half;

            this.vertices.push( new THREE.Vector3( x, - y, 0 ) ); //Why minus y? 
        }

    }

    for ( iz = 0; iz < gridZ; iz ++ ) {

        for ( ix = 0; ix < gridX; ix ++ ) {

            var a = ix + gridX1 * iz;
            var b = ix + gridX1 * ( iz + 1 );
            var c = ( ix + 1 ) + gridX1 * ( iz + 1 );
            var d = ( ix + 1 ) + gridX1 * iz;

            var rnd = (iz + ix) % 2;
            if (rnd < 0.50)	 {
                var face = new THREE.Face3( a, b, c );
                face.normal.copy( normal );
                face.vertexNormals.push( normal.clone(), normal.clone(), normal.clone() );
                this.faces.push( face );

                var face2 = new THREE.Face3( c, d, a );
                face2.normal.copy( normal );
                face2.vertexNormals.push( normal.clone(), normal.clone(), normal.clone() );
                this.faces.push( face2 );

                this.faceVertexUvs[ 0 ].push( [
                    new THREE.Vector2( ix / gridX, 1 - iz / gridZ ),					//A
                    new THREE.Vector2( ix / gridX, 1 - ( iz + 1 ) / gridZ ),			//B
                    new THREE.Vector2( ( ix + 1 ) / gridX, 1 - ( iz + 1 ) / gridZ )	//C
                ] );

                this.faceVertexUvs[ 0 ].push( [
                    new THREE.Vector2( ( ix + 1 ) / gridX, 1 - ( iz + 1 ) / gridZ ),	//C
                    new THREE.Vector2( ( ix + 1 ) / gridX, 1 - iz / gridZ ),			//D
                    new THREE.Vector2( ix / gridX, 1 - iz / gridZ )					//A
                ] );
            } else {
                var face3 = new THREE.Face3( b, c, d );
                face3.normal.copy( normal );
                face3.vertexNormals.push( normal.clone(), normal.clone(), normal.clone() );
                this.faces.push( face3 );

                var face4 = new THREE.Face3( d, a, b );
                face4.normal.copy( normal );
                face4.vertexNormals.push( normal.clone(), normal.clone(), normal.clone() );
                this.faces.push( face4 );

                this.faceVertexUvs[ 0 ].push( [
                    new THREE.Vector2( ix / gridX, 1 - ( iz + 1 ) / gridZ ),			//B
                    new THREE.Vector2( ( ix + 1 ) / gridX, 1 - ( iz + 1 ) / gridZ ),	//C
                    new THREE.Vector2( ( ix + 1 ) / gridX, 1 - iz / gridZ )			//D
                ] );

                this.faceVertexUvs[ 0 ].push( [
                    new THREE.Vector2( ( ix + 1 ) / gridX, 1 - iz / gridZ ),			//D
                    new THREE.Vector2( ix / gridX, 1 - iz / gridZ ),					//A
                    new THREE.Vector2( ix / gridX, 1 - ( iz + 1 ) / gridZ )			//B
                ] );
            }
        }

    }
    
    //Ensure we generate the centroids
    this.computeCentroids();
    

};
THREE.Plane3RandGeometry.prototype = Object.create( THREE.Geometry.prototype );
THREE.Plane3RandGeometry.prototype.get_z = function(x,y){
    /**
     * @name get_z
     * @function Returns the height of the heightmap at the specified coordinates using bilinear interpolation
     *           allows us to more efficiently detect terrain collisions
     * 
     * @param x: <float> The map's x coordinate
     * @param y: <float> The map's y coordinate (depth)
     * 
     * @return <float> the z coordinate if the terrain is here, or <null> if it is not 
     */
   
    //Quick escape if we're off the limits of the field:
    if(isNaN(x) || isNaN(y)){
        return null;
    }
    if(x < this.boundingBox.min.x || x > this.boundingBox.max.x || y < this.boundingBox.min.y || y > this.boundingBox.max.y){
        return null; //We're off the bounds of the map
    }
    
    //y = -1*y; //y axis is inverted!!
    
    //Resolve the nearest vertices to x,y (aim is to get the vertex index for the four nearest!)
    var starting_vertex = this.vertices[0]; //Bottom left corner
    var x_spacing = this.creation_settings.x_spacing; //Distance between vertices in X
    var y_spacing = -this.creation_settings.y_spacing; //Distance between vertices in Y. NB y axis is INVERTED in the matrix for whatever reason, hence this is negative!
    var x_pos_index = (x-starting_vertex.x)/x_spacing; //What our "index" would be in the array of x values
    var y_pos_index = (y-starting_vertex.y)/y_spacing; //What our "index" would be in the array of y values, for some reason the y is built opposite!!
    
    //console.log("x,y vertex index: "+x_pos_index+","+y_pos_index+" ("+x+","+y+")");
    
    //Resolve what the "coordinates" would be if we were using a two-dimensional matrix to represent the vertices
    var x_nearest_vertex_floor_coord = Math.floor(x_pos_index); //The Vertex index just below for x
    var x_nearest_vertex_ceil_coord = Math.ceil(x_pos_index); //The Vertex index just above for x
    var y_nearest_vertex_floor_coord = Math.floor(y_pos_index); //The Vertex index just below for y
    var y_nearest_vertex_ceil_coord = Math.ceil(y_pos_index); //The Vertex index just above for y
    
    //Convert to actual vertex indexes as applied to our one dimensional array (x increases first, then y)
    var y_nearest_vertex_floor_index = (this.creation_settings.width_segments + 1) * y_nearest_vertex_floor_coord;
    var y_nearest_vertex_ceil_index = (this.creation_settings.width_segments + 1) * y_nearest_vertex_ceil_coord;
    //console.log("y vertex index: "+y_nearest_vertex_floor_index+" to "+y_nearest_vertex_ceil_index);
    var x1y1_index = y_nearest_vertex_floor_index + x_nearest_vertex_floor_coord;
    var x2y1_index = y_nearest_vertex_floor_index + x_nearest_vertex_ceil_coord;
    var x1y2_index = y_nearest_vertex_ceil_index + x_nearest_vertex_floor_coord;
    var x2y2_index = y_nearest_vertex_ceil_index + x_nearest_vertex_ceil_coord;
    
    //console.log(x1y1_index+","+x2y1_index+","+x1y2_index+","+x2y2_index);
    
    //We now have the four vertex indices surrounding the point. Thanks to our quick get-out at the start, all these points WILL be on the matrix!
    var x1y1 = this.vertices[x1y1_index];
    var x2y1 = this.vertices[x2y1_index];
    var x1y2 = this.vertices[x1y2_index];
    var x2y2 = this.vertices[x2y2_index];
    var x1 = x1y1.x; //Simplify to make our formula clear!
    var x2 = x2y1.x;
    var y1 = x1y1.y;
    var y2 = x1y2.y;
    
    //Linear interpolate in the X direction
    var z_at_xy1 = (x2-x)/(x2-x1)*x1y1.z + (x-x1)/(x2-x1)*x2y1.z;
    var z_at_xy2 = (x2-x)/(x2-x1)*x1y2.z + (x-x1)/(x2-x1)*x2y2.z;
    //Linear interpolate in the Y direction
    var z_at_xy = (y2-y)/(y2-y1)*z_at_xy1 + (y-y1)/(y2-y1)*z_at_xy2;
    
    //And return it!
    return z_at_xy;
};



THREE.Plane3Geometry = function ( width, height, widthSegments, heightSegments ) {

    THREE.Geometry.call( this );

    var ix, iz,
        width_half = width / 2,
        height_half = height / 2,
        gridX = widthSegments || 1,
        gridZ = heightSegments || 1,
        gridX1 = gridX + 1,
        gridZ1 = gridZ + 1,
        segment_width = width / gridX,
        segment_height = height / gridZ,
        normal = new THREE.Vector3( 0, 0, 1 );

    for ( iz = 0; iz < gridZ1; iz ++ ) {

        for ( ix = 0; ix < gridX1; ix ++ ) {

            var x = ix * segment_width - width_half;
            var y = iz * segment_height - height_half;

            this.vertices.push( new THREE.Vector3( x, - y, 0 ) );

        }

    }

    for ( iz = 0; iz < gridZ; iz ++ ) {

        for ( ix = 0; ix < gridX; ix ++ ) {

            var a = ix + gridX1 * iz;
            var b = ix + gridX1 * ( iz + 1 );
            var c = ( ix + 1 ) + gridX1 * ( iz + 1 );
            var d = ( ix + 1 ) + gridX1 * iz;

            var face = new THREE.Face3( a, b, c );
            face.normal.copy( normal );
            face.vertexNormals.push( normal.clone(), normal.clone(), normal.clone() );
            this.faces.push( face );

            var face2 = new THREE.Face3( c, d, a );
            face2.normal.copy( normal );
            face2.vertexNormals.push( normal.clone(), normal.clone(), normal.clone() );
            this.faces.push( face2 );

            this.faceVertexUvs[ 0 ].push( [
                new THREE.Vector2( ix / gridX, 1 - iz / gridZ ),			//A
                new THREE.Vector2( ix / gridX, 1 - ( iz + 1 ) / gridZ ),		//B
                new THREE.Vector2( ( ix + 1 ) / gridX, 1 - ( iz + 1 ) / gridZ )	//C
            ] );

            this.faceVertexUvs[ 0 ].push( [
                new THREE.Vector2( ( ix + 1 ) / gridX, 1 - ( iz + 1 ) / gridZ ),	//C
                new THREE.Vector2( ( ix + 1 ) / gridX, 1 - iz / gridZ ),		//D
                new THREE.Vector2( ix / gridX, 1 - iz / gridZ )			//A
            ] );

        }

    }

    this.computeCentroids();

};
THREE.Plane3Geometry.prototype = Object.create( THREE.Geometry.prototype );

// http://mrl.nyu.edu/~perlin/noise/

function generateHeight( width, height ) {

    var size = width * height, data = new Float32Array( size ),
        perlin = new ImprovedNoise(), quality = 1, z = Math.random() * 100;

    for ( var i = 0; i < size; i ++ ) {
        data[ i ] = 0
    }

    for ( var j = 0; j < 4; j ++ ) {

        for ( var i = 0; i < size; i ++ ) {

            var x = i % width, y = ~~ ( i / width );
            data[ i ] += Math.abs( perlin.noise( x / quality, y / quality, z ) * quality * 1.75 );

        }

        quality *= 5;

    }

    return data;

}