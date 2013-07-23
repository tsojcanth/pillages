var util = require("util"),
    io = require("socket.io"),
	Player = require("./Player").Player;

var socket,
    players,
	world,
	nttCounter = 1,
	server,
	ticker;
	
var gridSize = 32;
	
	
console.log("JERKFACE SANITIZE INPUTS");
	
function init() {
    players = [];
	world = World();
	ticker = Ticker(0);
	
	socket = io.listen(8000);
	
	socket.configure(function() {
		socket.set("transports", ["websocket"]);
		socket.set("log level", 2);
		
		setEventHandlers();
	});

	
	
};

var setEventHandlers = function() {
    socket.sockets.on("connection", onSocketConnection);
	
};
function onSocketConnection(client) {
    util.log("New player has connected: "+client.id);
    client.on("disconnect", onClientDisconnect);
    client.on("new player", onNewPlayer);
	client.on("move mob", 	onMoveMob);
	client.on("build", 		onBuild);
    //client.on("move player", onMovePlayer);
};

function onClientDisconnect() {
    util.log("Player has disconnected: "+this.id);
	
	var removePlayer = playerById(this.id);

	if (!removePlayer) {
		util.log("Player not found: "+this.id);
		return;
	};

	players.splice(players.indexOf(removePlayer), 1);
	this.broadcast.emit("remove player", {id: this.id});
};

function onNewPlayer(data) {

	var i, existingPlayer;
	var that = this;

	var newPlayer = new Player(200, 200);
	newPlayer.id = this.id;
	
	this.emit("assign id",{id:newPlayer.id});
	players.push(newPlayer);
	
	world.mobs.forEach(		function(mob)		{that.emit("add mob",{ id:mob.id(), controller:mob.controllerId() })});
	world.buildings.forEach(function(building)	{publish("build",{ id:building.id(), controller:building.controllerId(), x:building.x, y:building.y, width:building.width(), depth:building.depth(), type: building.type() })});
	
	var myMob = Mob(newPlayer);
		
	world.moveMobToXY(myMob,d(10),d(10));
	myMob = Mob(newPlayer);
		
	world.moveMobToXY(myMob,d(20),d(20));
	
	
	
	
	
	
	for (i = 0; i < players.length; i++) {
		existingPlayer = players[i];
		this.emit("new player", {id: existingPlayer.id, x: existingPlayer.getX(), y: existingPlayer.getY()});
	};
	
	this.broadcast.emit(
		"new player",
		{
			id: newPlayer.id,
			x: newPlayer.getX(),
			y: newPlayer.getY()
		}
	);

};

function onMoveMob(data) {

	console.log(JSON.stringify(data));
	var movePlayer = playerById(this.id);

	if (!movePlayer ) {
		util.log("Player not found: "+this.id);
		return;
	};
	if (!world.mobs[data.id]){
		util.log("mob not found: "+data.id);
		return;
	};
	
	var myMob = world.mobs[data.id];
	
	if (myMob.controllerId() != movePlayer.id ){
		util.log("wrong controller: "+movePlayer.id+" "+myMob.controllerId());
		return;	
	}
	
	myMob.destX = data.x;
	myMob.destY = data.y;
	
	console.log(myMob.destY);
};

function onBuild(data){
	console.log("build "+JSON.stringify(data));
	var buildingPlayer = playerById(this.id);

	if (!buildingPlayer ) {
		util.log("Player not found: "+this.id);
		return;
	};
	
	var building = Building(buildingPlayer, LongHouse());
	
	var x = Math.floor(data.x/gridSize) * gridSize;
	var y = Math.floor(data.y/gridSize) * gridSize;
	
	
	world.buildingXY(building,x,y);
}

function playerById(id) {
    var i;
    for (i = 0; i < players.length; i++) {
        if (players[i].id == id)
            return players[i];
    };

    return false;
};

