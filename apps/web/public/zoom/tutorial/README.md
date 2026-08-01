# Homepage tutorial screenshots

Drop JPEGs here with these exact names. The homepage picks them up with no code
change. Any file that is missing shows a dashed placeholder box instead of a
broken image, so partial uploads are fine.

Capture everything inside the Zoom app so the screenshots match what people see.

Capture at full size, then downscale before committing. These sit on the landing
page, so full-resolution PNGs are far too heavy:

```bash
sips -Z 1440 -s format jpeg -s formatOptions 88 raw.png --out 03-mode-menu.jpg
```

## Steps (16:9 works best, 1440 wide after the resize above)

| File | What it should show |
| --- | --- |
| `01-open-in-meeting.jpg` | A Zoom meeting with the Apps panel open and the timer inside it |
| `02-agenda-import.jpg` | Agenda tab with the import box, plus a filled agenda |
| `03-mode-menu.jpg` | Live tab with the display mode menu open, all three modes visible. The button that opens it names the mode you are in, so catch that too |
| `04-speaker-name.jpg` | Speaker name field with the suggestion list open: agenda names above, people in the meeting below. Type a part-name so both sections have something in them |
| `05-live-controls.jpg` | Live tab mid speech, timer running with a color signal up |
| `06-report.jpg` | Report tab with a few finished speeches and the copy button |

## Display modes

| File | What it should show |
| --- | --- |
| `mode-stage.jpg` | Timer Stage open in color, share and pop out buttons visible |
| `mode-card.jpg` | Zoom video tile replaced by the color card |
| `mode-camera.jpg` | Timer on camera, with the color behind the person |

## Tips

| File | What it should show |
| --- | --- |
| `tip-hide-clock.jpg` | Timer Stage with the clock hidden, cropped close on the eye icon |
| `tip-reveal-face.jpg` | Mode menu with the "Show my own background" checkbox |
| `tip-clear-video.jpg` | Live tab cropped close on the "Clear video" button |

Notes:

- No hovering needed any more. "Clear video" and the mode button carry their
  labels on the button itself, so shoot them as they sit. Earlier versions of
  this file asked for tooltips in frame; those tooltips are gone.
- Crop out anything personal: real names, real meeting IDs, other participants.
  `04-speaker-name.jpg` is the one to watch — the suggestion list shows real
  people from the meeting, so use a test meeting or invented names.
- Keep the three mode shots at the same size so the row lines up.
- The step shots sit next to text at about half the page width, so make sure
  any label you want people to read is still legible when scaled down.
- The tip shots are close crops, so the one control being described is readable
  at that size.
