# Toastmaster Timer - Zoom App Test Plan

## Overview

**App Name:** Toastmaster Timer  
**App Type:** Zoom Apps (Sidebar)  
**Version:** 1.0.0  
**Production URL:** https://www.timer.simple-tech.app

Toastmaster Timer is a Zoom Apps application that automates the Timer role in Toastmasters meetings. It controls video filter overlays based on speech timing (green → yellow → red) and provides comprehensive tracking and reporting features.

---

## Test Credentials

**No test credentials required.** This app does not require user authentication or login. It operates entirely within the Zoom client and stores all data locally in the browser. Any Zoom user can install and use the app immediately without creating an account.

---

## Zoom API Scopes Requested

This app uses the **Zoom Apps SDK** with the following capabilities:

| Capability | Purpose | How It's Used |
|------------|---------|---------------|
| `videoFilter` | Apply/remove video filter overlays | Changes the user's video overlay to colored backgrounds (green, yellow, red) based on speech timing to signal time status to the audience |
| `shareApp` | Basic Zoom Apps capability | Required for the app to run as a sidebar in Zoom meetings |

### SDK Functions Used

| Function | Scope | Purpose |
|----------|-------|---------|
| `zoomSdk.config()` | Initialization | Initializes the SDK and requests capabilities |
| `zoomSdk.setVideoFilter()` | `videoFilter` | Applies colored overlay images to the user's video |
| `zoomSdk.deleteVideoFilter()` | `videoFilter` | Removes the video filter overlay |
| `zoomSdk.getVideoState()` | Built-in | Checks if user's video is currently on or off |
| `zoomSdk.setVideoState()` | Built-in | Turns user's video on (with user's permission) |

---

## Pre-requisites for Testing

1. **Zoom Desktop Client** (Windows or macOS) with version 5.9.0 or later
2. **A Zoom meeting** (can be a personal meeting room)
3. **Camera/webcam** connected and enabled
4. **Video turned ON** in the Zoom meeting

---

## Step-by-Step Test Plan

### Step 1: Install the App

1. Open the Zoom Marketplace and find "Toastmaster Timer"
2. Click "Add" to add the app to your Zoom account
3. Review and accept the permissions requested:
   - Video Filter capability (to change your video overlay)
4. Complete the installation

### Step 2: Launch the App in a Meeting

1. Start or join a Zoom meeting
2. Click the "Apps" button in the Zoom toolbar
3. Find and click "Toastmaster Timer" from your installed apps
4. The app will open as a sidebar panel on the right side of your Zoom window
5. **Expected Result:** The app loads with three tabs: "Live", "Agenda", and "Report"

### Step 3: Test SDK Initialization (Debug Panel)

1. In the Live tab, locate the "Debug Panel" section (collapsed by default)
2. Click to expand the Debug Panel
3. **Expected Result:** 
   - "Initialized: Yes"
   - "Available: Yes"
   - "setVideoFilter: Yes"
   - "deleteVideoFilter: Yes"
   - Debug logs show "Zoom SDK initialized successfully"

### Step 4: Test Video State Detection

1. With your video ON, check the Debug Panel
2. **Expected Result:** "Video State: ON" displayed
3. Turn off your video in Zoom
4. **Expected Result:** 
   - "Video State: OFF" displayed
   - A yellow warning banner appears: "Your video is turned off. Please turn on your video to use the Timer Card."
   - The START button becomes disabled (grayed out)
5. Click "Turn Video On" button in the warning banner
6. **Expected Result:** Your video turns on and the warning disappears

### Step 5: Test Timer - Basic Flow

1. Ensure your video is ON
2. In the Live tab, enter a speaker name (optional): "Test Speaker"
3. Select a role from the dropdown: "Standard Speech" (5-6-7 minutes)
4. **Expected Result:** Timing rules displayed: "Green: 5 minutes, Yellow: 6 minutes, Red: 7 minutes"
5. Click "START" button
6. **Expected Result:**
   - Timer starts counting from 00:00
   - A grey/white overlay is applied to your video (visible in Zoom)
   - Debug logs show "Applying video filter overlay"

### Step 6: Test Video Filter Color Changes

> **Note:** For faster testing, use "Table Topics Speech" role (1-1.5-2 minutes) or "Custom" role with shorter times.

**Testing with Table Topics Speech (1-1.5-2 minutes):**

1. Select "Table Topics Speech" from the role dropdown
2. Click START and observe the timer and your video overlay:

| Time | Expected Overlay Color | Status |
|------|----------------------|--------|
| 0:00 - 0:59 | Grey/White | Before green time |
| 1:00 - 1:29 | Green | Within time limit |
| 1:30 - 1:59 | Yellow | Warning period |
| 2:00+ | Red | Over time |

3. **Expected Result:** Your video overlay changes automatically at each threshold
4. The debug logs should show each color change

**Alternative: Testing with Custom Timing Rules:**

1. Select "Custom" from the role dropdown
2. Set timing rules to short intervals for quick testing:
   - Green: 5 seconds
   - Yellow: 10 seconds
   - Red: 15 seconds
