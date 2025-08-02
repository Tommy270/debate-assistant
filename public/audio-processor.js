// public/audio-processor.js

class AudioProcessor extends AudioWorkletProcessor {
  // This process method is called for every block of audio data.
  process(inputs) {
    // We expect one input, with one channel (mono).
    const input = inputs[0];
    const channel = input[0];

    if (!channel) {
      // If there's no data, we don't need to do anything.
      // The return value of `true` keeps the processor alive.
      return true;
    }

    // The audio data from the microphone is in Float32Array format, from -1.0 to 1.0.
    // Google Speech-to-Text API requires 16-bit PCM (Int16Array).
    // We convert the 32-bit float to a 16-bit integer.
    const int16Buffer = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      // Clamp the value between -1 and 1, then scale to the 16-bit integer range.
      int16Buffer[i] = Math.max(-1, Math.min(1, channel[i])) * 0x7FFF;
    }

    // Post the raw buffer back to the main thread to be sent over the WebSocket.
    // We transfer the buffer's ownership to avoid copying, which is more efficient.
    this.port.postMessage(int16Buffer.buffer, [int16Buffer.buffer]);

    // Return `true` to indicate that the processor should continue running.
    return true;
  }
}

// Register the processor with the name 'audio-processor'.
// This name will be used in the main App.js to load the worklet.
registerProcessor('audio-processor', AudioProcessor);