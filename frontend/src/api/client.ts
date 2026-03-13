import type {
  SimulateRequest,
  SimulateResponse,
  GetSimulationResponse,
  SimulationRun,
  ListSimulationsResponse,
  SimulationRunSummary,
  GraphSnapshot,
  GraphRetrieveRequest,
  GraphRetrieveResponse,
  ChatRequest,
  ChatResponse,
} from "@socioatlas/shared";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `HTTP ${res.status}`
    );
  }

  return res.json() as Promise<T>;
}

export async function* streamSimulation(event: string, sampleSize?: number) {
  const body: SimulateRequest = sampleSize
    ? { event, sample_size: sampleSize }
    : { event };
  const res = await fetch(`${BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message ?? `HTTP ${res.status}`);
  }

  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
    } else {
      buffer += decoder.decode(value, { stream: true });
    }

    // Process full SSE events separated by blank lines.
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const evt of events) {
      const dataLines = evt
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s?/, ""));

      const payloadStr = dataLines.join("\n").trim();
      if (!payloadStr) continue;

      try {
        const payload = JSON.parse(payloadStr);
        yield payload;
      } catch (err) {
        console.error("Failed to parse SSE event", err, payloadStr);
      }
    }

    if (done) break;
  }
}

export async function getSimulation(runId: string): Promise<SimulationRun> {
  const data = await request<GetSimulationResponse>(`/simulate/${runId}`);
  return data.run;
}

export async function listSimulations(limit = 25): Promise<SimulationRunSummary[]> {
  const data = await request<ListSimulationsResponse>(`/simulate?limit=${limit}`);
  return data.runs;
}

export async function getGraphSnapshot(runId: string): Promise<GraphSnapshot> {
  return request<GraphSnapshot>(`/graph/${runId}`);
}

export async function retrieveGraphContext(
  runId: string,
  body: GraphRetrieveRequest,
): Promise<GraphRetrieveResponse> {
  return request<GraphRetrieveResponse>(`/graph/${runId}/retrieve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function chatWithGraph(
  runId: string,
  body: ChatRequest,
): Promise<ChatResponse> {
  return request<ChatResponse>(`/chat/${runId}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
