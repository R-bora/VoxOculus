const express = require('express');
const { Server } = require('ws');
const WebSocket = require('ws'); 

const app = express();
const server = app.listen(3000, () => console.log('🚀 Server running on http://localhost:3000'));
const wss = new Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected for live streaming...');
  let deepgramStream = null;

  ws.on('message', (message) => {
    // 1. Start the Deepgram stream if it hasn't started yet
    if (!deepgramStream) {
      deepgramStream = new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true', {
        headers: {
          Authorization: 'Token 98bceafab648036bbd8f140f3f9fefe9be1a8f12' // 🔑 Your key is active here
        }
      });

      // Handle live words coming back from Deepgram
      deepgramStream.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          const transcript = response.channel?.alternatives[0]?.transcript || '';
          const isFinal = response.is_final || false;

          // Send the transcript back to your HTML frontend
          if (transcript) {
            ws.send(JSON.stringify({ transcript, isFinal }));
          }
        } catch (err) {
          console.error('Error parsing Deepgram message:', err);
        }
      });

      deepgramStream.on('error', (err) => {
        console.error('Deepgram API Error:', err);
        deepgramStream = null;
      });

      deepgramStream.on('close', () => {
        deepgramStream = null;
      });
    }

    // 2. Pass the raw audio data straight to Deepgram if connection is open
    if (Buffer.isBuffer(message) && deepgramStream && deepgramStream.readyState === WebSocket.OPEN) {
      deepgramStream.send(message);
    }
  });

  ws.on('close', () => {
    if (deepgramStream) {
      deepgramStream.close();
    }
    console.log('Client disconnected.');
  });
});
