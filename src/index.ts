import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import cors from "cors";
import express, { Request, Response } from "express";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const NL_API_KEY = process.env.NL_API_KEY || "";

const mcpServer = new Server(
  { name: "national-library-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_books",
        description: "국립중앙도서관에서 키워드로 책을 검색합니다.",
        inputSchema: {
          type: "object",
          properties: { kwd: { type: "string", description: "검색할 키워드" } },
          required: ["kwd"],
        },
      },
      {
        name: "search_by_isbn",
        description: "국립중앙도서관에서 ISBN 번호로 도서를 검색합니다.",
        inputSchema: {
          type: "object",
          properties: { isbn: { type: "string", description: "ISBN 번호" } },
          required: ["isbn"],
        },
      },
    ],
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "search_books") {
    const { kwd } = request.params.arguments as { kwd: string };
    const res = await axios.get("https://www.nl.go.kr/NL/search/openApi/search.do", {
      params: { key: NL_API_KEY, kwd, apiType: "json" },
    });
    return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
  }

  if (request.params.name === "search_by_isbn") {
    const { isbn } = request.params.arguments as { isbn: string };
    const res = await axios.get("https://www.nl.go.kr/NL/search/openApi/search.do", {
      params: { key: NL_API_KEY, detailSearch: "true", isbnOp: "isbn", isbnCode: isbn, apiType: "json" },
    });
    return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
  }

  throw new Error("Tool을 찾을 수 없습니다.");
});

// 메인 주소 접속 확인용
app.get("/", (req: Request, res: Response) => {
  res.send("MCP Server is running!");
});

let transport: SSEServerTransport | null = null;
app.get("/sse", async (req: Request, res: Response) => {
  transport = new SSEServerTransport("/messages", res);
  await mcpServer.connect(transport);
});
app.post("/messages", async (req: Request, res: Response) => {
  if (transport) await transport.handlePostMessage(req, res);
  else res.status(400).send("SSE 연결 오류");
});

app.listen(PORT, () => console.log(`서버 실행 중: ${PORT}`));