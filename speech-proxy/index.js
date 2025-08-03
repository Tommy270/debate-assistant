// speech-proxy/index.js

const http = require('http');
const WebSocket = require('ws');
const { SpeechClient } = require('@google-cloud/speech');

// Create a standard HTTP server for health checks.
const server = http.createServer((req, res) => {
    // Respond to App Engine health checks
    if (req.url === '/_ah/health' || req.url === '/readiness_check' || req.url === '/liveness_check') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
    } else {
        res.writeHead(404);
        res.end();
    }
});

// Attach the WebSocket server to the HTTP server.
const wss = new WebSocket.Server({ server });

wss.on('connection', (clientWs) => {
    console.log('[Proxy] Client connected.');

    let recognizeStream = null;
    let speechClient = null; // Lazily initialized
    let isConfigured = false; // State to track if the stream is configured

    clientWs.on('message', (message) => {
        // The client can send two types of messages: a JSON string for configuration,
        // or binary data (Buffer) for the audio stream.

        if (typeof message === 'string') {
            try {
                const msg = JSON.parse(message);
                
                // Check for a config structure to be more certain.
                if (msg.streaming_config && msg.streaming_config.config) {
                    console.log('[Proxy] Received configuration message.');

                    // If there's an existing stream for this client, end it.
                    if (recognizeStream) {
                        recognizeStream.end();
                        console.log('[Proxy] Ended previous recognizeStream.');
                    }

                    // Create a new SpeechClient if one doesn't exist.
                    if (!speechClient) {
                        speechClient = new SpeechClient();
                    }

                    const requestConfig = {
                        config: msg.streaming_config.config,
                        interimResults: msg.streaming_config.interim_results,
                    };

                    console.log('[Proxy] New config:', JSON.stringify(requestConfig.config, null, 2));

                    // Create the new recognize stream.
                    recognizeStream = speechClient
                        .streamingRecognize(requestConfig)
                        .on('error', (error) => {
                            console.error('[Google] Error from recognizeStream:', error.message);
                            if (clientWs.readyState === WebSocket.OPEN) {
                                clientWs.send(JSON.stringify({ error: { message: `Google Speech API Error: ${error.message}` } }));
                            }
                        })
                        .on('data', (data) => {
                            if (clientWs.readyState === WebSocket.OPEN) {
                                clientWs.send(JSON.stringify(data));
                            }
                        });
                    
                    isConfigured = true;
                    console.log('[Proxy] Successfully established new stream to Google Speech API.');
                }
            } catch (error) {
                console.warn('[Proxy] Received a string message that was not valid JSON config:', message);
            }
        } else if (Buffer.isBuffer(message)) {
            // This is binary audio data.
            if (recognizeStream && isConfigured) {
                recognizeStream.write(message);
            } else {
                console.warn('[Proxy] Received audio data but stream is not configured. Discarding.');
            }
        }
    });

    clientWs.on('close', (code, reason) => {
        console.log(`[Proxy] Client disconnected. Code: ${code}, Reason: ${reason}`);
        if (recognizeStream) {
            recognizeStream.end();
            console.log('[Proxy] Cleaned up recognizeStream on client disconnect.');
        }
        isConfigured = false;
        speechClient = null;
    });

    clientWs.on('error', (error) => {
        console.error('[Proxy] Error from client WebSocket:', error);
        if (recognizeStream) {
            recognizeStream.end();
            console.log('[Proxy] Cleaned up recognizeStream on client error.');
        }
        isConfigured = false;
        speechClient = null;
    });
});

// App Engine provides the port number via the PORT environment variable.
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`[Proxy] Server listening on port ${PORT}`);
});