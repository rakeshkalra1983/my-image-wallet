import {
  openExtensionPreferences,
  ActionPanel,
  Action,
  Grid,
  Icon,
  getPreferenceValues,
  showHUD,
} from "@raycast/api";
import { useState, useEffect, useMemo } from "react";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

import { walletPath, fetchFiles, fetchPocketNames, purgePreviews, fetchFileList } from "./utils";
import { Card, Pocket, Preferences } from "./types";

// Maximum number of items to show per page
const ITEMS_PER_PAGE = 200;

export default function Command() {
  const [allPockets, setAllPockets] = useState<Pocket[]>([]);
  const [selectedPocket, setSelectedPocket] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  // Load only file names & paths on mount
  useEffect(() => {
    async function load() {
      const pockets = await fetchFileList();
      setAllPockets(pockets);
    }
    load();
  }, []);

  // Flatten cards based on selected pocket (or all)
  const cards = useMemo(() => {
    const pocketsToUse = selectedPocket
      ? allPockets.filter((p) => p.name === selectedPocket)
      : allPockets;
    return pocketsToUse.flatMap((p) => p.cards);
  }, [allPockets, selectedPocket]);

  // Filter by search terms
  const filtered = useMemo(() => {
    if (!searchText) {
      return cards;
    }
    const terms = searchText.toLowerCase().split(/\s+/).filter(Boolean);
    return cards.filter((c) =>
      terms.every((t) => c.name.toLowerCase().includes(t))
    );
  }, [cards, searchText]);

  // Determine which cards to display (with pagination)
  const displayed = useMemo(
    () => filtered.slice(0, page * ITEMS_PER_PAGE),
    [filtered, page]
  );

  // Render EmptyView if no results
  if (filtered.length === 0) {
    return (
      <Grid
        columns={6}
        filtering={false}
        fit={Grid.Fit.Contain}
        searchBarPlaceholder="No images found"
        onSearchTextChange={(text) => {
          setSearchText(text);
          setPage(1);
        }}
      >
        <Grid.EmptyView
          title="No Images Found"
          description="Try different search text or select another pocket."
        />
      </Grid>
    );
  }

  return (
    <Grid
      columns={6}
      filtering={false}
      fit={Grid.Fit.Contain}
      onSearchTextChange={(text) => {
        setSearchText(text);
        setPage(1); // reset pagination when searching
      }}
      searchBarPlaceholder={`Search ${filtered.length} image${filtered.length === 1 ? "" : "s"}`}
      searchBarAccessory={
        <Grid.Dropdown
          tooltip="Select Pocket"
          value={selectedPocket}
          onChange={(newVal) => {
            setSelectedPocket(newVal);
            setPage(1);
          }}
        >
          <Grid.Dropdown.Item title="All Pockets" value="" icon={Icon.Wallet} />
          {allPockets.map((p) => (
            <Grid.Dropdown.Item
              key={p.name}
              title={p.name || ""}
              value={p.name || ""}
              icon={Icon.Folder}
            />
          ))}
        </Grid.Dropdown>
      }
    >
      <Grid.Section title={selectedPocket || "All Images"}>
        {displayed.map((card: Card) => (
          <Grid.Item
            key={card.path}
            content={{ source: card.path }}
            title={card.name}
            actions={
              <ActionPanel>
                <Action.Paste title="Paste Image" content={{ file: card.path }} />
                <Action.CopyToClipboard title="Copy File Path" content={card.path} />
              </ActionPanel>
            }
          />
        ))}

        {filtered.length > displayed.length && (
          <Grid.Item
            title="Load More"
            content={{ source: Icon.ArrowClockwise }}
            actions={
              <ActionPanel>
                <Action
                  title="Load More"
                  icon={Icon.ArrowClockwise}
                  onAction={() => setPage((prev) => prev + 1)}
                />
              </ActionPanel>
            }
          />
        )}
      </Grid.Section>
    </Grid>
  );
}

