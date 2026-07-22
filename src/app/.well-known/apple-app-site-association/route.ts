import {
  appleAppSiteAssociationPayload,
  associationJsonResponse,
  unavailableAssociationResponse,
} from "@/lib/app-link-association";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = appleAppSiteAssociationPayload();

  return payload
    ? associationJsonResponse(payload, "application/json")
    : unavailableAssociationResponse();
}
