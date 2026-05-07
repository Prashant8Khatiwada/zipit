declare module 'streamsaver' {
  interface StreamSaver {
    createWriteStream(fileName: string): WritableStream<Uint8Array>;
  }

  const streamSaver: StreamSaver;
  export default streamSaver;
}
