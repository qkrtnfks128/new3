import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";

const Home: React.FC = () => {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      navigate(`/room/${roomId}`);
    }
  };

  const handleCreateRoom = () => {
    // 랜덤 방 ID 생성
    const randomRoomId = Math.random()
      .toString(36)
      .substring(2, 8);
    navigate(`/room/${randomRoomId}`);
  };

  return (
    <div className="home-container">
      <div className="home-content">
        <h1>WebRTC 화상회의</h1>
        <p>
          mediasoup 기반 다자간 화상회의 시스템
        </p>

        <div className="join-options">
          <div className="join-room">
            <h2>기존 방 참여하기</h2>
            <form onSubmit={handleJoinRoom}>
              <input
                type="text"
                value={roomId}
                onChange={(e) =>
                  setRoomId(e.target.value)
                }
                placeholder="방 ID를 입력하세요"
                required
              />
              <button
                type="submit"
                className="join-button"
              >
                참여하기
              </button>
            </form>
          </div>

          <div className="create-room">
            <h2>새 방 만들기</h2>
            <button
              onClick={handleCreateRoom}
              className="create-button"
            >
              새 방 생성
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
