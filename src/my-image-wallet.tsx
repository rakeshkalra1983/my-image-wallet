import {
  openExtensionPreferences,
  ActionPanel,
  Action,
  Grid,
  Icon,
  getPreferenceValues,
  showHUD,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useState, useEffect } from "react";
import Fuse from "fuse.js";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

import { walletPath, fetchFiles, fetchPocketNames, purgePreviews } from "./utils";
import { Card, Pocket, Preferences } from "./types";

let savedPockets: Pocket[];

/** Helper: run AppleScript via Node’s exec. */
function runAppleScript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Escape single quotes in the script
    const escapedScript = script.replace(/'/g, "'\\''");
    exec(`osascript -e '${escapedScript}'`, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/** Downloads an image from a URL and saves it into the "google" subfolder under your wallet. */
async function downloadImageToWallet(url: string, imageName?: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Attempt to get a file extension from the URL. Default to .jpg
  let ext = ".jpg";
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\.(png|jpg|jpeg|gif|bmp)$/i);
    if (match) {
      ext = match[0];
    }
  } catch (_) {
    // fallback to .jpg
  }

  // Create "google" subfolder if not existing
  const googleDir = path.join(walletPath, "google");
  if (!fs.existsSync(googleDir)) {
    fs.mkdirSync(googleDir, { recursive: true });
  }

  // If we got an imageName, sanitize it for use as a filename
  let baseFilename = `google_image_${Date.now()}${ext}`;
  if (imageName && imageName.trim() !== "") {
    // For safety, remove slashes, colons, etc.
    const safeName = imageName.replace(/[\\/:"*?<>|]+/g, "_").trim();
    baseFilename = safeName + ext; // e.g. "10 Real-World Applications.jpg"
  }

  const destFile = path.join(googleDir, baseFilename);
  await fs.promises.writeFile(destFile, buffer);
  return destFile;
}


/**
 * UnifiedGooglePasteAction Component
 *
 * When the user clicks the action, it:
 * - Shows "Downloading Image..."
 * - Downloads the image from the remote URL into the wallet's "google" folder.
 * - Then shows "Pasting Image..." and automatically runs AppleScript to paste the image.
 *
 * No extra click is required—the paste action occurs automatically once the download completes.
 */
function UnifiedGooglePasteAction({ url, imageName }: { url: string; imageName: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    setIsDownloading(true);
    await showHUD("Downloading Image...");
    try {
      // Pass imageName along
      const filePath = await downloadImageToWallet(url, imageName);
      await showHUD("Pasting Image... from " + filePath);
      // Then automatically load into clipboard & paste
      const script = `
        try
            set theImage to (read (POSIX file "${filePath}") as JPEG picture)
            set the clipboard to theImage
            tell application "System Events" to keystroke "v" using {command down}
        on error errMsg
            return "Error: " & errMsg
        end try
      `;
      const result = await runAppleScript(script);
      if (result.startsWith("Error:")) {
        await showHUD(result);
      } else {
        await showHUD("Image pasted!");
      }
    } catch (error: any) {
      await showHUD("Download failed: " + error.message);
    } finally {
      setIsDownloading(false);
    }
  }

  if (isDownloading) {
    return <Action title="Downloading Image..." icon={Icon.Clock} onAction={() => { console.log("Downloading..."); }} />;
  }
  return <Action title="Download & Paste" icon={Icon.Clipboard} onAction={handleDownload} />;
}


/* ---------- The Rest of your my-image-wallet.tsx remains largely the same ---------- */

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const [pocket, setPocket] = useState("");
  const [searchMode, setSearchMode] = useState<"local" | "google">("local");
  const [searchText, setSearchText] = useState("");
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);

  // usePromise for local images (only when searchMode is "local")
  const {
    isLoading: isGridLoading,
    data: gridData,
    revalidate: revalidateGrid,
  } = usePromise(
    (pocket: string, searchMode: "local" | "google") => {
      if (searchMode !== "local") return Promise.resolve({ cardCount: 0 });
      return loadGridComponents(pocket);
    },
    [pocket, searchMode]
  );

  // usePromise for Google images (only when searchMode is "google")
  const {
    isLoading: isGoogleLoading,
    data: googleData,
    revalidate: revalidateGoogle,
  } = usePromise(
    (searchText: string, searchMode: "local" | "google") => {
      if (searchMode !== "google" || !searchText)
        return Promise.resolve({ items: [], cardCount: 0 });
      return loadGoogleImages(searchText);
    },
    [searchText, searchMode]
  );

  useEffect(() => {
    if (searchMode !== "local") return;
    if (!savedPockets) return;

    let cardsToFilter: Card[] = [];
    if (pocket === "") {
      cardsToFilter = savedPockets.flatMap((p) => p.cards);
    } else {
      const found = savedPockets.find((p) => p.name === pocket);
      if (found) {
        cardsToFilter = found.cards;
      }
    }
    if (!searchText) {
      setFilteredCards(cardsToFilter);
      return;
    }
    const searchTerms = searchText.toLowerCase().split(/\s+/).filter(Boolean);
    const normalizedCards = cardsToFilter.map((card) => ({
      ...card,
      _searchName: card.name.toLowerCase().replace(/[-_]/g, " "),
    }));
    const fuse = new Fuse(normalizedCards, {
      keys: ["_searchName"],
      threshold: 0.25,
      includeScore: true,
    });
    const allResults = searchTerms.flatMap((term) => fuse.search(term));
    const uniqueMap = new Map<string, { item: Card; score: number }>();
    for (const result of allResults) {
      if (result.score === undefined) continue;
      const existing = uniqueMap.get(result.item.path);
      if (!existing || existing.score > result.score) {
        uniqueMap.set(result.item.path, { item: result.item, score: result.score });
      }
    }
    const sorted = Array.from(uniqueMap.values()).sort((a, b) => {
      const aMatchesAll = searchTerms.every((term) =>
        a.item.name.toLowerCase().includes(term)
      );
      const bMatchesAll = searchTerms.every((term) =>
        b.item.name.toLowerCase().includes(term)
      );
      if (aMatchesAll && !bMatchesAll) return -1;
      if (!aMatchesAll && bMatchesAll) return 1;
      return (a.score ?? 1) - (b.score ?? 1);
    });
    setFilteredCards(sorted.map((r) => r.item));
  }, [searchText, pocket, searchMode]);

  async function revalidate() {
    if (searchMode === "local") {
      savedPockets = await fetchFiles();
      revalidateGrid();
    } else if (searchMode === "google") {
      revalidateGoogle();
    }
  }

  function purgeRevalidate() {
    purgePreviews();
    revalidate();
  }

  return (
    <Grid
      columns={5}
      filtering={false}
      onSearchTextChange={setSearchText}
      isLoading={searchMode === "local" ? isGridLoading : isGoogleLoading}
      inset={Grid.Inset.Large}
      searchBarPlaceholder={
        searchMode === "local"
          ? `Search ${gridData?.cardCount || 0} Card${gridData?.cardCount === 1 ? "" : "s"}`
          : "Search Google Images"
      }
      searchBarAccessory={<SingleDropdown />}
      actions={
        <ActionPanel>
          {searchMode === "local" ? loadGenericActionNodes() : loadGoogleGenericActionNodes()}
        </ActionPanel>
      }
    >
      {searchMode === "local" ? (
        filteredCards.length > 0 ? (
          <Grid.Section title={pocket ? pocket : "All Cards"}>
            {filteredCards.map((card) => (
              <Grid.Item
                key={card.path}
                content={card.preview ? card.preview : { source: card.path }}
                title={card.name.replace(":", "/")}
                actions={loadCardActionNodes(card)}
                quickLook={{ name: card.name, path: card.path }}
              />
            ))}
          </Grid.Section>
        ) : (
          <Grid.EmptyView title="No Cards Found" description="Press ⌘E to add images!" />
        )
      ) : googleData && googleData.cardCount > 0 ? (
        <Grid.Section title="Google Images">
          {googleData.items.map((item: Card) => (
            <Grid.Item
              key={item.path}
              content={item.preview ? item.preview : { source: item.path }}
              title={item.name}
              actions={loadGoogleActionNodes(item)}
              quickLook={{ name: item.name, path: item.path }}
            />
          ))}
        </Grid.Section>
      ) : (
        <Grid.EmptyView title="No Results" description="Try different search text for Google Images." />
      )}
    </Grid>
  );

  function SingleDropdown() {
    const { isLoading, data } = usePromise(loadDropdownComponents, []);
    if (isLoading || !data) return null;
    function getDropdownValue() {
      if (searchMode === "google") return "google";
      if (!pocket) return "allLocal";
      return pocket;
    }
    return (
      <Grid.Dropdown
        tooltip="Select Source or Pocket"
        value={getDropdownValue()}
        onChange={(newValue) => {
          if (newValue === "google") {
            setSearchMode("google");
            setPocket("");
          } else if (newValue === "allLocal") {
            setSearchMode("local");
            setPocket("");
          } else {
            setSearchMode("local");
            setPocket(newValue);
          }
        }}
      >
        <Grid.Dropdown.Item title="All Cards" value="allLocal" icon={Icon.Wallet} />
        <Grid.Dropdown.Item title="Google" value="google" icon={Icon.MagnifyingGlass} />
        <Grid.Dropdown.Section title="Pockets">
          {data.map((pocketName: string) => (
            <Grid.Dropdown.Item key={pocketName} title={pocketName} value={pocketName} icon={Icon.Folder} />
          ))}
        </Grid.Dropdown.Section>
      </Grid.Dropdown>
    );
  }

  async function loadGridComponents(selectedPocket: string) {
    if (!savedPockets) {
      savedPockets = await fetchFiles();
    }
    let allCards: Card[] = [];
    if (selectedPocket === "") {
      allCards = savedPockets.flatMap((p) => p.cards);
    } else {
      const found = savedPockets.find((p) => p.name === selectedPocket);
      if (found) {
        allCards = found.cards;
      }
    }
    setFilteredCards(allCards);
    return { cardCount: allCards.length };
  }

  async function loadDropdownComponents() {
    const pocketNames = await fetchPocketNames();
    return pocketNames;
  }

  async function loadGoogleImages(query: string) {
    const { googleApiKey, googleSearchEngineId } = preferences;
    if (!googleApiKey || !googleSearchEngineId) {
      throw new Error("Google API Key and Search Engine ID must be set in Preferences.");
    }
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&searchType=image&q=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    const items = (data.items || []).map((item: any) => ({
      path: item.link,
      name: item.title,
      preview: item.link,
    }));
    return { items, cardCount: items.length };
  }

  function loadCardActionNodes(item: Card) {
    return (
      <ActionPanel>
        <ActionPanel.Section>
          <Action.Paste title="Paste Image" content={{ file: item.path }} />
          <Action.CopyToClipboard title="Copy File Path" content={{ file: item.path }} />
          <Action.ToggleQuickLook shortcut={{ modifiers: ["cmd"], key: "y" }} />
        </ActionPanel.Section>
        {loadGenericActionNodes()}
      </ActionPanel>
    );
  }

  function loadGenericActionNodes() {
    return (
      <ActionPanel.Section>
        <Action.ShowInFinder title="Edit Wallet" shortcut={{ modifiers: ["cmd"], key: "e" }} path={walletPath} />
        <Action
          title="Change Wallet Directory"
          icon={Icon.Folder}
          shortcut={{ modifiers: ["cmd", "shift"], key: "e" }}
          onAction={openExtensionPreferences}
        />
        <Action title="Refresh" icon={Icon.ArrowClockwise} shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={revalidate} />
        <Action title="Reset Video Previews" icon={Icon.ArrowClockwise} shortcut={{ modifiers: ["cmd", "shift"], key: "r" }} onAction={purgeRevalidate} />
      </ActionPanel.Section>
    );
  }

  function loadGoogleActionNodes(item: Card) {
    return (
      <ActionPanel>
        <ActionPanel.Section>
          <UnifiedGooglePasteAction url={item.path} imageName={item.name} />
          <Action.CopyToClipboard title="Copy Image URL" content={item.path} />
        </ActionPanel.Section>
        <ActionPanel.Section>
          <Action.OpenInBrowser title="Open Image" url={item.path} />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={revalidate}
          />
        </ActionPanel.Section>
      </ActionPanel>
    );
  }


  function loadGoogleGenericActionNodes() {
    return (
      <ActionPanel.Section>
        <Action title="Change Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
        <Action title="Refresh" icon={Icon.ArrowClockwise} shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={revalidate} />
      </ActionPanel.Section>
    );
  }
}
