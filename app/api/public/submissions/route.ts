import { NextResponse } from "next/server";

import { listPublicSubmissions } from "../../../../lib/submissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const submissions = await listPublicSubmissions();
    return NextResponse.json({
      submissions: submissions.map((submission) => ({
        area: submission.area_name,
        createdAt: submission.created_at,
        defect: submission.suspected_defect,
        id: submission.id,
        imageUrl: `/api/public/images/${submission.id}`,
        latitude: submission.latitude,
        longitude: submission.longitude,
        source: submission.source,
        status: submission.workflow_status,
      })),
    });
  } catch (error) {
    console.error("Public mobile submissions failed", error);
    return NextResponse.json({ error: "Reports are temporarily unavailable." }, { status: 500 });
  }
}
