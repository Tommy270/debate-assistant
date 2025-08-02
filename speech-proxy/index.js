// File: speech-proxy/index.js
// Description: This updated proxy uses the official Google Cloud Speech client library
// to ensure a stable and correct connection to the Speech-to-Text API.

const functions = require('@google-cloud/functions-framework');
const WebSocket = require('ws');
// Import the official Google Speech client
const { SpeechClient } = require('@google-cloud/speech');

// Create a WebSocket server. This server will handle incoming connections from your React app.
const wss = new WebSocket.Server({ noServer: true });

// This is the main entry point for the HTTP-triggered Cloud Function.
// It will upgrade the incoming HTTP request to a WebSocket connection.
functions.http('speechProxy', (req, res) => {
    // Use the 'upgrade' event to hook into the request.
    res.socket.server.on('upgrade', (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (ws) => {
            // When the upgrade is successful, the server emits a 'connection' event.
            wss.emit('connection', ws, request);
        });
    });
});

// This event listener handles each new connection from your React app.
wss.on('connection', (clientWs) => {
    console.log('[Proxy] Client connected.');

    let recognizeStream = null;
    // Create a new SpeechClient instance for each connection.
    const speechClient = new SpeechClient();

    clientWs.on('message', (message) => {
        // The first message from the client is always the JSON configuration.
        // All subsequent messages are binary audio data.
        try {
            // Attempt to parse the message as JSON.
            const msg = JSON.parse(message);
            
            // If parsing succeeds, it's the configuration message.
            const requestConfig = {
                config: msg.streaming_config.config,
                interimResults: msg.streaming_config.interim_results,
            };

            console.log('[Proxy] Received configuration from client:', JSON.stringify(requestConfig.config, null, 2));

            // Now that we have the config, create the streaming recognize request to Google.
            recognizeStream = speechClient
                .streamingRecognize(requestConfig)
                .on('error', (error) => {
                    console.error('[Google] Error from recognizeStream:', error);
                    // Notify the client of the error and close the connection.
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify({ error: { message: `Google Speech API Error: ${error.message}` } }));
                        clientWs.close();
                    }
                })
                .on('data', (data) => {
                    // Data from Google (transcription results) -> forward to the client.
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify(data));
                    }
                });
            
            console.log('[Proxy] Successfully established stream to Google Speech API.');

        } catch (error) {
            // If JSON.parse fails, we assume it's binary audio data.
            if (recognizeStream) {
                // Forward the audio data to the Google stream.
                recognizeStream.write(message);
            } else {
                // This case should not happen if the client sends config first.
                console.warn('[Proxy] Received audio data before configuration was sent. Discarding.');
            }
        }
    });

    clientWs.on('close', () => {
        console.log('[Proxy] Client disconnected.');
        // If the client disconnects, properly end the stream to Google.
        if (recognizeStream) {
            recognizeStream.end();
        }
    });

    clientWs.on('error', (error) => {
        console.error('[Proxy] Error from client WebSocket:', error);
        // If there's a client-side error, end the stream to Google.
        if (recognizeStream) {
            recognizeStream.end();
        }
    });
});
