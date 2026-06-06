const express = require('express');
const { Server } = require('ws');
const speech = require('@google-cloud/speech');

const speechClient = new speech.SpeechClient({
  keyFilename: './google-creds.json' 
});

const app = express();
const server = app.listen(3000, () => console.log('🚀 Server running on http://localhost:3000'));
const wss = new Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected for live streaming...');
  let recognizeStream = null;

  const request = {
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode: 'en-US',
    },
    interimResults: true,
  };

  ws.on('message', (message) => {
    if (!recognizeStream) {
      recognizeStream = speechClient
        .streamingRecognize(request)
        .on('error', (err) => {
          console.error('Google API Error:', err.message);
          // Send errors down the pipe to be caught by toast notifications
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ error: err.message }));
          }
        })
        .on('data', (data) => {
          // Safeguard against metadata updates containing blank text blocks
          const result = data.results[0];
          if (result && result.alternatives && result.alternatives[0]) {
            const transcript = result.alternatives[0].transcript;
            const isFinal = result.isFinal || false;
            
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ transcript, isFinal }));
            }
          }
        });
    }

    if (Buffer.isBuffer(message) && recognizeStream) {
      recognizeStream.write(message);
    }
  });

  ws.on('close', () => {
    if (recognizeStream) {
      recognizeStream.end();
    }
    console.log('Client disconnected.');
  });
});
