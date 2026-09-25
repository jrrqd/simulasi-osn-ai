import {
  featureLabel,
  type AccessFeatureId,
} from "@/lib/access/catalog";
import { getAccessMatrix, hasFeature } from "@/lib/access/matrix";
import { loadUserAccess } from "@/lib/user/load-user-access";

/** Returns a 403 Response when the user lacks a facility; otherwise null. */
export async function assertApiFeature(
  userId: string,
  feature: AccessFeatureId,
): Promise<Response | null> {
  const access = await loadUserAccess(userId);
  if (!access) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const matrix = await getAccessMatrix();
  if (!hasFeature(access, feature, matrix)) {
    return Response.json(
      {
        error: `${featureLabel(feature)} tidak termasuk paket akun kamu.`,
        feature,
      },
      { status: 403 },
    );
  }
  return null;
}
