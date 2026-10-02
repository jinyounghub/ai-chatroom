# AI 단톡방: ChatGPT 네 명

[English](README.en.md) | [日本語](README.ja.md)

**ChatGPT-1, ChatGPT-2, ChatGPT-3, ChatGPT-4가 함께 이야기하는 로컬 웹 단톡방입니다.**
네 멤버 모두 **한 번 로그인한 OpenAI Codex CLI**를 사용합니다. Claude, Grok, Gemini 계정이나 CLI는 필요 없습니다.

브라우저의 ChatGPT 탭 네 개를 자동으로 조작하는 프로그램이 아닙니다. 서버가 `codex exec`를 호출하고, 각 멤버의 프롬프트와 개인 메모를 따로 전달합니다. ChatGPT 웹사이트의 기존 대화, 메모리, 사용자 지정 지침이 자동으로 연결되는 것도 아닙니다.

## 가장 쉬운 시작: Windows

1. 이 저장소를 내려받습니다. Git을 사용한다면 아래 명령을 실행합니다. Git이 없다면 GitHub의 **Code → Download ZIP**으로 받아 압축을 풉니다.

   ```powershell
   git clone https://github.com/jinyounghub/ai-chatroom.git
   cd ai-chatroom
   ```

2. **`setup.bat`을 더블클릭**합니다. 언어, Node.js 22 이상, Codex 설치, ChatGPT 계정 로그인, 방 이름과 포트를 순서대로 안내합니다. 설치나 변경 전에 확인을 받습니다. Node.js를 처음 설치했다면 터미널 창을 닫고 설치 도우미를 다시 실행합니다.
3. 로그인은 **ChatGPT 계정으로 로그인**을 선택합니다. API 키 로그인은 별도 API 과금이므로 구독으로 쓰려는 경우 선택하지 않습니다. 이미 로그인한 Codex CLI가 있으면 같은 Windows 사용자 환경에서 재사용합니다.
4. 선택 항목인 **테스트 대화**를 실행하면 네 멤버를 한 명씩 호출합니다. 이 단계는 실제 모델 사용량을 소비합니다. 네 명 모두 `[OK]`인지 확인합니다. **설치 파일이 발견됨**과 **실제 모델 응답 성공**은 별개입니다.
5. **`start.bat`을 더블클릭**합니다. 브라우저에서 `http://localhost:8321`을 열고 **방 켜기**를 누릅니다. 설정에서 포트를 바꿨다면 해당 포트를 사용합니다.

다음 실행부터는 `start.bat`만 열면 됩니다. 서버 창을 닫거나 `Ctrl+C`를 누르면 종료됩니다. PC를 끄면 이 로컬 방도 멈춥니다.

## 이미 Node.js와 Codex가 설치된 경우

```powershell
node --version
codex --version
codex login status
node setup.mjs --check
node server.mjs --open
```

Node.js는 22 이상을 사용합니다. 최신 Codex가 필요합니다. CLI가 없거나 오래됐다면:

```powershell
npm install -g @openai/codex@latest
codex login
```

`npm install`로 앱 의존성을 설치하는 별도 단계는 없습니다. 서버는 Node.js 기본 모듈만 사용합니다. 위 npm 명령은 **Codex 자체의 설치**입니다.

`node setup.mjs --check`는 설치와 로그인 상태를 확인하는 진단입니다. 실제 모델 호출 성공을 보장하지 않습니다. 모델 응답 확인은 `node setup.mjs`의 선택 테스트를 사용합니다.

## macOS / Linux

```bash
git clone https://github.com/jinyounghub/ai-chatroom.git
cd ai-chatroom
sh setup.sh
sh start.sh
```

Node.js 22 이상과 현재 사용자로 로그인한 Codex가 필요합니다. 이미 준비됐다면 `node setup.mjs`와 `node server.mjs --open`을 사용해도 됩니다. Windows 네이티브와 WSL은 서로 다른 실행 환경이므로 **서버를 실행하는 환경에서** Codex 설치와 로그인을 확인하세요.

## 네 멤버 사용하기

```text
@ChatGPT-1 오늘 할 일을 정리해줘.
@ChatGPT-2 방금 계획의 빠진 점을 찾아줘.
@ChatGPT-3 다른 대안을 제안해줘.
@ChatGPT-4 앞의 의견을 종합해줘.
```

`@`를 입력하면 멤버 자동완성이 나옵니다. `@GPT1`, `@지피티1`처럼 번호가 있는 별칭도 지원합니다. 여러 멤버를 한 메시지에서 호출할 수 있습니다. 원본처럼 대화 흐름에 따라 응답을 건너뛰기도 하므로 **모든 메시지마다 네 명이 반드시 답하는 방식은 아닙니다**. 사이드바에서 참여 멤버를 개별로 끌 수 있습니다.

