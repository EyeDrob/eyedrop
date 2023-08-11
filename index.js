const socket = new WebSocket("ws://10.101.120.196:8080");

socket.addEventListener("open", (event) => {
  console.log("Connected to server");
  // 파일 목록 요청
  socket.send(JSON.stringify({ type: "getFiles" }));
});

socket.addEventListener("message", (event) => {
  console.log(event.data);
  const data = JSON.parse(event.data);

  if (data.type === "id") {
    const clientId = data.id;
    const uploadButton = document.querySelector("#upload-button");
    const timesubmit = document.querySelector("#time-submit");

    // 파일 업로드 버튼 클릭 시
    uploadButton.addEventListener("click", () => {
      const file = document.querySelector("#file-input").files[0];
      const chunkSize = 1024 * 1024; // 1MB

      const reader = new FileReader();
      let chunkIndex = 0;

      reader.onload = async (e) => {
        const fileData = e.target.result;
        const totalChunks = Math.ceil(fileData.byteLength / chunkSize);

        while (chunkIndex < totalChunks) {
          const chunk = fileData.slice(
            chunkIndex * chunkSize,
            (chunkIndex + 1) * chunkSize
          );
          const isLastChunk = chunkIndex === totalChunks - 1;

          socket.send(
            JSON.stringify({
              type: "chunk",
              clientId,
              filename: file.name,
              index: chunkIndex,
              content: Array.from(new Uint8Array(chunk)),
              last: isLastChunk,
            })
          );

          chunkIndex++;
          if (isLastChunk) {
            console.log("File upload completed");
          }
        }
      };

      reader.readAsArrayBuffer(file);
    });

    // 시간 설정 버튼을 눌렀을 때
    timesubmit.addEventListener("click", () => {
      submitTimeRange();
    });
  }

  // 새로운 파일 목록을 받았을 때
  if (data.type === "videoList") {
    const fileList = document.querySelector("#file-list");
    fileList.innerHTML = ""; // 기존 목록 삭제
    data.videoList.forEach((filename) => {
      const option = document.createElement("option");
      option.value = filename;
      option.textContent = filename;
      fileList.appendChild(option);
    });
  }

  // 서버 측에서 파일 경로를 받고 동영상 재생
  if (data.type === "filepath") {
    serverFilePath = data.value;
    const videoPlayer = document.querySelector("#video-player");
    const fileList = document.querySelector("#file-list");
    const selectedFile = fileList.value;
    videoPlayer.src = `${serverFilePath}/${selectedFile}`;
    videoPlayer.load();
    videoPlayer.play();
  }

  if (data.type === "playTimeRange") {
    const timesubmit = document.querySelector("#time-submit");
    timesubmit.addEventListener("click", () => {
      submitTimeRange();
    });
  }
});

socket.addEventListener("close", (event) => {
  console.log("Disconnected from server");
});

const playSelectedButton = document.querySelector("#play-selected-button");

playSelectedButton.addEventListener("click", () => {
  // 서버에 파일 경로 요청, 요청 후 동작은 socket handler에서 처리
  socket.send(
    JSON.stringify({
      type: "message",
      content: "filepath",
    })
  );
});

function submitTimeRange() {
  const video_id = getIdFromUrl(document.getElementById("url").value);
  const startTime = document.getElementById("start").value;
  const endTime = document.getElementById("end").value;

  const cutdata = {
    videoID: video_id,
    start: startTime,
    end: endTime,
  };

  socket.send(JSON.stringify(cutdata));
}

function onYouTubeIframeAPIReady() {
  playYoutube = new YT.Player("player", {
    height: "600",
    width: "800",
    videoId: "YOUR_VIDEO_ID",
  });
}

function loadVideo() {
  const url = document.getElementById("url").value;
  const videoId = getIdFromUrl(url);

  if (videoId) {
    playYoutube.loadVideoById(videoId, 0);
  } else {
    alert("Invalid YouTube URL!");
  }
}

function getIdFromUrl(url) {
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);

  return match && match[2].length === 11 ? match[2] : null;
}
