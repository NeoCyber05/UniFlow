import { generateUploadButton } from "@uploadthing/react";

import type { OurFileRouter } from "@/server/routes/uploadthing/core";

export const UploadButton = generateUploadButton<OurFileRouter>();
