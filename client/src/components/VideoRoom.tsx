import React, {
  useState,
  useEffect,
  useRef,
} from "react";
import {
  useParams,
  useNavigate,
} from "react-router-dom";
import type { MediaStreamInfo } from "../types/MediasoupTypes";
import SocketService from "../services/SocketService";
import MediasoupService from "../services/MediasoupService";
import "./VideoRoom.css";

// 비디오 참가자 컴포넌트
const VideoParticipant: React.FC<{
  stream: MediaStream;
  peerId: string;
  isLocal: boolean;
}> = ({ stream, peerId, isLocal }) => {
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
        muted={isLocal}
      />
      <div className="peer-id">
        {isLocal ? "나" : peerId}
      </div>
    </div>
  );
};

// 비디오 회의실 컴포넌트
const VideoRoom: React.FC = () => {
  const { roomId } = useParams<{
    roomId: string;
  }>();
  const [isConnected, setIsConnected] =
    useState(false);
  const [isLoading, setIsLoading] =
    useState(true);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [mediaStreams, setMediaStreams] =
    useState<MediaStreamInfo[]>([]);

  const navigate = useNavigate();
  const socketService = useRef(
    SocketService.getInstance()
  );
  const mediasoupService = useRef(
    MediasoupService.getInstance()
  );

  // 방 참가 및 설정
  useEffect(() => {
    if (!roomId) {
      setErrorMessage("방 ID가 없습니다.");
      setIsLoading(false);
      return;
    }

    const joinRoom = async () => {
      try {
        setIsLoading(true);

        // 소켓 연결
        socketService.current.connect();

        // 무작위 Peer ID 생성
        const peerId = `peer_${Math.floor(
          Math.random() * 1000
        )}`;

        // 방 참가
        const joinResult =
          await socketService.current.joinRoom(
            roomId,
            peerId
          );
        console.log("Join result:", joinResult);

        // Device 로드
        await mediasoupService.current.loadDevice();

        // 전송 및 수신 전송 생성
        await mediasoupService.current.createSendTransport();
        await mediasoupService.current.createReceiveTransport();

        // 로컬 스트림 생성
        const localStream =
          await mediasoupService.current.createLocalStream();

        // 스트림 전송
        await mediasoupService.current.produceStream(
          localStream
        );

        setIsConnected(true);
        setIsLoading(false);

        // 이벤트 리스너 설정
        mediasoupService.current.on(
          "newStream",
          (streamInfo) => {
            setMediaStreams((prev) => [
              ...prev,
              streamInfo as MediaStreamInfo,
            ]);
          }
        );

        mediasoupService.current.on(
          "streamRemoved",
          (streamInfo) => {
            setMediaStreams((prev) =>
              prev.filter(
                (s) =>
                  s.id !==
                  (streamInfo as MediaStreamInfo)
                    .id
              )
            );
          }
        );
      } catch (error) {
        console.error(
          "Failed to join room:",
          error
        );
        setErrorMessage(
          `방 참가에 실패했습니다: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`
        );
        setIsLoading(false);
      }
    };

    joinRoom();

    // 정리 로직
    return () => {
      const cleanup = async () => {
        try {
          if (isConnected) {
            await mediasoupService.current.cleanup();
            await socketService.current.leaveRoom();
            socketService.current.disconnect();
          }
        } catch (error) {
          console.error("Cleanup error:", error);
        }
      };

      cleanup();
    };
  }, [roomId, navigate]);

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="video-room loading">
        <div className="loading-message">
          연결 중...
        </div>
      </div>
    );
  }

  // 에러 상태
  if (errorMessage) {
    return (
      <div className="video-room error">
        <div className="error-message">
          {errorMessage}
        </div>
        <button onClick={() => navigate("/")}>
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  // 방 나가기 핸들러
  const handleLeaveRoom = async () => {
    try {
      await mediasoupService.current.cleanup();
      await socketService.current.leaveRoom();
      socketService.current.disconnect();
      navigate("/");
    } catch (error) {
      console.error("Error leaving room:", error);
    }
  };

  return (
    <div className="video-room">
      <div className="room-header">
        <h2>화상 회의: {roomId}</h2>
        <button
          className="leave-button"
          onClick={handleLeaveRoom}
        >
          회의 나가기
        </button>
      </div>

      <div className="video-grid">
        {mediaStreams.map((streamInfo) => (
          <VideoParticipant
            key={`${streamInfo.peerId}-${streamInfo.id}-${streamInfo.type}`}
            stream={streamInfo.stream}
            peerId={streamInfo.peerId}
            isLocal={streamInfo.type === "local"}
          />
        ))}
      </div>
    </div>
  );
};

export default VideoRoom;
