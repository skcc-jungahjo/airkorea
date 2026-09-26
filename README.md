# airkorea-mcp

에어코리아(한국환경공단) 대기오염정보 공공데이터 API를 MCP(Model Context Protocol) 도구로 제공하는 Next.js 서버입니다.

## 기능

- `get_sido_air_quality`: 시도명(서울, 부산, 경기 등)으로 해당 지역 측정소별 실시간 미세먼지(PM10), 초미세먼지(PM2.5), 오존, 통합대기지수(CAI)를 조회합니다.

## 요구 사항

- Node.js 18 이상
- [공공데이터포털](https://www.data.go.kr/) 에어코리아 대기오염정보 서비스 인증키(디코딩 키)

## 설치 및 실행

```bash
npm install
npm run dev
```

MCP 엔드포인트는 `app/api/[transport]/route.ts`의 `basePath` 설정에 따라 `/api/mcp`로 노출됩니다.

## 인증키 전달 방식

서비스 키는 요청 시점에 주입합니다. 다음 중 하나를 사용하세요.

- URL 쿼리: `.../api/mcp?serviceKey=<디코딩된 키>`
- 환경 변수: `DATA_GO_KR_KEY`

키가 없으면 `401` 응답과 함께 안내 메시지를 반환합니다.

## MCP 클라이언트 연결 예시 (Claude 등)

```json
{
  "mcpServers": {
    "airkorea": {
      "url": "https://<배포된 도메인>/api/mcp?serviceKey=<디코딩된 키>"
    }
  }
}
```

## 구조

```
app/
  api/[transport]/route.ts   # MCP 서버 및 도구 정의
  layout.tsx
  page.tsx
```

## 참고

- Claude 등 MCP 클라이언트는 Streamable HTTP를 사용하므로 SSE(Server-Sent Events)는 비활성화되어 있습니다.
- 공공 API 응답은 토큰 절약을 위해 필요한 필드만 추려서 반환합니다.
