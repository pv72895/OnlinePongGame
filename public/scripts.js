var socket = io();

var name = "";
var loggedIn = false;

var timeoutId = 0;

var spectator = true;

//Setting up canvas
var ctx = document.getElementById('ctx').getContext("2d");
ctx.font = '30px Arial';

//Function for when the user attempts to login
var login = function(enteredName){
	if (loggedIn == false) {
		if (enteredName.length > 5) {
			loggedInString = "There is a 5 character length limit on user names. Try again.";
			document.getElementById('alreadyLoggedIn').innerHTML=loggedInString;
		} else {
			socket.emit('newPlayer', {
				userName: enteredName,
				spectator: document.getElementById('spec').checked,
			});
			spectator = (document.getElementById('spec')).checked;
			loggedIn = true;
		}
	} else {
		loggedInString="You are already logged in! You cannot register again.";
		document.getElementById('alreadyLoggedIn').innerHTML=loggedInString;
	}
}

function buttonPress(keyCode){
	if(spectator == false){
		if (keyCode == 83) {
			socket.emit('keyPress',{inputID:'down', state:true});
		} else if (keyCode == 87) {
			socket.emit('keyPress',{inputID:'up', state:true});
		}
	}
};


socket.on('yourName', function(data){
	name = data.name;
	var teamString = "";
	
	if(data.team === "L"){
		teamString = "Left Paddle";
	} else if (data.team === "R") {
		teamString = "Right Paddle";
	} else {
		teamString = "SPECTATOR";
	}
	
	var welcomeString = 'Welcome! Your username is: ' + name;
	welcomeString += "<br>";
	welcomeString += "You are on team: " + teamString;
    document.getElementById('loginInfoScreen').innerHTML=welcomeString;
});

socket.on('pongInfo', function(data){
	ctx.clearRect(0,0,500,500);
	
	//Draw left paddle
	ctx.beginPath();
	ctx.strokeStyle = '#003300';
	ctx.fillStyle = 'black';
	ctx.rect(data.leftPaddleX, data.leftPaddleY, data.paddleWidth, data.paddleHeight);
	ctx.fill();
	ctx.stroke();
	ctx.closePath();
	
	//Draw right paddle
	ctx.beginPath();
	ctx.strokeStyle = '#003300';
	ctx.fillStyle = 'black';
	ctx.rect(data.rightPaddleX, data.rightPaddleY, data.paddleWidth, data.paddleHeight);
	ctx.fill();
	ctx.stroke();
	ctx.closePath();
	
	//Draw ball
	ctx.beginPath();
	ctx.arc(data.ballX, data.ballY, 5, 0, 2 * Math.PI, false);
	ctx.fill();
	ctx.stroke();
	ctx.closePath();
	
	//Draw scores
	ctx.fillText(data.lScore, 190, 30);
	ctx.fillText(data.rScore, 290, 30);
	
	//Draw dividing line
	ctx.beginPath();
	ctx.moveTo(250,0);
	ctx.lineTo(250,500);
	ctx.stroke();
	ctx.closePath();
	
});

socket.on('playerInfo', function(data){
	
	var teamLString = "";
	var teamRString = "";
	
	for(var i = 0; i < data.length; i++){
		if (data[i].team === "L"){
			teamLString += "<div id='playerIcon'>";
			teamLString += data[i].name + ": "
			if(data[i].isUp == true){
				teamLString += "&nbsp;&nbsp;&uarr;&nbsp; ";
			} else if (data[i].isDown == true) {
				teamLString += "&nbsp;&nbsp;&darr;&nbsp; ";
			} else {
				teamLString += "  NA";
			}
			teamLString += "</div>";
		} else if (data[i].team === "R"){
			teamRString += "<div id='playerIcon'>";
			teamRString += data[i].name + ": "
			if(data[i].isUp == true){
				teamRString += "&nbsp;&nbsp;&uarr;&nbsp; ";
			} else if (data[i].isDown == true) {
				teamRString += "&nbsp;&nbsp;&darr;&nbsp; ";
			} else {
				teamRString += "  NA";
			}
			teamRString += "</div>";
		}
	}
	
	document.getElementById('leftPaddles').innerHTML = "Left team: <br> " + teamLString;
	document.getElementById('rightPaddles').innerHTML = "Right team: <br>" + teamRString;
	
});

document.onkeydown = function(event){
	if(spectator == false) {
		if(event.keyCode === 87 || event.keyCode === 38) {
			socket.emit('keyPress',{inputID:'up', state:true});
		} else if (event.keyCode === 83 || event.keyCode === 40) {
			socket.emit('keyPress',{inputID:'down', state:true});
		}
	}
}

document.onkeyup = function(event){
	if(spectator == false) {
		if(event.keyCode === 87 || event.keyCode === 38) {
			socket.emit('keyPress',{inputID:'up', state:false});
		} else if (event.keyCode === 83 || event.keyCode === 40) {
			socket.emit('keyPress',{inputID:'down', state:false});
		}
	}
}

window.onload = function() {
    $('#arrowUp').on('mousedown',function(){
		timeoutId = setInterval(function() { buttonPress(87);}, 100);
	}).on('mouseup mouseleave', function(){
		clearInterval(timeoutId);
		socket.emit('keyPress',{inputID:'up', state:false});
	});
	$('#arrowDown').on('mousedown',function(){
		timeoutId = setInterval(function() { buttonPress(83);}, 100);
	}).on('mouseup mouseleave', function(){
		socket.emit('keyPress',{inputID:'down', state:false});
		clearInterval(timeoutId);
	});
}