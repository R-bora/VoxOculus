const express = require('express');
const { Server } = require('ws');
const speech = require('@google-cloud/speech');

// Initialize the Google Speech Client using your credentials file
const speechClient = new speech.SpeechClient({
  keyFilename: './google-creds.json'
});

const app = express();
const server = app.listen(3000, () => console.log('🚀 Server running on http://localhost:3000'));
const wss = new Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected for live streaming...');
  let recognizeStream = null;

  // Configure the Google Cloud Speech request parameters
  const request = {
    config: {
      encoding: 'WEBM_OPUS', // Matches the audio format from the browser
      sampleRateHertz: 48000,
      languageCode: 'en-US',
    },
    interimResults: true, // This allows you to see words live as you speak
  };

  ws.on('message', (message) => {
    // Start the Google stream if it hasn't started yet
    if (!recognizeStream) {
      recognizeStream = speechClient
        .streamingRecognize(request)
        .on('error', (err) => console.error('Google API Error:', err))
        .on('data', (data) => {
          // Extract the transcript text from Google's response
          const transcript = data.results[0]?.alternatives[0]?.transcript || '';
          const isFinal = data.results[0]?.isFinal || false;

          // Send the live text back to your HTML frontend
          ws.send(JSON.stringify({ transcript, isFinal }));
        });
    }

    // Pass the raw binary audio data straight to Google ONLY if the stream is active
if (Buffer.isBuffer(message) && recognizeStream && recognizeStream.writable) {
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
