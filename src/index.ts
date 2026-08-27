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
  { name: "national-library-mcp", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_books",
        description: "국립중앙도서관에서 키워드, 정렬방식, 페이징을 지정하여 도서를 검색합니다.",
        inputSchema: {
          type: "object",
          properties: {
            kwd: { type: "string", description: "검색할 키워드 (예: 인공지능)" },
            sort: { 
              type: "string", 
              description: "정렬 방식: pub_date(발행년도순), sim(관련도순), title(제목순)",
              enum: ["pub_date", "sim", "title"] 
            },
            pageNum: { type: "number", description: "페이지 번호 (기본값: 1)" },
            pageSize: { type: "number", description: "한번에 가져올 건수 (기본값: 10, 최대: 100)" }
          },
          required: ["kwd"],
        },
      },
      {
        name: "search_by_isbn",
        description: "국립중앙도서관에서 ISBN 번호로 도서를 정확히 검색합니다.",
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
    const { kwd, sort = "pub_date", pageNum = 1, pageSize = 10 } = request.params.arguments as {
      kwd: string;
      sort?: string;
      pageNum?: number;
      pageSize?: number;
    };

    const res = await axios.get("https://www.nl.go.kr/NL/search/openApi/search.do", {
      params: {
        key: NL_API_KEY,
        kwd,
        sort,
        pageNum,
        pageSize,
        apiType: "json",
      },
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

app.get("/", (req: Request, res: Response) => {
  res.send("MCP Server v1.1.0 is running!");
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