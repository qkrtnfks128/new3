import * as mediasoupClient from "mediasoup-client";
import { types as mediasoupTypes } from "mediasoup-client";
import { Socket } from "socket.io-client";

export interface RoomState {
  joined: boolean;
  roomId: string;
  peerId: string;
  peers: string[];
  isLoading: boolean;
  error: string | null;
}

export interface MediaState {
  device: mediasoupClient.Device | null;
  sendTransport: mediasoupClient.types.Transport | null;
  receiveTransport: mediasoupClient.types.Transport | null;
  producers: Map<
    string,
    mediasoupClient.types.Producer
  >;
  consumers: Map<
    string,
    mediasoupClient.types.Consumer
  >;
  videoProducer: mediasoupClient.types.Producer | null;
  audioProducer: mediasoupClient.types.Producer | null;
  localStream: MediaStream | null;
}

export interface RoomInfo {
  roomId: string;
  peerId: string;
}

export interface PeerInfo {
  peerId: string;
}

export interface ProducerInfo {
  peerId: string;
  producerId: string;
  kind: "audio" | "video";
}

export interface MediaStreamInfo {
  id: string;
  peerId: string;
  track: MediaStreamTrack;
  stream: MediaStream;
  type: "local" | "remote";
  displayName?: string;
}

export interface SocketWithPeerInfo
  extends Socket {
  roomId?: string;
  peerId?: string;
}

export interface TransportOptions {
  id: string;
  iceParameters: mediasoupTypes.IceParameters;
  iceCandidates: mediasoupTypes.IceCandidate[];
  dtlsParameters: mediasoupTypes.DtlsParameters;
  sctpParameters?: mediasoupTypes.SctpParameters;
}

export interface RtpCapabilities {
  codecs: mediasoupTypes.RtpCodecCapability[];
  headerExtensions: mediasoupTypes.RtpHeaderExtension[];
}

export interface ConsumerOptions {
  id: string;
  producerId: string;
  kind: "audio" | "video";
  rtpParameters: mediasoupTypes.RtpParameters;
  type: string;
}

export interface ProducerOptions {
  track: MediaStreamTrack;
  encodings?: mediasoupTypes.RtpEncodingParameters[];
  codecOptions?: Record<string, unknown>;
  appData?: Record<string, unknown>;
}
