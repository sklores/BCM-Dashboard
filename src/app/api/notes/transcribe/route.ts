import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Transcription is not configured. Set OPENAI_API_KEY in the deployment environment to enable Whisper transcription.",
      },
      { status: 503 },
    );
  }

  let inbound: FormData;
  try {
    inbound = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a 'file' field." },
      { status: 400 },
    );
  }

  const file = inbound.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'file' upload." },
      { status: 400 },
    );
  }

  const out = new FormData();
  out.append("file", file, file.name);
  out.append("model", "whisper-1");
  out.append("response_format", "text");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: out,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Whisper API failed: ${res.status} ${res.statusText} ${detail}` },
      { status: res.status },
    );
  }

  const text = await res.text();
  return NextResponse.json({ text });
}
