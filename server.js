const express = require('express');
const { Server } = require('ws');
const WebSocket = require('ws'); 

const app = express();
const server = app.listen(3000, () => console.log('🚀 Server running on http://localhost:3000'));
const wss = new Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected for live streaming...');

  // 1. Connect to Deepgram immediately so it is ready in time
  const deepgramStream = new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true', {
    headers: {
      Authorization: 'Token 98bceafab648036bbd8f140f3f9fefe9be1a8f12'
    }
  });

  // Temporary storage to hold the first audio chunks while connecting
  let audioQueue = [];

  deepgramStream.on('open', () => {
    console.log('⚡ Connected to Deepgram API successfully!');
    // Flush any chunks we saved while waiting
    while (audioQueue.length > 0) {
      const chunk = audioQueue.shift();
      deepgramStream.send(chunk);
    }
  });

  deepgramStream.on('message', (data) => {
    try {
      const response = JSON.parse(data.toString());
      const transcript = response.channel?.alternatives[0]?.transcript || '';
      const isFinal = response.is_final || false;

      if (transcript) {
        // 📋 This will print the text live directly into your Render logs!
        console.log(`📝 Live Transcript: ${transcript}`);
        
        // Send the transcript back to your HTML frontend
        ws.send(JSON.stringify({ transcript, isFinal }));
      }
    } catch (err) {
      console.error('Error parsing Deepgram message:', err);
    }
  });

  deepgramStream.on('error', (err) => {
    console.error('Deepgram API Error:', err);
  });

  ws.on('message', (message) => {
    if (Buffer.isBuffer(message)) {
      if (deepgramStream.readyState === WebSocket.OPEN) {
        // If connection is fully open, send audio directly
        deepgramStream.send(message);
      } else if (deepgramStream.readyState === WebSocket.CONNECTING) {
        // Queue the vital early audio chunks so we don't lose the format headers
        audioQueue.push(message);
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected.');
    if (deepgramStream.readyState === WebSocket.OPEN || deepgramStream.readyState === WebSocket.CONNECTING) {
      deepgramStream.close();
    }
  });
});
