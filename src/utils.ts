import { Toast, environment, getPreferenceValues, showToast } from "@raycast/api";
import { runJxa } from "run-jxa";

import { basename, extname, join } from "path";
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, readFileSync } from "fs";

import { Pocket, Card, Preferences, Config, HardcodedPath } from "./types";

const PREVIEW_DIR = `${environment.supportPath}/.previews`;

export const walletPath = getWalletPath();

// Load config file
export function loadConfig(): Config | null {
  try {
    // Try multiple possible paths for the config file
    const possiblePaths = [
      join(__dirname, "config.json"),
      join(process.cwd(), "src", "config.json"),
      join(process.cwd(), "config.json"),
      "/Users/rkalra/codebase/personal/Raycast Utils/my-image-wallet/src/config.json"
    ];
    
    for (const configPath of possiblePaths) {
      if (existsSync(configPath)) {
        console.log("Loading config from:", configPath);
        const configData = readFileSync(configPath, "utf8");
        return JSON.parse(configData) as Config;
      }
    }
    
    console.log("Config file not found in any of these paths:", possiblePaths);
  } catch (error) {
    console.error("Error loading config file:", error);
  }
  return null;
}

// Load images from hardcoded paths with regex filtering
export async function loadHardcodedPathImages(hardcodedPath: HardcodedPath): Promise<Card[]> {
  const cards: Card[] = [];
  
  try {
    if (!existsSync(hardcodedPath.path)) {
      return cards;
    }

    const items = readdirSync(hardcodedPath.path);
    const regex = new RegExp(hardcodedPath.nameRegex, 'i'); // Case insensitive

    await Promise.all(
      items.map(async (item) => {
        if (item.startsWith(".")) return;

        const filePath = join(hardcodedPath.path, item);
        let fileStats;

        try {
          fileStats = lstatSync(filePath);
        } catch (e) {
          if (getPreferenceValues<Preferences>().suppressReadErrors) return;
          showToast({
            style: Toast.Style.Failure,
            title: `${filePath} could not be read`,
            message: "Suppress this error in extension preferences.",
          });
          return;
        }

        if (fileStats.isDirectory()) return;

        // Apply regex filter to filename
        if (!regex.test(item)) return;

        const fileExt = extname(filePath).toLowerCase();
        const fileName = basename(filePath, fileExt);

        const videoExts = [".mov", ".mp4", ".m4v", ".mts", ".3gp", ".m2ts", ".m2v", ".mpeg", ".mpg", ".mts", ".vob"];
        const imageExts = [
          ".png",
          ".jpg",
          "jpeg",
          ".bmp",
          ".dds",
          ".exr",
          ".gif",
          ".hdr",
          ".ico",
          ".jpe",
          ".pbm",
          ".pfm",
          ".pgm",
          ".pict",
          ".ppm",
          ".psd",
          ".sgi",
          ".svg",
          ".tga",
          ".tiff",
          ".webp",
          ".cr2",
          ".dng",
          ".heic",
          ".heif",
          ".jp2",
          ".nef",
          ".orf",
          ".raf",
          ".rw2",
        ];
        let previewPath: string | undefined = undefined;

        if (videoExts.includes(fileExt) && getPreferenceValues<Preferences>().videoPreviews) {
          if (!existsSync(PREVIEW_DIR)) mkdirSync(PREVIEW_DIR);
          previewPath = `${PREVIEW_DIR}/${hardcodedPath.path.replaceAll("/", "-")}-${item}.tiff`;

          if (!existsSync(previewPath)) await generateVideoPreview(filePath, previewPath);
          cards.push({ name: fileName, path: filePath, preview: previewPath });
        } else if (imageExts.includes(fileExt)) {
          previewPath = filePath;
          cards.push({ name: fileName, path: filePath, preview: previewPath });
        }
      })
    );

    return cards.sort();
  } catch (error) {
    console.error(`Error loading hardcoded path ${hardcodedPath.path}:`, error);
    return cards;
  }
}
function getWalletPath() {
  const preferences = getPreferenceValues<Preferences>();
  if (preferences.walletDirectory) {
    const definedDir = lstatSync(preferences.walletDirectory);
    if (definedDir.isDirectory()) return preferences.walletDirectory;
  }
  return environment.supportPath;
}

export function fetchPocketNames(): string[] {
  return readdirSync(walletPath).filter((item) => {
    if (item.startsWith(".")) return;

    const filePath = `${walletPath}/${item}`;
    let fileStats;

    try {
      readdirSync(filePath);
      fileStats = lstatSync(filePath);
    } catch (e) {
      if (getPreferenceValues<Preferences>().suppressReadErrors) return;
      showToast({
        style: Toast.Style.Failure,
        title: `${filePath} could not be read`,
        message: "Suppress this error in extension preferences.",
      });

      return;
    }

    if (!fileStats.isDirectory()) return;

    return item;
  });
}

export async function fetchFiles(): Promise<Pocket[]> {
  const pocketArr: Pocket[] = [];

  const cards = await loadPocketCards(walletPath);
  if (cards.length > 0) pocketArr.push({ cards: cards });

  await Promise.all(
    fetchPocketNames().map(async (item) => {
      const cards = await loadPocketCards(`${walletPath}/${item}`);
      if (cards.length > 0) pocketArr.push({ name: item, cards: cards });
    })
  );

  return pocketArr;
}

