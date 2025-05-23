class Peer {
  constructor(id, socket) {
    this.id = id;
    this.socket = socket;
    this.transports = new Map(); // transportType => transport
    this.producers = new Map(); // producerId => producer
    this.consumers = new Map(); // consumerId => consumer
    this.rtpCapabilities = null;
  }

  /**
   * RTP 기능 설정
   * @param {Object} rtpCapabilities RTP 기능 정보
   */
  setRtpCapabilities(rtpCapabilities) {
    this.rtpCapabilities = rtpCapabilities;
  }

  /**
   * Transport 추가
   * @param {string} type 트랜스포트 타입 ('send' 또는 'receive')
   * @param {Object} transport 트랜스포트 객체
   */
  addTransport(type, transport) {
    this.transports.set(type, transport);
  }

  /**
   * Transport 가져오기
   * @param {string} type 트랜스포트 타입
   * @returns {Object|undefined} 트랜스포트 객체
   */
  getTransport(type) {
    return this.transports.get(type);
  }

  /**
   * Producer 추가
   * @param {Object} producer Producer 객체
   */
  addProducer(producer) {
    this.producers.set(producer.id, producer);
  }

  /**
   * Consumer 추가
   * @param {Object} consumer Consumer 객체
   */
  addConsumer(consumer) {
    this.consumers.set(consumer.id, consumer);
  }

  /**
   * Peer의 리소스 정리
   */
  close() {
    // 모든 Producer 정리
    for (const producer of this.producers.values()) {
      producer.close();
    }

    // 모든 Consumer 정리
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }

    // 모든 Transport 정리
    for (const transport of this.transports.values()) {
      transport.close();
    }

    // 맵 비우기
    this.producers.clear();
    this.consumers.clear();
    this.transports.clear();
  }

  /**
   * Producer 생성
   * @param {Object} transportOptions 트랜스포트 옵션
   * @param {Object} producerOptions 프로듀서 옵션
   * @returns {Object} 생성된 Producer 정보
   */
  async createProducer(producerOptions) {
    const transport = this.getTransport("send");
    if (!transport) {
      throw new Error(
        "send 트랜스포트가 없습니다"
      );
    }

    const producer = await transport.produce(
      producerOptions
    );
    this.addProducer(producer);

    // producer가 닫힐 때 이벤트 처리
    producer.on("transportclose", () => {
      this.producers.delete(producer.id);
    });

    return {
      id: producer.id,
    };
  }

  /**
   * Consumer 생성
   * @param {Object} consumerOptions 컨슈머 옵션
   * @returns {Object} 생성된 Consumer 정보
   */
  async createConsumer(
    router,
    producerId,
    rtpCapabilities
  ) {
    const transport =
      this.getTransport("receive");
    if (!transport) {
      throw new Error(
        "receive 트랜스포트가 없습니다"
      );
    }

    // 라우터에서 해당 producer를 소비할 수 있는지 확인
    if (
      !router.canConsume({
        producerId,
        rtpCapabilities,
      })
    ) {
      throw new Error(
        `라우터에서 producerId=${producerId}를 소비할 수 없습니다`
      );
    }

    try {
      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true, // 처음에는 일시 중지 상태로 시작
      });

      this.addConsumer(consumer);

      // consumer가 닫힐 때 이벤트 처리
      consumer.on("transportclose", () => {
        this.consumers.delete(consumer.id);
      });

      // 소비자 정보 반환
      return {
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
      };
    } catch (error) {
      console.error("Consumer 생성 실패:", error);
      throw error;
    }
  }
}

module.exports = Peer;
