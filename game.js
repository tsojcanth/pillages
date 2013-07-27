var util = require("util"),
    io = require("socket.io"),
	Player = require("./Player").Player;

var socket,
    players,
	world,
	nttCounter = 1,
	server,
	ticker;
	
var gridSize        = 32,
    MAX_NTT_WIDTH   = 64;


console.log("JERKFACE SANITIZE INPUTS");
	
function init() {
    players = [];
	world = World();
	ticker = Ticker(20);
	
	socket = io.listen(8000);
	
	socket.configure(function() {
		socket.set("transports", ["websocket"]);
		socket.set("log level", 2);
		
		setEventHandlers();
	});

	
	
}

var setEventHandlers = function() {
    socket.sockets.on("connection", onSocketConnection);
	
};
function onSocketConnection(client) {
    util.log("New player has connected: "+client.id);
    client.on("disconnect", onClientDisconnect);
    client.on("new player", onNewPlayer);
	client.on("move mob", 	onMoveOrderMob);
	client.on("build", 		onBuild);
    //client.on("move player", onMovePlayer);
}

function onClientDisconnect() {
    util.log("Player has disconnected: "+this.id);
	
	var removePlayer = playerById(this.id);

	if (!removePlayer) {
		util.log("Player not found: "+this.id);
		return;
	}

	players.splice(players.indexOf(removePlayer), 1);
	this.broadcast.emit("remove player", {id: this.id});
}

function onNewPlayer(data) {

	var i, existingPlayer;
	var that = this;

	var newPlayer = new Player(200, 200);
	newPlayer.id = this.id;
	
	this.emit("assign id",{id:newPlayer.id});
	players.push(newPlayer);
	
	world.mobForEach(		function(mob)		{that.emit("add mob",{ id:mob.id(), controller:mob.controllerId() });that.emit("move mob",{id: mob.id(), x: mob.x, y: mob.y});});

    world.buildingForEach(  function(building)	{publishBuild(building)});

    spawnMob(newPlayer,100,100,100);
    spawnMob(newPlayer,100,100,100);
    spawnMob(newPlayer,100,100,100);

	for (i = 0; i < players.length; i++) {
		existingPlayer = players[i];
		this.emit("new player", {id: existingPlayer.id, x: existingPlayer.getX(), y: existingPlayer.getY()});
	}
	
	this.broadcast.emit(
		"new player",
		{
			id: newPlayer.id,
			x: newPlayer.getX(),
			y: newPlayer.getY()
		}
	);

}

