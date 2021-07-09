// MAIN SERVER FILE
import fs from "fs";
// LOCAL IMPORT
import { Room } from "./lib/Room";
import { User } from "./lib/User";
import { https, codecs, webRtcTransportOptions, workerOptions } from "./config";

// PACKAGES IMPORT
import express, { Application } from "express";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createServer, Server as HTTPSServer } from "https";

// MEDIASOUP IMPORT
import { createWorker, version as mediaSoupVersion } from "mediasoup";
import { Worker, Router, Producer, MediaKind, WebRtcTransport } from "mediasoup/lib/types";

// CONSTANTS
const httpsServer: HTTPSServer = createHTTPSServer();
const { listenIP, listenPort } = https;
const io = new SocketIOServer(httpsServer, {
    cors: {
        origin: ["http://192.168.151.1:3000", "http://localhost:3000"],
        methods: ["GET", "POST"],
    },
});

interface MediasoupWorker {
    pid: number;
    worker: Worker;
}

const mediasoupWorkers: Array<MediasoupWorker> = new Array<MediasoupWorker>();
const rooms: Array<Room> = new Array<Room>();

async function run() {
    await runMediasoupWorkers();
    startListen();
}

// START PROCESS
run().catch((err) => {
    console.error("An error occurred.", err);
    process.exit(1);
});

// SOCKET IO EVENTS
io.on("connection", (socket: Socket) => {
    console.log("new client connected with id " + socket.id);

    socket.on("createMeet", async (roomId) => {
        const router = await mediasoupWorkers[0].worker.createRouter({
            mediaCodecs: codecs,
        });

        const room: Room = new Room(roomId, router);

        rooms.push(room);
    });

    /**
     * ------------------------------------------------
     * WHEN NEW USER JOIN MEET
     * ------------------------------------------------
     */
    socket.on("joinMeet", async (roomId) => {
        const room = rooms.find((r) => r.roomId == roomId);

        const newUser: User | undefined = new User(socket.id);
        room?.addUser(newUser);

        const router: Router | undefined = room?.router;
        socket.emit("rtp-capabilities", router?.rtpCapabilities);

        socket.join(roomId);
    });

    /**
     * ------------------------------------------------
     * AFTER USER SYNCING WITH ROUTER
     *
     * Sending back transport
     * ------------------------------------------------
     */
    socket.on("synced", async (roomId) => {
        const room = rooms.find((r) => r.roomId == roomId);
        const user: User = room?.getUser(socket.id);

        const router: Router | undefined = room?.router;
        const sendTransport: WebRtcTransport | undefined = await router?.createWebRtcTransport(webRtcTransportOptions);
        const recvTransport: WebRtcTransport | undefined = await router?.createWebRtcTransport(webRtcTransportOptions);

        user?.setSendTransport(sendTransport);
        user?.setRecvTransport(recvTransport);

        sendTransport?.observer.on("newproducer", (producer) => {
            socket.to(roomId).emit("new-user", { userId: user.id, producerId: producer.id });
        });

        socket.on("transport-created", async (roomId) => {
            // Get all producers of existing user in room
            room?.users.forEach((u: any) => {
                u.producers.forEach(async (p: any) => {
                    if (u.id != socket.id) {
                        // Except user's own audio
                        const consumer = await recvTransport?.consume({
                            producerId: p.id,
                            rtpCapabilities: router?.rtpCapabilities,
                            paused: true,
                        });

                        consumer?.on("transportclose", () => {
                            console.log("transport closed");
                        });

                        user?.addConsumer(consumer);

                        socket.emit("new-consumer", {
                            id: consumer?.id,
                            producerId: consumer?.producerId,
                            kind: consumer?.kind,
                            rtpParameters: consumer?.rtpParameters,
                            userId: u?.id,
                        });
                    }
                });
            });
        });

        socket.on("consume-new-user", async (data) => {
            const newConsumer = await recvTransport?.consume({
                producerId: data.producerId,
                rtpCapabilities: router?.rtpCapabilities,
                paused: true,
            });

            newConsumer?.on("transportclose", () => {
                console.log("transport closed");
            });

            user?.addConsumer(newConsumer);

            socket.emit("new-consumer", {
                id: newConsumer?.id,
                producerId: newConsumer?.producerId,
                kind: newConsumer?.kind,
                rtpParameters: newConsumer?.rtpParameters,
                userId: data.userId,
            });
        });

        // Emit Transport option to creating user's side transport
        socket.emit(
            "transport-options",
            {
                id: sendTransport?.id,
                iceParameters: sendTransport?.iceParameters,
                iceCandidates: sendTransport?.iceCandidates,
                dtlsParameters: sendTransport?.dtlsParameters,
                sctpParameters: sendTransport?.sctpParameters,
            },
            {
                id: recvTransport?.id,
                iceParameters: recvTransport?.iceParameters,
                iceCandidates: recvTransport?.iceCandidates,
                dtlsParameters: recvTransport?.dtlsParameters,
                sctpParameters: recvTransport?.sctpParameters,
            }
        );
    });

    /**
     * ------------------------------------------------
     * AFTER USER GOT TRANSPORT OPTIONS
     * ------------------------------------------------
     */
    socket.on("transport-connect", (roomId, data) => {
        const room = rooms.find((r) => r.roomId == roomId);
        const user: User = room?.getUser(socket.id);

        const transport: WebRtcTransport | undefined = user?.getSendTransport;

        try {
            transport?.connect({ dtlsParameters: data.dtlsParameters });
        } catch (err) {
            console.error("Error Connection ", err);
        }
    });

    // Receiver Transport 'connect' event
    socket.once("connect-receive", (roomId, data) => {
        const room = rooms.find((r) => r.roomId == roomId);
        const user: User = room?.getUser(socket.id);

        const transport: WebRtcTransport | undefined = user?.getRecvTransport;

        try {
            transport?.connect({ dtlsParameters: data.dtlsParameters });
        } catch (err) {
            console.error("Error Connection ", err);
        }
    });

    /**
     * ------------------------------------------------
     * CONNECTIONG USER'S PRODUCER
     * ------------------------------------------------
     */
    socket.on("transport-produce", async (data, fn) => {
        const room = rooms.find((r) => r.roomId == data.roomId);
        const user: User = room?.getUser(socket.id);
        const transport: WebRtcTransport | undefined = user?.getSendTransport;

        const producer: any | undefined = await transport?.produce(data.producerOption);

        fn(producer?.id);
        user?.addProducer(producer);
    });

    socket.on("consumer-done", (roomId, consumerId) => {
        const room = rooms.find((r) => r.roomId == roomId);
        const user: User = room?.getUser(socket.id);
        const consumer = user?.getConsumer(consumerId);
        consumer?.resume();
    });

    socket.on("exit-room", (data) => {
        const room = rooms.find((r) => r.roomId == data);
        const user = room?.getUser(socket.id);
        console.log("exit room with transport ");
    });

    socket.on("message", (room: string, message: string) => {
        socket.to(room).emit("new-message", message);
    });
});

