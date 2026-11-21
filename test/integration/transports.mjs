import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const cli =
  process.env.MCP_TEST_CLI ??
  fileURLToPath(new URL("../../build/lib/adapters/cli.js", import.meta.url));
const env = { ...process.env, NODE_ENV: "production", MCP_TRANSPORT: "stdio" };
const timeout = 5_000;

const expectedTools = [
  "tse_apuracao_cargo",
  "tse_candidatos_busca",
  "tse_comparecimento_abstencao",
  "tse_dados_abertos_datasets",
  "tse_eleicoes_catalogo",
  "tse_municipios_zonas",
  "tse_partidos_federacoes",
];

async function verifyCatalog(transport, label, getStderrText) {
  const client = new Client({ name: "mcp-tse-ci", version: "0.1.0" });
  const transportErrors = [];
  client.onerror = (error) => transportErrors.push(error.message);

  try {
    await client.connect(transport, { timeout });
    const server = client.getServerVersion();
    assert.equal(server?.name, "mcp-tse");
    assert.equal(server?.version, "0.1.0");
    await client.ping({ timeout });

    const { tools } = await client.listTools({}, { timeout });
    const names = tools.map(({ name }) => name).sort();
    assert.deepEqual(names, expectedTools, `Unexpected MCP catalogue on ${label}`);
    console.log(`PASS ${label}: initialize, ping, tools/list (${names.length} tools)`);

    const { resources } = await client.listResources({}, { timeout });
    assert.deepEqual(resources, [], `Expected empty resources list on ${label}`);
    await assert.rejects(
      client.readResource({ uri: "ui://tse/unknown" }, { timeout }),
      /Unknown resource URI/,
    );
    console.log(`PASS ${label}: resources/list empty & unknown resources/read fails closed`);

    if (label === "stdio") {
      // Trigger 101 offline Zod validation failures on tse_municipios_zonas ({})
      // without touching any external TSE host, crossing the 100-request metrics log threshold.
      for (let call = 1; call <= 101; call++) {
        const result = await client.callTool(
          { name: "tse_municipios_zonas", arguments: {} },
          undefined,
          { timeout },
        );
        assert.equal(result.isError, true, `Expected offline validation isError at call ${call}`);
      }
      assert.deepEqual(transportErrors, [], "stdio must carry only valid MCP protocol messages");
      if (getStderrText) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const stderrOutput = getStderrText();
        assert.match(
          stderrOutput,
          /\[metrics\] requests=100/,
          `Expected [metrics] requests=100 on stderr, got: ${stderrOutput}`,
        );
      }
      console.log("PASS stdio: 101 offline tool calls, zero protocol errors, [metrics] requests=100 logged");
    }
  } finally {
    await client.close();
  }
}

async function runStdioTest() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli],
    env,
    stderr: "pipe",
  });
  let stderrText = "";
  if (transport.stderr) {
    transport.stderr.setEncoding("utf8");
    transport.stderr.on("data", (chunk) => {
      stderrText += chunk;
    });
  }
  await verifyCatalog(transport, "stdio", () => stderrText);
}

async function availablePort() {
  const socket = createServer().listen(0, "127.0.0.1");
  await once(socket, "listening");
  const { port } = socket.address();
  await new Promise((resolve, reject) =>
    socket.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function runHttpSseTest() {
  const port = await availablePort();
  const server = spawn(process.execPath, [cli], {
    env: { ...env, MCP_TRANSPORT: "http", MCP_HTTP_PORT: String(port) },
    stdio: ["ignore", "ignore", "pipe"],
  });
  const exited = once(server, "close");
  const watchdog = setTimeout(() => server.kill("SIGKILL"), 15_000);
  const lines = createInterface({ input: server.stderr });

  try {
    for await (const line of lines) {
      if (line.includes(`started on HTTP+SSE transport (port ${port})`)) {
        await verifyCatalog(
          new SSEClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)),
          "HTTP/SSE",
        );
        return;
      }
    }
    throw new Error("CLI exited before announcing the HTTP/SSE endpoint");
  } finally {
    lines.close();
    server.kill();
    try {
      await exited;
    } finally {
      clearTimeout(watchdog);
    }
  }
}

await runStdioTest();
await runHttpSseTest();
console.log("PASS: both transports expose the expected 7-tool mcp-tse catalog");
