# SmartLog Finance - Logo & Icon Files

## 📦 Files Included

1. **logo.svg** - Scalable vector logo (512x512)
2. **generate-icons.html** - Interactive icon generator for all sizes

## 🎨 How to Use

### Method 1: Use SVG Logo (Recommended)
- The `logo.svg` file is a scalable vector graphic
- Can be converted to any size PNG using online tools or image editors
- Maintains perfect quality at any resolution

### Method 2: Generate PNG Icons (For Electron)
1. Open `generate-icons.html` in your web browser
2. You'll see icons in all common sizes: 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024
3. Click "Download All Icons" to download all sizes at once
4. Or click individual download buttons for specific sizes

## 🖥️ For Electron App

### Icon Sizes Needed:
- **Windows**: 256x256 (converted to .ico)
- **macOS**: 512x512 or 1024x1024 (converted to .icns)
- **Linux**: 512x512 PNG

### Steps to Add to Electron:
1. Generate icons using `generate-icons.html`
2. Place icon files in `/electron` folder
3. Update `electron-builder.yml`:
   ```yaml
   win:
     icon: electron/icon.ico
   mac:
     icon: electron/icon.icns
   linux:
     icon: electron/icon.png
   ```

### Converting to Platform-Specific Formats:

**Windows (.ico):**
- Use online converter: https://convertio.co/png-ico/
- Or use ImageMagick: `convert smartlog-icon-256x256.png icon.ico`

**macOS (.icns):**
- Use online converter: https://cloudconvert.com/png-to-icns
- Or use `png2icns` tool: `png2icns icon.icns smartlog-icon-512x512.png`

**Linux:**
- Just use the PNG file directly (512x512 recommended)

## 🎨 Logo Design Details

- **Colors**: Blue (#2563eb) → Indigo (#4f46e5) → Purple (#7c3aed) gradient
- **Style**: Modern, professional finance/analytics theme
- **Icon**: Bar chart representing financial growth
- **Shape**: Circular with gradient background
- **Effects**: Drop shadow, shine overlay, border accent

## 🔧 Customization

If you want to modify colors or style:
1. Edit `logo.svg` with any SVG editor (Inkscape, Figma, etc.)
2. Or edit the JavaScript in `generate-icons.html` to change colors/design

## 📱 Quick Access

To view the icon generator:
```bash
# From /app directory
firefox generate-icons.html
# or
chromium generate-icons.html
# or just open the file in any browser
```

## ✨ Features

- High-quality gradient design
- Professional finance theme
- Scalable to any size
- Optimized for Electron apps
- Modern UI with animations
- Easy one-click downloads
