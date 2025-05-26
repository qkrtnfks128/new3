# Mediasoup 다자간 화상회의 시스템

WebRTC 기반의 다자간 화상회의 시스템입니다. [mediasoup](https://mediasoup.org/) SFU 아키텍처를 사용하여 여러 참가자 간의 효율적인 미디어 스트림 전송을 지원합니다.

## 프로젝트 구조

- `/server`: Node.js 기반 미디어서버 (Express + Socket.IO + mediasoup)
- `/client`: React + Vite 기반 웹 클라이언트 (mediasoup-client + socket.io-client)

## 서버 실행 방법

```bash
cd server
npm install
npm start
```

서버는 기본적으로 3000번 포트에서 실행됩니다.

## 클라이언트 실행 방법

```bash
cd client
npm install
npm run dev
```

클라이언트는 기본적으로 5173번 포트에서 실행됩니다.

## 사용 방법

1. 서버와 클라이언트를 각각 실행합니다.
2. 클라이언트 웹 페이지에 접속하여 방 ID와 사용자 이름을 입력합니다.
3. 참여 버튼을 클릭하여 화상회의에 참여합니다.
4. 카메라와 마이크 접근 권한을 허용합니다.
5. 다른 참가자들도 같은 방 ID로 참여할 수 있습니다.

## 주요 기능

- WebRTC 기반 실시간 화상/음성 통신
- 방 기반 다중 참가자 지원
- 미디어 스트림 전송 및 수신
- 사용자 입장/퇴장 처리

## 기술 스택

### 서버

- Node.js
- Express
- Socket.IO
- mediasoup

### 클라이언트

- React
- TypeScript
- Vite
- mediasoup-client
- socket.io-client

## 라이센스

MIT

EC2
rm -rf new3
git clone https://github.com/qkrtnfks128/new3.git
cd new3
cd server
npm install
npm start
