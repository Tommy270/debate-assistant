// File: speech-proxy/index.js

const functions = require('@google-cloud/functions-framework');
const { GoogleAuth } = require('google-auth-library');
const WebSocket = require('ws');

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
wss.on('connection', async (clientWs) => {
  console.log('[Proxy] Client connected.');

  let googleWs = null;
  let googleStreamActive = false;

  try {
    // Step 1: Authenticate and get an access token for the Speech API.
    // This is done on the backend, so the token is never exposed to the client.
    console.log('[Proxy] Generating Google Speech API token...');
    const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-speech' });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    console.log('[Proxy] Successfully generated token.');

    // Step 2: Establish the backend WebSocket connection to Google's Speech API.
    const googleWsUrl = `wss://speech.googleapis.com/v1/speech:streamingrecognize?access_token=${accessToken.token}`;
    googleWs = new WebSocket(googleWsUrl);

    // --- Event Handlers for Google WebSocket ---

    googleWs.on('open', () => {
      console.log('[Proxy] Connection to Google Speech API opened.');
      googleStreamActive = true;
    });

    googleWs.on('message', (data) => {
      // Message from Google -> forward to the client (React app)
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data.toString());
      }
    });

    googleWs.on('close', (code, reason) => {
      console.log(`[Proxy] Connection to Google closed. Code: ${code}, Reason: ${reason}`);
      googleStreamActive = false;
      // Close the client connection when the Google connection closes.
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    });

    googleWs.on('error', (error) => {
      console.error('[Proxy] Error from Google WebSocket:', error);
      googleStreamActive = false;
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    });

    // --- Event Handlers for Client (React App) WebSocket ---

    clientWs.on('message', (message) => {
      // Message from client -> forward to Google
      if (googleStreamActive && googleWs.readyState === WebSocket.OPEN) {
        googleWs.send(message);
      }
    });

    clientWs.on('close', () => {
      console.log('[Proxy] Client disconnected.');
      // Close the Google connection when the client disconnects.
      if (googleStreamActive && googleWs.readyState === WebSocket.OPEN) {
        googleWs.close();
      }
    });

    clientWs.on('error', (error) => {
      console.error('[Proxy] Error from client WebSocket:', error);
      if (googleStreamActive && googleWs.readyState === WebSocket.OPEN) {
        googleWs.close();
      }
    });

  } catch (error) {
    console.error('[Proxy] FATAL: Failed to establish connection to Google:', error);
    // If we can't connect to Google, close the client connection.
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  }
});