function World(){
	return {
		mobs : [],
		buildings:[],
		moveMobToXY : function(aMob,x,y){
			aMob.x = x;
			aMob.y = y;
			if (!this.mobs[aMob.id()]){ this.mobs[aMob.id()] = aMob;}
			publish("move mob",{id: aMob.id(), x: x, y: y});
		},
		buildingXY	: function(building,x,y){
			building.x = x;
			building.y = y;
			if (!this.buildings[building.id()]){ this.buildings[building.id()] = building;}
			
			publish("build",{ id:building.id(), controller:building.controllerId(), x:x, y:y, width:building.width(), depth:building.depth(), type: building.type() });
		},
		occupiedXY : function(x,y){
			
			for (var aBuildingId in this.buildings) {
				var aBuilding = this.buildings[aBuildingId];
				if (
					aBuilding.x <= x && x < aBuilding.x+aBuilding.width()
					&&
					aBuilding.y <= y && y < aBuilding.y+aBuilding.depth()
					){
					return true;
				}
			}
			
			for (var aMob in this.mobs) {
				if (aMob.x == x && aMob.y == y){
					return true;
				}
			}
			return null;
		}
	};
}
function Building(player, type){
	var myId = nttCounter++;
	
	var building = {
		x: 0,
		y: 0,
		controllerId	:	function(){
			return (player?player.id:null);
		},
		id		: function()	{ return myId; 			},
		type 	: function()	{ return type.name();   },
		width 	: function()	{ return type.width();	},
		depth 	: function()	{ return type.depth();	},
	};
		
	return building;
}

LongHouse = function(){
	return {
		width : function(){return 128;},
		depth : function(){return 128;},
		name  : function(){return "Longhouse";}
	};
};

function Mob(player){
	var myId = nttCounter++;
	
	var mob = {
		x : 0,
		y : 0,
		destX : 0,
		destY : 0,
		
		controllerId	:	function(){
			return (player?player.id:null);
		},
		id : function(){ return myId; },
		behave	:	function(){
			var destination = this.nextDestination();
			if (destination){world.moveMobToXY(this,destination.x,destination.y);}
		
		},
		nextDestination	:	function(){
			if (this.x == this.destX && this.y == this.destY){
				this.setupNextDestination();
			}
			
			if (Math.abs(this.x - this.destX) > Math.abs(this.y - this.destY) ){
				var dest = (this.tryMoveX() || this.tryMoveY());
				if (dest){return dest;}
			}
			else {
				var dest = (this.tryMoveY() || this.tryMoveX());
				if (dest){return dest;}
			}
			this.setupNextDestination();
			return null;
			
		},
		setupNextDestination: function(){
			if (this.controllerId()){ return; }
			this.destX = d(500);
			this.destY = d(500);
		},
		tryMoveX:	function(){
			if (this.x > this.destX && !world.occupiedXY(this.x-1,this.y)){
				return {x:this.x-1, y:this.y};
			}
			if (this.x < this.destX && !world.occupiedXY(this.x+1,this.y)){
				return {x:this.x+1, y:this.y};
			}
		},
		tryMoveY:	function(){
			if (this.y > this.destY && !world.occupiedXY(this.x,this.y-1)){
				return {x:this.x, y:this.y-1};
			}
			if (this.y < this.destY && !world.occupiedXY(this.x,this.y+1)){
				return {x:this.x, y:this.y+1};
			}
		}
	};
	
	
	publish("add mob",{ id:mob.id(), controller:mob.controllerId() });
	return mob;
}

function Ticker(msTick){
	var last_tick_started_at = new Date().getTime();
	var running = false;
	var time = 0;
	return {
		tickStart	: function(){
			if (running){;return false;}
			var now = new Date().getTime();
			if (now - last_tick_started_at < msTick){
				return false;
			}
			running = true;
			last_tick_started_at = now;
			time++;
			return true;
		},
		tickDone	: function(){
			running = false;
		},
		time	:	function(){return time;}
	};
}

function d(faces){
	return (Math.floor(Math.random()*faces)+1 );
}
function publish (signalName,payload){
	socket.sockets.emit(signalName, payload);
}


init();
var tick_action = function() {
	if (ticker.tickStart()){
		
		world.mobs.forEach(
			function(mob){
				//console.log(mob.id());
				mob.behave();
			}
		)
		ticker.tickDone();
	}
	setTimeout(tick_action,0);
};

tick_action();



