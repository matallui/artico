interface StreamVideoProps extends React.HTMLProps<HTMLVideoElement> {
  stream: MediaStream;
}

export function StreamVideo({ stream, ...props }: StreamVideoProps) {
  return (
    <video
      {...props}
      autoPlay
      playsInline
      ref={(video) => {
        if (video && stream) {
          video.srcObject = stream;
        }
      }}
    />
  );
}
