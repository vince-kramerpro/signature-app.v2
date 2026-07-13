# Kramer Pro Signature App V2

Self-service email signature publishing for Kramer Pro employees.

## Features

- Google sign-in restricted to `@kramer.pro`
- Employee signature form and branded preview
- Published signature image storage in Firebase Storage
- Per-user publication records in Firestore
- Copy-to-email-client workflow
- Opaque branded rendering designed to resist email-client dark-mode recoloring
- Clickable email, phone, and website columns using ordinary linked images

## Firebase services

This repository is configured for the Firebase project `kramer-signatures` and uses:

- Firebase Hosting
- Firebase Authentication with Google sign-in
- Cloud Firestore
- Firebase Storage

Firestore and Storage access are governed by the rules committed in this repository.

## Deploy

Authenticate with a Google account that has access to the Firebase project, then run:

```powershell
npx.cmd --yes firebase-tools@latest login
npx.cmd --yes firebase-tools@latest deploy --only "hosting,firestore:rules,storage" --project kramer-signatures
```

Firebase Hosting serves the app at `https://kramer-signatures.web.app` after deployment.

## Release verification

Before sharing the app with the team, verify the complete copy, save, and send flow in Gmail and confirm the received signature in Outlook classic, new Outlook, Gmail desktop/mobile, and Apple Mail in both light and dark modes.
