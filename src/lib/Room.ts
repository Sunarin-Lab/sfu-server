import { Router } from "mediasoup/lib/types";
const EventEmitter = require("events").EventEmitter;
const Logger = require("./Logger");
const User = require("./User");

export class Room extends EventEmitter {
    private _roomId?: string;
    private _router?: Router;
    private _users?: Array<InstanceType<typeof User>>;

    constructor(roomId: string, router: any) {
        super();
        this._roomId = roomId;
        this._router = router;
        this._users = new Array<InstanceType<typeof User>>();
    }

    get roomId(): string | undefined {
        return this._roomId;
    }

    get router(): any | undefined {
        return this._router;
    }

    get transports(): any {
        return this._transports;
    }

    get users(): any {
        return this._users;
    }

    public getUser(socketId: string): InstanceType<typeof User> {
        return this._users?.find((t) => t?._socketId == socketId);
    }

    set roomId(roomId: string | undefined) {
        this._roomId = roomId;
    }

    set router(router: any | undefined) {
        this._router = router;
    }

    public addUser(user: InstanceType<typeof User>) {
        this._users?.push(user);
    }
}
