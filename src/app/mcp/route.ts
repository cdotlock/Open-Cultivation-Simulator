import { createMobaiMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, mcp-session-id, Last-Event-ID, mcp-protocol-version",
    "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
  };
}

async function handleMcpRequest(request: Request) {
  const { server, transport } = await createMobaiMcpServer();

  try {
    const response = await transport.handleRequest(request);
    const headers = new Headers(response.headers);

    Object.entries(corsHeaders()).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } finally {
    await transport.close();
    await server.close();
  }
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
