/*
 * PHILIP VENDOLA
 * CSE 264
 * FINAL PROJECT
 * MAY 13th, 2017
 */
 
//Load the necessary libraries
var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var app = express();
var serv = require('http').Server(app);
var _ = require('underscore');

var io = require('socket.io')(serv,{});

//Ton of global variables
var SOCKET_LIST = {};
var PLAYER_LIST = {};

//Number of people on the left and right team
var numLeft = 0;
var numRight = 0;

//Definitions of each paddle
var paddleWidth = 20;
var paddleHeight = 100;
var leftPaddleX = 20;
var rightPaddleX = 460;

//Positions of the paddle and ball
var globalLY = 250;
var globalRY = 250;
var globalBallX = 250;
var globalBallY = 250;

//Speeds of the paddle at current time
var paddleLSpeed = 0;
var paddleRSpeed = 0;

//Speeds of the ball
var maxSpd = 10;
var xSpd = 3;
var ySpd = 0;
var lastXSpd = 0;
var lastYSpd = 0;
var onHold = false;

//Scores
var lScore = 0;
var rScore = 0;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // Note: extended:true
app.use(express.static(path.join(__dirname, 'public')));

//Create a player variable
//Since all players will be getting the same information about the pong layout,
//This packet serves to tell every player what key each player is holding
var Player = function(id){
	var self = {
		team: "",
		isUp: false,
		isDown: false,
		id:id,
		name: "",
	}
	
	return self;
};

io.sockets.on('connection', function(socket){
	console.log('Socket connection');
	
	//Assign a random ID to each socket
	socket.id = Math.random();
	var player = Player(socket.id);
	
	//Once they have logged in, add them to the lists
	socket.on('newPlayer', function(data){
		var name = data.userName;
		var nameCheck = 0;
		var team = "";
		
		

		//Determine uniqueness of username
		//A bug here is that it is possible for a username to go over 8 characters as '#' are added
		while(nameCheck == 0){
			nameCheck = 1;
			for(var i in SOCKET_LIST){
				console.log(i);
				var testSocket = SOCKET_LIST[i];
				console.log(testSocket.name);
				if (testSocket.name === name) {
					name = name + "#";
					nameCheck = 0;
				}
			}
		}
		
		nameCheck = 0;
		
		//Determine what team to put the player on
		if(data.spectator == false) {
			if(numLeft == numRight){
				team = "L";
				numLeft++;
			} else if (numLeft > numRight){
				team = "R";
				numRight++;
			} else if (numLeft < numRight){
				team = "L";
				numLeft++;
			}
		} else {
			team = "SPECTATOR";
		}
		
		//Tell the server a new player connected
		console.log('New player connected: ' + name + ' on team: ' + team);
		
		//Set up the socket with initial info
		socket.name = name;
		player.name = name;
		player.team = team;
		socket.paddleWidth = paddleWidth;
		socket.paddleHeight = paddleHeight;
		socket.leftPaddleX = leftPaddleX;
		socket.leftPaddleY = globalLY;
		socket.rightPaddleX = rightPaddleX;
		socket.rightPaddleY = globalRY;
		socket.ballX = globalBallX;
		socket.ballY = globalBallY;
		socket.lScore = lScore;
		socket.rScore = rScore;
		SOCKET_LIST[socket.id] = socket;
		if(player.team != "SPECTATOR"){
			PLAYER_LIST[socket.id] = player;
		}
		
		//Notify the player of their name and team
		socket.emit('yourName', {
			name: socket.name,
			team: player.team,
		});
	});
	
	//When the client presses a key, determine the key and assign that variable to the player
	socket.on('keyPress',function(data){
		if(data.inputID === 'up'){
			player.isUp = data.state;
		} else if (data.inputID === 'down') {
			player.isDown = data.state;
		}
	});
	
	//On disconnect, remove the palyer from the game
	socket.on('disconnect', function(){
		if(player.team === "L") {
			numLeft--;
		} else if(player.team === "R") {
			numRight--;
		}
		if(socket.team === "SPECTATOR"){
			delete SOCKET_LIST[socket.id];
		} else {
			delete SOCKET_LIST[socket.id];
			delete PLAYER_LIST[socket.id];
		}
	});
	
	socket.emit('serverMsg',{
		msg:'Connected!',
	});
	
});

