import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Counselor accounts are invite-only. Contact the Mentalks administrator for access." },
    { status: 403 }
  );
}
