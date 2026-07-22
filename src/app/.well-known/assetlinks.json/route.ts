import {
  androidAssetLinksPayload,
  associationJsonResponse,
  unavailableAssociationResponse,
} from "@/lib/app-link-association";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = androidAssetLinksPayload();

  return payload
    ? associationJsonResponse(payload)
    : unavailableAssociationResponse();
}
