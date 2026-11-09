import { getPreferenceValues } from "@raycast/api";

interface AddToQueueResponse {
  status: string;
  msg?: string;
}

type HistoryElement = {
  id: string;
  title: string;
  url: string;
  format: string;
  status: string;
  size: number;
  timestamp: number;
  filename: string;
  percent: number;
  download_type: string;
};

export interface HistoryResponse {
  done: HistoryElement[];
  queue: HistoryElement[];
  pending: HistoryElement[];
}

export async function addToQueue(
  url: string,
  quality: string | null = null,
  format: string | null = null,
): Promise<AddToQueueResponse> {
  const preferences = getPreferenceValues<Preferences>();
  quality = quality ?? preferences.quality;
  format = format ?? preferences.format;

  const metubeUrl = `${preferences.metubeUrl}/add`;

  const body = JSON.stringify({ url, quality, format });
  const response = await fetch(metubeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });
  return response.json() as Promise<AddToQueueResponse>;
}

// original source: https://gist.github.com/dperini/729294
const re_weburl = new RegExp(
  "^" +
    "(?:(?:(?:https?|ftp):)?\\/\\/)?" +
    "(?:\\S+(?::\\S*)?@)?" +
    "(?:" +
    "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
    "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
    "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
    "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
    "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
    "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
    "|" +
    "(?:" +
    "(?:" +
    "[a-z0-9\\u00a1-\\uffff]" +
    "[a-z0-9\\u00a1-\\uffff_-]{0,62}" +
    ")?" +
    "[a-z0-9\\u00a1-\\uffff]\\." +
    ")+" +
    "(?:[a-z\\u00a1-\\uffff]{2,}\\.?)" +
    ")" +
    "(?::\\d{2,5})?" +
    "(?:[/?#]\\S*)?" +
    "$",
  "i",
);

export function isValidLink(testString: string) {
  return re_weburl.test(testString);
}

export async function getHistory(): Promise<HistoryResponse> {
  const preferences = getPreferenceValues<Preferences>();

  const metubeUrl = `${preferences.metubeUrl}/history`;
  const response = await fetch(metubeUrl);

  return response.json() as Promise<HistoryResponse>;
}

export async function deleteFromHistory(id: string, type: string, delete_files = false) {
  const preferences = getPreferenceValues<Preferences>();

  const body = JSON.stringify({
    ids: [id],
    where: type,
    delete_files,
  });

  const metubeUrl = `${preferences.metubeUrl}/delete`;
  const response = await fetch(metubeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  return response.json();
}

export async function retryDownload(id: string) {
  const preferences = getPreferenceValues<Preferences>();

  const body = JSON.stringify({
    id,
  });

  const metubeUrl = `${preferences.metubeUrl}/retry`;
  const response = await fetch(metubeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  return response.json();
}

export function formatBytes(bytes: number) {
  if (!+bytes) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(0))} ${sizes[i]}`;
}
