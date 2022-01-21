import { ConsumerOptions, Producer, Router, WebRtcTransport } from "mediasoup/node/lib/types";
import { webRtcTransportOptions } from "../config";
import { Server as SocketIOServer, Socket } from "socket.io";
import { Logger } from "./Logger";
import { Peer } from "./Peer";

const EventEmitter = require("events").EventEmitter;
const logger = new Logger("Room");

export type RoomType = typeof Room;

export class Room extends EventEmitter {
    private _roomId: string;
    private _router: Router;
    private _io: SocketIOServer;
    private _users: Map<string, Peer>;
    private _isRecording: boolean = false;
    public owner: string | null = null;

    constructor(roomId: string, router: Router, io: SocketIOServer) {
        super();
        this._roomId = roomId;
        this._router = router;
        this._io = io;
        this._users = new Map<string, Peer>();
    }

    // Broadcast peer in a room to create consumer whenever producer created
    // Called from Peer.ts
    public broadcastNewProducer(consumerOptions: ConsumerOptions, socketId: string, username: string) {
        this._broadcast().emit("new-producer", {
            options: consumerOptions,
            socketId: socketId,
            username: username,
        });
    }

    private _broadcast() {
        return this._io.to(this._roomId);
    }

    public async createWebRtcTransport() {
        return await this._router.createWebRtcTransport(webRtcTransportOptions);
    }

    public getRoomOwnerSocketId() {
        return this._users.forEach((peer: Peer, key, map) => {
            if (peer.name === this.owner) {
                return peer.socket.id;
            }
        });
    }

    /**
     * Generate array from set of users
     */
    public getUsers() {
        const users: Map<string, string> = new Map();
        this._users.forEach((value: Peer, key, map) => {
            if (value.name != "bot") {
                users.set(key, value.name);
            }
        });

        return Array.from(users);
    }

    public getUser(socketId: string): Peer | undefined {
        return this._users?.get(socketId);
    }

    /**
     * Get producers in room except caller's proucers
     */
    public getProducers(caller: Peer, transport: WebRtcTransport | undefined): void {
        this._users.forEach((u: Peer) => {
            u?.producers?.forEach(async (p: any) => {
                if (u.socket.id != caller.socket.id) {
                    // Except user's own audio
                    const consumer = await transport?.consume({
                        producerId: p.id,
                        rtpCapabilities: this._router.rtpCapabilities,
                        paused: true,
                    });

                    caller.socket.emit("new-consumer", {
                        id: consumer?.id,
                        producerId: consumer?.producerId,
                        kind: consumer?.kind,
                        rtpParameters: consumer?.rtpParameters,
                        socketId: u?.socket.id, // producer socket id
                        peerName: u?.name,
                    });

                    caller.socket.on("consumer-done", () => {
                        consumer?.resume();
                    });
                }
            });
        });
    }

    public addUser(peer: Peer): void {
        this._users?.set(peer.socket.id, peer);
    }

    public removeUser(peer: Peer): void {
        this._users.delete(peer.socket.id);
        this._broadcast().emit("user-leave", { socketId: peer.socket.id, peerName: peer.name });
    }

    // GETTERS AND SETTERS
    get roomId(): string {
        return this._roomId;
    }

    get router(): any {
        return this._router;
    }

    get transports(): any {
        return this._transports;
    }

    get users(): any {
        return this._users;
    }

    get isRecording(): boolean {
        return this._isRecording;
    }

    set roomId(roomId: string) {
        this._roomId = roomId;
    }

    set router(router: any) {
        this._router = router;
    }

    set isRecording(isRecording: any) {
        this._isRecording = isRecording;
    }
}
