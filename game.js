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
	
	world.mobs.forEach(		function(mob)		{that.emit("add mob",{ id:mob.id(), controller:mob.controllerId() });that.emit("move mob",{id: mob.id(), x: mob.x, y: mob.y});});

    world.buildings.forEach(function(building)	{publish("build",{ id:building.id(), controller:building.controllerId(), x:building.x, y:building.y, width:building.width(), depth:building.depth(), type: building.type() })});
	


    spawnMob(newPlayer);
    spawnMob(newPlayer);
    spawnMob(newPlayer);

	
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

function spawnMob(player){
    myMob = Mob(player);

    var x, y,attempt = 0;
    do {
        x = d(100);
        y = d(100);
        attempt++;
    } while (world.occupiedXY(x,y,myMob) && attempt < 10);
    if (attempt > 9){return}
    world.addMobAtXY(myMob,x,y);
    myMob.destX = x;
    myMob.destY = y;
}

function onMoveMob(data) {
	var movePlayer = playerById(this.id);

	if (!movePlayer ) {
		util.log("Player not found: "+this.id);
		return;
	}

	var myMob = world.findMobById(data.id);

    if(myMob == null){
        util.log("no mob with id: "+data.id);
        return;
    }
	if (myMob.controllerId() != movePlayer.id ){
		util.log("wrong controller: "+movePlayer.id+" "+myMob.controllerId());
		return;	
	}
	
	myMob.destX = data.x;
	myMob.destY = data.y;
}

function onBuild(data){
	console.log("build "+JSON.stringify(data));
	var buildingPlayer = playerById(this.id);

	if (!buildingPlayer ) {
		util.log("Player not found: "+this.id);
		return;
	}

	var building = Building(buildingPlayer, LongHouse());
	
	var x = Math.floor(data.x/gridSize) * gridSize;
	var y = Math.floor(data.y/gridSize) * gridSize;
	

    if (world.canBuildAtXY(x,y,building)){
	    world.buildingXY(building,x,y);
    }
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
        findMobById : function(id){
            for (var i = this.mobs.length -1 ; i >= 0; i--){
                var mob = this.mobs[i];
                if (mob.id() == id){
                    return mob;
                }
            }
        },
        addMobAtXY : function(aMob,x,y){
            publish("add mob",{ id:aMob.id(), controller:aMob.controllerId() });
            //aMob.world = this;
            this.mobs.push(aMob);
            this.moveMobToXY(aMob,x,y);
        },
		moveMobToXY : function(aMob,x,y){
			aMob.x = x;
			aMob.y = y;
			publish("move mob",{id: aMob.id(), x: x, y: y});
		},
		buildingXY	: function(building,x,y){
			building.x = x;
			building.y = y;
			if (!this.buildings[building.id()]){ this.buildings[building.id()] = building;}
			
			publish("build",{ id:building.id(), controller:building.controllerId(), x:x, y:y, width:building.width(), depth:building.depth(), type: building.type() });
		},
        cleanUpCorpses  : function(){
            for (var i = this.mobs.length-1; i>=0 ; i--){
                if (!this.mobs[i].alive){

                    publish("remove mob",{id: this.mobs[i].id(), cause:'death'});
                    this.mobs.splice(i,1);
                }
            }
        },
        closeEnemy      : function(mob){
            var target = null;
            valueIterator(this.mobs, function(aMob){

                if (aMob === mob) { return 1; }
                if (aMob.controllerId() != mob.controllerId() && close(aMob.x,mob.x,30) && close(aMob.y,mob.y,30)){
                    target = aMob;
                    return null;
                }
                return 1;
            });
            return target;
        },
        canBuildAtXY : function(x,y,building){
            for (var aBuildingId in this.buildings) {
                var aBuilding = this.buildings[aBuildingId];

                if (
                    aBuilding.x <= x+building.width() && x < aBuilding.x+aBuilding.width()
                        &&
                    aBuilding.y <= y+building.depth() && y < aBuilding.y+aBuilding.depth()
                    ){
                    return false;
                }
            }
            var isClose = false;

            valueIterator(this.mobs, function(aMob){
                if (
                    aMob.x <= x+building.width() && x < aMob.x+20
                        &&
                    aMob.y <= y+building.depth() && y < aMob.y+20
                    ){
                    isClose = true;
                    return null;
                }
            });
            if (isClose) {return false;}

            return true;
        },
		occupiedXY : function(x,y, mob){
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
            var isClose = false;
            valueIterator(this.mobs, function(aMob){

                if (aMob === mob) { return 1; }
				if (close(aMob.x,x,20) && close(aMob.y,y,20)){
                    isClose = true;
					return null;
				}
			});
            if (isClose) {return true;}
			return null;
		}
	};
}
function close(a,b,range){return (Math.abs(a-b) < range);}
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
		depth 	: function()	{ return type.depth();	}

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
        //identifier : (player?player.id:null),
		x : 0,
		y : 0,
		destX : 0,
		destY : 0,
        alive : true,
		controllerId	:	function(){
			return (player?player.id:null);
		},
		id : function(){ return myId; },
		behave	:	function(){

            var enemy = world.closeEnemy(this);
            if (enemy){ this.attack(enemy); }

			var destination = this.nextDestination();
			if (destination){world.moveMobToXY(this,destination.x,destination.y);}
		},
        attack : function(enemyMob){
            if (d(6) >= 5){ enemyMob.hurt(this);}
        },
        hurt : function(attacker){
            this.alive = false;
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

			return null;
			
		},
		setupNextDestination: function(){
			if (this.controllerId()){ return; }
			this.destX = d(500);
			this.destY = d(500);
		},
		tryMoveX:	function(){
			if (this.x > this.destX && !world.occupiedXY(this.x-1,this.y,this)){
				return {x:this.x-1, y:this.y};
			}
			if (this.x < this.destX && !world.occupiedXY(this.x+1,this.y,this)){
				return {x:this.x+1, y:this.y};
			}
		},
		tryMoveY:	function(){
			if (this.y > this.destY && !world.occupiedXY(this.x,this.y-1,this)){
				return {x:this.x, y:this.y-1};
			}
			if (this.y < this.destY && !world.occupiedXY(this.x,this.y+1,this)){
				return {x:this.x, y:this.y+1};
			}
		}
	};

	return mob;
}

function Ticker(msTick){
	var last_tick_started_at = new Date().getTime();
	var running = false;
	var time = 0;
	return {
		tickStart	: function(){
			if (running){return false;}
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
function valueIterator(hash, lambda){
    for (var key in hash) {
        if (hash.hasOwnProperty(key)) {
            if (lambda(hash[key],key,hash) === null){
                //console.log("key "+key+" out of "+hash.length);
                return;
            }
        }
    }


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
				mob.behave();
			}
		);
        world.cleanUpCorpses();
		ticker.tickDone();
	}
	setTimeout(tick_action,0);
};

tick_action();



