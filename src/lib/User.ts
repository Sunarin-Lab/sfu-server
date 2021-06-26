import { Producer, Consumer } from "mediasoup/src/types";
import { WebRtcTransport } from "mediasoup/src/types";

export class User {
  private _socketId: string | undefined;
  private _producers?: Array<Producer> | undefined;
  private _consumers?: Array<Consumer> | undefined;
  private _sendTransports?: Array<WebRtcTransport> | undefined;
  private _recvTransports?: Array<WebRtcTransport> | undefined;

  constructor(socketId: string) {
    this._socketId = socketId;
    this._producers = new Array<Producer>();
    this._consumers = new Array<Consumer>();
    this._sendTransports = new Array<WebRtcTransport>();
    this._recvTransports = new Array<WebRtcTransport>();
  }

  get producers(): any {
    return this._producers;
  }

  get consumers(): any {
    return this._consumers;
  }

  public getProducer(producerId: string): Producer | undefined {
    return this._producers?.find((t) => t?.id == producerId);
  }

  public getConsumer(consumerId: string): Consumer | undefined {
    return this._consumers?.find((t) => t?.id == consumerId);
  }

  public addProducer(producer: Producer) {
    this._producers?.push(producer);
  }

  public addConsumer(consumer: Consumer) {
    this._consumers?.push(consumer);
  }
}