/**
 * -------------------------------FUNCTION DEFINITION ------------------------------------
 */
function startListen() {
    httpsServer.listen(listenPort, parseInt(listenIP), () => {
        const { listenIps } = webRtcTransportOptions;
        const ip = listenIps[0];

        console.log("--------------------running server-------------------------------");
        console.log(`open https://${ip}:${listenPort} in your web browser`);
    });
}

function createHTTPSServer() {
    const { sslCert, sslKey } = https.certs;

    if (!fs.existsSync(sslCert) || !fs.existsSync(sslKey)) {
        console.log("SSL files are not found.");
        process.exit(0);
    }

    const tls = {
        key: fs.readFileSync(sslKey),
        cert: fs.readFileSync(sslCert),
    };

    const app: Application = express();
    const httpsServer: HTTPSServer = createServer(tls, app);

    httpsServer.on("error", (err) => {
        console.error("Failed to start http server. " + err);
    });

    return httpsServer;
}

async function runMediasoupWorkers() {
    const { rtcMaxPort, rtcMinPort } = workerOptions.workerSettings;
    const { numWorkers } = workerOptions;
    const { sslCert, sslKey } = https.certs;

    console.info("Mediasoup version: %s, running %d workers...", mediaSoupVersion, numWorkers);

    for (let i = 0; i < numWorkers; ++i) {
        const worker: Worker = await createWorker({
            logLevel: "warn",
            rtcMaxPort: rtcMaxPort,
            rtcMinPort: rtcMinPort,
            dtlsCertificateFile: sslCert,
            dtlsPrivateKeyFile: sslKey,
        });

        worker.on("died", () => {
            console.error("mediasoup worker died [pid:%d]", worker.pid);
            setTimeout(() => process.exit(1), 2000);
        });

        mediasoupWorkers.push({
            pid: worker.pid,
            worker: worker,
        });
    }
}
