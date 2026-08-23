# Demo Guide for Hackathon Judges

This script provides a smooth, impressive flow for demonstrating the CleanAir Sentinel capabilities to judges.

## 1. The Citizen Map View
- **Action**: Open the landing page.
- **Talking Point**: "This is the real-time spatial map view for citizens. It highlights live air quality and allows anyone to see pollution incidents around them."
- **Visuals**: Show the sleek dark-mode Leaflet map, point out the modern glassmorphic UI panels.

## 2. Submitting a Report
- **Action**: Click "Report Incident". Fill out a mock incident (e.g., "Heavy factory smoke coming from XYZ").
- **Action**: Upload a test photo (e.g., an image of a smokestack). Submit.
- **Talking Point**: "Citizens can instantly report anomalies. When we hit submit, it doesn't just save to a database. It gets sent to our AI pipeline."

## 3. Evidence Verification & CPCB Diagnostics
- **Action**: Open the "My Reports" tab.
- **Talking Point**: "Notice the status and AI priority score. The backend used Google Gemini to instantly parse the image and text, classifying the severity."
- **Action**: Click the report to show details.
- **Talking Point**: "Here, you see the API automatically pulled the nearest Central Pollution Control Board (CPCB) data to cross-reference the claim. If enabled, it also queries the Sentinel Hub Satellite APIs to look for thermal anomalies or visual smog plumes from recent orbital passes."

## 4. The Officer Dashboard
- **Action**: Switch to the "Officer Dashboard" tab in the UI.
- **Talking Point**: "For regulatory authorities, this dashboard aggregates everything. Instead of dealing with thousands of raw reports, the AI groups them into actionable 'Situations'."
- **Visuals**: Highlight the Risk Score bar and the Status Pills (Submitted, In Progress). Show how officers can rapidly triage high-priority verified incidents.

## 5. Mobile Responsiveness (Crucial for Demo)
- **Action**: Open browser DevTools (F12) and toggle device emulation (e.g., iPhone 12 Pro).
- **Talking Point**: "The entire application is completely responsive. Environmental reporting happens on the go, so the glass panels slide down into bottom-sheets naturally."
- **Visuals**: Scroll the list, tap the map, show the sticky navigation.
