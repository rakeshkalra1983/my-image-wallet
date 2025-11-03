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

import { walletPath, fetchFiles, fetchPocketNames, purgePreviews, fetchFileList, loadSynonyms } from "./utils";
import { Card, Pocket, Preferences } from "./types";

// Maximum number of items to show per page
const ITEMS_PER_PAGE = 200;

export default function Command() {
  const [allPockets, setAllPockets] = useState<Pocket[]>([]);
  const [selectedPocket, setSelectedPocket] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [synonyms, setSynonyms] = useState<Record<string, string[]>>({});

  // Load only file names & paths on mount
  useEffect(() => {
    async function load() {
      const pockets = await fetchFileList();
      setAllPockets(pockets);
      
      // Load synonyms
      const loadedSynonyms = loadSynonyms();
      setSynonyms(loadedSynonyms);
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

  // Filter by search terms with synonym expansion and score for sorting
  const filtered = useMemo(() => {
    if (!searchText) {
      return cards;
    }
    const lowerSearchText = searchText.toLowerCase();
    
    // Helper function to check if a term matches and return match type
    const getTermMatchType = (term: string, cardName: string): 'exact' | 'synonym' | null => {
      const lowerTerm = term.toLowerCase();
      
      // First, check if the term itself matches (exact match)
      if (cardName.includes(lowerTerm)) return 'exact';
      
      // Check if this term is a key in synonyms and any synonym matches
      if (synonyms[lowerTerm]) {
        if (synonyms[lowerTerm].some(synonym => cardName.includes(synonym.toLowerCase()))) {
          return 'synonym';
        }
      }
      
      // Check if this term is a synonym itself - if so, check if the key or other synonyms match
      for (const [key, synonymList] of Object.entries(synonyms)) {
        if (synonymList.some(s => s.toLowerCase() === lowerTerm)) {
          // Check if the key matches (exact match of the key)
          if (cardName.includes(key.toLowerCase())) return 'exact';
          // Check if any other synonym in the group matches
          if (synonymList.some(synonym => {
            const lowerSynonym = synonym.toLowerCase();
            return lowerSynonym !== lowerTerm && cardName.includes(lowerSynonym);
          })) {
            return 'synonym';
          }
        }
      }
      
      return null;
    };
    
    // Map cards to scored results
    const scoredCards = cards.map((c) => {
      const cardName = c.name.toLowerCase();
      
      // Check multi-word synonym keys first (longer keys first to prioritize more specific matches)
      const multiWordKeys = Object.keys(synonyms)
        .filter(key => key.includes(" "))
        .sort((a, b) => b.length - a.length);
      
      let remainingSearchText = lowerSearchText;
      const matchedTerms: string[] = [];
      
      // Try to match multi-word keys
      for (const key of multiWordKeys) {
        if (remainingSearchText.includes(key.toLowerCase())) {
          const matchType = getTermMatchType(key, cardName);
          if (matchType) {
            matchedTerms.push(key);
            // Remove this key from remaining search text
            remainingSearchText = remainingSearchText.replace(key.toLowerCase(), "").trim();
          }
        }
      }
      
      // Process remaining single words
      const remainingWords = remainingSearchText.split(/\s+/).filter(Boolean);
      const allTermsToCheck = [...matchedTerms, ...remainingWords];
      
      // Check if all terms match and calculate score
      let exactMatches = 0;
      let synonymMatches = 0;
      let allMatch = true;
      
      for (const term of allTermsToCheck) {
        const matchType = getTermMatchType(term, cardName);
        if (matchType === 'exact') {
          exactMatches++;
        } else if (matchType === 'synonym') {
          synonymMatches++;
        } else {
          allMatch = false;
          break;
        }
      }
      
      if (!allMatch) {
        return { card: c, score: -1 }; // Doesn't match, will be filtered out
      }
      
      // Score: exact matches worth more (1000 each), synonym matches worth less (1 each)
      // This ensures exact matches always come first
      const score = exactMatches * 1000 + synonymMatches;
      
      return { card: c, score };
    });
    
    // Filter out non-matching cards and sort by score (descending), then by name
    return scoredCards
      .filter(item => item.score >= 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score; // Higher score first
        }
        return a.card.name.localeCompare(b.card.name); // Alphabetical as tiebreaker
      })
      .map(item => item.card);
  }, [cards, searchText, synonyms]);

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

