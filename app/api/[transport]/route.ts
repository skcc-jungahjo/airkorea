import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

// 에어코리아 대기오염정보 서비스 (공공데이터포털)
const BASE = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc";

// ──────────────────────────────────────────────────────────────
// 1) 공공 API 호출 공통 함수
//    serviceKey는 "디코딩된 키"를 받아 URLSearchParams가 한 번만 인코딩하도록 한다.
// ──────────────────────────────────────────────────────────────
async function callApi(
  serviceKey: string,
  operation: string,
  params: Record<string, string | number>
) {
  const qs = new URLSearchParams({
    serviceKey,
    returnType: "json",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  const res = await fetch(`${BASE}/${operation}?${qs}`);
  const text = await res.text();

  // 키 오류 등은 JSON이 아니라 XML/텍스트로 오는 경우가 많다
  try {
    const json = JSON.parse(text);
    const header = json?.response?.header;
    if (header && header.resultCode !== "00") {
      throw new Error(`API 오류 ${header.resultCode}: ${header.resultMsg}`);
    }
    return json?.response?.body?.items ?? [];
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error(`API 응답 파싱 실패: ${text.slice(0, 300)}`);
    throw e;
  }
}

// ──────────────────────────────────────────────────────────────
// 2) 요청마다 키를 주입해 MCP 서버를 구성
// ──────────────────────────────────────────────────────────────
function buildHandler(serviceKey: string) {
  return createMcpHandler(
    (server) => {
      server.registerTool(
        "get_sido_air_quality",
        {
          title: "시도별 실시간 대기오염 조회",
          description:
            "시도명(서울, 부산, 경기 등)을 받아 해당 지역 측정소별 실시간 미세먼지(PM10), 초미세먼지(PM2.5), 오존 등 대기오염 수치를 조회한다.",
          inputSchema: {
            sidoName: z
              .enum([
                "전국", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "경기",
                "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주", "세종",
              ])
              .describe("시도명"),
            numOfRows: z.number().int().min(1).max(100).default(20).describe("조회 건수"),
          },
        },
        async ({ sidoName, numOfRows }) => {
          const items = await callApi(serviceKey, "getCtprvnRltmMesureDnsty", {
            sidoName,
            numOfRows,
            pageNo: 1,
            ver: "1.0",
          });

          // 토큰 절약을 위해 필요한 필드만 추려서 반환
          const rows = (items as any[]).map((i) => ({
            측정소: i.stationName,
            측정시각: i.dataTime,
            PM10: i.pm10Value,
            PM25: i.pm25Value,
            오존: i.o3Value,
            통합대기지수: i.khaiValue,
          }));

          return {
            content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
          };
        }
      );

      // 도구를 더 추가하려면 같은 패턴으로 server.registerTool(...)을 반복
    },
    {},
    {
      basePath: "/api",     // app/api/[transport] → 엔드포인트는 /api/mcp
      maxDuration: 60,
      disableSse: true,     // Claude는 Streamable HTTP를 사용하므로 SSE(Redis 필요) 비활성화
    }
  );
}

// ──────────────────────────────────────────────────────────────
// 3) 진입점: URL 쿼리(?serviceKey=...)에서 키를 꺼낸다
// ──────────────────────────────────────────────────────────────
async function handler(req: Request) {
  const url = new URL(req.url);
  // searchParams.get()은 %2B 같은 인코딩을 자동으로 풀어준다
  const serviceKey = url.searchParams.get("serviceKey") ?? process.env.DATA_GO_KR_KEY;

  if (!serviceKey) {
    return new Response(
      JSON.stringify({ error: "serviceKey가 없습니다. URL에 ?serviceKey=인코딩키 를 붙여주세요." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  return buildHandler(serviceKey)(req);
}

export { handler as GET, handler as POST, handler as DELETE };
