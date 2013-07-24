var Player = function(startX, startY) {
    var x = startX,
        y = startY,
        id,
        mobCount = 0;

    var getX = function() {
        return x;
    };

    var getY = function() {
        return y;
    };

    var setX = function(newX) {
        x = newX;
    };

    var setY = function(newY) {
        y = newY;
    };

    return {
        canControlMoreMobs : function(){
            return (mobCount < 50);
        },
        setMobCount: function(count){
            mobCount = count;
        },
        getX: getX,
        getY: getY,
        setX: setX,
        setY: setY,
        id: id
    }
};

exports.Player = Player;