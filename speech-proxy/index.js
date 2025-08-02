// speech-proxy/index.js

// File: speech-proxy/index.js
// Description: This proxy uses the official Google Cloud Speech client library
// and is configured to run as a standalone service on Google App Engine.

const http = require('http');
const WebSocket = require('ws');
const { SpeechClient } = require('@google-cloud/speech');

// Create a standard HTTP server. App Engine will send health checks to this server.
const server = http.createServer((req, res) => {
  // Standard health check response
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

// Attach the WebSocket server to the HTTP server.
const wss = new WebSocket.Server({ server });

wss.on('connection', (clientWs) => {
    console.log('[Proxy] Client connected.');

    let recognizeStream = null;
    const speechClient = new SpeechClient();

    clientWs.on('message', (message) => {
        try {
            // The first message from the client should be the JSON configuration.
            const msg = JSON.parse(message);
            
            if (recognizeStream) {
                recognizeStream.end();
            }

            const requestConfig = {
                config: msg.streaming_config.config,
                interimResults: msg.streaming_config.interim_results,
            };

            console.log('[Proxy] Received configuration from client:', JSON.stringify(requestConfig.config, null, 2));

            recognizeStream = speechClient
                .streamingRecognize(requestConfig)
                .on('error', (error) => {
                    console.error('[Google] Error from recognizeStream:', error);
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify({ error: { message: `Google Speech API Error: ${error.message}` } }));
                        clientWs.close();
                    }
                })
                .on('data', (data) => {
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify(data));
                    }
                });
            
            console.log('[Proxy] Successfully established stream to Google Speech API.');

        } catch (error) {
            // If JSON.parse fails, it's binary audio data.
            if (recognizeStream) {
                recognizeStream.write(message);
            } else {
                console.warn('[Proxy] Received audio data before configuration was sent. Discarding.');
            }
        }
    });

    clientWs.on('close', () => {
        console.log('[Proxy] Client disconnected.');
        if (recognizeStream) {
            recognizeStream.end();
        }
    });

    clientWs.on('error', (error) => {
        console.error('[Proxy] Error from client WebSocket:', error);
        if (recognizeStream) {
            recognizeStream.end();
        }
    });
});

// App Engine provides the port number via the PORT environment variable.
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`[Proxy] Server listening on port ${PORT}`);
});