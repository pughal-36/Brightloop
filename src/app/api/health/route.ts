import { NextResponse } from "next/server";
import { checkHealth } from "@/server/modules/health/service";
import { toErrorResponse } from "@/server/errors";

export async function GET() {
  try {
    const data = await checkHealth();
    return NextResponse.json(data);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