//Determine if a paddle should be moved or not (all players are in unison)
function determineMovement(players, team){
	var groupedArrays = _.groupBy(players, "team");
	var numUp = 0;
	var numDown = 0;
	var numNA = 0;
	var moveUp = true;
	var moveDown = true;
	
	if(team === "L" && numLeft === 0) {
		return [false, false];
	} else if (team === "R" && numRight === 0) {
		return [false, false];
	}
	
	for( i in groupedArrays[team]) {
		if (groupedArrays[team][i].isUp == true) {
			numUp++;
		}
		if (groupedArrays[team][i].isDown == true) {
			numDown++;
		}
		if (groupedArrays[team][i].isUp == false && groupedArrays[team][i].isDown == false){
			numNA++;
		}
	}
	if (numUp > numDown && numUp > numNA){
		moveUp = true;
		moveDown = false;
	} else if (numUp < numDown && numDown > numNA) {
		moveUp = false;
		moveDown = true;
	} else if (numUp == numNA){
		moveUp = true;
		moveDown = false;
	} else if (numDown == numNA) {
		moveUp = false;
		moveDown = true;
	} else {
		moveUp = false;
		moveDown = false;
	}
	return [moveUp, moveDown];
};

//The main mechanics of the pong game
//Determine the new speed and position of the ball, and if a point was scored
function updateBallPositionAndSpeed(paddleLX, paddleLY, paddleRX, paddleRY, ballX, ballY, xSpeed, ySpeed, paddleHeight, paddleWidth, paddleLSpeed, paddleRSpeed, lScr, rScr){
	
	ballX += xSpeed;
	ballY += ySpeed;
	
	var top_x = ballX - 10; //10 is the radius, will have to fix this eventually
	var top_y = ballY - 10;
	var bottom_x = ballX + 10;
	var bottom_y = ballY  + 10;
	
	if(ballY - 10 < 0) { // hitting the bottom wall
		ballY = 5;
		ySpeed = -ySpeed;
	} else if(ballY + 10 > 500) { // hitting the top wall
		ballY = 495;
		ySpeed = -ySpeed;
	}

	//A point was scored if wither of the next two conditions are met
	if(ballX < 0){
		ySpeed = 0;
		xSpeed = 3;
		ballX = 250;
		ballY = 250;
		rScr++;
	} else if (ballX > 500) {
		ySpeed = 0;
		xSpeed = -3;
		ballX = 250;
		ballY = 250;
		lScr++;
	}

	if(bottom_x < 250) {
		// hit the L player's paddle
		if(top_y < (paddleLY + paddleHeight) && bottom_y > paddleLY && top_x < (paddleLX + paddleWidth) && bottom_x > paddleLX) {
			//Hit the top of the paddle
			if(top_y == (paddleLY + paddleHeight) - 10 && paddleLSpeed != 0){
				ySpeed += (paddleLSpeed);
				ballX += xSpeed ;
			//Hit the bottom of the paddle
			} else if(bottom_y == (paddleLY + 10) && paddleLSpeed != 0){
				ySpeed += (paddleLSpeed);
				ballX += xSpeed;
			} else {
				//console.log("PADDLE Y: " + paddleLY + "BOTTOM Y: " + bottom_y);
				xSpeed = 3 + (-1 * xSpeed);
				ySpeed += (paddleLSpeed / 2);
				ballX += (xSpeed + 2);
			}
		}
	} else {
		// hit the R player's paddle
		if(top_y < (paddleRY + paddleHeight) && bottom_y > paddleRY && top_x < (paddleRX + paddleWidth) && bottom_x > paddleRX) {
			//Hit the top of the paddle
			if(top_y == (paddleRY + paddleHeight) - 10 && paddleRSpeed != 0){
				ySpeed += (paddleRSpeed);
				ballX += xSpeed;
			//Hit the bottom of the paddle
			} else if (bottom_y == (paddleRY + 10) && paddleLSpeed != 0){
				ySpeed += (paddleRSpeed);
				ballX += xSpeed;
			} else {
				xSpeed = -3 + (-1 * xSpeed);
				ySpeed += (paddleRSpeed / 2);
				ballX += (xSpeed - 2);
			}
		}
	}
  
  return [ballX, ballY, xSpeed, ySpeed, lScr, rScr];
}

