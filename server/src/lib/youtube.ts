import { YoutubeTranscript } from "youtube-transcript";
import { ValidationError } from "../types/app-error.js";

export function extractYoutubeVideoId(url: string) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export async function fetchYoutubeTranscript(url: string) {
  const videoId = extractYoutubeVideoId(url);

  if (!videoId) {
    throw new ValidationError("Enter a valid YouTube URL");
  }

  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    const content = segments
      .map((segment) => segment.text)
      .join(" ")
      .trim();

    if (!content) {
      throw new ValidationError("No transcript found for this video");
    }

    return { videoId, content };
  } catch {
    throw new ValidationError(
      "Could not fetch transcript. The video may not have captions.",
    );
  }
}
