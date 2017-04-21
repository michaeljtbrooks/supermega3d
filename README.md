# Super Mega 3D

## 100% gameplay, 0% graphics

The 3D platformer that doesn't care how it looks, just how it plays.


> Back when I was 13 (in the mid-to-late 90's), I noticed that there was an arms-race going on in the console world
> about who could produce the highest fidelity graphics. There was Nintendo 64 bit, then Dreamcast 128 bit. 
> All the games that were coming out were sacrificing general playability for looking nice. It annoyed me.
>
> So I did something about it. I wrote a little 2D platformer in QBASIC (compiled into Windows .exe), with 30 levels. 
> 
> I also noticed the generous use of superlative words in game titles... Super Mario, Mega Man etc.
> So I called mine "Super Mega", done.
>
> The philosophy was simple: focus almost completely on the gameplay and keep the graphics to the bare minimum. The
> main player became a red rectangle, enemies were green circles, power ups yellow circles etc. The objective was to reach
> the end. In later levels there were sliding platforms, key operated doors, and even a magic button which turned
> all platforms into traps and traps into platforms... I sold lots of copies at school on floppy disk!
>
> The 00's came along, and so did DarkBasic 3D, another programming language. I re-created Super Mega, this time in 3D, 
> with new levels and puzzles to crack. The problem was that Dark Basic was horrendously slow, and I was also a bit crap
> at collision detection. It did wonders for my school Maths though, especially mechanics!
> At some point in 2011 I recreated 7 levels of Super Mega 2D in Adobe Flash, just for the hell of it.
>
> And then Super Mega was laid to rest...
>
> ... until now!!
> I stumbled upon this (https://github.com/kfitzgerald/webgl-ball-game) brilliant mashup by Kevin Fitzgerald while looking
> for examples of what Javascript could do in 3D. It was such a great starting point.
>
> My aim is to recreate Super Mega 3D, in Javascript in all its glory. Come and join me for the ride!

## In this build:
* Kevin's awesome terrain generator, dead sexy trees, PointerLock controlled character, websockets-driven multiplayer, and ball shooting physics
* Jumping (spacebar)
* 4 power-up levels (try them out by pressing keyboard keys 1 / 2 / 3 / 4)
* Collision detection allowing you to stand in trees, jump onto platforms and walk on platforms
* Falling / rising predictive collision detection ensuring you don't fall through platforms
* Friction and traction (including some platforms made of ice)
* Moving platforms, rotating platforms, orbiting platforms

## To do:
1) Add transfer of platform momentum you are standing on to you
2) Static and moving traps
3) Power-up objects
4) Enemies with some degree of AI
5) Switch-operated doors
6) Level loader (the first Super Mega worked really well because I could bang out levels in minutes by using Paint. The 
code would load the bitmaps then interpret items based on pixel colour. I'd love to have the same sort of arrangement
where  we construct levels quickly in Blender then load them in.)
7) Create a metric shit-tonne of levels! :-D
8) Refactor the code so we use proper classes rather than monkey-patching :-S
9) Performance optimisation, client-side.
10) Server optimisation, security and cheat resiliance.
11) Fix all the multiplayer stuff I'll have no doubt broken along the way.


------


## Setup

1. Download or clone this repository
2. Install node.js (http://nodejs.org/) 
3. In the project root, install dependencies, e.g. `npm install`
4. Run the server: `node .`
5. Load up Google Chrome and visit `localhost:3000`

> You can specify a different port when running, e.g. `node . 8080`

Stop the server with CTRL+C

If you really want it to run and restart on crash, try this:

`while true; do echo 'Hit CTRL+C TO KILL'; node . ; sleep 1; done`

## Caveats

Since this is purely just a prototype of a game, there's absolutely no:

* **Performance**: movement is reported on a set interval, and is not optimal. Many clients in the server tends to flood the server out and lag everything out.
* **Security**: clients can hack and do naughty things
* Clients handle their own balls (arf!), so clients report their own hits. 
* **Consistency**: physics are not synchronized on the server/clients. They could be, but this example lacks this for now. Check out Jonas Gehring's blog post on how this might be possible some day: http://www.jjoe64.com/2013/07/physijs-and-threejs-on-nodejs.html
* Clients report the position and angle when firing balls. In theory, the ball will follow a pretty consistent path, but can vary a bit from client to client.

## Components
* HTML5, WebGL, Web Sockets, Web Workers, Pointer Lock
* HTML5 Boilerplate (http://html5boilerplate.com/)
* three.js (https://github.com/mrdoob/three.js/)
* physi.js (http://chandlerprall.github.io/Physijs/)
* node.js (http://nodejs.org/)

### Libraries and Misc
* WebGL Ball Game by Kevin Fitzgerald
* THREE.PointerLockControls by Ricardo "mrdoob" Cabello (https://github.com/mrdoob/three.js/blob/master/examples/js/controls/PointerLockControls.js)
* Improved noise algorithm by Ken Perlin (http://mrl.nyu.edu/~perlin/noise/)
* GL Detector by AlteredQualia and Ricardo "mrdoob" Cabello (https://github.com/mrdoob/three.js/blob/master/examples/js/Detector.js)
* JavaScript Performance Monitor by Ricardo "mrdoob" Cabello (https://github.com/mrdoob/stats.js)
* jQuery Mousewheel by Brandon Aaron (http://brandonaaron.net)
* requestAnimationFrame polyfill by Erik Möller, Paul Irish and Tino Zijdel (http://paulirish.com/2011/requestanimationframe-for-smart-animating/)
* Shim for High Resolution Time by Tony Gentilcore (http://gent.ilcore.com/2012/06/better-timer-for-javascript.html)
* THREE.PlaneGeometry.js by Ricardo "mrdoob" Cabello (http://threejsdoc.appspot.com/doc/three.js/src.source/extras/geometries/PlaneGeometry.js.html)
* Keycode enum by Adam Vogel (http://adamvogel.net)
* Color sequence generator by Jim Bumgardner (http://krazydad.com/tutorials/makecolors.php)

## Credits
* Original "WebGL Ball Game" Written by Kevin Fitzgerald ([@kftzg](https://twitter.com/kftzg), http://kevinfitzgerald.net)
* Art style inspired by Tim Reynolds ([@turnislefthome](https://twitter.com/turnislefthome), http://www.turnislefthome.com)
* WebGL Ball Game Ideas vetted by Adam Vogel ([@adambvogel](https://twitter.com/adambvogel), http://adamvogel.net)
* Play tested and approved by Kevin's wife Luciana ([@leafitz](https://twitter.com/leafitz), http://lucianaelisa.net)
* Super Mega concept by a younger version of Mike Brooks ([@michaeljtbrooks](https://twitter.com/michaeljtbrooks))
* Diabolical code hacking by the current version of Mike Brooks. I am sorry.
