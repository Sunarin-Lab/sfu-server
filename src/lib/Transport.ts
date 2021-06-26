import { Transport as MediasoupTransfer } from "mediasoup/src/types";

export class Transport {
  private _transportId?: string;
  private _transport?: MediasoupTransfer;

  constructor(transportId: string, transport: MediasoupTransfer) {
    this._transportId = transportId;
    this._transport = transport;
  }

  get transportId() {
    return this._transportId;
  }

  get transport() {
    return this._transport;
  }
}
