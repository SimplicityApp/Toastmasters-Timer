# Virtual Background Images

Place your virtual background images here for the Toastmaster Timer app.

## Required Images

- **green.png** - Green phase background (recommended: 1920x1080 PNG)
- **yellow.png** - Yellow phase background (recommended: 1920x1080 PNG)  
- **red.png** - Red phase background (recommended: 1920x1080 PNG)

## Image Specifications

- **Format**: PNG (with transparency if desired)
- **Recommended Size**: 1920x1080 pixels (16:9 aspect ratio)
- **File Size**: Keep under 5MB per image for best performance

## Creating Background Images

You can create simple colored backgrounds using any image editor:

1. **Using ImageMagick** (command line):
   ```bash
   # Green background
   convert -size 1920x1080 xc:#10b981 green.png
   
   # Yellow background  
   convert -size 1920x1080 xc:#f59e0b yellow.png
   
   # Red background
   convert -size 1920x1080 xc:#ef4444 red.png
   ```

2. **Using online tools**:
   - Use any image editor to create 1920x1080 images
   - Fill with solid colors matching the timer colors:
     - Green: #10b981
     - Yellow: #f59e0b
     - Red: #ef4444

3. **Using design software**:
   - Create 1920x1080 canvas
   - Fill with appropriate color
   - Optionally add text like "GREEN", "YELLOW", "RED"
   - Export as PNG

## Deployment

These images will be automatically served by Vercel at:
- `https://your-app.vercel.app/backgrounds/green.png`
- `https://your-app.vercel.app/backgrounds/yellow.png`
- `https://your-app.vercel.app/backgrounds/red.png`

The app will automatically use these URLs - no code changes needed!
