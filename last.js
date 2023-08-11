const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const express = require("express");
const app = express();

const UPLOAD_FILE_FOLDER_NAME = "uploaded_files";
const CHUNK_FILE_FOLDER_NAME = "temp_uploads";

const UPLOAD_FILE_FOLDER = path.join(__dirname, UPLOAD_FILE_FOLDER_NAME);
const CHUNK_FILE_FOLDER = path.join(__dirname, CHUNK_FILE_FOLDER_NAME);

app.use("/uploaded_files", express.static(UPLOAD_FILE_FOLDER));

const server = http.createServer();

// temp_uploads 디렉토리가 존재하지 않으면 생성
if (!fs.existsSync(CHUNK_FILE_FOLDER)) {
  fs.mkdirSync(CHUNK_FILE_FOLDER);
}

const wss = new WebSocket.Server({ server });
const clients = new Map(); // 클라이언트 ID를 저장할 맵

// 비디오 파일 목록을 클라이언트에게 전송하는 함수
function sendVideoListToClients() {
  const videoFiles = fs.readdirSync(UPLOAD_FILE_FOLDER);

  const videoList = videoFiles.filter((file) => file.endsWith(".mp4"));

  const message = JSON.stringify({ type: "videoList", videoList });

  clients.forEach((client) => {
    client.send(message);
  });
}

// 비디오 파일이 저장되어 있는 path를 클라이언트에게 전송하는 함수
function sendFilePath() {
  const message = JSON.stringify({
    type: "filepath",
    value: UPLOAD_FILE_FOLDER,
  });
  clients.forEach((client) => client.send(message));
}

wss.on("connection", (ws, req) => {
  const clientIP = req.connection.remoteAddress;
  console.log(`Client connected from ${clientIP}`);

  // 고유 ID 생성 및 클라이언트에게 전송
  const clientId = Math.random().toString(36).substr(2, 9);
  clients.set(clientId, ws);
  ws.send(JSON.stringify({ type: "id", id: clientId }));

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      // 클라이언트에게 비디오 목록 전송
      if (data.type === "getFiles") {
        sendVideoListToClients();
      }

      if (data.type === "message" && data.content === "filepath") {
        sendFilePath();
      }

      if (data.type === "chunk") {
        // 클라이언트가 보낸 파일 청크 처리
        const filePath = path.join(
          __dirname,
          CHUNK_FILE_FOLDER_NAME,
          `${data.filename}_${data.index}`
        );

        fs.writeFileSync(filePath, Buffer.from(data.content), {
          flag: "w", // 'w' flag로 파일 덮어쓰기
        });
        console.log(`Received chunk for ${data.filename}, index ${data.index}`);

        if (data.last) {
          // 마지막 청크이면 파일 합치기 수행
          const combinedFilePath = path.join(
            path.join(__dirname, UPLOAD_FILE_FOLDER_NAME),
            data.filename
          );
          const chunkFiles = Array.from({ length: data.index + 1 }, (_, i) =>
            path.join(
              __dirname,
              CHUNK_FILE_FOLDER_NAME,
              `${data.filename}_${i}`
            )
          );

          try {
            const combinedBuffer = Buffer.concat(
              chunkFiles.map((chunkFile) => fs.readFileSync(chunkFile))
            );

            fs.writeFileSync(combinedFilePath, combinedBuffer);
            console.log(`File saved: ${combinedFilePath}`);

            // 파일 저장 후 불필요한 청크 파일 삭제
            chunkFiles.forEach((chunkFile) => fs.unlinkSync(chunkFile));

            // 파일 저장이 완료되면 비디오 목록을 업데이트하여 클라이언트에게 전송
            sendVideoListToClients();
          } catch (error) {
            console.error(
              "Error while combining chunks and saving file:",
              error
            );
          }
        }
      }
    } catch (error) {
      console.error("Error while processing message:", error);
    }
  });

  ws.on("close", () => {
    console.log(`Client disconnected from ${clientIP}`);
    clients.delete(clientId);
  });
});

server.listen(8080, () => {
  console.log("Server onair...");
});
