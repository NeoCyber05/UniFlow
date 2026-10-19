/** Store page of the UniFlow Capture extension; null until it is published. */
export const CAPTURE_EXTENSION_URL = process.env.NEXT_PUBLIC_CAPTURE_EXTENSION_URL || null;

/** Chat sites the extension runs on (web versions only); keep in sync with extensions/uniflow-capture/manifest.json. */
export const CAPTURE_SITES = ["Slack", "Microsoft Teams", "Messenger", "Facebook", "Zalo Web"] as const;