setInterval(function() {
	var pack = [];
	
	//This function determines if a team is in unison.
	//If they are, move the paddle
	var movementsL = determineMovement(PLAYER_LIST,"L");
	var movementsR = determineMovement(PLAYER_LIST,"R");
	
	if (movementsL[0] == true) {
		if(globalLY - maxSpd >= 0) {
			globalLY = globalLY - maxSpd;
			paddleLSpeed = -maxSpd;
		}
	} else if (movementsL[1] == true){
		if((globalLY + paddleHeight) + maxSpd <= 500){
			globalLY = globalLY + maxSpd;
			paddleLSpeed = maxSpd;
		}
	} else {
		paddleLSpeed = 0;
	}
		
	if (movementsR[0] == true) {
		if(globalRY - maxSpd >= 0) {
			globalRY = globalRY - maxSpd;
			paddleRSpeed = -maxSpd;
		}
	} else if (movementsR[1] == true){
		if((globalRY + paddleHeight) + maxSpd <= 500) {
			globalRY = globalRY + maxSpd;
			paddleRSpeed = maxSpd;
		}
	} else {
		paddleRSpeed = 0;
	}
	
	//This function determines if the ball is colliding with a paddle
	//If so, change the direction of the ball
	var newBallXYAndSpeed;
	if (numLeft > 0 && numRight > 0) {
		if(onHold == true){
			xSpd = lastXSpd;
			ySpd = lastYSpd;
			onHold = false;
		}
		newBallXYAndSpeed = updateBallPositionAndSpeed(leftPaddleX, globalLY, rightPaddleX, globalRY, globalBallX, globalBallY, xSpd, ySpd, paddleHeight, paddleWidth, paddleLSpeed, paddleRSpeed, lScore, rScore);
	} else {
		if(onHold == false){
			lastXSpd = xSpd;
			lastYSpd = ySpd;
			onHold = true;
		}
		newBallXYAndSpeed = [globalBallX, globalBallY, 0, 0, lScore, rScore];
	}
	
	globalBallX = newBallXYAndSpeed[0];
	globalBallY = newBallXYAndSpeed[1];
	xSpd = newBallXYAndSpeed[2];
	ySpd = newBallXYAndSpeed[3];
	lScore = newBallXYAndSpeed[4];
	rScore = newBallXYAndSpeed[5];
	
	
	for (var i in SOCKET_LIST){
		//This information is constant between all players
		var socket = SOCKET_LIST[i];
		
		socket.leftPaddleX = leftPaddleX;
		socket.leftPaddleY = globalLY;
		socket.rightPaddleX = rightPaddleX;
		socket.rightPaddleY = globalRY;
		socket.ballX = globalBallX;
		socket.ballY = globalBallY;
		socket.rScore = rScore;
		socket.lScore = lScore;
	}
	
	for (var i in PLAYER_LIST){
		//This information changes based on player actions
		var player = PLAYER_LIST[i];
		pack.push({
			id: player.id,
			name: player.name,
			isUp: player.isUp,
			isDown: player.isDown,
			team: player.team,
		});
	}
	
 	for (var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('pongInfo',{
			keyPresses: pack,
			ballX: socket.ballX,
			bally: socket.bally,
			leftPaddleX: socket.leftPaddleX,
			leftPaddleY: socket.leftPaddleY,
			rightPaddleX: socket.rightPaddleX,
			rightPaddleY: socket.rightPaddleY,
			paddleWidth: socket.paddleWidth,
			paddleHeight: socket.paddleHeight,
			ballX: socket.ballX,
			ballY: socket.ballY,
			lScore: socket.lScore,
			rScore: socket.rScore,
			
		});
		socket.emit('playerInfo',pack);
	} 
	
	
	
}, 1000/25);

app.get("/", function(req, res) {
  // Send the page itself to the browser
  res.sendFile(path.join(__dirname, '/client/index.html'));
});

serv.listen(process.env.PORT || 3000, function() {
  console.log("Express app started on port 3000.");
});