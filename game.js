var util = require("util"),
    io = require("socket.io"),
	Player = require("./Player").Player;

var socket,
    players,
	world,
	mobIdCounter = 1,
	server,
	ticker;
	
function init() {
    players = [];
	world = World();
	ticker = Ticker(10);
	
	socket = io.listen(8000);
	
	socket.configure(function() {
		socket.set("transports", ["websocket"]);
		socket.set("log level", 2);
		
		setEventHandlers();
	});
	
	world.moveMobToXY(Mob(),d(10),d(10));
	world.moveMobToXY(Mob(),d(10),d(10));
	world.moveMobToXY(Mob(),d(10),d(10));	world.moveMobToXY(Mob(),d(10),d(10));
	world.moveMobToXY(Mob(),d(10),d(10));
	
	
	
};

var setEventHandlers = function() {
    socket.sockets.on("connection", onSocketConnection);
	
};
function onSocketConnection(client) {
    util.log("New player has connected: "+client.id);
    client.on("disconnect", onClientDisconnect);
    client.on("new player", onNewPlayer);
	client.on("move mob", onMoveMob);
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
	
	var myMob = Mob();
	myMob.setController(newPlayer);
		
	world.moveMobToXY(myMob,d(10),d(10));
	
	
	this.emit("assign id",{id:newPlayer.id});
	players.push(newPlayer);
	that.broadcast.emit("add mob",{ id:myMob.id(), controller:myMob.controllerId() });
	
	world.mobs.forEach(function(mob){that.emit("add mob",{ id:mob.id(), controller:mob.controllerId() })});
	
	
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
/*
function onMovePlayer(data) {
	var movePlayer = playerById(this.id);

	if (!movePlayer) {
		util.log("Player not found: "+this.id);
		return;
	};
	
	

	this.broadcast.emit("move player", {id: movePlayer.id, x: movePlayer.getX(), y: movePlayer.getY()});
};
*/

function onMoveMob(data) {
	var movePlayer = playerById(this.id);

	if (!movePlayer || !world.mobs[data.id] || world.mobs[data.id].controllerId() != movePlayer.id ) {
		util.log("Player not found: "+this.id);
		return;
	};
	
	

	this.broadcast.emit("move player", {id: movePlayer.id, x: movePlayer.getX(), y: movePlayer.getY()});
};

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
			this.publish("move mob",{id: aMob.id(), x: x, y: y});
		},
		publish	: function(signalName,payload){
			socket.sockets.emit(signalName, payload);
		},
		occupiedXY : function(x,y){
			//if (x > 100 && y > 100 && x < 200 && y < 200){ return true; }
			for (var aMob in this.mobs) {
				if (aMob.x == x && aMob.y == y){
					return true;
				}
			}
			return null;
		}
	};
}
function Mob(){
	var myId = mobIdCounter++;
	

	return {
		x : 0,
		y : 0,
		destX : d(500),
		destY : d(500),
		
		controllerId	:	function(){
			return (this.player?this.player.id:null);
		},
		setController : function(player){
			this.player = player;
		},
		id : function(){ return myId; },
		behave	:	function(){

			var destination = this.nextDestination();
		
			if (destination){world.moveMobToXY(this,destination.x,destination.y);}
		
		},
		nextDestination	:	function(){
			if (this.x == this.destX && this.y == this.destY){
				console.log("reached "+this.id());
				this.destX = d(500);
				this.destY = d(500);
			}
			
			if (Math.abs(this.x - this.destX) > Math.abs(this.y - this.destY) ){
				var dest = (this.tryMoveX() || this.tryMoveY());
				if (dest){return dest;}
			}
			else {
				var dest = (this.tryMoveY() || this.tryMoveX());
				if (dest){return dest;}
			}
			if (this.controllerId()){ return; }


			this.destX = d(500);
			this.destY = d(500);
			return null;
			
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
			if (this.x > this.destY && !world.occupiedXY(this.x,this.y+1)){
				return {x:this.x, y:this.y+1};
			}
		}
	};
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
	setTimeout(tick_action,1);
};

tick_action();