function spawnMob(player,xCenter,yCenter,spread){
    var myMob = Mob(player);
    var x, y,attempt = 5;
    do {
        x = xCenter+d(spread)-spread/2;
        y = yCenter+d(spread)-spread/2;
        attempt++;
    } while (world.occupiedXY(x,y,myMob) && attempt);
    if (!attempt){return null}
    world.moveMobToXY(myMob,x,y);
    myMob.destX = x;
    myMob.destY = y;
    return myMob;
}
function onMoveOrderMob(data) {
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
	//console.log("build "+JSON.stringify(data));
	var buildingPlayer = playerById(this.id);

	if (!buildingPlayer ) {
		util.log("Player not found: "+this.id);
		return;
	}
    var type =  (data.type == 'mead_hall'   )?  LongHouse() :
                (data.type == 'farm'        )?  Farm()      :
                                                null;
	var building = Building(buildingPlayer, type);

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
function World(centerX,centerY,size){
	return {
        // CONTENTS
        mobs : [],
		buildings:[],
        leaf_smallX_bigY : null,  // small x, big y
        leaf_bigX_bigY : null,  // big   x, big y
        leaf_smallX_smallY : null,  // small x, small y
        leaf_bigX_smallY : null,  // big   x, small y
        quad_center_point_x : centerX,
        quad_center_point_y : centerY,
        size : size,

        split       : function(){
            if (this.size< 10){ return; }

            var d = this.size/2;
            var center_d = d/2;



            this.leaf_smallX_smallY = World(this.quad_center_point_x-center_d,this.quad_center_point_y-center_d,d);
            this.leaf_smallX_bigY   = World(this.quad_center_point_x-center_d,this.quad_center_point_y+center_d,d);
            this.leaf_bigX_smallY   = World(this.quad_center_point_x+center_d,this.quad_center_point_y-center_d,d);
            this.leaf_bigX_bigY     = World(this.quad_center_point_x+center_d,this.quad_center_point_y+center_d,d);

        },
        is_split    : function(){
            return (this.leaf_smallX_bigY);
        },
        delegate_until_result_found : function(lambda, pars){
            if (!this.is_split()){return;}
            console.log(this.quad_center_point_x+":"+this.quad_center_point_y+" delegate_until_result_found");
            var result = lambda.apply(this.leaf_smallX_bigY,pars) || lambda.apply(this.leaf_bigX_bigY,pars) || lambda.apply(this.leaf_smallX_smallY,pars) || lambda.apply(this.leaf_bigX_smallY,pars);
            return result;
        },
        delegate_until_result_found_to_all_leaves_in_area: function(x1,y1,x2,y2,lambda,pars){ //x2,y2 have to be greater or equal than x,y
            if (!this.is_split()){return;}
            console.log(this.quad_center_point_x+":"+this.quad_center_point_y+" delegate_until_result_found_to_all_leaves_in_area");
            var result = null;
            if (this.quad_center_point_x >= x1 && this.quad_center_point_y >= y1 ){ result = lambda.apply(this.leaf_smallX_smallY,pars) }
            if (result){return result;}
            if (this.quad_center_point_x >= x1 && this.quad_center_point_y <  y2 ){ result = lambda.apply(this.leaf_smallX_smallY,pars) }
            if (result){return result;}
            if (this.quad_center_point_x <  x2 && this.quad_center_point_y >= y1 ){ result = lambda.apply(this.leaf_smallX_smallY,pars) }
            if (result){return result;}
            if (this.quad_center_point_x <  x2 && this.quad_center_point_y <  y2 ){ result = lambda.apply(this.leaf_smallX_smallY,pars) }

            return result;
        },

        delegate_collate_all_results : function(lambda, pars){
            if (!this.is_split()){return [];}
            console.log(this.quad_center_point_x+":"+this.quad_center_point_y+" delegate_collate_all_results");
            var result = [];
            result.push(lambda.apply(this.leaf_smallX_bigY,pars));
            result.push(lambda.apply(this.leaf_bigX_bigY,pars));
            result.push(lambda.apply(this.leaf_smallX_smallY,pars));
            result.push(lambda.apply(this.leaf_bigX_smallY,pars));
            return result;
        },
        delegate_to_correct_leaf_for_xy : function(x,y,lambda,pars){
            if (!this.is_split()){return lambda.apply(this,pars);}
            console.log(this.quad_center_point_x+":"+this.quad_center_point_y+" delegate_to_correct_leaf_for_xy");

            if (this.quad_center_point_x < x){
                if (this.quad_center_point_y < y){
                    return lambda.apply(this.leaf_bigX_bigY,pars);
                }
                else {
                    return lambda.apply(this.leaf_bigX_smallY,pars);
                }
            }
            else{
                if (this.quad_center_point_y < y){
                    return lambda.apply(this.leaf_smallX_bigY,pars);
                }
                else {
                    return lambda.apply(this.leaf_smallX_smallY,pars);
                }
            }
        },
        find_correct_leaf_for_xy : function(x,y){
            if (!this.is_split()){return this;}
            console.log(this.quad_center_point_x+":"+this.quad_center_point_y+" find_correct_leaf_for_xy");

            if (x > this.quad_center_point_x){
                if (y > this.quad_center_point_y){
                    return this.leaf_bigX_bigY.find_correct_leaf_for_xy(x,y);
                }
                else {
                    return this.leaf_bigX_smallY.find_correct_leaf_for_xy(x,y);
                }
            }
            else{
                if (y > this.quad_center_point_y){
                    return this.leaf_smallX_bigY.find_correct_leaf_for_xy(x,y);
                }
                else {
                    return this.leaf_smallX_smallY.find_correct_leaf_for_xy(x,y);
                }
            }
        },

        findMobById : function(id){
            for (var i = this.mobs.length -1 ; i >= 0; i--){
                var mob = this.mobs[i];
                if (mob.id() == id){
                    return mob;
                }
            }
            return this.delegate_until_result_found( this.findMobById, [id] );

        },
        moveMobToXY : function(aMob,x,y){

            var targetLeaf = world.find_correct_leaf_for_xy(x,y);
            if (targetLeaf != aMob.world){
                if (aMob.world != null){
                    aMob.world.mobs.splice(aMob.world.mobs.indexOf(aMob));
                }
                else{
                    publish("add mob",{ id:aMob.id(), controller:aMob.controllerId() });
                }
                targetLeaf.mobs.push(aMob);
                aMob.world = targetLeaf;
            }


            aMob.x = x;
            aMob.y = y;
            publish("move mob",{id: aMob.id(), x: x, y: y});
        },
		buildingXY	: function(building,x,y){
            var targetLeaf = world.find_correct_leaf_for_xy(x,y);
            targetLeaf.buildings.push(building);
			building.x = x;
			building.y = y;

            publishBuild(building);
		},
        mobGap : function(){return 20},
        cleanUpCorpses  : function(){           //TODO PAOLO FIX ME QUAD
            return;

            throw "not converted to quadtrees";

            var playerMobCount          = {};
            var playerFarmCount         = {};
            var playerMeadHouseCount    = {};

            players.forEach(function(p){ playerMobCount[p.id] = 0;playerFarmCount[p.id] = 0;playerMeadHouseCount[p.id] = 0; })

            for (var i = this.mobs.length-1; i>=0 ; i--){
                var mob = this.mobs[i];
                if (!mob.alive()){
                    publishRemoveMob(mob,"death");
                    this.mobs.splice(i,1);
                }
                else {
                    playerMobCount[mob.controllerId()]++;
                }
            }
            for (var i = this.buildings.length-1; i>=0 ; i--){
                var build = this.buildings[i];
                if (!build.alive()){
                    publishRemoveBuilding(build,"burnt");
                    this.buildings.splice(i,1);
                }
                else {
                    playerFarmCount[build.controllerId()]++;
                }
            }

            valueIterator(playerMobCount,function(value,key){

                var player = playerById(key);
                if (player){
                    player.setMobCount(value);
                }
            });

            valueIterator(playerFarmCount,function(value,key){

                var player = playerById(key);
                if (player){
                    player.setFarmCount(value);
                }
            });

        },
        closeEnemy      : function(mob){
            var target = null;
            var attackRange = 30;

            valueIterator(this.mobs, function(aMob){

                if (aMob === mob) { return 1; }
                if (aMob.controllerId() != mob.controllerId() && close(aMob.x,mob.x,attackRange) && close(aMob.y,mob.y,attackRange)){
                    target = aMob;
                    return null;
                }
                return 1;
            });
            return target || this.delegate_until_result_found_to_all_leaves_in_area(mob.x-attackRange,mob.y-attackRange,mob.x+attackRange,mob.y+attackRange, this.closeEnemy,[mob]) ;
        },
        canBuildAtXY : function(x,y,building){
            var range = MAX_NTT_WIDTH+this.mobGap();

            return !world._cantBuildAtXYlookingInX2Y2X3Y3(x,y,building,x-range,y-range,x+building.width()+this.mobGap(),y+building.depth()+this.mobGap());
        },
        _cantBuildAtXYlookingInX2Y2X3Y3 : function(x,y,building,x2,y2,x3,y3){

            var buildGap = this.mobGap();

            for (var aBuildingId in this.buildings) {
                var aBuilding = this.buildings[aBuildingId];



                if (
                    aBuilding.x <= x+building.width()+buildGap && x < aBuilding.x+aBuilding.width()+buildGap
                        &&
                    aBuilding.y <= y+building.depth()+buildGap && y < aBuilding.y+aBuilding.depth()+buildGap
                    ){
                    return true;
                }
            }
            var isClose = false;

            valueIterator(this.mobs, function(aMob){
                if (
                    aMob.x <= x+building.width() && x < aMob.x+buildGap
                        &&
                    aMob.y <= y+building.depth() && y < aMob.y+buildGap
                    ){
                    isClose = true;
                    return null;
                }
            });
            if (isClose) {return true;}

            return this.delegate_until_result_found_to_all_leaves_in_area(x2,y2,x3,y3,this._cantBuildAtXYlookingInX2Y2X3Y3,[x,y,building,x2,y2,x3,y3]);

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

            return this.delegate_until_result_found_to_all_leaves_in_area(x,y,x+MAX_NTT_WIDTH,y+MAX_NTT_WIDTH,this.occupiedXY,[x,y,mob]);
		},
        mobForEach  : function(lambda){
            this.mobs.forEach(lambda);
            this.delegate_collate_all_results(this.mobForEach,lambda);
        },
        buildingForEach : function(lambda){
            this.buildings.forEach(lambda);
            this.delegate_collate_all_results(this.buildingForEach,lambda);
        }   ,
        mobCount        : function(){
            var results = this.delegate_collate_all_results(this.mobCount);
            return this.mobs.length+results.reduce(function(prev,cur){return prev+cur;},0);
        }
	};
}
function close(a,b,range){return (Math.abs(a-b) < range);}
function Building(player, type){
	var myId = nttCounter++;
	
	var building = {
        player : player,
		x: 0,
		y: 0,
        cantActUntilTick : 0,
        hp : 50,
        alive : function(){ return this.hp > 0;},
        controllerId	:	function(){
            return (player?player.id:null);
        },
        canActNow : function(tick){
            return (this.cantActUntilTick <= tick);
        },
        lagUntil : function(tick){
            this.cantActUntilTick = tick;
        },
		id		: function()	{ return myId; 			                },
		type 	: function()	{ return type.name();                   },
		width 	: function()	{ return type.width();	                },
		depth 	: function()	{ return type.depth();	                },
        behave  : function(tick){ return type.behaveFunc(this, tick);   }

	};
		
	return building;
}

LongHouse = function(){
	return {
		width : function(){return 128;},
		depth : function(){return 128;},
		name  : function(){return "mead_hall";},
        behaveFunc  : function(building,tick){
            if (!building.alive() || !building.player.canControlMoreMobs() ||  !building.canActNow(tick)){ return ; }
            building.lagUntil(tick+(100*building.player.spawnSpeedup()));
            spawnMob(building.player,building.x+this.width()/2,building.y+building.depth(),100);
        }

	};
};
Farm = function(){
    return {
        width : function(){return 128;},
        depth : function(){return 128;},
        name  : function(){return "farm";},
        behaveFunc  : function(tick){}
    };
};

function Mob(player){
	var myId = nttCounter++;

    var hpAtGeneration = d(6)+2;
	var mob = {
		x : 0,
		y : 0,
		destX : 0,
		destY : 0,
        world : null,
        hp : hpAtGeneration,
        hpMax : hpAtGeneration,
        cantActUntilTick : 0,
        alive : function(){ return this.hp > 0;},
        heal1HP : function(){ if (this.hp < this.hpMax){this.hp++}},
        controller    :   function(){
            return (player?player:null);
        },
		controllerId	:	function(){
			return (player?player.id:null);
		},
		id : function(){ return myId; },
        canActNow : function(tick){
            return (this.cantActUntilTick <= tick);
        },
        lagUntil : function(tick){
            this.cantActUntilTick = tick;
        },
		behave	:	function(ticks){

            if (this.canActNow(ticks)){
                var enemy = world.closeEnemy(this);
                if (enemy){
                    this.lagUntil(ticks+10);
                    this.attack(enemy);
                    if (!this.controllerId()) {return;}
                }
			    var destination = this.nextDestination();

			    if (destination){world.moveMobToXY(this,destination.x,destination.y);}
            }
		},
        attack : function(enemyMob){
            publishAttack(this,enemyMob);
            enemyMob.hurt(this);

        },
        hurt : function(attacker){
            this.hp -= d(6) ;
        },
		nextDestination	:	function(){
            var distant = 2;
			if (close(this.x,this.destX,3)){
                this.destX = this.x;
                distant--
            }
            if (close(this.y,this.destY,3)){
                this.destY = this.y;
                distant--
            }
            if (!distant){
				this.setupNextDestination();
                return;
            }

			var dest = this.tryMove();
            if (dest){return dest;}

			return null;
			
		},
		setupNextDestination: function(){
			if (this.controllerId()){ return; }
			this.destX = d(2000);
			this.destY = d(700);
		},
		tryMove:	function(){
            var dx = this.destX - this.x;
            var dy = this.destY - this.y;

            var length = Math.sqrt( dx*dx+dy*dy );
            if (length < 1){ this.destX = this.x; this.destY = this.y; return;}

            dx /= length;
            dy /= length;

            dx *=2;
            dy *=2;

            if (!world.occupiedXY(this.x+dx,this.y+dy,this)){
                this.tickSinceLastMove=0;
                return {x:this.x+dx, y:this.y+dy};
            }
            dx = sign(dx)*2;
            dy = sign(dy)*2;
            if (!world.occupiedXY(this.x+dx,this.y,this)){
                this.tickSinceLastMove=0;
                return {x:this.x+dx, y:this.y};
            }
            if (!world.occupiedXY(this.x,this.y+dy,this)){
                this.tickSinceLastMove=0;
                return {x:this.x, y:this.y+dy};
            }
            this.tickSinceLastMove++;
            if (this.tickSinceLastMove > 50){
                this.tickSinceLastMove=0;
                if (this.controller()){
                    this.heal1HP();
                    return;
                }
                this.setupNextDestination();
            }
		}
	};

	return mob;
}
function sign(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }

function Ticker(msTick){
	var last_tick_started_at = new Date().getTime();

	var running = false;
	var time = 0;
    var tickCount = 0;
	return {
		tickStart	: function(){
			if (running){return false;}
			var now = new Date().getTime();
			if (now - last_tick_started_at < msTick){
				return false;
			}
            tickCount++;
            if (this.lastSeconds() != Math.floor(now/1000)){
                console.log("tick per second:"+tickCount);
                console.log("mobs:"+world.mobCount());
                tickCount = 0;
            }
			running = true;
			last_tick_started_at = now;
			time++;
			return true;
		},
		tickDone	: function(){
			running = false;
		},
		ticks	:	function(){return time;},
        lastSeconds:function(){return Math.floor(last_tick_started_at/1000);}
	};
}
function SpecialEventGenerator(){
    var next_event_not_before = new Date().getTime()+6000;
    var running = false;
    var time = 0;
    return {
        specialEvent	: function(){

            return;

            if (players.length == 0){return;}

            var now = new Date().getTime();
            if (now < next_event_not_before){
                return false;
            }

            this.horde();

            next_event_not_before = now + (d(60)+d(60)+30) *1000;
            return true;
        },
        horde   :   function(){

            var rndX = (d(2)-1.5)*2000+500;
            var rndY = (d(2)-1.5)*1000+300;


            for (var i = d(50)+6; i>0;i--){
                var hordling = spawnMob(null,rndX,rndY,500);
                if(hordling) {
                    hordling.hp = d(2);
                    hordling.destX = 1000+100+d(200);
                    hordling.destY = 600 +100+d(200);
                }
            }
        }
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
function publishRemoveMob(mob,cause){
    publish("remove mob",{id: mob.id(), cause:cause});
}
function publishBuild(building){
    publish("build",{ id:building.id(), controller:building.controllerId(), x:building.x, y:building.y, width:building.width(), depth:building.depth(), type: building.type() });
}
function publishRemoveBuilding(building,cause){
    publish("remove building",{id: building.id(), cause:cause});
}
function publishAttack(attacker,defender){
    publish("attack",{id: attacker.id(), target:defender.id()});
}

init();



var shenaniganSource = SpecialEventGenerator();

var tick_action = function() {
	if (ticker.tickStart()){

        shenaniganSource.specialEvent();

		
		world.mobForEach(
			function(mob){
				mob.behave(ticker.ticks());
			}
		);

        world.buildingForEach(
            function (building){
                building.behave(ticker.ticks());
            }
        )

        world.cleanUpCorpses();
		ticker.tickDone();
	}

};
setInterval(tick_action,20);

tick_action();



