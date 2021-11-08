import { Producer, Consumer, ConsumerOptions, WebRtcTransport, ActiveSpeakerObserver } from "mediasoup/node/lib/types";
import { Socket } from "socket.io";
import { Logger } from "./Logger";
import { Room } from "./Room";
const EventEmitter = require("events").EventEmitter;

const logger = new Logger("Peer");

export type PeerType = typeof Peer;

export class Peer extends EventEmitter {
  private _joinedTo: Room;
  private _socket: Socket;
  private _name: string;
  private _producers: Array<Producer>;
  private _consumers: Map<string, Array<Consumer>>;
  private _transport: Map<string, WebRtcTransport>;

  constructor(socket: Socket, name: string, room: Room) {
    super();
    this._joinedTo = room;
    this._socket = socket;
    this._name = name;
    this._producers = new Array<Producer>();
    this._consumers = new Map<string, Array<Consumer>>();
    this._transport = new Map<string, WebRtcTransport>();

    logger.info("User %s joining room %s", socket.id, room.roomId);
    socket.join(room.roomId);
    this._socket = socket;

    // Socket Events
    // this.handleSync();
  }

  public async handleSync() {
    // Creating transports
    const sendTransport = await this._joinedTo.createWebRtcTransport();
    const recvTransport = await this._joinedTo.createWebRtcTransport();

    this._transport.set("send", sendTransport);
    this._transport.set("recv", recvTransport);

    this._socket.emit("transport-options", {
      send: this.createTransportOptions(sendTransport),
      recv: this.createTransportOptions(recvTransport),
    });

    // Event listeners
    this._socket.on("transport-connect", (transportType, dtlsParams) => {
      const transport: WebRtcTransport | undefined = this._transport.get(transportType);

      try {
        transport?.connect({ dtlsParameters: dtlsParams });

        if (transportType == "recv") {
          logger.info("Recv COnnect");
          ///this._joinedTo.getAllProducer(this._socket.id);
          this._joinedTo.getProducers(this, transport);
        }
      } catch (err) {
        logger.error("Error connecting transport ", err);
      }
    });

    /**
     * ------------------------------------------------
     * When creating new producer
     * ------------------------------------------------
     */
    this._socket.on("transport-produce", async (producerOption, fn) => {
      const transport: WebRtcTransport | undefined = this._transport.get("send");

      const producer: Producer | undefined = await transport?.produce(producerOption);

      if (producer != null) {
        fn(producer?.id);

        this._producers?.push(producer);
      }
    });

    /**
     * ------------------------------------------------
     * Creating new consumer whenever
     * new producer from other peer created
     * ------------------------------------------------
     */
    this._socket.on("consume-producer", async (data) => {
      const consumer: Consumer = await recvTransport.consume(data.options);

      if (!this._consumers.has(data.socketId)) {
        this._consumers.set(data.socketId, new Array<Consumer>());
      }

      const consumers: Array<Consumer> | undefined = this._consumers.get(data.socketId);
      consumers?.push(consumer);

      this._socket.emit("new-consumer", {
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        socketId: data.socketId, // producer socket id
        peerName: data.username,
      });

      this._socket.on("consumer-done", () => {
        consumer.resume();
      });
    });

    sendTransport.observer.on("newproducer", (producer: Producer) => {
      logger.info("new producer created ", producer.id);
      const consumerOptions: ConsumerOptions = {
        producerId: producer.id,
        rtpCapabilities: this._joinedTo.router.rtpCapabilities,
        paused: true,
      };

      this._joinedTo.broadcastNewProducer(consumerOptions, this._socket.id, this._name);
    });

    this._socket.on("disconnect", () => {
      const room = this._joinedTo;
      room?.removeUser(this);
    });
  }

  private createTransportOptions(transport: WebRtcTransport) {
    const transportOptions = {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };

    return transportOptions;
  }

  public getWebRTCTransport(type: string): WebRtcTransport | undefined {
    return this._transport.get(type);
  }

  // public addConsumer(): void {
  //   return this._consumers.pu;
  // }

  get socket(): Socket {
    return this._socket;
  }

  get name(): string {
    return this._name;
  }

  get producers(): Array<Producer> | undefined {
    return this._producers;
  }
}