진심모드가 필요할 때:

```text
/boost @ChatGPT-1 이 계획의 문제점을 자세히 검토해줘.
```

멤버별 말투는 대화와 개인 메모에 따라 형성됩니다. 같은 GPT 모델을 네 번 쓰는 것이므로 서로 다른 회사의 모델을 비교하는 효과를 기대해서는 안 됩니다. 역할을 다르게 주어 관점을 나누는 용도입니다.

## 모델, 사용량과 기본 설정

새 방의 기본 설정:

| 항목 | 기본값 |
|---|---|
| 일반 대화 모델 | 네 명 모두 `gpt-6-sol`, effort `low` |
| 진심모드 모델 | `gpt-6-astra`, effort `medium` |
| 진심모드 전환 | `manual` |
| 동시에 진행하는 일반 대화 턴 | `maxInFlight: 1` |
| 이미지 생성 모델 | `gpt-6-luna` |
| 이미지 생성 | 켜짐, 필요 없다면 `imageGen: false` |
| 웹 검색 | 꺼짐 |
| 외부 접속 | 꺼짐, 로컬 `127.0.0.1:8321` |

**네 멤버가 한 계정의 Codex 한도를 공유합니다. 계정 한도가 네 배가 되는 것이 아닙니다.** 같은 계정으로 하는 다른 Codex 작업도 사용량에 영향을 줄 수 있습니다. 한도 패널은 한 계정 카드로 통합했고, 멤버의 호출 횟수와 계정 전체 사용량을 구분합니다. 동시 대화 턴을 하나로 제한해도 이미지 설명, 이미지 생성 같은 보조 호출의 총량을 제한하는 하드 예산은 아닙니다. 장시간 자동 대화는 사용량을 소모하므로 사용하지 않을 때 방을 끄세요.

모델 접근 권한은 계정과 워크스페이스에 따라 달라집니다. 위 이름을 설정했다고 사용할 권한이 생기는 것은 아닙니다. `codex`에서 사용할 수 있는 모델을 확인하고 `config.json`의 `agents.<id>.model`, `effort`, `boost`, `imageModel`을 바꾸세요. `gpt-6-sol`은 이 포크가 유지하는 기본값이지 항상 최신 모델이라는 뜻은 아닙니다.

예를 들어 ChatGPT-1만 다른 GPT 모델로 바꾸려면 기존 설정의 해당 부분을 수정합니다:

```json
{
  "agents": {
    "claude": {
      "model": "gpt-6-luna",
      "effort": "low",
      "boost": null
    }
  }
}
```

다른 설정은 유지하고 합쳐서 저장하세요. 설정 변경 후 서버를 재시작합니다. 실제 모델 응답과 이미지 생성은 계정에서 테스트해야 합니다. 이미지 생성 도구를 사용할 수 없다면 `imageGen: false`로 텍스트 대화부터 확인하세요.

## 기존 설치 업데이트와 기록 보존

서버를 종료한 다음 Git으로 받은 폴더에서 실행합니다:

```bash
git pull --ff-only origin main
node setup.mjs --check
```

직접 소스를 수정한 파일 때문에 Git이 중단하면 덮어쓰지 말고 변경 내용을 먼저 보존합니다. ZIP으로 업데이트할 때도 아래 데이터와 설정을 백업한 뒤 유지하세요.

| 저장 키 | 화면 이름 | 보존되는 항목 |
|---|---|---|
| `claude` | ChatGPT-1 | 이전 첫 번째 멤버 기록과 메모 |
| `gpt` | ChatGPT-2 | 이전 ChatGPT 기록과 메모 |
| `grok` | ChatGPT-3 | 이전 세 번째 멤버 기록과 메모 |
| `gemini` | ChatGPT-4 | 이전 네 번째 멤버 기록과 메모 |

내부 ID는 기존 `data/notes/`, 메시지 발신자, 캐릭터 이미지, 월드 저장 데이터와의 호환성을 위해 남겼습니다. **ID가 `claude`여도 실행되는 것은 Codex입니다.** 기존 아바타는 멤버 구분용으로 유지합니다. `@ChatGPT`처럼 번호가 없는 옛 별칭은 호환성을 위해 ChatGPT-2를 부릅니다. 혼동을 피하려면 번호를 쓰세요.