export async function fetchFileList(): Promise<Pocket[]> {
  const pockets: Pocket[] = [];
  
  // Load regular wallet pockets
  const regularPockets = fetchPocketNames().map((pocketName) => {
    const pocketDir = join(walletPath, pocketName);
    const cards: Card[] = readdirSync(pocketDir)
      .filter((file) => {
        // skip dot‑files and sub‑dirs
        if (file.startsWith(".")) return false;
        const stats = lstatSync(join(pocketDir, file));
        return stats.isFile();
      })
      .map((file) => ({
        name: basename(file, extname(file)),
        path: join(pocketDir, file),
        // no preview field here
      }));
    return { name: pocketName, cards };
  });
  
  pockets.push(...regularPockets);
  
  // Load hardcoded paths from config
  const config = loadConfig();
  console.log("Config loaded:", config);
  if (config && config.hardcodedPaths) {
    console.log("Processing hardcoded paths:", config.hardcodedPaths.length);
    await Promise.all(
      config.hardcodedPaths.map(async (hardcodedPath) => {
        console.log("Loading images from:", hardcodedPath.path);
        const cards = await loadHardcodedPathImages(hardcodedPath);
        console.log(`Found ${cards.length} images in ${hardcodedPath.pocketName}`);
        if (cards.length > 0) {
          pockets.push({ name: hardcodedPath.pocketName, cards });
        }
      })
    );
  } else {
    console.log("No config or hardcoded paths found");
  }
  
  return pockets;
}

async function loadPocketCards(dir: string): Promise<Card[]> {
  const cardArr: Card[] = [];
  const items = readdirSync(dir);

  await Promise.all(
    items.map(async (item) => {
      if (item.startsWith(".")) return;

      const filePath = `${dir}/${item}`;
      let fileStats;

      try {
        fileStats = lstatSync(filePath);
      } catch (e) {
        if (getPreferenceValues<Preferences>().suppressReadErrors) return;
        showToast({
          style: Toast.Style.Failure,
          title: `${filePath} could not be read`,
          message: "Suppress this error in extension preferences.",
        });

        return [];
      }

      const fileExt = extname(filePath).toLowerCase();
      const fileName = basename(filePath, fileExt);

      if (fileStats.isDirectory()) return;

      const videoExts = [".mov", ".mp4", ".m4v", ".mts", ".3gp", ".m2ts", ".m2v", ".mpeg", ".mpg", ".mts", ".vob"];
      const imageExts = [
        ".png",
        ".jpg",
        "jpeg",
        ".bmp",
        ".dds",
        ".exr",
        ".gif",
        ".hdr",
        ".ico",
        ".jpe",
        ".pbm",
        ".pfm",
        ".pgm",
        ".pict",
        ".ppm",
        ".psd",
        ".sgi",
        ".svg",
        ".tga",
        ".tiff",
        ".webp",
        ".cr2",
        ".dng",
        ".heic",
        ".heif",
        ".jp2",
        ".nef",
        ".orf",
        ".raf",
        ".rw2",
      ];
      let previewPath: string | undefined = undefined;

      if (videoExts.includes(fileExt) && getPreferenceValues<Preferences>().videoPreviews) {
        if (!existsSync(PREVIEW_DIR)) mkdirSync(PREVIEW_DIR);
        previewPath = `${PREVIEW_DIR}/${dir.replaceAll("/", "-")}-${item}.tiff`;

        if (!existsSync(previewPath)) await generateVideoPreview(filePath, previewPath);
        cardArr.push({ name: fileName, path: filePath, preview: previewPath });
      } else if (imageExts.includes(fileExt)) {
        previewPath = filePath;
        cardArr.push({ name: fileName, path: filePath, preview: previewPath });
      }


    })
  );

  return cardArr.sort();
}

export function purgePreviews() {
  rmSync(PREVIEW_DIR, { recursive: true, force: true });
}

async function generateVideoPreview(inputPath: string, outputPath: string): Promise<string | undefined> {
  const previewPath = await runJxa(
    `
      ObjC.import("objc");
      ObjC.import("CoreMedia");
      ObjC.import("Foundation");
      ObjC.import("AVFoundation");
      ObjC.import("CoreGraphics");
      ObjC.import("CoreImage");
      ObjC.import("AppKit");
      
      const [inputPath, outputPath] = args;

      // Load the video file
      const assetURL = $.NSURL.fileURLWithPath(
        inputPath
      );

      const asset = $.objc_getClass("AVAsset").assetWithURL(assetURL);
      
      // Ensure the video has a video track
      if (asset.tracksWithMediaType($.AVMediaTypeVideo).count == 0) {
        return undefined;
      }

      const frameCount = 15; // The number of frames to analyze
      
      // Set up the AVAssetReader for reading the video frames into pixel buffers
      const reader = $.objc_getClass("AVAssetReader").alloc.initWithAssetError(
        asset,
        null
      );
      const track = asset.tracksWithMediaType($.AVMediaTypeVideo).objectAtIndex(0);
      const settings = $.NSDictionary.dictionaryWithObjectForKey(
        "420v",
        "PixelFormatType"
      );
      readerOutput = $.objc_getClass(
        "AVAssetReaderTrackOutput"
      ).alloc.initWithTrackOutputSettings(track, settings);
      reader.addOutput(readerOutput);
      reader.startReading;
      
      // Read the video frames into pixel buffers
      let buf = readerOutput.copyNextSampleBuffer;
      if (reader.status != $.AVAssetReaderStatusFailed) {
        const imageBufferRef = ObjC.castRefToObject(
          $.CMSampleBufferGetImageBuffer(buf)
        );
      const CIImage = $.CIImage.imageWithCVPixelBuffer(imageBufferRef)
      const imageRep = $.NSBitmapImageRep.alloc.initWithCIImage(CIImage)
      const imageData = imageRep.TIFFRepresentation
      imageData.writeToFileAtomically(outputPath, true)

      return outputPath
      }
      `,
    [inputPath, outputPath]
  );

  return previewPath?.toString();
}
