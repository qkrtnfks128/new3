# Mediasoup 화상회의 클라이언트

React와 Vite로 구현된 WebRTC 기반 화상회의 클라이언트입니다. mediasoup-client를 사용하여 다자간 화상/음성 통신을 지원합니다.

## 기능

- mediasoup-client를 사용한 WebRTC 연결
- socket.io-client로 서버와 통신
- 방 참여 및 퇴장
- 로컬 미디어 스트림 전송 (카메라 및 마이크)
- 원격 참가자의 미디어 스트림 수신

## 시스템 요구사항

- Node.js 14.x 이상
- npm 또는 yarn

## 설치 방법

```bash
# 패키지 설치
npm install
```

## 개발 서버 실행

```bash
# 개발 서버 실행
npm run dev
```

기본적으로 개발 서버는 5173 포트에서 실행됩니다.

## 빌드

```bash
# 프로덕션 빌드
npm run build
```

빌드된 파일은 `dist` 디렉토리에 생성됩니다.

## 사용 방법

1. 메인 화면에서 방 ID와 사용자 이름을 입력하여 화상회의에 참여합니다.
2. 참여 후 카메라와 마이크 접근 권한을 허용하면 화상회의가 시작됩니다.
3. 다른 참가자들의 화면과 오디오가 자동으로 표시됩니다.

## 서버 연결

이 클라이언트는 기본적으로 `http://localhost:3000`에서 실행되는 서버에 연결됩니다.
서버 주소를 변경하려면 `src/services/SocketService.ts` 파일에서 `serverUrl` 변수를 수정하세요.

## 주요 파일 구조

- `src/App.tsx`: 메인 애플리케이션 컴포넌트
- `src/components/VideoRoom.tsx`: 화상회의 방 컴포넌트
- `src/components/VideoParticipant.tsx`: 참가자 비디오 컴포넌트
- `src/services/SocketService.ts`: Socket.IO 통신 서비스
- `src/services/MediasoupService.ts`: mediasoup 관련 기능 구현
- `src/types/MediasoupTypes.ts`: 타입 정의

## 라이센스

MIT
