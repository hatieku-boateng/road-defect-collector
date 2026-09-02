import { NextResponse } from "next/server";

import { listPublicProgressImages, listPublicSubmissions } from "../../../../lib/submissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [submissions, progressImages] = await Promise.all([
      listPublicSubmissions(),
      listPublicProgressImages(),
    ]);
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
        progressImages: progressImages
          .filter((image) => image.submission_id === submission.id)
          .map((image) => ({
            capturedAt: image.captured_at ?? image.created_at,
            id: image.id,
            imageUrl: `/api/public/progress-images/${image.id}`,
            note: image.note,
            stage: image.stage,
          })),
      })),
    });
  } catch (error) {
    console.error("Public mobile submissions failed", error);
    return NextResponse.json({ error: "Reports are temporarily unavailable." }, { status: 500 });
  }
}
