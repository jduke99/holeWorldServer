'use strict';

const express = require('express');
const { Server } = require('ws');

const PORT = process.env.PORT || 3000;
const INDEX = '/index.html';

const server = express()
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new Server({ server });

// wss.on('connection', (ws) => {
//   console.log('Client connected');
//   ws.on('close', () => console.log('Client disconnected'));
// });

// setInterval(() => {
//   wss.clients.forEach((client) => {
//     client.send(new Date().toTimeString());
//   });
// }, 1000);


// Create an object to store room information
const rooms = {};
const players={};
const clients={};

let nextClientId = 1;

// Function to generate a random short code
function generateShortCode(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters.charAt(randomIndex);
  }

  return code;
}


// Function to log players in a given room
function logPlayersInRoom(roomCode) {
  const room = rooms[roomCode];

  if (room) {
    console.log(`Players in room ${roomCode}:`);
    room.players.forEach((playerInRoom, index) => {
      console.log(`Player ${index + 1}: ${playerInRoom.name}`);
      // You can log other player information as needed
    });
  } else {
    console.log(`Room ${roomCode} not found.`);
  }
}

function createBall(player, speed, angle, skin, powerup) {
  const ball = {
    player: player,
    speed: speed,
    angle: angle,
    skin: skin,
    powerup: powerup,
    // Add more ball attributes as needed
  };

  const roomCode = player.roomCode; // Assuming you have the roomCode associated with the player
  const playersInRoom = rooms[roomCode].players;
  const randomPlayerIndex = Math.floor(Math.random() * playersInRoom.length);

  // Get the randomly selected player's WebSocket connection
  const randomPlayerWs = playersInRoom[randomPlayerIndex];

  if (randomPlayerWs) {
    // Send a message to the randomly selected player
    const messageToRandomPlayer = {
      type: 'ballCreated',
      ball: ball,
    };

    // Convert the message to JSON and send it
    clients[randomPlayerWs.id].ws.send(JSON.stringify(messageToRandomPlayer));

    console.log('Ball created and sent to '+randomPlayerWs.name+' in the room via'+JSON.stringify(messageToRandomPlayer));
  } else {
    console.log(`No other players in the room to send the ball.`);
  }

}

wss.on('connection', (ws, request) => {
  const clientId = nextClientId++;
  
  ws.clientId = clientId;

  clients[ws.clientId]= {
    ws: ws
  }

  players[ws.clientId] = {
    id: ws.clientId,
    name: `Player ${ws.clientId}`,
    ballColor: 'defaultColor',
    explosionType: 'defaultExplosion',
    // Add more attributes as needed
  };

  const player = players[ws.clientId]

  // Log the client's remote address and the assigned ID
  console.log(`Client connected from ${request.connection.remoteAddress} with ID ${ws.clientId} and name ${player.name}`);

  ws.on('message', (message) => {
    const parsedMessage = JSON.parse(message);

    if (parsedMessage.type === 'createRoom') {
      // Generate a unique short code for the room (e.g., 4 characters)
      let roomCode;
      do {
        roomCode = generateShortCode(4); // Adjust the length as needed
      } while (rooms[roomCode]);

      // Store the room information
      rooms[roomCode] = {
        players: [player], // Store the first player in the room
      };

      player.roomCode=roomCode

      // Send the room code back to the user
      ws.send(JSON.stringify({ type: 'roomCode', code: roomCode }));
      console.log("Room "+roomCode+" created!"); 

    } else if (parsedMessage.type === 'joinRoom') {
      const roomCode = parsedMessage.code;

      // Check if the room exists
      if (rooms[roomCode]) {
        // Add the user to the room
        rooms[roomCode].players.push(player);
        console.log(JSON.stringify(rooms[roomCode]))

        // Send a message to confirm joining
        ws.send(JSON.stringify({ type: 'joinedRoom', code: roomCode }));
        player.roomCode=roomCode
      } else {
        // Send an error message if the room doesn't exist
        ws.send(JSON.stringify({ type: 'roomNotFound', message: 'Room not found' }));
      }
      logPlayersInRoom(roomCode);

    } else if (parsedMessage.type === 'setPlayerAttributes') {
      // Update player attributes based on the received message
      if (parsedMessage.attributes.name) {
        player.name = parsedMessage.attributes.name;
        console.log(`Player ${clientId} updated their name to: ${player.name}`);
      }
      if (parsedMessage.attributes.ballColor) {
        player.ballColor = parsedMessage.attributes.ballColor;
        console.log(`Player ${clientId} updated their ball color to: ${player.ballColor}`);
      }
      if (parsedMessage.attributes.explosionType) {
        player.explosionType = parsedMessage.attributes.explosionType;
        console.log(`Player ${clientId} updated their explosion type to: ${player.explosionType}`);
      }
      // Add more attribute updates as needed
    } else if (parsedMessage.type === 'createBall') {
      // Handle the 'createBall' message
      const player = players[clientId]; // Get the player who created the ball
      const ballSpeed = parsedMessage.ballSpeed; // Get the ball speed
      const ballAngle = parsedMessage.ballAngle; // Get the ball angle
      const ballSkin = parsedMessage.ballSkin; // Get the ball skin
      const powerUp = parsedMessage.powerUp; // Get the powerup attribute

      createBall(player,ballSpeed,ballAngle,ballSkin,powerUp)

    }

    // Handle other message types as needed
  });

  ws.on('close', () => {
    // Handle WebSocket close event and remove the user from the room
    console.log(`Client with ID ${ws.clientId} disconnected`);
    delete players[ws.clientId];
  });
});
