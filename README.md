# J4M Attendance Scanner — Netlify version

## Architecture

Browser scanner -> Netlify Function -> Google Apps Script -> Google Sheet

The browser never needs to know the Google Apps Script URL or the backend secret.

## Folder layout

- public/ : website files
- netlify/functions/attendance.mjs : server-side API
- apps-script/Code.gs : paste this into the Google Apps Script project
- netlify.toml : Netlify configuration

## Google Sheet

Learners sheet:
Learner ID | Name | Session

Attendance sheet:
Learner ID | Name | Session | Date | Check In | Check Out | Total Time

## Apps Script setup

1. Paste apps-script/Code.gs into your Apps Script project.
2. In Apps Script Project Settings, add a Script Property:
   BACKEND_SECRET = a long random value that you create.
3. Deploy a NEW VERSION of the script as a Web App:
   Execute as: Me
   Who has access: Anyone
4. Copy the /exec URL.

## Netlify setup

Create a Netlify site from this repository.

Add these environment variables in Netlify:

- APPS_SCRIPT_URL = your Google Apps Script /exec URL
- BACKEND_SECRET = exactly the same secret used in Apps Script

Then trigger a new deployment.

## Important

The Netlify function protects the Apps Script endpoint with a backend secret and validates learner IDs.
The function endpoint itself is still publicly reachable, so for a higher-security production system
you may later add staff authentication and/or stronger abuse controls.
