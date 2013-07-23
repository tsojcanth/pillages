/**************************************************
** GAME VARIABLES
**************************************************/
var canvas,			// Canvas DOM element
	ctx,			// Canvas rendering context
	keys,			// Keyboard input
	myId,	
	remotePlayers,	// hurrrr
	socket,			// durrrr
	mobs = [],
	sprites;
	
sprites = pig.loadImage('assets/char.png');

function BuildCursor() {
	pig.Entity.apply(this);
	this.layer = 99;
	
	this.type = "mead_hall";
	
	this.mouseDown = function() {
		var msg = {x: pig.mouse.x, y: pig.mouse.y, type: this.type};
		socket.emit("build", msg);
		this.destroy();
		return true;
	};
}

function Building(data) {
	pig.Entity.apply(this);
	console.log(data);
	
	this.bid = data.id;
	this.x = data.x;
	this.y = data.y;
	this.w = data.width;
	this.h = data.depth;
	
	this.rect = new pig.Rect(this.x, this.y, this.w, this.h);
	this.graphic = new pig.Image(this.rect.x, this.rect.y, 'assets/mead_hall.png');
}

function BuildButton() {
	pig.Entity.apply(this);
	this.layer = 100;
	
	this.rect = new pig.Rect(pig.canvas.width-48, 0, 48, 48);	
	this.graphic = new pig.Image(this.rect.x, this.rect.y, "assets/build.png");
	
	this.mouseDown = function() {
		console.log(this.rect.collidePoint(pig.mouse.x, pig.mouse.y));
		if(this.rect.collidePoint(pig.mouse.x, pig.mouse.y)) {
			pig.world.add(new BuildCursor());						
			return true;
		}
		return false;
	};
}

function Mob(data) {
	pig.Entity.apply(this);
	
	this.mobid = data.id;	
	this.controller = data.controller;
	this.x = data.x;
	this.y = data.y;	
	this.rect = new pig.Rect(this.x-16, this.y-16, 32, 32);
	
	if(this.controller == myId)
		this.graphic = new pig.Image(this.rect.x, this.rect.y, "assets/viking_red.png");
	else
		this.graphic = new pig.Image(this.rect.x, this.rect.y, "assets/viking_blue.png");
	
	this.mouseDown = function() {		
		if(this.controller == myId) {
			console.log(this.mobid, pig.mouse.x, pig.mouse.y);
			socket.emit("move mob", {id: this.mobid, x: pig.mouse.x, y: pig.mouse.y});	
		}
	};
	
	this.move = function(x, y) {
		this.x = x;
		this.y = y;
		this.rect.x = x-8;
		this.rect.y = y-8;
		this.graphic.x = this.rect.x;
		this.graphic.y = this.rect.y;
	};
}

/**************************************************
** GAME INITIALISATION
**************************************************/
function init() {
	pig.init("gameCanvas");
	
	keys = new Keys();

	// Calculate a random start position for the local player
	// The minus 5 (half a player size) stops the player being
	// placed right on the egde of the screen

	// Start listening for events
	socket = io.connect(BASE_URL, {port: 8000, transports: ["websocket"]});
	setEventHandlers();	
};


function startGame() {	
	pig.canvas.width = window.innerWidth;
	pig.canvas.height = window.innerHeight;
	
	remotePlayers = [];
	pig.world = new pig.World();	
	
	pig.world.add(new BuildButton());
}

/**************************************************
** GAME EVENT HANDLERS
**************************************************/
var setEventHandlers = function() {
	// Window resize
	window.addEventListener("resize", onResize, false);
	
	socket.on("connect", onSocketConnected);
	socket.on("disconnect", onSocketDisconnect);
	socket.on("assign id", onAssignId);
	socket.on("new player", onNewPlayer);
	socket.on("move player", onMovePlayer);
	socket.on("remove player", onRemovePlayer);
	socket.on("move mob", onMoveMob);
	socket.on("add mob", onAddMob);
	socket.on("build", onBuild);
};

// Browser window resize
function onResize(e) {
	// Maximise the canvas
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
};

function onSocketConnected() {
    console.log("Connected to socket server");
    startGame();
    
	//TODO ask the server for position instead of telling the server the position, please
	
	socket.emit("new player", {});
};

function onSocketDisconnect() {
    console.log("Disconnected from socket server");
    pig.world = new pig.World();
};

function onAssignId(data){
	console.log("*** ASSIGNED ID "+data.id);
	myId = data.id;	
}

function onAddMob(data){	
	console.log(data);
	mobs[data.id] = new Mob(data);
	pig.world.add(mobs[data.id]);
}

function onBuild(data) {
	pig.world.add(new Building(data));
}

function onMoveMob(data){
	if(mobs[data.id])
		mobs[data.id].move(data.x, data.y);
}

function onNewPlayer(data) {
    console.log("New player connected: "+data.id);
	var newPlayer = new Player(data.x, data.y, data.id);
	newPlayer.id = data.id;
	remotePlayers.push(newPlayer);
};

function onMovePlayer(data) {
	var movePlayer = playerById(data.id);

	if (!movePlayer) {
		console.log("Player not found: "+data.id);
		return;
	};
	console.log("move player "+data.id);

	movePlayer.x = data.x;
	movePlayer.y = data.y;
};

function onRemovePlayer(data) {
	var removePlayer = playerById(data.id);

	if (!removePlayer) {
		console.log("Player not found: "+data.id);
		return;
	};

	remotePlayers.splice(remotePlayers.indexOf(removePlayer), 1);

};


/**************************************************
** GAME UPDATE
**************************************************/
function update() {
	var localPlayer = myPlayer();
	
	//console.log(localPlayer?"found":"missing avatar");

	if (localPlayer && localPlayer.update(keys)) {
		socket.emit("move player", {x: localPlayer.x, y: localPlayer.y});
	};
};

function myPlayer(){
	return playerById(myId);
}

function playerById(id) {
    var i;
    for (i = 0; i < remotePlayers.length; i++) {
        if (remotePlayers[i].id == id)
            return remotePlayers[i];
    };

    return false;
};
