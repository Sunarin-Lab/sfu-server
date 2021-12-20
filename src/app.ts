#!/usr/bin/env node
process.title = "Sunarin Meet Server";
process.env.DEBUG = process.env.DEBUG || "*INFO* *WARN* *ERROR*";

import fs from "fs";
// LOCAL IMPORT
import { Room } from "./lib/Room";
import { Peer } from "./lib/Peer";
import { Logger } from "./lib/Logger";
import { https, codecs, webRtcTransportOptions, workerOptions } from "./config";

// PACKAGES IMPORT
import fetch from 'node-fetch';
import express, { Application } from "express";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createServer, Server as HTTPSServer } from "https";

// MEDIASOUP IMPORT
import { createWorker, version as mediasoupVersion } from "mediasoup";
import { Worker } from "mediasoup/node/lib/types";

// CONSTANTS
const logger = new Logger();
const httpsServer: HTTPSServer = createHTTPSServer();
const { listenIP, listenPort } = https;
const io = new SocketIOServer(httpsServer, {
    cors: {
        origin: ["http://192.168.151.1:3000", "http://localhost:3000"],
        methods: ["GET", "POST"],
    },
});

let currentWorkerIndex = 0;
const mediasoupWorkers = new Array<Worker>();
const rooms: Map<string, Room> = new Map<string, Room>();

async function run() {
    await runMediasoupWorkers();
    startListen();
}

// START PROCESS
run().catch((err) => {
    logger.error("An error occurred.", err);
    process.exit(1);
});

// SOCKET IO EVENTS
io.on("connection", (socket: Socket) => {
    logger.info("new client connected with id " + socket.id);

    // Should generate random UUID and send to client
    socket.on("createMeet", async (roomId) => {
        if (!rooms.has(roomId)) {
            const router = await getMediasoupWorker().createRouter({
                mediaCodecs: codecs,
            });

            const room: Room = new Room(roomId, router, io);
            logger.info("Creating room with id ", roomId);

            rooms.set(roomId, room);
        }
    });

    socket.on("get-rtp-capabilities", async (roomId) => {
        const room: Room | undefined = rooms.get(roomId);
        const capabilities = room?.router.rtpCapabilities;

        socket.emit("rtp-capabilities", capabilities);
    });

    socket.on("error", (error) => {
        console.log(error);
    });

    /**
     * ------------------------------------------------
     * WHEN NEW USER JOIN MEET
     * ------------------------------------------------
     */
    socket.on("joinMeet", async (roomId, name) => {
        if (roomId != null) {
            const room: Room | undefined = rooms.get(roomId);
            console.log("creating " + socket.id + "in room" + roomId);

            if (room != undefined) {
                io.to(roomId).emit("new-user-joined", { socketId: socket.id, name: name });
                // Plain implementation
                const users = room.getUsers();
                logger.info(users);
                socket.emit("peers-in-room", users);
                // Should add user auth
                const newUser: Peer = new Peer(socket, name, room);
                await newUser.handleSync();
                logger.info("after peer");

                room?.addUser(newUser);
            }
        }
    });

    // From client
    socket.on('start-recording', async (roomId) => {
        const room: Room | undefined = rooms.get(roomId);

        if (!room?.isRecording) {
            const data = {
                room_id: roomId,
                owner_id: socket.id
            };

            const create_res = await fetch('http://localhost:8080/recording-create', {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'application/json' }
            });

            const json = await create_res.json();
            console.log(json);

            if (json.status) {
                io.to(roomId).emit('recording-started');
                room!.isRecording = true;

                await fetch('http://localhost:8080/recording-start', {
                    method: 'POST',
                    body: JSON.stringify({ room_id: roomId }),
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
    });

    socket.on('stop-recording', async (roomId) => {
        const room: Room | undefined = rooms.get(roomId);

        if (room?.isRecording) {
            const data = {
                room_id: roomId,
                owner_id: socket.id
            };

            room!.isRecording = false;

            await fetch('http://localhost:8080/recording-stop', {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'application/json' }
            });

            io.to(roomId).emit('recording-stopped');
        }
    });
});

/**
 * -------------------------------FUNCTION DEFINITION ------------------------------------
 */
function startListen() {
    httpsServer.listen(listenPort, parseInt(listenIP), () => {
        const { listenIps } = webRtcTransportOptions;
        const ip = listenIps[0];

        logger.info(ip["valueOf"]);
        logger.info("--------------------running server-------------------------------");
        logger.info(`open https://${ip}:${listenPort} in your web browser`);
    });
}

function createHTTPSServer() {
    const { sslCert, sslKey } = https.certs;

    if (!fs.existsSync(sslCert) || !fs.existsSync(sslKey)) {
        logger.info("SSL files are not found.");
        process.exit(0);
    }

    const tls = {
        key: fs.readFileSync(sslKey),
        cert: fs.readFileSync(sslCert),
    };

    const app: Application = express();
    const httpsServer: HTTPSServer = createServer(tls, app);

    httpsServer.on("error", (err) => {
        logger.error("Failed to start http server. " + err);
    });

    return httpsServer;
}

async function runMediasoupWorkers() {
    const { rtcMaxPort, rtcMinPort } = workerOptions.workerSettings;
    const { numWorkers } = workerOptions;
    const { sslCert, sslKey } = https.certs;

    console.info("Mediasoup version: %s, running %d workers...", mediasoupVersion, numWorkers);

    for (let i = 0; i < numWorkers; ++i) {
        const worker: Worker = await createWorker({
            logLevel: "warn",
            rtcMaxPort: rtcMaxPort,
            rtcMinPort: rtcMinPort,
            dtlsCertificateFile: sslCert,
            dtlsPrivateKeyFile: sslKey,
        });

        worker.on("died", () => {
            logger.error("mediasoup worker died [pid:%d]", worker.pid);
            setTimeout(() => process.exit(1), 2000);
        });

        mediasoupWorkers.push(worker);
    }
}

function getMediasoupWorker(): Worker {
    const selectedWorker: Worker = mediasoupWorkers[currentWorkerIndex];
    currentWorkerIndex++;

    return selectedWorker;
}