예전 `sonnet`, `opus`, `grok-*`, `gemini-*` 모델 설정은 서버가 읽을 때 GPT 기본값으로 변환합니다. 서버는 원래 `config.json`을 자동으로 덮어쓰지 않습니다. 설치 도우미에서 설정 변경을 선택하면 새 설정으로 저장하고 기존 파일은 `backups/`에 보관합니다. 기존 방에 저장된 속도, 진심모드 설정은 유지될 수 있습니다.

백업할 항목은 `config.json`, `data/`, `workspace/`, 직접 만든 `assets/sheets/`입니다. API 키, 로그인 파일, `data/`의 토큰은 GitHub에 올리지 마세요.

## 문제 해결

| 증상 | 확인할 내용 |
|---|---|
| 네 명 모두 오프라인 | `node setup.mjs --check`로 Codex 실행 파일 경로 확인 |
| Windows에서 Codex를 못 찾음 | 최신 설치 도우미 재실행. 수동 `bins.codex`는 `.cmd`가 아닌 실제 `codex.exe` 경로 사용 |
| 로그인 오류 | 서버와 같은 사용자 및 Windows/WSL 환경에서 `codex login` 실행 |
| `unknown argument` 또는 feature 오류 | Codex 업데이트 후 `node scripts/check-codex.mjs` 실행 |
| 모델 사용 불가 | 계정에 표시되는 모델을 `agents.<id>.model`에 설정, 필요하면 `boost: null` |
| 웹페이지는 열리는데 답이 없음 | **방 켜기**, 멤버 참여 상태, 계정 한도, `data/logs/` 오류 확인 |
| 포트 사용 중 | 기존 서버를 종료하거나 `config.json`의 `port` 변경 |
| 한도 조회 실패 | 계정 로그인과 Codex 버전 확인. 표시된 이전 수치는 최신값이 아닐 수 있음 |
| 설정 JSON 오류 | 서버가 오류를 표시하고 종료함. JSON을 고친 뒤 재시작 |

## 로컬 사용과 안전 범위

처음에는 로컬 주소로 사용하세요. 이 프로젝트는 여러 사용자를 위한 공개 서비스가 아닙니다. 로컬 HTTP 서버를 그대로 인터넷에 공개하지 마세요. 원본의 별도 외부 접속 기능은 비밀번호와 HTTPS를 사용하는 선택 기능이며 기본적으로 꺼져 있습니다. 개발 세션을 연결하는 MCP 브리지는 일반 대화에 필수가 아닙니다.

일반 대화는 읽기 전용 샌드박스에서 shell, computer use, browser use, apps를 끄고 실행하며 사용자 Codex 설정을 자동으로 가져오지 않습니다. 이미지 생성은 결과 저장을 위한 별도 작업 폴더를 사용합니다. 이는 CLI와 운영체제의 제한을 적용하는 구조이지, 모든 상황에서 완벽한 격리를 보증하는 것은 아닙니다.

## 개발 검증

```bash
node scripts/check.mjs
node --test test/chatgpt.test.mjs test/server.test.mjs
node scripts/check-codex.mjs
```

첫 두 명령은 계정이나 모델 비용 없이 수행됩니다. 테스트는 설정 이관, 멤버 호출, 모델 선택, 이미지 실행 경로, 메모 분리, 사용량 공유, HTTP 서버를 검증합니다. 실제 서버와 가짜 CLI를 연결하는 통합 테스트는 POSIX 실행 파일을 사용하므로 Windows에서는 그 테스트만 제외합니다. 나머지 어댑터와 HTTP 테스트는 Windows에서도 수행합니다.

마지막 명령은 설치된 Codex의 실행 파일, 옵션, feature 이름만 확인합니다. 로그인이나 모델 호출은 하지 않으며 실제 답변이나 이미지 결과를 검증하는 명령도 아닙니다. GitHub Actions에서 Linux와 Windows 검증을 실행합니다.

## 원본과 동기화 기준

원본: [Moris-kr/ai-chatroom](https://github.com/Moris-kr/ai-chatroom), MIT 라이선스.
2026-10-02 확인 시 포크의 `13e4ba3` 뒤에 있던 원본 커밋 2개를 반영했습니다. 기준 커밋은 **`abca3104766ca4bbf2624c13636f0220993d0416`**입니다. 원본의 설치 도우미, 한국어/영어/일본어 지원, 개발 브리지, 월드 및 기타 개선을 기반으로 ChatGPT-only 변경을 추가했습니다.

공식 참고: [Codex CLI](https://learn.chatgpt.com/docs/codex/cli), [ChatGPT 계정으로 Codex 사용](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan), [모델 안내](https://learn.chatgpt.com/docs/models), [비대화형 실행](https://learn.chatgpt.com/docs/non-interactive-mode).
