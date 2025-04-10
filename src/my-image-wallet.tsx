import {
  openExtensionPreferences,
  ActionPanel,
  Action,
  Grid,
  Icon,
  getPreferenceValues,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useState, useEffect } from "react";
import Fuse from "fuse.js";

import { walletPath, fetchFiles, fetchPocketNames, purgePreviews } from "./utils";
import { Card, Pocket, Preferences } from "./types";

let savedPockets: Pocket[];

export default function Command() {
  const [pocket, setPocket] = useState<string>();
  const [searchText, setSearchText] = useState("");
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);

  const {
    isLoading: isGridLoading,
    data: gridData,
    revalidate: revalidateGrid,
  } = usePromise(loadGridComponents, [pocket]);

  const {
    isLoading: isDropdownLoading,
    data: dropdownData,
    revalidate: revalidateDropdown,
  } = usePromise(loadDropdownComponents);

  useEffect(() => {
    if (!savedPockets) return;

    const cardsToFilter = savedPockets.flatMap((p) => {
      if (pocket === ".unsorted" && !p.name) return p.cards;
      if (pocket && pocket !== "" && p.name !== pocket) return [];
      if (!pocket || pocket === "") return p.cards;
      return [];
    });

    if (!searchText) {
      setFilteredCards(cardsToFilter);
      return;
    }

    const searchTerms = searchText.toLowerCase().split(/\s+/).filter(Boolean);

    // Normalize names for better fuzzy matching (handle hyphens/underscores)
    const normalizedCards = cardsToFilter.map((card) => ({
      ...card,
      _searchName: card.name.toLowerCase().replace(/[-_]/g, " "),
    }));

    const fuse = new Fuse(normalizedCards, {
      keys: ["_searchName"],
      threshold: 0.25, // stricter to avoid junk matches
      includeScore: true,
    });

    const allResults = searchTerms.flatMap((term) => fuse.search(term));

    const uniqueMap = new Map<string, { item: Card; score: number }>();

    for (const result of allResults) {
      if (result.score === undefined) continue;

      const existing = uniqueMap.get(result.item.path);
      const finalScore = result.score;

      if (!existing || existing.score > finalScore) {
        uniqueMap.set(result.item.path, { item: result.item, score: finalScore });
      }
    }

    // Boost items that include *all* search terms
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
  }, [searchText, pocket]);


  return (
    <Grid
      columns={5}
      filtering={false}
      onSearchTextChange={setSearchText}
      isLoading={isGridLoading}
      inset={Grid.Inset.Large}
      searchBarPlaceholder={`Search ${gridData?.cardCount || 0} Card${(gridData?.cardCount || 0) !== 1 ? "s" : ""}`}
      searchBarAccessory={
        <Grid.Dropdown
          tooltip="Select Pocket"
          storeValue={getPreferenceValues<Preferences>().rememberPocketFilter}
          onChange={(newValue) => setPocket(newValue)}
          defaultValue=""
          key="Dropdown"
          isLoading={isDropdownLoading}
        >
          {dropdownData}
        </Grid.Dropdown>
      }
      actions={<ActionPanel>{loadGenericActionNodes()}</ActionPanel>}
    >
      {filteredCards.length > 0 ? (
        <Grid.Section title={pocket || "All Cards"}>
          {filteredCards.map((card) => (
            <Grid.Item
              key={card.path}
              content={card.preview ?? { fileIcon: card.path }}
              title={card.name.replace(":", "/")}
              actions={loadCardActionNodes(card)}
              quickLook={{ name: card.name, path: card.path }}
            />
          ))}
        </Grid.Section>
      ) : (
        <Grid.EmptyView
          title="No Cards Found"
          key="Empty View"
          description="Use ⌘E to add images to the Wallet directory!"
        />
      )}
    </Grid>
  );

  async function loadGridComponents(sortedPocket?: string) {
    if (!savedPockets) {
      savedPockets = await fetchFiles();
    }

    const pockets = savedPockets;
    let allCards: Card[] = [];

    if (sortedPocket) {
      const selected =
        sortedPocket === ".unsorted"
          ? pockets.find((p) => !p.name)
          : pockets.find((p) => p.name === sortedPocket);
      if (selected) {
        allCards = selected.cards;
      }
    } else {
      pockets.forEach((p) => {
        allCards.push(...p.cards);
      });
    }

    setFilteredCards(allCards);
    return { cardCount: allCards.length };
  }

  async function loadDropdownComponents() {
    const pocketNames = await fetchPocketNames();

    return [
      <Grid.Dropdown.Item title="All Cards" value="" key="" icon={Icon.Wallet} />,
      <Grid.Dropdown.Item title="Unsorted" value=".unsorted" key=".unsorted" icon={Icon.Filter} />,
      <Grid.Dropdown.Section title="Pockets" key="Section">
        {pocketNames.map((name) => (
          <Grid.Dropdown.Item title={name} value={name} key={name} />
        ))}
      </Grid.Dropdown.Section>,
    ];
  }

  function loadCardActionNodes(item: Card) {
    return (
      <ActionPanel>
        <ActionPanel.Section>
          <Action.Paste content={{ file: item.path }} />
          <Action.CopyToClipboard content={{ file: item.path }} />
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
        <Action
          title="Refresh"
          icon={Icon.ArrowClockwise}
          shortcut={{ modifiers: ["cmd"], key: "r" }}
          onAction={revalidate}
        />
        <Action
          title="Reset Video Previews"
          icon={Icon.ArrowClockwise}
          shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
          onAction={purgeRevalidate}
        />
      </ActionPanel.Section>
    );
  }

  async function revalidate() {
    savedPockets = await fetchFiles();
    revalidateGrid();
    revalidateDropdown();
  }

  function purgeRevalidate() {
    purgePreviews();
    revalidate();
  }
}
