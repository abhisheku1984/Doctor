import { NextRequest, NextResponse } from "next/server";
import { readSession } from "./auth";

/** Server-side authorization gate for every admin API operation. */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const session = await readSession(req);
  if (!session?.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
