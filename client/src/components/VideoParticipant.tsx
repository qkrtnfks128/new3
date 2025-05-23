import React, { useEffect, useRef } from "react";
import "./VideoParticipant.css";

interface VideoParticipantProps {
  stream: MediaStream;
  peerId: string;
  isLocal: boolean;
}

const VideoParticipant: React.FC<
  VideoParticipantProps
> = ({ stream, peerId, isLocal }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className={`video-participant ${
        isLocal ? "local" : "remote"
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // 자신의 오디오는 음소거
      />
      <div className="participant-info">
        <span className="peer-id">
          {isLocal ? "나" : peerId}
        </span>
      </div>
    </div>
  );
};

export default VideoParticipant;
