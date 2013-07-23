/**************************************************
** GAME PLAYER CLASS
**************************************************/
var Player = function(startX, startY, id) {
	this.x = startX;
	this.y = startY;
	this.id = id;
	var moveAmount = 2;
		
	this.update = function(keys) {
		var prevX = this.x,
			prevY = this.y;
		// Up key takes priority over down
		if (pig.keys[pig.key.UP]) {
			this.y -= moveAmount;
		} else if (pig.keys[pig.key.DOWN]) {
			this.y += moveAmount;
		};

		// Left key takes priority over right
		if (pig.keys[pig.key.LEFT]) {
			this.x -= moveAmount;
		} else if (pig.keys[pig.key.RIGHT]) {
			this.x += moveAmount;
		};
		
		return (prevX != this.x || prevY != this.y) ? true : false;
	};

	this.draw = function(ctx) {
		ctx.fillRect(x-5, y-5, 10, 10);
		
	};
};
