# Mediasoup 다자간 화상회의 서버

Node.js 기반 WebRTC SFU(Selective Forwarding Unit) 화상회의 서버입니다. [mediasoup](https://mediasoup.org/)를 사용하여 다자간 실시간 화상/음성 통신을 지원합니다.

## 기능

- mediasoup worker/router 생성 및 관리
- 사용자 입장/퇴장 처리
- WebRTC 연결 설정 (transport, producer, consumer)
- 방 단위로 사용자 그룹화

## 시스템 요구사항

- Node.js 14.x 이상
- npm 또는 yarn

## 설치 방법

```bash
# 패키지 설치
npm install
```

## 실행 방법

```bash
# 서버 실행
npm start
```

서버는 기본적으로 3000번 포트에서 실행됩니다. `config.js` 파일에서 설정을 변경할 수 있습니다.

## 클라이언트 연결 방법

클라이언트에서는 Socket.IO와 mediasoup-client 라이브러리를 사용하여 연결합니다. 기본적인 연결 흐름은 다음과 같습니다:

1. 소켓 연결
2. 방 참여
3. mediasoup 라우터의 RTP 기능 정보 요청
4. WebRTC transport 생성
5. producer 생성 (미디어 전송)
6. consumer 생성 (다른 참여자의 미디어 수신)

## API 엔드포인트

- `GET /`: 서버 상태 확인
- `GET /rooms`: 현재 활성화된 방 목록 조회

## 소켓 이벤트

### 클라이언트 -> 서버

- `joinRoom`: 방에 참여
- `leaveRoom`: 방에서 퇴장
- `getRtpCapabilities`: 라우터의 RTP 기능 정보 요청
- `createWebRtcTransport`: WebRTC 트랜스포트 생성
- `connectWebRtcTransport`: WebRTC 트랜스포트 연결 설정
- `produce`: 미디어 스트림 생성
- `closeProducer`: 미디어 스트림 종료
- `consume`: 다른 참여자의 미디어 스트림 소비
- `resumeConsumer`: 소비자 재개

### 서버 -> 클라이언트

- `newPeer`: 새로운 참여자 알림
- `peerClosed`: 참여자 퇴장 알림
- `newProducer`: 새로운 미디어 스트림 알림
- `producerClosed`: 미디어 스트림 종료 알림

## 설정

설정은 `config.js` 파일에서 관리됩니다. 주요 설정은 다음과 같습니다:

- 서버 포트
- mediasoup worker 설정
- 라우터 미디어 코덱
- WebRTC 트랜스포트 설정

## 라이센스

MIT
