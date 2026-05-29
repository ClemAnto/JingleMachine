// Wraps yt-dlp for the two things the helper does: reading a video's metadata
// and extracting a (possibly trimmed) MP3.
import { execFile } from "node:child_process";
import { join, delimiter } from "node:path";
import { config } from "./config.js";
import { binaryPaths } from "./binaries.js";

// Runs a binary and resolves with its stdout. We prepend the bin folder to PATH
// so yt-dlp can discover ffmpeg/ffprobe/deno on its own.
function run(cmd, args) {
  const env = { ...process.env, PATH: config.binDir + delimiter + process.env.PATH };
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { env, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

// Fetches video metadata without downloading anything.
export async function getInfo(url) {
  const stdout = await run(binaryPaths.ytDlp, [
    "--dump-single-json",
    "--no-playlist",
    url,
  ]);
  const data = JSON.parse(stdout);
  return {
    id: data.id,
    title: data.title,
    uploader: data.uploader,
    durationSeconds: data.duration,
    thumbnail: data.thumbnail,
    webpageUrl: data.webpage_url,
  };
}

// Downloads the audio and converts it to MP3. If start/end (in seconds) are
// given, yt-dlp trims to that section while downloading (using ffmpeg under the
// hood). Returns the path to the produced file.
export async function extractMp3(url, start, end) {
  const outBase = join(config.tmpDir, `jingle-${Date.now()}`);
  const args = [
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    config.audioBitrate,
    "--no-playlist",
    "--ffmpeg-location",
    config.binDir,
    "-o",
    `${outBase}.%(ext)s`,
  ];

  if (start != null && end != null) {
    args.push("--download-sections", `*${start}-${end}`, "--force-keyframes-at-cuts");
  }

  args.push(url);
  await run(binaryPaths.ytDlp, args);
  return `${outBase}.mp3`;
}
