# Configuration File

The Image Wallet extension supports a configuration file that allows you to add hardcoded paths with regex filtering for image names.

## Configuration File Location

The configuration file should be placed at: `src/config.json`

## Configuration Format

```json
{
  "hardcodedPaths": [
    {
      "path": "/Users/username/Pictures/Screenshots",
      "nameRegex": "screenshot.*\\.(png|jpg|jpeg)$",
      "pocketName": "Screenshots"
    },
    {
      "path": "/Users/username/Downloads",
      "nameRegex": ".*\\.(png|jpg|jpeg|gif|webp)$",
      "pocketName": "Downloads"
    }
  ]
}
```

## Configuration Properties

### `hardcodedPaths`
An array of hardcoded path configurations.

### Each hardcoded path object contains:

- **`path`** (string): The absolute path to the directory containing images
- **`nameRegex`** (string): A regular expression pattern to filter image filenames
- **`pocketName`** (string): The name that will appear as a pocket in the Image Wallet

## Regex Examples

- `screenshot.*\\.(png|jpg|jpeg)$` - Matches files starting with "screenshot" and ending with common image extensions
- `.*\\.(png|jpg|jpeg|gif|webp)$` - Matches any file with common image extensions
- `^IMG_.*\\.(jpg|jpeg)$` - Matches files starting with "IMG_" and ending with jpg/jpeg
- `.*\\.(png|jpg|jpeg)$` - Matches any PNG, JPG, or JPEG file

## How It Works

1. The extension loads the configuration file on startup
2. For each hardcoded path, it scans the directory for files
3. Files are filtered using the provided regex pattern (case-insensitive)
4. Only supported image and video formats are included
5. Images from hardcoded paths appear as separate pockets in the wallet

## Supported File Formats

The same image and video formats are supported as the regular wallet:
- Images: PNG, JPG, JPEG, BMP, GIF, WebP, TIFF, SVG, and many more
- Videos: MOV, MP4, M4V, and other common video formats

## Notes

- The regex filtering is applied to the full filename (including extension)
- The filtering is case-insensitive
- If a hardcoded path doesn't exist or can't be read, it will be silently skipped
- Hardcoded paths work alongside the regular wallet directory structure
- Video previews are generated for hardcoded paths if the video previews setting is enabled
