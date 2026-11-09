import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Action,
  ActionPanel,
  Clipboard,
  Color,
  getPreferenceValues,
  Icon,
  Image,
  List,
  showToast,
  Toast,
} from "@raycast/api";

import { deleteFromHistory, formatBytes, getHistory, HistoryResponse, retryDownload } from "./helper.js";
import { getFavicon, getProgressIcon } from "@raycast/utils";

function filterHistory(data: HistoryResponse, search: string): HistoryResponse {
  const query = search.toLowerCase();

  return {
    done: data.done.filter((el) => el.title.toLowerCase().includes(query) || el.url.toLowerCase().includes(query)),
    queue: data.queue.filter((el) => el.title.toLowerCase().includes(query) || el.url.toLowerCase().includes(query)),
    pending: data.pending.filter(
      (el) => el.title.toLowerCase().includes(query) || el.url.toLowerCase().includes(query),
    ),
  };
}

export default function History() {
  const [searchText, setSearchText] = useState("");
  const [historyList, setHistoryList] = useState<HistoryResponse>({
    done: [],
    queue: [],
    pending: [],
  });

  const prefs = getPreferenceValues();

  const loadHistory = useCallback(async () => {
    const data = await getHistory();
    setHistoryList(data);
  }, []);

  const filteredList = useMemo(() => filterHistory(historyList, searchText), [historyList, searchText]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (prefs.autoRefreshHistory === "off") return;
    if (!historyList.queue.length) return;

    const timeout = setTimeout(
      () => {
        loadHistory();
      },
      parseInt(prefs.autoRefreshHistory) * 1000,
    );

    return () => clearTimeout(timeout);
  }, [historyList, loadHistory, prefs.autoRefreshHistory]);

  const order = ["queue", "pending", "done"] as const;
  const title = {
    pending: "Pending",
    done: "Done",
    queue: "Queue",
  };

  const iconMap: Record<string, Icon> = {
    video: Icon.Video,
    audio: Icon.Music,
    thumbnail: Icon.Image,
    caption: Icon.SpeechBubbleActive,
  };

  return (
    <List
      filtering={false}
      onSearchTextChange={setSearchText}
      navigationTitle="MeTube History"
      searchBarPlaceholder="Search through your downloads"
    >
      {order.map((key) => {
        return (
          <List.Section
            title={title[key]}
            key={key}
            subtitle={
              key === "done" && filteredList[key]
                ? `${filteredList[key].filter((el) => el.status === "finished").length} completed • ${filteredList[key].filter((el) => el.status === "error").length} failed`
                : ""
            }
          >
            {filteredList[key] &&
              filteredList[key].toReversed().map((el) => {
                let icon: Image.ImageLike = {
                  source: Icon.Hourglass,
                  tintColor: Color.Blue,
                };

                let subtitle = el.size ? formatBytes(el.size) : "";

                switch (el.status) {
                  case "finished":
                    icon.source = Icon.CheckCircle;
                    icon.tintColor = Color.Green;
                    break;
                  case "error":
                    icon.source = Icon.XMarkCircle;
                    icon.tintColor = Color.Red;
                    break;
                  case "downloading":
                    icon = getProgressIcon(el.percent / 100, Color.Green);
                    subtitle = `${Math.floor(el.percent)}%`;
                    break;
                }

                return (
                  <List.Item
                    title={el.title}
                    subtitle={subtitle}
                    key={el.id}
                    icon={icon}
                    accessories={[
                      { date: new Date(Math.floor(el.timestamp / 1000000)) },
                      { icon: iconMap[el.download_type] ?? Icon.QuestionMarkCircle },
                      ...(prefs.showFavicons ? [{ icon: getFavicon(el.url) }] : []),
                    ]}
                    quickLook={
                      prefs.metubeLocation
                        ? {
                            path: `${prefs.metubeLocation}/${el.filename}`,
                          }
                        : undefined
                    }
                    actions={
                      <ActionPanel>
                        {el.status === "error" && (
                          <ActionPanel.Section>
                            <Action
                              title="Retry"
                              icon={Icon.RotateClockwise}
                              onAction={async () => {
                                try {
                                  await retryDownload(el.url);

                                  await showToast({
                                    style: Toast.Style.Success,
                                    title: "Retrying...",
                                  });
                                  await loadHistory();
                                } catch {
                                  await showToast({
                                    style: Toast.Style.Failure,
                                    title: "Failed to retry.",
                                  });
                                }
                              }}
                            />
                          </ActionPanel.Section>
                        )}
                        {prefs.metubeLocation && el.status === "finished" && (
                          <ActionPanel.Section>
                            <Action
                              title="Paste File to Active App"
                              icon={Icon.Document}
                              onAction={async () => {
                                try {
                                  const fileContent: Clipboard.Content = {
                                    file: `${prefs.metubeLocation}/${el.filename}`,
                                  };
                                  await Clipboard.paste(fileContent);
                                  await showToast({
                                    style: Toast.Style.Success,
                                    title: "Pasted the file.",
                                  });
                                } catch {
                                  await showToast({
                                    style: Toast.Style.Failure,
                                    title: "Failed to copy the file.",
                                  });
                                }
                              }}
                            />

                            <Action
                              title="Copy File to Clipboard"
                              icon={Icon.CopyClipboard}
                              onAction={async () => {
                                try {
                                  const fileContent: Clipboard.Content = {
                                    file: `${prefs.metubeLocation}/${el.filename}`,
                                  };
                                  await Clipboard.copy(fileContent);
                                  await showToast({
                                    style: Toast.Style.Success,
                                    title: "Copied the file.",
                                  });
                                } catch {
                                  await showToast({
                                    style: Toast.Style.Failure,
                                    title: "Failed to copy the file.",
                                  });
                                }
                              }}
                            />
                            <Action.ToggleQuickLook />
                          </ActionPanel.Section>
                        )}
                        <Action.OpenInBrowser title="Open Source in Browser" url={el.url} />
                        <Action.CopyToClipboard title="Copy Source URL" content={el.url} icon={Icon.Link} />
                        <ActionPanel.Section>
                          {(key === "done" || key === "queue") && (
                            <Action
                              title={`Delete from ${key === "done" ? "History" : "Queue"}`}
                              icon={Icon.MinusCircle}
                              style={Action.Style.Destructive}
                              onAction={async () => {
                                try {
                                  await deleteFromHistory(el.url, key);

                                  await showToast({
                                    style: Toast.Style.Success,
                                    title: "Removed from History.",
                                  });
                                  await loadHistory();
                                } catch {
                                  await showToast({
                                    style: Toast.Style.Failure,
                                    title: "Failed to remove from History.",
                                  });
                                }
                              }}
                            />
                          )}
                          {key === "done" && (
                            <Action
                              title="Delete File"
                              icon={Icon.DeleteDocument}
                              style={Action.Style.Destructive}
                              onAction={async () => {
                                try {
                                  await deleteFromHistory(el.url, key, true);

                                  await showToast({
                                    style: Toast.Style.Success,
                                    title: "File deleted.",
                                  });
                                  await loadHistory();
                                } catch {
                                  await showToast({
                                    style: Toast.Style.Failure,
                                    title: "Failed to delete the file.",
                                  });
                                }
                              }}
                            />
                          )}
                        </ActionPanel.Section>
                      </ActionPanel>
                    }
                  />
                );
              })}
          </List.Section>
        );
      })}
    </List>
  );
}