3. Click START
4. **Expected Result:** Overlay colors change at 5s (green), 10s (yellow), and 15s (red)

### Step 7: Test Reveal Face Toggle

1. While the timer is running, click the "Eye" icon in the top-right corner
2. **Expected Result:**
   - The video filter overlay is removed
   - Your face is revealed in the video
   - The icon changes to "Eye with slash"
3. Click the icon again
4. **Expected Result:**
   - The video filter overlay is reapplied
   - The correct color overlay (based on current time) is shown

### Step 8: Test Timer Controls

1. While timer is running, click "STOP"
2. **Expected Result:** Timer pauses, displays "CONTINUE" and "FINISH" buttons
3. Click "CONTINUE"
4. **Expected Result:** Timer resumes from where it stopped
5. Click "STOP" again, then click "FINISH"
6. **Expected Result:**
   - Timer stops
   - Video filter overlay is removed
   - Speech is recorded in Reports tab
   - Timer resets to 00:00

### Step 9: Test Report Tab

1. After finishing a speech (Step 8), click the "Report" tab
2. **Expected Result:** A table showing:
   - Speaker name
   - Role
   - Duration (time spent)
   - Status color (green/yellow/red)
   - Comments column
3. Click "Copy Report to Clipboard"
4. **Expected Result:** 
   - Report data copied in tab-separated format
   - "Copied to clipboard" toast notification appears
5. Click "Clear" to clear all reports
6. **Expected Result:** Confirmation dialog appears, reports cleared after confirmation

### Step 10: Test Agenda Tab - Add Speakers

1. Click the "Agenda" tab
2. Click "Add Item" button
3. **Expected Result:** Modal opens with speaker name and role fields
4. Enter:
   - Speaker Name: "John Doe"
   - Role: "Ice Breaker"
5. Click "Add"
6. **Expected Result:** Speaker appears in the agenda list

### Step 11: Test Agenda Tab - Import Speakers

**Simple Format Import:**

1. In Agenda tab, click "Import Text"
2. Select the "Simple Format" tab
3. Paste the following text:
   ```
   Alice Smith (Standard Speech)
   Bob Johnson (Table Topics)
   Carol Williams (Speech Evaluation)
   ```
4. Click "Import"
5. **Expected Result:** 3 speakers added to the agenda with correct roles

**EasySpeak Format Import:**

1. Click "Import Text" again
2. Select "EasySpeak Format" tab
3. Paste meeting details copied from EasySpeak website
4. Click "Import"
5. **Expected Result:** Speakers parsed with roles automatically detected

### Step 12: Test Agenda - Load Speaker to Live Tab

1. In Agenda tab, click on any speaker in the list
2. **Expected Result:**
   - App switches to Live tab
   - Speaker name and role are pre-filled
   - Timer ready to start

### Step 13: Test Agenda - Drag and Drop Reorder

1. In Agenda tab with multiple speakers
2. Drag a speaker using the grip handle on the left
3. Drop to a new position
4. **Expected Result:** Speakers reorder successfully

### Step 14: Test Edit Timing Rules

1. In Live tab, click "Edit Rules" link next to the role dropdown
2. **Expected Result:** Modal opens showing all role types with their timing rules
3. Modify a timing rule (e.g., change Standard Speech green from 300 to 240 seconds)
4. Click "Save"
5. **Expected Result:** 
   - Rules updated
   - New timing displayed when that role is selected

### Step 15: Test Video Filter Removal on App Close

1. Start the timer with an overlay visible
2. Close the app (click X or switch to another app)
3. **Expected Result:** The video filter overlay should be removed when the app is closed

---

## Summary of Functionality Exposed to End Users

| Feature | Description | Zoom API Used |
|---------|-------------|---------------|
| Timer Display | Real-time countdown/countup timer | None (client-side) |
| Video Overlay | Colored overlays (grey/green/yellow/red) based on timing | `setVideoFilter`, `deleteVideoFilter` |
| Reveal Face | Temporarily remove overlay to show face | `deleteVideoFilter` |
| Video State Check | Detect if video is on/off | `getVideoState` |
| Turn Video On | Turn on user's video | `setVideoState` |
| Speaker Management | Add, edit, delete, reorder speakers | None (local storage) |
| Agenda Import | Import from EasySpeak or simple text | None (local storage) |
| Timing Reports | Track and export speech timing data | None (local storage) |
| Custom Timing Rules | Configure timing thresholds per role | None (local storage) |

---

## Data Storage

All data is stored **locally in the browser** using localStorage:
- Speaker agenda
- Completed speech reports
- Custom timing rules
- User preferences (debug panel state)

**No data is stored on external servers or Zoom Cloud.**

---

## Support & Contact

- **Support URL:** https://www.timer.simple-tech.app/support
- **Privacy Policy:** https://www.timer.simple-tech.app/privacy
- **Developer Email:** shuhao.zhang@simple-tech.app
